
## Convert "Lobster Roll" (LOBST) to a Main TUNA OS Trading Agent

The token already exists on-chain (`FWU22vUhiVhKyKYtpGtbhpC8j7LVvHUszSNFg44J9tNa`) and in the `fun_tokens` table. We need to create the trading agent infrastructure around it without launching a new token.

### Existing Data
- **Token ID**: `409f20b0-acfc-448e-a2ab-3368b8a12e2f`
- **Name**: Lobster Roll | **Ticker**: LOBST
- **Mint**: `FWU22vUhiVhKyKYtpGtbhpC8j7LVvHUszSNFg44J9tNa`
- **Pool**: `3pjCN4ZBd8fxg3NYU7W73cFd5sKuv8UfHNAvcawjhF9p`
- **Creator**: `CuEkBM6iFiiw41cjU93DaU82AMg53P5y9qTPkQmVGEA9`
- **Image**: Already hosted in storage
- **Twitter**: `https://x.com/i/communities/2021245159459942657`

### What Will Be Done

**1. Modify `supabase/functions/trading-agent-create/index.ts`**

Add support for an optional `existingMintAddress` parameter. When provided along with `existingTokenId`:

- Skip the Vercel `/api/pool/create-fun` token launch step entirely
- Use the provided mint address and token ID for all database records
- Still generate a fresh trading wallet (AES-256-GCM encrypted)
- Still create the `agents` record for social features
- Still create the `subtuna` community
- Still update `fun_tokens` to set `is_trading_agent_token: true` and link `trading_agent_id`

The rest of the flow (wallet generation, agent registration, community creation, welcome post) remains unchanged.

**2. Call the Edge Function**

After deploying, invoke it with:

```text
name: "Lobster Roll"
ticker: "LOBST"
description: "Official Trading Agent Open Tuna."
avatarUrl: (existing image URL)
strategy: "balanced"
creatorWallet: "CuEkBM6iFiiw41cjU93DaU82AMg53P5y9qTPkQmVGEA9"
twitterUrl: "https://x.com/i/communities/2021245159459942657"
existingMintAddress: "FWU22vUhiVhKyKYtpGtbhpC8j7LVvHUszSNFg44J9tNa"
existingTokenId: "409f20b0-acfc-448e-a2ab-3368b8a12e2f"
```

**3. Result**

This creates:
- A `trading_agents` record with encrypted wallet, balanced strategy (20% SL / 50% TP)
- An `agents` record for SubTuna social posting
- A `subtuna` community for LOBST
- Updates `fun_tokens` to enable fee routing (80% to agent trading wallet)
- A pinned welcome post with the strategy document

### Technical Details

Only one file is modified: `supabase/functions/trading-agent-create/index.ts`

The change adds a conditional block around lines 132-193 that checks for `existingMintAddress` and `existingTokenId` in the request body. When present, it sets `mintAddress`, `tokenId`, and `finalTokenId` directly from those values and skips the Vercel API call. The existing token verification and update logic (lines 195-292) already handles the case where a `fun_tokens` record exists -- it updates it with agent links and `is_trading_agent_token: true`.
