import chalk from "chalk";
import ora from "ora";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { OnChainBatchManager, RpcMethod, CoordinatorClient } from "@privacy-rpc/sdk";
import * as fs from "fs";
import * as path from "path";

// Use custom RPC if provided, fallback to public devnet
const DEVNET_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(chalk.dim(`     Retry ${i + 1}/${retries} after network error...`));
            await new Promise((r) => setTimeout(r, delay));
        }
    }
    throw new Error("Retry failed");
}

function loadWallet(): Keypair {
    // Try loading from default Solana CLI keyfile first
    const keyfilePath =
        process.env.SOLANA_KEYFILE || path.join(process.env.HOME || "", ".config/solana/id.json");
    if (fs.existsSync(keyfilePath)) {
        const keyData = JSON.parse(fs.readFileSync(keyfilePath, "utf-8"));
        return Keypair.fromSecretKey(Uint8Array.from(keyData));
    }

    // Try environment variable (JSON array format)
    const envKey = process.env.SOLANA_PRIVATE_KEY;
    if (envKey) {
        try {
            const parsed = JSON.parse(envKey);
            if (Array.isArray(parsed)) {
                return Keypair.fromSecretKey(Uint8Array.from(parsed));
            }
        } catch {
            // If not JSON, assume it's already a Uint8Array-compatible format
            console.log(chalk.yellow("Warning: Could not parse SOLANA_PRIVATE_KEY"));
        }
    }

    // Generate new keypair as fallback
    return Keypair.generate();
}

