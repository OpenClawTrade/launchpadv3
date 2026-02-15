

# Whale Activity Scanner - All Swaps, Bridges, and Transfers

## Goal
Add a real-time blockchain scanner below the compressed distribution tool that captures ALL wallet addresses involved in significant activity -- not just native SOL sends, but also token swaps (Jupiter, Raydium, Orca, Phantom, Axiom), bridge transactions, and any DeFi trade exceeding a configurable SOL value threshold.

## How It Works

Instead of parsing raw `preBalances`/`postBalances` (which only catches native SOL transfers), we use the **Helius Enhanced Transactions API** which automatically parses and labels every transaction type including swaps, token transfers, and DeFi activity across all major aggregators.

```text
Every 5 seconds (frontend timer):
  Frontend --> Edge Function "sol-whale-scanner"
                  |
                  |--> getSlot() to get latest confirmed slot
                  |--> getBlock(slot) to get all transaction signatures
                  |--> POST /v0/transactions (Helius Enhanced API)
                  |    Batch parse up to 100 signatures at once
                  |    Returns parsed data with types: SWAP, TRANSFER, etc.
                  |
                  |--> Filter by:
                  |    - nativeTransfers where amount >= threshold
                  |    - tokenTransfers where value in SOL >= threshold  
                  |    - swap events where SOL side >= threshold
                  |
  Frontend <-- Returns qualified addresses with activity type + amounts
```

## What Helius Enhanced API Gives Us (for free with existing plan)

Each parsed transaction includes:
- **type**: SWAP, TRANSFER, TOKEN_MINT, UNKNOWN, etc.
- **nativeTransfers**: Array of `{ fromUserAccount, toUserAccount, amount }` (in lamports)
- **tokenTransfers**: Array of `{ fromUserAccount, toUserAccount, mint, tokenAmount }` 
- **events.swap**: Parsed swap details with `tokenInputs` and `tokenOutputs` including SOL amounts
- **source**: JUPITER, RAYDIUM, ORCA, PHANTOM, MAGIC_EDEN, etc.

This means we automatically capture:
- Jupiter aggregator swaps (any size)
- Raydium AMM/CLMM swaps  
- Orca Whirlpool swaps
- Phantom built-in swaps
- Axiom trades (routed through Jupiter)
- Bridge deposits/withdrawals (Wormhole, deBridge, Mayan)
- Direct SOL transfers
- SPL token transfers
- Any other DeFi interaction involving SOL movement

## Helius Credit Usage

- `getSlot`: 1 credit
- `getBlock`: 1 credit  
- Enhanced parse (`/v0/transactions`): 100 credits per call (batch of 100 sigs)
- Typical block has 2,000-4,000 transactions, we'd parse them in batches of 100
- **Per poll (every 5s)**: ~2 + (3000/100 * 100) = ~3,002 credits
- **30 minutes**: ~108,000 credits

That's expensive. Better approach: **pre-filter at the block level first**, only parse transactions that show significant balance changes in raw data, then enhance only those.

### Optimized approach (hybrid):
1. `getBlock` with full transaction data (1 credit)
2. Scan `preBalances`/`postBalances` for any account with abs(diff) >= threshold (free, local parsing)
3. Collect only those signatures (typically 50-200 per block with >= 10 SOL movement)
4. Batch-enhance only qualifying signatures via `/v0/transactions` (1-2 calls of 100)
5. **Per poll**: ~3-4 credits
6. **30 minutes (360 polls)**: ~1,200 credits total -- very efficient

## What Gets Built

### 1. Edge Function: `sol-whale-scanner`

**Location:** `supabase/functions/sol-whale-scanner/index.ts`

**Input:**
```text
{
  minSolAmount: number (default 10),
  lastSlot?: number (to avoid re-scanning)
}
```

**Logic:**
1. Get latest confirmed slot via `getSlot`
2. Skip if same as `lastSlot`
3. Fetch full block via `getBlock` with `transactionDetails: "full"`, `maxSupportedTransactionVersion: 0`
4. **Pre-filter**: Scan all transactions' `preBalances` vs `postBalances` -- collect signatures where ANY account moved >= `minSolAmount` SOL
5. **Enhance**: POST qualifying signatures (batch of up to 100) to `https://api.helius.xyz/v0/transactions?api-key=KEY`
6. **Parse enhanced results**:
   - For each enhanced tx, extract:
     - `type` (SWAP, TRANSFER, etc.)
     - `source` (JUPITER, RAYDIUM, PHANTOM, etc.)
     - All `nativeTransfers` with amounts
     - All `tokenTransfers` with token info
     - Swap event details (what was swapped for what)
   - Collect all wallet addresses involved with their role and amounts
