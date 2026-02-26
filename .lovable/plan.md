

# Punch Page: Interactive Tokens Feed with Like/Dislike System

## Overview
Add a scrollable sidebar panel on the left side of the Punch page showing recently launched "punched" tokens with meme-style cards. Each token gets like/dislike buttons with counts stored in the database, with fun shaking animations on vote.

## Layout Change
- Convert the current centered single-column layout to a two-column layout
- Left side: scrollable "Tokens Launched" feed panel (fixed width ~280px)
- Right side: existing punch game content (centered as before)
- On mobile: the feed becomes a collapsible drawer or tabs above the game

## Database

### New Table: `punch_votes`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | default gen_random_uuid() |
| fun_token_id | uuid (FK -> fun_tokens.id) | NOT NULL |
| voter_fingerprint | text | NOT NULL, browser fingerprint or IP-based identifier |
| vote_type | smallint | 1 = like, -1 = dislike |
| created_at | timestamptz | default now() |

- Unique constraint on (fun_token_id, voter_fingerprint) so one vote per person per token
- RLS: allow public SELECT, INSERT, UPDATE (no auth required -- anonymous voting)
- Enable realtime on this table

### Columns added to `fun_tokens` (or computed via query)
We'll compute like/dislike counts via aggregation query rather than denormalized columns, keeping it simple.

## New Components

### `PunchTokenFeed` (src/components/punch/PunchTokenFeed.tsx)
- Fetches recent punched tokens from `fun_tokens` where description ilike `%Punched into existence%`
- Orders by `created_at DESC`, limit 50
- Renders a scrollable list of `PunchTokenCard` components
- Header: "TOKENS LAUNCHED" with rocket emoji, meme-style bold font
- Realtime subscription for new tokens appearing live

### `PunchTokenCard` (src/components/punch/PunchTokenCard.tsx)
- Meme-style card with:
  - Token image (small thumbnail)
  - Token name + ticker
  - Time ago label
  - Like/Dislike buttons with counts
- Like/dislike buttons:
  - Thumbs up / Thumbs down icons
  - Show count next to each
  - On click: shake animation on the card (CSS keyframe `punch-vote-shake`)
  - Green glow for like, red glow for dislike when active
  - Uses `voter_fingerprint` (generated from localStorage random ID) to track votes without auth

### `usePunchVotes` hook (src/hooks/usePunchVotes.ts)
- Fetches aggregated like/dislike counts for all visible tokens in one query
- Checks current user's vote via stored fingerprint
- Provides `vote(tokenId, voteType)` function that upserts into `punch_votes`
- Realtime subscription to update counts live

### `usePunchTokenFeed` hook (src/hooks/usePunchTokenFeed.ts)
- Fetches punched tokens with image, name, ticker, created_at, mint_address
- Realtime subscription for new entries

## Animations
- **Vote shake**: When a user clicks like/dislike, the card shakes briefly (CSS animation ~300ms)
- **New token entry**: Tokens slide in from top with fade-in animation
- **Vote button pulse**: Brief scale-up pulse on the clicked button

## Page Layout Update (PunchPage.tsx)
- Wrap content in a flex row container
- Left panel: `PunchTokenFeed` component (hidden on very small screens, shown as overlay on mobile)
- Right/center: existing game content unchanged

## Technical Details

### Voter Fingerprint
- Generate a random UUID on first visit, store in `localStorage` as `punch_voter_id`
- Use this as `voter_fingerprint` in the `punch_votes` table
- No authentication required

### Migration SQL
```sql
CREATE TABLE public.punch_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fun_token_id uuid NOT NULL REFERENCES public.fun_tokens(id) ON DELETE CASCADE,
  voter_fingerprint text NOT NULL,
  vote_type smallint NOT NULL CHECK (vote_type IN (1, -1)),
  created_at timestamptz DEFAULT now(),
  UNIQUE(fun_token_id, voter_fingerprint)
);

ALTER TABLE public.punch_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read punch votes" ON public.punch_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert punch votes" ON public.punch_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update own punch votes" ON public.punch_votes FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.punch_votes;
```

### Files to Create
1. `src/components/punch/PunchTokenFeed.tsx`
2. `src/components/punch/PunchTokenCard.tsx`
3. `src/hooks/usePunchVotes.ts`
4. `src/hooks/usePunchTokenFeed.ts`

### Files to Modify
1. `src/pages/PunchPage.tsx` - Add two-column layout with feed on left

