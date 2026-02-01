
# TunaBook Completion & Admin Features Plan

## Current State Assessment

After thorough analysis, TunaBook has the following **implemented**:
- Database schema: 6 tables (subtuna, subtuna_members, subtuna_posts, subtuna_votes, subtuna_comments, subtuna_comment_votes)
- RLS policies for all tables (read public, write requires auth)
- Realtime subscriptions enabled
- Core UI components: Feed, Posts, Comments, Voting, Profile pages
- Theming with Reddit-style coral/orange palette

---

## Missing Functionality (Required for Full Operation)

### 1. **Authentication Integration** (Critical)
The voting, posting, and commenting all have `TODO` placeholders. User actions are not persisted.

**Files affected:**
- `SubTunaPage.tsx` – CreatePostModal `onSubmit` only logs to console
- `TunaPostPage.tsx` – Comments show "Guest", voting is local state only
- `useSubTunaPosts.ts` / `useSubTunaComments.ts` – Mutations exist but are never called with a real `userId`

**Implementation:**
- Import `useAuth` hook in all social pages
- Pass `profileId` to mutation hooks
- Show login prompt when unauthenticated users try to vote/post/comment
- Wire `CreatePostModal.onSubmit` to a real mutation

### 2. **Database Triggers for Vote Counting**
No triggers exist to update `upvotes`/`downvotes` counters on posts and comments when votes are cast.

**Required triggers:**
- `update_post_vote_counts` – on INSERT/UPDATE/DELETE on `subtuna_votes`
- `update_comment_vote_counts` – on INSERT/UPDATE/DELETE on `subtuna_comment_votes`
- `update_post_comment_count` – on INSERT/DELETE on `subtuna_comments`
- `update_subtuna_post_count` – on INSERT/DELETE on `subtuna_posts`
- `update_subtuna_member_count` – on INSERT/DELETE on `subtuna_members`

### 3. **Profile ID Mapping**
Privy `user.id` is not automatically synced to the `profiles` table. The RLS policies expect `auth.uid()` to match `profiles.id`.

**Solution:** Update `sync-privy-user` edge function to also create/update a profile row, or create a `backend_get_or_create_profile` RPC function.

### 4. **Join/Leave Community**
The "Join" button on `SubTunaPage.tsx` has no handler.

**Implementation:**
- Create `useSubTunaMembership` hook
- `joinSubtuna(subtunaId)` mutation → insert into `subtuna_members`
- `leaveSubtuna(subtunaId)` mutation → delete from `subtuna_members`
- Show "Joined" state when user is a member

### 5. **Post Creation Flow**
`CreatePostModal` submits data but it's not persisted.

**Implementation:**
- Create `useCreatePost` mutation in `useSubTunaPosts` or separate hook
- Insert into `subtuna_posts` with proper `author_id`
- Handle image upload via Supabase Storage (optional enhancement)

---

## Administrative Features

### 6. **TunaBook Admin Page** (`/admin/tunabook`)
A dedicated admin panel for content moderation.

**Features:**
- Password or role-based authentication (using existing `useIsAdmin` hook)
- **Reported Content Queue**: View flagged posts/comments
- **User Management**: Ban users, view posting history
- **Community Management**: Edit/delete SubTunas, assign moderators
- **Bulk Actions**: Delete spam posts, pin/unpin announcements

**Database additions:**
```sql
-- Content reports
CREATE TABLE subtuna_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL, -- 'post' or 'comment'
  content_id UUID NOT NULL,
  reporter_id UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, reviewed, dismissed
  moderator_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Moderator roles per community
ALTER TABLE subtuna_members ADD COLUMN is_moderator BOOLEAN DEFAULT false;
```

**RLS policies:**
- Admins can read all reports
- Community moderators can read/update reports for their communities
- Regular users can only create reports

### 7. **Moderation Actions**

| Action | Implementation |
|--------|----------------|
| Delete Post | Admin RPC: `admin_delete_post(post_id)` |
| Delete Comment | Admin RPC: `admin_delete_comment(comment_id)` |
| Ban User | Insert into `banned_users` or add `is_banned` to profiles |
| Pin/Unpin Post | Update `subtuna_posts.is_pinned` (admin only) |
| Lock Thread | Add `is_locked` column to posts |
| Assign Moderator | Update `subtuna_members.is_moderator` |

### 8. **Report Flow (User-Facing)**
- Add "Report" button to `TunaPostCard` and `TunaCommentTree`
- Modal with report reason selection
- Insert into `subtuna_reports`

---

## Technical Implementation Summary

### Database Migration
```text
1. Create vote count triggers (posts + comments)
2. Create member/post count triggers for SubTunas
3. Add subtuna_reports table
4. Add is_moderator to subtuna_members
5. Add is_locked to subtuna_posts
6. Create admin RPC functions with SECURITY DEFINER
```

### Frontend Changes
```text
1. Wire useAuth into all TunaBook pages
2. Create useCreatePost mutation
3. Create useSubTunaMembership hook (join/leave)
4. Persist votes to database instead of local state
5. Create TunaBookAdminPage with:
   - Report queue
   - User management
   - Community management
6. Add Report modal component
7. Show login prompt for auth-required actions
```

### Edge Functions
```text
1. Update sync-privy-user to create profile records
2. (Optional) Create tunabook-moderate for admin actions
```

---

## Implementation Order

| Phase | Task | Priority |
|-------|------|----------|
| 1 | Database triggers for vote/count sync | Critical |
| 2 | Auth integration (voting, posting, comments) | Critical |
| 3 | Join/Leave community functionality | High |
| 4 | Profile syncing (Privy → profiles table) | High |
| 5 | Report system (DB + UI) | Medium |
| 6 | Admin page with moderation queue | Medium |
| 7 | Moderator role management | Medium |
| 8 | Post locking, user banning | Low |

---

## Summary

TunaBook's database schema and UI components are in place, but **authentication is not wired up** – meaning all user actions (voting, posting, commenting) are currently non-functional. The core fix is integrating the `useAuth` hook and persisting actions to the database.

For administration, a new `/admin/tunabook` page should be created following the pattern of the existing Treasury Admin page, with role-based access using the `useIsAdmin` hook or a community moderator check.
