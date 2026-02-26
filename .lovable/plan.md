

# Fix: Prevent Multiple Token Launches from Single Game Session

## Problem
There's a race condition causing multiple tokens to launch from a single punch game. When progress reaches 100%, the code does `setTimeout(() => launchToken(), 1500)` but keeps `state` as `"tapping"` during that 1.5-second delay. Every additional tap during that window triggers another `setTimeout`, each calling `launchToken()` independently -- resulting in 5-10+ tokens being created from one session.

## Solution
Add a `useRef` guard (`launchTriggered`) that is set to `true` immediately when the win condition fires, preventing any subsequent taps from scheduling additional launches.

## Changes

### File: `src/pages/PunchPage.tsx`

1. **Add a ref** to track whether launch has been triggered:
   ```typescript
   const launchTriggered = useRef(false);
   ```

2. **Guard the win condition** -- set the ref immediately (synchronously, before the setTimeout):
   ```typescript
   if (progressRef.current >= 100 && tapCount.current >= REQUIRED_TAPS) {
     if (launchTriggered.current) return; // Already triggered
     // ... wallet check ...
     launchTriggered.current = true; // Prevent re-entry
     setShowConfetti(true);
     setTimeout(() => launchToken(), 1500);
   }
   ```

3. **Reset the guard** in the "Launch Another" button handler and on error:
   ```typescript
   launchTriggered.current = false;
   ```

This is a single-file fix with 4 small edits. No backend changes needed.
