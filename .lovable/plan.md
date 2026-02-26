

## Animated Punch Monkey Scene - Replace Emoji with Real Images

### Overview
Replace the current monkey emoji (🐵) tapping target with an animated scene composed of the 4 uploaded images. The plush monkey starts at the top of a branch, slides down with each tap, and the baby monkey reaches up from below. At 100 taps (completion), they meet and the final "hug" image is shown.

### Scene Composition (matching reference image)
```text
  [branch.png] ─────────────
  [plush.png] slides down along branch
                              ↓
                    [baby-monkey.png] reaching up

  === On completion (100 taps) ===
  [monkey-hug.png] replaces everything
```

### Changes

#### 1. Rewrite `PunchMonkey.tsx`
- Remove the emoji-based display
- Compose a scene using the 4 images from `/images/`:
  - **Branch** (`punch-branch.png`): positioned at top, angled from top-left to center-right
  - **Plush monkey** (`punch-plush.png`): starts at top-left of the branch, slides down toward the baby monkey as progress increases (0-100%)
  - **Baby monkey** (`punch-baby-monkey.png`): positioned at bottom-right, arm reaching up, with a subtle idle bobbing animation
- Accept a new `progress` prop (0-100) to control plush position
- The plush monkey's `translateY` and `translateX` are interpolated based on progress (slides down the branch toward the baby)
- On tap, the baby monkey does a quick "punch" scale animation (existing behavior)
- Keep existing ripple effects and tap handling

#### 2. Completion animation
- When `completed` is true (progress >= 100), cross-fade all individual images out and show `punch-monkey-hug.png` centered with a scale-in + glow animation
- Add a celebratory pulse/glow effect around the hug image

#### 3. Update `PunchPage.tsx`
- Pass `progress` state to `PunchMonkey` component so it can position the plush accordingly

#### 4. Add keyframes to `src/index.css`
- `plush-slide`: smooth transition for the plush sliding down
- `monkey-celebrate`: scale-in with glow for the final hug reveal
- Keep existing `idle-bob` for the baby monkey's idle state

### Technical Details

**PunchMonkey props change:**
```typescript
interface PunchMonkeyProps {
  onTap: (x: number, y: number) => void;
  tapping: boolean;
  completed: boolean;
  progress: number; // 0-100
}
```

**Plush position calculation:**
- Start position: top-left (translateX: -40%, translateY: -20%)
- End position: center-right near baby's hand (translateX: 20%, translateY: 60%)
- Linear interpolation based on `progress` value

**Image sizing:**
- Container: ~320x320px (responsive)
- Branch: full width, positioned top
- Plush: ~120px, absolutely positioned, transforms with progress
- Baby monkey: ~140px, positioned bottom-right
- Hug image: ~250px, centered, shown only on completion

