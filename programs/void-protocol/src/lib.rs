use anchor_lang::prelude::*;

declare_id!("9wPskrpZiLSb3He3QoLZMEeiBKWJUh7ykGtkb2N7HX9H");

// Max string lengths for organization fields
const MAX_NAME_LEN: usize = 64;
const MAX_DESC_LEN: usize = 256;
const MAX_SLUG_LEN: usize = 32;
const MAX_ARWEAVE_HASH_LEN: usize = 64;

#[program]
pub mod void_protocol {
    use super::*;

    // ─── VOID STAMP ─────────────────────────────────────────────

    /// Store a SHA-256 hash on-chain as proof that a file existed at this moment.
    /// The hash is used as a PDA seed, so each hash can only be registered once.
    pub fn create_proof(ctx: Context<CreateProof>, hash: [u8; 32]) -> Result<()> {
        let proof = &mut ctx.accounts.proof;
        proof.hash = hash;
        proof.owner = ctx.accounts.owner.key();
        proof.timestamp = Clock::get()?.unix_timestamp;
        proof.bump = ctx.bumps.proof;
        Ok(())
    }

    // ─── VOID DROP ──────────────────────────────────────────────

    /// Create a new organization drop box.
    /// The org admin provides a name, description, URL slug, and their ECDH public
    /// key. Anyone can encrypt messages to this public key, but only the admin
    /// (who holds the private key) can decrypt them.
    pub fn create_organization(
        ctx: Context<CreateOrganization>,
        slug: String,
        name: String,
        description: String,
        encryption_key: [u8; 65],
    ) -> Result<()> {
        require!(slug.len() <= MAX_SLUG_LEN, VoidError::SlugTooLong);
        require!(name.len() <= MAX_NAME_LEN, VoidError::NameTooLong);
        require!(description.len() <= MAX_DESC_LEN, VoidError::DescriptionTooLong);
        require!(!slug.is_empty(), VoidError::SlugEmpty);

        let org = &mut ctx.accounts.organization;
        org.slug = slug;
        org.name = name;
        org.description = description;
        org.encryption_key = encryption_key;
        org.admin = ctx.accounts.admin.key();
        org.submission_count = 0;
        org.created_at = Clock::get()?.unix_timestamp;
        org.active = true;
        org.bump = ctx.bumps.organization;
        Ok(())
    }

    /// Submit an encrypted tip to an organization.
    /// The arweave_hash points to the encrypted payload stored on Arweave.
    /// The submitter can be a throwaway wallet or our backend wallet (for anonymous subs).
    pub fn submit_tip(
        ctx: Context<SubmitTip>,
        arweave_hash: String,
    ) -> Result<()> {
        require!(arweave_hash.len() <= MAX_ARWEAVE_HASH_LEN, VoidError::ArweaveHashTooLong);

        let org = &mut ctx.accounts.organization;
        require!(org.active, VoidError::OrgInactive);

        let submission_id = org.submission_count;
        org.submission_count += 1;

        let sub = &mut ctx.accounts.submission;
        sub.id = submission_id;
        sub.organization = org.key();
        sub.arweave_hash = arweave_hash;
        sub.submitter = ctx.accounts.submitter.key();
        sub.timestamp = Clock::get()?.unix_timestamp;
        sub.bump = ctx.bumps.submission;
        Ok(())
    }

    /// Deactivate an organization (admin only). Prevents new submissions.
    pub fn deactivate_organization(ctx: Context<DeactivateOrganization>) -> Result<()> {
        ctx.accounts.organization.active = false;
        Ok(())
    }
}

// ─── ERRORS ─────────────────────────────────────────────────────

#[error_code]
pub enum VoidError {
    #[msg("Organization slug too long (max 32 chars)")]
    SlugTooLong,
    #[msg("Organization name too long (max 64 chars)")]
    NameTooLong,
    #[msg("Organization description too long (max 256 chars)")]
    DescriptionTooLong,
    #[msg("Slug cannot be empty")]
    SlugEmpty,
    #[msg("Arweave hash too long (max 64 chars)")]
    ArweaveHashTooLong,
    #[msg("Organization is inactive")]
    OrgInactive,
}

// ─── VOID STAMP ACCOUNTS ────────────────────────────────────────

/// Account that stores a single proof of existence.
/// Size: 8 (discriminator) + 32 (hash) + 32 (owner pubkey) + 8 (timestamp) + 1 (bump) = 81 bytes
#[account]
pub struct Proof {
    pub hash: [u8; 32],
    pub owner: Pubkey,
    pub timestamp: i64,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(hash: [u8; 32])]
pub struct CreateProof<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 32 + 8 + 1,
        seeds = [b"proof", hash.as_ref()],
        bump
    )]
    pub proof: Account<'info, Proof>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ─── VOID DROP ACCOUNTS ─────────────────────────────────────────

/// Organization drop box. Stores the org's public encryption key so anyone
/// can encrypt messages to it.
/// Size: 8 + (4+32) + (4+64) + (4+256) + 65 + 32 + 8 + 8 + 1 + 1 = 487 bytes
#[account]
pub struct Organization {
    /// URL slug (e.g. "washington-post")
    pub slug: String,
    /// Display name
    pub name: String,
    /// What kind of tips they accept
    pub description: String,
    /// ECDH P-256 uncompressed public key (65 bytes: 0x04 + 32 x + 32 y)
    pub encryption_key: [u8; 65],
    /// Wallet that controls this org
    pub admin: Pubkey,
    /// How many submissions received
    pub submission_count: u64,
    /// When the org was created
    pub created_at: i64,
    /// Whether org is accepting submissions
    pub active: bool,
    /// PDA bump
    pub bump: u8,
}

/// A submission reference. The actual encrypted content lives on Arweave;
/// this just records the pointer and metadata on-chain.
/// Size: 8 + 8 + 32 + (4+64) + 32 + 8 + 1 = 157 bytes
#[account]
pub struct Submission {
    /// Sequential ID within the org
    pub id: u64,
    /// The organization this was submitted to
    pub organization: Pubkey,
    /// Arweave transaction hash where encrypted content is stored
    pub arweave_hash: String,
    /// Who submitted (can be throwaway wallet)
    pub submitter: Pubkey,
    /// When submitted
    pub timestamp: i64,
    /// PDA bump
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(slug: String)]
pub struct CreateOrganization<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + (4 + MAX_SLUG_LEN) + (4 + MAX_NAME_LEN) + (4 + MAX_DESC_LEN) + 65 + 32 + 8 + 8 + 1 + 1,
        seeds = [b"org", slug.as_bytes()],
        bump
    )]
    pub organization: Account<'info, Organization>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitTip<'info> {
    #[account(
        init,
        payer = submitter,
        space = 8 + 8 + 32 + (4 + MAX_ARWEAVE_HASH_LEN) + 32 + 8 + 1,
        seeds = [b"submission", organization.key().as_ref(), &organization.submission_count.to_le_bytes()],
        bump
    )]
    pub submission: Account<'info, Submission>,

    #[account(mut)]
    pub organization: Account<'info, Organization>,

    #[account(mut)]
    pub submitter: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeactivateOrganization<'info> {
    #[account(
        mut,
        has_one = admin,
    )]
    pub organization: Account<'info, Organization>,

    pub admin: Signer<'info>,
}
