use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum BatchStatus {
    #[default]
    Pending,
    Finalized,
    Executed,
}

#[account]
pub struct Batch {
    /// Batch ID
    pub id: u64,
    /// Current status
    pub status: BatchStatus,
    /// Number of queries in this batch
    pub query_count: u8,
    /// Query hashes (SHA-256, 32 bytes each)
    pub query_hashes: Vec<[u8; 32]>,
    /// Submitters for each query (for reward distribution)
    pub submitters: Vec<Pubkey>,
    /// Timestamp when batch was created
    pub created_at: i64,
    /// Timestamp when batch was finalized
    pub finalized_at: Option<i64>,
    /// Results hash after execution
    pub results_hash: Option<[u8; 32]>,
    /// Bump seed for PDA
    pub bump: u8,
}

impl Batch {
    pub const SEED: &'static [u8] = b"batch";
    pub const MAX_QUERIES: usize = 20;

    pub fn size(max_queries: usize) -> usize {
        8 +                           // discriminator
        8 +                           // id
        1 +                           // status
        1 +                           // query_count
        4 + (32 * max_queries) +      // query_hashes vec
        4 + (32 * max_queries) +      // submitters vec
        8 +                           // created_at
        1 + 8 +                       // finalized_at option
        1 + 32 +                      // results_hash option
        1                             // bump
    }

    pub fn is_full(&self, max_size: u8) -> bool {
        self.query_count >= max_size
    }

    pub fn can_finalize(&self, min_size: u8) -> bool {
        self.status == BatchStatus::Pending && self.query_count >= min_size
    }
}
