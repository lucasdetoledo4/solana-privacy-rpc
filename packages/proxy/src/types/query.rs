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

    /// Base58-encoded public key to query
    pub pubkey: String,

    /// Optional commitment level (defaults to "confirmed")
    #[serde(default)]
    pub commitment: Option<String>,
}

impl Query {
    /// Create a new query
    pub fn new(id: String, method: RpcMethod, pubkey: String) -> Self {
        Self {
            id,
            method,
            pubkey,
            commitment: None,
        }
    }

    /// Set the commitment level
    pub fn with_commitment(mut self, commitment: String) -> Self {
        self.commitment = Some(commitment);
        self
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
