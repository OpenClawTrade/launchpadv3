# PopShiba V4 — Compilation Pipeline (zero-touch)

## How it works

1. You edit any `contracts/popshiba/v4/*.sol`.
2. Lovable auto-pushes to GitHub.
3. `.github/workflows/compile-popshiba-v4.yml` runs Foundry (viaIR + optimizer 200, EVM cancun, solc 0.8.26) and writes the 5 artifacts to `supabase/functions/popv4-deploy-factory/artifacts/`.
4. That commit syncs back into Lovable. The deploy edge function bundle now contains the fresh ABI + bytecode.
5. Calling `popv4-deploy-factory` reads them straight off disk — no storage bucket, no GitHub fetch, no secrets.

## One-time prerequisite

Connect GitHub via **Lovable → top-right → GitHub → Connect**. That's the only manual step. After that, every contract edit auto-rebuilds.

## Manual rebuild

Repo → **Actions → "Compile PopShiba V4 contracts" → Run workflow**.

## Curve params (testnet-safe)

- Graduation threshold: **0.1 ETH**
- Total supply: 1B · curve: 792.857M · LP: 207.143M
- Fee: 1% (50/50 creator/treasury)
