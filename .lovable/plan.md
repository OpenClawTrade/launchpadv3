
# Style Caching & Navigation Styling Implementation Plan

## Summary
This plan adds two features:
1. **Style Library Caching** - Cache learned Twitter writing styles so multiple agents can share the same style source without re-fetching
2. **Red TUNA Agents Button** - Make the navigation button always red across the app

---

## Part 1: Style Library Caching System

### Problem
Currently, every agent launch fetches 20 tweets from the target Twitter user. If 10 different people launch tokens "under" @toly, we fetch @toly's tweets 10 separate times.

### Solution
Create a `twitter_style_library` table that stores cached writing styles by Twitter username. When learning style:
1. Check if username exists in library (and isn't too old)
2. If exists: reuse cached style, skip Twitter API
3. If not: fetch tweets, analyze, store in library AND agent

### Database Changes

```text
┌──────────────────────────────────────────────────────────────────┐
│                    twitter_style_library                          │
├──────────────────────────────────────────────────────────────────┤
│ id                 UUID          PK                              │
│ twitter_username   TEXT          UNIQUE                          │
│ twitter_user_id    TEXT          (optional, for reference)       │
│ writing_style      JSONB         (style fingerprint)             │
│ tweet_count        INTEGER       (tweets analyzed)               │
│ learned_at         TIMESTAMPTZ                                   │
│ usage_count        INTEGER       (how many agents use this)      │
│ created_at         TIMESTAMPTZ                                   │
│ updated_at         TIMESTAMPTZ                                   │
└──────────────────────────────────────────────────────────────────┘
```

Also add to `agents` table:
- `style_source_twitter_url` TEXT - Full X.com profile link for display

And add to `subtuna` table:
- `style_source_username` TEXT - For displaying "AI learned from @toly"

### Edge Function: `agent-learn-style` Updates

```text
Current Flow:
  1. Fetch 20 tweets from @username
  2. Analyze with AI
  3. Save to agent.writing_style

New Flow:
  1. Check twitter_style_library for @username
  2. IF exists AND < 7 days old:
     - Use cached style
     - Increment usage_count
  3. ELSE:
     - Fetch 20 tweets via twitterapi.io (cheaper than official API!)
     - Analyze with AI
     - Store in twitter_style_library
     - Update usage_count = 1
  4. Save to agent (reference style_source_username)
  5. Update subtuna.style_source_username
```

### Using twitterapi.io for Style Fetching
Since we already have `TWITTERAPI_IO_KEY` for mention scanning, we can use it to fetch user tweets too - saving official X.com API credits.

```text
GET https://api.twitterapi.io/twitter/user/last_tweets
Headers: X-API-Key: [key]
Query: userName=toly&count=20
```

### Frontend Display Changes

**SubTuna Page Right Sidebar** - Add style source info:
```text
┌─────────────────────────────┐
│ 🤖 AI Agent Info            │
├─────────────────────────────┤
│ Style inspired by           │
│ @toly                       │
│ [View X Profile ↗]          │
│                             │
│ This agent's personality    │
│ was trained on @toly's      │
│ writing style               │
└─────────────────────────────┘
```

**Agent Profile Page** - Show style source badge:
```text
Agent Name 🤖
Personality: @toly's style
```

---

## Part 2: Red TUNA Agents Button

### Current State
The "TUNA Agents" button uses `variant="ghost"` with `text-muted-foreground hover:text-foreground` styling - appears as gray text.

### Changes Required

**Files to modify:**
1. `src/components/layout/LaunchpadLayout.tsx` (Desktop + Mobile)
2. `src/pages/FunLauncherPage.tsx` (Desktop + Mobile)

### New Styling
```text
Desktop Button:
- Background: bg-red-600 hover:bg-red-700
- Text: text-white
- Remove variant="ghost"

Mobile Link:
- Background: bg-red-600/90 rounded-lg
- Text: text-white
```

Visual result:
```text
┌───────────────────────────────────────────────────────────┐
│ 🐟 TUNA   [Trade] [Trending] [TUNA Agents] [x Online]     │
│                               ^^^^^^^^^^^^                │
│                               RED BUTTON                  │
└───────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Database Migration
Create `twitter_style_library` table and add columns to `agents` and `subtuna` tables.

### Step 2: Update `agent-learn-style`
- Add library lookup/cache logic
- Switch to twitterapi.io for tweet fetching
- Update subtuna with style source on launch

### Step 3: Update `agent-process-post`
- Pass `style_source_username` to subtuna on creation

### Step 4: Frontend - SubTuna Page
- Fetch `style_source_username` from subtuna/agent data
- Display "AI Style Source" section in right sidebar

### Step 5: Frontend - Agent Profile
- Display style source badge if present

### Step 6: Frontend - Red Button
- Update button styling in LaunchpadLayout.tsx
- Update button styling in FunLauncherPage.tsx

---

## Cost Savings

| Scenario | Before | After |
|----------|--------|-------|
| 10 launches under @toly | 10 API calls | 1 API call |
| Style cached for 7 days | N/A | ~85% reduction |
| Using twitterapi.io | Official API ($) | Cheaper reads |

---

## Files to be Created/Modified

**New Files:**
- None (all changes to existing files)

**Modified Files:**
- `supabase/functions/agent-learn-style/index.ts` - Add caching logic
- `supabase/functions/agent-process-post/index.ts` - Pass style source to subtuna
- `src/pages/SubTunaPage.tsx` - Display style source in sidebar
- `src/pages/AgentProfilePage.tsx` - Display style badge
- `src/components/layout/LaunchpadLayout.tsx` - Red button
- `src/pages/FunLauncherPage.tsx` - Red button
- `src/hooks/useSubTuna.ts` - Fetch style_source_username

**Database Migration:**
- Create `twitter_style_library` table
- Add `style_source_twitter_url` to `agents`
- Add `style_source_username` to `subtuna`
