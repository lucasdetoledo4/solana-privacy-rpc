//! Single query execution

use crate::enums::RpcMethod;
use crate::executor::{execute_get_account_info, execute_get_balance};
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
        pubkey = %query.pubkey,
        "Executing query"
    );

    // Parse the public key
    let pubkey = match Pubkey::from_str(&query.pubkey) {
        Ok(pk) => pk,
        Err(e) => {
            return QueryResult::failure(
                query_id,
                format!("Invalid pubkey '{}': {}", query.pubkey, e),
            );
        }
    };

    // Execute the appropriate RPC method
    match query.method {
        RpcMethod::GetBalance => execute_get_balance(&client, &query_id, &pubkey),
        RpcMethod::GetAccountInfo => execute_get_account_info(&client, &query_id, &pubkey),
    }
}

#[cfg(test)]
mod tests {
    // Tests require a running RPC endpoint
}
