//! Batch response type

use serde::{Deserialize, Serialize};
use super::QueryResult;

/// Response from batch execution
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchResponse {
    /// Whether the batch execution succeeded overall
    pub success: bool,

    /// Individual query results
    pub results: Vec<QueryResult>,

    /// Total execution time in milliseconds
    pub execution_time_ms: u64,

    /// Number of queries that succeeded
    pub succeeded_count: usize,

    /// Number of queries that failed
    pub failed_count: usize,

    /// Hash of the results batch
    pub batch_hash: String,
}

impl BatchResponse {
    /// Create a new batch response from results
    pub fn from_results(results: Vec<QueryResult>, execution_time_ms: u64) -> Self {
        use sha2::{Digest, Sha256};

        let succeeded_count = results.iter().filter(|r| r.success).count();
        let failed_count = results.len() - succeeded_count;

        // Compute hash of results
        let mut hasher = Sha256::new();
        for result in &results {
            hasher.update(result.id.as_bytes());
            hasher.update(if result.success { b"1" } else { b"0" });
            if let Some(data) = &result.data {
                hasher.update(data.to_string().as_bytes());
            }
        }
        let batch_hash = hex::encode(hasher.finalize());

        Self {
            success: failed_count == 0,
            results,
            execution_time_ms,
            succeeded_count,
            failed_count,
            batch_hash,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_response_all_success() {
        let results = vec![
            QueryResult::success("1".to_string(), serde_json::json!({})),
            QueryResult::success("2".to_string(), serde_json::json!({})),
        ];

        let response = BatchResponse::from_results(results, 50);

        assert!(response.success);
        assert_eq!(response.succeeded_count, 2);
        assert_eq!(response.failed_count, 0);
        assert_eq!(response.execution_time_ms, 50);
        assert!(!response.batch_hash.is_empty());
    }

    #[test]
    fn test_batch_response_partial_failure() {
        let results = vec![
            QueryResult::success("1".to_string(), serde_json::json!({})),
            QueryResult::failure("2".to_string(), "error".to_string()),
        ];

        let response = BatchResponse::from_results(results, 100);

        assert!(!response.success);
        assert_eq!(response.succeeded_count, 1);
        assert_eq!(response.failed_count, 1);
        assert!(!response.batch_hash.is_empty());
    }

    #[test]
    fn test_batch_response_empty() {
        let response = BatchResponse::from_results(vec![], 0);

        assert!(response.success);
        assert_eq!(response.succeeded_count, 0);
        assert_eq!(response.failed_count, 0);
        assert!(!response.batch_hash.is_empty());
    }
}
