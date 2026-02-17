

## ✅ COMPLETED: !launch command + 3/day limit

### What was implemented

1. **`!launch <text>` command** — Users can tweet `!launch cat` (or any text) and the system:
   - Detects the command in `agent-scan-twitter`, `agent-scan-mentions`, and `twitter-mention-launcher`
   - Calls `fun-generate` with `imageStyle: "realistic"` to create AI-generated name, ticker, description, and image
   - Launches the token on-chain with 70% creator fee split (vs 80% for `!tunalaunch`)
   - Sets `twitter_url` to the source tweet, `website_url` to the SubTuna community page
   - Replies with token image, CA, and details

2. **3/day per-user limit** — All three scanners enforce max 3 launches per X account per 24 hours, with a reply when the limit is hit.

### Files modified

| File | Changes |
|------|---------|
| `supabase/functions/agent-scan-twitter/index.ts` | Added `!launch` to search query, command detection, autoGenerate pass-through, dynamic fee % in reply |
| `supabase/functions/agent-scan-mentions/index.ts` | Added `!launch` detection, per-author daily limit, autoGenerate pass-through |
| `supabase/functions/agent-process-post/index.ts` | Added `autoGenerate` flow calling `fun-generate`, 70% fee split, full launch pipeline |
| `supabase/functions/twitter-mention-launcher/index.ts` | Added `!launch` to LAUNCH_COMMANDS patterns |

### Remaining (not yet implemented)

- `/panel` page for fee claiming via Privy X OAuth login
- `agent-creator-claim` dynamic fee split based on `agent_fee_share_bps`
