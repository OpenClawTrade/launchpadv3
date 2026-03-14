
## Remove Default `/t/` Website URL Fallbacks

### Problem
When no website URL is provided during token launch, the code auto-populates it with `https://clawsai.fun/t/TICKER` or `https://tuna.fun/t/TICKER`. These `/t/` pages don't exist and never worked.

### Changes

**1. `api/pool/create-phantom.ts` (line 286)**
Change `websiteUrl || 'https://clawsai.fun/t/${tokenSymbol}'` → `websiteUrl || undefined`

**2. `api/pool/create.ts` (line 139)**
Change `websiteUrl || 'https://tuna.fun/t/${tokenSymbol}'` → `websiteUrl || undefined`

Both files: when `websiteUrl` is empty/null, the metadata will simply have no website field instead of a broken link.
