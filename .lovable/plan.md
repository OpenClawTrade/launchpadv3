

# Fix NFA Mint Edge Function Failure

## Problem
The `nfa-mint` edge function returns a non-2xx status because it is **not listed in `supabase/config.toml`**. By default, Supabase enforces JWT verification, which rejects the request since the client calls `supabase.functions.invoke("nfa-mint")` without a valid JWT token.

The user's payment (1 SOL) went through on-chain, but the minting step failed because the edge function was never reached.

## Root Cause
Every other edge function in the project has `verify_jwt = false` in `config.toml`, but `nfa-mint` was never added. This is a simple configuration oversight.

## Secondary Issue
The `collection_address` in the `nfa_batches` table is `null`, which means even if the edge function succeeds, the on-chain NFT minting will be silently skipped (the code checks `if (treasuryPrivateKey && nfaCollectionAddress)` and skips minting if either is missing). The DB record will still be created, but no actual NFT is minted on-chain.

## Fix Plan

### Step 1: Add `nfa-mint` to config.toml
Add the missing entry:
```toml
[functions.nfa-mint]
verify_jwt = false
```

### Step 2: Redeploy the edge function
After the config change, redeploy `nfa-mint` so requests are accepted.

### Step 3: Manually record the user's paid mint
Since the user already paid 1 SOL (tx: `vJiaFzaR...`), we need to manually invoke the edge function or insert the mint record into `nfa_mints` so their payment is honored. We can retry the edge function call with the same payment signature after deployment.

### Step 4: Address the collection address (optional)
Either run `nfa-create-collection` to generate the on-chain collection and populate `collection_address` in `nfa_batches`, or accept that NFAs are DB-only until the collection is created. Without it, no actual Metaplex Core NFT is minted on-chain.

