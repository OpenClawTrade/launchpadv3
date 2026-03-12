

## Plan: Chain-Aware Panel + Diagnose Quick Buy Speed

### Issue 1: Panel shows only SOL, not chain-aware

The Panel page header and wallet bar already switch between SOL/BNB chains. However, the **inner tabs** (Portfolio, Earnings, Launches, Wallet) are hardcoded to Solana:

- **PanelPortfolioTab** — queries `useUserHoldings(solanaAddress)`, shows "SOL" values only
- **PanelEarningsTab** — queries `useUserEarnings(solanaAddress)`, shows "SOL" labels, Solscan links
- **PanelMyLaunchesTab** — shows Solscan links, SOL amounts, hardcoded to Solana
- **PanelWalletTab** — uses `useSolanaWalletWithPrivy()` only, shows SOL balance, Solana token holdings

**Changes needed:**

1. **PanelPortfolioTab** — Add `useChain` hook. When BNB selected: use EVM address for queries, show "BNB" instead of "SOL", link to BscScan instead of Solscan. Stats cards should display the correct currency symbol.

2. **PanelEarningsTab** — Add chain awareness. When BNB: show "BNB" labels, use BscScan links for claim tx hashes, use EVM address for earnings queries.

3. **PanelMyLaunchesTab** — When BNB: show BscScan links for token addresses and claim signatures instead of Solscan. Show "BNB" in amounts.

4. **PanelWalletTab** — When BNB selected: show BNB balance from `useEvmWallet()`, EVM address, BscScan links. Hide Solana-specific features (export key via Privy Solana SDK). Show EVM token holdings if available.

5. **PanelWalletBar** — Already chain-aware (confirmed in code). No changes needed.

### Issue 2: Quick Buy taking 11+ seconds instead of <2s

The console log shows `[FastSwap] Done in 11356ms`. The execution path is:

```text
executeFastSwap()
  → swapBondingCurve()
    → DynamicBondingCurveClient.create(connection)  // new instance every call
    → client.state.getPool(poolAddress)              // RPC call ~2-4s
    → client.pool.swap({...})                        // builds tx ~1-2s
    → signAndSendTransaction()                       // Privy sign ~3-5s
      → getCachedBlockhash()                         // should be 0ms if cached
      → privySolana.signAndSendTransaction()         // actual signing
      → sendRawToAllEndpoints()                      // fire-and-forget Jito
```

**Root causes and fixes:**

1. **DBC Client re-created every swap** — Cache the `DynamicBondingCurveClient` instance at module level instead of creating a new one per call. This saves connection setup overhead.

2. **Pool state fetch is sequential** — `client.state.getPool()` is a full RPC deserialization call. For tokens we've already fetched pool state for (e.g., from background refresh), we could skip this or run it in parallel with blockhash fetch. However, the pool state IS needed for the swap instruction. We can at minimum pre-warm the connection.

3. **Privy `signAndSendTransaction` overhead** — The Privy SDK's `signAndSendTransaction` bundles signing + sending. With `showWalletUIs: false`, it should be auto-approved, but there may be iframe communication latency. This is harder to optimize but we should ensure `showWalletUIs: false` is consistently set.

4. **Serialization before signing** — Line 80 calls `transaction.serialize({ requireAllSignatures: false })` BEFORE signing, then passes bytes to Privy. This is correct for Privy's API but the serialization itself shouldn't be slow.

**Optimizations to implement:**

- Cache `DynamicBondingCurveClient` singleton (avoid re-creation)
- Pre-fetch pool state in parallel with blockhash if cache is stale
- Add timing logs at each step to identify the actual bottleneck (instrumentation)
- Ensure the Privy wallet is pre-warmed (connection established before first trade)

### Implementation Summary

| File | Change |
|------|--------|
| `PanelPortfolioTab.tsx` | Add chain context, switch currency/explorer per chain |
| `PanelEarningsTab.tsx` | Add chain context, dynamic currency labels and explorer links |
| `PanelMyLaunchesTab.tsx` | Chain-aware explorer links and currency display |
| `PanelWalletTab.tsx` | Dual-mode: SOL wallet vs BNB wallet based on chain |
| `useFastSwap.ts` | Cache DBC client singleton, add step-level timing logs |

