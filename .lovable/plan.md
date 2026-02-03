
## What’s actually happening (root cause)
Your screenshot shows:
- “Total Earned” ≈ **5.2136 SOL**
- “Unclaimed” = **0 SOL**
- Yet per-token “Your Earnings” shows **0.0526 SOL** and **5.1609 SOL**

Backend data confirms why:
- For your tokens (KNGT + CRAB), **all `fun_fee_claims` are already marked `creator_distributed=true`**, so the app’s “unclaimed” calculation (which currently relies on “undistributed fee claims”) becomes **0**.
- At the same time, the platform has accumulated creator earnings elsewhere (we see many rows in `agent_fee_distributions`), so you *do* have earnings, but the claim UI is looking at the wrong “source of truth” for “unclaimed”.

There’s a second issue making this worse:
- Agents created via Twitter launches are not saving `agents.style_source_username`, so the claim dashboard often falls back to a “pseudo-agent” path that computes unclaimed purely from `creator_distributed=false` claims (which is 0 for you).

## Goal
Make Twitter/X-launched tokens behave exactly like a normal successful launch/claim flow:
1) The dashboard always finds the correct agent/tokens for your X username.
2) “Unclaimed” reflects what you can actually withdraw.
3) Clicking “Claim” pays out correctly to the wallet you input.
4) Cooldowns/locks prevent double-claims.
5) Backfill/fix existing records (like your account) so it works immediately.

---

## Plan of changes

### A) Fix agent identity tracking for Twitter launches (so discovery is stable)
1. Update the Twitter launch processing backend (`agent-process-post`) so when it creates/updates an agent it sets:
   - `agents.style_source_username = normalizedTwitterUsername` (no @, lowercase)
   - also keep `twitter_handle` consistent (same normalized value)
2. Add a small “backfill” migration for existing agents:
   - For agents where `style_source_username` is NULL but `twitter_handle` exists, set `style_source_username = twitter_handle`.
   - For cases where both are NULL, infer from `agent_social_posts.post_author` by joining through `fun_tokens.agent_id` when possible.

Result: your X login will always map to the correct agent(s), not the fallback pseudo-agent grouping.

---

### B) Redefine “claimable/unclaimed” to match reality (stop depending on `creator_distributed`)
Right now, `creator_distributed` is being used for internal distribution bookkeeping and is not reliable for “what the creator can withdraw” in the Twitter claim UX.

We’ll switch the claim UX to a robust formula:

For a given token:
- **earned_to_creator = sum(fun_fee_claims.claimed_sol) * creator_share**
  - For agent tokens: `creator_share = fun_tokens.agent_fee_share_bps / 10000` (default 0.8)
  - For non-agent tokens: use the correct share used by your product rules (agent tokens are 80%).
- **already_paid_to_creator = sum(fun_distributions.amount_sol)** where:
  - `distribution_type = 'creator_claim'`
  - `status = 'completed'`
  - token matches
- **unclaimed = max(0, earned_to_creator - already_paid_to_creator)**

This makes “unclaimed” correct even if `creator_distributed` was toggled earlier.

Implementation:
1. Update `agent-find-by-twitter` backend function to compute:
   - per-token earned_to_creator
   - per-token already_paid_to_creator
   - per-token unclaimed
   - and totals for the header summary
2. Ensure the dashboard uses this returned unclaimed number to enable/disable the claim button.

Result: your “Unclaimed” will show the real withdrawable amount, and the button will become available.

---

### C) Make the “Claim” button pay from the correct pool and record claims
1. Update `agent-creator-claim` backend function to:
   - Accept `twitterUsername`, `payoutWallet`, and optional `tokenIds` (already does)
   - Validate ownership by checking `agent_social_posts` for those tokenIds + post_author match
   - Compute claimable using the new formula above (earned_to_creator - already_paid_to_creator)
   - Enforce minimum (keep 0.01 SOL unless you want 0.05 SOL)
   - Send SOL to `payoutWallet`
   - Insert `fun_distributions` rows for each token claimed:
     - `distribution_type = 'creator_claim'`
     - `status = 'completed'`
     - `signature = txSignature`
     - `creator_wallet = payoutWallet`
2. Add proper cooldown tracking per Twitter username:
   - Add a `twitter_username` column to `fun_distributions` (migration)
   - Store it on insert for `creator_claim`
   - Change cooldown lookup from “global last claim” to “last claim for this twitter_username”

Result: claims work reliably and the system can always compute “already paid” accurately.

---

### D) Prevent double-claims (lock)
Add a lightweight backend lock so two clicks or parallel requests can’t double-pay:
1. Add table `creator_claim_locks` keyed by `twitter_username` with `locked_at` (and expiry)
2. Add database functions:
   - `acquire_creator_claim_lock(twitter_username, duration_seconds)`
   - `release_creator_claim_lock(twitter_username)`
3. In `agent-creator-claim`, acquire lock before sending; release after (and in error handling)

Result: safe payouts even if someone spams the button.

---

### E) Reconcile existing “pending agent_fee_distributions” (optional but recommended)
Right now, your database shows large “pending” amounts in `agent_fee_distributions` that do not align with what the claim UI should pay.
To avoid future confusion or a second “claim system” paying twice:
- After a successful `creator_claim`, mark related `agent_fee_distributions` rows for those tokenIds as “completed” with the same signature, OR mark them “voided” with a reason (preferred if we add a `status` enum).
- If we want zero-risk overpayment, we’ll only ever pay using the new formula based on `fun_fee_claims` minus `creator_claim` distributions; `agent_fee_distributions` becomes informational/legacy for this flow.

Result: one coherent claim source of truth.

---

## Verification plan (what we’ll test)
1. Log in with X as `@stillwrkngonit` and open `/agents/claim`.
2. Confirm:
   - Tokens list populates
   - Header “Unclaimed” matches the sum of per-token unclaimed
   - Claim button becomes enabled when unclaimed >= 0.01
3. Enter a payout wallet and claim:
   - Transaction succeeds
   - UI shows success and signature
   - Unclaimed becomes 0 (or decreases correctly)
4. Re-click immediately:
   - Expect cooldown message (per-user)
5. Reload and verify the claimed state persists.

---

## Deliverables (what will be changed)
- Backend functions:
  - `agent-process-post` (set `style_source_username`)
  - `agent-find-by-twitter` (compute correct unclaimed)
  - `agent-creator-claim` (pay correct amount, record distributions, cooldown per user, locking)
- Database migrations:
  - Add `twitter_username` column to `fun_distributions` (+ index for lookups)
  - Add `creator_claim_locks` table + RPC functions
  - Backfill `agents.style_source_username` for existing records
- Frontend:
  - `AgentClaimPage` continues to call `agent-creator-claim`, but now it will correctly unlock claim based on fixed data from `agent-find-by-twitter`

