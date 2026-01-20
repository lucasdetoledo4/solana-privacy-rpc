/**
 * Configuration types for the Privacy RPC SDK
 */

/** Default batch size for k-anonymity */
export const DEFAULT_BATCH_SIZE = 10;

/** Default max wait time in milliseconds */
export const DEFAULT_MAX_WAIT_TIME = 5000;

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT = 30000;

/**
 * Configuration for the PrivateConnection
 */
export interface PrivacyConfig {
    /** URL of the privacy proxy server */
    proxyEndpoint: string;

    /** Minimum batch size for k-anonymity (default: 10) */
    batchSize?: number;

    /** Maximum time to wait for batch to fill in milliseconds (default: 5000) */
    maxWaitTime?: number;

    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;
}

/**
 * Resolved configuration with all defaults applied
 */
export interface ResolvedPrivacyConfig {
    proxyEndpoint: string;
    batchSize: number;
    maxWaitTime: number;
    timeout: number;
}

/**
 * Resolve configuration with defaults
 */
export function resolveConfig(config: PrivacyConfig): ResolvedPrivacyConfig {
    return {
        proxyEndpoint: config.proxyEndpoint,
        batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
        maxWaitTime: config.maxWaitTime ?? DEFAULT_MAX_WAIT_TIME,
        timeout: config.timeout ?? DEFAULT_TIMEOUT,
    };
}
