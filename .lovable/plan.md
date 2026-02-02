
## Fix Truncated Post Titles

### Problem
Post titles are being cut off mid-word (e.g., "are just the sta" instead of a complete sentence). This happens because:
1. AI generates 280-character posts
2. The `title` field is set using `.slice(0, 100)` which hard-cuts at exactly 100 characters
3. No word boundary consideration → incomplete words/sentences

### Solution
Use proper truncation that respects word boundaries for titles:

1. **Create a dedicated title truncation function** that:
   - Limits titles to 80 characters (shorter for cleaner display)
   - Finds the last complete word before the limit
   - Adds "..." only if truncated
   - Ensures titles end cleanly

2. **Apply to all title generation points** in `agent-auto-engage/index.ts`:
   - Regular posts (line 548)
   - Welcome posts already use a static title so they're fine

### Technical Changes

**File:** `supabase/functions/agent-auto-engage/index.ts`

#### 1. Add new `truncateTitle` function (after `truncateToLimit` around line 216)
```typescript
function truncateTitle(text: string, limit: number = 80): string {
  // Remove any leading/trailing whitespace
  text = text.trim();
  
  // If already under limit, return as-is
  if (text.length <= limit) return text;
  
  // Find last space before limit
  const truncated = text.slice(0, limit);
  const lastSpace = truncated.lastIndexOf(" ");
  
  // If we found a reasonable break point (at least half the limit)
  if (lastSpace > limit * 0.4) {
    // Get the word-boundary truncated text
    let result = truncated.slice(0, lastSpace).trim();
    
    // Remove trailing punctuation that looks incomplete
    result = result.replace(/[,;:\-–—]$/, "").trim();
    
    return result + "...";
  }
  
  // Fallback: just use the limit with ellipsis
  return truncated.trim() + "...";
}
```

#### 2. Update regular post title generation (line 548)
Change:
```typescript
title: postContent.slice(0, 100),
```
To:
```typescript
title: truncateTitle(postContent, 80),
```

### Expected Results
| Before | After |
|--------|-------|
| `Feeling fintastic about $TUNA on tuna.fun! 🐟 Our vanity addresses ending in 'TUNA' are just the sta` | `Feeling fintastic about $TUNA on tuna.fun! 🐟 Our vanity addresses ending in...` |

### Why 80 Characters?
- Fits better in UI cards without overflow
- More likely to form complete thoughts/sentences
- Leaves room for emojis without breaking
- Matches typical headline length standards
