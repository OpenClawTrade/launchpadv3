
## Fix: Enable Trading Agent Creation for !clawmode Token Launches

### Root Cause
When tokens are launched via `!clawmode` on X, the `agent-process-post` function creates an `agents` row and a `fun_tokens` row, but **never creates a `trading_agents` row**. This means:
- No trading wallet keypair is generated or stored
- `is_trading_agent_token` stays `false` on the fun_token
- `trading_agent_id` is never set
- `fun-distribute` skips these tokens for trading fee routing
- Funding progress shows 0 because there's nothing to fund

The `trading-agent-create` function handles all this correctly, but `agent-process-post` doesn't use any of that logic.

### The Fix
After `agent-process-post` creates the `agents` row and launches the token, add a new block that:

1. **Generates a Solana keypair** for the trading agent (using the same pattern as `trading-agent-create`)
2. **Encrypts the private key** with AES-256-GCM (same encryption as existing system)
3. **Creates a `trading_agents` row** with the wallet, encrypted key, strategy defaults, and links to the agent
4. **Updates the `fun_tokens` row** to set `is_trading_agent_token = true` and `trading_agent_id`

This ensures every `!clawmode` launch automatically gets a trading agent with a saved private key, enabling fee routing and eventual auto-trading.

### Also: Fix the 3 Existing Tokens
Create a one-time data fix for the 3 already-launched tokens that are missing trading agents. For each:
- Generate a new keypair
- Create the `trading_agents` row
- Update the `fun_tokens` row with the link

### Files Changed

**`supabase/functions/agent-process-post/index.ts`**
- Add keypair generation imports (same as `trading-agent-create`)
- Add `encryptPrivateKey()` helper function
- After the fun_token insert/update block (around line 1675), add ~50 lines that:
  - Generate a Solana Keypair
  - Encrypt the private key using `WALLET_ENCRYPTION_KEY` secret
  - Insert into `trading_agents` table with strategy defaults (balanced: 20% SL, 50% TP, 3 max positions)
  - Update `fun_tokens` to set `trading_agent_id`, `is_trading_agent_token = true`
  - Log success/failure

**One-time fix for existing tokens** -- manual SQL or edge function call to:
- Create `trading_agents` rows for the 3 existing agent tokens
- Update their `fun_tokens` rows with `is_trading_agent_token = true`

### Technical Details

New code block in `agent-process-post` (after fun_token creation, ~line 1675):

```typescript
// === CREATE TRADING AGENT WITH WALLET ===
if (funTokenId && agent?.id) {
  try {
    const Keypair = (await import("https://esm.sh/@solana/web3.js@1.87.6")).Keypair;
    const { encode: encodeBase58 } = await import("https://esm.sh/bs58@5.0.0");
    
    const keypair = Keypair.generate();
    const walletAddress = keypair.publicKey.toBase58();
    const privateKeyBase58 = encodeBase58(keypair.secretKey);
    
    const encryptionKey = Deno.env.get("WALLET_ENCRYPTION_KEY") || "opentuna-default-key-change-in-production";
    const encryptedKey = await encryptPrivateKey(privateKeyBase58, encryptionKey);
    
    const { data: tradingAgent, error: taError } = await supabase
      .from("trading_agents")
      .insert({
        name: cleanName,
        ticker: cleanSymbol,
        description: parsed.description || null,
        avatar_url: finalImageUrl,
        wallet_address: walletAddress,
        wallet_private_key_encrypted: encryptedKey,
        agent_id: agent.id,
        fun_token_id: funTokenId,
        mint_address: mintAddress,
        creator_wallet: parsed.wallet || null,
        strategy_type: "balanced",
        stop_loss_pct: 20,
        take_profit_pct: 50,
        max_concurrent_positions: 3,
        max_position_size_sol: 0.1,
        status: "pending",
        trading_capital_sol: 0,
      })
      .select("id")
      .single();
    
    if (tradingAgent?.id) {
      await supabase
        .from("fun_tokens")
        .update({
          trading_agent_id: tradingAgent.id,
          is_trading_agent_token: true,
          agent_fee_share_bps: 3000, // 30% to agent per 30/30/40 split
        })
        .eq("id", funTokenId);
      
      console.log(`[agent-process-post] Trading agent created: ${tradingAgent.id}, wallet: ${walletAddress}`);
    }
  } catch (taErr) {
    console.error("[agent-process-post] Failed to create trading agent:", taErr);
    // Non-fatal - token still works, just won't have auto-trading
  }
}
```

The `encryptPrivateKey()` helper is copied from the existing `trading-agent-create` function (AES-256-GCM with SHA-256 key derivation).

### Security
- Private keys are encrypted at rest using AES-256-GCM
- The encryption key comes from the `WALLET_ENCRYPTION_KEY` secret (already configured)
- Keys are stored in `trading_agents.wallet_private_key_encrypted` (existing column)
- Only admin functions (`admin-export-wallet`) can decrypt them
