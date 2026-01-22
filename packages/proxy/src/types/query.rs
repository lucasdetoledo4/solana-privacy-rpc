//! Query types

use serde::{Deserialize, Serialize};
use crate::enums::RpcMethod;

/// A single query in a batch request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Query {
    /// Unique identifier for this query (for result mapping)
    pub id: String,

    /// The RPC method to execute
    pub method: RpcMethod,

    /// Base58-encoded public key to query (for balance/account methods)
    #[serde(default)]
    pub pubkey: Option<String>,

    /// Generic params for methods that need different inputs
    #[serde(default)]
    pub params: Option<serde_json::Value>,

    /// Optional commitment level (defaults to "confirmed")
    #[serde(default)]
    pub commitment: Option<String>,
}

impl Query {
    /// Create a new query with pubkey parameter
    pub fn new(id: String, method: RpcMethod, pubkey: String) -> Self {
        Self {
            id,
            method,
            pubkey: Some(pubkey),
            params: None,
            commitment: None,
        }
    }

    /// Create a new query with generic params
    pub fn with_params(id: String, method: RpcMethod, params: serde_json::Value) -> Self {
        Self {
            id,
            method,
            pubkey: None,
            params: Some(params),
            commitment: None,
        }
    }

    /// Set the commitment level
    pub fn with_commitment(mut self, commitment: String) -> Self {
        self.commitment = Some(commitment);
        self
    }

    /// Get the primary parameter (pubkey or first param)
    pub fn get_primary_param(&self) -> Option<String> {
        if let Some(ref pubkey) = self.pubkey {
            return Some(pubkey.clone());
        }
        if let Some(ref params) = self.params {
            if let Some(s) = params.as_str() {
                return Some(s.to_string());
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_new() {
        let query = Query::new(
            "test-1".to_string(),
            RpcMethod::GetBalance,
            "11111111111111111111111111111111".to_string(),
        );

        assert_eq!(query.id, "test-1");
        assert_eq!(query.method, RpcMethod::GetBalance);
        assert_eq!(query.pubkey, "11111111111111111111111111111111");
        assert!(query.commitment.is_none());
    }

    #[test]
    fn test_query_with_commitment() {
        let query = Query::new(
            "test-1".to_string(),
            RpcMethod::GetBalance,
            "11111111111111111111111111111111".to_string(),
        )
        .with_commitment("finalized".to_string());

        assert_eq!(query.commitment, Some("finalized".to_string()));
    }

    #[test]
    fn test_query_serialization() {
        let query = Query::new(
            "test-1".to_string(),
            RpcMethod::GetBalance,
            "11111111111111111111111111111111".to_string(),
        );

        let json = serde_json::to_string(&query).unwrap();
        assert!(json.contains("\"method\":\"getBalance\""));
        assert!(json.contains("\"id\":\"test-1\""));

        let parsed: Query = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, query.id);
        assert_eq!(parsed.method, query.method);
    }
}