// Demo wallets to query - cycle through these
const DEMO_WALLETS = [
    { name: "Solana Foundation", pubkey: "GK2zqSsXLA2rwVZk347RYhh6jJpRsCA69FjLW93ZGi3B" },
    { name: "Phantom Treasury", pubkey: "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG" },
    { name: "Marinade Finance", pubkey: "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S" },
    { name: "Jupiter Exchange", pubkey: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB" },
    { name: "Raydium", pubkey: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1" },
    { name: "Magic Eden", pubkey: "GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgp" },
    { name: "Tensor", pubkey: "TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN" },
    { name: "Drift Protocol", pubkey: "dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH" },
];

// Pick a random wallet to avoid duplicate query errors
function getRandomWallet() {
    const index = Math.floor(Math.random() * DEMO_WALLETS.length);
    return DEMO_WALLETS[index];
}

function printStep(step: number, total: number, message: string) {
    console.log(chalk.cyan(`\n[${step}/${total}] `) + chalk.white(message));
}

export async function runDevnetDemo(proxyUrl: string) {
    console.log(
        chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                    ${chalk.bold("DEVNET DEMO MODE")}          ║
║         Full On-Chain Coordination with Solana Devnet         ║
╚═══════════════════════════════════════════════════════════════╝
`)
    );

    console.log(chalk.yellow("⚠ Note: This mode requires:"));
    console.log(chalk.dim("  1. Coordinator program deployed to devnet"));
    console.log(chalk.dim("  2. Funded wallet for transaction fees"));
    console.log(chalk.dim("  3. Proxy running with ENABLE_POLLER=true\n"));

    const totalSteps = 6;

    // Step 1: Setup
    printStep(1, totalSteps, "Setting up connection and wallet");

    const connection = new Connection(DEVNET_URL, "confirmed");
    const wallet = loadWallet();
    const isPreloaded =
        process.env.SOLANA_PRIVATE_KEY ||
        require("fs").existsSync(
            process.env.SOLANA_KEYFILE ||
                require("path").join(process.env.HOME || "", ".config/solana/id.json")
        );

    console.log(chalk.dim(`     Devnet RPC: ${DEVNET_URL}`));
    console.log(chalk.dim(`     Wallet: ${wallet.publicKey.toBase58().slice(0, 16)}...`));
    console.log(
        chalk.dim(`     Source: ${isPreloaded ? "pre-funded wallet" : "generated (needs airdrop)"}`)
    );

    // Check balance with retry
    let balance: number;
    try {
        balance = await retry(() => connection.getBalance(wallet.publicKey));
        console.log(chalk.dim(`     Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`));
    } catch (error) {
        console.log(chalk.red("     Failed to connect to devnet after retries."));
        console.log(chalk.yellow("     Devnet may be experiencing issues. Try again later.\n"));
        printDevnetFlow();
        return;
    }

    if (balance < 0.01 * LAMPORTS_PER_SOL) {
        // Request airdrop if balance is low
        const spinner = ora("Requesting devnet airdrop...").start();

        try {
            const sig = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
            await connection.confirmTransaction(sig);
            spinner.succeed("Received 1 SOL from devnet faucet");
        } catch (error) {
            spinner.fail("Airdrop failed (rate limited or devnet down)");
            console.log(chalk.yellow("\n     Options:"));
            console.log(chalk.dim("       1. Set SOLANA_PRIVATE_KEY env var with a funded wallet"));
            console.log(
                chalk.dim("       2. Use default Solana CLI wallet (~/.config/solana/id.json)")
            );
            console.log(chalk.dim("       3. Fund this wallet: " + wallet.publicKey.toBase58()));
            console.log(
                chalk.dim(
                    "          solana airdrop 1 " + wallet.publicKey.toBase58() + " --url devnet\n"
                )
            );

            // Continue with explanation
            console.log(
                chalk.cyan("\n────────────────────────────────────────────────────────────")
            );
            console.log(chalk.white("\nHere's what would happen with a funded wallet:\n"));
            printDevnetFlow();
            return;
        }
    } else {
        console.log(chalk.green("     ✓ Wallet has sufficient balance"));
    }

    // Step 2: Check coordinator
    printStep(2, totalSteps, "Checking on-chain coordinator");

    const coordinator = new CoordinatorClient(connection);
    let state;
    try {
        state = await retry(() => coordinator.getCoordinatorState());
    } catch (error) {
        console.log(chalk.red("     Failed to fetch coordinator state."));
        printDevnetFlow();
        return;
    }

    if (!state) {
        console.log(chalk.yellow("     Coordinator not initialized on devnet."));
        console.log(
            chalk.dim(
                "     Deploy with: cd packages/coordinator && anchor deploy --provider.cluster devnet\n"
            )
        );
        printDevnetFlow();
        return;
    }

    console.log(chalk.green("     ✓ Coordinator found!"));
    console.log(chalk.dim(`       Min batch size: ${state.minBatchSize}`));
    console.log(chalk.dim(`       Max batch size: ${state.maxBatchSize}`));
    console.log(chalk.dim(`       Total batches: ${state.batchCounter}`));

    // Step 3: Initialize OnChainBatchManager
    printStep(3, totalSteps, "Initializing OnChainBatchManager");

    const batchManager = new OnChainBatchManager({
        proxyEndpoint: proxyUrl,
        connection,
        wallet,
    });

    console.log(chalk.green("     ✓ Manager initialized"));

    // Step 4: Submit k queries (simulating multiple users)
    printStep(4, totalSteps, `Submitting ${state.minBatchSize} queries (simulating k users)`);

    console.log(chalk.dim(`     In production, each query comes from a different user.`));
    console.log(chalk.dim(`     For demo, we simulate ${state.minBatchSize} users.\n`));

    // Pick k unique random wallets
    const shuffled = [...DEMO_WALLETS].sort(() => Math.random() - 0.5);
    const selectedWallets = shuffled.slice(0, state.minBatchSize);

    const querySpinner = ora("Submitting query hashes to on-chain coordinator...").start();

    try {
        // Submit all k queries
        const promises: Promise<number>[] = [];

        for (let i = 0; i < selectedWallets.length; i++) {
            const wallet_target = selectedWallets[i];
            querySpinner.text = `Submitting query ${i + 1}/${state.minBatchSize}: ${wallet_target.name}...`;

            const promise = batchManager.addQuery<number>(
                RpcMethod.GetBalance,
                wallet_target.pubkey
            );
            promises.push(promise);

            // Small delay between submissions
            await new Promise((r) => setTimeout(r, 500));
        }

        querySpinner.text = `All ${state.minBatchSize} queries submitted. Waiting for batch finalization...`;

        // Step 5: Wait for results
        printStep(5, totalSteps, "Waiting for batch finalization and execution");

        console.log(chalk.dim("     Batch will auto-finalize when k queries are reached."));
        console.log(chalk.dim("     Then proxy executes all queries together.\n"));

        const results = await Promise.all(promises);
        querySpinner.succeed("Batch executed successfully!");

        // Step 6: Show results
        printStep(6, totalSteps, "Results received");

        console.log(chalk.dim("\n     Each user receives ONLY their own result:\n"));

        for (let i = 0; i < selectedWallets.length; i++) {
            const result = results[i];
            // Handle different response formats (number, object with value, etc.)
            let lamports: number;
            if (typeof result === "number") {
                lamports = result;
            } else if (result && typeof result === "object" && "value" in result) {
                lamports = (result as { value: number }).value;
            } else if (result && typeof result === "object" && "lamports" in result) {
                lamports = (result as { lamports: number }).lamports;
            } else {
                lamports = 0;
            }
            const solBalance = lamports / LAMPORTS_PER_SOL;
            console.log(
                chalk.green(`     ✓ User ${i + 1} (${selectedWallets[i].name}): `) +
                    chalk.white(`${solBalance.toFixed(4)} SOL`)
            );
        }
        console.log("");
    } catch (error) {
        querySpinner.fail("Query failed");
        console.log(
            chalk.red(`     Error: ${error instanceof Error ? error.message : "Unknown"}\n`)
        );
    }

    // Summary
    console.log(chalk.cyan("════════════════════════════════════════════════════════════════\n"));
    console.log(chalk.bold.green("✓ Devnet Demo Complete!\n"));
}

function printDevnetFlow() {
    console.log(chalk.bold("On-Chain Privacy Flow:\n"));

    console.log(chalk.yellow("1. User A") + chalk.dim(" submits query hash to coordinator"));
    console.log(chalk.dim("   └─→ Transaction: SubmitQuery(batch_id, hash_A)\n"));

    console.log(chalk.yellow("2. User B") + chalk.dim(" submits query hash to coordinator"));
    console.log(chalk.dim("   └─→ Transaction: SubmitQuery(batch_id, hash_B)\n"));

    console.log(chalk.yellow("3. User C") + chalk.dim(" submits query hash to coordinator"));
    console.log(chalk.dim("   └─→ Transaction: SubmitQuery(batch_id, hash_C)\n"));

    console.log(chalk.green("4. Batch finalized") + chalk.dim(" (k=3 queries reached)"));
    console.log(chalk.dim("   └─→ Transaction: FinalizeBatch(batch_id)\n"));

    console.log(chalk.cyan("5. Proxy executes") + chalk.dim(" all queries in batch"));
    console.log(chalk.dim("   └─→ Verifies on-chain, executes via RPC, returns results\n"));

    console.log(chalk.magenta("6. Batch completed") + chalk.dim(" with results hash"));
    console.log(chalk.dim("   └─→ Transaction: CompleteBatch(batch_id, results_hash)\n"));

    console.log(chalk.bold.white("Privacy Guarantee:"));
    console.log(chalk.dim("  On-chain observers see: [hash_A, hash_B, hash_C]"));
    console.log(chalk.dim("  They CANNOT determine which user submitted which query.\n"));
}
