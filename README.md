# Solana Privacy RPC Layer

**K-Anonymity for Blockchain Queries** | Built for QuickNode Hackathon 2026

Privacy-preserving RPC infrastructure that hides your Solana queries among K other users, making it impossible to link your identity to your on-chain activity.

---

## The Problem

Every time you query a Solana RPC node, you leak metadata:

```
You (IP: 192.168.1.100) ──► RPC Node ──► "Who owns wallet ABC123?"
                                    └──► Logs: IP 192.168.1.100 checked wallet ABC123
```

RPC providers can:
- Link your IP address to your wallet addresses
- Track your trading patterns and portfolio
- Sell your behavioral data
- Be compelled to share data with authorities

**Your financial privacy is at risk.**

---

## The Solution: K-Anonymity Batching

We batch queries from K different users together. The RPC node sees the batch, not individual queries.

```
User A (checking wallet A) ──┐
User B (checking wallet B) ──┼──► Privacy Proxy ──► RPC: "Check wallets A, B, C"
User C (checking wallet C) ──┘         │
                                       └──► Observer sees: [A, B, C] but can't
                                            determine which user asked for which
```

**Privacy Guarantee:** Your query is indistinguishable from K-1 others.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SOLANA PRIVACY RPC LAYER                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│   │   User A    │     │   User B    │     │   User C    │   ... K users    │
│   │  (SDK)      │     │  (SDK)      │     │  (SDK)      │                  │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                  │
│          │                   │                   │                          │
│          │ 1. Submit query hash on-chain         │                          │
│          ▼                   ▼                   ▼                          │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                  ON-CHAIN COORDINATOR (Anchor)                   │      │
│   │  ┌─────────────────────────────────────────────────────────┐    │      │
│   │  │  Batch #42: [hash_A, hash_B, hash_C]  Status: FINALIZED │    │      │
│   │  └─────────────────────────────────────────────────────────┘    │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                    │                                        │
│                                    │ 2. Batch finalized (K queries)         │
│                                    ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                     PRIVACY PROXY (Rust/Axum)                    │      │
│   │  • Verifies batch finalized on-chain                            │      │
│   │  • Executes all queries via QuickNode RPC                       │      │
│   │  • Returns results to respective users                          │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                    │                                        │
│                                    │ 3. Execute batch                       │
│                                    ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                    QUICKNODE RPC ENDPOINT                        │      │
│   │  Sees: "Execute queries for batch #42"                          │      │
│   │  Does NOT see: Which user submitted which query                 │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Components

| Package | Language | Description |
|---------|----------|-------------|
| [`@privacy-rpc/sdk`](./packages/sdk) | TypeScript | Client SDK - drop-in privacy layer for Solana apps |
| [`privacy-rpc-proxy`](./packages/proxy) | Rust/Axum | Batch execution proxy with on-chain verification |
| [`coordinator`](./packages/coordinator) | Rust/Anchor | On-chain batch coordination program |
| [`@privacy-rpc/demo`](./packages/demo) | TypeScript | Interactive demo CLI |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Rust 1.75+
- Solana CLI (for devnet testing)
- Anchor CLI (for coordinator deployment)

### 1. Install Dependencies

```bash
git clone https://github.com/YOUR_USERNAME/privacy-rpc-layer.git
cd privacy-rpc-layer

# Install SDK
cd packages/sdk && npm install && npm run build && cd ../..

# Install Demo
cd packages/demo && npm install && cd ../..
```

### 2. Run the Proxy

```bash
cd packages/proxy

# With local validator
solana-test-validator &
QUICKNODE_RPC_URL=http://localhost:8899 cargo run

# Or with QuickNode (recommended)
QUICKNODE_RPC_URL=https://your-quicknode-url.com cargo run
```

### 3. Run the Demo

```bash
cd packages/demo

# Local mode (no on-chain coordinator)
npm run demo:local

# Devnet mode (full on-chain privacy)
SOLANA_RPC_URL=https://your-devnet-rpc.com npm run demo:devnet
```

---

## SDK Usage

### Basic Usage (Client-Side Batching)

