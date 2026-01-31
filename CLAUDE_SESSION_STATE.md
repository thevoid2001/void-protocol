# Void Protocol - Session State (Jan 31, 2026)

## What We Just Completed

### Void Burn Feature - FULLY DEPLOYED
- **Smart contract:** Updated and deployed to devnet
- **Program ID:** `9wPskrpZiLSb3He3QoLZMEeiBKWJUh7ykGtkb2N7HX9H`
- **Frontend:** Pushed to GitHub, auto-deploying to Netlify
- **Live URL:** https://thevoidprotocol.netlify.app/burn

### Void Burn Functionality
1. **activate_inbox** - User signs message → derives ECDH keypair → stores public key on-chain
2. **send_direct_message** - Encrypt message with recipient's public key → upload to Arweave → store reference on-chain
3. **burn_message** - Recipient can mark messages as burned

### Files Created/Modified for Void Burn
- `programs/void-protocol/src/lib.rs` - Added Inbox, DirectMessage accounts + 3 instructions
- `app/src/utils/encryption.ts` - Added `deriveEncryptionKeyPair()`, `VOID_BURN_SIGN_MESSAGE`
- `app/src/pages/Burn.tsx` - Landing page with activate inbox
- `app/src/pages/BurnSend.tsx` - Send encrypted messages
- `app/src/pages/BurnInbox.tsx` - View/decrypt/burn messages
- `app/src/App.tsx` - Added routes for /burn, /burn/send, /burn/inbox
- `app/src/components/NavBar.tsx` - Added Burn link
- `app/src/pages/Home.tsx` - Updated Void Burn card (no longer "coming soon")

## Current State

### Deployed Infrastructure
- **Solana Program:** Devnet, updated with Void Burn
- **Frontend:** Netlify at thevoidprotocol.netlify.app
- **GitHub:** thevoid2001/void-protocol (anonymous account)
- **Arweave:** Using Irys for uploads

### Wallet/Keys
- Devnet wallet: `~/.config/solana/id.json`
- Balance: ~2.64 SOL on devnet
- Upgrade authority: `1nFRvQF3iXtx1WHvEr5RCpR6wrgNVXCVYoWYrPwKVXL`

### Anchor Config
- `Anchor.toml` cluster set to `devnet`
- Build command: `anchor build` (needs PATH set first)
- Deploy command: `anchor deploy --provider.cluster devnet`

### PATH Setup (needed for builds)
```bash
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
```

## Product Suite Status

| Feature | Status | Description |
|---------|--------|-------------|
| Void Stamp | ✅ Live | Proof of existence (hash files on-chain) |
| Void Drop | ✅ Live | Anonymous encrypted document submission to orgs |
| Void Burn | ✅ Live | Wallet-to-wallet encrypted messaging |
| Void Switch | ❌ Not started | Dead man's switch (planned) |

## Previous Decisions Made

1. **Stay on devnet** - Free, good for demos. Mainnet when users need permanence.
2. **Anonymous identity** - GitHub: thevoid2001, Email: thevoid2001@proton.me
3. **Signature-derived keys for Void Burn** - No extra keys to manage
4. **One-way messaging for Void Drop** - Not bidirectional (better for whistleblower privacy)
5. **Optional burn** - Messages don't auto-destruct, recipient chooses

## IDL Note
The on-chain IDL upload failed (buffer too small for new larger IDL). This is non-blocking - the frontend has types compiled in and works fine. Can fix later by creating a new IDL account if needed.

## To Test Void Burn
1. Go to https://thevoidprotocol.netlify.app/burn
2. Connect wallet
3. Click "Activate Inbox" (sign the message)
4. Have another wallet send you a message at /burn/send
5. View messages at /burn/inbox (sign to unlock, then decrypt)

## Next Steps (When You Return)
- Test Void Burn end-to-end
- Fix any bugs found
- Consider: Void Switch (dead man's switch)
- Consider: Tweet thread launch (best time: Tue/Wed 9am EST)
