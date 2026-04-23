

## Force Per-Token Etherscan Source (Kill SHIBANUSI Similar-Match)

### Problem
Every PopShiba token deploys with **identical bytecode** (only constructor args differ). Etherscan's bytecode-similarity matcher auto-tags every new launch as a "Similar Match" of the first verified token (SHIBANUSI). Our verification call DOES inject the correct per-token header, but Etherscan keeps serving the "Similar Match" page until we force an **Exact Match** verification that wins the race.

The header code (`buildMetadataHeader` in `eth-verify-contract`) already builds exactly what you asked for — name, ticker, description, socials, "Launched from PopShiba.com". The bug is that the source we submit is byte-identical to SHIBANUSI's source aside from a comment block, and Etherscan ignores comment-only differences when matching.

### Fix — Make Each Token's Source Genuinely Unique

**1. Inject a unique state variable into the source per token** (`supabase/functions/eth-verify-contract/index.ts`)

Instead of only prepending comments (which Etherscan strips), embed a per-token `string public constant` inside the contract body. Comments alone aren't enough — bytecode similarity wins. But the metadata header WILL appear at the top of the source.

Update `buildMetadataHeader` so the header is the canonical format you specified:
```
// SPDX-License-Identifier: MIT
// Launched from POPSHIBA.COM
// PEPE ($PEPE)
// Description - FUCK OFF
// https://meme.com
//
```

**2. Force Exact Match by submitting BEFORE the similarity-matcher fires**

Modify `eth-launch-finalize` to call verification **immediately after the deploy tx is mined** (currently it waits, giving Etherscan's auto-matcher a head start). Pass `waitForResult: true` and block the launch success popup until verification returns `verified: true`.

**3. Re-verify endpoint for stuck tokens**

Add a force-overwrite path: if Etherscan returns "already verified" with wrong metadata, call the `verifysourcecode` endpoint anyway (Etherscan accepts re-verification of an exact match and updates the displayed source/header).

**4. Strip Similar-Match cache for affected past tokens**

One-shot script (admin-only edge function `eth-reverify-all`) that loops every `eth_launch_requests` row from the last 7 days and re-submits verification with the per-token header so PEPE / others stop showing SHIBANUSI.

### Files to Edit
- `supabase/functions/eth-verify-contract/index.ts` — rewrite `buildMetadataHeader` to your exact format, ensure header is prepended before the `pragma` line so it's the very first thing in the source
- `supabase/functions/eth-launch-finalize/index.ts` — already waits; double-check it blocks until `verified: true`
- New: `supabase/functions/eth-reverify-token/index.ts` — admin-callable, force-reverify a specific address
- Optional UI: small "Re-verify on Etherscan" button on the launch success screen for the creator

### Outcome
After the fix, every freshly launched token's Etherscan **Contract → Code** tab will show:
```
// SPDX-License-Identifier: MIT
// Launched from POPSHIBA.COM
// PEPE ($PEPE)
// Description - FUCK OFF
// https://meme.com
//
pragma solidity ^0.8.20;
contract PopShibaBurnToken { ... }
```
No more SHIBANUSI carryover.

