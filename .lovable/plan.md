

## Emergency Stop + Full Reset

### Root Cause
The cron jobs (job 43: execute every 2min, job 44: monitor every 1min) were **never disabled** in the previous implementation. They remained `active: true` the entire time, so the agent kept buying MILK, TULSA, PISS while we were supposedly "resetting."

### Step-by-step Execution

#### Step 1: Immediately disable both cron jobs
Run SQL to set both jobs to inactive:
```
SELECT cron.alter_job(43, active := false);
SELECT cron.alter_job(44, active := false);
```
This stops ALL buying and monitoring instantly.

#### Step 2: Force-sell everything in the wallet
Re-call the updated `trading-agent-force-sell` with `sellAll: true` to dump all tokens (MILK, TULSA, and any others still in the wallet). Verify via the edge function logs that actual Jupiter swaps executed with real signatures.

#### Step 3: Verify on-chain
After force-sell, check the wallet on Solscan to confirm zero token balances remain. If any tokens persist, debug the force-sell function to understand why specific sells failed.

#### Step 4: Wipe ALL database records
- Delete all rows from `trading_agent_positions` for this agent
- Delete all rows from `trading_agent_trades` for this agent
- Reset agent stats to zero (total_trades, winning/losing trades, profit, win_rate, best/worst trade)
- Sync `trading_capital_sol` with actual on-chain SOL balance

#### Step 5: Confirm clean state with you
- Show agent profile page is blank
- Show wallet on Solscan has no tokens
- Cron jobs confirmed inactive

#### Step 6: Wait for your "go"
Only re-enable cron jobs when you explicitly say to start trading again.

### Why it failed last time
The plan called for disabling cron jobs in "Step 4" but it was never actually executed as SQL. The focus was on fixing Jupiter API and updating the force-sell code, but the critical `cron.alter_job(active := false)` commands were never run. This time, disabling the crons is Step 1 -- the very first action before anything else.

