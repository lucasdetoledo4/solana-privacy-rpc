//! Execute batch handler

use crate::coordinator::OnChainBatchStatus;
use crate::error::{ProxyError, ProxyResult};
use crate::handlers::AppState;
use crate::types::{BatchRequest, BatchResponse};
use axum::{extract::State, Json};
use std::sync::Arc;
use tracing::info;

/// Execute a batch of queries
///
/// Receives a batch of queries and executes them in parallel against the RPC.
/// If batch_id is provided, verifies the batch is finalized on-chain before executing.
pub async fn execute_batch(
    State(state): State<Arc<AppState>>,
    Json(request): Json<BatchRequest>,
) -> ProxyResult<Json<BatchResponse>> {
    // Verify on-chain batch status if batch_id provided
    if let Some(batch_id_str) = &request.batch_id {
        if let Some(coordinator) = &state.coordinator {
            let batch_id: u64 = batch_id_str.parse().map_err(|_| {
                ProxyError::InvalidQuery(format!("Invalid batch_id: {}", batch_id_str))
            })?;

            let batch = coordinator.get_batch(batch_id).ok_or_else(|| {
                ProxyError::InvalidQuery(format!("Batch {} not found on-chain", batch_id))
            })?;

            if batch.status != OnChainBatchStatus::Finalized {
                return Err(ProxyError::InvalidQuery(format!(
                    "Batch {} is not finalized (status: {:?})",
                    batch_id, batch.status
                )));
            }

            info!(batch_id = batch_id, "On-chain batch verified as finalized");
        }
    }

    let response = state.executor.execute_batch(request).await?;
    Ok(Json(response))
}

#[cfg(test)]
mod tests {
    // Integration tests would go here, testing the full HTTP flow
    // These require a running RPC endpoint, so they're typically run separately
}
