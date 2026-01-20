//! GetBalance RPC method executor

use crate::types::QueryResult;
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use tracing::{debug, warn};

/// Execute getBalance RPC method
pub fn execute_get_balance(client: &RpcClient, query_id: &str, pubkey: &Pubkey) -> QueryResult {
    match client.get_balance(pubkey) {
        Ok(balance) => {
            debug!(query_id = %query_id, balance = balance, "getBalance succeeded");
            QueryResult::success(query_id.to_string(), serde_json::json!({ "lamports": balance }))
        }
        Err(e) => {
            warn!(query_id = %query_id, error = %e, "getBalance failed");
            QueryResult::failure(query_id.to_string(), e.to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    // Tests require a running RPC endpoint
}
