# @privacy-rpc/demo

Interactive demo CLI for the Solana Privacy RPC Layer.

## Installation

```bash
npm install
```

## Quick Start

```bash
# Learn how it works
npm run demo:explain

# Run with local proxy
npm run demo:local

# Run with devnet (full on-chain)
npm run demo:devnet
```

## Commands

### explain

Learn how the privacy layer works with a visual explanation.

```bash
npm run demo:explain
# or
npx ts-node src/index.ts explain
```

Shows:
- The privacy problem with traditional RPC
- How k-anonymity batching works
- The data flow through the system
- Privacy guarantees

### local

Demo with local proxy (no on-chain coordination).

```bash
npm run demo:local
# or
npx ts-node src/index.ts local --proxy http://localhost:3000 --queries 5
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `-p, --proxy <url>` | http://localhost:3000 | Proxy URL |
| `-q, --queries <n>` | 5 | Number of queries to batch |

**Prerequisites:**
- Privacy proxy running (`cargo run` in packages/proxy)
- Solana RPC available (local validator or remote)

### devnet

Full on-chain demo with devnet coordinator.

```bash
npm run demo:devnet
# or
SOLANA_RPC_URL=https://your-rpc.com npx ts-node src/index.ts devnet
```

**Options:**
| Option | Default | Description |
|--------|---------|-------------|
| `-p, --proxy <url>` | http://localhost:3000 | Proxy URL |

**Environment Variables:**
| Variable | Default | Description |
|----------|---------|-------------|
| `SOLANA_RPC_URL` | devnet public | Solana RPC for on-chain ops |
| `SOLANA_KEYFILE` | ~/.config/solana/id.json | Wallet keyfile path |
| `SOLANA_PRIVATE_KEY` | - | Private key as JSON array |

**Prerequisites:**
- Privacy proxy running with `ENABLE_POLLER=true`
- Coordinator deployed and initialized on devnet
- Funded wallet (for transaction fees)

## Demo Flow

### Local Demo

```
┌─────────────────────────────────────────────────────────────┐
│                      LOCAL DEMO FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   1. Create PrivateConnection with batch settings            │
│                                                              │
│   2. Submit N queries (balance checks for demo wallets)      │
│      └─→ Queries batched in SDK                             │
│                                                              │
│   3. Wait for batch to fill or timeout                       │
│      └─→ SDK sends batch to proxy                           │
│                                                              │
│   4. Proxy executes batch against RPC                        │
│      └─→ All queries executed together                      │
│                                                              │
│   5. Results returned to each query                          │
│      └─→ Display balances                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Devnet Demo

```
┌─────────────────────────────────────────────────────────────┐
│                     DEVNET DEMO FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   1. Check coordinator state on-chain (K parameter)          │
│                                                              │
│   2. Submit K query hashes on-chain                          │
│      └─→ Each query = on-chain transaction                  │
│      └─→ Simulates K different users                        │
│                                                              │
│   3. Batch auto-finalizes when K queries reached             │
│      └─→ On-chain batch status = FINALIZED                  │
│                                                              │
│   4. Proxy verifies finalization, executes batch             │
│      └─→ Verifies on-chain before execution                 │
│                                                              │
│   5. Results returned, batch marked complete on-chain        │
│      └─→ Results hash stored for audit                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Sample Output

### Explain Mode

```
╔═══════════════════════════════════════════════════════════════╗
║   Solana Privacy RPC Layer                                    ║
║   K-Anonymity for Blockchain Queries                          ║
╚═══════════════════════════════════════════════════════════════╝

The Problem:
  When you query a Solana RPC node (e.g., check your balance),
  the node operator can see YOUR IP querying YOUR wallet.

The Solution: K-Anonymity Batching
  We batch queries from K different users together.
  The RPC node sees the batch, not individual queries.
```

### Devnet Mode

```
╔═══════════════════════════════════════════════════════════════╗
║                    DEVNET DEMO MODE                           ║
║         Full On-Chain Coordination with Solana Devnet         ║
╚═══════════════════════════════════════════════════════════════╝

[1/6] Setting up connection and wallet
     Devnet RPC: https://api.devnet.solana.com
     Wallet: 7xKXtg2C...
     Balance: 1.5000 SOL

[2/6] Checking on-chain coordinator
     ✓ Coordinator found!
       Min batch size: 3
       Max batch size: 10
       Total batches: 42

[3/6] Initializing OnChainBatchManager
     ✓ Manager initialized

[4/6] Submitting 3 queries (simulating k users)
     Submitting query 1/3: Solana Foundation...
     Submitting query 2/3: Phantom Treasury...
     Submitting query 3/3: Jupiter Exchange...

[5/6] Waiting for batch finalization and execution
     Batch will auto-finalize when k queries are reached.

[6/6] Results received
     ✓ User 1 (Solana Foundation): 1234.5678 SOL
     ✓ User 2 (Phantom Treasury): 567.8901 SOL
     ✓ User 3 (Jupiter Exchange): 89.0123 SOL

════════════════════════════════════════════════════════════════

✓ Devnet Demo Complete!
```

## Troubleshooting

### "Airdrop failed (rate limited)"

Use a pre-funded wallet:
```bash
# Option 1: Use Solana CLI wallet
solana airdrop 1 --url devnet

# Option 2: Set private key
export SOLANA_PRIVATE_KEY='[1,2,3,...]'
```

### "Coordinator not initialized"

Deploy and initialize the coordinator:
```bash
cd packages/coordinator
anchor deploy --provider.cluster devnet
npx ts-node scripts/init-devnet.ts
```

### "Failed to connect to devnet"

Use a reliable RPC (QuickNode recommended):
```bash
export SOLANA_RPC_URL=https://your-quicknode-url.com
npm run demo:devnet
```

### "Batch not finalized"

Ensure proxy has `ENABLE_POLLER=true`:
```bash
QUICKNODE_RPC_URL=... ENABLE_POLLER=true cargo run
```

## Development

```bash
# Build
npm run build

# Run directly
npx ts-node src/index.ts <command>

# Debug with verbose output
DEBUG=* npm run demo:devnet
```

## License

MIT
