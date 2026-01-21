/**
 * Tests for BatchManager
 */

import { BatchManager } from "../BatchManager";
import { PrivacyConfig, BatchResponse } from "../types";
import { RpcMethod } from "../enums";

// Mock axios
jest.mock("axios", () => ({
    create: jest.fn(() => ({
        post: jest.fn(),
    })),
}));

import axios from "axios";

describe("BatchManager", () => {
    let manager: BatchManager;
    let mockPost: jest.Mock;

    const defaultConfig: PrivacyConfig = {
        proxyEndpoint: "http://localhost:3000",
        batchSize: 3,
        maxWaitTime: 1000,
        timeout: 5000,
    };

    beforeEach(() => {
        mockPost = jest.fn();
        (axios.create as jest.Mock).mockReturnValue({ post: mockPost });
        manager = new BatchManager(defaultConfig);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    // Helper to create mock response that maps query IDs from request
    const createMockResponse = (
        transform: (
            queryId: string,
            index: number
        ) => { success: boolean; data?: unknown; error?: string }
    ) => {
        mockPost.mockImplementation((url: string, request: { queries: Array<{ id: string }> }) => {
            const results = request.queries.map((q, i) => ({
                id: q.id,
                ...transform(q.id, i),
            }));
            return Promise.resolve({
                data: {
                    success: results.every((r) => r.success),
                    results,
                    executionTimeMs: 100,
                    succeededCount: results.filter((r) => r.success).length,
                    failedCount: results.filter((r) => !r.success).length,
                } as BatchResponse,
            });
        });
    };

    describe("constructor", () => {
        it("should throw if proxyEndpoint is missing", () => {
            expect(() => new BatchManager({ proxyEndpoint: "" })).toThrow(
                "PrivacyConfig.proxyEndpoint is required"
            );
        });

        it("should use default values for optional config", () => {
            const minimalManager = new BatchManager({
                proxyEndpoint: "http://test.com",
            });

            const config = minimalManager.getConfig();
            expect(config.batchSize).toBe(10);
            expect(config.maxWaitTime).toBe(5000);
            expect(config.timeout).toBe(30000);

            minimalManager.destroy();
        });
    });

    describe("addQuery", () => {
        it("should accumulate queries until batch size is reached", async () => {
            createMockResponse((id, index) => ({
                success: true,
                data: { lamports: (index + 1) * 100 },
            }));

            // Add queries (batch size is 3)
            const promise1 = manager.addQuery(RpcMethod.GetBalance, "pubkey1");
            const promise2 = manager.addQuery(RpcMethod.GetBalance, "pubkey2");

            // Should not have executed yet
            expect(mockPost).not.toHaveBeenCalled();
            expect(manager.pendingCount).toBe(2);

            // Add third query to trigger batch
            const promise3 = manager.addQuery(RpcMethod.GetBalance, "pubkey3");

            // Wait for all promises
            const results = await Promise.all([promise1, promise2, promise3]);

            expect(mockPost).toHaveBeenCalledTimes(1);
            expect(mockPost).toHaveBeenCalledWith(
                "/execute-batch",
                expect.objectContaining({
                    queries: expect.arrayContaining([
                        expect.objectContaining({
                            method: RpcMethod.GetBalance,
                            pubkey: "pubkey1",
                        }),
                        expect.objectContaining({
                            method: RpcMethod.GetBalance,
                            pubkey: "pubkey2",
                        }),
                        expect.objectContaining({
                            method: RpcMethod.GetBalance,
                            pubkey: "pubkey3",
                        }),
                    ]),
                })
            );

            expect(results[0]).toEqual({ lamports: 100 });
            expect(results[1]).toEqual({ lamports: 200 });
            expect(results[2]).toEqual({ lamports: 300 });

            manager.destroy();
        });

        it("should execute batch on timeout", async () => {
            jest.useFakeTimers();

            createMockResponse(() => ({
                success: true,
                data: { lamports: 100 },
            }));

            // Add one query (below batch size)
            const promise = manager.addQuery(RpcMethod.GetBalance, "pubkey1");

            // Should not have executed yet
            expect(mockPost).not.toHaveBeenCalled();

            // Fast-forward past timeout
            jest.advanceTimersByTime(1500);

            const result = await promise;

            expect(mockPost).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ lamports: 100 });

            jest.useRealTimers();
            manager.destroy();
        });

        it("should reject all queries on batch failure", async () => {
            mockPost.mockRejectedValue(new Error("Network error"));

            const promise1 = manager.addQuery(RpcMethod.GetBalance, "pubkey1");
            const promise2 = manager.addQuery(RpcMethod.GetBalance, "pubkey2");
            const promise3 = manager.addQuery(RpcMethod.GetBalance, "pubkey3");

            await expect(promise1).rejects.toThrow("Network error");
            await expect(promise2).rejects.toThrow("Network error");
            await expect(promise3).rejects.toThrow("Network error");

            manager.destroy();
        });

        it("should reject individual query on query failure", async () => {
            createMockResponse((id, index) => {
                if (index === 1) {
                    return { success: false, error: "Invalid pubkey" };
                }
                return { success: true, data: { lamports: 100 } };
            });

            const promise1 = manager.addQuery(RpcMethod.GetBalance, "pubkey1");
            const promise2 = manager.addQuery(RpcMethod.GetBalance, "invalid");
            const promise3 = manager.addQuery(RpcMethod.GetBalance, "pubkey3");

            const results = await Promise.allSettled([promise1, promise2, promise3]);

            expect(results[0]).toEqual({ status: "fulfilled", value: { lamports: 100 } });
            expect(results[1]).toEqual({
                status: "rejected",
                reason: expect.objectContaining({ message: "Invalid pubkey" }),
            });
            expect(results[2]).toEqual({ status: "fulfilled", value: { lamports: 100 } });

            manager.destroy();
        });
    });

    describe("flush", () => {
        it("should execute pending queries immediately", async () => {
            createMockResponse(() => ({
                success: true,
                data: { lamports: 100 },
            }));

            const promise = manager.addQuery(RpcMethod.GetBalance, "pubkey1");

            // Should not have executed yet
            expect(mockPost).not.toHaveBeenCalled();

            // Flush
            await manager.flush();

            const result = await promise;

            expect(mockPost).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ lamports: 100 });

            manager.destroy();
        });

        it("should do nothing if no pending queries", async () => {
            await manager.flush();
            expect(mockPost).not.toHaveBeenCalled();

            manager.destroy();
        });
    });

    describe("destroy", () => {
        it("should reject pending queries", async () => {
            const localManager = new BatchManager(defaultConfig);
            const promise = localManager.addQuery(RpcMethod.GetBalance, "pubkey1");

            localManager.destroy();

            await expect(promise).rejects.toThrow("BatchManager destroyed");
        });

        it("should clear pending count", async () => {
            const localManager = new BatchManager(defaultConfig);
            const promise = localManager.addQuery(RpcMethod.GetBalance, "pubkey1");
            expect(localManager.pendingCount).toBe(1);

            localManager.destroy();
            expect(localManager.pendingCount).toBe(0);

            // Consume the rejection to prevent unhandled rejection
            await expect(promise).rejects.toThrow("BatchManager destroyed");
        });
    });

    describe("pendingCount", () => {
        it("should track pending queries", async () => {
            createMockResponse((id, index) => ({
                success: true,
                data: { lamports: (index + 1) * 100 },
            }));

            expect(manager.pendingCount).toBe(0);

            const promise1 = manager.addQuery(RpcMethod.GetBalance, "pubkey1");
            expect(manager.pendingCount).toBe(1);

            const promise2 = manager.addQuery(RpcMethod.GetBalance, "pubkey2");
            expect(manager.pendingCount).toBe(2);

            // Trigger batch execution
            const promise3 = manager.addQuery(RpcMethod.GetBalance, "pubkey3");

            // Wait for all to complete
            await Promise.all([promise1, promise2, promise3]);

            manager.destroy();
        });
    });
});
