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

export interface BatchAccount {
    id: bigint;
    status: "pending" | "finalized" | "executed";
    queryCount: number;
    queryHashes: Uint8Array[];
    submitters: PublicKey[];
    createdAt: bigint;
    finalizedAt: bigint | null;
    resultsHash: Uint8Array | null;
}

export interface CoordinatorState {
    authority: PublicKey;
    minBatchSize: number;
    maxBatchSize: number;
    batchCounter: bigint;
}

export class CoordinatorClient {
    private connection: Connection;
    private programId: PublicKey;

    constructor(connection: Connection, programId?: string) {
        this.connection = connection;
        this.programId = new PublicKey(programId || PROGRAM_ID);
    }

    getCoordinatorStatePda(): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("coordinator")],
            this.programId
        );
    }

    getBatchPda(batchId: bigint): [PublicKey, number] {
        const buffer = Buffer.alloc(8);
        buffer.writeBigUInt64LE(batchId);
        return PublicKey.findProgramAddressSync(
            [Buffer.from("batch"), buffer],
            this.programId
        );
    }

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

    createBatchInstruction(
        batchId: bigint,
        payer: PublicKey
    ): TransactionInstruction {
        const [coordinatorState] = this.getCoordinatorStatePda();
        const [batch] = this.getBatchPda(batchId);

        // Instruction discriminator for create_batch (anchor sighash)
        const discriminator = Buffer.from([251, 20, 5, 66, 184, 108, 64, 220]);

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
