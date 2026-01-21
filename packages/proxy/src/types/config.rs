//! Configuration types

/// Maximum number of queries allowed in a single batch
pub const MAX_BATCH_SIZE: usize = 100;

/// Default k-anonymity parameter (minimum queries per batch)
pub const DEFAULT_K_ANONYMITY: usize = 10;

/// Default server port
pub const DEFAULT_PORT: u16 = 3000;

/// Proxy server configuration
#[derive(Debug, Clone)]
pub struct ProxyConfig {
    /// Solana RPC endpoint URL
    pub rpc_url: String,

    /// Server port
    pub port: u16,

    /// Minimum batch size for k-anonymity
    pub k_anonymity: usize,

    /// Maximum batch size
    pub max_batch_size: usize,

    /// Enable on-chain batch poller
    pub enable_poller: bool,

    /// Poll interval in milliseconds
    pub poll_interval_ms: Option<u64>,
}

impl ProxyConfig {
    /// Create a new configuration with the given RPC URL
    pub fn new(rpc_url: String) -> Self {
        Self {
            rpc_url,
            port: DEFAULT_PORT,
            k_anonymity: DEFAULT_K_ANONYMITY,
            max_batch_size: MAX_BATCH_SIZE,
            enable_poller: false,
            poll_interval_ms: None,
        }
    }

    /// Set the server port
    pub fn with_port(mut self, port: u16) -> Self {
        self.port = port;
        self
    }

    /// Set the k-anonymity parameter
    pub fn with_k_anonymity(mut self, k: usize) -> Self {
        self.k_anonymity = k;
        self
    }

    /// Enable the on-chain batch poller
    pub fn with_poller(mut self, interval_ms: u64) -> Self {
        self.enable_poller = true;
        self.poll_interval_ms = Some(interval_ms);
        self
    }
}

impl Default for ProxyConfig {
    fn default() -> Self {
        Self {
            rpc_url: String::new(),
            port: DEFAULT_PORT,
            k_anonymity: DEFAULT_K_ANONYMITY,
            max_batch_size: MAX_BATCH_SIZE,
            enable_poller: false,
            poll_interval_ms: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proxy_config_new() {
        let config = ProxyConfig::new("http://localhost:8899".to_string());

        assert_eq!(config.rpc_url, "http://localhost:8899");
        assert_eq!(config.port, DEFAULT_PORT);
        assert_eq!(config.k_anonymity, DEFAULT_K_ANONYMITY);
        assert_eq!(config.max_batch_size, MAX_BATCH_SIZE);
    }

    #[test]
    fn test_proxy_config_builder() {
        let config = ProxyConfig::new("http://localhost:8899".to_string())
            .with_port(8080)
            .with_k_anonymity(5);

        assert_eq!(config.port, 8080);
        assert_eq!(config.k_anonymity, 5);
    }

    #[test]
    fn test_constants() {
        assert_eq!(MAX_BATCH_SIZE, 100);
        assert_eq!(DEFAULT_K_ANONYMITY, 10);
        assert_eq!(DEFAULT_PORT, 3000);
    }
}
