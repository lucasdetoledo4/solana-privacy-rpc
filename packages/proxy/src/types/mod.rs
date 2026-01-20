//! Type definitions for the Privacy RPC Proxy
//!
//! Each type is defined in its own file for modularity.

mod batch_request;
mod batch_response;
mod config;
mod health_response;
mod query;
mod query_result;

pub use batch_request::BatchRequest;
pub use batch_response::BatchResponse;
pub use config::{ProxyConfig, DEFAULT_K_ANONYMITY, DEFAULT_PORT, MAX_BATCH_SIZE};
pub use health_response::HealthResponse;
pub use query::Query;
pub use query_result::QueryResult;
