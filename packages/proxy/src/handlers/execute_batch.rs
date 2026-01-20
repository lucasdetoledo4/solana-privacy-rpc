//! Execute batch handler

use crate::error::ProxyResult;
use crate::handlers::AppState;
use crate::types::{BatchRequest, BatchResponse};
use axum::{extract::State, Json};
use std::sync::Arc;

/// Execute a batch of queries
///
/// Receives a batch of queries and executes them in parallel against the RPC.
pub async fn execute_batch(
    State(state): State<Arc<AppState>>,
    Json(request): Json<BatchRequest>,
) -> ProxyResult<Json<BatchResponse>> {
    let response = state.executor.execute_batch(request).await?;
    Ok(Json(response))
}

#[cfg(test)]
mod tests {
    // Integration tests would go here, testing the full HTTP flow
    // These require a running RPC endpoint, so they're typically run separately
}
