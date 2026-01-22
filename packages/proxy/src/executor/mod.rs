//! Batch executor for parallel query execution
//!
//! This module handles the core business logic of executing batched RPC queries
//! in parallel against the Solana RPC endpoint.
//!
//! Each RPC method has its own executor file for modularity.

mod execute_query;
mod get_account_info;
mod get_balance;
mod get_block_height;
mod get_multiple_accounts;
mod get_token_account_balance;
mod get_transaction;

pub use execute_query::execute_single_query;
pub use get_account_info::execute_get_account_info;
pub use get_balance::execute_get_balance;
pub use get_block_height::execute_get_block_height;
pub use get_multiple_accounts::execute_get_multiple_accounts;
pub use get_token_account_balance::execute_get_token_account_balance;
pub use get_transaction::execute_get_transaction;

use crate::error::{ProxyError, ProxyResult};
use crate::types::{BatchRequest, BatchResponse, QueryResult, MAX_BATCH_SIZE};
use solana_client::rpc_client::RpcClient;
use std::sync::Arc;
use std::time::Instant;
use tokio::task::JoinHandle;
use tracing::{info, warn};

/// Executor for batched RPC queries
pub struct BatchExecutor {
    /// Solana RPC client
    rpc_client: Arc<RpcClient>,
}

impl BatchExecutor {
    /// Create a new batch executor with the given RPC URL
    pub fn new(rpc_url: &str) -> Self {
        let rpc_client = Arc::new(RpcClient::new(rpc_url.to_string()));
        Self { rpc_client }
    }

    /// Execute a batch of queries in parallel
    ///
    /// Each query is executed as a separate Tokio task, allowing for
    /// parallel execution while maintaining individual error handling.
    pub async fn execute_batch(&self, request: BatchRequest) -> ProxyResult<BatchResponse> {
        // Validate batch
        if request.is_empty() {
            return Err(ProxyError::EmptyBatch);
        }
        if request.len() > MAX_BATCH_SIZE {
            return Err(ProxyError::batch_too_large(request.len()));
        }

        let batch_id = request
            .batch_hash
            .clone()
            .unwrap_or_else(|| "unknown".to_string());
        let query_count = request.len();

        info!(
            batch_id = %batch_id,
            query_count = query_count,
            "Executing batch"
        );

        let start = Instant::now();

        // Spawn parallel tasks for each query
        // Use spawn_blocking since RpcClient is blocking
        let handles: Vec<JoinHandle<QueryResult>> = request
            .queries
            .into_iter()
            .map(|query| {
                let client = Arc::clone(&self.rpc_client);
                tokio::task::spawn_blocking(move || execute_single_query(client, query))
            })
            .collect();

        // Collect results
        let mut results = Vec::with_capacity(handles.len());

        for handle in handles {
            match handle.await {
                Ok(result) => {
                    results.push(result);
                }
                Err(join_error) => {
                    // Task panicked or was cancelled
                    warn!(error = %join_error, "Query task failed");
                    results.push(QueryResult::failure(
                        "unknown".to_string(),
                        format!("Task execution failed: {}", join_error),
                    ));
                }
            }
        }

        let execution_time_ms = start.elapsed().as_millis() as u64;
        let response = BatchResponse::from_results(results, execution_time_ms);

        info!(
            batch_id = %batch_id,
            execution_time_ms = execution_time_ms,
            succeeded = response.succeeded_count,
            failed = response.failed_count,
            "Batch complete"
        );

        Ok(response)
    }

    /// Check if the RPC connection is healthy
    pub async fn check_health(&self) -> bool {
        let client = Arc::clone(&self.rpc_client);

        // Run the blocking RPC call in a blocking task
        tokio::task::spawn_blocking(move || client.get_health().is_ok())
            .await
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::enums::RpcMethod;
    use crate::types::Query;

    #[test]
    fn test_batch_executor_validates_empty_batch() {
        let executor = BatchExecutor::new("http://localhost:8899");
        let request = BatchRequest::new(vec![]);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(executor.execute_batch(request));

        assert!(matches!(result, Err(ProxyError::EmptyBatch)));
    }

    #[test]
    fn test_batch_executor_validates_batch_size() {
        let executor = BatchExecutor::new("http://localhost:8899");
        let queries: Vec<Query> = (0..150)
            .map(|i| {
                Query::new(
                    format!("query-{}", i),
                    RpcMethod::GetBalance,
                    "11111111111111111111111111111111".to_string(),
                )
            })
            .collect();

        let request = BatchRequest::new(queries);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(executor.execute_batch(request));

        assert!(matches!(
            result,
            Err(ProxyError::BatchTooLarge { actual: 150, .. })
        ));
    }
}
