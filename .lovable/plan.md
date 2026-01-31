
# Fix Token Ticker Bar Coin Rotation Animation

## Problem
The current `animate-coin-spin` animation uses a 2D rotation (`rotate(0deg)` to `rotate(360deg)`), which is **visually invisible** for circular images. A circle rotating in 2D looks exactly the same at all angles - the user sees no movement.

## Solution
Change the animation to a **3D Y-axis rotation** that creates a coin-flip effect. This makes the rotation clearly visible as the coin appears to flip/spin like a real coin.

---

## Technical Implementation

### File: `src/index.css`

Update the `coin-spin` keyframes animation (lines 229-236):

**Current (broken):**
```css
@keyframes coin-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-coin-spin {
  animation: coin-spin 3s linear infinite;
}
```

**New (working 3D flip):**
```css
@keyframes coin-spin {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(360deg); }
}

.animate-coin-spin {
  animation: coin-spin 3s linear infinite;
  transform-style: preserve-3d;
}
```

---

## Changes Summary

| File | Change |
|------|--------|
| `src/index.css` | Update `coin-spin` keyframes to use `rotateY()` for 3D Y-axis rotation and add `transform-style: preserve-3d` |

This creates a continuous coin-flip animation that is clearly visible to users, making the ticker bar feel more dynamic and engaging.
