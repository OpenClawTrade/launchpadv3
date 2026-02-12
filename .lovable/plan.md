
## Add Migration Button to Navigation + First-Visit Popup

### Changes

**1. LaunchpadLayout.tsx -- Add "Migrate" button before "Trade" in both desktop and mobile nav**
- Desktop nav: Insert a glowing/animated "Migrate" button (orange/amber gradient with pulse animation) before the Trade button
- Mobile nav: Insert the same Migrate link as the first item in the mobile sheet menu
- Uses ArrowsClockwise or Swap icon from Phosphor

**2. AppHeader.tsx -- Add "Migrate" button before Narratives in desktop nav, and as first item in mobile menu**
- Same glowing style to make it highly visible

**3. New component: `src/components/migration/MigrationPopup.tsx`**
- A Dialog/modal that appears on first visit (checks `localStorage` for a `tuna_migration_seen` flag)
- Content: Brief summary of the migration (why it's happening, 48h window, what to do)
- Two buttons: "Go to Migration Page" (navigates to /migrate) and "Dismiss"
- Sets `localStorage` flag so it only shows once per browser

**4. Add MigrationPopup to LaunchpadLayout**
- Render the popup component inside the layout so it triggers on any page visit

### Technical Details

- **Visibility**: The Migrate button uses a pulsing amber/orange gradient (`animate-pulse` or custom keyframe) so it stands out from other nav items
- **Popup**: Uses the existing Radix Dialog component. Checks `localStorage.getItem('tuna_migration_seen')` on mount; if not set, opens the dialog automatically
- **No database changes needed**
- **Files modified**: `LaunchpadLayout.tsx`, `AppHeader.tsx`
- **Files created**: `src/components/migration/MigrationPopup.tsx`
