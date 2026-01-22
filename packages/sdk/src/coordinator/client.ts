/**
 * Coordinator client for interacting with the on-chain coordinator program
 *
 * Provides methods to read state and create instructions for batch coordination.
 */

import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    TransactionInstruction,
    SystemProgram,
} from "@solana/web3.js";
import { createHash } from "crypto";
import { PROGRAM_ID } from "./idl";
import BN from "bn.js";

/**
 * On-chain batch account state
 */
export interface BatchAccount {
    /** Batch ID */
    id: bigint;
    /** Current batch status */
    status: "pending" | "finalized" | "executed";
    /** Number of queries in batch */
    queryCount: number;
    /** SHA-256 hashes of queries */
    queryHashes: Uint8Array[];
    /** Public keys of query submitters */
    submitters: PublicKey[];
    /** Creation timestamp (Unix) */
    createdAt: bigint;
    /** Finalization timestamp (Unix), null if not finalized */
    finalizedAt: bigint | null;
    /** SHA-256 hash of results, null if not executed */
    resultsHash: Uint8Array | null;
}

/**
 * On-chain coordinator state
 */
export interface CoordinatorState {
    /** Program authority (admin) */
    authority: PublicKey;
    /** Minimum queries required for batch (K parameter) */
    minBatchSize: number;
    /** Maximum queries allowed per batch */
    maxBatchSize: number;
    /** Counter for next batch ID */
    batchCounter: bigint;
}

/**
 * Client for interacting with the on-chain coordinator program
 *
 * @example
 * ```typescript
 * const connection = new Connection("https://api.devnet.solana.com");
 * const client = new CoordinatorClient(connection);
 *
 * // Get coordinator configuration
 * const state = await client.getCoordinatorState();
 * console.log(`K = ${state.minBatchSize}`);
 *
 * // Get batch details
 * const batch = await client.getBatch(42n);
 * console.log(`Status: ${batch.status}`);
 * ```
 */
export class CoordinatorClient {
    private connection: Connection;
    private programId: PublicKey;

    /**
     * Create a new coordinator client
     *
     * @param connection - Solana connection
     * @param programId - Optional custom program ID (uses default if not provided)
     */
    constructor(connection: Connection, programId?: string) {
        this.connection = connection;
        this.programId = new PublicKey(programId || PROGRAM_ID);
    }

    /**
     * Get the PDA for the coordinator state account
     *
     * @returns Tuple of [PublicKey, bump seed]
     */
    getCoordinatorStatePda(): [PublicKey, number] {
        return PublicKey.findProgramAddressSync([Buffer.from("coordinator")], this.programId);
    }

    /**
     * Get the PDA for a batch account
     *
     * @param batchId - Batch ID
     * @returns Tuple of [PublicKey, bump seed]
     */
    getBatchPda(batchId: bigint): [PublicKey, number] {
        const buffer = Buffer.alloc(8);
        buffer.writeBigUInt64LE(batchId);
        return PublicKey.findProgramAddressSync([Buffer.from("batch"), buffer], this.programId);
    }

    /**
     * Fetch the coordinator state from on-chain
     *
     * @returns Coordinator state or null if not initialized
     *
     * @example
     * ```typescript
     * const state = await client.getCoordinatorState();
     * console.log(`Minimum batch size (K): ${state.minBatchSize}`);
     * console.log(`Next batch ID: ${state.batchCounter}`);
     * ```
     */
    async getCoordinatorState(): Promise<CoordinatorState | null> {
        const [pda] = this.getCoordinatorStatePda();
        const account = await this.connection.getAccountInfo(pda);
        if (!account) return null;

        const data = account.data;
        // Skip 8-byte discriminator
        const authority = new PublicKey(data.slice(8, 40));
        const minBatchSize = data[40];
        const maxBatchSize = data[41];
        const batchCounter = data.readBigUInt64LE(42);

        return { authority, minBatchSize, maxBatchSize, batchCounter };
    }

