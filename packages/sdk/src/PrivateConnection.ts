/**
 * PrivateConnection - Privacy-preserving Solana RPC client
 *
 * A drop-in replacement for @solana/web3.js Connection that routes
 * queries through a privacy proxy for k-anonymity.
 */

import { AccountInfo, Commitment, Connection, ConnectionConfig, PublicKey } from "@solana/web3.js";
import { BatchManager } from "./BatchManager";
import { RpcMethod } from "./enums";
import { AccountInfoResult, BalanceResult, PrivacyConfig } from "./types";

/**
 * Privacy-preserving Solana connection
 *
 * Extends the standard Connection to provide privacy-preserving
 * RPC queries through k-anonymity batching.
 *
 * @example
 * ```typescript
 * const connection = new PrivateConnection(
 *   'https://api.mainnet-beta.solana.com',
 *   { proxyEndpoint: 'http://localhost:3000' }
 * );
 *
 * // This query will be batched with others for privacy
 * const balance = await connection.getBalance(publicKey);
 * ```
 */
export class PrivateConnection extends Connection {
    private readonly batchManager: BatchManager;
    private readonly privacyConfig: PrivacyConfig;

    /**
     * Create a new PrivateConnection
     *
     * @param endpoint - Solana RPC endpoint (used for non-private queries)
     * @param privacyConfig - Privacy proxy configuration
     * @param commitmentOrConfig - Optional commitment level or connection config
     */
    constructor(
        endpoint: string,
        privacyConfig: PrivacyConfig,
        commitmentOrConfig?: Commitment | ConnectionConfig
    ) {
        super(endpoint, commitmentOrConfig);

        if (!privacyConfig.proxyEndpoint) {
            throw new Error("PrivacyConfig.proxyEndpoint is required");
        }

        this.privacyConfig = privacyConfig;
        this.batchManager = new BatchManager(privacyConfig);
    }

    /**
     * Get account balance with privacy protection
     *
     * The query is batched with other queries before execution,
     * providing k-anonymity for the request.
     *
     * @param publicKey - Public key of the account to query
     * @param commitmentOrConfig - Optional commitment level
     * @returns Balance in lamports
     */
    async getBalance(publicKey: PublicKey, commitmentOrConfig?: Commitment): Promise<number> {
        const result = await this.batchManager.addQuery<BalanceResult>(
            RpcMethod.GetBalance,
            publicKey.toBase58(),
            commitmentOrConfig
        );

        return result.lamports;
    }

    /**
     * Get account info with privacy protection
     *
     * The query is batched with other queries before execution,
     * providing k-anonymity for the request.
     *
     * @param publicKey - Public key of the account to query
     * @param commitmentOrConfig - Optional commitment level
     * @returns Account info or null if account doesn't exist
     */
    async getAccountInfo(
        publicKey: PublicKey,
        commitmentOrConfig?: Commitment
    ): Promise<AccountInfo<Buffer> | null> {
        const result = await this.batchManager.addQuery<AccountInfoResult | null>(
            RpcMethod.GetAccountInfo,
            publicKey.toBase58(),
            commitmentOrConfig
        );

        if (!result) {
            return null;
        }

        // Convert the proxy response to the expected AccountInfo format
        return {
            lamports: result.lamports,
            owner: new PublicKey(result.owner),
            executable: result.executable,
            rentEpoch: result.rentEpoch,
            data: Buffer.alloc(result.dataLength), // Note: actual data not returned for privacy
        };
    }

    /**
     * Get balance using direct RPC (no privacy)
     *
     * Use this when privacy is not needed and you want faster execution.
     *
     * @param publicKey - Public key of the account to query
     * @param commitmentOrConfig - Optional commitment level
     * @returns Balance in lamports
     */
    async getBalanceDirect(publicKey: PublicKey, commitmentOrConfig?: Commitment): Promise<number> {
        return super.getBalance(publicKey, commitmentOrConfig);
    }

