//! Get token account balance executor
//!
//! Fetches SPL token account balance.

use crate::types::{Query, QueryResult};
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;
use std::sync::Arc;
use tracing::warn;

/// Execute getTokenAccountBalance RPC call
///
/// # Arguments
/// * `client` - Solana RPC client
/// * `query` - Query containing token account public key
///
/// # Returns
/// QueryResult with token balance or error
pub fn execute_get_token_account_balance(client: Arc<RpcClient>, query: Query) -> QueryResult {
    // Extract pubkey
    let pubkey_str = match query.get_primary_param() {
        Some(pk) => pk,
        None => {
            return QueryResult::failure(query.id, "Missing token account pubkey".to_string());
        }
    };

    // Parse pubkey
    let pubkey = match Pubkey::from_str(&pubkey_str) {
        Ok(pk) => pk,
        Err(e) => {
            warn!(pubkey = %pubkey_str, error = %e, "Invalid pubkey");
            return QueryResult::failure(
                query.id,
                format!("Invalid pubkey: {}", e),
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
    match client.get_token_account_balance_with_commitment(&pubkey, commitment) {
        Ok(balance) => {
            // Convert to JSON
            match serde_json::to_value(&balance.value) {
                Ok(json) => QueryResult::success(query.id, json),
                Err(e) => {
                    warn!(error = %e, "Failed to serialize token balance");
                    QueryResult::failure(query.id, format!("Serialization error: {}", e))
                }
            }
        }
        Err(e) => {
            warn!(pubkey = %pubkey_str, error = %e, "Failed to get token account balance");
            QueryResult::failure(query.id, format!("RPC error: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::enums::RpcMethod;

    #[test]
    fn test_invalid_pubkey() {
        let client = Arc::new(RpcClient::new("http://localhost:8899".to_string()));
        let query = Query::new(
            "test-1".to_string(),
            RpcMethod::GetTokenAccountBalance,
            "invalid-pubkey".to_string(),
        );

        let result = execute_get_token_account_balance(client, query);
        assert!(!result.success);
        assert!(result.error.unwrap().contains("Invalid pubkey"));
    }
}
