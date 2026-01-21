/**
 * Tests for QueryHasher utilities
 */

import { generateQueryId, hashQuery, hashBatch, verifyBatchHash } from "../utils";
import { Query } from "../types";
import { RpcMethod } from "../enums";

describe("QueryHasher", () => {
    describe("generateQueryId", () => {
        it("should generate unique IDs", () => {
            const id1 = generateQueryId();
            const id2 = generateQueryId();

            expect(id1).not.toBe(id2);
        });

        it("should generate IDs in UUID format", () => {
            const id = generateQueryId();

            // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        });
    });

    describe("hashQuery", () => {
        it("should produce deterministic hashes", () => {
            const query: Query = {
                id: "test-1",
                method: RpcMethod.GetBalance,
                pubkey: "11111111111111111111111111111111",
            };

            const hash1 = hashQuery(query);
            const hash2 = hashQuery(query);

            expect(hash1).toBe(hash2);
        });

        it("should produce different hashes for different queries", () => {
            const query1: Query = {
                id: "test-1",
                method: RpcMethod.GetBalance,
                pubkey: "11111111111111111111111111111111",
            };

            const query2: Query = {
                id: "test-2",
                method: RpcMethod.GetBalance,
                pubkey: "22222222222222222222222222222222",
            };

            expect(hashQuery(query1)).not.toBe(hashQuery(query2));
        });

        it("should ignore query ID in hash", () => {
            const query1: Query = {
                id: "id-1",
                method: RpcMethod.GetBalance,
                pubkey: "11111111111111111111111111111111",
            };

            const query2: Query = {
                id: "id-2",
                method: RpcMethod.GetBalance,
                pubkey: "11111111111111111111111111111111",
            };

            // Same query content, different IDs should produce same hash
            expect(hashQuery(query1)).toBe(hashQuery(query2));
        });

        it("should include commitment in hash", () => {
            const query1: Query = {
                id: "test-1",
                method: RpcMethod.GetBalance,
                pubkey: "11111111111111111111111111111111",
                commitment: "confirmed",
            };

            const query2: Query = {
                id: "test-1",
                method: RpcMethod.GetBalance,
                pubkey: "11111111111111111111111111111111",
                commitment: "finalized",
            };

            expect(hashQuery(query1)).not.toBe(hashQuery(query2));
        });

        it("should produce 64-character hex string", () => {
            const query: Query = {
                id: "test-1",
                method: RpcMethod.GetBalance,
                pubkey: "11111111111111111111111111111111",
            };

            const hash = hashQuery(query);

            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    describe("hashBatch", () => {
        it("should produce deterministic hashes regardless of query order", () => {
            const query1: Query = {
                id: "1",
                method: RpcMethod.GetBalance,
                pubkey: "11111111111111111111111111111111",
            };

            const query2: Query = {
                id: "2",
                method: RpcMethod.GetAccountInfo,
                pubkey: "22222222222222222222222222222222",
            };

            const hash1 = hashBatch([query1, query2]);
            const hash2 = hashBatch([query2, query1]);

            expect(hash1).toBe(hash2);
        });

        it("should produce different hashes for different batches", () => {
            const queries1: Query[] = [
                {
                    id: "1",
                    method: RpcMethod.GetBalance,
                    pubkey: "11111111111111111111111111111111",
                },
            ];

            const queries2: Query[] = [
                {
                    id: "1",
                    method: RpcMethod.GetBalance,
                    pubkey: "22222222222222222222222222222222",
                },
            ];

            expect(hashBatch(queries1)).not.toBe(hashBatch(queries2));
        });

        it("should handle empty batch", () => {
            const hash = hashBatch([]);
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    describe("verifyBatchHash", () => {
        it("should verify correct hash", () => {
            const queries: Query[] = [
                {
                    id: "1",
                    method: RpcMethod.GetBalance,
                    pubkey: "11111111111111111111111111111111",
                },
                {
                    id: "2",
                    method: RpcMethod.GetBalance,
                    pubkey: "22222222222222222222222222222222",
                },
            ];

            const hash = hashBatch(queries);

            expect(verifyBatchHash(queries, hash)).toBe(true);
        });

        it("should reject incorrect hash", () => {
            const queries: Query[] = [
                {
                    id: "1",
                    method: RpcMethod.GetBalance,
                    pubkey: "11111111111111111111111111111111",
                },
            ];

            expect(verifyBatchHash(queries, "invalid-hash")).toBe(false);
        });

        it("should reject modified batch", () => {
            const originalQueries: Query[] = [
                {
                    id: "1",
                    method: RpcMethod.GetBalance,
                    pubkey: "11111111111111111111111111111111",
                },
            ];

            const hash = hashBatch(originalQueries);

            const modifiedQueries: Query[] = [
                {
                    id: "1",
                    method: RpcMethod.GetBalance,
                    pubkey: "22222222222222222222222222222222",
                },
            ];

            expect(verifyBatchHash(modifiedQueries, hash)).toBe(false);
        });
    });
});
