//! Batch request type

use serde::{Deserialize, Serialize};
use super::Query;

/// Request to execute a batch of queries
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchRequest {
    /// The queries to execute
    pub queries: Vec<Query>,

    /// SHA-256 hash of the batch for verification
    #[serde(default)]
    pub batch_hash: Option<String>,

    /// On-chain batch ID (for coordinated batches)
    #[serde(default)]
    pub batch_id: Option<String>,
}

impl BatchRequest {
    /// Create a new batch request
    pub fn new(queries: Vec<Query>) -> Self {
        Self {
            queries,
            batch_hash: None,
            batch_id: None,
        }
    }

    /// Set the batch hash
    pub fn with_hash(mut self, hash: String) -> Self {
        self.batch_hash = Some(hash);
        self
    }

    /// Get the number of queries in this batch
    pub fn len(&self) -> usize {
        self.queries.len()
    }

    /// Check if the batch is empty
    pub fn is_empty(&self) -> bool {
        self.queries.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::enums::RpcMethod;

    #[test]
    fn test_batch_request_new() {
        let queries = vec![Query::new(
            "1".to_string(),
            RpcMethod::GetBalance,
            "pubkey".to_string(),
        )];

        let request = BatchRequest::new(queries);
        assert_eq!(request.len(), 1);
        assert!(!request.is_empty());
        assert!(request.batch_hash.is_none());
    }

    #[test]
    fn test_batch_request_with_hash() {
        let request = BatchRequest::new(vec![]).with_hash("abc123".to_string());
        assert_eq!(request.batch_hash, Some("abc123".to_string()));
    }

    #[test]
    fn test_batch_request_empty() {
        let request = BatchRequest::new(vec![]);
        assert!(request.is_empty());
        assert_eq!(request.len(), 0);
    }
}
