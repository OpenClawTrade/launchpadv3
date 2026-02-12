

# Follower Scanner Page for @openclaw

## What This Does
Creates a dedicated admin page at `/admin/follower-scan` that fetches ALL followers of any X account (starting with @openclaw), categorizes them into 3 tabs (Blue Verified, Gold Verified, Unverified), sorts by following count, and saves everything to the database for future use.

## Credit Cost Estimate

The twitterapi.io `/twitter/user/followers` endpoint returns **200 followers per page** at **$0.15 per 1,000 followers**.

| Follower Count | Pages | API Calls Cost |
|---|---|---|
| 1,000 | 5 | ~$0.15 |
| 5,000 | 25 | ~$0.75 |
| 10,000 | 50 | ~$1.50 |
| 25,000 | 125 | ~$3.75 |
| 50,000 | 250 | ~$7.50 |

Each follower record already includes `isBlueVerified` and `isGoldVerified` fields, so **no extra API calls** are needed for verification status -- it all comes in one fetch.

## What Gets Built

### 1. Database Table: `x_follower_scans`
Stores every fetched follower with their verification type, follower/following counts, and metadata. Keyed on `(target_username, twitter_user_id)` so re-scanning updates existing records rather than duplicating.

### 2. Edge Function: `fetch-x-followers`
- Accepts `{ username: "openclaw" }` 
- Paginates through ALL pages of the followers endpoint
- Categorizes each follower as blue / gold / unverified
- Upserts all data into `x_follower_scans`
- Returns progress stats (total fetched, blue count, gold count)
- 200ms delay between pages to avoid throttling

### 3. New Page: `/admin/follower-scan`
- Password-gated (same "tuna" password pattern)
- Input field to enter any X username to scan
- "Start Scan" button that calls the edge function
- Stats bar: Total | Blue | Gold | Unverified
- 3 tabs with sortable tables:
  - **Blue Verified** -- sorted by following count
  - **Gold Verified** -- sorted by following count  
  - **Unverified** -- sorted by following count
- Each row shows: avatar, username, display name, followers, following, tweets, location
- Export to CSV button

### 4. Route Registration
Add `/admin/follower-scan` to App.tsx routes.

## Technical Details

- Uses existing `TWITTERAPI_IO_KEY` secret (already configured)
- Edge function timeout handling: for accounts with 50K+ followers, the function saves progress to DB as it goes, so even if it times out, data is preserved and a re-scan continues from where it left off
- Public RLS policies (consistent with other admin tables)
- The edge function handles pagination internally using the `cursor` / `next_cursor` from the API response

