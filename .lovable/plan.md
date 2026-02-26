

# Fully Separate Punch Mode Deployer, Fees & Token Isolation

## Problem
Currently, Punch Mode (`/punch-test`) shares the same deployer wallet (`TREASURY_PRIVATE_KEY`), fee recipient, and `fun_tokens` table as the main platform. This means:
- Punch-launched tokens can appear in the main launchpad feed (e.g., King of the Hill)
- The main page's token lists can pick up punch tokens
- Fees from punch tokens go to the same treasury
- After bonding, NFTs go to the same address as the main platform

## Solution Overview

### 1. Add a `launchpad_type = 'punch'` tag to punch tokens
Instead of relying on description text matching ("Punched into existence"), set a proper `launchpad_type` column on punch tokens. This enables clean filtering on both sides.

### 2. Add a separate deployer wallet env var on Vercel
Create a new environment variable `PUNCH_DEPLOYER_PRIVATE_KEY` on Vercel that the punch flow reads instead of `TREASURY_PRIVATE_KEY`.

### 3. Add a separate fee/NFT receiver wallet env var
Create `PUNCH_FEE_WALLET` for the address that receives fees and bonded NFTs from punch mode launches.

---

## What You Need to Do in Vercel (Environment Variables)

Add these 2 new environment variables in your Vercel project settings:

| Variable | Purpose |
|---|---|
| `PUNCH_DEPLOYER_PRIVATE_KEY` | Base58-encoded private key of the wallet that deploys punch tokens on-chain |
| `PUNCH_FEE_WALLET` | Public address that receives trading fees and NFTs after bonding for punch tokens |

You will need to generate a new Solana keypair for the punch deployer (separate from the main treasury). Fund it with enough SOL for launches (approximately 0.1 SOL per launch).

---

## Code Changes

### A. Vercel API: New endpoint `api/pool/create-punch.ts`
Create a dedicated Vercel endpoint for punch launches that:
- Reads `PUNCH_DEPLOYER_PRIVATE_KEY` instead of `TREASURY_PRIVATE_KEY`
- Uses `PUNCH_FEE_WALLET` as the fee recipient and leftover receiver
- Otherwise mirrors `create-fun.ts` logic (Meteora DBC pool creation)

Alternatively (simpler): Modify `create-fun.ts` to accept optional `deployerKeyOverride` and `feeWalletOverride` params, and have the punch-launch edge function pass those. However, a separate endpoint is cleaner for full isolation.

### B. Edge Function: Update `punch-launch/index.ts`
- Call the new `/api/pool/create-punch` endpoint (or pass punch-specific params to `create-fun`)
- Set `launchpad_type: "punch"` when inserting into `fun_tokens`
- Set `fee_mode: "punch"` or use the `PUNCH_FEE_WALLET` as creator_wallet for fee routing
- Add `PUNCH_FEE_WALLET` as a Supabase secret so the edge function can reference it

### C. Frontend: Filter punch tokens OUT of the main feed
Update main page token queries to exclude punch tokens:
- `src/hooks/useKingOfTheHill.ts` -- add `.neq("launchpad_type", "punch")`
- `src/hooks/useFunTokens.ts` -- add `.neq("launchpad_type", "punch")`
- `src/hooks/useFunTokensPaginated.ts` -- add `.neq("launchpad_type", "punch")`
- `src/hooks/useGraduatedTokens.ts` -- add `.neq("launchpad_type", "punch")`

### D. Frontend: Update punch feed queries to use `launchpad_type`
- `src/hooks/usePunchTokenFeed.ts` -- change from `.ilike("description", "%Punched into existence%")` to `.eq("launchpad_type", "punch")`
- `src/hooks/usePunchTokenCount.ts` -- same filter change

### E. Fee Distribution: Exclude punch tokens from main fee claiming
- In `supabase/functions/fun-distribute/index.ts` (and similar), add a check to skip tokens with `launchpad_type = 'punch'` so the main treasury doesn't try to claim their fees

---

## Summary of Steps

1. **You (manually)**: Generate a new Solana keypair for punch deployer, fund it
2. **You (manually)**: Add `PUNCH_DEPLOYER_PRIVATE_KEY` and `PUNCH_FEE_WALLET` to Vercel env vars
3. **You (manually)**: Add `PUNCH_FEE_WALLET` as a secret in Lovable Cloud
4. **Code changes**: Create `api/pool/create-punch.ts` (or extend `create-fun.ts`)
5. **Code changes**: Update `punch-launch` edge function to use new endpoint and set `launchpad_type: "punch"`
6. **Code changes**: Add `.neq("launchpad_type", "punch")` filters to all main page token hooks
7. **Code changes**: Update punch feed hooks to filter by `launchpad_type` instead of description text

