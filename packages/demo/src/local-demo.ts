import chalk from "chalk";
import ora from "ora";
import { BatchManager, RpcMethod, hashQuery, hashBatch } from "@privacy-rpc/sdk";

// Well-known Solana addresses for demo
const DEMO_WALLETS = [
    { name: "Solana Foundation", pubkey: "GK2zqSsXLA2rwVZk347RYhh6jJpRsCA69FjLW93ZGi3B" },
    { name: "Phantom Treasury", pubkey: "H6ARHf6YXhGYeQfUzQNGk6rDNnLBQKrenN712K4AQJEG" },
    { name: "FTX Bankruptcy", pubkey: "2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm" },
    { name: "Binance Hot", pubkey: "2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S" },
    { name: "Jump Trading", pubkey: "4wHd9tf4x4FkQ3JRiEJmv4CZwpkZEpihPvp7hmeXbGhR" },
];

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function printStep(step: number, total: number, message: string) {
    console.log(chalk.cyan(`\n[${step}/${total}] `) + chalk.white(message));
}

function printSubStep(message: string) {
    console.log(chalk.dim("     → ") + message);
}

export async function runLocalDemo(proxyUrl: string, queryCount: number) {
    console.log(
        chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                     ${chalk.bold("LOCAL DEMO MODE")}                           ║
║          Demonstrating K-Anonymity Batch Privacy               ║
╚═══════════════════════════════════════════════════════════════╝
`)
    );

    console.log(chalk.dim("Configuration:"));
    console.log(chalk.dim(`  Proxy URL: ${proxyUrl}`));
    console.log(chalk.dim(`  Batch size (k): ${queryCount}`));
    console.log(chalk.dim(`  Mode: Local (simulated multi-user)\n`));

    const totalSteps = 5;

    // Step 1: Initialize
    printStep(1, totalSteps, "Initializing Privacy SDK");
    await sleep(500);

    const batchManager = new BatchManager({
        proxyEndpoint: proxyUrl,
        batchSize: queryCount,
        maxWaitTime: 30000,
    });
    printSubStep(chalk.green("BatchManager initialized"));

    // Step 2: Simulate multiple users adding queries
    printStep(2, totalSteps, "Simulating multiple users submitting queries");
    console.log(chalk.dim("\n     Each user submits a query. The SDK hashes it for privacy.\n"));

    const queries: { name: string; pubkey: string; hash: string }[] = [];

    for (let i = 0; i < Math.min(queryCount, DEMO_WALLETS.length); i++) {
        const wallet = DEMO_WALLETS[i];
        await sleep(300);

        const query = {
            id: `query-${i}`,
            method: RpcMethod.GetBalance,
            pubkey: wallet.pubkey,
        };
        const hash = hashQuery(query);

        queries.push({ name: wallet.name, pubkey: wallet.pubkey, hash });

        console.log(chalk.yellow(`     User ${i + 1}: `) + chalk.white(wallet.name));
        console.log(
            chalk.dim(
                `            Wallet: ${wallet.pubkey.slice(0, 8)}...${wallet.pubkey.slice(-8)}`
            )
        );
        console.log(chalk.dim(`            Hash:   ${hash.slice(0, 16)}...`));
    }

    // Step 3: Show batch formation
    printStep(3, totalSteps, "Batch formed with k=" + queryCount + " queries");

    const batchHash = hashBatch(
        queries.map((q, i) => ({
            id: `query-${i}`,
            method: RpcMethod.GetBalance,
            pubkey: q.pubkey,
        }))
    );

    console.log(chalk.dim("\n     On-chain batch would contain:\n"));
    console.log(chalk.cyan("     ┌─────────────────────────────────────────────────────┐"));
    console.log(
        chalk.cyan("     │ ") +
            chalk.bold("Batch Hashes (what observers see)") +
            chalk.cyan("               │")
    );
    console.log(chalk.cyan("     ├─────────────────────────────────────────────────────┤"));

    for (const q of queries) {
        console.log(chalk.cyan("     │ ") + chalk.dim(q.hash.slice(0, 48)) + chalk.cyan("... │"));
    }

    console.log(chalk.cyan("     └─────────────────────────────────────────────────────┘"));
    console.log(chalk.dim(`\n     Batch hash: ${batchHash.slice(0, 32)}...`));
    console.log(chalk.green("\n     ✓ Observer cannot link hashes to users!"));

    // Step 4: Execute batch
    printStep(4, totalSteps, "Executing batch via Privacy Proxy");

    const spinner = ora({
        text: "Sending batch to proxy...",
        color: "cyan",
    }).start();

    try {
        // Create promises for all queries
        const promises = queries.map((q, i) =>
            batchManager
                .addQuery<number>(RpcMethod.GetBalance, q.pubkey)
                .then((balance) => ({ name: q.name, pubkey: q.pubkey, balance, error: null }))
                .catch((err) => ({
                    name: q.name,
                    pubkey: q.pubkey,
                    balance: 0,
                    error: err.message,
                }))
        );

        // Wait for batch to execute
        const results = await Promise.all(promises);

        spinner.succeed("Batch executed successfully!");

        // Step 5: Show results
        printStep(5, totalSteps, "Results received");

        console.log(chalk.dim("\n     Each user receives ONLY their own result:\n"));

        for (const result of results) {
            if (result.error) {
                console.log(chalk.red(`     ✗ ${result.name}: Error - ${result.error}`));
            } else {
                const solBalance = result.balance / 1e9;
                console.log(
                    chalk.green(`     ✓ ${result.name}: `) +
                        chalk.white(`${solBalance.toFixed(4)} SOL`)
                );
            }
        }
    } catch (error) {
        spinner.fail("Batch execution failed");
        console.log(
            chalk.red(`\n     Error: ${error instanceof Error ? error.message : "Unknown error"}`)
        );
        console.log(chalk.yellow("\n     Make sure the proxy is running:"));
        console.log(chalk.dim("     QUICKNODE_RPC_URL=<your-rpc-url> cargo run\n"));
        return;
    }

    // Summary
    console.log(chalk.cyan("\n════════════════════════════════════════════════════════════════\n"));
    console.log(chalk.bold.green("✓ Demo Complete!\n"));
    console.log(chalk.white("Privacy achieved through k-anonymity:"));
    console.log(chalk.dim(`  • ${queryCount} queries batched together`));
    console.log(chalk.dim("  • RPC node saw one batch, not individual queries"));
    console.log(chalk.dim("  • Each user's query hidden among k-1 others\n"));
}
