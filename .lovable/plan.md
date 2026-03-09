

## Diagnosis: Persistent "Failed to Build" Error

After thorough investigation, here is what I found:

### Root Causes Identified

**1. Out-of-Memory (OOM) during Vite build**
- The project has **71 page files**, **160+ edge functions**, and massive dependencies: `@solana/web3.js`, `viem`, `wagmi`, `@rainbow-me/rainbowkit`, `@meteora-ag/*`, `recharts`, etc.
- `FunLauncherPage` is **eagerly imported** (line 24 of `App.tsx`) while all other pages use lazy loading. This forces Rollup to process its entire dependency tree upfront, significantly increasing peak memory usage during bundling.
- The generic "failed to build" with no specific error message is the classic signature of a build runner OOM crash.

**2. Duplicate `serve()` in edge function**
- `supabase/functions/x-bot-scan/index.ts` has 481 lines. The disabled stub ends at line 9, but lines 203-481 contain a **second `serve()` call that is NOT commented out**. This causes an edge function deploy failure, which may cascade to block the overall project build.

### Plan

**Step 1: Make FunLauncherPage lazy-loaded** (`src/App.tsx`)
- Change the eager import on line 24 to use `lazyWithRetry()` like every other page
- Wrap its Route usage in `<Suspense>` with the `RouteLoader` fallback
- This dramatically reduces the initial bundle graph Rollup must process in one pass

**Step 2: Truncate dead code in x-bot-scan** (`supabase/functions/x-bot-scan/index.ts`)
- Keep only lines 1-9 (the disabled stub with single `serve()` call)
- Delete lines 10-481 entirely (unreachable dead code with duplicate `serve()`)
- This removes the edge function deploy blocker

**Step 3: Add build memory optimization** (`vite.config.ts`)
- Set `build.target: 'esnext'` to skip unnecessary syntax transforms
- Set `build.minify: 'esbuild'` (faster, less memory than terser)
- Increase `build.chunkSizeWarningLimit` to avoid Rollup spending resources on warnings

These three changes together address both the memory pressure (Steps 1 & 3) and the edge function deploy failure (Step 2) that are causing the persistent build failures.

