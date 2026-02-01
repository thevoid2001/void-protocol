# Void Protocol - Session State (Feb 1, 2026)

## What We Just Built

### Void Feed - NEW FEATURE
A privacy-first RSS reader with on-chain vouching.

**Live at:** https://thevoidprotocol.netlify.app/feed

**Features Working:**
- Search topics (crypto, tech, news, etc.) and see articles instantly
- 199 RSS feeds across 12 categories
- Add sources to personal feed
- Vouch for articles (on-chain, wallet required)
- Vouch counts displayed on articles
- OPML import/export
- Local storage (no accounts, no tracking)

**Pages:**
- `/feed` - Discover (search & browse)
- `/feed/my` - Personal subscribed feed
- `/feed/sources` - Manage sources & topics
- `/feed/saved` - Saved articles

### Smart Contract Updates
- Added `vouch` and `unvouch` instructions
- Added `WalletProfile` and `Follow` accounts (PENDING DEPLOY - need more devnet SOL)

### Files Created for Void Feed
- `app/src/pages/Feed.tsx` - Personal feed
- `app/src/pages/FeedDiscover.tsx` - Search/discover
- `app/src/pages/FeedSources.tsx` - Manage sources
- `app/src/pages/FeedSaved.tsx` - Saved articles
- `app/src/components/VouchButton.tsx` - Vouch button with counts
- `app/src/utils/feedStorage.ts` - Local storage management
- `app/src/utils/useFeedData.ts` - React hook for feed data
- `app/src/data/feedIndex.json` - 199 RSS feeds index
- `app/netlify/functions/search.ts` - Search feeds
- `app/netlify/functions/detect.ts` - Auto-detect RSS from URL
- `app/netlify/functions/fetch.ts` - Proxy RSS fetches
- `app/netlify/functions/vouches.ts` - Get vouch counts

## Current State

### Deployed Infrastructure
- **Solana Program:** Devnet `9wPskrpZiLSb3He3QoLZMEeiBKWJUh7ykGtkb2N7HX9H`
- **Frontend:** Netlify at thevoidprotocol.netlify.app
- **GitHub:** thevoid2001/void-protocol

### Pending Deploy
The follow wallet feature is built in the contract but not deployed yet (need ~0.12 more devnet SOL). Instructions ready:
- `create_profile` - Opt-in to social features
- `update_profile` - Toggle visibility/followers
- `follow` / `unfollow` - Follow other wallets

### Wallet/Keys
- Devnet wallet: `~/.config/solana/id.json`
- Balance: ~2.46 SOL on devnet (need ~2.58 for deploy)
- Upgrade authority: `1nFRvQF3iXtx1WHvEr5RCpR6wrgNVXCVYoWYrPwKVXL`

## Product Suite Status

| Feature | Status | Description |
|---------|--------|-------------|
| Void Stamp | ✅ Live | Proof of existence (hash files on-chain) |
| Void Drop | ✅ Live | Anonymous encrypted document submission |
| Void Burn | ✅ Live | Wallet-to-wallet encrypted messaging |
| Void Feed | ✅ Live | Private RSS reader with vouching |
| Void Switch | ❌ Not started | Dead man's switch (planned) |

## Void Feed Roadmap

### Completed
- [x] Feed index (199 sources)
- [x] Search and browse topics
- [x] Add sources to personal feed
- [x] Vouch for articles (on-chain)
- [x] Vouch counts display
- [x] OPML import/export

### In Progress (code ready, pending deploy)
- [ ] Follow wallets
- [ ] Wallet profiles (opt-in visibility)
- [ ] "Vouched by people I follow" filter

### Planned
- [ ] Tip authors (send SOL)
- [ ] Article annotations
- [ ] Reading stats (local)
- [ ] Keyboard navigation

## To Resume

1. Get more devnet SOL (wait for faucet reset or use web faucet)
2. Deploy updated contract: `anchor deploy --provider.cluster devnet`
3. Build follow wallet UI components
4. Add tip authors feature

## Anonymous Git Config
```
git config user.name  # Should show: void
git config user.email # Should show: thevoid2001@proton.me
```
