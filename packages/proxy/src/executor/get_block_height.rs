//! Get block height executor
//!
//! Fetches the current block height of the cluster.

use crate::types::{Query, QueryResult};
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use std::str::FromStr;
use std::sync::Arc;
use tracing::warn;

/// Execute getBlockHeight RPC call
///
/// # Arguments
/// * `client` - Solana RPC client
/// * `query` - Query (params not needed for block height)
///
/// # Returns
/// QueryResult with block height or error
pub fn execute_get_block_height(client: Arc<RpcClient>, query: Query) -> QueryResult {
    // Parse commitment
    let commitment = query
        .commitment
        .as_ref()
        .and_then(|c| CommitmentConfig::from_str(c).ok())
        .unwrap_or(CommitmentConfig::confirmed());

    // Execute RPC call
    match client.get_block_height_with_commitment(commitment) {
        Ok(height) => QueryResult::success(query.id, serde_json::json!(height)),
        Err(e) => {
            warn!(error = %e, "Failed to get block height");
            QueryResult::failure(query.id, format!("RPC error: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::enums::RpcMethod;

    #[test]
    fn test_get_block_height_no_params_needed() {
        // This test would require a running validator
        // Just verify the function signature is correct
        let client = Arc::new(RpcClient::new("http://localhost:8899".to_string()));
        let query = Query::with_params(
            "test-1".to_string(),
            RpcMethod::GetBlockHeight,
            serde_json::json!(null),
        );

        let _result = execute_get_block_height(client, query);
        // Can't assert success without running validator
    }
}
