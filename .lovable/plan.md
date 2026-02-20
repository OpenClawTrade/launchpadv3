

# Fix Matrix Mode Toggle Button

## Problem
The Matrix toggle switch in the sidebar doesn't respond to clicks. The root cause is a size mismatch between the custom switch dimensions and the default thumb:
- Switch container: `h-4 w-8` (16px x 32px)
- Default thumb: `h-5 w-5` (20px x 20px) with `translate-x-5` (20px travel)

The thumb overflows the container, which can interfere with pointer events.

## Solution
Override the thumb size to fit the smaller switch in the `MatrixToggle` component in `Sidebar.tsx`. Instead of using the default Switch (which has hardcoded thumb dimensions), pass proper sizing via className or use inline overrides.

## Changes

### `src/components/ui/switch.tsx`
No changes needed to the shared component.

### `src/components/layout/Sidebar.tsx`
Replace the current Switch usage in `MatrixToggle` with properly sized thumb overrides:
- Switch container stays `h-4 w-8`
- Add custom CSS classes to override the thumb: `[&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-4 [&>span]:data-[state=unchecked]:translate-x-0`

This ensures the thumb (12px) fits inside the container (16px) and travels the correct distance (16px = 32px width - 12px thumb - 4px padding).

### Technical Detail
The fix targets the `SwitchPrimitives.Thumb` child element via Tailwind's child selector `[&>span]` to override its `h-5 w-5` and `translate-x-5` defaults to values that match the `h-4 w-8` container.
