//! Batch poller for monitoring finalized on-chain batches

use super::reader::{CoordinatorReader, OnChainBatch, OnChainBatchStatus};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};

/// Tracks processed batches to avoid duplicate processing
pub struct BatchPoller {
    reader: CoordinatorReader,
    processed_batches: Arc<RwLock<HashSet<u64>>>,
    poll_interval: Duration,
}

impl BatchPoller {
    pub fn new(rpc_url: &str, poll_interval_ms: u64) -> Self {
        Self {
            reader: CoordinatorReader::new(rpc_url),
            processed_batches: Arc::new(RwLock::new(HashSet::new())),
            poll_interval: Duration::from_millis(poll_interval_ms),
        }
    }

    /// Start the polling loop in a background task
    pub fn start(self) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            info!(
                interval_ms = self.poll_interval.as_millis(),
                "Starting batch poller"
            );
            loop {
                self.poll_once().await;
                tokio::time::sleep(self.poll_interval).await;
            }
        })
    }

    async fn poll_once(&self) {
        let finalized = self.reader.find_finalized_batches();

        if finalized.is_empty() {
            debug!("No finalized batches found");
            return;
        }

        let processed = self.processed_batches.read().await;
        let new_batches: Vec<&OnChainBatch> = finalized
            .iter()
            .filter(|b| !processed.contains(&b.id))
            .collect();

        drop(processed);

        for batch in new_batches {
            self.handle_finalized_batch(batch).await;
        }
    }

    async fn handle_finalized_batch(&self, batch: &OnChainBatch) {
        info!(
            batch_id = batch.id,
            query_count = batch.query_count,
            submitter_count = batch.submitters.len(),
            "Found finalized batch ready for execution"
        );

        // Log query hashes for debugging
        for (i, hash) in batch.query_hashes.iter().enumerate() {
            debug!(
                batch_id = batch.id,
                query_index = i,
                hash = hex::encode(hash),
                "Query hash in batch"
            );
        }

        // Mark as processed to avoid duplicate handling
        let mut processed = self.processed_batches.write().await;
        processed.insert(batch.id);

        // Note: Actual query execution happens via /execute-batch endpoint
        // The SDK sends actual query parameters there after batch finalization
        info!(
            batch_id = batch.id,
            "Batch marked as seen, awaiting query submission via /execute-batch"
        );
    }

    /// Check if a batch has been processed
    pub async fn is_batch_processed(&self, batch_id: u64) -> bool {
        self.processed_batches.read().await.contains(&batch_id)
    }

    /// Get a specific batch from chain
    pub fn get_batch(&self, batch_id: u64) -> Option<OnChainBatch> {
        self.reader.get_batch(batch_id)
    }

    /// Verify that a batch is finalized on-chain
    pub fn verify_batch_finalized(&self, batch_id: u64) -> bool {
        match self.reader.get_batch(batch_id) {
            Some(batch) => batch.status == OnChainBatchStatus::Finalized,
            None => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_poller_creation() {
        let poller = BatchPoller::new("https://api.devnet.solana.com", 5000);
        assert_eq!(poller.poll_interval, Duration::from_millis(5000));
    }
}
