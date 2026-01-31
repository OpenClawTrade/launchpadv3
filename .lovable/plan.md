# Vanity Address Pre-Generation for Phantom Launches

## Overview
Add optional vanity address generation to Phantom launches. Users can either:
1. **Skip vanity** → Launch immediately with a random mint address
2. **Generate vanity** → Enter a custom suffix, mine in-browser, then launch with the found address

## User Flow

### Option A: No Vanity (Default)
1. Fill in token details
2. Click "Launch" → Launches immediately with random mint

### Option B: Custom Vanity Address
1. Fill in token details
2. Enable "Custom Mint Address" toggle
3. Enter desired suffix (1-5 Base58 chars)
4. Click "Generate" to start mining
5. Progress shows: attempts, rate, elapsed time
6. Once found → Mint address preview shown
7. Click "Launch" (now available) → Uses the generated keypair

## Technical Implementation

### Task 1: Create VanityAddressGenerator Component
**File:** `src/components/launchpad/VanityAddressGenerator.tsx`

A focused component for in-browser vanity address generation:
- Toggle to enable/disable vanity generation
- Suffix input field (1-5 chars, Base58 validation)
- Generate/Stop button
- Progress indicator (attempts, keys/sec, time elapsed)
- Result display (found address)
- Pass generated keypair (hex secret key) to parent

### Task 2: Modify TokenLauncher to Support Vanity Keypair
**File:** `src/components/launchpad/TokenLauncher.tsx`

Changes:
- Add state for vanity keypair: `{ address: string, secretKeyHex: string } | null`
- Add `VanityAddressGenerator` component to Phantom mode UI
- Disable Launch button until vanity is generated (if enabled)
- Pass vanity keypair data to `fun-phantom-create` edge function

### Task 3: Update Edge Function to Accept Pre-Generated Keypair
**File:** `supabase/functions/fun-phantom-create/index.ts`

Changes:
- Accept optional `vanityKeypair: { publicKey: string, secretKeyHex: string }` in body
- If provided, pass to Vercel API instead of letting backend generate random mint

### Task 4: Update Vercel API to Use Pre-Generated Mint
**File:** `api/pool/create-phantom.ts`

Changes:
- Accept optional `vanitySecretKeyHex` parameter
- If provided, reconstruct Keypair from hex and use as mintKeypair
- Skip vanity pool lookup if user already provided their own keypair

## Component Structure

```
TokenLauncher (Phantom Mode)
├── Token Name Input
├── Ticker Input
├── Description
├── Image Upload / AI Generate
├── Social Links (collapsed)
├── Trading Fee Slider
├── VanityAddressGenerator  ← NEW
│   ├── Enable Toggle
│   ├── Suffix Input
│   ├── Generate/Stop Button
│   ├── Progress Display
│   └── Result (found address)
└── Launch Button (disabled until ready)
```

## Data Flow

```
User enters suffix → startGeneration(suffix)
                           ↓
Web Workers mine Ed25519 keypairs in parallel
                           ↓
Found match → result: { address, secretKeyHex }
                           ↓
User clicks Launch → fun-phantom-create({ vanityKeypair: {...} })
                           ↓
Edge function forwards to Vercel API with keypair
                           ↓
Vercel reconstructs Keypair and uses as mintKeypair
                           ↓
Token minted with custom vanity address!
```

## Security Considerations

1. **Client-side generation**: Private keys never leave the browser until launch
2. **Hex encoding**: Secret keys passed as hex, reconstructed on backend
3. **Single use**: Each generated keypair can only be used once
4. **No persistence**: Keypairs not stored in database (user generates fresh)

## UI States

| State | Generate Button | Launch Button |
|-------|----------------|---------------|
| Vanity disabled | Hidden | Enabled |
| Vanity enabled, no suffix | Disabled | Disabled |
| Vanity enabled, valid suffix | "Generate" | Disabled |
| Generating | "Stop" (spinner) | Disabled |
| Found | Reset available | Enabled ✓ |

## Estimated Complexity

- VanityAddressGenerator component: ~150 lines
- TokenLauncher modifications: ~50 lines  
- Edge function changes: ~30 lines
- Vercel API changes: ~20 lines

**Total: ~250 lines of new/modified code**