    /**
     * Fetch a batch account from on-chain
     *
     * @param batchId - Batch ID to fetch
     * @returns Batch account or null if not found
     *
     * @example
     * ```typescript
     * const batch = await client.getBatch(42n);
     * if (batch) {
     *     console.log(`Status: ${batch.status}`);
     *     console.log(`Query count: ${batch.queryCount}`);
     * }
     * ```
     */
    async getBatch(batchId: bigint): Promise<BatchAccount | null> {
        const [pda] = this.getBatchPda(batchId);
        const account = await this.connection.getAccountInfo(pda);
        if (!account) return null;

        const data = account.data;
        let offset = 8; // Skip discriminator

        const id = data.readBigUInt64LE(offset);
        offset += 8;

        const statusByte = data[offset];
        offset += 1;
        const status = statusByte === 0 ? "pending" : statusByte === 1 ? "finalized" : "executed";

        const queryCount = data[offset];
        offset += 1;

        // Parse query_hashes vec
        const hashesLen = data.readUInt32LE(offset);
        offset += 4;
        const queryHashes: Uint8Array[] = [];
        for (let i = 0; i < hashesLen; i++) {
            queryHashes.push(data.slice(offset, offset + 32));
            offset += 32;
        }

        // Parse submitters vec
        const submittersLen = data.readUInt32LE(offset);
        offset += 4;
        const submitters: PublicKey[] = [];
        for (let i = 0; i < submittersLen; i++) {
            submitters.push(new PublicKey(data.slice(offset, offset + 32)));
            offset += 32;
        }

        const createdAt = data.readBigInt64LE(offset);
        offset += 8;

        const hasFinalizedAt = data[offset] === 1;
        offset += 1;
        const finalizedAt = hasFinalizedAt ? data.readBigInt64LE(offset) : null;
        if (hasFinalizedAt) offset += 8;

        const hasResultsHash = data[offset] === 1;
        offset += 1;
        const resultsHash = hasResultsHash ? data.slice(offset, offset + 32) : null;

        return {
            id,
            status,
            queryCount,
            queryHashes,
            submitters,
            createdAt,
            finalizedAt,
            resultsHash,
        };
    }

    /**
     * Find the most recent pending batch
     *
     * Searches backwards from the current batch counter to find
     * a batch that is still accepting queries.
     *
     * @returns Batch ID of pending batch, or null if none found
     *
     * @example
     * ```typescript
     * const pendingBatchId = await client.findPendingBatch();
     * if (pendingBatchId !== null) {
     *     console.log(`Can submit to batch ${pendingBatchId}`);
     * }
     * ```
     */
    async findPendingBatch(): Promise<bigint | null> {
        const state = await this.getCoordinatorState();
        if (!state) return null;

        // Search backwards from current counter
        for (let i = state.batchCounter - 1n; i >= 0n; i--) {
            const batch = await this.getBatch(i);
            if (batch && batch.status === "pending") {
                return i;
            }
        }
        return null;
    }

    /**
     * Find all batches that are finalized and ready for execution
     *
     * @returns Array of batch IDs with finalized status
     *
     * @example
     * ```typescript
     * const finalized = await client.findFinalizedBatches();
     * console.log(`${finalized.length} batches ready for execution`);
     * ```
     */
    async findFinalizedBatches(): Promise<bigint[]> {
        const state = await this.getCoordinatorState();
        if (!state) return [];

        const finalized: bigint[] = [];
        for (let i = 0n; i < state.batchCounter; i++) {
            const batch = await this.getBatch(i);
            if (batch && batch.status === "finalized") {
                finalized.push(i);
            }
        }
        return finalized;
    }

