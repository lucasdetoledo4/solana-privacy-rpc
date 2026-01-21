//! HTTP server setup and routing
//!
//! This module configures the Axum web server with all routes and middleware.

use crate::coordinator::BatchPoller;
use crate::executor::BatchExecutor;
use crate::handlers::{execute_batch, health_check, AppState};
use crate::types::ProxyConfig;
use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

const DEFAULT_POLL_INTERVAL_MS: u64 = 5000;

/// Start the HTTP server
pub async fn run(config: ProxyConfig) -> Result<(), Box<dyn std::error::Error>> {
    let state = Arc::new(AppState {
        executor: BatchExecutor::new(&config.rpc_url),
    });

    // Start batch poller if enabled
    if config.enable_poller {
        let poll_interval = config.poll_interval_ms.unwrap_or(DEFAULT_POLL_INTERVAL_MS);
        let poller = BatchPoller::new(&config.rpc_url, poll_interval);
        let _handle = poller.start();
        info!(interval_ms = poll_interval, "Batch poller started");
    }

    // Configure CORS for development
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router with routes
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/execute-batch", post(execute_batch))
        .layer(cors)
        .with_state(state);

    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    info!(address = %addr, "Server listening");

    axum::serve(listener, app).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    // Integration tests would go here, testing the full HTTP flow
    // These require a running RPC endpoint, so they're typically run separately
}
