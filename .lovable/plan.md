
# Plan: Update Branding to "TUNA OS"

## Overview

Update the header logo text and website title to reflect the new "TUNA OS" branding.

## Changes Required

### 1. `src/components/layout/LaunchpadLayout.tsx`

**Line 30** - Update aria-label:
```tsx
<Link to="/" className="gate-logo" aria-label="TUNA OS">
```

**Line 33-34** - Update alt text:
```tsx
alt="TUNA OS"
```

**Line 37** - Change logo text from "TUNA v3" to "TUNA OS":
```tsx
<span className="text-lg font-bold">TUNA OS</span>
```

### 2. `index.html`

**Line 7** - Update page title:
```html
<title>Tuna AI Agent Operating System</title>
```

**Line 10** - Update author meta:
```html
<meta name="author" content="TUNA OS" />
```

**Line 19** - Update og:site_name:
```html
<meta property="og:site_name" content="TUNA OS" />
```

**Lines 55, 67** - Update JSON-LD structured data name references:
```json
"name": "TUNA OS"
```

## Summary

| File | Change |
|------|--------|
| `LaunchpadLayout.tsx` | Update logo text, aria-label, and alt text to "TUNA OS" |
| `index.html` | Update `<title>` to "Tuna AI Agent Operating System" and related meta tags |

## Result

- Header will display "TUNA OS" next to the logo (removing the "v3" version tag)
- Browser tab will show "Tuna AI Agent Operating System"
- Social previews will reflect updated branding
