/**
 * Solana commitment levels
 * Re-exported for convenience, mirrors @solana/web3.js
 */
export enum CommitmentLevel {
    /** Query the most recent block which has reached 1 confirmation */
    Processed = "processed",
    /** Query the most recent block which has reached 1 confirmation by a supermajority of the cluster */
    Confirmed = "confirmed",
    /** Query the most recent block which has been finalized by a supermajority of the cluster */
    Finalized = "finalized",
}

/**
 * Default commitment level for queries
 */
export const DEFAULT_COMMITMENT = CommitmentLevel.Confirmed;
