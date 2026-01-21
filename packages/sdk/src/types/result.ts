/**
 * RPC result types for the Privacy RPC SDK
 */

/**
 * Account info result from getAccountInfo
 */
export interface AccountInfoResult {
    /** Account balance in lamports */
    lamports: number;

    /** Owner program of the account */
    owner: string;

    /** Whether the account is executable */
    executable: boolean;

    /** Rent epoch */
    rentEpoch: number;

    /** Length of account data */
    dataLength: number;
}

/**
 * Balance result from getBalance
 */
export interface BalanceResult {
    /** Balance in lamports */
    lamports: number;
}

/**
 * Type guard for AccountInfoResult
 */
export function isAccountInfoResult(value: unknown): value is AccountInfoResult {
    if (!value || typeof value !== "object") return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.lamports === "number" &&
        typeof obj.owner === "string" &&
        typeof obj.executable === "boolean" &&
        typeof obj.rentEpoch === "number" &&
        typeof obj.dataLength === "number"
    );
}

/**
 * Type guard for BalanceResult
 */
export function isBalanceResult(value: unknown): value is BalanceResult {
    if (!value || typeof value !== "object") return false;
    const obj = value as Record<string, unknown>;
    return typeof obj.lamports === "number";
}
