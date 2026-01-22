# @privacy-rpc/sdk

Privacy-preserving SDK for Solana RPC with k-anonymity batching.

## Installation

```bash
npm install @privacy-rpc/sdk @solana/web3.js
```

## Quick Start

### Client-Side Batching

The simplest way to add privacy to your Solana app:

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

// Works just like @solana/web3.js Connection
const balance = await connection.getBalance(new PublicKey("..."));
const accountInfo = await connection.getAccountInfo(new PublicKey("..."));

// Force execute pending queries
await connection.flush();

// Cleanup
connection.destroy();
```

### On-Chain Coordination (Maximum Privacy)

For trustless batching with on-chain verification:

```typescript
import { OnChainBatchManager, RpcMethod } from "@privacy-rpc/sdk";
import { Connection, Keypair } from "@solana/web3.js";

const connection = new Connection("https://api.devnet.solana.com");
const wallet = Keypair.generate(); // Or load your wallet

const manager = new OnChainBatchManager({
    proxyEndpoint: "http://localhost:3000",
    connection,
    wallet,
});

// Queries are submitted on-chain and batched with other users
const balance = await manager.addQuery<number>(
    RpcMethod.GetBalance,
    "So11111111111111111111111111111111111111112"
);
```

## API Reference

### PrivateConnection

Drop-in replacement for `@solana/web3.js` Connection with privacy batching.

```typescript
new PrivateConnection(rpcEndpoint: string, config: PrivacyConfig)
```

#### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `proxyEndpoint` | string | required | Privacy proxy URL |
| `batchSize` | number | 10 | Queries per batch |
| `maxWaitTime` | number | 5000 | Max wait for batch (ms) |
| `timeout` | number | 30000 | Request timeout (ms) |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getBalance(pubkey, commitment?)` | `Promise<number>` | Get SOL balance (batched) |
| `getAccountInfo(pubkey, commitment?)` | `Promise<AccountInfo \| null>` | Get account info (batched) |
| `getBalanceDirect(pubkey, commitment?)` | `Promise<number>` | Direct RPC call (no privacy) |
| `getAccountInfoDirect(pubkey, commitment?)` | `Promise<AccountInfo \| null>` | Direct RPC call (no privacy) |
| `flush()` | `Promise<void>` | Force execute pending batch |
| `destroy()` | `void` | Cleanup resources |

### OnChainBatchManager

Full on-chain coordination for maximum privacy.

```typescript
new OnChainBatchManager(config: OnChainConfig)
```

#### Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `proxyEndpoint` | string | required | Privacy proxy URL |
| `connection` | Connection | required | Solana connection |
| `wallet` | Keypair | required | Wallet for signing |
| `coordinatorProgramId` | string | default | Custom program ID |
| `timeout` | number | 30000 | Request timeout (ms) |
| `pollInterval` | number | 2000 | Batch poll interval (ms) |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `addQuery<T>(method, pubkey, commitment?)` | `Promise<T>` | Submit query on-chain |
| `pendingCount` | `number` | Pending queries count |
| `activeBatchId` | `bigint \| null` | Current batch ID |
| `getCoordinator()` | `CoordinatorClient` | Direct coordinator access |

### CoordinatorClient

Direct access to on-chain coordinator.

```typescript
new CoordinatorClient(connection: Connection, programId?: string)
```

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getCoordinatorState()` | `Promise<CoordinatorState \| null>` | Get coordinator config |
| `getBatch(batchId)` | `Promise<BatchAccount \| null>` | Get batch details |
| `findPendingBatch()` | `Promise<bigint \| null>` | Find open batch |
| `findFinalizedBatches()` | `Promise<bigint[]>` | List ready batches |
| `createBatchInstruction(...)` | `TransactionInstruction` | Create batch ix |
| `createSubmitQueryInstruction(...)` | `TransactionInstruction` | Submit query ix |
| `createFinalizeBatchInstruction(...)` | `TransactionInstruction` | Finalize batch ix |
| `createCompleteBatchInstruction(...)` | `TransactionInstruction` | Complete batch ix |

### Enums

```typescript
import { RpcMethod, BatchStatus, CommitmentLevel } from "@privacy-rpc/sdk";

// Supported RPC methods
RpcMethod.GetBalance
RpcMethod.GetAccountInfo

// Batch states
BatchStatus.Collecting
BatchStatus.Ready
BatchStatus.Processing
BatchStatus.Completed
BatchStatus.Failed

// Commitment levels
CommitmentLevel.Processed
CommitmentLevel.Confirmed
CommitmentLevel.Finalized
```

### Utilities

```typescript
import {
    generateQueryId,
    hashQuery,
    hashBatch,
    verifyBatchHash
} from "@privacy-rpc/sdk";

// Generate unique query ID
const id = generateQueryId(); // UUID v4

// Hash a query (SHA-256)
const hash = hashQuery(query); // hex string

// Hash entire batch
const batchHash = hashBatch(queries); // hex string

// Verify batch integrity
const valid = verifyBatchHash(queries, expectedHash); // boolean
```

## Types

```typescript
interface Query {
    id: string;
    method: RpcMethod;
    pubkey: string;
    commitment?: CommitmentLevel;
}

interface BatchRequest {
    queries: Query[];
    batchHash: string;
}

interface BatchResponse {
    results: QueryResult[];
    batchHash: string;
    executedAt: number;
}

interface CoordinatorState {
    authority: PublicKey;
    minBatchSize: number;
    maxBatchSize: number;
    batchCounter: bigint;
}

interface BatchAccount {
    id: bigint;
    status: "pending" | "finalized" | "executed";
    queryCount: number;
    queryHashes: Uint8Array[];
    submitters: PublicKey[];
    createdAt: bigint;
    finalizedAt: bigint | null;
    resultsHash: Uint8Array | null;
}
```

## Privacy Modes

### Mode 1: Client-Side Batching

```
User → SDK (batches locally) → Proxy → RPC
```

- **Privacy**: Queries from same user batched together
- **Trust**: Trust proxy to batch honestly
- **Latency**: Lower (no on-chain coordination)

### Mode 2: On-Chain Coordination

```
User → On-Chain Coordinator → Proxy (verifies) → RPC
```

- **Privacy**: Queries from different users batched together
- **Trust**: Trustless (on-chain verification)
- **Latency**: Higher (on-chain transactions)

## Development

```bash
# Install
npm install

# Build
npm run build

# Test
npm test

# Test with coverage
npm run test:coverage
```

## License

MIT
