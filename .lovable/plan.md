

# Re-enable X Bot System + Remove Tuna Branding + Add Persona Editor

## Overview

Three things need to happen:
1. Re-enable the bot system (secrets + cron jobs)
2. Remove all "tuna" references from edge functions and admin UI
3. Add a **Persona Editor** to the admin page so you can adjust the bot's personality, tone, and voice directly from the UI without code changes

## Current State

- **ClawMode Bot** (`@clawmode`): Active in DB but has **no cookies** set and **no cron jobs** scheduled
- **67x Bot** (`@ai67x_fun`): Disabled, has cookies but is the old account
- **Kill switches**: `ENABLE_X_POSTING` and `ENABLE_PROMO_MENTIONS` are both `"false"`
- **Cron jobs**: All 5 deleted from `cron.job` table
- **Persona prompt**: Hardcoded in 3 edge functions with no UI to edit it
- **Tuna references**: Still present in edge functions (`@tunalaunch`, `tuna_launch`, `tunaagents`, `buildtuna`) and admin UI defaults

---

## Part 1: Remove All Tuna References

### Edge Functions (4 files)

**`supabase/functions/promo-mention-scan/index.ts`**
- `BOT_USERNAMES` set: Remove `tunalaunch`, `tuna_launch`, `tunaagents` -- keep only `clawmode`, `moltbook`, `openclaw`
- Search query: Remove `@tunalaunch` from the search string
- `determineMentionType()`: Remove `tunalaunch` case

**`supabase/functions/promo-mention-reply/index.ts`**
- Same `BOT_USERNAMES` cleanup
- Same search query cleanup
- Same `determineMentionType()` cleanup
- System prompt: Remove "Do NOT mention tuna, TUNA" line, replace with "Do NOT mention any specific launchpad or product"

**`supabase/functions/x-bot-reply/index.ts`**
- System prompt: Same update -- remove tuna-specific line
- No other tuna references (uses dynamic account rules from DB)

**`supabase/functions/influencer-list-reply/index.ts`**
- `SYSTEM_PROMPT`: Same update -- remove tuna-specific line

### Admin UI (2 files)

**`src/components/admin/XBotRulesForm.tsx`**
- `DEFAULT_MENTIONS`: Remove `@tunalaunch`, keep `@moltbook`, `@openclaw`, `@clawmode`
- `SUGGESTED_CASHTAGS`: Change `$TUNA` to `$CLAW`
- `SUGGESTED_KEYWORDS`: Remove `tunalaunch`, add `clawmode` (if not already there)

**`src/components/admin/XBotAccountForm.tsx`**
- Rename "SubTuna" tab label to "Community"
- Rename all "SubTuna" text to "Community" in descriptions
- Keep the `subtuna_ticker` field name as-is (DB column)

### Admin Page

**`src/pages/XBotAdminPage.tsx`**
- Change `ADMIN_PASSWORD` from `"tuna"` to `"claw"`

---

## Part 2: Add Persona Editor

Currently the bot personality is hardcoded in each edge function. To let you edit it from the admin UI:

### Database Changes

Add a `persona_prompt` column to `x_bot_account_rules`:
```sql
ALTER TABLE x_bot_account_rules 
ADD COLUMN persona_prompt TEXT DEFAULT NULL;
```

When `persona_prompt` is set, the edge functions will use it. When NULL, they fall back to the default hardcoded prompt.

### Edge Function Changes (3 files)

**`x-bot-reply/index.ts`**, **`promo-mention-reply/index.ts`**, **`influencer-list-reply/index.ts`**:
- Read `persona_prompt` from the account's rules in DB
- If set, use it as the system prompt; if NULL, use the default

### Admin UI: New Persona Tab in XBotRulesForm

Add a **"Persona"** section to the Rules editor dialog with:
- A large textarea for the full system prompt
- A "Reset to Default" button that clears it back to the built-in prompt
- A preview of the default prompt so you know what you're overriding
- Character count display

This means you can:
- Set a unique persona per bot account
- Adjust tone, rules, emoji usage, aggressiveness
- Add or remove restrictions
- All without touching code

---

## Part 3: Re-enable the System

### Step 1: Set Kill Switch Secrets
Set `ENABLE_X_POSTING` to `"true"` and `ENABLE_PROMO_MENTIONS` to `"true"` via the secrets tool.

### Step 2: You Provide Cookies
The `@clawmode` account has **no cookies set**. You will need to paste the full cookie string from your browser (DevTools > Application > Cookies > x.com) into the admin panel's "Edit Account > Authentication" tab.

### Step 3: Recreate Cron Jobs
Recreate the 5 cron jobs via SQL:
- `x-bot-scan-1min` -- every minute, calls `x-bot-scan`
- `x-bot-reply-1min` -- every minute, calls `x-bot-reply`
- `promo-mention-scan-2min` -- every 2 minutes, calls `promo-mention-scan`
- `promo-mention-reply-1min` -- every minute, calls `promo-mention-reply`
- `influencer-list-reply-30min` -- every 30 minutes, calls `influencer-list-reply`

### Step 4: Enable Account Rules
Update the `@clawmode` account's rules in DB to `enabled: true` (currently the new one is already enabled).

---

## Files Changed Summary

| File | Change |
|---|---|
| `supabase/functions/promo-mention-scan/index.ts` | Remove tuna usernames and @tunalaunch from search |
| `supabase/functions/promo-mention-reply/index.ts` | Remove tuna usernames, search refs, update persona prompt, read persona from DB |
| `supabase/functions/x-bot-reply/index.ts` | Update persona prompt, read persona from DB |
| `supabase/functions/influencer-list-reply/index.ts` | Update persona prompt, read persona from DB |
| `src/components/admin/XBotRulesForm.tsx` | Remove tuna defaults, add Persona textarea section |
| `src/components/admin/XBotAccountForm.tsx` | Rename "SubTuna" to "Community" in labels |
| `src/pages/XBotAdminPage.tsx` | Change admin password from "tuna" to "claw" |
| **DB Migration** | Add `persona_prompt TEXT` column to `x_bot_account_rules` |
| **DB Insert** | Recreate 5 cron jobs |
| **Secrets** | Set `ENABLE_X_POSTING=true`, `ENABLE_PROMO_MENTIONS=true` |

---

## What You'll Be Able to Do After This

From the admin page at `/admin/x-bots`:
1. **Edit Rules** on any account to change mentions, cashtags, keywords, follower thresholds
2. **Edit Persona** to change the AI's tone, restrictions, and personality
3. **Edit Account** to paste fresh cookies and configure proxies
4. **Run Scan** / **Run Reply** buttons to manually trigger cycles
5. **View Activity** to see what the bot is doing in real-time

The bot will auto-run via cron jobs once cookies are provided and everything is enabled.

