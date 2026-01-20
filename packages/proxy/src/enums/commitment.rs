//! Commitment level enum

use serde::{Deserialize, Serialize};

/// Solana commitment levels
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum CommitmentLevel {
    /// Query the most recent block which has reached 1 confirmation by a supermajority
    #[default]
    Confirmed,
    /// Query the most recent block which has been finalized by a supermajority
    Processed,
    /// Query the most recent block which has reached 1 confirmation
    Finalized,
}

/// Default commitment level for queries
pub const DEFAULT_COMMITMENT: CommitmentLevel = CommitmentLevel::Confirmed;

impl CommitmentLevel {
    /// Convert to string representation
    pub fn as_str(&self) -> &'static str {
        match self {
            CommitmentLevel::Processed => "processed",
            CommitmentLevel::Confirmed => "confirmed",
            CommitmentLevel::Finalized => "finalized",
        }
    }

    /// Parse from string
    pub fn from_str(s: &str) -> Option<CommitmentLevel> {
        match s {
            "processed" => Some(CommitmentLevel::Processed),
            "confirmed" => Some(CommitmentLevel::Confirmed),
            "finalized" => Some(CommitmentLevel::Finalized),
            _ => None,
        }
    }
}

impl std::fmt::Display for CommitmentLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_commitment_level_as_str() {
        assert_eq!(CommitmentLevel::Processed.as_str(), "processed");
        assert_eq!(CommitmentLevel::Confirmed.as_str(), "confirmed");
        assert_eq!(CommitmentLevel::Finalized.as_str(), "finalized");
    }

    #[test]
    fn test_commitment_level_from_str() {
        assert_eq!(
            CommitmentLevel::from_str("processed"),
            Some(CommitmentLevel::Processed)
        );
        assert_eq!(
            CommitmentLevel::from_str("confirmed"),
            Some(CommitmentLevel::Confirmed)
        );
        assert_eq!(
            CommitmentLevel::from_str("finalized"),
            Some(CommitmentLevel::Finalized)
        );
        assert_eq!(CommitmentLevel::from_str("invalid"), None);
    }

    #[test]
    fn test_commitment_level_default() {
        let default = CommitmentLevel::default();
        assert_eq!(default, CommitmentLevel::Confirmed);
        assert_eq!(DEFAULT_COMMITMENT, CommitmentLevel::Confirmed);
    }

    #[test]
    fn test_commitment_level_serialization() {
        let level = CommitmentLevel::Finalized;
        let json = serde_json::to_string(&level).unwrap();
        assert_eq!(json, "\"finalized\"");

        let parsed: CommitmentLevel = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, level);
    }
}
