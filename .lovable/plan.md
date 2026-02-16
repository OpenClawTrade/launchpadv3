

## Fix: Preset Selection Visual Feedback

### Problem
The preset buttons call `handleFunPresetClick` which correctly sets `funTotalSupply`, `funLpTokens`, and `funLpSol` state -- but there is no visual indicator showing which preset is currently selected. The buttons all look the same before and after clicking.

### Solution
Add a `selectedPreset` state variable that tracks which preset (by label) is currently active. Apply a highlighted style (e.g., `border-primary bg-primary/10`) to the selected preset button. Clear the selection when the user manually changes any pool config value.

### Changes

**File: `src/pages/FunModePage.tsx`**

1. Add new state: `const [selectedPreset, setSelectedPreset] = useState<string | null>(null);`
2. In `handleFunPresetClick`, also call `setSelectedPreset(preset.label)`
3. On the preset `<button>`, conditionally apply a selected class:
   - Selected: `border-primary bg-primary/10 ring-2 ring-primary/30`
   - Default: `border-border bg-secondary/50`
4. Clear `selectedPreset` to `null` when user manually edits Total Supply, LP SOL slider, or Tokens in Pool inputs (so custom values deselect any preset)

