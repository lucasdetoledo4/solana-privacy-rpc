import chalk from "chalk";
import ora from "ora";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { OnChainBatchManager, RpcMethod, CoordinatorClient } from "@privacy-rpc/sdk";

const DEVNET_URL = "https://api.devnet.solana.com";

// Demo wallets to query
const DEMO_WALLETS = [
    { name: "Wallet A", pubkey: "GK2zqSsXLA2rwVZk347RYhh6jJpRsCA69FjLW93ZGi3B" },
    { name: "Wallet B", pubkey: "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG" },
];

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function printStep(step: number, total: number, message: string) {
    console.log(chalk.cyan(`\n[${step}/${total}] `) + chalk.white(message));
}

export async function runDevnetDemo(proxyUrl: string) {
    console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                    ${chalk.bold("DEVNET DEMO MODE")}                          ║
║         Full On-Chain Coordination with Solana Devnet          ║
╚═══════════════════════════════════════════════════════════════╝
`));

    console.log(chalk.yellow("⚠ Note: This mode requires:"));
    console.log(chalk.dim("  1. Coordinator program deployed to devnet"));
    console.log(chalk.dim("  2. Funded wallet for transaction fees"));
    console.log(chalk.dim("  3. Proxy running with ENABLE_POLLER=true\n"));

    const totalSteps = 6;

    // Step 1: Setup
    printStep(1, totalSteps, "Setting up connection and wallet");

    const connection = new Connection(DEVNET_URL, "confirmed");
    const wallet = Keypair.generate();

    console.log(chalk.dim(`     Devnet RPC: ${DEVNET_URL}`));
    console.log(chalk.dim(`     Demo wallet: ${wallet.publicKey.toBase58().slice(0, 16)}...`));

    // Request airdrop
    const spinner = ora("Requesting devnet airdrop...").start();

    try {
        const sig = await connection.requestAirdrop(wallet.publicKey, LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig);
        spinner.succeed("Received 1 SOL from devnet faucet");
    } catch (error) {
        spinner.fail("Airdrop failed (rate limited or devnet down)");
        console.log(chalk.yellow("\n     Try again later or use a pre-funded wallet.\n"));

        // Continue with explanation even if airdrop fails
        console.log(chalk.cyan("\n────────────────────────────────────────────────────────────"));
        console.log(chalk.white("\nHere's what would happen with a funded wallet:\n"));
        printDevnetFlow();
        return;
    }

    // Step 2: Check coordinator
    printStep(2, totalSteps, "Checking on-chain coordinator");

    const coordinator = new CoordinatorClient(connection);
    const state = await coordinator.getCoordinatorState();

    if (!state) {
        console.log(chalk.yellow("     Coordinator not initialized on devnet."));
        console.log(chalk.dim("     Deploy with: cd packages/coordinator && anchor deploy --provider.cluster devnet\n"));
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

    // Step 4: Submit query
    printStep(4, totalSteps, "Submitting query (hash goes on-chain)");

    const targetWallet = DEMO_WALLETS[0];
    console.log(chalk.dim(`     Querying balance of: ${targetWallet.name}`));
    console.log(chalk.dim(`     Pubkey: ${targetWallet.pubkey}`));

    const querySpinner = ora("Submitting query hash to on-chain coordinator...").start();

    try {
        const balancePromise = batchManager.addQuery<number>(
            RpcMethod.GetBalance,
            targetWallet.pubkey
        );

        querySpinner.text = "Query submitted, waiting for batch to fill...";

        // Step 5: Wait for result
        printStep(5, totalSteps, "Waiting for batch finalization");

        console.log(chalk.dim("     Batch needs k queries from different users."));
        console.log(chalk.dim("     In production, other users would submit queries."));
        console.log(chalk.dim("     For demo, we wait for timeout or manual finalization.\n"));

        const balance = await balancePromise;
        querySpinner.succeed("Query executed!");

        // Step 6: Show result
        printStep(6, totalSteps, "Result received");

        const solBalance = balance / LAMPORTS_PER_SOL;
        console.log(chalk.green(`\n     ✓ ${targetWallet.name} balance: ${solBalance.toFixed(4)} SOL\n`));

    } catch (error) {
        querySpinner.fail("Query failed");
        console.log(chalk.red(`     Error: ${error instanceof Error ? error.message : "Unknown"}\n`));
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
