

## Update Launch Countdown with Token CA

The `LaunchCountdown` component currently shows a static "to be announced" message (since the countdown expired on Feb 18). This update will replace that with the live token announcement featuring the contract address.

### Changes

**File: `src/components/LaunchCountdown.tsx`**

Update the expired state (lines 35-41) to:
- Display "$CLAW is LIVE" instead of "to be announced"
- Show the contract address `EahUihCyvsJVg8wWafXc5ytxaReFXms514wKvmBQCLAW` with a click-to-copy feature
- Add a "Trade Now" link pointing to the launchpad page (`/launchpad/EahUihCyvsJVg8wWafXc5ytxaReFXms514wKvmBQCLAW`)
- Keep the compact green styling but make it more prominent for a live token

### Technical Details

- Add a copy-to-clipboard handler using `navigator.clipboard.writeText()`
- Use `sonner` toast to confirm copy
- Link to internal trade page via React Router `Link`
- CA will be displayed truncated (first 6 + last 4 chars) with full address on hover/copy
- The component stays compact when used in the launchpad page header

