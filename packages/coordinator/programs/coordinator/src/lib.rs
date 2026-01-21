use anchor_lang::prelude::*;

pub mod errors;
pub mod state;

use errors::CoordinatorError;
use state::*;

declare_id!("3LsgXZDcRaC3vGq3392WGuEa4AST76m8NPNQCaqDd3n6");

#[program]
pub mod coordinator {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        min_batch_size: u8,
        max_batch_size: u8,
    ) -> Result<()> {
        require!(
            min_batch_size > 0 && min_batch_size <= max_batch_size,
            CoordinatorError::InvalidBatchSize
        );

        let state = &mut ctx.accounts.coordinator_state;
        state.authority = ctx.accounts.authority.key();
        state.min_batch_size = min_batch_size;
        state.max_batch_size = max_batch_size;
        state.batch_counter = 0;
        state.bump = ctx.bumps.coordinator_state;

        msg!("Coordinator initialized with k={}", min_batch_size);
        Ok(())
    }

    pub fn create_batch(ctx: Context<CreateBatch>) -> Result<()> {
        let state = &mut ctx.accounts.coordinator_state;
        let batch = &mut ctx.accounts.batch;
        let clock = Clock::get()?;

        batch.id = state.batch_counter;
        batch.status = BatchStatus::Pending;
        batch.query_count = 0;
        batch.query_hashes = Vec::new();
        batch.submitters = Vec::new();
        batch.created_at = clock.unix_timestamp;
        batch.finalized_at = None;
        batch.results_hash = None;
        batch.bump = ctx.bumps.batch;

        state.batch_counter += 1;

        msg!("Batch {} created", batch.id);
        Ok(())
    }

    pub fn submit_query(
        ctx: Context<SubmitQuery>,
        _batch_id: u64,
        query_hash: [u8; 32],
    ) -> Result<()> {
        let state = &ctx.accounts.coordinator_state;
        let batch = &mut ctx.accounts.batch;

        require!(
            batch.status == BatchStatus::Pending,
            CoordinatorError::BatchNotPending
        );
        require!(
            !batch.is_full(state.max_batch_size),
            CoordinatorError::BatchFull
        );
        require!(
            !batch.query_hashes.contains(&query_hash),
            CoordinatorError::DuplicateQuery
        );

        batch.query_hashes.push(query_hash);
        batch.submitters.push(ctx.accounts.submitter.key());
        batch.query_count += 1;

        msg!(
            "Query submitted to batch {}, count: {}",
            batch.id,
            batch.query_count
        );
        Ok(())
    }

    pub fn finalize_batch(ctx: Context<FinalizeBatch>, _batch_id: u64) -> Result<()> {
        let state = &ctx.accounts.coordinator_state;
        let batch = &mut ctx.accounts.batch;
        let clock = Clock::get()?;

        require!(
            batch.can_finalize(state.min_batch_size),
            CoordinatorError::InsufficientQueries
        );

        batch.status = BatchStatus::Finalized;
        batch.finalized_at = Some(clock.unix_timestamp);

        msg!(
            "Batch {} finalized with {} queries",
            batch.id,
            batch.query_count
        );
        Ok(())
    }

    pub fn complete_batch(
        ctx: Context<CompleteBatch>,
        _batch_id: u64,
        results_hash: [u8; 32],
    ) -> Result<()> {
        let batch = &mut ctx.accounts.batch;

        require!(
            batch.status == BatchStatus::Finalized,
            CoordinatorError::BatchNotFinalized
        );

        batch.status = BatchStatus::Executed;
        batch.results_hash = Some(results_hash);

        msg!("Batch {} executed", batch.id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = CoordinatorState::SIZE,
        seeds = [CoordinatorState::SEED],
        bump
    )]
    pub coordinator_state: Account<'info, CoordinatorState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateBatch<'info> {
    #[account(
        mut,
        seeds = [CoordinatorState::SEED],
        bump = coordinator_state.bump
    )]
    pub coordinator_state: Account<'info, CoordinatorState>,
    #[account(
        init,
        payer = payer,
        space = Batch::size(Batch::MAX_QUERIES),
        seeds = [Batch::SEED, &coordinator_state.batch_counter.to_le_bytes()],
        bump
    )]
    pub batch: Account<'info, Batch>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(batch_id: u64)]
pub struct SubmitQuery<'info> {
    #[account(
        seeds = [CoordinatorState::SEED],
        bump = coordinator_state.bump
    )]
    pub coordinator_state: Account<'info, CoordinatorState>,
    #[account(
        mut,
        seeds = [Batch::SEED, &batch_id.to_le_bytes()],
        bump = batch.bump
    )]
    pub batch: Account<'info, Batch>,
    pub submitter: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(batch_id: u64)]
pub struct FinalizeBatch<'info> {
    #[account(
        seeds = [CoordinatorState::SEED],
        bump = coordinator_state.bump
    )]
    pub coordinator_state: Account<'info, CoordinatorState>,
    #[account(
        mut,
        seeds = [Batch::SEED, &batch_id.to_le_bytes()],
        bump = batch.bump
    )]
    pub batch: Account<'info, Batch>,
}

#[derive(Accounts)]
#[instruction(batch_id: u64)]
pub struct CompleteBatch<'info> {
    #[account(
        seeds = [CoordinatorState::SEED],
        bump = coordinator_state.bump
    )]
    pub coordinator_state: Account<'info, CoordinatorState>,
    #[account(
        mut,
        seeds = [Batch::SEED, &batch_id.to_le_bytes()],
        bump = batch.bump
    )]
    pub batch: Account<'info, Batch>,
    #[account(
        constraint = executor.key() == coordinator_state.authority @ CoordinatorError::Unauthorized
    )]
    pub executor: Signer<'info>,
}
