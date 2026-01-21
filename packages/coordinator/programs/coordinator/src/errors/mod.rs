use anchor_lang::prelude::*;

#[error_code]
pub enum CoordinatorError {
    #[msg("Batch is already full")]
    BatchFull,
    #[msg("Batch does not have enough queries to finalize")]
    InsufficientQueries,
    #[msg("Batch is not in pending status")]
    BatchNotPending,
    #[msg("Batch is not finalized")]
    BatchNotFinalized,
    #[msg("Query hash already exists in batch")]
    DuplicateQuery,
    #[msg("Invalid batch size parameters")]
    InvalidBatchSize,
    #[msg("Unauthorized")]
    Unauthorized,
}
