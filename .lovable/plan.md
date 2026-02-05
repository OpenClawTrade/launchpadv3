
# Plan: Disable Fresh Deployer for All Token Launches

## Summary
Change the global `USE_FRESH_DEPLOYER` flag to `false` so all token launches use the main treasury wallet directly instead of generating fresh deployer wallets.

---

## Current Launch Paths

| Launch Path | Source | Currently Uses Fresh Deployer? |
|-------------|--------|-------------------------------|
| Trading Agents | `trading-agent-create/index.ts` | No (already passes `useFreshDeployer: false`) |
| Agent API Launch | `agent-launch/index.ts` | Yes (uses global default) |
| Twitter !launchtuna | `twitter-mention-launcher/index.ts` | Yes (uses global default) |
| Direct API | `api/pool/create-fun.ts` | Yes (uses global default) |

---

## Change Required

### `lib/config.ts` — Line 51

```typescript
// BEFORE
export const USE_FRESH_DEPLOYER = true;

// AFTER
export const USE_FRESH_DEPLOYER = false;
```

---

## Effect

After this change:
- **ALL token launches** will use the treasury wallet (`FDkGeRVwRo7dyWf9CaYw9Y8ZdoDnETiPDCyu5K1ghr5r`) as the deployer/fee payer
- No fresh wallets will be generated or funded
- No SOL dust will accumulate in ephemeral wallets
- The `useFreshDeployer` parameter still works if you ever want to re-enable it per-request

---

## Files to Modify

| File | Change |
|------|--------|
| `lib/config.ts` | Set `USE_FRESH_DEPLOYER = false` |

---

## Testing

After deployment:
1. Launch a token via Twitter (`!launchtuna`)
2. Launch a token via the trading agents page
3. Check Solscan to confirm the transaction fee payer is the treasury wallet
4. No "Generating fresh deployer wallet..." logs should appear
