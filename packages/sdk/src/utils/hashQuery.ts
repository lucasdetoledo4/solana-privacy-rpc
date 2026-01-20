/**
 * Single query hashing utility
 *
 * Creates deterministic SHA-256 hashes of queries for identification.
 */

import { createHash } from "crypto";
import { Query } from "../types";

/**
 * Hash a single query for identification
 *
 * Creates a deterministic SHA-256 hash of the query parameters.
 * This allows verification without exposing the actual query details.
 *
 * @param query - The query to hash
 * @returns SHA-256 hash as hex string
 */
export function hashQuery(query: Query): string {
    const data = JSON.stringify({
        method: query.method,
        pubkey: query.pubkey,
        commitment: query.commitment,
    });

    return createHash("sha256").update(data).digest("hex");
}
