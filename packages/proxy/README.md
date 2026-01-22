# privacy-rpc-proxy

Rust/Axum proxy server for executing batched Solana RPC queries with privacy preservation.

## Features

- Batch query execution against any Solana RPC endpoint
- On-chain batch verification (optional)
- Query hash validation
- Results hash generation for audit trail
- CORS support for web clients

## Quick Start

```bash
# With local validator
solana-test-validator &
QUICKNODE_RPC_URL=http://localhost:8899 cargo run

# With QuickNode or any RPC provider
QUICKNODE_RPC_URL=https://your-endpoint.com cargo run
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QUICKNODE_RPC_URL` | Yes | - | Solana RPC endpoint for query execution |
| `PORT` | No | 3000 | Server port |
| `SOLANA_RPC_URL` | No | - | RPC for on-chain verification (if different) |
| `COORDINATOR_PROGRAM_ID` | No | - | On-chain coordinator program ID |
| `ENABLE_POLLER` | No | false | Enable automatic batch polling |
| `RUST_LOG` | No | info | Log level (trace, debug, info, warn, error) |

## API Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
    "status": "healthy",
    "version": "0.1.0",
    "rpc_configured": true
}
```

### Execute Batch

```
POST /execute-batch
Content-Type: application/json
```

**Request:**
```json
{
    "queries": [
        {
            "id": "uuid-1",
            "method": "getBalance",
            "pubkey": "So11111111111111111111111111111111111111112",
            "commitment": "confirmed"
        },
        {
            "id": "uuid-2",
            "method": "getAccountInfo",
            "pubkey": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
    ],
    "batchHash": "a1b2c3d4...",
    "batchId": "42"
}
```

**Response:**
```json
{
    "results": [
        {
            "id": "uuid-1",
            "success": true,
            "data": 1000000000
        },
        {
            "id": "uuid-2",
            "success": true,
            "data": {
                "lamports": 1000000,
                "owner": "11111111111111111111111111111111",
                "data": "base64...",
                "executable": false,
                "rentEpoch": 0
            }
        }
    ],
    "batchHash": "e5f6g7h8...",
    "executedAt": 1705849200
}
```

## Supported RPC Methods

| Method | Description |
|--------|-------------|
| `getBalance` | Get SOL balance for a public key |
| `getAccountInfo` | Get account data for a public key |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PRIVACY PROXY                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐  │
│  │   Axum       │     │   Handler    │     │  Executor   │  │
│  │   Server     │────►│  /execute    │────►│  (RPC)      │  │
│  │              │     │   -batch     │     │             │  │
│  └──────────────┘     └──────────────┘     └─────────────┘  │
│                              │                     │         │
│                              ▼                     ▼         │
│                       ┌──────────────┐     ┌─────────────┐  │
│                       │  Coordinator │     │  QuickNode  │  │
│                       │  Verifier    │     │  RPC        │  │
│                       │  (optional)  │     │             │  │
│                       └──────────────┘     └─────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## On-Chain Verification

When `COORDINATOR_PROGRAM_ID` is set, the proxy verifies batches on-chain before execution:

1. **Check batch exists** on-chain coordinator
2. **Verify batch is finalized** (has K queries)
3. **Execute queries** against RPC
4. **Record results hash** on-chain (optional)

```bash
QUICKNODE_RPC_URL=https://your-rpc.com \
SOLANA_RPC_URL=https://api.devnet.solana.com \
COORDINATOR_PROGRAM_ID=3LsgXZDcRaC3vGq3392WGuEa4AST76m8NPNQCaqDd3n6 \
cargo run
```

## Error Handling

The proxy returns structured errors:

```json
{
    "error": "BatchNotFinalized",
    "message": "Batch 42 is not yet finalized on-chain",
    "code": 400
}
```

| Error | Code | Description |
|-------|------|-------------|
| `InvalidBatchHash` | 400 | Request hash doesn't match computed |
| `BatchNotFound` | 404 | Batch ID not found on-chain |
| `BatchNotFinalized` | 400 | Batch not ready for execution |
| `RpcError` | 502 | Upstream RPC error |
| `InternalError` | 500 | Server error |

## Development

```bash
# Build
cargo build

# Build release
cargo build --release

# Run tests
cargo test

# Run with debug logging
RUST_LOG=debug cargo run

# Format code
cargo fmt

# Lint
cargo clippy
```

## Project Structure

```
src/
├── main.rs              # Entry point
├── server.rs            # Axum server setup
├── error.rs             # Error types
├── enums/               # RPC methods, status enums
│   ├── mod.rs
│   ├── rpc_method.rs
│   └── commitment.rs
├── types/               # Request/response types
│   ├── mod.rs
│   ├── query.rs
│   ├── batch_request.rs
│   └── batch_response.rs
├── handlers/            # HTTP handlers
│   ├── mod.rs
│   ├── health.rs
│   └── execute_batch.rs
├── executor/            # RPC executors
│   ├── mod.rs
│   ├── execute_query.rs
│   ├── get_balance.rs
│   └── get_account_info.rs
└── coordinator/         # On-chain verification
    ├── mod.rs
    └── verifier.rs
```

## Security Considerations

- **Hash Verification**: All batch hashes are verified before execution
- **On-Chain Verification**: Optional verification that batch is finalized
- **No Query Logging**: Proxy does not log individual queries
- **CORS**: Configurable CORS headers for web security

## License

MIT
