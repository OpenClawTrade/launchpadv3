
# Fix pump.fun Token Display and Navigation

## Issues Identified

1. **Old Rocket Icon Still Showing**: `TokenTable.tsx` (lines 26, 141, 300) still uses the Phosphor `Rocket` icon instead of the new `PumpBadge` component with the pump.fun pill image
2. **Incorrect Navigation**: pump.fun tokens like Molt Tuna are linking to pump.fun instead of their SubTuna community page (`/t/MOLT`)
3. **Missing Dual Icons**: pump.fun tokens with communities should show BOTH the Bot icon (purple) AND the pump.fun pill icon

## Database Context

Molt Tuna ($MOLT):
- Has a SubTuna community: `ticker: MOLT`
- Token `launchpad_type: pumpfun`
- Token `agent_id: null` (this is why navigation is broken)
- SubTuna has `agent_id: null` but `fun_token_id` is set

## Solution

### 1. Update TokenTable.tsx - Replace Rocket with PumpBadge

Replace the Phosphor Rocket import and usage with the PumpBadge component (already done in KingOfTheHill and TokenCard).

**Location**: Lines 26, 132-143, 292-302

### 2. Fix Navigation Logic for pump.fun Tokens

The current logic prioritizes `agent_id` for SubTuna routing. For pump.fun tokens, we need to check if a SubTuna community exists for the ticker.

**New Logic**:
```text
If launchpad_type is 'pumpfun':
  - If token has a community (by ticker): Link to /t/{ticker}
  - Else: Link to pump.fun/{mint_address}
```

Since we don't have community data in the token list, the simplest approach is:
- All pump.fun tokens launched through our platform get a SubTuna community automatically
- Therefore, ALL pump.fun tokens should link to their SubTuna page `/t/{ticker}`

### 3. Update Icon Display Logic

Show both icons when:
- Token is `launchpad_type: pumpfun` → Show pump.fun pill
- Token has an associated community → Show Bot icon (link to SubTuna)

For pump.fun tokens: Show Bot icon + pump.fun pill, link to SubTuna.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/launchpad/TokenTable.tsx` | Replace Rocket with PumpBadge, fix navigation to always use SubTuna for pump.fun tokens |
| `src/components/launchpad/TokenCard.tsx` | Fix navigation logic - pump.fun tokens should link to SubTuna |
| `src/components/launchpad/KingOfTheHill.tsx` | Fix navigation logic - pump.fun tokens should link to SubTuna |

## Technical Details

### TokenTable.tsx Changes

1. Remove import: `import { Rocket } from "@phosphor-icons/react";`
2. Add import: `import { PumpBadge } from "@/components/tunabook/PumpBadge";`
3. Update navigation logic (lines 85-94, 254-263):
   ```typescript
   // Changed: pump.fun tokens now link to SubTuna
   const tradeUrl = token.agent_id 
     ? `/t/${token.ticker}` 
     : isPumpFun
       ? `/t/${token.ticker}`  // pump.fun tokens get SubTuna pages
       : `/launchpad/${token.mint_address}`;
   
   // All tokens now use Link, not external 'a' tag for pump.fun
   ```
4. Replace Rocket icon with PumpBadge (mobile: lines 132-143, desktop: lines 292-302)
5. Show Bot icon for pump.fun tokens (they all have communities)

### KingOfTheHill.tsx & TokenCard.tsx Changes

Update the `tradeUrl` and `CardWrapper` logic:
```typescript
// pump.fun tokens should link to SubTuna, not pump.fun directly
const tradeUrl = isPumpFun 
  ? `/t/${token.ticker}`        // Always link to SubTuna for pump.fun
  : token.agent_id 
    ? `/t/${token.ticker}` 
    : `/launchpad/${token.mint_address}`;

// Always use Link, never external 'a' for navigation
const CardWrapper = Link;
```

## Expected Result

After these changes:
- Molt Tuna will show: Bot icon (purple) + pump.fun pill icon
- Clicking Molt Tuna will navigate to `/t/MOLT` (SubTuna community)
- The pump.fun pill icon will still link externally to pump.fun when clicked directly (via PumpBadge's mintAddress prop)
- No more green rocket icons anywhere
