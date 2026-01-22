# Security Policy

## Overview

The Solana Privacy RPC Layer aims to provide k-anonymity for blockchain queries. This document outlines our security policy, known limitations, and how to report vulnerabilities.

## Supported Versions

| Version | Supported | Status |
|---------|-----------|--------|
| 0.1.x (Devnet) | ✅ Yes | Active development |
| Mainnet | ❌ Not yet | Planned |

**Current Status:** This project is in **alpha** and deployed on **devnet only**. It is not production-ready and should not be used with real assets on mainnet.

## Reporting a Vulnerability

### How to Report

If you discover a security vulnerability, please:

**DO:**
- Email the maintainers privately (see contact info in README)
- Provide detailed reproduction steps
- Include potential impact assessment
- Suggest a fix if possible

**DO NOT:**
- Open a public GitHub issue
- Disclose publicly before patching
- Exploit the vulnerability

### Response Timeline

| Timeline | Action |
|----------|--------|
| 24 hours | Initial acknowledgment |
| 7 days | Impact assessment and response plan |
| 30 days | Patch development and testing |
| Upon fix | Public disclosure (coordinated) |

### Scope

**In Scope:**
- Privacy leaks (linking users to queries)
- On-chain program vulnerabilities
- Proxy authentication/authorization bypasses
- Cryptographic weaknesses
- Denial of service attacks
- Data integrity issues

**Out of Scope:**
- Issues in dependencies (report to upstream)
- Social engineering attacks
- Physical security
- Issues requiring physical access

## Threat Model

### What We Protect Against

#### 1. RPC Provider Surveillance

**Threat:** RPC provider links your IP to your wallet queries.

**Mitigation:** K-anonymity batching hides your query among K others.

**Limitation:** RPC provider can still see batch timing/size patterns.

#### 2. Network Observers

**Threat:** Network observer monitors traffic between you and proxy.

**Mitigation:** Use HTTPS/TLS for all communication.

**Limitation:** Observer can see you're using the privacy layer (metadata).

#### 3. Malicious Proxy

**Threat:** Proxy operator tries to link queries to users.

**Mitigation:** On-chain coordination mode prevents this (queries committed on-chain first).

**Limitation:** Client-side batching mode trusts the proxy.

### What We DON'T Protect Against

#### 1. Timing Attacks

**Limitation:** If you're the only user, batches contain only your queries.

**Recommendation:** Use during high-traffic periods or wait for more users.

#### 2. On-Chain Analysis

**Limitation:** On-chain batch submissions are public (query hashes visible).

**Note:** Query hashes are one-way (SHA-256), but with limited query space, they may be reversible.

#### 3. Result Correlation

**Limitation:** Results are returned to users (no encryption in current version).

**Roadmap:** Encrypted result channels planned.

#### 4. Proxy Operator Privacy

**Limitation:** Proxy sees all queries in plaintext when executing against RPC.

**Note:** This is unavoidable - proxy must know query content to execute it.

## Privacy Guarantees

### K-Anonymity

**Guarantee:** Your query is indistinguishable from K-1 other queries in the same batch.

**Formula:**
```
Privacy level = 1 / K

Where K = min_batch_size (typically 3-10)
```

**Example:**
- K = 3: You have 33% anonymity (query is 1 of 3)
- K = 10: You have 10% anonymity (query is 1 of 10)
- K = 100: You have 1% anonymity (query is 1 of 100)

### Modes

| Mode | Trust Model | Privacy Level | Use Case |
|------|-------------|---------------|----------|
| Client-Side Batching | Trust proxy | Low-Medium | Testing, demos |
| On-Chain Coordination | Trustless | High | Production, high-security |

## Known Limitations

### 1. Limited Query Space

**Issue:** Solana has a finite number of popular wallets/accounts.

**Impact:** Query hashes may be reversible via rainbow table/brute force.

**Example:**
```
Query: getBalance(SolanaFoundationWallet)
Hash: sha256(query) = abc123...

Attacker can:
1. Generate hashes for all known wallets
2. Match hash to determine query content
```

**Mitigation:**
- Add random salt to queries (planned)
- Use dummy queries to expand query space (planned)

### 2. Batch Size Variability

**Issue:** Small batches (K=3) provide less privacy than large batches (K=100).

**Impact:** During low-traffic periods, privacy degrades.

**Mitigation:**
- Set minimum K parameter on-chain
- Wait for batch to fill before executing
- Reject batches below minimum K

### 3. No Result Encryption

**Issue:** Results are returned in plaintext (currently).

**Impact:** Network observers can see query results.

**Mitigation (planned):**
- Encrypt results with user's public key
- Use ephemeral keys for result delivery

### 4. Proxy Trust (Client-Side Mode)

**Issue:** In client-side batching mode, proxy could:
- Selectively delay queries
- Log individual queries
- Not batch queries at all

**Mitigation:** Use on-chain coordination mode for trustless operation.

### 5. Solana Transaction Fees

**Issue:** On-chain coordination requires SOL for transaction fees.

**Impact:** Each query submission costs ~0.000005 SOL.

**Note:** This is unavoidable for on-chain security.

## Best Practices

### For Users

#### 1. Use On-Chain Coordination

```typescript
// Trustless (recommended for production)
const manager = new OnChainBatchManager({ ... });

// Trust-based (for testing only)
const connection = new PrivateConnection({ ... });
```

#### 2. Use HTTPS

