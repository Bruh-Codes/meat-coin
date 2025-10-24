use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, SetAuthority, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;
use spl_token::instruction::AuthorityType;

declare_id!("92vGubKf8dDMF99AnQ4eLbaByujKBSyCAQ6WwDgt7P6k");

#[program]
pub mod meat_coin {
    use super::*;

    /// Initialize program state, create treasury, and set mint authority to PDA
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let state_key = ctx.accounts.state.key();
        
        let state = &mut ctx.accounts.state;
        state.admin = ctx.accounts.admin.key();
        state.minted = 0;
        state.redeemed = 0;
        state.treasury = ctx.accounts.treasury.key();
        state.bump = ctx.bumps.state;
        
        // Transfer mint authority from admin to state PDA
        let cpi_accounts = SetAuthority {
            current_authority: ctx.accounts.admin.to_account_info(),
            account_or_mint: ctx.accounts.mint.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        
        token::set_authority(
            CpiContext::new(cpi_program, cpi_accounts),
            AuthorityType::MintTokens,
            Some(state_key),
        )?;

        msg!("Initialized MeatCoin. Admin: {}, Treasury: {}", state.admin, state.treasury);
        Ok(())
    }

    /// Mint SPL tokens to recipient. Only admin can call.
    pub fn mint(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;

        require!(
            ctx.accounts.admin.key() == state.admin,
            CustomError::Unauthorized
        );

        require!(amount > 0, CustomError::InvalidAmount);

        let seeds = &[b"state".as_ref(), &[state.bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.recipient.to_account_info(),
            authority: state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();

        token::mint_to(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, signer),
            amount,
        )?;

        state.minted = state
            .minted
            .checked_add(amount)
            .ok_or(CustomError::Overflow)?;

        msg!(
            "Admin {} minted {} tokens to {}",
            ctx.accounts.admin.key(),
            amount,
            ctx.accounts.recipient.key()
        );

        Ok(())
    }

    /// Redeem tokens from user to treasury
    pub fn redeem(ctx: Context<RedeemTokens>, amount: u64) -> Result<()> {
        let state = &mut ctx.accounts.state;

        require!(amount > 0, CustomError::InvalidAmount);

        require!(
            ctx.accounts.treasury.key() == state.treasury,
            CustomError::InvalidTreasury
        );

        require!(
            ctx.accounts.from.owner == ctx.accounts.user.key(),
            CustomError::InvalidTokenAccount
        );

        let cpi_accounts = Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

        state.redeemed = state
            .redeemed
            .checked_add(amount)
            .ok_or(CustomError::Overflow)?;

        let record = &mut ctx.accounts.redemption_record;
        record.user = ctx.accounts.user.key();
        record.amount = record
            .amount
            .checked_add(amount)
            .ok_or(CustomError::Overflow)?;
        record.timestamp = Clock::get()?.unix_timestamp;
        record.redemption_count = record
            .redemption_count
            .checked_add(1)
            .ok_or(CustomError::Overflow)?;

        msg!(
            "User {} redeemed {} tokens (total: {}, count: {})",
            record.user,
            amount,
            record.amount,
            record.redemption_count
        );

        Ok(())
    }

    /// Change admin - only current admin can call
    pub fn change_admin(ctx: Context<ChangeAdmin>, new_admin: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.state;
        
        require!(
            ctx.accounts.current_admin.key() == state.admin,
            CustomError::Unauthorized
        );
        
        let old_admin = state.admin;
        state.admin = new_admin;
        
        msg!("Admin changed from {} to {}", old_admin, new_admin);
        Ok(())
    }

    /// Close redemption record and return rent to user
    pub fn close_redemption_record(ctx: Context<CloseRedemptionRecord>) -> Result<()> {
        msg!("Closed redemption record for user {}", ctx.accounts.user.key());
        Ok(())
    }
}

#[account]
pub struct State {
    pub admin: Pubkey,      // 32
    pub minted: u64,        // 8
    pub redeemed: u64,      // 8
    pub treasury: Pubkey,   // 32
    pub bump: u8,           // 1
}

#[account]
pub struct RedemptionRecord {
    pub user: Pubkey,           // 32
    pub amount: u64,            // 8 - cumulative amount
    pub timestamp: i64,         // 8 - last redemption
    pub redemption_count: u64,  // 8 - number of redemptions
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 8 + 8 + 32 + 1,
        seeds = [b"state"],
        bump
    )]
    pub state: Account<'info, State>,

    /// Mint that admin currently has authority over
    #[account(mut)]
    pub mint: Account<'info, Mint>,

    /// Treasury token account - created as ATA for the state PDA
    #[account(
        init,
        payer = admin,
        associated_token::mint = mint,
        associated_token::authority = state,
    )]
    pub treasury: Account<'info, TokenAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump
    )]
    pub state: Account<'info, State>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub recipient: Account<'info, TokenAccount>,

    pub admin: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RedeemTokens<'info> {
    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump
    )]
    pub state: Account<'info, State>,

    #[account(mut)]
    pub from: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 8 + 8 + 8,
        seeds = [b"redemption", user.key().as_ref()],
        bump
    )]
    pub redemption_record: Account<'info, RedemptionRecord>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ChangeAdmin<'info> {
    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump
    )]
    pub state: Account<'info, State>,

    pub current_admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseRedemptionRecord<'info> {
    #[account(
        mut,
        close = user,
        seeds = [b"redemption", user.key().as_ref()],
        bump
    )]
    pub redemption_record: Account<'info, RedemptionRecord>,

    #[account(mut)]
    pub user: Signer<'info>,
}

#[error_code]
pub enum CustomError {
    #[msg("Unauthorized: only admin may perform this action")]
    Unauthorized,
    #[msg("Integer overflow")]
    Overflow,
    #[msg("Invalid treasury account")]
    InvalidTreasury,
    #[msg("Invalid token account ownership")]
    InvalidTokenAccount,
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
}