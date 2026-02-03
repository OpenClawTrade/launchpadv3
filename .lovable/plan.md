
# Colosseum Hackathon Application - Complete Step-by-Step Guide

## Current Status

| Component | Status |
|-----------|--------|
| Database Tables | Done (4 tables created) |
| Edge Functions | Done (3 functions deployed) |
| Registrations | **NOT STARTED** (0 records) |
| Forum Posts | **NOT STARTED** (0 posts) |
| COLOSSEUM_API_KEY | **NOT CONFIGURED** |

**Today is February 3, 2026** - You're on Day 2 of the hackathon calendar. Here's exactly what you need to do:

---

## Step 1: Manual Registration on Colosseum.com (Do First!)

Before using the automated system, you need to register manually on the Colosseum website:

1. **Go to**: https://colosseum.com/hackathons
2. **Find**: The "Agent Hackathon" or current active hackathon
3. **Click**: "Register" or "Apply"
4. **Fill out the form**:
   - **Project Name**: TUNA Agent SDK
   - **Description**: Infrastructure for AI agents to launch tokens, build communities, and earn 80% of trading fees on Solana
   - **Website**: https://tuna.fun
   - **GitHub**: (your repo if public)
   - **Category**: AI / DeFi / Infrastructure
   - **Team Size**: (your team size)
   - **Wallet Address**: Your Solana wallet for receiving prizes
5. **Submit** the application
6. **Save** any API key or credentials they provide

---

## Step 2: Add COLOSSEUM_API_KEY Secret (After Registration)

Once Colosseum provides an API key (if they do), add it:

I will add this secret for you after you provide the key from Colosseum.

---

## Step 3: Call Registration Endpoint (Automated)

After manual registration, sync with your edge function:

```bash
curl "https://ptwytypavumcrbofspno.supabase.co/functions/v1/colosseum-bridge?action=register"
```

Or visit directly in browser:
```
https://ptwytypavumcrbofspno.supabase.co/functions/v1/colosseum-bridge?action=register
```

This registers your agent metadata with Colosseum's API (if live) and stores the registration locally.

---

## Step 4: Post Introduction to Forum (Day 1-2)

Post your intro template to the Colosseum forum:

```bash
curl -X POST "https://ptwytypavumcrbofspno.supabase.co/functions/v1/colosseum-forum?action=post" \
  -H "Content-Type: application/json" \
  -d '{"template": "intro"}'
```

This posts:
- **Title**: "Introducing TUNA: Agent Infrastructure for Solana Token Economies"
- **Content**: Overview of TUNA with live stats (22+ tokens, 11+ SOL distributed)
- **Tags**: introduction, infrastructure, ai, defi

---

## Step 5: Post Technical Deep-Dive (Today - Day 2)

Post the voice fingerprinting template:

```bash
curl -X POST "https://ptwytypavumcrbofspno.supabase.co/functions/v1/colosseum-forum?action=post" \
  -H "Content-Type: application/json" \
  -d '{"template": "voiceFingerprinting"}'
```

---

## Step 6: Remaining Calendar (Days 3-11)

| Day | Date | Action | Command |
|-----|------|--------|---------|
| 3 | Feb 4 | Engage 5+ other projects | Browse forum, find posts, use `comment` action |
| 4 | Feb 5 | Post "walletless" template | `{"template": "walletless"}` |
| 5 | Feb 6 | Post "feeDistribution" template | `{"template": "feeDistribution"}` |
| 6-9 | Feb 7-10 | Daily heartbeats + engagement | `action=heartbeat` every 30 min |
| 10 | Feb 11 | **SUBMIT PROJECT** | `colosseum-submit?action=submit` |
| 11 | Feb 12 | Final engagement | Manual forum activity |

---

## Step 7: Set Up Heartbeat Cron (Optional but Recommended)

For continuous presence, set up a cron job to call heartbeat every 30 minutes:

**Option A: Use an external cron service (easiest)**
- Use https://cron-job.org or similar
- URL: `https://ptwytypavumcrbofspno.supabase.co/functions/v1/colosseum-bridge?action=heartbeat`
- Interval: Every 30 minutes

**Option B: Manual heartbeats**
- Call the endpoint manually a few times per day

---

## Step 8: Engage with Other Projects (Days 3-9)

To comment on other projects:

```bash
curl -X POST "https://ptwytypavumcrbofspno.supabase.co/functions/v1/colosseum-forum?action=comment" \
  -H "Content-Type: application/json" \
  -d '{
    "targetPostId": "POST_ID_FROM_COLOSSEUM",
    "projectName": "Other Project Name",
    "comment": "Great work on [feature]! We built something similar with TUNA - would love to explore integrations. Check out our token launch SDK!"
  }'
```

---

## Step 9: Preview Submission (Before Feb 11)

Check what will be submitted:

```bash
curl "https://ptwytypavumcrbofspno.supabase.co/functions/v1/colosseum-submit?action=preview"
```

This shows the full submission payload with live stats.

---

## Step 10: Final Submission (Feb 11)

Submit the project:

```bash
curl "https://ptwytypavumcrbofspno.supabase.co/functions/v1/colosseum-submit?action=submit"
```

---

## Quick Reference: All Endpoints

| Action | Endpoint |
|--------|----------|
| Register | `colosseum-bridge?action=register` |
| Heartbeat | `colosseum-bridge?action=heartbeat` |
| Status | `colosseum-bridge?action=status` |
| Post Template | `colosseum-forum?action=post` + `{"template": "..."}` |
| Comment | `colosseum-forum?action=comment` + body |
| List Posts | `colosseum-forum?action=list` |
| Preview Submit | `colosseum-submit?action=preview` |
| Final Submit | `colosseum-submit?action=submit` |

**Base URL**: `https://ptwytypavumcrbofspno.supabase.co/functions/v1/`

---

## Available Templates

| Template Key | Title |
|--------------|-------|
| `intro` | Introducing TUNA: Agent Infrastructure for Solana Token Economies |
| `voiceFingerprinting` | How TUNA Learns Agent Voices from Twitter |
| `walletless` | Walletless Token Launches: Lower Barrier, Same Security |
| `feeDistribution` | Fee Distribution: How Agents Earn Real SOL |

---

## What You Need to Do RIGHT NOW

1. **Go to https://colosseum.com** and register manually
2. Save any API key they provide
3. Let me know the API key so I can add it as a secret
4. Then run the automated registration endpoint

Would you like me to help you test any of these endpoints or add the COLOSSEUM_API_KEY secret once you have it?
