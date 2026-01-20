//! Enum definitions for the Privacy RPC Proxy

mod rpc_method;
mod batch_status;
mod commitment;

pub use rpc_method::RpcMethod;
pub use batch_status::BatchStatus;
pub use commitment::{CommitmentLevel, DEFAULT_COMMITMENT};
