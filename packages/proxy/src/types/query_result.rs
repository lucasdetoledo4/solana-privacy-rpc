//! Query result type

use serde::{Deserialize, Serialize};

/// Result of a single query execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    /// The query ID this result corresponds to
    pub id: String,

    /// Whether the query succeeded
    pub success: bool,

    /// The result data (if successful)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,

    /// Error message (if failed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl QueryResult {
    /// Create a successful result
    pub fn success(id: String, data: serde_json::Value) -> Self {
        Self {
            id,
            success: true,
            data: Some(data),
            error: None,
        }
    }

    /// Create a failed result
    pub fn failure(id: String, error: String) -> Self {
        Self {
            id,
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_query_result_success() {
        let result = QueryResult::success("id1".to_string(), serde_json::json!({"lamports": 100}));

        assert!(result.success);
        assert!(result.data.is_some());
        assert!(result.error.is_none());
        assert_eq!(result.id, "id1");
    }

    #[test]
    fn test_query_result_failure() {
        let result = QueryResult::failure("id1".to_string(), "Error message".to_string());

        assert!(!result.success);
        assert!(result.data.is_none());
        assert_eq!(result.error, Some("Error message".to_string()));
    }

    #[test]
    fn test_query_result_serialization() {
        let result = QueryResult::success("test".to_string(), serde_json::json!({"value": 42}));
        let json = serde_json::to_string(&result).unwrap();

        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"id\":\"test\""));
        assert!(!json.contains("\"error\"")); // Should be skipped when None
    }
}
