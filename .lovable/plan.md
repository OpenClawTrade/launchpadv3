

# Plan: Provide Specific Feedback for Missing Launch Fields

## Overview

When a user tweets `!tunalaunch` without all required information, we'll reply with a helpful message explaining exactly what's missing and how to fix it, rather than a generic error.

## Current Behavior

- If `!tunalaunch` is used without `name` or `symbol`, the parser returns `null` and a generic error is stored
- If no image is attached, there's already a specific reply asking for an image
- Users get no Twitter reply explaining what's wrong - they just don't see their token launch

## Proposed Changes

### 1. Enhanced Parse Function with Detailed Validation

Update `parseLaunchPost` in `agent-process-post/index.ts` to return:
- Parsed data (if successful), OR
- A detailed object with what was found and what's missing

```text
+---------------------------+
|    Parse Result Types     |
+---------------------------+
| Success: All fields OK    |
|   → return ParsedData     |
+---------------------------+
| Partial: Some missing     |
|   → return { found: {},   |
|     missing: ["name"] }   |
+---------------------------+
```

### 2. Specific Reply Messages for Missing Fields

| Missing Field | Reply Message |
|--------------|---------------|
| Name missing | "Please provide a token name using `name: YourTokenName`" |
| Symbol missing | "Please provide a ticker symbol using `symbol: TICKER`" |
| Image missing | (Already implemented - asks user to attach image) |
| Name + Symbol missing | Lists both requirements |

### 3. Reply Template

When fields are missing, the bot will reply:

```
🐟 Almost there! Your !tunalaunch is missing:

❌ Token name (add: name: YourTokenName)
❌ Ticker symbol (add: symbol: TICKER)

Example format:
!tunalaunch
name: My Token
symbol: MTK
[Attach your token image]

Launch your unique Solana Agent from TUNA dot Fun
```

## Technical Implementation

### Files to Modify

1. **`supabase/functions/agent-process-post/index.ts`**
   - Create new `validateLaunchPost()` function that returns validation result with specific missing fields
   - Update `processLaunchPost()` to use validation result and generate specific reply text
   - Return `shouldReply: true` with specific `replyText` when validation fails

2. **`supabase/functions/twitter-mention-launcher/index.ts`**
   - Already handles replies for failed launches
   - Will use the new `replyText` from `agent-process-post` response

### Validation Flow

```text
User tweets "!tunalaunch" with partial data
         │
         ▼
┌─────────────────────────┐
│ validateLaunchPost()    │
│ Check: name, symbol     │
└──────────┬──────────────┘
           │
     ┌─────┴─────┐
     │ Missing?  │
     └─────┬─────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌────────┐  ┌────────────┐
│ None   │  │ Some       │
│        │  │ missing    │
└────┬───┘  └──────┬─────┘
     │             │
     ▼             ▼
┌─────────┐  ┌────────────────┐
│Continue │  │Return specific │
│to image │  │error + reply   │
│check    │  │text listing    │
└─────────┘  │missing fields  │
             └────────────────┘
```

### Error Message Examples

**Missing name only:**
> 🐟 Your !tunalaunch needs a token name!
>
> Add: `name: YourTokenName`
>
> Example:
> `!tunalaunch`
> `name: Pepe`
> `symbol: PEPE`
> [Attach image]

**Missing symbol only:**
> 🐟 Your !tunalaunch needs a ticker symbol!
>
> Add: `symbol: TICKER`

**Missing both name and symbol:**
> 🐟 Your !tunalaunch needs more info:
> ❌ Token name (name: YourTokenName)
> ❌ Ticker symbol (symbol: TICKER)

**Missing image (already exists):**
> 🐟 To launch a token, please attach an image to your tweet!

## Benefits

- Users know exactly what to fix without guessing
- Reduces failed launch attempts
- Professional, helpful bot experience
- Maintains the existing flow for successful launches

