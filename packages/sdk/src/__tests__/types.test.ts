/**
 * Tests for types and type utilities
 */

import {
    resolveConfig,
    createQuery,
    createBatchRequest,
    isAccountInfoResult,
    isBalanceResult,
    DEFAULT_BATCH_SIZE,
    DEFAULT_MAX_WAIT_TIME,
    DEFAULT_TIMEOUT,
    PrivacyConfig,
} from "../types";
import { RpcMethod } from "../enums";

describe("Config", () => {
    describe("resolveConfig", () => {
        it("should apply defaults for missing values", () => {
            const config: PrivacyConfig = {
                proxyEndpoint: "http://localhost:3000",
            };

            const resolved = resolveConfig(config);

            expect(resolved.proxyEndpoint).toBe("http://localhost:3000");
            expect(resolved.batchSize).toBe(DEFAULT_BATCH_SIZE);
            expect(resolved.maxWaitTime).toBe(DEFAULT_MAX_WAIT_TIME);
            expect(resolved.timeout).toBe(DEFAULT_TIMEOUT);
        });

        it("should use provided values", () => {
            const config: PrivacyConfig = {
                proxyEndpoint: "http://localhost:3000",
                batchSize: 5,
                maxWaitTime: 2000,
                timeout: 10000,
            };

            const resolved = resolveConfig(config);

            expect(resolved.batchSize).toBe(5);
            expect(resolved.maxWaitTime).toBe(2000);
            expect(resolved.timeout).toBe(10000);
        });
    });

    describe("default constants", () => {
        it("should have correct values", () => {
            expect(DEFAULT_BATCH_SIZE).toBe(10);
            expect(DEFAULT_MAX_WAIT_TIME).toBe(5000);
            expect(DEFAULT_TIMEOUT).toBe(30000);
        });
    });
});

describe("Query", () => {
    describe("createQuery", () => {
        it("should create a query object", () => {
            const query = createQuery(
                "test-id",
                RpcMethod.GetBalance,
                "11111111111111111111111111111111",
                "confirmed"
            );

            expect(query.id).toBe("test-id");
            expect(query.method).toBe(RpcMethod.GetBalance);
            expect(query.pubkey).toBe("11111111111111111111111111111111");
            expect(query.commitment).toBe("confirmed");
        });

        it("should allow optional commitment", () => {
            const query = createQuery(
                "test-id",
                RpcMethod.GetBalance,
                "11111111111111111111111111111111"
            );

            expect(query.commitment).toBeUndefined();
        });
    });
});

describe("Response", () => {
    describe("createBatchRequest", () => {
        it("should create a batch request", () => {
            const queries = [
                createQuery("1", RpcMethod.GetBalance, "pubkey1"),
                createQuery("2", RpcMethod.GetBalance, "pubkey2"),
            ];

            const request = createBatchRequest(queries, "hash123");

            expect(request.queries).toEqual(queries);
            expect(request.batchHash).toBe("hash123");
        });

        it("should allow optional batchHash", () => {
            const queries = [createQuery("1", RpcMethod.GetBalance, "pubkey1")];

            const request = createBatchRequest(queries);

            expect(request.batchHash).toBeUndefined();
        });
    });
});

describe("Result type guards", () => {
    describe("isAccountInfoResult", () => {
        it("should return true for valid AccountInfoResult", () => {
            const result = {
                lamports: 1000000,
                owner: "11111111111111111111111111111111",
                executable: false,
                rentEpoch: 100,
                dataLength: 0,
            };

            expect(isAccountInfoResult(result)).toBe(true);
        });

        it("should return false for invalid objects", () => {
            expect(isAccountInfoResult(null)).toBe(false);
            expect(isAccountInfoResult(undefined)).toBe(false);
            expect(isAccountInfoResult({})).toBe(false);
            expect(isAccountInfoResult({ lamports: 1000 })).toBe(false);
            expect(isAccountInfoResult({ lamports: "1000" })).toBe(false);
        });
    });

    describe("isBalanceResult", () => {
        it("should return true for valid BalanceResult", () => {
            const result = { lamports: 1000000 };

            expect(isBalanceResult(result)).toBe(true);
        });

        it("should return false for invalid objects", () => {
            expect(isBalanceResult(null)).toBe(false);
            expect(isBalanceResult(undefined)).toBe(false);
            expect(isBalanceResult({})).toBe(false);
            expect(isBalanceResult({ lamports: "1000" })).toBe(false);
        });
    });
});
