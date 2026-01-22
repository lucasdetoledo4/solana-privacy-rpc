//! Get transaction executor
//!
//! Fetches transaction details by signature.

use crate::types::{Query, QueryResult};
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::signature::Signature;
use solana_transaction_status::UiTransactionEncoding;
use std::str::FromStr;
use std::sync::Arc;
use tracing::warn;

/// Execute getTransaction RPC call
///
/// # Arguments
/// * `client` - Solana RPC client
/// * `query` - Query containing transaction signature
///
/// # Returns
/// QueryResult with transaction data or error
pub fn execute_get_transaction(client: Arc<RpcClient>, query: Query) -> QueryResult {
    // Extract signature from query
    let signature_str = match query.get_primary_param() {
        Some(sig) => sig,
        None => {
            return QueryResult::failure(query.id, "Missing transaction signature".to_string());
        }
    };

    // Parse signature
    let signature = match Signature::from_str(&signature_str) {
        Ok(sig) => sig,
        Err(e) => {
            warn!(signature = %signature_str, error = %e, "Invalid signature");
            return QueryResult::failure(
                query.id,
                format!("Invalid signature: {}", e),
            );
        }
    };

    // Parse commitment
    let commitment = query
        .commitment
        .as_ref()
        .and_then(|c| CommitmentConfig::from_str(c).ok())
        .unwrap_or(CommitmentConfig::confirmed());

    // Execute RPC call
    match client.get_transaction_with_config(
        &signature,
        solana_client::rpc_config::RpcTransactionConfig {
            encoding: Some(UiTransactionEncoding::Json),
            commitment: Some(commitment),
            max_supported_transaction_version: Some(0),
        },
    ) {
        Ok(transaction) => {
            // Convert to JSON
            match serde_json::to_value(&transaction) {
                Ok(json) => QueryResult::success(query.id, json),
                Err(e) => {
                    warn!(error = %e, "Failed to serialize transaction");
                    QueryResult::failure(query.id, format!("Serialization error: {}", e))
                }
            }
        }
        Err(e) => {
            warn!(signature = %signature_str, error = %e, "Failed to get transaction");
            QueryResult::failure(query.id, format!("RPC error: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalid_signature() {
        let client = Arc::new(RpcClient::new("http://localhost:8899".to_string()));
        let query = Query::new(
            "test-1".to_string(),
            RpcMethod::GetTransaction,
            "invalid-signature".to_string(),
        );

        let result = execute_get_transaction(client, query);
        assert!(!result.success);
        assert!(result.error.unwrap().contains("Invalid signature"));
    }
}
