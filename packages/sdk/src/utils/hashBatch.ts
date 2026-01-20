/**
 * Batch hashing utility
 *
 * Creates deterministic hashes of query batches for verification.
 */

import { createHash } from "crypto";
import { Query } from "../types";
import { hashQuery } from "./hashQuery";

/**
 * Hash a batch of queries for verification
 *
 * Creates a deterministic hash of all queries in a batch.
 * The queries are sorted by their individual hashes before combining
 * to ensure consistent results regardless of submission order.
 *
 * @param queries - The queries to hash
 * @returns SHA-256 hash of the batch as hex string
 */
export function hashBatch(queries: Query[]): string {
    // Hash each query and sort for deterministic ordering
    const queryHashes = queries.map(hashQuery).sort();

    // Combine all hashes
    const combined = queryHashes.join("|");

    return createHash("sha256").update(combined).digest("hex");
}
