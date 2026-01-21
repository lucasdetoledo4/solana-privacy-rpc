use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct CoordinatorState {
    /// Authority that can update coordinator settings
    pub authority: Pubkey,
    /// Minimum queries required per batch (k-anonymity parameter)
    pub min_batch_size: u8,
    /// Maximum queries allowed per batch
    pub max_batch_size: u8,
    /// Current batch counter
    pub batch_counter: u64,
    /// Bump seed for PDA
    pub bump: u8,
}

impl CoordinatorState {
    pub const SEED: &'static [u8] = b"coordinator";
    pub const SIZE: usize = 8 + 32 + 1 + 1 + 8 + 1;
}
