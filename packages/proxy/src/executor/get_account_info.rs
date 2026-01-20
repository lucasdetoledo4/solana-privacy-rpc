//! GetAccountInfo RPC method executor

use crate::types::QueryResult;
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use tracing::{debug, warn};

/// Execute getAccountInfo RPC method
pub fn execute_get_account_info(
    client: &RpcClient,
    query_id: &str,
    pubkey: &Pubkey,
) -> QueryResult {
    match client.get_account(pubkey) {
        Ok(account) => {
            debug!(
                query_id = %query_id,
                lamports = account.lamports,
                data_len = account.data.len(),
                "getAccountInfo succeeded"
            );
            QueryResult::success(
                query_id.to_string(),
                serde_json::json!({
                    "lamports": account.lamports,
                    "owner": account.owner.to_string(),
                    "executable": account.executable,
                    "rentEpoch": account.rent_epoch,
                    "dataLength": account.data.len(),
                }),
            )
        }
        Err(e) => {
            // Check if it's just an account not found error
            let error_str = e.to_string();
            if error_str.contains("AccountNotFound") {
                debug!(query_id = %query_id, "Account not found");
                QueryResult::success(query_id.to_string(), serde_json::json!(null))
            } else {
                warn!(query_id = %query_id, error = %e, "getAccountInfo failed");
                QueryResult::failure(query_id.to_string(), error_str)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    // Tests require a running RPC endpoint
}
