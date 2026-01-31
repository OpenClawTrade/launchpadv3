
# API User Leaderboard & Statistics System

## Overview
Add a public leaderboard showing all API users ranked by their lifetime fees earned, along with token counts created through their launchpads. This gives visibility into the most successful API integrators.

---

## Implementation Plan

### 1. Create Leaderboard Edge Function

**File:** `supabase/functions/api-leaderboard/index.ts`

This endpoint returns ranked API users with their stats:

```text
GET /api-leaderboard?limit=50

Response: {
  "leaderboard": [
    {
      "rank": 1,
      "wallet_address": "ABCD...1234",
      "total_fees_earned": 12.5,
      "total_fees_paid_out": 10.0,
      "pending_fees": 2.5,
      "tokens_launched": 45,
      "launchpads_count": 3,
      "member_since": "2026-01-15T..."
    },
    ...
  ],
  "total_api_users": 150,
  "total_platform_volume": 5000.0
}
```

Implementation:
- Query `api_accounts` ordered by `total_fees_earned DESC`
- Join count of `fun_tokens` per API account
- Join count of `api_launchpads` per account
- Truncate wallet addresses for display (first 4, last 4 chars)

---

### 2. Create Leaderboard UI Component

**File:** `src/components/api/ApiLeaderboard.tsx`

A reusable table/card component showing:
- Rank (trophy icons for top 3)
- Wallet address (truncated, with copy button)
- Total Fees Earned (SOL)
- Tokens Launched (count)
- Launchpads (count)
- Member Since

Features:
- Sortable columns
- Pagination
- Medal colors for top 3 (gold, silver, bronze)

---

### 3. Add Leaderboard Tab to API Dashboard

**File:** `src/pages/ApiDashboardPage.tsx` (modify)

Add a new "Leaderboard" tab alongside the existing tabs:
- Shows `ApiLeaderboard` component
- Highlights the current user's rank (if logged in)
- Auto-scrolls to user's position in the table

---

### 4. Add Stats to Individual API Dashboard

Enhance the existing dashboard to show:
- User's current rank among all API users
- Number of tokens launched via their API
- Total volume traded on their launchpads

---

### 5. Database Function for Efficient Queries

Create an RPC function for efficient leaderboard queries:

```sql
CREATE OR REPLACE FUNCTION get_api_leaderboard(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  rank BIGINT,
  wallet_address TEXT,
  total_fees_earned NUMERIC,
  total_fees_paid_out NUMERIC,
  tokens_launched BIGINT,
  launchpads_count BIGINT,
  member_since TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROW_NUMBER() OVER (ORDER BY aa.total_fees_earned DESC NULLS LAST) as rank,
    aa.wallet_address,
    COALESCE(aa.total_fees_earned, 0) as total_fees_earned,
    COALESCE(aa.total_fees_paid_out, 0) as total_fees_paid_out,
    COALESCE(
      (SELECT COUNT(*) FROM fun_tokens ft WHERE ft.api_account_id = aa.id),
      0
    ) as tokens_launched,
    COALESCE(
      (SELECT COUNT(*) FROM api_launchpads al WHERE al.api_account_id = aa.id),
      0
    ) as launchpads_count,
    aa.created_at as member_since
  FROM api_accounts aa
  WHERE aa.status = 'active'
  ORDER BY aa.total_fees_earned DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/api-leaderboard/index.ts` | Create | Leaderboard API endpoint |
| `src/components/api/ApiLeaderboard.tsx` | Create | Leaderboard UI component |
| `src/pages/ApiDashboardPage.tsx` | Modify | Add Leaderboard tab + user rank |
| `supabase/config.toml` | Modify | Register new edge function |
| Migration | Create | Add `get_api_leaderboard` RPC function |

---

## User Experience

### For API Users:
- See their global rank on the dashboard
- Motivation to climb the leaderboard
- Visibility into how many tokens were created via their integration

### For Platform Admins:
- Quick overview of top performers
- Identify successful API integrators
- Track platform-wide API adoption metrics

### For Public Visitors:
- Leaderboard can be made publicly viewable
- Social proof showing active API ecosystem
- Encourages new developers to join

---

## Technical Summary

The implementation ensures:
1. **Every token launched via API is permanently attributed** to the API account (via `api_account_id`)
2. **Platform always gets 1%** of trading fees (stays in treasury)
3. **API user always gets 1%** (recorded in `api_fee_distributions`, claimable via dashboard)
4. **Stats are tracked in real-time** via the existing `fun-distribute` function
5. **Leaderboard shows lifetime earnings** from `api_accounts.total_fees_earned`
