# Contributing to Solana Privacy RPC Layer

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Commit Guidelines](#commit-guidelines)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Report issues professionally

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Rust** 1.75+ and Cargo
- **Solana CLI** (for testing)
- **Anchor CLI** 0.32+ (for coordinator development)
- **Git** for version control

### First Contribution

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/privacy-rpc-layer.git
   cd privacy-rpc-layer
   ```
3. **Install dependencies**
   ```bash
   # SDK
   cd packages/sdk && npm install && cd ../..

   # Demo
   cd packages/demo && npm install && cd ../..

   # Proxy
   cd packages/proxy && cargo build && cd ../..

   # Coordinator
   cd packages/coordinator && anchor build && cd ../..
   ```

## Development Setup

### Environment Variables

Create `.env` files for each package:

**packages/proxy/.env:**
```bash
QUICKNODE_RPC_URL=http://localhost:8899
PORT=3000
RUST_LOG=info
```

**packages/demo/.env:**
```bash
SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Running Locally

```bash
# Terminal 1: Start Solana validator
solana-test-validator

# Terminal 2: Start proxy
cd packages/proxy
QUICKNODE_RPC_URL=http://localhost:8899 cargo run

# Terminal 3: Run demo
cd packages/demo
npm run demo:local
```

## Project Structure

```
privacy-rpc-layer/
├── packages/
│   ├── sdk/                 # TypeScript SDK
│   │   ├── src/
│   │   │   ├── connection/  # PrivateConnection
│   │   │   ├── batch/       # Batch management
│   │   │   ├── coordinator/ # On-chain client
│   │   │   └── utils/       # Hash, crypto utils
│   │   └── tests/
│   │
│   ├── proxy/               # Rust/Axum proxy
│   │   └── src/
│   │       ├── server.rs    # Server setup
│   │       ├── handlers/    # HTTP handlers
│   │       ├── executor/    # RPC execution
│   │       └── coordinator/ # On-chain verification
│   │
│   ├── coordinator/         # Anchor program
│   │   └── programs/
│   │       └── coordinator/
│   │           └── src/
│   │               ├── lib.rs       # Instructions
│   │               ├── state/       # Accounts
│   │               └── errors/      # Custom errors
│   │
│   └── demo/                # Demo CLI
│       └── src/
│           ├── index.ts     # CLI entry
│           └── commands/    # Commands
│
└── examples/
    └── basic-usage/         # Usage examples
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

**Branch Naming:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code refactoring
- `test/` - Test additions

### 2. Make Changes

Follow the [Code Style](#code-style) guidelines for your changes.

### 3. Test Your Changes

```bash
# SDK tests
cd packages/sdk && npm test

# Proxy tests
cd packages/proxy && cargo test

# Coordinator tests
cd packages/coordinator && anchor test

# Integration test (manual)
cd packages/demo && npm run demo:local
```

### 4. Commit Your Changes

Follow [Commit Guidelines](#commit-guidelines):

```bash
git add .
git commit -m "feat: add new RPC method support"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Code Style

### TypeScript (SDK, Demo)

**Formatting:**
- 4 spaces for indentation
- Semicolons required
- Double quotes for strings
- Max line length: 100 characters

**Naming Conventions:**
```typescript
// Classes: PascalCase
class PrivateConnection { }

// Functions/Methods: camelCase
function hashQuery() { }

// Constants: UPPER_SNAKE_CASE
const DEFAULT_BATCH_SIZE = 10;

// Interfaces: PascalCase with 'I' prefix (optional)
interface BatchRequest { }
```

**Example:**
```typescript
/**
 * Creates a private connection with batching.
 * @param rpcEndpoint - Solana RPC URL
 * @param config - Privacy configuration
 */
export class PrivateConnection {
    private batchManager: BatchManager;

    constructor(rpcEndpoint: string, config: PrivacyConfig) {
        this.batchManager = new BatchManager(config);
    }
}
```

### Rust (Proxy, Coordinator)

**Formatting:**
```bash
# Auto-format before committing
cargo fmt
```

**Linting:**
```bash
# Check for common mistakes
cargo clippy
```

**Naming Conventions:**
```rust
// Structs: PascalCase
struct BatchRequest { }

// Functions: snake_case
fn execute_batch() { }

// Constants: UPPER_SNAKE_CASE
const MAX_BATCH_SIZE: u8 = 100;

// Modules: snake_case
mod batch_manager;
```

**Example:**
```rust
/// Executes a batch of queries against the RPC.
///
/// # Arguments
/// * `queries` - Vector of queries to execute
///
/// # Returns
/// Vector of query results
pub async fn execute_batch(queries: Vec<Query>) -> Result<Vec<QueryResult>> {
    // Implementation
}
```

### Documentation

**TSDoc for TypeScript:**
```typescript
/**
 * Submits a query with privacy batching.
 *
 * @param method - RPC method to call
 * @param pubkey - Public key to query
 * @param commitment - Optional commitment level
 * @returns Promise resolving to query result
 *
 * @example
 * ```typescript
 * const balance = await connection.getBalance(pubkey);
 * ```
 */
async getBalance(pubkey: PublicKey, commitment?: Commitment): Promise<number> {
    // Implementation
}
```

**Rustdoc for Rust:**
```rust
/// Verifies batch is finalized on-chain.
///
/// # Arguments
/// * `batch_id` - Batch ID to verify
///
/// # Returns
/// * `Ok(true)` if batch is finalized
/// * `Ok(false)` if batch is not finalized
/// * `Err` if verification fails
///
/// # Example
/// ```
/// let finalized = verifier.verify_batch(42).await?;
/// ```
pub async fn verify_batch(&self, batch_id: u64) -> Result<bool> {
    // Implementation
}
```

## Testing

### Unit Tests

**TypeScript:**
```typescript
import { describe, it, expect } from '@jest/globals';
import { hashQuery } from './utils';

describe('hashQuery', () => {
    it('should hash query correctly', () => {
        const query = { method: 'getBalance', pubkey: '...' };
        const hash = hashQuery(query);
        expect(hash).toHaveLength(64); // SHA-256 hex
    });
});
```

**Rust:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_creation() {
        let batch = Batch::new(1);
        assert_eq!(batch.id, 1);
        assert_eq!(batch.query_count, 0);
    }
}
```

### Integration Tests

**Anchor (Coordinator):**
```typescript
import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";

describe("coordinator", () => {
    it("should create and finalize batch", async () => {
        // Setup
        const program = anchor.workspace.Coordinator;

        // Create batch
        await program.methods.createBatch().rpc();

        // Submit queries
        for (let i = 0; i < 3; i++) {
            await program.methods
                .submitQuery(batchId, queryHash)
                .rpc();
        }

        // Finalize
        await program.methods.finalizeBatch(batchId).rpc();

        // Verify
        const batch = await program.account.batch.fetch(batchPda);
        expect(batch.status).to.equal("finalized");
    });
});
```

### Manual Testing

Always test the full flow:
```bash
# 1. Start validator
solana-test-validator

# 2. Deploy coordinator (if changed)
cd packages/coordinator
anchor deploy --provider.cluster localnet

# 3. Start proxy
cd packages/proxy
QUICKNODE_RPC_URL=http://localhost:8899 cargo run

# 4. Run demo
cd packages/demo
npm run demo:local
```

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] All tests pass
- [ ] Documentation updated (if needed)
- [ ] No console.log or debug code left
- [ ] Code formatted (`cargo fmt` for Rust)
- [ ] No linter warnings (`cargo clippy` for Rust)

