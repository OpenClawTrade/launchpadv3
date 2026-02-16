

# Update Logo, Favicon, and Social Preview Thumbnails

## What will be done

1. **Copy the uploaded logo** (`user-uploads://unanew.png`) to `public/logo.png`, replacing the current file
2. **Update `index.html`** metadata so the favicon and all social preview images (Open Graph for Telegram/X/etc.) point to the new logo -- these references already point to `/logo.png`, so they should work automatically after the file copy
3. **Also copy to `src/assets/`** if the logo is referenced anywhere in React components via import

## Files affected

| File | Change |
|------|--------|
| `public/logo.png` | Replaced with the new sushi-crab logo |
| `index.html` | Verify existing references are correct (likely no code change needed since it already uses `/logo.png`) |

## Result
- Favicon in browser tab: new logo
- Telegram link previews: new logo
- X.com (Twitter) card previews: new logo
- Any in-app logo references: new logo

