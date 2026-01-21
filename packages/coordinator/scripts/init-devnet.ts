import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const PROGRAM_ID = new PublicKey("3LsgXZDcRaC3vGq3392WGuEa4AST76m8NPNQCaqDd3n6");
const DEVNET_URL = "https://api.devnet.solana.com";

async function main() {
    // Load wallet
    const keyfilePath = path.join(process.env.HOME || "", ".config/solana/id.json");
    const keyData = JSON.parse(fs.readFileSync(keyfilePath, "utf-8"));
    const wallet = Keypair.fromSecretKey(Uint8Array.from(keyData));

    console.log("Initializing coordinator on devnet...");
    console.log("Wallet:", wallet.publicKey.toBase58());
    console.log("Program ID:", PROGRAM_ID.toBase58());

    // Setup connection and provider
    const connection = new Connection(DEVNET_URL, "confirmed");
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(wallet),
        { commitment: "confirmed" }
    );

    // Load IDL
    const idlPath = path.join(__dirname, "../target/idl/coordinator.json");
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

    const program = new Program(idl, provider);

    // Derive PDA
    const [coordinatorState] = PublicKey.findProgramAddressSync(
        [Buffer.from("coordinator")],
        PROGRAM_ID
    );

    console.log("Coordinator State PDA:", coordinatorState.toBase58());

    // Check if already initialized
    const account = await connection.getAccountInfo(coordinatorState);
    if (account) {
        console.log("Coordinator already initialized!");
        return;
    }

    // Initialize with k=3 (min batch size)
    const minBatchSize = 3;
    const maxBatchSize = 10;

    console.log(`Initializing with minBatchSize=${minBatchSize}, maxBatchSize=${maxBatchSize}`);

    const tx = await program.methods
        .initialize(minBatchSize, maxBatchSize)
        .accounts({
            coordinatorState,
            authority: wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([wallet])
        .rpc();

    console.log("Transaction:", tx);
    console.log("Coordinator initialized successfully!");
}

main().catch(console.error);
