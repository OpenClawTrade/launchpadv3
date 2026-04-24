## Plan

Replace the current `v4-instant` implementation with a true Klik-parity implementation. The current code is not equivalent: it uses a custom minimal token, a different fee path, a different swap-fee currency model, and launch-time tick geometry driven by presets. I will stop iterating on that approximation and instead port the Klik model exactly, with the only intentional change being the fee percentages/split.

### What will be built

1. **Port Klik contracts 1:1 into a new PopKlik set**
   - Add `PopKlikToken.sol` as a direct Klik-style token port:
     - 1B supply minted to factory
     - 3-block anti-snipe / launch-block guard
     - `receive()` to accumulate creator ETH fees
     - `withdrawFees()` path for factory collection
   - Add `PopKlikFactory.sol` as a direct Klik-style factory port:
     - same single global factory pattern
     - same `liquidityConfigs` structure and default config geometry
     - same single-sided LP initialization path
     - same anti-sniper penalty curve on launch buy
     - same Universal Router / Permit2 dev-buy flow
     - same creator fee collection flow
   - Add `PopKlikHook.sol` as a direct Klik hook port:
     - same hook permission model and mined address requirements
     - same fee collection semantics
     - same fee currency behavior as Klik: creator/platform fees paid in ETH, not token
     - same “no fee in deployment block” behavior
     - same market-cap based lookup machinery, but with PopShiba’s fee percentages substituted into the tier table logic

2. **Match Klik liquidity geometry exactly**
   - Remove the current `targetMarketCapEth -> initialTick -> wide range` approximation from the actual launch flow.
   - Use the Klik default config values from the reference as the canonical launch config:
     - `sqrtPriceX96 = 2505411999795360582221170761428213`
     - `tickLower = -887200`
     - `tickUpper = 207200`
     - `amount0Desired = 0`
     - `amount1Desired = 1e27`
     - `virtualAmount = 1 ether`
     - `penaltyMultiplier = 50`
   - Preserve exact launch behavior: single-sided LP below/at Klik’s chosen geometry and router-based atomic creator buy, instead of the current custom swap-inside-factory approach.

3. **Keep only the allowed business change**
   - Do not change architecture, timing, routing, storage model, or fee currency.
   - Only change the fee numbers so PopShiba gets a flat 50/50 split while preserving Klik’s mechanism.
   - Concretely: implement the same fee-tier plumbing but override the tiers to PopShiba’s approved values. If you want a single flat tier everywhere, I will set that inside the same tier system rather than changing the hook model.

4. **Replace deployment and launch tooling**
   - Update the deploy edge flow to deploy the new PopKlik hook/factory artifacts, including CREATE2 salt mining for the exact permission bits required by the Klik-style hook.
   - Update the launch edge function to build calldata for `deployCoin(...)` using the Klik-style config ID flow, not the current `launch((name,symbol,sqrtPriceX96,tickLower,tickUpper))` flow.
   - Regenerate all deployment artifacts from the new contracts before any redeploy.

5. **Wire the real user path**
   - Wire the existing launch path that matters for PopShiba’s main experience, not just the `/popv4instant` sandbox page.
   - Keep the hidden launcher/iframe flow aligned with the new PopKlik contracts so the main page launches through the exact Klik-style path.
   - Deprecate or clearly isolate the current `v4-instant` approximation so it cannot be mistaken for parity code.

6. **Verification before handoff**
   - Compare contract behavior against the Klik reference and the provided mainnet transaction behavior.
   - Verify these parity checkpoints before redeploy:
     - same LP range/config
     - same fee currency behavior
     - same launch-block no-fee behavior
     - same creator fee accrual path via token/factory
     - same anti-sniper tax curve
     - same atomic creator buy flow
   - Then redeploy the new hook/factory and retest launch estimation.

## Technical details

### Current mismatches that will be removed

- `contracts/popshiba/v4-instant/PopInstantToken.sol` is a custom minimal token, not Klik-token behavior.
- `contracts/popshiba/v4-instant/PopInstantFactory.sol` performs a custom in-factory swap path, not Klik’s router-driven launch flow.
- `contracts/popshiba/v4-instant/PopInstantHook.sol` currently accrues fees in mixed currencies and differs from Klik’s ETH-fee model.
- `supabase/functions/popv4instant-launch/index.ts` currently derives ticks from presets and sends custom `launch(...)` calldata, which is not Klik-parity.
- `supabase/functions/popv4instant-deploy/index.ts` currently deploys artifacts for the approximate system, not the Klik port.

### Files likely to be changed

- `contracts/popshiba/v4/PopKlikToken.sol` (new)
- `contracts/popshiba/v4/PopKlikFactory.sol` (new)
- `contracts/popshiba/v4/PopKlikHook.sol` (new)
- `supabase/functions/popv4instant-deploy/index.ts` or a renamed Klik deploy function
- `supabase/functions/popv4instant-launch/index.ts` or a renamed Klik launch function
- generated artifacts under `supabase/functions/.../artifacts/`
- launch/deploy UI pages that currently point at the approximate instant flow
- main PopShiba launch wiring if it still targets the old path

### Outcome

After this change, the system will be architecturally Klik-equivalent, with the only intentional difference being PopShiba’s fee percentages/split. No more custom LP geometry, no output-token fee shortcut, and no approximation-based launch path.

If you approve, I’ll implement the exact port and replace the current approximation rather than patching it further.