/**
 * Privacy RPC SDK
 *
 * Privacy-preserving SDK for Solana RPC with k-anonymity batching.
 *
 * @packageDocumentation
 */

// Main exports
export { PrivateConnection } from "./PrivateConnection";
export { BatchManager } from "./BatchManager";
export { OnChainBatchManager } from "./OnChainBatchManager";
export type { OnChainConfig } from "./OnChainBatchManager";

// Enum exports
export {
    RpcMethod,
    getSupportedMethods,
    isValidRpcMethod,
    BatchStatus,
    isTerminalStatus,
    CommitmentLevel,
    DEFAULT_COMMITMENT,
} from "./enums";

// Type exports
export type {
    PrivacyConfig,
    ResolvedPrivacyConfig,
    Query,
    PendingQuery,
    QueryResult,
    BatchRequest,
    BatchResponse,
    AccountInfoResult,
    BalanceResult,
} from "./types";

// Type utilities
export {
    resolveConfig,
    createQuery,
    createBatchRequest,
    isAccountInfoResult,
    isBalanceResult,
    DEFAULT_BATCH_SIZE,
    DEFAULT_MAX_WAIT_TIME,
    DEFAULT_TIMEOUT,
} from "./types";

// Utility exports
export { generateQueryId, hashQuery, hashBatch, verifyBatchHash } from "./utils";

// Coordinator exports (on-chain)
export { CoordinatorClient, PROGRAM_ID as COORDINATOR_PROGRAM_ID } from "./coordinator";
export type { BatchAccount, CoordinatorState } from "./coordinator";
