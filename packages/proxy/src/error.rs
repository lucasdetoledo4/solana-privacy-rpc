//! Error types for the Privacy RPC Proxy
//!
//! Centralized error handling using thiserror.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

use crate::types::MAX_BATCH_SIZE;

/// Errors that can occur during proxy operations
#[derive(Debug, Error)]
pub enum ProxyError {
    /// Error communicating with Solana RPC
    #[error("Solana RPC error: {0}")]
    SolanaRpc(#[from] solana_client::client_error::ClientError),

    /// Invalid query parameters
    #[error("Invalid query: {0}")]
    InvalidQuery(String),

    /// Invalid public key format
    #[error("Invalid pubkey: {0}")]
    InvalidPubkey(String),

    /// Batch size exceeded
    #[error("Batch size {actual} exceeds maximum of {max}")]
    BatchTooLarge { actual: usize, max: usize },

    /// Empty batch
    #[error("Batch cannot be empty")]
    EmptyBatch,

    /// Internal server error
    #[error("Internal error: {0}")]
    Internal(String),

    /// Query execution timeout
    #[error("Query execution timed out after {0}ms")]
    Timeout(u64),
}

impl ProxyError {
    /// Create a BatchTooLarge error
    pub fn batch_too_large(actual: usize) -> Self {
        Self::BatchTooLarge {
            actual,
            max: MAX_BATCH_SIZE,
        }
    }
}

impl IntoResponse for ProxyError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            ProxyError::SolanaRpc(e) => {
                tracing::error!(error = %e, "Solana RPC error");
                (StatusCode::BAD_GATEWAY, self.to_string())
            }
            ProxyError::InvalidQuery(_) | ProxyError::InvalidPubkey(_) => {
                tracing::warn!(error = %self, "Invalid request");
                (StatusCode::BAD_REQUEST, self.to_string())
            }
            ProxyError::BatchTooLarge { .. } | ProxyError::EmptyBatch => {
                tracing::warn!(error = %self, "Invalid batch");
                (StatusCode::BAD_REQUEST, self.to_string())
            }
            ProxyError::Internal(msg) => {
                tracing::error!(error = %msg, "Internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, self.to_string())
            }
            ProxyError::Timeout(ms) => {
                tracing::warn!(timeout_ms = ms, "Query timeout");
                (StatusCode::GATEWAY_TIMEOUT, self.to_string())
            }
        };

        let body = Json(json!({
            "success": false,
            "error": error_message,
        }));

        (status, body).into_response()
    }
}

/// Result type alias for proxy operations
pub type ProxyResult<T> = Result<T, ProxyError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = ProxyError::InvalidPubkey("not-base58".to_string());
        assert_eq!(err.to_string(), "Invalid pubkey: not-base58");
    }

    #[test]
    fn test_batch_too_large_error() {
        let err = ProxyError::batch_too_large(150);
        assert!(err.to_string().contains("150"));
        assert!(err.to_string().contains(&MAX_BATCH_SIZE.to_string()));
    }

    #[test]
    fn test_empty_batch_error() {
        let err = ProxyError::EmptyBatch;
        assert_eq!(err.to_string(), "Batch cannot be empty");
    }

    #[test]
    fn test_invalid_query_error() {
        let err = ProxyError::InvalidQuery("missing field".to_string());
        assert_eq!(err.to_string(), "Invalid query: missing field");
    }
}
