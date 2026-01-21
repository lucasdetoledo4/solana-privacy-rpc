/**
 * Basic Usage Example - Privacy RPC SDK
 *
 * This example demonstrates how to use the PrivateConnection
 * for privacy-preserving Solana RPC queries.
 *
 * Prerequisites:
 * 1. Start solana-test-validator
 * 2. Start the privacy proxy: QUICKNODE_RPC_URL=http://localhost:8899 cargo run
 * 3. Run this example: npm start
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// For local development, import from built SDK
// In production, this would be: import { PrivateConnection } from '@privacy-rpc/sdk';
import { PrivateConnection } from "../../packages/sdk/src";

const RPC_ENDPOINT = "http://localhost:8899";
const PROXY_ENDPOINT = "http://localhost:3000";

// Some well-known Solana addresses for testing
const TEST_ADDRESSES = [
    "11111111111111111111111111111111", // System Program
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // Token Program
    "SysvarC1ock11111111111111111111111111111111", // Clock Sysvar
];

async function main() {
    console.log("Privacy RPC SDK - Basic Usage Example");
    console.log("=====================================\n");

    // Create a standard connection for comparison
    const directConnection = new Connection(RPC_ENDPOINT, "confirmed");

    // Create a private connection with batching
    const privateConnection = new PrivateConnection(
        RPC_ENDPOINT,
        {
            proxyEndpoint: PROXY_ENDPOINT,
            batchSize: 3, // Small batch for demo (default is 10)
            maxWaitTime: 2000, // 2 seconds max wait
        },
        "confirmed"
    );

    try {
        // Example 1: Direct query (no privacy)
        console.log("Example 1: Direct Query (No Privacy)");
        console.log("------------------------------------");

        const directStart = Date.now();
        const directBalance = await directConnection.getBalance(new PublicKey(TEST_ADDRESSES[0]));
        const directTime = Date.now() - directStart;

        console.log(`System Program balance: ${directBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`Direct query time: ${directTime}ms\n`);

        // Example 2: Private query (batched)
        console.log("Example 2: Private Query (Batched)");
        console.log("----------------------------------");

        const privateStart = Date.now();

        // Submit multiple queries - they will be batched together
        const balancePromises = TEST_ADDRESSES.map((addr) =>
            privateConnection.getBalance(new PublicKey(addr))
        );

        // Wait for all results
        const balances = await Promise.all(balancePromises);
        const privateTime = Date.now() - privateStart;

        console.log("Batched query results:");
        TEST_ADDRESSES.forEach((addr, i) => {
            const shortAddr = `${addr.slice(0, 8)}...${addr.slice(-8)}`;
            console.log(`  ${shortAddr}: ${balances[i] / LAMPORTS_PER_SOL} SOL`);
        });
        console.log(`Private batch time: ${privateTime}ms`);
        console.log(`Queries batched: ${TEST_ADDRESSES.length}\n`);

        // Example 3: Get account info
        console.log("Example 3: Get Account Info (Private)");
        console.log("-------------------------------------");

        const accountInfo = await privateConnection.getAccountInfo(
            new PublicKey(TEST_ADDRESSES[1])
        );

        if (accountInfo) {
            console.log("Token Program account:");
            console.log(`  Owner: ${accountInfo.owner.toBase58()}`);
            console.log(`  Executable: ${accountInfo.executable}`);
            console.log(`  Lamports: ${accountInfo.lamports}`);
        } else {
            console.log("Account not found");
        }

        console.log("\n✓ All examples completed successfully!");

        // Privacy explanation
        console.log("\n📊 Privacy Analysis");
        console.log("-------------------");
        console.log("In a real deployment with multiple users:");
        console.log("- Each query would be mixed with queries from other users");
        console.log("- The RPC provider cannot tell which user made which query");
        console.log("- This provides k-anonymity where k = batch size");
        console.log(`- Current batch size: ${privateConnection.getPrivacyConfig().batchSize}`);
    } catch (error) {
        console.error("Error:", error);
        console.log("\nTroubleshooting:");
        console.log("1. Is solana-test-validator running?");
        console.log("2. Is the privacy proxy running on port 3000?");
        console.log("   Start it with: QUICKNODE_RPC_URL=http://localhost:8899 cargo run");
    } finally {
        // Clean up
        privateConnection.destroy();
    }
}

main().catch(console.error);
