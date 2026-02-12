

## $TUNA Token Migration Page

### Overview

A dedicated `/migrate` page that explains why $TUNA is migrating from pump.fun to its own launchpad, collects old tokens at a deposit wallet, and tracks holder migration progress against a on-chain snapshot.

### Page Structure

**1. Hero / Explanation Section**
- Why migration is happening: pump.fun fees don't fund development; TUNA OS (agents, OpenTuna, OpenClaw, Sonar, Fins, DNA system) needs proper fee structure to sustain growth
- Technical highlights: AI Agent OS, autonomous trading agents, TunaBook social layer, OpenClaw system, API/SDK, fee distribution architecture
- Clear call-to-action: "Migrate your $TUNA now"

**2. Countdown Timer (48 hours)**
- Prominent countdown timer showing time remaining for migration eligibility
- Set from a fixed deadline timestamp (configurable)
- When expired: shows "Migration window closed" and disables the deposit form

**3. Snapshot Holder Table**
- Pre-loaded from database: all holders of old CA `GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump` at the time of snapshot
- Columns: Wallet (truncated), Token Balance, % of Supply, Migration Status (checkmark if they've sent tokens)
- Search/filter by wallet address
- Stats bar: Total holders, Total supply snapshotted, % of holders migrated, % of supply migrated

**4. Deposit Instructions**
- Collection wallet address prominently displayed: `9ETnxTgU3Zqg3NuuZXyoa5HmtaCkP9PWjKxcCrLoWTXe`
- Old $TUNA mint address: `GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump`
- Copy buttons for both
- Step-by-step instructions

**5. "I've Sent My Tokens" Form**
- User enters their wallet address (or connects via Privy)
- Checks if wallet is in the snapshot
- User enters amount sent + optional tx signature
- Submits to database, marks them as "agreed to migration" in the snapshot table

---

### Database Changes

**New table: `tuna_migration_snapshot`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Auto-generated |
| wallet_address | text (unique) | Holder's Solana wallet |
| token_balance | numeric | Balance at time of snapshot |
| supply_percentage | numeric | % of total supply held |
| has_migrated | boolean | Whether they've sent tokens |
| amount_sent | numeric | Self-reported amount sent |
| tx_signature | text | Optional transaction signature |
| migrated_at | timestamptz | When they submitted migration |
| created_at | timestamptz | Snapshot time |

RLS: Public SELECT (anyone can view the migration dashboard). Public INSERT/UPDATE limited to setting migration fields only (via a database function to prevent abuse).

**New table: `tuna_migration_config`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid (PK) | Single row |
| deadline_at | timestamptz | 48h migration window end |
| old_mint_address | text | pump.fun CA |
| collection_wallet | text | Deposit address |
| total_supply_snapshot | numeric | Total supply at snapshot |
| created_at | timestamptz | Config creation time |

RLS: Public SELECT only.

---

### New Files

**`src/pages/MigratePage.tsx`**
- Main migration page with all sections described above
- Uses `LaunchpadLayout` for consistent navigation
- Countdown timer component using `useEffect` interval
- Snapshot table with search, pagination, and live stats
- Deposit form with wallet validation against snapshot

**Route: `/migrate`** added to `App.tsx`

---

### Snapshot Data Loading

An edge function `tuna-snapshot` will be created to:
1. Accept the old mint address
2. Fetch all token holders (via Helius/RPC `getTokenAccounts`)
3. Store each holder + balance in `tuna_migration_snapshot`
4. Record total supply in `tuna_migration_config`

This runs once to capture the snapshot. Can be triggered manually from the page (admin only) or pre-populated.

---

### Migration Flow

```text
User visits /migrate
       |
       v
Reads explanation + sees countdown
       |
       v
Searches their wallet in snapshot table
       |
       v
Sends old $TUNA to collection wallet (in their own Solana wallet app)
       |
       v
Returns to /migrate, enters wallet + amount + tx sig
       |
       v
System marks them as migrated in snapshot table
       |
       v
Dashboard updates: "X% of supply migrating, Y/Z holders agreed"
```

---

### Stats Dashboard (top of page)

- Total snapshot holders
- Holders who agreed to migrate (count + %)
- Total supply in snapshot
- Supply committed to migration (sum of amount_sent + %)
- Time remaining in migration window

