//! On-chain coordinator client
//!
//! Reads batch data from the Solana coordinator program.

mod poller;
mod reader;

pub use poller::BatchPoller;
pub use reader::{CoordinatorReader, OnChainBatch, OnChainBatchStatus};
