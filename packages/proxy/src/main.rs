//! Privacy RPC Proxy - Entry Point
//!
//! This is the main entry point for the privacy-preserving RPC proxy.
//! It initializes logging, loads configuration, and starts the HTTP server.

mod coordinator;
mod enums;
mod error;
mod executor;
mod handlers;
mod server;
mod types;

use std::env;
use tracing::info;
use types::{ProxyConfig, DEFAULT_PORT};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing subscriber for logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("privacy_rpc_proxy=debug".parse()?)
                .add_directive("tower_http=debug".parse()?),
        )
        .init();

    // Load configuration from environment
    let rpc_url = env::var("QUICKNODE_RPC_URL")
        .expect("QUICKNODE_RPC_URL environment variable must be set");

    let port: u16 = env::var("PORT")
        .unwrap_or_else(|_| DEFAULT_PORT.to_string())
        .parse()
        .expect("PORT must be a valid number");

    let enable_poller = env::var("ENABLE_POLLER")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);

    let poll_interval_ms: u64 = env::var("POLL_INTERVAL_MS")
        .unwrap_or_else(|_| "5000".to_string())
        .parse()
        .unwrap_or(5000);

    let mut config = ProxyConfig::new(rpc_url.clone()).with_port(port);
    if enable_poller {
        config = config.with_poller(poll_interval_ms);
    }

    // Log startup info (without exposing full RPC URL credentials)
    let sanitized_url = sanitize_rpc_url(&rpc_url);
    info!(rpc_endpoint = %sanitized_url, port = port, "Starting Privacy RPC Proxy");

    // Start the server
    server::run(config).await?;

    Ok(())
}

/// Sanitize RPC URL for logging (hide API keys)
fn sanitize_rpc_url(url: &str) -> String {
    if let Some(idx) = url.find("://") {
        let after_scheme = &url[idx + 3..];
        if let Some(path_idx) = after_scheme.find('/') {
            let host = &after_scheme[..path_idx];
            return format!("{}://{}/***", &url[..idx], host);
        }
    }
    url.to_string()
}
