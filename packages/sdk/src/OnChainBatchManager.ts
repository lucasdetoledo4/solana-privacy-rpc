/**
 * On-chain coordinated batch manager
 *
 * Extends batch management with on-chain coordination for true k-anonymity
 * across multiple independent users.
 */

import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction,
} from "@solana/web3.js";
import axios, { AxiosInstance } from "axios";
import { CoordinatorClient } from "./coordinator";
import { hashQuery, hashBatch } from "./utils";
import { RpcMethod } from "./enums";
import {
    BatchRequest,
    BatchResponse,
    PendingQuery,
    Query,
} from "./types";

export interface OnChainConfig {
    /** URL of the privacy proxy server */
    proxyEndpoint: string;

    /** Solana connection for on-chain operations */
    connection: Connection;

    /** Wallet keypair for signing transactions */
    wallet: Keypair;

    /** Optional custom coordinator program ID */
    coordinatorProgramId?: string;

    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;

    /** Poll interval for checking batch status in ms (default: 2000) */
    pollInterval?: number;
}

interface QueuedQuery extends PendingQuery {
    hash: Uint8Array;
}

/**
 * Manages batching with on-chain coordination
 *
 * Flow:
 * 1. User adds query → hash submitted on-chain
 * 2. When min queries reached (from any users) → batch finalized
 * 3. SDK sends actual queries to proxy for execution
 * 4. Results returned → batch marked complete on-chain
 */
export class OnChainBatchManager {
    private readonly config: Required<OnChainConfig>;
    private readonly coordinator: CoordinatorClient;
    private readonly httpClient: AxiosInstance;
    private queuedQueries: QueuedQuery[] = [];
    private currentBatchId: bigint | null = null;
    private isProcessing = false;

    constructor(config: OnChainConfig) {
        this.config = {
            proxyEndpoint: config.proxyEndpoint,
            connection: config.connection,
            wallet: config.wallet,
            coordinatorProgramId: config.coordinatorProgramId || "",
            timeout: config.timeout ?? 30000,
            pollInterval: config.pollInterval ?? 2000,
        };

        this.coordinator = new CoordinatorClient(
            config.connection,
            config.coordinatorProgramId
        );

        this.httpClient = axios.create({
            baseURL: config.proxyEndpoint,
            timeout: this.config.timeout,
            headers: { "Content-Type": "application/json" },
        });
    }

    /**
     * Add a query - submits hash on-chain and returns promise for result
     */
    async addQuery<T>(
        method: RpcMethod,
        pubkey: string,
        commitment?: string
    ): Promise<T> {
        const query: Query = {
            id: crypto.randomUUID(),
            method,
            pubkey,
            commitment: commitment as Query["commitment"],
        };

        const queryHashHex = hashQuery(query);
        const queryHash = Buffer.from(queryHashHex, "hex");

        return new Promise<T>(async (resolve, reject) => {
            const queuedQuery: QueuedQuery = {
                ...query,
                hash: queryHash,
                resolve: resolve as (value: unknown) => void,
                reject,
            };

            this.queuedQueries.push(queuedQuery);

            try {
                await this.submitQueryOnChain(queryHash);
                this.startProcessingLoop();
            } catch (error) {
                // Remove from queue on failure
                this.queuedQueries = this.queuedQueries.filter(
                    (q) => q.id !== query.id
                );
                reject(error);
            }
        });
    }

    /**
     * Submit query hash to on-chain coordinator
     */
    private async submitQueryOnChain(queryHash: Uint8Array): Promise<void> {
        // Find or create pending batch
        let batchId = await this.coordinator.findPendingBatch();

        if (batchId === null) {
            // Create new batch
            const state = await this.coordinator.getCoordinatorState();
            if (!state) {
                throw new Error("Coordinator not initialized");
            }
            batchId = state.batchCounter;

            const createIx = this.coordinator.createBatchInstruction(
                batchId,
                this.config.wallet.publicKey
            );

            const tx = new Transaction().add(createIx);
            await sendAndConfirmTransaction(this.config.connection, tx, [
                this.config.wallet,
            ]);
        }

        this.currentBatchId = batchId;

        // Submit query to batch
        const submitIx = this.coordinator.createSubmitQueryInstruction(
            batchId,
            queryHash,
            this.config.wallet.publicKey
        );

        const tx = new Transaction().add(submitIx);
        await sendAndConfirmTransaction(this.config.connection, tx, [
            this.config.wallet,
        ]);
    }

