

## Fix Monkey Scene Layout to Match Reference Image

### Problem
The plush monkey (image00004.png / `punch-plush.png`) is not positioned correctly on the branch (image00003.png / `punch-branch.png`). It should be laying ON TOP of the branch and sliding down along it toward the baby monkey's hand.

### Reference Layout
```text
  [branch] ---- angled from upper-left down to center ----
  [plush]  laying ON the branch, slides along it
  
                                    [baby monkey] bottom-right, reaching up
```

### Changes to `src/components/punch/PunchMonkey.tsx`

1. **Increase container size** to give more room for the composition (400x420px)
2. **Reposition the branch**: top-left to center, angled ~-15deg, matching reference where it spans the upper portion
3. **Fix plush monkey positioning**: 
   - The plush must sit ON the branch visually, not float near it
   - Start position: upper-left area of the branch
   - End position: right end of the branch, near baby monkey's reaching hand
   - The plush should follow the branch's angle (rotate to match the branch slope)
   - Slide path uses the same angle as the branch so plush travels along it
4. **Baby monkey**: position bottom-right with hand reaching up toward the end of the branch, matching reference spacing
5. **All images remain transparent** - no background colors or containers that would obscure transparency

### Technical: Sliding Math
The branch is angled at roughly -15 degrees. The plush needs to travel along this angle:
- At progress=0: plush at left end of branch (left: ~5%, top: ~8%)
- At progress=100: plush at right end near baby's hand (left: ~55%, top: ~38%)
- Plush rotation matches branch angle so it looks like it's resting on it

### No changes needed to PunchPage.tsx
The `progress` prop is already being passed correctly.

