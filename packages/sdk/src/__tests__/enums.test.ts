/**
 * Tests for enums
 */

import {
    RpcMethod,
    getSupportedMethods,
    isValidRpcMethod,
    BatchStatus,
    isTerminalStatus,
    CommitmentLevel,
    DEFAULT_COMMITMENT,
} from "../enums";

describe("RpcMethod", () => {
    it("should have correct values", () => {
        expect(RpcMethod.GetBalance).toBe("getBalance");
        expect(RpcMethod.GetAccountInfo).toBe("getAccountInfo");
    });

    describe("getSupportedMethods", () => {
        it("should return all methods", () => {
            const methods = getSupportedMethods();
            expect(methods).toContain(RpcMethod.GetBalance);
            expect(methods).toContain(RpcMethod.GetAccountInfo);
            expect(methods.length).toBe(2);
        });
    });

    describe("isValidRpcMethod", () => {
        it("should return true for valid methods", () => {
            expect(isValidRpcMethod("getBalance")).toBe(true);
            expect(isValidRpcMethod("getAccountInfo")).toBe(true);
        });

        it("should return false for invalid methods", () => {
            expect(isValidRpcMethod("invalidMethod")).toBe(false);
            expect(isValidRpcMethod("")).toBe(false);
        });
    });
});

describe("BatchStatus", () => {
    it("should have correct values", () => {
        expect(BatchStatus.Pending).toBe("pending");
        expect(BatchStatus.Executing).toBe("executing");
        expect(BatchStatus.Completed).toBe("completed");
        expect(BatchStatus.Failed).toBe("failed");
        expect(BatchStatus.Cancelled).toBe("cancelled");
    });

    describe("isTerminalStatus", () => {
        it("should return true for terminal statuses", () => {
            expect(isTerminalStatus(BatchStatus.Completed)).toBe(true);
            expect(isTerminalStatus(BatchStatus.Failed)).toBe(true);
            expect(isTerminalStatus(BatchStatus.Cancelled)).toBe(true);
        });

        it("should return false for non-terminal statuses", () => {
            expect(isTerminalStatus(BatchStatus.Pending)).toBe(false);
            expect(isTerminalStatus(BatchStatus.Executing)).toBe(false);
        });
    });
});

describe("CommitmentLevel", () => {
    it("should have correct values", () => {
        expect(CommitmentLevel.Processed).toBe("processed");
        expect(CommitmentLevel.Confirmed).toBe("confirmed");
        expect(CommitmentLevel.Finalized).toBe("finalized");
    });

    it("should have correct default", () => {
        expect(DEFAULT_COMMITMENT).toBe(CommitmentLevel.Confirmed);
    });
});
