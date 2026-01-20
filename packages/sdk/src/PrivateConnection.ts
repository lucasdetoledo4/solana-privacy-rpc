/**
 * PrivateConnection - Privacy-preserving Solana RPC client
 *
 * A drop-in replacement for @solana/web3.js Connection that routes
 * queries through a privacy proxy for k-anonymity.
 */

import {
  AccountInfo,
  Commitment,
  Connection,
  ConnectionConfig,
  PublicKey,
} from "@solana/web3.js";
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
    commitmentOrConfig?: Commitment | ConnectionConfig,
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
  async getBalance(
    publicKey: PublicKey,
    commitmentOrConfig?: Commitment,
  ): Promise<number> {
    const result = await this.batchManager.addQuery<BalanceResult>(
      RpcMethod.GetBalance,
      publicKey.toBase58(),
      commitmentOrConfig,
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
    commitmentOrConfig?: Commitment,
  ): Promise<AccountInfo<Buffer> | null> {
    const result = await this.batchManager.addQuery<AccountInfoResult | null>(
      RpcMethod.GetAccountInfo,
      publicKey.toBase58(),
      commitmentOrConfig,
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
  async getBalanceDirect(
    publicKey: PublicKey,
    commitmentOrConfig?: Commitment,
  ): Promise<number> {
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
    commitmentOrConfig?: Commitment,
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
