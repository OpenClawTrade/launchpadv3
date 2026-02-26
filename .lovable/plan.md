

# Floating Monkey Video Popup

## What
A small square video popup pinned to the bottom-right corner of the screen on all pages. Shows the looping monkey livestream video with a LIVE badge. Clicking the video navigates to `/console` (the chat page). An X button lets users dismiss it. Persists dismissal in localStorage so it doesn't reappear until next session.

## Design
- **Size**: 120x120px on mobile, 160x160px on desktop
- **Position**: Fixed bottom-right corner with some margin
- **Z-index**: High (z-50) so it floats above content
- **Elements**: Square video (aspect-ratio 1:1, object-cover), small LIVE badge (top-left), X close button (top-right)
- **Click**: Navigates to `/console`
- **Close**: X button sets state to hidden, saved in sessionStorage
- **Excluded pages**: Don't show on `/console` itself, or on `/punch`/`/punch-test` where the full livestream already exists

## Technical Plan

### New file: `src/components/punch/PunchVideoPopup.tsx`
- Floating fixed-position component
- Reuses the same `VIDEOS` array and looping logic from PunchLivestream
- Uses `useNavigate` from react-router-dom to go to `/console` on click
- Close button with `X` icon, stops propagation
- `sessionStorage` key `punch-video-dismissed` to remember dismissal
- Checks `useLocation` to hide on `/console`, `/punch`, `/punch-test`

### Edit: `src/App.tsx`
- Import and render `<PunchVideoPopup />` inside the BrowserRouter, alongside the other global components (StickyStatsFooter, etc.)

