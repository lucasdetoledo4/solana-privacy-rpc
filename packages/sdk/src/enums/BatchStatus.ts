/**
 * Status of a batch execution
 */
export enum BatchStatus {
    /** Batch is waiting for more queries */
    Pending = "pending",
    /** Batch is currently being executed */
    Executing = "executing",
    /** Batch execution completed successfully */
    Completed = "completed",
    /** Batch execution failed */
    Failed = "failed",
    /** Batch was cancelled */
    Cancelled = "cancelled",
}

/**
 * Check if a batch status indicates completion (success or failure)
 */
export function isTerminalStatus(status: BatchStatus): boolean {
    return (
        status === BatchStatus.Completed ||
        status === BatchStatus.Failed ||
        status === BatchStatus.Cancelled
    );
}
