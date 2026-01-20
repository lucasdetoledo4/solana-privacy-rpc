# Solana Privacy RPC

Privacy-preserving RPC infrastructure for Solana with k-anonymity.

## The Problem

Every Solana RPC query exposes which accounts you're interested in. This metadata leakage can reveal trading strategies, wallet holdings, and user behavior to RPC providers.

## How It Works

Queries from multiple users are batched together before execution. Your query becomes indistinguishable from k-1 others in the same batch (k-anonymity).

```
User A ──┐
User B ──┼──► Privacy Proxy ──► Solana RPC
User C ──┘     (batches)
```

## Quick Start

### Prerequisites

- Rust 1.75+
- Node.js 18+
- Solana CLI (optional, for local testing)

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/solana-privacy-rpc.git
cd solana-privacy-rpc

# Install SDK
cd packages/sdk && npm install && cd ../..
```

### Run the Proxy

```bash
# Local validator
solana-test-validator &
QUICKNODE_RPC_URL=http://localhost:8899 cargo run -p privacy-rpc-proxy

# Or any RPC provider
QUICKNODE_RPC_URL=https://your-rpc-endpoint.com cargo run -p privacy-rpc-proxy
```

### Use the SDK

```typescript
import { PrivateConnection } from "@privacy-rpc/sdk";
import { PublicKey } from "@solana/web3.js";

const connection = new PrivateConnection(
  "https://api.mainnet-beta.solana.com",
  {
    proxyEndpoint: "http://localhost:3000",
    batchSize: 10,
    maxWaitTime: 5000,
  }
);

const balance = await connection.getBalance(new PublicKey("..."));
```

## Architecture

| Component | Language   | Purpose                      |
|-----------|------------|------------------------------|
| SDK       | TypeScript | Client library, query batching |
| Proxy     | Rust/Axum  | Batch execution against RPC  |

## API

### SDK Methods

```typescript
// Privacy-preserving (batched)
getBalance(pubkey): Promise<number>
getAccountInfo(pubkey): Promise<AccountInfo | null>

// Direct (no batching)
getBalanceDirect(pubkey): Promise<number>
getAccountInfoDirect(pubkey): Promise<AccountInfo | null>

// Control
flush(): Promise<void>  // Force batch execution
destroy(): void         // Cleanup
```

### Proxy Endpoints

| Endpoint         | Method | Description          |
|------------------|--------|----------------------|
| `/health`        | GET    | Health check         |
| `/execute-batch` | POST   | Execute query batch  |

## Development

```bash
# Build
cargo build -p privacy-rpc-proxy
cd packages/sdk && npm run build

# Test
cargo test
cd packages/sdk && npm test
```

## Environment Variables

| Variable            | Required | Default | Description         |
|---------------------|----------|---------|---------------------|
| `QUICKNODE_RPC_URL` | Yes      | -       | Solana RPC endpoint |
| `PORT`              | No       | 3000    | Proxy port          |

## Roadmap

- [x] TypeScript SDK + Rust Proxy
- [ ] On-chain coordinator (Anchor)
- [ ] Extended RPC method support

## License

MIT
