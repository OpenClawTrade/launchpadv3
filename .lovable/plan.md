

## Fix: Top Protocols Icon Issues

### Problems Found

1. **`pumpswap-icon.png`** — The file contains an HTML redirect page, not an actual image. This is why PumpSwap shows no image at all. The file was likely downloaded incorrectly from a URL that redirected.

2. **SolFi uses Raydium's icon** — Lines 42-43 explicitly map SolFi to `raydiumIcon`. There is no SolFi icon asset in the project.

### Fix

1. **PumpSwap icon** — Download the real PumpSwap icon image and overwrite `src/assets/pumpswap-icon.png`. PumpSwap's actual icon can be fetched from a reliable source (e.g., DeFi Llama's icon CDN: `https://icons.llamao.fi/icons/protocols/pumpswap`).

2. **SolFi icon** — Download a proper SolFi icon (from `https://icons.llamao.fi/icons/protocols/solfi` or similar) and save it as `src/assets/solfi-icon.png`. Then:
   - Add `import solfiIcon from "@/assets/solfi-icon.png"` to MarketLighthouse.tsx
   - Change lines 42-43 from `raydiumIcon` to `solfiIcon`
   - Change line 60 fuzzy match from `raydiumIcon` to `solfiIcon`

3. **Fallback** — Line 61 currently falls back to `raydiumIcon` for any unrecognized protocol. This should use a generic placeholder or the protocol's first letter instead.

### Files Changed
- `src/assets/pumpswap-icon.png` — Replace with real PumpSwap icon image
- `src/assets/solfi-icon.png` — New file, SolFi protocol icon
- `src/components/layout/MarketLighthouse.tsx` — Fix SolFi mapping + generic fallback

