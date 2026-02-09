

# Remove "DB-Tracked" Label from Open Positions

## What's Changing
The "Open Positions" section currently displays the title **"Open Positions (DB-Tracked)"**, which is an internal/debug label that shouldn't be shown to users. We'll clean this up to just say **"Open Positions"**.

## Technical Changes

### File: `src/pages/TradingAgentProfilePage.tsx`
- **Line 358**: Change `Open Positions (DB-Tracked)` to `Open Positions`

Single one-line change -- no logic or structural modifications needed.

