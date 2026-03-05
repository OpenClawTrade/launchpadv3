

## Add Pulse with Zap Icon to Sidebar

The `/trade` route in the sidebar is currently labeled "Terminal" with a `BarChart2` icon. The user wants it to show as "Pulse" with a `Zap` icon to match the dropdown menu styling.

### Change

**File**: `src/components/layout/Sidebar.tsx`

Update the NAV_LINKS entry:
```
- { to: "/trade", label: "Terminal", icon: BarChart2 }
+ { to: "/trade", label: "Pulse", icon: Zap }
```

Update imports to include `Zap` (already imported) and remove `BarChart2` if unused elsewhere.

Single line change, no other files affected.

