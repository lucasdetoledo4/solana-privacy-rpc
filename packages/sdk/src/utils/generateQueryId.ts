/**
 * Query ID generation utility
 *
 * Generates unique identifiers for queries using UUID v4.
 */

import { v4 as uuidv4 } from "uuid";

/**
 * Generate a unique ID for a query
 *
 * @returns A random UUID v4 string
 */
export function generateQueryId(): string {
    return uuidv4();
}
