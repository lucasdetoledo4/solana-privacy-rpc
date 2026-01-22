# Coordinator Program

Solana on-chain coordinator for trustless k-anonymity batch management.

## Overview

The coordinator program manages query batches on-chain, ensuring that:
- Batches only execute when K queries are collected
- Query hashes are recorded for verification
- Results hashes provide an audit trail
- No single party can manipulate batch formation

## Program ID

```
Devnet: 3LsgXZDcRaC3vGq3392WGuEa4AST76m8NPNQCaqDd3n6
```

## Quick Start

### Prerequisites

- Rust 1.75+
- Solana CLI
- Anchor CLI 0.32+

### Build

```bash
anchor build
```

### Deploy

```bash
# Devnet
anchor deploy --provider.cluster devnet

# Mainnet (when ready)
anchor deploy --provider.cluster mainnet
```

### Initialize

```bash
npx ts-node scripts/init-devnet.ts
```

Or programmatically:

```typescript
await program.methods
    .initialize(3, 10)  // minBatchSize=3, maxBatchSize=10
    .accounts({
        coordinatorState,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
    })
    .rpc();
```

## Instructions

### initialize

Initialize the coordinator with k-anonymity parameters.

```rust
pub fn initialize(
    ctx: Context<Initialize>,
    min_batch_size: u8,  // K parameter
    max_batch_size: u8,
) -> Result<()>
```

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| coordinator_state | PDA | Coordinator state account |
| authority | Signer | Admin authority |
| system_program | Program | System program |

### create_batch

Create a new batch for collecting queries.

```rust
pub fn create_batch(ctx: Context<CreateBatch>) -> Result<()>
```

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| coordinator_state | PDA | Coordinator state (mut) |
| batch | PDA | New batch account |
| payer | Signer | Transaction fee payer |
| system_program | Program | System program |

### submit_query

Submit a query hash to a batch.

```rust
pub fn submit_query(
    ctx: Context<SubmitQuery>,
    batch_id: u64,
    query_hash: [u8; 32],
) -> Result<()>
```

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| coordinator_state | PDA | Coordinator state |
| batch | PDA | Target batch (mut) |
| submitter | Signer | Query submitter |

**Errors:**
- `BatchNotPending` - Batch already finalized
- `BatchFull` - Batch has max queries
- `DuplicateQuery` - Query hash already in batch

### finalize_batch

Finalize a batch when K queries are reached.

```rust
pub fn finalize_batch(
    ctx: Context<FinalizeBatch>,
    batch_id: u64,
) -> Result<()>
```

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| coordinator_state | PDA | Coordinator state |
| batch | PDA | Batch to finalize (mut) |

**Errors:**
- `InsufficientQueries` - Less than K queries

### complete_batch

Mark batch as executed with results hash.

```rust
pub fn complete_batch(
    ctx: Context<CompleteBatch>,
    batch_id: u64,
    results_hash: [u8; 32],
) -> Result<()>
```

**Accounts:**
| Account | Type | Description |
|---------|------|-------------|
| coordinator_state | PDA | Coordinator state |
| batch | PDA | Batch to complete (mut) |
| executor | Signer | Authority (must match coordinator authority) |

**Errors:**
- `BatchNotFinalized` - Batch not ready
- `Unauthorized` - Invalid executor

## State Accounts

### CoordinatorState

Global coordinator configuration.

```rust
pub struct CoordinatorState {
    pub authority: Pubkey,      // Admin authority
    pub min_batch_size: u8,     // K parameter (minimum queries)
    pub max_batch_size: u8,     // Maximum queries per batch
    pub batch_counter: u64,     // Next batch ID
    pub bump: u8,               // PDA bump
}
```

**PDA Seeds:** `["coordinator"]`

### Batch

Individual batch account.

```rust
pub struct Batch {
    pub id: u64,                        // Batch ID
    pub status: BatchStatus,            // Pending/Finalized/Executed
    pub query_count: u8,                // Current query count
    pub query_hashes: Vec<[u8; 32]>,    // Query hashes (SHA-256)
    pub submitters: Vec<Pubkey>,        // Query submitters
    pub created_at: i64,                // Creation timestamp
    pub finalized_at: Option<i64>,      // Finalization timestamp
    pub results_hash: Option<[u8; 32]>, // Results hash after execution
    pub bump: u8,                       // PDA bump
}
```

**PDA Seeds:** `["batch", batch_id.to_le_bytes()]`

## Batch Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                        BATCH LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐     submit_query     ┌──────────┐                │
│   │ PENDING  │◄────────────────────►│ PENDING  │                │
│   │ (0 q's)  │     (repeat K times) │ (K q's)  │                │
│   └──────────┘                      └────┬─────┘                │
│                                          │                       │
│                                          │ finalize_batch        │
│                                          ▼                       │
│                                    ┌──────────┐                  │
│                                    │FINALIZED │                  │
│                                    │ (ready)  │                  │
│                                    └────┬─────┘                  │
│                                         │                        │
│                                         │ complete_batch         │
│                                         ▼                        │
│                                    ┌──────────┐                  │
│                                    │ EXECUTED │                  │
│                                    │ (done)   │                  │
│                                    └──────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | InvalidBatchSize | min > max or min == 0 |
| 6001 | BatchNotPending | Batch not in pending state |
| 6002 | BatchFull | Batch has max queries |
| 6003 | DuplicateQuery | Query hash already submitted |
| 6004 | InsufficientQueries | Less than K queries |
| 6005 | BatchNotFinalized | Batch not finalized |
| 6006 | Unauthorized | Invalid authority |

## Testing

```bash
# Run all tests
anchor test

# Run specific test
anchor test -- --test batch_lifecycle

# With logs
RUST_LOG=debug anchor test
```

## Development

### Project Structure

```
programs/coordinator/
├── Cargo.toml
└── src/
    ├── lib.rs           # Program entry, instructions
    ├── errors/
    │   └── mod.rs       # Custom errors
    └── state/
        ├── mod.rs       # State exports
        ├── coordinator_state.rs
        └── batch.rs
```

### Adding New Instructions

1. Define instruction context in `lib.rs`
2. Implement instruction logic
3. Add error codes if needed
4. Write tests
5. Update IDL

### Security Considerations

- Only authority can complete batches
- Query hashes prevent content tampering
- PDA derivation prevents account spoofing
- Duplicate queries rejected

## Client Integration

Using the SDK:

```typescript
import { CoordinatorClient } from "@privacy-rpc/sdk";
import { Connection } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com");
const client = new CoordinatorClient(connection);

// Get coordinator state
const state = await client.getCoordinatorState();
console.log(`K = ${state.minBatchSize}`);

// Get batch details
const batch = await client.getBatch(42n);
console.log(`Status: ${batch.status}`);
console.log(`Queries: ${batch.queryCount}`);
```

## License

MIT
