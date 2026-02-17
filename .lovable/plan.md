

## Fix: Tweet Scanner Missing All Launch Commands

### Problem
The scanner is missing every `!launch` command tweet. Here's why:

1. **X Official API credits are depleted** (402 error), so every scan falls back to twitterapi.io
2. The search query `(tunalaunch OR launchtuna OR "!launch") -is:retweet` on twitterapi.io matches the word "launch" too broadly
3. twitterapi.io returns 20 random tweets containing "launch" -- none of which are actual `!launch` commands
4. All 20 tweets get skipped as "no launch command", and the real command tweets from your users never appear in results

### Solution

**1. Fix the search query for twitterapi.io**

The twitterapi.io search engine handles quoted phrases differently than the official X API. Change the query to be more specific by using exact username mentions instead of the broad "!launch" term:

```
(@tunalaunch OR @buildtuna) -is:retweet
```

This ensures only tweets that mention the bot accounts are returned -- which is exactly the tweets that contain launch commands. Users must mention @tunalaunch or @buildtuna for the command to work anyway.

**2. Add a secondary "!launch" keyword scan**

For users who type `!launch` without mentioning the bot account (like @AzureW5's tweet), add a **separate narrower query**:

```
"!launch" -is:retweet -is:reply
```

Run this as a second search call only if the first query returns few results, to avoid wasting API credits.

**3. Increase result count on twitterapi.io**

The twitterapi.io fallback currently doesn't set a `count` parameter, defaulting to 20. This is too few when results are polluted. Add `count=50` to get more results and increase the chance of catching actual commands.

### Technical Changes

**File: `supabase/functions/agent-scan-twitter/index.ts`**

- Update the `searchQuery` variable (line ~996) to use mention-based query when falling back to twitterapi.io
- In `searchMentionsViaTwitterApiIo` function (~line 336), add `count=50` parameter
- Add a secondary search for `"!launch"` pattern if the primary search returns 0 command tweets
- Log which tweets are being returned for better debugging

### Risk Assessment
- Low risk: only changes how tweets are found, not how they're processed
- The mention-based query is more reliable because users must tag the bot for the system to work
- The `!launch` fallback query ensures edge cases (like @AzureW5) are still caught
