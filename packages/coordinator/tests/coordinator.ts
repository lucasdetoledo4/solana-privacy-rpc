import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Coordinator } from "../target/types/coordinator";
import { expect } from "chai";
import { createHash } from "crypto";

describe("coordinator", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.coordinator as Program<Coordinator>;

    const [coordinatorStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("coordinator")],
        program.programId
    );

    const getBatchPda = (batchId: number) => {
        return anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from("batch"), new anchor.BN(batchId).toArrayLike(Buffer, "le", 8)],
            program.programId
        )[0];
    };

    const hashQuery = (query: string): number[] => {
        const hash = createHash("sha256").update(query).digest();
        return Array.from(hash);
    };

    describe("initialize", () => {
        it("initializes coordinator with k-anonymity parameters", async () => {
            const minBatchSize = 3;
            const maxBatchSize = 10;

            await program.methods
                .initialize(minBatchSize, maxBatchSize)
                .accounts({
                    coordinatorState: coordinatorStatePda,
                    authority: provider.wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            const state = await program.account.coordinatorState.fetch(coordinatorStatePda);
            expect(state.minBatchSize).to.equal(minBatchSize);
            expect(state.maxBatchSize).to.equal(maxBatchSize);
            expect(state.batchCounter.toNumber()).to.equal(0);
            expect(state.authority.toString()).to.equal(provider.wallet.publicKey.toString());
        });
    });

    describe("create_batch", () => {
        it("creates a new batch", async () => {
            const batchPda = getBatchPda(0);

            await program.methods
                .createBatch()
                .accounts({
                    coordinatorState: coordinatorStatePda,
                    batch: batchPda,
                    payer: provider.wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .rpc();

            const batch = await program.account.batch.fetch(batchPda);
            expect(batch.id.toNumber()).to.equal(0);
            expect(batch.queryCount).to.equal(0);
            expect(Object.keys(batch.status)[0]).to.equal("pending");

            const state = await program.account.coordinatorState.fetch(coordinatorStatePda);
            expect(state.batchCounter.toNumber()).to.equal(1);
        });
    });

    describe("submit_query", () => {
        it("submits a query to the batch", async () => {
            const batchPda = getBatchPda(0);
            const queryHash = hashQuery("getBalance:pubkey123");

            await program.methods
                .submitQuery(new anchor.BN(0), queryHash)
                .accounts({
                    coordinatorState: coordinatorStatePda,
                    batch: batchPda,
                    submitter: provider.wallet.publicKey,
                })
                .rpc();

            const batch = await program.account.batch.fetch(batchPda);
            expect(batch.queryCount).to.equal(1);
            expect(batch.queryHashes.length).to.equal(1);
        });

        it("submits multiple queries", async () => {
            const batchPda = getBatchPda(0);

            for (let i = 2; i <= 3; i++) {
                const queryHash = hashQuery(`getBalance:pubkey${i}`);
                await program.methods
                    .submitQuery(new anchor.BN(0), queryHash)
                    .accounts({
                        coordinatorState: coordinatorStatePda,
                        batch: batchPda,
                        submitter: provider.wallet.publicKey,
                    })
                    .rpc();
            }

            const batch = await program.account.batch.fetch(batchPda);
            expect(batch.queryCount).to.equal(3);
        });
    });

    describe("finalize_batch", () => {
        it("finalizes batch when min queries reached", async () => {
            const batchPda = getBatchPda(0);

            await program.methods
                .finalizeBatch(new anchor.BN(0))
                .accounts({
                    coordinatorState: coordinatorStatePda,
                    batch: batchPda,
                })
                .rpc();

            const batch = await program.account.batch.fetch(batchPda);
            expect(Object.keys(batch.status)[0]).to.equal("finalized");
            expect(batch.finalizedAt).to.not.be.null;
        });
    });

    describe("complete_batch", () => {
        it("completes batch with results hash", async () => {
            const batchPda = getBatchPda(0);
            const resultsHash = hashQuery("results:batch0");

            await program.methods
                .completeBatch(new anchor.BN(0), resultsHash)
                .accounts({
                    coordinatorState: coordinatorStatePda,
                    batch: batchPda,
                    executor: provider.wallet.publicKey,
                })
                .rpc();

            const batch = await program.account.batch.fetch(batchPda);
            expect(Object.keys(batch.status)[0]).to.equal("executed");
            expect(batch.resultsHash).to.not.be.null;
        });
    });
});
