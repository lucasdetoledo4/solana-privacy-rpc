//! RPC method enum

use serde::{Deserialize, Serialize};

/// Supported RPC methods for privacy batching
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum RpcMethod {
    /// Get account balance in lamports
    GetBalance,
    /// Get account information
    GetAccountInfo,
    /// Get transaction by signature
    GetTransaction,
    /// Get SPL token account balance
    GetTokenAccountBalance,
    /// Get current block height
    GetBlockHeight,
    /// Get multiple accounts in one query
    GetMultipleAccounts,
}

impl RpcMethod {
    /// Convert method to Solana RPC method name string
    pub fn as_str(&self) -> &'static str {
        match self {
            RpcMethod::GetBalance => "getBalance",
            RpcMethod::GetAccountInfo => "getAccountInfo",
            RpcMethod::GetTransaction => "getTransaction",
            RpcMethod::GetTokenAccountBalance => "getTokenAccountBalance",
            RpcMethod::GetBlockHeight => "getBlockHeight",
            RpcMethod::GetMultipleAccounts => "getMultipleAccounts",
        }
    }

    /// Get all supported RPC methods
    pub fn all() -> &'static [RpcMethod] {
        &[
            RpcMethod::GetBalance,
            RpcMethod::GetAccountInfo,
            RpcMethod::GetTransaction,
            RpcMethod::GetTokenAccountBalance,
            RpcMethod::GetBlockHeight,
            RpcMethod::GetMultipleAccounts,
        ]
    }

    /// Check if a string is a valid RPC method name
    pub fn from_str(s: &str) -> Option<RpcMethod> {
        match s {
            "getBalance" => Some(RpcMethod::GetBalance),
            "getAccountInfo" => Some(RpcMethod::GetAccountInfo),
            "getTransaction" => Some(RpcMethod::GetTransaction),
            "getTokenAccountBalance" => Some(RpcMethod::GetTokenAccountBalance),
            "getBlockHeight" => Some(RpcMethod::GetBlockHeight),
            "getMultipleAccounts" => Some(RpcMethod::GetMultipleAccounts),
            _ => None,
        }
    }
}

impl std::fmt::Display for RpcMethod {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rpc_method_as_str() {
        assert_eq!(RpcMethod::GetAccountInfo.as_str(), "getAccountInfo");
        assert_eq!(RpcMethod::GetBalance.as_str(), "getBalance");
    }

    #[test]
    fn test_rpc_method_from_str() {
        assert_eq!(RpcMethod::from_str("getBalance"), Some(RpcMethod::GetBalance));
        assert_eq!(RpcMethod::from_str("getAccountInfo"), Some(RpcMethod::GetAccountInfo));
        assert_eq!(RpcMethod::from_str("invalid"), None);
    }

    #[test]
    fn test_rpc_method_all() {
        let methods = RpcMethod::all();
        assert_eq!(methods.len(), 6);
        assert!(methods.contains(&RpcMethod::GetBalance));
        assert!(methods.contains(&RpcMethod::GetAccountInfo));
        assert!(methods.contains(&RpcMethod::GetTransaction));
        assert!(methods.contains(&RpcMethod::GetTokenAccountBalance));
        assert!(methods.contains(&RpcMethod::GetBlockHeight));
        assert!(methods.contains(&RpcMethod::GetMultipleAccounts));
    }

    #[test]
    fn test_rpc_method_display() {
        assert_eq!(format!("{}", RpcMethod::GetBalance), "getBalance");
    }

    #[test]
    fn test_rpc_method_serialization() {
        let method = RpcMethod::GetBalance;
        let json = serde_json::to_string(&method).unwrap();
        assert_eq!(json, "\"getBalance\"");

        let parsed: RpcMethod = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, method);
    }
}
