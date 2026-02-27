

# Fix: Prevent Multiple Token Launches on Punch

## Problem
When progress hits 100%, every additional tap schedules another `setTimeout(() => launchToken(), 1500)`. There is **no guard ref** to prevent this, so 10 extra taps = 10 token launches.

The similar names issue comes from the AI prompt being too narrow ("monkey/ape" theme) -- it runs out of ideas quickly when many tokens exist.

## Solution

### 1. Add a `launchTriggered` ref guard (PunchTestPage.tsx)

- Add `const launchTriggered = useRef(false);` alongside the other refs
- At the top of `handleTap`, return immediately if `launchTriggered.current` is true
- Set `launchTriggered.current = true` **synchronously** right when progress hits 100%, before the setTimeout
- Reset it in `resetGame()`

### 2. Improve name uniqueness (punch-launch edge function)

- Add a `temperature: 1.5` parameter to the AI name generation call to increase randomness
- Expand the system prompt to encourage more creative, diverse names beyond just "monkey species" -- include themes like jungle fruits, tropical animals, zoo characters, safari vibes
- Add an explicit instruction: "Your name and ticker MUST NOT be similar-sounding to any blacklisted entry"

## Files Changed

| File | Change |
|------|--------|
| `src/pages/PunchTestPage.tsx` | Add `launchTriggered` ref, guard in `handleTap`, reset in `resetGame` |
| `supabase/functions/punch-launch/index.ts` | Add `temperature: 1.5`, broaden AI prompt for more diversity |

