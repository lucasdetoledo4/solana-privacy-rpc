/**
 * Response types for the Privacy RPC SDK
 */

import { Query } from "./query";

/**
 * Result of a single query execution
 */
export interface QueryResult {
    /** The query ID this result corresponds to */
    id: string;

    /** Whether the query succeeded */
    success: boolean;

    /** The result data (if successful) */
    data?: unknown;

    /** Error message (if failed) */
    error?: string;
}

/**
 * Request to execute a batch of queries
 */
export interface BatchRequest {
    /** The queries to execute */
    queries: Query[];

    /** SHA-256 hash of the batch for verification */
    batchHash?: string;

    /** On-chain batch ID (for coordinated batches) */
    batchId?: string;
}

/**
 * Response from batch execution
 */
export interface BatchResponse {
    /** Whether the batch execution succeeded overall */
    success: boolean;

    /** Individual query results */
    results: QueryResult[];

    /** Total execution time in milliseconds */
    executionTimeMs: number;

    /** Number of queries that succeeded */
    succeededCount: number;

    /** Number of queries that failed */
    failedCount: number;

    /** Hash of the results batch */
    batchHash: string;
}

/**
 * Create a batch request from queries
 */
export function createBatchRequest(queries: Query[], batchHash?: string): BatchRequest {
    return {
        queries,
        batchHash,
    };
}