```typescript
import { PrivateConnection } from "@privacy-rpc/sdk";
import { PublicKey } from "@solana/web3.js";

// Create privacy-enabled connection
const connection = new PrivateConnection(
    "https://api.mainnet-beta.solana.com",
    {
        proxyEndpoint: "http://localhost:3000",
        batchSize: 10,      // Batch 10 queries together
        maxWaitTime: 5000,  // Wait max 5s for batch to fill
    }
);

// Use just like regular @solana/web3.js
const balance = await connection.getBalance(
    new PublicKey("So11111111111111111111111111111111111111112")
);
```

### On-Chain Coordination (Maximum Privacy)

```typescript
import { OnChainBatchManager, RpcMethod } from "@privacy-rpc/sdk";
import { Connection, Keypair } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com");
const wallet = Keypair.generate();

// Create on-chain coordinated manager
const manager = new OnChainBatchManager({
    proxyEndpoint: "http://localhost:3000",
    connection,
    wallet,
});

// Query is submitted on-chain, batched with other users
const balance = await manager.addQuery<number>(
    RpcMethod.GetBalance,
    "So11111111111111111111111111111111111111112"
);
```

---

## API Reference

### SDK Methods

| Method | Description | Privacy |
|--------|-------------|---------|
| `getBalance(pubkey)` | Get SOL balance | Batched |
| `getAccountInfo(pubkey)` | Get account data | Batched |
| `getBalanceDirect(pubkey)` | Direct RPC call | None |
| `flush()` | Force execute pending batch | - |

### Proxy Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /health` | Health check | Returns proxy status |
| `POST /execute-batch` | Execute query batch | Processes batched queries |

### Coordinator Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize` | Initialize coordinator with K parameter |
| `create_batch` | Create new batch for queries |
| `submit_query` | Submit query hash to batch |
| `finalize_batch` | Finalize batch when K reached |
| `complete_batch` | Mark batch as executed |

---

## Deployment

### Deploy Coordinator to Devnet

```bash
cd packages/coordinator

# Build
anchor build

# Deploy
anchor deploy --provider.cluster devnet

# Initialize (k=3)
npx ts-node scripts/init-devnet.ts
```

### Run Proxy with On-Chain Verification

```bash
cd packages/proxy

QUICKNODE_RPC_URL=https://your-rpc.com \
SOLANA_RPC_URL=https://api.devnet.solana.com \
COORDINATOR_PROGRAM_ID=3LsgXZDcRaC3vGq3392WGuEa4AST76m8NPNQCaqDd3n6 \
ENABLE_POLLER=true \
cargo run
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QUICKNODE_RPC_URL` | Yes | - | RPC endpoint for query execution |
| `PORT` | No | 3000 | Proxy server port |
| `SOLANA_RPC_URL` | No | - | RPC for on-chain verification |
| `COORDINATOR_PROGRAM_ID` | No | - | Deployed coordinator program |
| `ENABLE_POLLER` | No | false | Enable batch polling |

---

## How K-Anonymity Works

1. **Query Submission**: User submits query hash (not actual query) on-chain
2. **Batch Formation**: Coordinator collects K hashes from different users
3. **Batch Finalization**: When K queries collected, batch is finalized
4. **Execution**: Proxy verifies finalization, executes all queries
5. **Result Distribution**: Each user receives only their result

**Key Properties:**
- On-chain observers see only hashes, not actual queries
- RPC providers see batched queries, not individual users
- No single party can link user identity to query content

---

## Security Considerations

- Query hashes are SHA-256 of query content
- Proxy cannot selectively execute queries (must execute full batch)
- On-chain verification prevents unauthorized execution
- Results are distributed via encrypted channels (in production)

---

## Roadmap

- [x] TypeScript SDK with client-side batching
- [x] Rust proxy with batch execution
- [x] Anchor on-chain coordinator
- [x] Devnet deployment
- [x] Interactive demo CLI
- [ ] Extended RPC method support (8+ methods)
- [ ] Encrypted result channels
- [ ] Mainnet deployment

---

## Contributing

Contributions welcome! Please read the [claude.md](./claude.md) for coding guidelines.

---

## License

MIT

---

## Acknowledgments

Built for the QuickNode Hackathon 2026. Special thanks to the Solana and Anchor communities.