```typescript
// Good
const connection = new PrivateConnection(
    "https://api.mainnet-beta.solana.com",
    { proxyEndpoint: "https://privacy-proxy.com" }
);

// Bad (leaks queries to network observers)
const connection = new PrivateConnection(
    "http://api.mainnet-beta.solana.com",  // ❌ HTTP
    { proxyEndpoint: "http://localhost:3000" }  // ❌ HTTP
);
```

#### 3. Batch Multiple Queries

```typescript
// Good - more queries = harder to correlate
const [balance1, balance2, balance3] = await Promise.all([
    connection.getBalance(pubkey1),
    connection.getBalance(pubkey2),
    connection.getBalance(pubkey3),
]);

// Less ideal - single query may be identifiable
const balance = await connection.getBalance(pubkey);
```

#### 4. Wait for High Traffic

```typescript
// Check pending count before submitting sensitive query
if (manager.pendingCount < 5) {
    console.warn("Low traffic - privacy may be reduced");
    // Wait or submit dummy queries
}
```

### For Proxy Operators

#### 1. Don't Log Queries

```rust
// Bad - logs individual queries
log::info!("Executing query: {:?}", query);

// Good - only log aggregates
log::info!("Executing batch {} with {} queries", batch_id, query_count);
```

#### 2. Verify Batches On-Chain

```rust
// Always verify batch is finalized before execution
if !coordinator.verify_batch_finalized(batch_id).await? {
    return Err(Error::BatchNotFinalized);
}
```

#### 3. Use Rate Limiting

```rust
// Prevent DoS attacks
.layer(ServiceBuilder::new()
    .layer(RateLimitLayer::new(100, Duration::from_secs(60)))
)
```

#### 4. Minimize Logs

```bash
# Production - minimal logging
RUST_LOG=warn cargo run

# Development - verbose logging
RUST_LOG=debug cargo run
```

### For Developers

#### 1. Validate All Inputs

```typescript
// Validate public keys
if (!PublicKey.isOnCurve(pubkey.toBytes())) {
    throw new Error("Invalid public key");
}

// Validate batch hashes
if (!verifyBatchHash(queries, expectedHash)) {
    throw new Error("Batch hash mismatch");
}
```

#### 2. Use Constant-Time Comparisons

```rust
// Good - prevents timing attacks
use subtle::ConstantTimeEq;
if hash1.ct_eq(&hash2).into() { ... }

// Bad - timing attack vulnerability
if hash1 == hash2 { ... }
```

#### 3. Handle Errors Safely

```typescript
// Good - doesn't leak info
catch (error) {
    throw new Error("Batch execution failed");
}

// Bad - leaks internal state
catch (error) {
    throw new Error(`Failed at query ${queryIndex}: ${error.message}`);
}
```

## Security Checklist

### Before Mainnet Deployment

- [ ] Security audit by third party
- [ ] Formal verification of on-chain program
- [ ] Penetration testing of proxy
- [ ] Add result encryption
- [ ] Add query salting
- [ ] Implement rate limiting
- [ ] Deploy monitoring/alerting
- [ ] Bug bounty program
- [ ] Incident response plan
- [ ] Privacy analysis by experts

### Before Each Release

- [ ] Run all tests (unit + integration)
- [ ] Dependency audit (`npm audit`, `cargo audit`)
- [ ] Static analysis (clippy, eslint)
- [ ] Review new code for vulnerabilities
- [ ] Update documentation
- [ ] Test on devnet
- [ ] Changelog updated

## Dependencies

### Regular Audits

We regularly audit dependencies:

```bash
# TypeScript
npm audit
npm audit fix

# Rust
cargo audit
cargo update
```

### Known Vulnerable Dependencies

None currently. Check GitHub Security Advisories for updates.

## Incident Response

### If Vulnerability Discovered

1. **Immediately:** Pause affected services
2. **Assess:** Determine scope and impact
3. **Patch:** Develop and test fix
4. **Deploy:** Roll out patch to all instances
5. **Notify:** Inform affected users
6. **Disclose:** Public disclosure after patching

### Emergency Contacts

See README for current maintainer contact information.

## Compliance

### Data Privacy

- **GDPR:** No personal data collected (IP addresses not logged in production)
- **CCPA:** No California resident data collected
- **Data Retention:** Query data not stored beyond execution

### Blockchain Transparency

- **On-chain data is permanent:** Query hashes are public on Solana blockchain
- **Right to erasure:** Cannot delete on-chain data (consider before submitting)

## Future Improvements

### Short Term (Next Release)

- [ ] Add result encryption (AES-256-GCM)
- [ ] Implement query salting
- [ ] Add batch timeout mechanisms
- [ ] Improve error handling (no info leaks)

### Long Term (Mainnet)

- [ ] Zero-knowledge proofs for query verification
- [ ] Trusted execution environments (TEE) for proxy
- [ ] Decentralized proxy network
- [ ] Cross-chain privacy support

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Solana Security Best Practices](https://docs.solana.com/developing/programming-model/security)
- [Anchor Security](https://www.anchor-lang.com/docs/security)
- [K-Anonymity Research](https://en.wikipedia.org/wiki/K-anonymity)

## Acknowledgments

We appreciate responsible disclosure from the security community. Contributors will be acknowledged (with permission) after fixes are deployed.

---

**Last Updated:** 2026-01-21

For questions about this security policy, please contact the maintainers.