    /**
     * Get account info using direct RPC (no privacy)
     *
     * Use this when privacy is not needed and you want faster execution.
     *
     * @param publicKey - Public key of the account to query
     * @param commitmentOrConfig - Optional commitment level
     * @returns Account info or null if account doesn't exist
     */
    async getAccountInfoDirect(
        publicKey: PublicKey,
        commitmentOrConfig?: Commitment
    ): Promise<AccountInfo<Buffer> | null> {
        return super.getAccountInfo(publicKey, commitmentOrConfig);
    }

    /**
     * Force execution of any pending queries
     *
     * Useful when you need immediate results without waiting
     * for the batch to fill or timeout.
     */
    async flush(): Promise<void> {
        await this.batchManager.flush();
    }

    /**
     * Get transaction by signature with privacy protection
     *
     * @param signature - Transaction signature
     * @param commitmentOrConfig - Optional commitment level
     * @returns Transaction data or null if not found
     */
    async getTransactionPrivate(signature: string, commitmentOrConfig?: Commitment): Promise<any> {
        const result = await this.batchManager.addQuery<any>(
            RpcMethod.GetTransaction,
            signature,
            commitmentOrConfig
        );

        return result;
    }

    /**
     * Get transaction using direct RPC (no privacy)
     *
     * @param signature - Transaction signature
     * @param config - Optional configuration
     * @returns Transaction data or null if not found
     */
    getTransactionDirect(signature: string, config?: any): Promise<any> {
        return super.getTransaction(signature, config);
    }

    /**
     * Get SPL token account balance with privacy protection
     *
     * @param publicKey - Token account public key
     * @param commitmentOrConfig - Optional commitment level
     * @returns Token balance information
     */
    async getTokenAccountBalance(publicKey: PublicKey, commitmentOrConfig?: Commitment): Promise<any> {
        const result = await this.batchManager.addQuery<any>(
            RpcMethod.GetTokenAccountBalance,
            publicKey.toBase58(),
            commitmentOrConfig
        );

        return result;
    }

    /**
     * Get current block height with privacy protection
     *
     * @param commitmentOrConfig - Optional commitment level
     * @returns Current block height
     */
    async getBlockHeightPrivate(commitmentOrConfig?: Commitment): Promise<number> {
        const result = await this.batchManager.addQuery<number>(
            RpcMethod.GetBlockHeight,
            "", // No parameter needed for block height
            commitmentOrConfig
        );

        return result;
    }

    /**
     * Get block height using direct RPC (no privacy)
     *
     * Note: Use the inherited getBlockHeight property from Connection class for direct access
     */

    /**
     * Get multiple accounts with privacy protection (efficient batch query)
     *
     * @param publicKeys - Array of public keys to query
     * @param commitmentOrConfig - Optional commitment level
     * @returns Array of account info (null for non-existent accounts)
     */
    async getMultipleAccounts(
        publicKeys: PublicKey[],
        commitmentOrConfig?: Commitment
    ): Promise<(AccountInfo<Buffer> | null)[]> {
        // Note: This method batches multiple accounts into a single query
        // For privacy, this is more efficient than separate queries
        const pubkeyStrings = publicKeys.map(pk => pk.toBase58());

        const result = await this.batchManager.addQuery<any[]>(
            RpcMethod.GetMultipleAccounts,
            JSON.stringify(pubkeyStrings), // Pass as JSON string
            commitmentOrConfig
        );

        // Convert results to AccountInfo format
        return result.map(account => {
            if (!account) return null;

            return {
                lamports: account.lamports,
                owner: new PublicKey(account.owner),
                executable: account.executable,
                rentEpoch: account.rentEpoch,
                data: Buffer.alloc(account.dataLength || 0),
            };
        });
    }

    /**
     * Get the number of queries waiting to be batched
     */
    get pendingQueryCount(): number {
        return this.batchManager.pendingCount;
    }

    /**
     * Get the privacy configuration
     */
    getPrivacyConfig(): PrivacyConfig {
        return { ...this.privacyConfig };
    }

    /**
     * Clean up resources
     *
     * Should be called when the connection is no longer needed.
     */
    destroy(): void {
        this.batchManager.destroy();
    }
}
