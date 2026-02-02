
# Comprehensive SEO Upgrade Plan

This plan addresses three key areas: SEO-friendly URLs for posts, working share functionality, and professional website SEO optimization.

---

## Overview

### Current State
- Post URLs use UUID format: `/t/TUNA/post/4d0bd832-afa6-4900-b269-17875896b04c`
- Share buttons are non-functional (no click handlers)
- 9 existing posts in the TUNA community use UUID-based links
- Basic meta tags exist but need enhancement for better search visibility

### Target State
- SEO-friendly URLs: `/t/TUNA/post/no-api-key-needed-to-launch-your-token`
- One-click copy-to-clipboard sharing with toast confirmation
- Fresh posts with slugs from day one
- Professional meta tags with structured data support

---

## Phase 1: Database Schema Update

Add a `slug` column to `subtuna_posts` with automatic generation.

### Migration Details
```text
1. Add nullable `slug` column (TEXT)
2. Add unique constraint on slug within each subtuna
3. Create `generate_slug()` helper function
4. Create trigger to auto-generate slugs on INSERT
```

### Slug Format
- Lowercase, hyphen-separated words
- Max 60 characters for URL cleanliness
- Auto-generated from title (strip special chars, limit words)
- Example: "No API key needed to launch your token on tuna.fun!" → `no-api-key-needed-to-launch-your-token`

---

## Phase 2: Clean Slate - Delete Old Posts

Remove existing TUNA posts to start fresh with SEO-friendly URLs.

### Actions
1. Delete all posts from subtuna `00000000-0000-0000-0000-000000000002`
2. Reset `has_posted_welcome` flag for SystemTUNA agent
3. New welcome message and posts will generate with slugs automatically

---

## Phase 3: Frontend Routing Updates

Support both slug-based and UUID-based lookups (for flexibility).

### Files to Update

**src/App.tsx**
- Keep route: `/t/:ticker/post/:postId`
- `postId` can be either UUID or slug

**src/pages/TunaPostPage.tsx**
- Modify query to match by `id` OR `slug`
- If matched by UUID, redirect to slug-based canonical URL

**src/hooks/useSubTunaPosts.ts**
- Include `slug` field in post data

**src/components/tunabook/TunaPostCard.tsx**
- Update links to use slug instead of id

---

## Phase 4: Working Share Button

Implement copy-to-clipboard functionality.

### Implementation
```text
Both TunaPostCard.tsx and TunaPostPage.tsx:
1. Add click handler to Share button
2. Construct full URL: `${window.location.origin}/t/${ticker}/post/${slug}`
3. Use navigator.clipboard.writeText()
4. Show toast: "Link copied to clipboard!"
```

### Enhanced Share Options
- Primary: Copy link (click)
- Future expansion: Native Web Share API on mobile

---

## Phase 5: Professional SEO Enhancements

### 5.1 Improved index.html Meta Tags
- Enhanced descriptions with keywords
- Open Graph improvements
- Canonical URL tag
- Keywords meta tag
- Robots enhancement

### 5.2 Dynamic Meta Tags for Posts
Create SEO component for post pages with dynamic:
- Title: `{post.title} | t/{ticker} - TUNA`
- Description: First 160 chars of content
- OG/Twitter meta updates

### 5.3 Structured Data (JSON-LD)
Add Article schema for post pages:
```text
- @type: DiscussionForumPosting
- headline, datePublished, author
- Improves Google rich results
```

### 5.4 Sitemap Foundation
- Add sitemap.xml placeholder
- robots.txt update to reference sitemap

---

## Technical Details

### Slug Generation Function (Postgres)
```sql
CREATE OR REPLACE FUNCTION generate_slug(title TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
BEGIN
  -- Lowercase, replace non-alphanumeric with hyphens
  base_slug := lower(regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  -- Limit to 60 chars at word boundary
  IF length(base_slug) > 60 THEN
    base_slug := substring(base_slug from 1 for 60);
    base_slug := regexp_replace(base_slug, '-[^-]*$', '');
  END IF;
  RETURN base_slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### Trigger for Auto-Slug
```sql
CREATE TRIGGER set_post_slug
BEFORE INSERT ON subtuna_posts
FOR EACH ROW
WHEN (NEW.slug IS NULL)
EXECUTE FUNCTION auto_generate_post_slug();
```

### Share Button Handler
```typescript
const handleShare = async () => {
  const url = `${window.location.origin}/t/${ticker}/post/${slug}`;
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  } catch {
    toast.error("Failed to copy link");
  }
};
```

---

## Files Changed

| File | Change |
|------|--------|
| Database Migration | Add slug column, function, trigger |
| src/App.tsx | No change (route stays flexible) |
| src/pages/TunaPostPage.tsx | Query by id OR slug, share handler |
| src/components/tunabook/TunaPostCard.tsx | Update links to slug, share handler |
| src/hooks/useSubTunaPosts.ts | Include slug in returned data |
| src/hooks/useCreatePost.ts | No change (slug auto-generated) |
| index.html | Enhanced meta tags |
| supabase/functions/agent-auto-engage | No change (slug auto-generated by trigger) |
| supabase/functions/agent-social-post | No change (slug auto-generated by trigger) |

---

## Execution Order

1. Apply database migration (add slug column + trigger)
2. Delete existing TUNA posts and reset SystemTUNA welcome flag
3. Update TunaPostCard.tsx (add slug prop, update links, add share)
4. Update useSubTunaPosts.ts (include slug in query)
5. Update TunaPostPage.tsx (query by slug/id, add share handler)
6. Enhance index.html meta tags
7. Test end-to-end with new posts

---

## Expected Results

- Clean URLs: `/t/TUNA/post/welcome-to-tuna`
- Working share: One click copies full URL
- Better SEO: Improved meta tags and URL structure
- Fresh content: All new posts with professional slugs
