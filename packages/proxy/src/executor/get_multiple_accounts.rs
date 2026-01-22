//! Get multiple accounts executor
//!
//! Fetches multiple account data in a single RPC call (efficient batching).

use crate::types::{Query, QueryResult};
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;
use std::sync::Arc;
use tracing::warn;

/// Execute getMultipleAccounts RPC call
///
/// # Arguments
/// * `client` - Solana RPC client
/// * `query` - Query containing array of public keys
///
/// # Returns
/// QueryResult with array of account info or error
pub fn execute_get_multiple_accounts(client: Arc<RpcClient>, query: Query) -> QueryResult {
    // Extract pubkeys from params
    let pubkeys_str: Vec<String> = match &query.params {
        Some(params) => {
            if let Some(arr) = params.as_array() {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            } else if let Some(s) = params.as_str() {
                vec![s.to_string()]
            } else {
                return QueryResult::failure(
                    query.id,
                    "Invalid params format, expected array of strings".to_string(),
                );
            }
        }
        None => {
            return QueryResult::failure(query.id, "Missing pubkeys parameter".to_string());
        }
    };

    if pubkeys_str.is_empty() {
        return QueryResult::failure(query.id, "Empty pubkeys array".to_string());
    }

    // Parse all pubkeys
    let mut pubkeys = Vec::new();
    for pk_str in &pubkeys_str {
        match Pubkey::from_str(pk_str) {
            Ok(pk) => pubkeys.push(pk),
            Err(e) => {
                warn!(pubkey = %pk_str, error = %e, "Invalid pubkey");
                return QueryResult::failure(
                    query.id,
                    format!("Invalid pubkey '{}': {}", pk_str, e),
                );
            }
        }
    }

    // Parse commitment
    let commitment = query
        .commitment
        .as_ref()
        .and_then(|c| CommitmentConfig::from_str(c).ok())
        .unwrap_or(CommitmentConfig::confirmed());

    // Execute RPC call
    match client.get_multiple_accounts_with_commitment(&pubkeys, commitment) {
        Ok(response) => {
            // Convert accounts to JSON format
            let accounts_json: Vec<serde_json::Value> = response
                .value
                .into_iter()
                .map(|opt_account| match opt_account {
                    Some(account) => serde_json::json!({
                        "lamports": account.lamports,
                        "owner": account.owner.to_string(),
                        "executable": account.executable,
                        "rentEpoch": account.rent_epoch,
                        "dataLength": account.data.len(),
                    }),
                    None => serde_json::json!(null),
                })
                .collect();

            QueryResult::success(query.id, serde_json::json!(accounts_json))
        }
        Err(e) => {
            warn!(
                pubkeys_count = pubkeys.len(),
                error = %e,
                "Failed to get multiple accounts"
            );
            QueryResult::failure(query.id, format!("RPC error: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::enums::RpcMethod;

    #[test]
    fn test_empty_pubkeys() {
        let client = Arc::new(RpcClient::new("http://localhost:8899".to_string()));
        let query = Query::with_params(
            "test-1".to_string(),
            RpcMethod::GetMultipleAccounts,
            serde_json::json!([]),
        );

        let result = execute_get_multiple_accounts(client, query);
        assert!(!result.success);
        assert!(result.error.unwrap().contains("Empty pubkeys"));
    }

    #[test]
    fn test_invalid_pubkey_in_array() {
        let client = Arc::new(RpcClient::new("http://localhost:8899".to_string()));
        let query = Query::with_params(
            "test-1".to_string(),
            RpcMethod::GetMultipleAccounts,
            serde_json::json!(["invalid-pubkey", "also-invalid"]),
        );

        let result = execute_get_multiple_accounts(client, query);
        assert!(!result.success);
        assert!(result.error.unwrap().contains("Invalid pubkey"));
    }
}
