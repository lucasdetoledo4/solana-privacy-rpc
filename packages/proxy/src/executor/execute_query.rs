//! Single query execution

use crate::enums::RpcMethod;
use crate::executor::{
    execute_get_account_info, execute_get_balance, execute_get_block_height,
    execute_get_multiple_accounts, execute_get_token_account_balance, execute_get_transaction,
};
use crate::types::{Query, QueryResult};
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;
use std::sync::Arc;
use tracing::debug;

/// Execute a single query against the RPC
///
/// This function is designed to be run in a Tokio blocking task for parallel execution.
pub fn execute_single_query(client: Arc<RpcClient>, query: Query) -> QueryResult {
    let query_id = query.id.clone();

    debug!(
        query_id = %query_id,
        method = %query.method,
        "Executing query"
    );

    // Execute the appropriate RPC method
    match query.method {
        RpcMethod::GetBalance => {
            // Legacy path - parse pubkey
            let pubkey_str = match query.pubkey.as_ref() {
                Some(pk) => pk,
                None => {
                    return QueryResult::failure(query_id, "Missing pubkey parameter".to_string())
                }
            };
            let pubkey = match Pubkey::from_str(pubkey_str) {
                Ok(pk) => pk,
                Err(e) => {
                    return QueryResult::failure(
                        query_id,
                        format!("Invalid pubkey '{}': {}", pubkey_str, e),
                    );
                }
            };
            execute_get_balance(&client, &query_id, &pubkey)
        }
        RpcMethod::GetAccountInfo => {
            // Legacy path - parse pubkey
            let pubkey_str = match query.pubkey.as_ref() {
                Some(pk) => pk,
                None => {
                    return QueryResult::failure(query_id, "Missing pubkey parameter".to_string())
                }
            };
            let pubkey = match Pubkey::from_str(pubkey_str) {
                Ok(pk) => pk,
                Err(e) => {
                    return QueryResult::failure(
                        query_id,
                        format!("Invalid pubkey '{}': {}", pubkey_str, e),
                    );
                }
            };
            execute_get_account_info(&client, &query_id, &pubkey)
        }
        RpcMethod::GetTransaction => execute_get_transaction(client, query),
        RpcMethod::GetTokenAccountBalance => execute_get_token_account_balance(client, query),
        RpcMethod::GetBlockHeight => execute_get_block_height(client, query),
        RpcMethod::GetMultipleAccounts => execute_get_multiple_accounts(client, query),
    }
}

#[cfg(test)]
mod tests {
    // Tests require a running RPC endpoint
}
