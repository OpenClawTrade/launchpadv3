

# Claw Agent: Playful SOL Tipping in Console Chat

## Overview
Give the Claw bot in the Console chat the ability to **randomly decide** to send small amounts of SOL to users who beg for it. The bot will be playful and unpredictable -- sometimes teasing, sometimes actually sending. A hard cap of **3% of the Claw treasury balance** per tip ensures the wallet is never drained.

## How It Works

1. When a user sends a message in the Console, the `console-chat` edge function detects if the message is "begging" (mentions sending SOL, tokens, money, etc.)
2. The AI generates its reply as usual (playful, teasing)
3. **After** generating the reply, the function rolls a random chance (~15-25%) to actually send SOL
4. If it decides to send:
   - Checks the Claw treasury balance
   - Picks a random amount between 0.001 and 3% of the balance
   - Requires the user to have a wallet address (logged-in users only -- guests can't receive)
   - Sends the SOL on-chain
   - Appends a follow-up bot message like "ok fine... sent you 0.02 SOL. don't tell anyone"
5. If it decides NOT to send, the teasing reply stands on its own

## Database Changes

### Add `wallet_address` column to `console_messages`
This lets the edge function know WHERE to send SOL when a logged-in user is chatting. The frontend will pass the user's wallet address along with messages.

```sql
ALTER TABLE public.console_messages ADD COLUMN wallet_address text;
```

### New table: `console_tips`
Track all tips sent by the bot for auditing and preventing abuse.

```sql
CREATE TABLE public.console_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_wallet text NOT NULL,
  recipient_display_name text NOT NULL,
  amount_sol numeric NOT NULL,
  signature text NOT NULL,
  treasury_balance_before numeric,
  message_id uuid REFERENCES public.console_messages(id),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- RLS: public read, no public write
ALTER TABLE public.console_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read tips" ON public.console_tips FOR SELECT TO anon, authenticated USING (true);
```

## Technical Changes

### 1. Modified: `supabase/functions/console-chat/index.ts`
Major updates to the edge function:

- **Begging detection**: Simple keyword matching (send, sol, tip, money, airdrop, give me, etc.)
- **Wallet resolution**: Accept `walletAddress` from the request body
- **SOL sending logic**:
  - Uses `CLAW_TREASURY_PRIVATE_KEY` (already configured) and `HELIUS_RPC_URL`
  - Checks treasury balance
  - Random amount = `0.001 + Math.random() * (balance * 0.03 - 0.001)` (capped at 3%)
  - Additional cooldown: max 1 tip per user per 10 minutes (checked via `console_tips` table)
  - Sends via `@solana/web3.js` SystemProgram transfer
- **Follow-up message**: If SOL is sent, saves a second bot message announcing it
- **Updated system prompt**: Tell the AI it CAN actually send SOL sometimes, making responses more dynamic

### 2. Modified: `src/pages/ConsolePage.tsx`
- Pass `walletAddress` in the request body when sending messages (for logged-in users)
- Add visual indicator for tip messages (e.g., a small SOL icon next to messages that contain "sent you")

### 3. Updated system prompt in `console-chat`
The WALLET section becomes:

```
WALLET: You have a Solana wallet and you CAN send SOL to people.
You don't always do it — you're unpredictable. Sometimes you tease,
sometimes you actually send. Be playful about it:
- "hmm maybe... convince me"
- "why should I? what's in it for the lobster?"
- "ok fine you wore me down" (when you actually send)
- NEVER promise specific amounts
- If someone doesn't have a wallet connected, tell them to log in first
```

## Security Safeguards

- **3% balance cap**: Never sends more than 3% of the current treasury balance in a single tip
- **Cooldown**: 1 tip per wallet per 10 minutes (prevents spam-begging)
- **Minimum balance**: Won't tip if treasury is below 0.5 SOL
- **Logged-in only**: Guests cannot receive tips (no wallet address)
- **Audit trail**: Every tip recorded in `console_tips` with signature and balance snapshot
- **Random chance**: Only ~15-25% probability even when begging is detected

## Flow Diagram

```text
User sends message
       |
       v
  Save message to DB
       |
       v
  Generate AI reply (playful/teasing)
       |
       v
  Is message "begging"?
     /     \
   No       Yes
   |         |
   v         v
 Save     Has wallet? --> No --> Save reply + "log in to receive tips"
 reply       |
             Yes
             |
             v
         Roll random (15-25%)
          /        \
       Miss        Hit
        |            |
        v            v
     Save         Check cooldown
     teasing      Check balance (>0.5 SOL)
     reply        Calculate amount (max 3%)
                     |
                     v
                  Send SOL on-chain
                     |
                     v
                  Save tip record
                  Save follow-up message:
                  "ok fine... sent you X SOL"
```

