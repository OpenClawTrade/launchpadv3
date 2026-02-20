
# Add Matrix Mode Toggle to Sidebar (Desktop Only)

## Overview
Add a "Matrix Mode" toggle switch to the bottom of the desktop sidebar that lets users turn the Matrix rain background on/off. Currently the MatrixBackground renders unconditionally at the app root. We'll add a global state to control its visibility and a toggle in the sidebar.

## Changes

### 1. Create a Matrix Mode context (`src/contexts/MatrixModeContext.tsx`)
- A small React context + provider with a boolean `matrixEnabled` state (default: `true`)
- A `toggleMatrix` function
- Persists preference to `localStorage` so it survives reloads

### 2. Wrap App with MatrixModeProvider (`src/App.tsx`)
- Import and wrap the app content with `MatrixModeProvider`
- Conditionally render `<MatrixBackground />` only when `matrixEnabled` is `true`

### 3. Add toggle to Sidebar (`src/components/layout/Sidebar.tsx`)
- Desktop only: add a small toggle row above the "Create Token" CTA
- Shows a monitor/terminal icon + "Matrix" label + a Switch component
- Uses `useMatrixMode()` hook to read/toggle the state
- Not shown on mobile (the sidebar already differentiates mobile vs desktop rendering)

## Technical Details

**New file:**
- `src/contexts/MatrixModeContext.tsx` -- context provider with localStorage persistence

**Modified files:**
- `src/App.tsx` -- wrap with provider, conditionally render `<MatrixBackground />`
- `src/components/layout/Sidebar.tsx` -- add Matrix toggle row in the desktop sidebar footer area (between nav links and "Create Token" button), using a `Switch` from the UI library
