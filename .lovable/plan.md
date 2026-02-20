

# Update /agents Page: X-Only Launch with !clawmode Command

## Overview
Simplify the Agents page to show that launching coins is **only available via X (Twitter)** using the `!clawmode` command. Remove Telegram and API launch options. Update the hero to clearly explain how the command works -- any name or description auto-generates a coin, and earnings are viewable in the Panel.

## Changes

### 1. AgentHero.tsx -- Major Rewrite
**Remove:**
- Telegram launch card (lines 70-88)
- API launch card (lines 90-109)
- Telegram Alerts CTA button (lines 129-138)

**Update the Twitter launch card to be the single, prominent launch method:**
- Change command from `!clawlaunch` to `!clawmode`
- Tag `@clawmode` instead of `@BuildClaw`
- Expand the card to full width with clear explanation
- Show example: `@clawmode create me a lobster king token` -- emphasizing that the "name" can be any name or description and AI auto-generates the coin
- Add note: "Once launched, go to Panel to see your earnings from fees"
- Update the grid from 3 columns to a single hero-style card

**Update CTA row:**
- Remove "Telegram Alerts" button
- Keep "Help me with Agent Idea", "Agent Documentation", and "Leaderboard" buttons

**Update the launch instructions at the bottom (Technical Specifications):**
- Remove references to API/Telegram methods
- Keep bonding curve, fee structure, agent autonomy, and ownership verification sections

### 2. AgentHowItWorks.tsx -- Simplify Steps
Update the 3 steps:
1. "Tweet @clawmode" -- Post on X with `!clawmode` followed by any name or description
2. "AI Auto-Generates Your Coin" -- AI creates the token identity, image, and deploys it on Solana
3. "Earn 80% of Trading Fees" -- Go to your Panel to track earnings and claim fees

Remove references to API registration and POST endpoints.

### 3. AgentIdeaGenerator.tsx -- Update Launch Command
- Line 368: Change `@ClawMode !tunalaunch` to `@clawmode !clawmode`
- Line 87: Change `includeTunaLogo` to `includeClawLogo` (display text only)
- Line 191: Change "Generating TUNA Meme..." to "Generating Claw Meme..."
- Lines 387-390: Change example prompts from "TUNA astronaut" etc. to "Claw astronaut", "Cyber Claw", "King Claw", "Ninja Claw"
- Line 120: Change download filename from `tuna-meme` to `claw-meme`
- Line 171-172: Update placeholder text from "TUNA" references to "Claw"

### 4. AgentTokenGrid.tsx -- Minor Branding
- Line 62: Change platform filter label from "TUNA" to "Claw" (the `<span>` inside the meteora filter button)

## Technical Details

### Files Modified (4 files):
1. `src/components/agents/AgentHero.tsx` -- Remove Telegram/API cards, update to X-only with `!clawmode`, add Panel earnings note
2. `src/components/agents/AgentHowItWorks.tsx` -- Simplify 3 steps to X-only flow
3. `src/components/agents/AgentIdeaGenerator.tsx` -- Update command references and TUNA branding
4. `src/components/agents/AgentTokenGrid.tsx` -- Minor label fix

### No backend changes needed
All changes are frontend display/text only.
