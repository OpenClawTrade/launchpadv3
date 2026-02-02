
# Fix AstroTuna Image Not Loading

## Root Cause
The AstroTuna image was added to the codebase at `public/images/tokens/astrotuna.png`, but the database `image_url` was set to an absolute production URL (`https://launchpadv3.lovable.app/images/tokens/astrotuna.png`). Since the project hasn't been published since the image was added, the file doesn't exist at the production URL yet - causing the image to fail loading.

## Solution
Update the database URL to use a **relative path** (`/images/tokens/astrotuna.png`) instead of an absolute URL. This ensures the image works correctly in both:
- Preview environment: `https://id-preview--xxx.lovable.app/images/tokens/astrotuna.png`
- Production environment: `https://launchpadv3.lovable.app/images/tokens/astrotuna.png`

The browser will resolve the relative path based on the current domain.

---

## Technical Steps

### Step 1: Update `fun_tokens` table
Update the `image_url` for the ATUN token from the absolute URL to a relative path:

```sql
UPDATE fun_tokens 
SET image_url = '/images/tokens/astrotuna.png'
WHERE id = 'd424de3a-37e8-4d80-bab2-c740935158c9';
```

### Step 2: Update `subtuna` table
Update the `icon_url` for the AstroTuna community to match:

```sql
UPDATE subtuna 
SET icon_url = '/images/tokens/astrotuna.png'
WHERE id = 'c334e660-fabe-466a-bb02-971064497006';
```

---

## Expected Result
- The AstroTuna image will load immediately in the preview environment
- After publishing, it will also work in production
- The relative path approach is more robust for future token images as well
