/**
 * Batch hash verification utility
 *
 * Verifies that a batch of queries matches an expected hash.
 */

import { Query } from "../types";
import { hashBatch } from "./hashBatch";

/**
 * Verify that a batch matches its expected hash
 *
 * @param queries - The queries to verify
 * @param expectedHash - The expected batch hash
 * @returns True if the batch matches the expected hash
 */
export function verifyBatchHash(queries: Query[], expectedHash: string): boolean {
    const actualHash = hashBatch(queries);
    return actualHash === expectedHash;
}
