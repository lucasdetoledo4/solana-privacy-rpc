# Solana Privacy RPC Layer - AI Coding Guidelines

This file provides context and standards for AI coding assistants (Claude Code, Cursor, etc.) working on this project.

---

## PROJECT OVERVIEW

### What We're Building
A three-layer privacy infrastructure providing k-anonymity for Solana RPC queries:
- Layer 1 (TypeScript): Client SDK - drop-in replacement for @solana/web3.js
- Layer 2 (Rust): On-chain coordinator - Anchor program managing batches
- Layer 3 (Rust): RPC proxy - Axum server executing batches via QuickNode

### Privacy Mechanism
Batch queries from multiple users together so individual queries are indistinguishable (k-anonymity). Each query mixed with >=k-1 others before hitting QuickNode RPC.

### Target Audience
- Primary: Solana developers who want privacy-preserving RPC access
- Secondary: QuickNode hackathon judges evaluating technical merit
- Tertiary: Potential employers reviewing code quality

---

## MILESTONE STRATEGY

### Current Focus: Milestone 1 (15h)
Build: TypeScript SDK + Rust Proxy + Basic Example
Goal: Working end-to-end privacy RPC with client-side batching
Submittable: YES - This is a complete, functional product

### Future Milestones
- M2 (15h): Add Anchor on-chain coordinator for trustless batching
- M3 (10h): Extend to support 8+ RPC methods
- M4 (10h): Production polish (optimization, docs, video)

### Critical Rule
DO NOT start next milestone until current milestone is:
- Fully functional (all features working)
- Well tested (>70% coverage if possible)
- Properly documented (README updated)
- Could be submitted as-is to hackathon

---

## CODE ORGANIZATION

### TypeScript SDK Structure
```
packages/sdk/src/
├── index.ts              # Public exports only
├── PrivateConnection.ts  # Main SDK class
├── BatchManager.ts       # Batching logic
├── enums/               # All enums (one per file)
│   ├── index.ts
│   ├── RpcMethod.ts
│   ├── BatchStatus.ts
│   └── Commitment.ts
├── types/               # All type definitions (one per file)
│   ├── index.ts
│   ├── config.ts
│   ├── query.ts
│   ├── response.ts
│   └── result.ts
├── utils/               # Utility functions (one per file)
│   ├── index.ts
│   ├── generateQueryId.ts
│   ├── hashQuery.ts
│   ├── hashBatch.ts
│   └── verifyBatchHash.ts
└── __tests__/           # All tests
    ├── BatchManager.test.ts
    ├── QueryHasher.test.ts
    ├── enums.test.ts
    └── types.test.ts
```

### Rust Proxy Structure
```
packages/proxy/src/
├── main.rs              # Entry point only
├── server.rs            # HTTP server setup
├── error.rs             # Error handling
├── enums/               # All enums (one per file)
│   ├── mod.rs
│   ├── rpc_method.rs
│   ├── batch_status.rs
│   └── commitment.rs
├── types/               # All type definitions (one per file)
│   ├── mod.rs
│   ├── config.rs
│   ├── query.rs
│   ├── batch_request.rs
│   ├── batch_response.rs
│   ├── query_result.rs
│   └── health_response.rs
├── handlers/            # HTTP handlers (one per file)
│   ├── mod.rs
│   ├── health.rs
│   └── execute_batch.rs
└── executor/            # RPC executors (one per file)
    ├── mod.rs
    ├── execute_query.rs
    ├── get_balance.rs
    └── get_account_info.rs
```

---

## ENUMS AND MAGIC STRINGS

### Critical Rule: NO MAGIC STRINGS
**ALWAYS use enums instead of string literals for:**
- RPC method names
- Status values
- Commitment levels
- Error codes
- Any other repeated string values

### TypeScript Enum Guidelines
```typescript
// GOOD - Use enums
export enum RpcMethod {
    GetBalance = 'getBalance',
    GetAccountInfo = 'getAccountInfo',
}

const method = RpcMethod.GetBalance;

// BAD - Magic strings
const method = 'getBalance';
```

### Rust Enum Guidelines
```rust
// GOOD - Use enums with serde
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RpcMethod {
    GetBalance,
    GetAccountInfo,
}

// BAD - Magic strings
let method = "getBalance";
```

### Enum Best Practices
1. **Define enums in dedicated files** under `enums/` directory
2. **Export from index** for easy imports
3. **Add helper methods** like `as_str()`, `from_str()`, `all()`
4. **Add type guards** for runtime validation
5. **Document each variant** with doc comments
6. **Test serialization** to ensure JSON compatibility

---

## FILE MODULARITY

### Rules
- One function per file for utilities
- One enum per file
- One type/interface per file
- Use index files to re-export
- Name files after their primary export

### Use Standard Libraries
Prefer well-known libraries over manual implementations (e.g., `uuid` for UUIDs, `crypto` for hashing).

---

## RUST CODING STANDARDS

### General Principles
- Production quality over hackathon shortcuts
- Explicit is better than clever
- Error messages should guide debugging
- Comments explain WHY, not WHAT
- Performance matters, but correctness first

### Error Handling
- Use `thiserror` for custom errors
- NEVER unwrap() in production code paths
- ALWAYS provide context in error messages
- Prefer `Result<T, E>` over panics
- Implement `IntoResponse` for Axum errors

### Logging
- Use `tracing` crate (not `log`)
- Levels: error (bugs), warn (recoverable), info (milestones), debug (verbose)
- Include context in log messages

---

## TYPESCRIPT CODING STANDARDS

### General Principles
- Strict TypeScript - no `any` unless absolutely necessary
- Functional style preferred over classes (except main Connection)
- Immutability by default
- Clear, descriptive variable names

### Type Safety
- Enable `strict` mode in tsconfig.json
- Explicit return types on all public functions
- Use `readonly` for immutable properties
- Prefer `interface` over `type` for objects

### Error Handling
- Throw Error objects, not strings
- Use custom Error classes for specific cases
- ALWAYS provide helpful error messages

---

## TESTING STRATEGY

### Test Organization
- TypeScript tests in `src/__tests__/` folder
- Rust tests use `#[cfg(test)]` in same file (idiomatic)
- Name tests descriptively: `test_batch_executor_validates_empty_batch`

### Test Coverage
- Test each public function independently
- Test error paths, not just happy paths
- Test enum serialization/deserialization
- Test type guards and validators

### Manual Testing
```bash
# 1. Start Solana test validator
solana-test-validator

# 2. Start Rust proxy
QUICKNODE_RPC_URL=http://localhost:8899 cargo run

# 3. Run example
cd examples/basic-usage && npm start
```

---

## QUALITY BAR

Every file should be:
- Professional enough to show in interview
- Documented enough for stranger to use
- Tested enough to deploy with confidence
- Clean enough to maintain long-term

**Remember: Quality over quantity. A polished Milestone 1 beats a rushed Milestone 3.**

---

## GIT COMMIT GUIDELINES

### Commit Message Format
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Keep first line under 72 characters
- Add detailed description in body if needed

### Important Rules
- **DO NOT include `Co-Authored-By` lines** in commit messages
- Keep commits focused and atomic
- Write clear, descriptive commit messages
