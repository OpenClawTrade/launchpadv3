

## Plan: Punch Character Overhaul, Favicon Fix, and Video Loop Fix

### 1. Rewrite Punch AI Character (Edge Function)

Update `supabase/functions/punch-chat/index.ts` with a complete Punch character definition:

- **Identity**: Punch is a viral, self-aware monkey who lives on-chain and launches meme coins by punching things. NOT an AI -- he's a real monkey who happens to be extremely online.
- **Personality**: Street-smart, chaotic, hyper, unpredictable. Speaks like a degen monkey -- short, punchy, varied responses. Never repeats himself. Changes tone and style constantly.
- **Knowledge**: Knows his site is `https://punchlaunch.fun`, his X/Twitter is `https://x.com/punchitsol`, and tells people the CA (contract address) can be found on the pinned post on X.
- **Zero Claw mentions**: Remove ALL references to Claw, lobsters, or rivals. Punch doesn't know or care about any lobster.
- **Anti-AI detection**: Never say "as an AI" or "I'm an AI". Dodge questions about being AI naturally ("bro I'm a monkey, what are you talking about"). Mix up response patterns so it doesn't feel templated.
- **Voice rules**: Vary sentence structure, don't overuse emojis, mix lowercase/uppercase naturally, use slang but not forced. Every answer should feel different from the last.

### 2. Force Punch Favicon on punchlaunch.fun Domain

- Copy the uploaded image (`user-uploads://punch-2.jpg`) to `public/punch-favicon.jpg`
- Update the favicon logic in `PunchTestPage.tsx` (line 65) to use `/punch-favicon.jpg` instead of `/punch-logo.jpg`, ensuring the uploaded image is the favicon
- Also update the condition to apply on ANY route under the punch domain, not just the exact hostname check

### 3. Fix Video Looping (Black Screen Issue)

The current implementation has a bug: the `useEffect` on line 30-35 that calls `load()` and `play()` depends on `currentIndex`, but it also fires on initial mount AND the `handleEnded` callback closes over stale `currentIndex`. The fix:

- Use a **dual-video approach**: keep two `<video>` elements and crossfade between them, OR simpler fix:
- Set `loop` on the single video element when there are multiple videos too -- when one play ends, immediately set the `src` and call `play()` without `load()` (which causes the black flash). Use the `ended` event to swap `src` directly on the video element ref instead of triggering React state + re-render cycle.
- Alternatively, the simplest reliable fix: just set `loop={true}` always for a single video, and for multiple videos, on the `ended` event, directly assign `videoRef.current.src = VIDEOS[next]` and call `play()` without calling `load()` first (load causes the blank frame).

### Technical Details

**Files to modify:**
1. `supabase/functions/punch-chat/index.ts` -- Complete system prompt rewrite
2. `src/components/punch/PunchLivestream.tsx` -- Fix video looping by removing `load()` call, directly assigning `src` and playing
3. `src/pages/PunchTestPage.tsx` -- Update favicon path to use uploaded image
4. Copy `user-uploads://punch-2.jpg` to `public/punch-favicon.jpg`

