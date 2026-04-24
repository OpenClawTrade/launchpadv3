# PopShiba V4 — Compilation Pipeline

Solidity contracts in this folder are compiled by **GitHub Actions** (not the
Lovable edge runtime — viaIR + this dependency graph blew the 256MB cap).

## Flow

1. You edit any `contracts/popshiba/v4/*.sol` file.
2. Lovable auto-pushes to GitHub.
3. `.github/workflows/compile-popshiba-v4.yml` triggers, runs **Foundry** with
   `viaIR + optimizer 200`, extracts ABI + bytecode for the 5 contracts, and
   uploads each as `v4/<Name>.json` to the **`contract-artifacts`** Cloud
   storage bucket (also published as a downloadable workflow artifact).
4. The `popv4-deploy-factory` edge function reads those JSONs at deploy time.

## One-time setup

In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Get from Lovable Cloud settings → API keys → `service_role` |

That's it. After the first push, every contract change auto-recompiles in ~90s.

## Manual trigger

Repo → **Actions → "Compile PopShiba V4 contracts" → Run workflow**.

## Current curve params

- Graduation threshold: **0.1 ETH** (testnet-safe cap)
- Total supply: 1B, curve: 792.857M, LP: 207.143M
- Fee: 1% (50/50 creator/treasury split)
