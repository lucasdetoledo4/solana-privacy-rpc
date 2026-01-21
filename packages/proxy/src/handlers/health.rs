//! Health check handler

use crate::coordinator::CoordinatorReader;
use crate::executor::BatchExecutor;
use crate::types::HealthResponse;
use axum::{extract::State, Json};
use std::sync::Arc;

/// Shared application state
pub struct AppState {
    pub executor: BatchExecutor,
    pub coordinator: Option<CoordinatorReader>,
}

/// Health check endpoint
///
/// Returns service status and RPC connectivity.
pub async fn health_check(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    let rpc_healthy = state.executor.check_health().await;
    Json(HealthResponse::new(rpc_healthy))
}

#[cfg(test)]
mod tests {
    // Integration tests would go here, testing the full HTTP flow
    // These require a running RPC endpoint, so they're typically run separately
}
