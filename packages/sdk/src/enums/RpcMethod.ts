/**
 * Supported RPC methods for privacy batching
 */
export enum RpcMethod {
    GetBalance = 'getBalance',
    GetAccountInfo = 'getAccountInfo',
}

/**
 * Get all supported RPC method values
 */
export function getSupportedMethods(): RpcMethod[] {
    return Object.values(RpcMethod);
}

/**
 * Check if a string is a valid RPC method
 */
export function isValidRpcMethod(method: string): method is RpcMethod {
    return Object.values(RpcMethod).includes(method as RpcMethod);
}
