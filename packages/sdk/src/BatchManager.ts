/**
 * Batch manager for accumulating and executing queries
 *
 * Handles the batching logic, including timeout-based execution
 * and k-anonymity enforcement.
 */

import axios, { AxiosInstance } from "axios";
import { generateQueryId, hashBatch } from "./utils";
import { RpcMethod } from "./enums";
import {
    BatchRequest,
    BatchResponse,
    PendingQuery,
    PrivacyConfig,
    Query,
    ResolvedPrivacyConfig,
    resolveConfig,
} from "./types";

/**
 * Manages batching of queries for privacy-preserving execution
 */
export class BatchManager {
    private readonly config: ResolvedPrivacyConfig;
    private readonly httpClient: AxiosInstance;
    private pendingQueries: PendingQuery[] = [];
    private batchTimer: NodeJS.Timeout | null = null;

    /**
     * Create a new BatchManager
     *
     * @param config - Privacy configuration
     */
    constructor(config: PrivacyConfig) {
        if (!config.proxyEndpoint) {
            throw new Error("PrivacyConfig.proxyEndpoint is required");
        }

        this.config = resolveConfig(config);

        this.httpClient = axios.create({
            baseURL: this.config.proxyEndpoint,
            timeout: this.config.timeout,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }

    /**
     * Add a query to the batch and return a promise for its result
     *
     * @param method - The RPC method to execute
     * @param pubkey - The public key to query
     * @param commitment - Optional commitment level
     * @returns Promise resolving to the query result
     */
    addQuery<T>(method: RpcMethod, pubkey: string, commitment?: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const query: PendingQuery = {
                id: generateQueryId(),
                method,
                pubkey,
                commitment: commitment as PendingQuery["commitment"],
                resolve: resolve as (value: unknown) => void,
                reject,
            };

            this.pendingQueries.push(query);

            // Start timer if this is the first query in the batch
            if (this.pendingQueries.length === 1) {
                this.startBatchTimer();
            }

            // Execute immediately if batch is full
            if (this.pendingQueries.length >= this.config.batchSize) {
                this.executeBatch();
            }
        });
    }

    /**
     * Start the batch timer
     *
     * The timer will execute the batch after maxWaitTime even if
     * the batch is not full, to prevent indefinite waiting.
     */
    private startBatchTimer(): void {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }

        this.batchTimer = setTimeout(() => {
            if (this.pendingQueries.length > 0) {
                this.executeBatch();
            }
        }, this.config.maxWaitTime);
    }

    /**
     * Execute the current batch of pending queries
     */
    private async executeBatch(): Promise<void> {
        // Clear the timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        // Take all pending queries
        const queries = this.pendingQueries;
        this.pendingQueries = [];

        if (queries.length === 0) {
            return;
        }

        // Build the batch request
        const queryData: Query[] = queries.map((q) => ({
            id: q.id,
            method: q.method,
            pubkey: q.pubkey,
            commitment: q.commitment,
        }));

        const request: BatchRequest = {
            queries: queryData,
            batchHash: hashBatch(queryData),
        };

        try {
            const response = await this.httpClient.post<BatchResponse>("/execute-batch", request);

            // Map results back to their queries
            const resultMap = new Map<string, BatchResponse["results"][0]>();
            for (const result of response.data.results) {
                resultMap.set(result.id, result);
            }

            // Resolve or reject each query's promise
            for (const query of queries) {
                const result = resultMap.get(query.id);

                if (!result) {
                    query.reject(new Error(`No result received for query ${query.id}`));
                } else if (result.success) {
                    query.resolve(result.data);
                } else {
                    query.reject(new Error(result.error ?? "Query failed"));
                }
            }
        } catch (error) {
            // Reject all queries on batch failure
            const errorMessage = error instanceof Error ? error.message : "Batch execution failed";

            for (const query of queries) {
                query.reject(new Error(errorMessage));
            }
        }
    }

    /**
     * Force execution of any pending queries
     *
     * Useful for cleanup or when immediate execution is needed.
     */
    async flush(): Promise<void> {
        if (this.pendingQueries.length > 0) {
            await this.executeBatch();
        }
    }

    /**
     * Clean up resources
     *
     * Clears any pending timers. Pending queries will be rejected.
     */
    destroy(): void {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = null;
        }

        // Reject any remaining queries
        for (const query of this.pendingQueries) {
            query.reject(new Error("BatchManager destroyed"));
        }
        this.pendingQueries = [];
    }

    /**
     * Get the number of pending queries
     */
    get pendingCount(): number {
        return this.pendingQueries.length;
    }

    /**
     * Get the current configuration
     */
    getConfig(): ResolvedPrivacyConfig {
        return { ...this.config };
    }
}
