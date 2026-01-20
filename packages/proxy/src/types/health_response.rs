//! Health check response type

use serde::{Deserialize, Serialize};

/// Health check response
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    /// Service status
    pub status: String,

    /// Service version
    pub version: String,

    /// Whether the RPC connection is healthy
    pub rpc_healthy: bool,
}

impl HealthResponse {
    /// Status string for healthy service
    pub const STATUS_HEALTHY: &'static str = "healthy";
    /// Status string for degraded service
    pub const STATUS_DEGRADED: &'static str = "degraded";

    /// Create a health response
    pub fn new(rpc_healthy: bool) -> Self {
        Self {
            status: if rpc_healthy {
                Self::STATUS_HEALTHY.to_string()
            } else {
                Self::STATUS_DEGRADED.to_string()
            },
            version: env!("CARGO_PKG_VERSION").to_string(),
            rpc_healthy,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_response_healthy() {
        let response = HealthResponse::new(true);

        assert_eq!(response.status, "healthy");
        assert!(response.rpc_healthy);
        assert!(!response.version.is_empty());
    }

    #[test]
    fn test_health_response_degraded() {
        let response = HealthResponse::new(false);

        assert_eq!(response.status, "degraded");
        assert!(!response.rpc_healthy);
    }

    #[test]
    fn test_health_response_constants() {
        assert_eq!(HealthResponse::STATUS_HEALTHY, "healthy");
        assert_eq!(HealthResponse::STATUS_DEGRADED, "degraded");
    }
}
