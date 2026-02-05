
# Deployer Dust Recovery System

## Current Situation

After investigating the codebase, I found a critical issue:

**The private keys for fresh deployer wallets are NOT stored.**

The `fundFreshDeployer()` function in `api/pool/create-fun.ts` (line 81):
```typescript
const deployerKeypair = Keypair.generate(); // Ephemeral - never saved!
```

This means:
- **65 unique fresh deployer wallets** were created across 176 token launches
- **~3.25 SOL is permanently stranded** (65 wallets × 0.05 SOL each)
- There is NO way to recover this dust without the private keys

---

## What I Can Build

Since past dust is unrecoverable, I'll implement a system to **prevent future losses** and **enable recovery going forward**:

### 1. Store Deployer Keys for Future Launches
Modify `api/pool/create-fun.ts` to save the deployer private key (encrypted) to the database after each launch.

**New database table:** `deployer_wallets`
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| wallet_address | text | Public key |
| encrypted_private_key | text | Base58-encoded private key (encrypted) |
| token_mint | text | Associated token mint address |
| funded_sol | numeric | Initial funding amount |
| remaining_sol | numeric | Last known balance (updated on scan) |
| reclaimed_at | timestamp | When dust was reclaimed |
| created_at | timestamp | When wallet was created |

### 2. Encryption for Private Keys
Use a server-side encryption key (new secret: `DEPLOYER_ENCRYPTION_KEY`) to encrypt/decrypt private keys at rest.

### 3. Admin Page: Deployer Dust Recovery
Create `/admin/deployer-dust` with:
- Password protection (same pattern as Treasury Admin)
- List all tracked deployer wallets with current balances
- "Scan Balances" button to check all wallets on-chain
- "Reclaim All" button to transfer dust back to treasury
- Total recoverable SOL summary

### 4. Backend Function: `deployer-dust-reclaim`
- Fetches all unreclaimed deployer wallets from database
- Decrypts private keys
- For each wallet with balance > 0.001 SOL:
  - Creates transfer transaction to treasury
  - Signs with deployer key
  - Submits to network
  - Marks as reclaimed in database

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/pool/create-fun.ts` | Modify | Save encrypted deployer key after launch |
| `supabase/functions/deployer-dust-scan/index.ts` | Create | Scan deployer wallet balances |
| `supabase/functions/deployer-dust-reclaim/index.ts` | Create | Transfer dust back to treasury |
| `src/pages/DeployerDustAdminPage.tsx` | Create | Admin UI for recovery |
| `src/App.tsx` | Modify | Add route for admin page |

**Database migration:**
- Create `deployer_wallets` table with proper RLS policies

---

## Security Considerations

1. **Private keys are encrypted at rest** using AES-256 with a server-side secret
2. **Admin page is password protected** (same as Treasury Admin)
3. **RLS policies prevent public access** to the deployer_wallets table
4. **Only edge functions with service role** can decrypt keys

---

## Technical Flow

```text
Token Launch Flow:
┌─────────────────────────────────────────────────────────────┐
│  1. Generate fresh deployer keypair                         │
│  2. Fund with 0.05 SOL from treasury                        │
│  3. Use for token creation transactions                     │
│  4. ENCRYPT private key with DEPLOYER_ENCRYPTION_KEY        │
│  5. Store in deployer_wallets table                         │
│  6. After tx completes, dust remains (~0.02-0.04 SOL)       │
└─────────────────────────────────────────────────────────────┘

Dust Recovery Flow:
┌─────────────────────────────────────────────────────────────┐
│  1. Admin clicks "Scan Balances" on admin page              │
│  2. Edge function fetches all deployer wallets from DB      │
│  3. Checks on-chain balance for each                        │
│  4. Updates remaining_sol in database                       │
│  5. Admin clicks "Reclaim All"                              │
│  6. Edge function decrypts keys, transfers dust to treasury │
│  7. Marks wallets as reclaimed                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Estimated Recovery (Future)

With this system in place:
- Each launch leaves ~0.02-0.04 SOL dust
- After 100 future launches: ~2-4 SOL recoverable
- Automated monthly reclaim keeps treasury topped up

---

## Required Secret

Before implementation, you'll need to add:
- `DEPLOYER_ENCRYPTION_KEY` - A 32-character random string for AES-256 encryption

I'll prompt you to add this secret during implementation.
