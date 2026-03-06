

## Plan: Remove All Colosseum Code

### Files to Delete
- `src/pages/ColosseumAdminPage.tsx`
- `supabase/functions/colosseum-auto-engage/` (entire directory)
- `supabase/functions/colosseum-bridge/` (entire directory)
- `supabase/functions/colosseum-forum/` (entire directory)
- `supabase/functions/colosseum-submit/` (entire directory)
- `.lovable/colosseum-hackathon-plan.md`

### Files to Edit

**`supabase/config.toml`** — Remove these entries (lines 228-235):
```toml
[functions.colosseum-bridge]
verify_jwt = false

[functions.colosseum-forum]
verify_jwt = false

[functions.colosseum-submit]
verify_jwt = false
```

**`src/pages/AdminPanelPage.tsx`** — Remove:
- `ColosseumAdminPage` lazy import
- `Globe` icon import
- `{ value: "colosseum", label: "Colosseum", icon: Globe }` from TAB_CONFIG
- The `<TabsContent value="colosseum">` block

**`src/App.tsx`** — Remove the redirect route:
```tsx
<Route path="/admin/colosseum" element={<Navigate to="/admin?tab=colosseum" replace />} />
```

### Database Tables (left in place)
The tables `colosseum_activity`, `colosseum_engagement_log`, `colosseum_forum_posts`, `colosseum_forum_comments`, `colosseum_registrations` will remain in the database but become unused. Dropping them via migration is optional — they have no RLS cost and no active queries will hit them. I can add a migration to drop them if you want.

### Not Touched
- `src/integrations/supabase/types.ts` — auto-generated, never edited manually
- `BACKUP/`, `cli/`, `sdk/` — documentation/reference files with mentions