    /**
     * Create instruction to create a new batch
     *
     * @param batchId - ID for the new batch
     * @param payer - Public key of the transaction fee payer
     * @returns Transaction instruction
     *
     * @example
     * ```typescript
     * const ix = client.createBatchInstruction(42n, wallet.publicKey);
     * const tx = new Transaction().add(ix);
     * await sendAndConfirmTransaction(connection, tx, [wallet]);
     * ```
     */
    createBatchInstruction(batchId: bigint, payer: PublicKey): TransactionInstruction {
        const [coordinatorState] = this.getCoordinatorStatePda();
        const [batch] = this.getBatchPda(batchId);

        // Instruction discriminator for create_batch: sha256("global:create_batch")[0..8]
        const discriminator = Buffer.from([159, 198, 248, 43, 248, 31, 235, 86]);

        return new TransactionInstruction({
            keys: [
                { pubkey: coordinatorState, isSigner: false, isWritable: true },
                { pubkey: batch, isSigner: false, isWritable: true },
                { pubkey: payer, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data: discriminator,
        });
    }

    /**
     * Create instruction to submit a query hash to a batch
     *
     * @param batchId - Batch ID to submit to
     * @param queryHash - SHA-256 hash of the query (32 bytes)
     * @param submitter - Public key of the query submitter
     * @returns Transaction instruction
     *
     * @example
     * ```typescript
     * const queryHash = Buffer.from(hashQuery(query), 'hex');
     * const ix = client.createSubmitQueryInstruction(
     *     42n,
     *     queryHash,
     *     wallet.publicKey
     * );
     * ```
     */
    createSubmitQueryInstruction(
        batchId: bigint,
        queryHash: Uint8Array,
        submitter: PublicKey
    ): TransactionInstruction {
        const [coordinatorState] = this.getCoordinatorStatePda();
        const [batch] = this.getBatchPda(batchId);

        // Instruction discriminator for submit_query
        const discriminator = Buffer.from([171, 5, 144, 53, 144, 160, 163, 225]);

        const batchIdBuffer = Buffer.alloc(8);
        batchIdBuffer.writeBigUInt64LE(batchId);

        const data = Buffer.concat([discriminator, batchIdBuffer, Buffer.from(queryHash)]);

        return new TransactionInstruction({
            keys: [
                { pubkey: coordinatorState, isSigner: false, isWritable: false },
                { pubkey: batch, isSigner: false, isWritable: true },
                { pubkey: submitter, isSigner: true, isWritable: false },
            ],
            programId: this.programId,
            data,
        });
    }

    /**
     * Create instruction to finalize a batch
     *
     * Batch must have at least minBatchSize queries before it can be finalized.
     *
     * @param batchId - Batch ID to finalize
     * @returns Transaction instruction
     *
     * @example
     * ```typescript
     * const ix = client.createFinalizeBatchInstruction(42n);
     * const tx = new Transaction().add(ix);
     * await sendAndConfirmTransaction(connection, tx, [wallet]);
     * ```
     */
    createFinalizeBatchInstruction(batchId: bigint): TransactionInstruction {
        const [coordinatorState] = this.getCoordinatorStatePda();
        const [batch] = this.getBatchPda(batchId);

        // Instruction discriminator for finalize_batch
        const discriminator = Buffer.from([255, 211, 130, 81, 161, 239, 27, 11]);

        const batchIdBuffer = Buffer.alloc(8);
        batchIdBuffer.writeBigUInt64LE(batchId);

        const data = Buffer.concat([discriminator, batchIdBuffer]);

        return new TransactionInstruction({
            keys: [
                { pubkey: coordinatorState, isSigner: false, isWritable: false },
                { pubkey: batch, isSigner: false, isWritable: true },
            ],
            programId: this.programId,
            data,
        });
    }

    /**
     * Create instruction to mark a batch as complete
     *
     * Called by the proxy after executing the batch to record the results hash.
     *
     * @param batchId - Batch ID to complete
     * @param resultsHash - SHA-256 hash of the results (32 bytes)
     * @param executor - Public key of the executor (must be coordinator authority)
     * @returns Transaction instruction
     *
     * @example
     * ```typescript
     * const resultsHash = Buffer.from(response.batchHash, 'hex');
     * const ix = client.createCompleteBatchInstruction(
     *     42n,
     *     resultsHash,
     *     authority.publicKey
     * );
     * ```
     */
    createCompleteBatchInstruction(
        batchId: bigint,
        resultsHash: Uint8Array,
        executor: PublicKey
    ): TransactionInstruction {
        const [coordinatorState] = this.getCoordinatorStatePda();
        const [batch] = this.getBatchPda(batchId);

        // Instruction discriminator for complete_batch
        const discriminator = Buffer.from([87, 141, 249, 230, 112, 147, 8, 139]);

        const batchIdBuffer = Buffer.alloc(8);
        batchIdBuffer.writeBigUInt64LE(batchId);

        const data = Buffer.concat([discriminator, batchIdBuffer, Buffer.from(resultsHash)]);

        return new TransactionInstruction({
            keys: [
                { pubkey: coordinatorState, isSigner: false, isWritable: false },
                { pubkey: batch, isSigner: false, isWritable: true },
                { pubkey: executor, isSigner: true, isWritable: false },
            ],
            programId: this.programId,
            data,
        });
    }
}
