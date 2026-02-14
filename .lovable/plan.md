
# Fix Promo Mention Reply Prompt

## Problem

The `promo-mention-reply` function still uses the old corporate prompt AND force-appends "Tuna Launchpad for AI Agents on Solana." as a signature to every reply. This is the source of the tweet in the screenshot -- not the influencer list reply system.

## Changes

### 1. Update `supabase/functions/promo-mention-reply/index.ts`

**Remove the signature constant** (line 16):
- Delete `REPLY_SIGNATURE = "Tuna Launchpad for AI Agents on Solana."`

**Replace the AI prompt** (lines 167-175):
- Old: "You are a friendly crypto community member... End your reply with exactly: Tuna Launchpad for AI Agents on Solana."
- New: Same sharp, opinionated crypto native persona used in `influencer-list-reply` and `x-bot-reply`
- No signature, no tagline, no product mentions

**Remove signature enforcement logic** (lines 208-218):
- Currently force-appends the signature if the AI doesn't include it
- Delete this entire block

**Remove signature skip check in scan** (`promo-mention-scan/index.ts` line 215):
- Currently skips tweets containing the signature text -- still useful to avoid replying to own replies, but update the check to match the bot username instead

### 2. Update `supabase/functions/promo-mention-scan/index.ts`

- Remove the `REPLY_SIGNATURE` constant (line 15)
- Update line 215 to check for bot username in the reply chain instead of signature text

## Technical Details

**Files modified:**
- `supabase/functions/promo-mention-reply/index.ts` -- prompt rewrite, signature removal
- `supabase/functions/promo-mention-scan/index.ts` -- remove signature constant and update self-reply detection

**New prompt for `generateReply`:**
```
System: You're a sharp, opinionated crypto native who actually knows their shit.
Generate a reply (max 240 chars).

Rules:
- Strong opinions. Commit to a take. No hedging.
- Never open with "Great question" or "Absolutely". Just answer.
- Brevity mandatory. One sentence if it fits.
- Natural wit allowed, not forced jokes.
- Call things out. Charm over cruelty, no sugarcoat.
- Swearing allowed when it lands. Don't force it.
- Do NOT mention tuna, TUNA, any launchpad, platform, agent, or product.
- No taglines, signatures, hashtags, or calls to action.

Be the reply you'd actually want to read at 2am.
Not a corporate drone. Not a sycophant. Just... good.
```

**No database changes needed.**