### PR Description Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactoring

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. **Automated checks** must pass (if CI/CD configured)
2. **Code review** by at least one maintainer
3. **Testing verification** by reviewer
4. **Approval and merge** by maintainer

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/).

### Format

```
<type>: <description>

[optional body]

[optional footer]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add getTransaction method` |
| `fix` | Bug fix | `fix: handle empty batch correctly` |
| `docs` | Documentation | `docs: update SDK README` |
| `style` | Code style (no logic change) | `style: format with prettier` |
| `refactor` | Code refactoring | `refactor: simplify batch manager` |
| `test` | Add/update tests | `test: add coordinator tests` |
| `chore` | Maintenance | `chore: update dependencies` |

### Examples

**Good commits:**
```bash
feat: add encrypted result channels

fix: prevent duplicate queries in batch

docs: add troubleshooting section to proxy README

test: add integration tests for on-chain flow
```

**Bad commits:**
```bash
Update stuff
Fixed bug
WIP
asdf
```

### Multi-line Commits

```bash
git commit -m "feat: add batch timeout mechanism

- Add timeout configuration option
- Implement automatic batch execution after timeout
- Add tests for timeout behavior

Closes #123"
```

## Adding New Features

### Adding a New RPC Method

**1. Update SDK (`packages/sdk/src/enums/rpc-method.ts`):**
```typescript
export enum RpcMethod {
    GetBalance = "getBalance",
    GetAccountInfo = "getAccountInfo",
    GetTransaction = "getTransaction", // New
}
```

**2. Update Proxy (`packages/proxy/src/executor/`):**
```rust
// Add new executor file: get_transaction.rs
pub async fn execute_get_transaction(
    client: &RpcClient,
    pubkey: &str,
) -> Result<Value> {
    // Implementation
}

// Update mod.rs to export
pub mod get_transaction;
```

**3. Add Tests:**
```typescript
// SDK test
it('should query transaction', async () => {
    const tx = await connection.getTransaction(signature);
    expect(tx).toBeDefined();
});
```

**4. Update Documentation:**
- Update `packages/sdk/README.md` with new method
- Update `packages/proxy/README.md` with supported methods
- Add example to `examples/basic-usage/`

## Questions?

- **Issues:** Open a GitHub issue
- **Discussions:** Use GitHub Discussions
- **Security:** See [SECURITY.md](./SECURITY.md)

Thank you for contributing! 🚀
