use serde::{Deserialize, Serialize};

/// Status of a batch execution
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BatchStatus {
    /// Batch is waiting for more queries
    Pending,
    /// Batch is currently being executed
    Executing,
    /// Batch execution completed successfully
    Completed,
    /// Batch execution failed
    Failed,
    /// Batch was cancelled
    Cancelled,
}

impl BatchStatus {
    /// Check if this status indicates completion (success or failure)
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            BatchStatus::Completed | BatchStatus::Failed | BatchStatus::Cancelled
        )
    }

    /// Check if batch is currently being processed
    pub fn is_active(&self) -> bool {
        matches!(self, BatchStatus::Pending | BatchStatus::Executing)
    }
}

impl std::fmt::Display for BatchStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BatchStatus::Pending => write!(f, "pending"),
            BatchStatus::Executing => write!(f, "executing"),
            BatchStatus::Completed => write!(f, "completed"),
            BatchStatus::Failed => write!(f, "failed"),
            BatchStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_status_is_terminal() {
        assert!(!BatchStatus::Pending.is_terminal());
        assert!(!BatchStatus::Executing.is_terminal());
        assert!(BatchStatus::Completed.is_terminal());
        assert!(BatchStatus::Failed.is_terminal());
        assert!(BatchStatus::Cancelled.is_terminal());
    }

    #[test]
    fn test_batch_status_is_active() {
        assert!(BatchStatus::Pending.is_active());
        assert!(BatchStatus::Executing.is_active());
        assert!(!BatchStatus::Completed.is_active());
        assert!(!BatchStatus::Failed.is_active());
        assert!(!BatchStatus::Cancelled.is_active());
    }

    #[test]
    fn test_batch_status_display() {
        assert_eq!(format!("{}", BatchStatus::Pending), "pending");
        assert_eq!(format!("{}", BatchStatus::Executing), "executing");
    }

    #[test]
    fn test_batch_status_serialization() {
        let status = BatchStatus::Completed;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"completed\"");

        let parsed: BatchStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, status);
    }
}
