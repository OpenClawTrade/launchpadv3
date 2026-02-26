

# Livestream Video Box on Punch Page

## Overview
Add a fake "livestream" style video box at the top of the main game area on the Punch page. It will loop the user's uploaded videos infinitely, styled to look like a live broadcast with a real-time timestamp overlay and a "LIVE" indicator badge.

## Video Upload
- The user needs to upload the two MP4 files directly in chat (WeTransfer links can't be downloaded programmatically)
- Videos will be placed in the `public/` directory for static serving (e.g. `public/videos/punch-stream-1.mp4`, `public/videos/punch-stream-2.mp4`)

## New Component: `PunchLivestream`
**File:** `src/components/punch/PunchLivestream.tsx`

- A styled video container that looks like a livestream window
- Features:
  - Looping `<video>` element (autoplay, muted, loop, playsInline) cycling between the two videos
  - Red "LIVE" badge with pulsing dot animation in the top-left corner
  - Real-time clock timestamp (HH:MM:SS format) in the top-right corner, updating every second
  - Rounded corners, border, subtle shadow -- matches the meme/dark UI style
  - Aspect ratio roughly 16:9 or square depending on videos
  - On video end of first clip, switches to the second, then back (infinite loop)

## Layout
- The livestream box sits at the top of the main game content area (above the wallet entry / tapping sections)
- Max width constrained (~400px) so it doesn't dominate the page
- Visible in all game states (wallet-entry, tapping, launching, result)

## Styling Details
- Dark overlay gradient at top for the LIVE badge and timestamp readability
- "LIVE" badge: red background, white text, small pulsing red dot
- Timestamp: monospace font, white/light text with slight text shadow
- Border styled like a monitor/camera feed frame

## Files to Create
1. `src/components/punch/PunchLivestream.tsx` -- video player component with LIVE overlay and clock

## Files to Modify
1. `src/pages/PunchPage.tsx` -- add `PunchLivestream` component above the game content area

## Technical Notes
- Videos autoplay muted (browser requirement for autoplay)
- Uses `onEnded` event to switch between the two video sources for seamless looping
- Clock uses `setInterval` updating every second, cleaned up on unmount
- No database changes needed

