

# Punch - Tap-to-Launch Token Game

## Overview
A new `/punch` page where users enter their Solana wallet, then play a fast-tapping mini-game. Tap fast enough to fill a progress bar to 100%, and a token is auto-created with an AI-generated "punch monkey" image. Rate limited to 1 launch per 3 minutes per IP.

## How It Works

1. **Entry screen**: User enters their Solana wallet address
2. **Game screen**: A monkey image appears with a progress bar. User taps/clicks as fast as possible -- ~50 taps needed, but speed matters (taps decay if you slow down)
3. **On 100%**: AI generates a monkey-themed token image, auto-generates a name/ticker, and launches the token via the existing `fun-create` edge function
4. **Result screen**: Shows the contract address, Solscan link, and trade link

## Fun Animations (All of the above)

- **Screen shake** on each tap (CSS transform jitter)
- **Punch impact burst** -- radial flash at tap point
- **Combo counter** -- shows streak count with growing text ("10x COMBO!")
- **Speed multiplier** -- progress fills faster when tapping quickly, decays when slow
- **Confetti explosion** when bar hits 100%
- **Rocket launch animation** -- monkey rockets off screen on success
- **Tap ripples** -- circular ripple effects from click/touch position
- **Progress bar color shift** -- green to yellow to red/orange as it climbs

## Rate Limiting
- 1 launch per 3 minutes per IP address
- Uses existing `launch_rate_limits` table + a new edge function `punch-launch` that enforces 3-minute cooldown
- Shows countdown timer if rate limited

---

## Technical Details

### New Files

**`src/pages/PunchPage.tsx`**
- Main page component with three states: `wallet-entry`, `tapping`, `launching`, `result`
- Wallet input with Solana address validation
- Tap game logic:
  - Track taps and speed (taps per second)
  - Progress = accumulated from taps, but decays over time if user stops
  - ~50 fast taps to reach 100%
  - Screen shake via CSS class toggled on each tap
  - Combo counter increments on fast consecutive taps (less than 300ms apart)
- On completion: calls `punch-launch` edge function
- Result screen with contract address, copy button, links

**`src/components/punch/PunchMonkey.tsx`**
- The central monkey visual with punch impact animations
- CSS animations for shake, impact burst, scale bounce on tap
- Idle bobbing animation when not being tapped

**`src/components/punch/ComboCounter.tsx`**
- Floating combo text that scales up with streak
- Multiplier display (2x, 5x, 10x etc.)
- Fade-out when combo breaks

**`src/components/punch/PunchConfetti.tsx`**
- Canvas-based confetti explosion on 100%
- Particles in brand colors

**`supabase/functions/punch-launch/index.ts`**
- Edge function that:
  1. Checks IP-based rate limit (1 per 3 minutes) using `launch_rate_limits` table
  2. Calls AI gateway to generate a "punch monkey" themed name + ticker
  3. Calls AI image generation (gemini-2.5-flash-image) with a prompt specifically about a plush monkey and real monkey together doing something funny/viral
  4. Uploads the generated image to storage
  5. Calls the existing `fun-create` flow (Vercel API) to actually create the token on-chain
  6. Returns the mint address and token ID

### Modified Files

**`src/App.tsx`**
- Add lazy import for `PunchPage`
- Add route: `<Route path="/punch" element={<PunchPage />} />`

### AI Image Generation Prompt
The edge function will use a prompt like:
> "Generate a funny meme image of a plush stuffed monkey toy and a real baby monkey together in a hilarious situation. Style: viral meme, punchy colors, square 1:1. No text in the image."

This ensures every generated image follows the "plush + real monkey together" theme from the reference image.

### AI Name/Ticker Generation
Uses tool calling to extract structured output:
- Function: `generate_punch_token` with fields `name` (string), `ticker` (string, 3-6 chars)
- Prompt: "Generate a funny, viral meme coin name and ticker themed around monkeys punching things"

### Database
No new tables needed -- reuses existing `launch_rate_limits` and `fun_tokens` tables. The 3-minute window check is done in the edge function by querying recent entries.