7. Return: `{ slot, blockTime, wallets: [...], totalTxInBlock, qualifiedTxCount }`

**Output per wallet entry:**
```text
{
  address: string,
  amountSol: number,
  direction: "sent" | "received" | "swapped",
  type: "SWAP" | "TRANSFER" | "UNKNOWN" | etc.,
  source: "JUPITER" | "RAYDIUM" | "PHANTOM" | "NATIVE" | etc.,
  tokenInvolved?: string (mint address if swap/token transfer),
  signature: string
}
```

### 2. UI Section: Below compressed distribute on same page

**Controls panel:**
- Start/Stop Scanner button
- Min SOL threshold input (default: 10)
- 30-minute countdown timer with progress bar
- Filter checkboxes: Show Swaps / Show Transfers / Show Bridges / Show All

**Live stats cards (6 cards):**
- Unique Addresses Found
- Total Swaps Detected
- Total Transfers Detected  
- Total SOL Volume
- Blocks Scanned
- Helius Credits Used (estimated)

**Activity type breakdown (small bar chart or badges):**
- Jupiter swaps: X
- Raydium swaps: X
- Native transfers: X
- Other: X

**Address table (scrollable, sorted by total volume):**
| # | Address | Times Seen | Total SOL | Activity Types | Last Source | Last Seen |
|---|---------|-----------|-----------|---------------|------------|-----------|
| 1 | 7xK...3nQ | 5 | 847.2 | SWAP, TRANSFER | JUPITER | 12:34:56 |
| 2 | 9mB...4rT | 3 | 234.5 | SWAP | RAYDIUM | 12:34:51 |

**Action buttons:**
- "Copy All Addresses" -- copies deduplicated address list
- "Export CSV" -- full data export with all columns
- "Clear" -- reset scanner data

**All state persisted in localStorage** (`whale-scanner-*` keys) so it survives page reloads. Scanner is resumable.

### 3. Config Update

Add to `supabase/config.toml`:
```text
[functions.sol-whale-scanner]
verify_jwt = false
```

No new route needed -- this lives on the existing `/admin/compressed-distribute` page.

## Technical Details

### Edge Function Core Logic

```text
Step 1: getSlot (1 credit)
Step 2: getBlock(slot) with full tx data (1 credit)
Step 3: Pre-filter loop:
  for each tx in block.transactions:
    for each account index i:
      diff = abs(postBalances[i] - preBalances[i])
      if diff >= minSolAmount * 1e9:
        qualifiedSignatures.push(tx.transaction.signatures[0])
        break

Step 4: If qualifiedSignatures.length > 0:
  POST https://api.helius.xyz/v0/transactions?api-key=HELIUS_API_KEY
  Body: { transactions: qualifiedSignatures.slice(0, 100) }
  (1 credit per signature in batch, so 50-100 credits typically)

Step 5: Parse enhanced results:
  for each enhancedTx:
    - Extract all nativeTransfers where amount >= threshold
    - Extract swap events (tokenInputs/tokenOutputs)
    - Extract tokenTransfers
    - Map each to { address, amount, direction, type, source }
```

### Frontend Polling

```text
State shape in localStorage ("whale-scanner-state"):
{
  isRunning: boolean,
  startTime: number,
  lastSlot: number,
  blocksScanned: number,
  addresses: {
    [address]: {
      timesSeen: number,
      totalVolumeSol: number,
      activityTypes: Set<string>,
      sources: Set<string>,
      lastSeen: string,
      transactions: Array<{ sig, amount, type, source }>
    }
  },
  stats: {
    totalSwaps: number,
    totalTransfers: number,
    totalVolume: number,
    creditsUsed: number
  }
}

Polling interval: 5 seconds
Auto-stop: after 30 minutes elapsed
```

## Expected Results (30 min run, 10 SOL threshold)

- Blocks sampled: ~360 (1 every 5 seconds)
- Qualifying transactions per block: ~50-200 (with >= 10 SOL movement)
- Expected unique addresses: **2,000-5,000+**
- Activity breakdown: ~60% swaps (Jupiter dominant), ~30% native transfers, ~10% other
- Helius credits: ~5,000-15,000 (well within paid tier limits)
- Sources captured: Jupiter, Raydium, Orca, Phantom, Meteora, native SOL, bridges

