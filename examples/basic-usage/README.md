# Basic Usage Example

Interactive example demonstrating the Privacy RPC SDK with client-side batching.

## What This Example Shows

This example demonstrates:
- Creating a `PrivateConnection` for privacy-preserving queries
- Comparing direct vs private (batched) queries
- Querying multiple addresses with automatic batching
- Getting account information with privacy
- Understanding k-anonymity in practice

## Prerequisites

1. **Solana Test Validator** (or any Solana RPC)
   ```bash
   solana-test-validator
   ```

2. **Privacy Proxy** (running on port 3000)
   ```bash
   cd ../../packages/proxy
   QUICKNODE_RPC_URL=http://localhost:8899 cargo run
   ```

3. **Built SDK** (if running from source)
   ```bash
   cd ../../packages/sdk
   npm install && npm run build
   ```

## Installation

```bash
npm install
```

## Running the Example

```bash
npm start
```

## Expected Output

```
Privacy RPC SDK - Basic Usage Example
=====================================

Example 1: Direct Query (No Privacy)
------------------------------------
System Program balance: 500000000 SOL
Direct query time: 45ms

Example 2: Private Query (Batched)
----------------------------------
Batched query results:
  11111111...11111111: 500000000 SOL
  TokenkegQ...Ss623VQ5DA: 0.001 SOL
  SysvarC1o...11111111: 0 SOL
Private batch time: 52ms
Queries batched: 3

Example 3: Get Account Info (Private)
-------------------------------------
Token Program account:
  Owner: NativeLoader1111111111111111111111111111111
  Executable: true
  Lamports: 1000000

✓ All examples completed successfully!

📊 Privacy Analysis
-------------------
In a real deployment with multiple users:
- Each query would be mixed with queries from other users
- The RPC provider cannot tell which user made which query
- This provides k-anonymity where k = batch size
- Current batch size: 3
```

## Code Walkthrough

### 1. Import the SDK

```typescript
import { PrivateConnection } from "@privacy-rpc/sdk";
```

For local development, import from the built SDK:
```typescript
import { PrivateConnection } from "../../packages/sdk/src";
```

### 2. Create a Private Connection

```typescript
const privateConnection = new PrivateConnection(
    RPC_ENDPOINT,
    {
        proxyEndpoint: PROXY_ENDPOINT,
        batchSize: 3,        // Queries per batch
        maxWaitTime: 2000,   // Max wait time in ms
    },
    "confirmed"              // Commitment level
);
```

**Configuration:**
| Option | Value | Description |
|--------|-------|-------------|
| `proxyEndpoint` | `http://localhost:3000` | Privacy proxy URL |
| `batchSize` | `3` | Number of queries to batch together |
| `maxWaitTime` | `2000` | Maximum wait time for batch (ms) |

### 3. Submit Queries

```typescript
// Single query
const balance = await privateConnection.getBalance(new PublicKey(address));

// Multiple queries (batched automatically)
const balancePromises = addresses.map(addr =>
    privateConnection.getBalance(new PublicKey(addr))
);
const balances = await Promise.all(balancePromises);
```

Queries are automatically batched when:
- `batchSize` queries are pending, OR
- `maxWaitTime` milliseconds have passed

### 4. Force Execute Pending Batch

```typescript
// Flush any pending queries immediately
await privateConnection.flush();
```

### 5. Clean Up

```typescript
// Always destroy connection when done
privateConnection.destroy();
```

## Privacy Explanation

### Without Privacy (Direct RPC)

```
You (192.168.1.100) → RPC Node: "Balance of ABC123?"
                          └─→ Logs: IP 192.168.1.100 queried ABC123
```

RPC provider knows:
- Your IP address
- The wallet you queried
- **Can link your identity to your wallet**

### With Privacy (Batched)

```
User A (wallet A) ──┐
User B (wallet B) ──┼─→ Privacy Proxy ─→ RPC: "Balances of A, B, C?"
User C (wallet C) ──┘
```

RPC provider sees:
- Batch of 3 queries
- **Cannot determine which user queried which wallet**

This is **k-anonymity** where k = 3:
- Your query is indistinguishable from 2 others
- Even if RPC provider is malicious, they cannot link you to your wallet

## Customization

### Change Batch Size

```typescript
const privateConnection = new PrivateConnection(
    RPC_ENDPOINT,
    {
        proxyEndpoint: PROXY_ENDPOINT,
        batchSize: 10,  // Larger batch = more privacy, higher latency
    }
);
```

**Trade-offs:**
| Batch Size | Privacy | Latency | When to Use |
|------------|---------|---------|-------------|
| 3-5 | Low | Fast | Testing, low-traffic apps |
| 10-20 | Medium | Medium | Typical apps |
| 50+ | High | Slow | High-security apps |

### Use Different RPC Endpoint

```typescript
// Use QuickNode instead of localhost
const RPC_ENDPOINT = "https://your-quicknode-url.com";
const privateConnection = new PrivateConnection(
    RPC_ENDPOINT,
    { proxyEndpoint: PROXY_ENDPOINT }
);
```

### Query Different Methods

```typescript
// Get account info
const accountInfo = await privateConnection.getAccountInfo(
    new PublicKey(address)
);

// Get balance
const balance = await privateConnection.getBalance(
    new PublicKey(address)
);

// Direct query (bypass privacy)
const directBalance = await privateConnection.getBalanceDirect(
    new PublicKey(address)
);
```

## Troubleshooting

### "Connection refused" Error

**Problem:** Privacy proxy not running

**Solution:**
```bash
cd ../../packages/proxy
QUICKNODE_RPC_URL=http://localhost:8899 cargo run
```

### "Cannot find module '@privacy-rpc/sdk'"

**Problem:** SDK not built

**Solution:**
```bash
cd ../../packages/sdk
npm install && npm run build
```

### "Failed to get balance" Error

**Problem:** Solana validator not running

**Solution:**
```bash
solana-test-validator
```

### Queries Timing Out

**Problem:** Batch not filling, maxWaitTime too long

**Solution:** Reduce `maxWaitTime` or `batchSize`:
```typescript
const privateConnection = new PrivateConnection(
    RPC_ENDPOINT,
    {
        proxyEndpoint: PROXY_ENDPOINT,
        batchSize: 2,       // Smaller batch
        maxWaitTime: 1000,  // Shorter wait
    }
);
```

## Next Steps

- [SDK Documentation](../../packages/sdk/README.md) - Full API reference
- [On-Chain Demo](../../packages/demo/README.md) - Maximum privacy with on-chain coordination
- [Proxy Setup](../../packages/proxy/README.md) - Deploy your own privacy proxy

## License

MIT
