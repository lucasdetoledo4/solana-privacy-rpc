import { Command } from "commander";
import chalk from "chalk";
import { runLocalDemo } from "./local-demo";
import { runDevnetDemo } from "./devnet-demo";

const program = new Command();

program.name("privacy-demo").description("Demo CLI for Solana Privacy RPC Layer").version("0.1.0");

program
    .command("local")
    .description("Run demo with local proxy (no on-chain)")
    .option("-p, --proxy <url>", "Proxy URL", "http://localhost:3000")
    .option("-q, --queries <number>", "Number of queries to batch", "5")
    .action(async (options) => {
        await runLocalDemo(options.proxy, parseInt(options.queries));
    });

program
    .command("devnet")
    .description("Run demo with devnet coordinator (full on-chain)")
    .option("-p, --proxy <url>", "Proxy URL", "http://localhost:3000")
    .action(async (options) => {
        await runDevnetDemo(options.proxy);
    });

program
    .command("explain")
    .description("Explain how the privacy layer works")
    .action(() => {
        printExplanation();
    });

// Default command - show interactive menu
program.action(() => {
    printBanner();
    console.log(chalk.yellow("\nUsage:"));
    console.log("  privacy-demo local    Run with local proxy");
    console.log("  privacy-demo devnet   Run with devnet (on-chain)");
    console.log("  privacy-demo explain  Learn how it works");
    console.log("");
});

function printBanner() {
    console.log(
        chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ${chalk.bold("Solana Privacy RPC Layer")}                   ║
║   ${chalk.dim("K-Anonymity for Blockchain Queries")}          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`)
    );
}

function printExplanation() {
    printBanner();

    console.log(chalk.bold.white("\n📖 How It Works\n"));

    console.log(chalk.cyan("The Problem:"));
    console.log(chalk.dim("  When you query a Solana RPC node (e.g., check your balance),"));
    console.log(chalk.dim("  the node operator can see YOUR IP querying YOUR wallet."));
    console.log(chalk.dim("  This links your identity to your on-chain activity.\n"));

    console.log(chalk.green("The Solution: K-Anonymity Batching"));
    console.log(chalk.dim("  We batch queries from K different users together."));
    console.log(chalk.dim("  The RPC node sees the batch, not individual queries.\n"));

    console.log(chalk.bold.white("📊 Data Flow:\n"));

    console.log(chalk.yellow("  1. User submits query"));
    console.log(chalk.dim("     └─→ SDK hashes query, submits hash on-chain\n"));

    console.log(chalk.yellow("  2. On-chain coordinator"));
    console.log(chalk.dim("     └─→ Collects K query hashes from different users"));
    console.log(chalk.dim("     └─→ Finalizes batch when K reached\n"));

    console.log(chalk.yellow("  3. Proxy execution"));
    console.log(chalk.dim("     └─→ Verifies batch finalized on-chain"));
    console.log(chalk.dim("     └─→ Executes all queries in batch"));
    console.log(chalk.dim("     └─→ Returns results to users\n"));

    console.log(chalk.bold.white("🔒 Privacy Guarantee:\n"));
    console.log(chalk.dim("  An observer sees: [hash1, hash2, hash3, ... hashK]"));
    console.log(chalk.dim("  They cannot determine which user submitted which query."));
    console.log(chalk.dim("  Your query is hidden among K-1 other queries.\n"));

    console.log(chalk.cyan("────────────────────────────────────────────────────────────\n"));
    console.log(
        chalk.dim("Run ") + chalk.white("privacy-demo local") + chalk.dim(" to see it in action!\n")
    );
}

program.parse();