    /**
     * Start polling for batch finalization
     */
    private startProcessingLoop(): void {
        if (this.isProcessing) return;
        this.isProcessing = true;

        const poll = async () => {
            while (this.queuedQueries.length > 0 && this.currentBatchId !== null) {
                const batch = await this.coordinator.getBatch(this.currentBatchId);

                if (!batch) {
                    await this.sleep(this.config.pollInterval);
                    continue;
                }

                if (batch.status === "pending") {
                    // Check if we can finalize
                    const state = await this.coordinator.getCoordinatorState();
                    if (state && batch.queryCount >= state.minBatchSize) {
                        await this.finalizeBatch(this.currentBatchId);
                    } else {
                        await this.sleep(this.config.pollInterval);
                        continue;
                    }
                }

                if (batch.status === "finalized") {
                    await this.executeBatch(this.currentBatchId);
                    this.currentBatchId = null;
                    break;
                }

                await this.sleep(this.config.pollInterval);
            }

            this.isProcessing = false;
        };

        poll().catch((error) => {
            this.isProcessing = false;
            // Reject all pending queries
            for (const query of this.queuedQueries) {
                query.reject(error);
            }
            this.queuedQueries = [];
        });
    }

    /**
     * Finalize batch on-chain
     */
    private async finalizeBatch(batchId: bigint): Promise<void> {
        const finalizeIx = this.coordinator.createFinalizeBatchInstruction(batchId);
        const tx = new Transaction().add(finalizeIx);
        await sendAndConfirmTransaction(this.config.connection, tx, [
            this.config.wallet,
        ]);
    }

    /**
     * Execute batch via proxy
     */
    private async executeBatch(batchId: bigint): Promise<void> {
        const queries = this.queuedQueries;
        this.queuedQueries = [];

        if (queries.length === 0) return;

        const queryData: Query[] = queries.map((q) => ({
            id: q.id,
            method: q.method,
            pubkey: q.pubkey,
            commitment: q.commitment,
        }));

        const request: BatchRequest & { batchId: string } = {
            queries: queryData,
            batchHash: hashBatch(queryData),
            batchId: batchId.toString(),
        };

        try {
            const response = await this.httpClient.post<BatchResponse>(
                "/execute-batch",
                request
            );

            // Map results
            const resultMap = new Map<string, BatchResponse["results"][0]>();
            for (const result of response.data.results) {
                resultMap.set(result.id, result);
            }

            // Resolve queries
            for (const query of queries) {
                const result = resultMap.get(query.id);
                if (!result) {
                    query.reject(new Error(`No result for query ${query.id}`));
                } else if (result.success) {
                    query.resolve(result.data);
                } else {
                    query.reject(new Error(result.error ?? "Query failed"));
                }
            }

            // Mark batch complete on-chain
            const resultsHash = Buffer.from(response.data.batchHash, "hex");
            await this.completeBatch(batchId, resultsHash);
        } catch (error) {
            for (const query of queries) {
                query.reject(
                    error instanceof Error ? error : new Error("Batch execution failed")
                );
            }
        }
    }

    /**
     * Mark batch complete on-chain
     */
    private async completeBatch(
        batchId: bigint,
        resultsHash: Uint8Array
    ): Promise<void> {
        const completeIx = this.coordinator.createCompleteBatchInstruction(
            batchId,
            resultsHash,
            this.config.wallet.publicKey
        );
        const tx = new Transaction().add(completeIx);
        await sendAndConfirmTransaction(this.config.connection, tx, [
            this.config.wallet,
        ]);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Get pending query count
     */
    get pendingCount(): number {
        return this.queuedQueries.length;
    }

    /**
     * Get current batch ID being processed
     */
    get activeBatchId(): bigint | null {
        return this.currentBatchId;
    }

    /**
     * Get coordinator client for direct access
     */
    getCoordinator(): CoordinatorClient {
        return this.coordinator;
    }
}
