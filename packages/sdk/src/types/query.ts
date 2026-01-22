/**
 * Query types for the Privacy RPC SDK
 */

import { Commitment } from "@solana/web3.js";
import { RpcMethod } from "../enums";

/**
 * A single query to be batched
 */
export interface Query {
    /** Unique identifier for this query */
    id: string;

    /** The RPC method to execute */
    method: RpcMethod;

    /** Base58-encoded public key to query (for balance/account methods) */
    pubkey?: string;

    /** Generic params for methods that need different inputs */
    params?: string | string[];

    /** Optional commitment level */
    commitment?: Commitment;
}

/**
 * Internal query with promise resolution
 */
export interface PendingQuery extends Query {
    /** Resolve function for the query promise */
    resolve: (value: unknown) => void;

    /** Reject function for the query promise */
    reject: (error: Error) => void;
}

/**
 * Create a query object
 */
export function createQuery(
    id: string,
    method: RpcMethod,
    pubkey: string,
    commitment?: Commitment
): Query {
    return {
        id,
        method,
        pubkey,
        commitment,
    };
}
