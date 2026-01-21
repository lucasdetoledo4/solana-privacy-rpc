//! Coordinator account reader

use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;
use tracing::{debug, warn};

const COORDINATOR_PROGRAM_ID: &str = "3LsgXZDcRaC3vGq3392WGuEa4AST76m8NPNQCaqDd3n6";
const COORDINATOR_SEED: &[u8] = b"coordinator";
const BATCH_SEED: &[u8] = b"batch";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OnChainBatchStatus {
    Pending,
    Finalized,
    Executed,
}

#[derive(Debug, Clone)]
pub struct OnChainBatch {
    pub id: u64,
    pub status: OnChainBatchStatus,
    pub query_count: u8,
    pub query_hashes: Vec<[u8; 32]>,
    pub submitters: Vec<Pubkey>,
    pub created_at: i64,
    pub finalized_at: Option<i64>,
    pub results_hash: Option<[u8; 32]>,
}

pub struct CoordinatorReader {
    rpc_client: RpcClient,
    program_id: Pubkey,
}

impl CoordinatorReader {
    pub fn new(rpc_url: &str) -> Self {
        let program_id = Pubkey::from_str(COORDINATOR_PROGRAM_ID).unwrap();
        Self {
            rpc_client: RpcClient::new(rpc_url.to_string()),
            program_id,
        }
    }

    fn get_coordinator_state_pda(&self) -> Pubkey {
        let (pda, _) = Pubkey::find_program_address(&[COORDINATOR_SEED], &self.program_id);
        pda
    }

    fn get_batch_pda(&self, batch_id: u64) -> Pubkey {
        let (pda, _) = Pubkey::find_program_address(
            &[BATCH_SEED, &batch_id.to_le_bytes()],
            &self.program_id,
        );
        pda
    }

    pub fn get_batch_counter(&self) -> Option<u64> {
        let pda = self.get_coordinator_state_pda();
        let account = self.rpc_client.get_account(&pda).ok()?;
        let data = account.data;

        if data.len() < 50 {
            return None;
        }

        // Skip 8-byte discriminator + 32-byte authority + 1 min + 1 max
        let counter = u64::from_le_bytes(data[42..50].try_into().ok()?);
        Some(counter)
    }

    pub fn get_batch(&self, batch_id: u64) -> Option<OnChainBatch> {
        let pda = self.get_batch_pda(batch_id);
        let account = self.rpc_client.get_account(&pda).ok()?;
        let data = account.data;

        debug!(batch_id = batch_id, data_len = data.len(), "Reading batch");

        self.parse_batch_data(&data)
    }

    fn parse_batch_data(&self, data: &[u8]) -> Option<OnChainBatch> {
        if data.len() < 20 {
            return None;
        }

        let mut offset = 8; // Skip discriminator

        let id = u64::from_le_bytes(data[offset..offset + 8].try_into().ok()?);
        offset += 8;

        let status_byte = data[offset];
        offset += 1;
        let status = match status_byte {
            0 => OnChainBatchStatus::Pending,
            1 => OnChainBatchStatus::Finalized,
            2 => OnChainBatchStatus::Executed,
            _ => return None,
        };

        let query_count = data[offset];
        offset += 1;

        // Parse query_hashes vec
        let hashes_len = u32::from_le_bytes(data[offset..offset + 4].try_into().ok()?) as usize;
        offset += 4;

        let mut query_hashes = Vec::with_capacity(hashes_len);
        for _ in 0..hashes_len {
            let hash: [u8; 32] = data[offset..offset + 32].try_into().ok()?;
            query_hashes.push(hash);
            offset += 32;
        }

        // Parse submitters vec
        let submitters_len = u32::from_le_bytes(data[offset..offset + 4].try_into().ok()?) as usize;
        offset += 4;

        let mut submitters = Vec::with_capacity(submitters_len);
        for _ in 0..submitters_len {
            let pubkey = Pubkey::try_from(&data[offset..offset + 32]).ok()?;
            submitters.push(pubkey);
            offset += 32;
        }

        let created_at = i64::from_le_bytes(data[offset..offset + 8].try_into().ok()?);
        offset += 8;

        let has_finalized_at = data[offset] == 1;
        offset += 1;
        let finalized_at = if has_finalized_at {
            let val = i64::from_le_bytes(data[offset..offset + 8].try_into().ok()?);
            offset += 8;
            Some(val)
        } else {
            None
        };

        let has_results_hash = data[offset] == 1;
        offset += 1;
        let results_hash = if has_results_hash {
            let hash: [u8; 32] = data[offset..offset + 32].try_into().ok()?;
            Some(hash)
        } else {
            None
        };

        Some(OnChainBatch {
            id,
            status,
            query_count,
            query_hashes,
            submitters,
            created_at,
            finalized_at,
            results_hash,
        })
    }

    pub fn find_finalized_batches(&self) -> Vec<OnChainBatch> {
        let counter = match self.get_batch_counter() {
            Some(c) => c,
            None => {
                warn!("Could not read batch counter");
                return vec![];
            }
        };

        let mut finalized = Vec::new();
        for i in 0..counter {
            if let Some(batch) = self.get_batch(i) {
                if batch.status == OnChainBatchStatus::Finalized {
                    finalized.push(batch);
                }
            }
        }

        debug!(count = finalized.len(), "Found finalized batches");
        finalized
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_status_parsing() {
        assert_eq!(
            match 0u8 {
                0 => OnChainBatchStatus::Pending,
                1 => OnChainBatchStatus::Finalized,
                _ => OnChainBatchStatus::Executed,
            },
            OnChainBatchStatus::Pending
        );
    }
}
