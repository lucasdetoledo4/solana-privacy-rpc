/**
 * Type exports for the Privacy RPC SDK
 */

// Config types
export {
    PrivacyConfig,
    ResolvedPrivacyConfig,
    resolveConfig,
    DEFAULT_BATCH_SIZE,
    DEFAULT_MAX_WAIT_TIME,
    DEFAULT_TIMEOUT,
} from "./config";

// Query types
export { Query, PendingQuery, createQuery } from "./query";

// Response types
export { QueryResult, BatchRequest, BatchResponse, createBatchRequest } from "./response";

// Result types
export { AccountInfoResult, BalanceResult, isAccountInfoResult, isBalanceResult } from "./result";
