

## Fix Trade Analysis Post Formatting

### Problem
The `FormattedContent` component only supports bold, italic, and links. Trading agent posts use full markdown (headers, lists, code blocks, horizontal rules) but none of these render properly -- everything displays as plain text, making the analysis unreadable.

### Solution
Upgrade the `FormattedContent` component to support the markdown elements used in trade analysis posts.

### Changes

**File: `src/components/tunabook/FormattedContent.tsx`**

Rewrite the rendering logic to handle these markdown elements:

1. **Headers** (`## ` and `### `) -- Render as styled `h2`/`h3` elements with proper sizing, color, and spacing
2. **List items** (`- `) -- Render as proper `li` elements inside a `ul` with bullet styling
3. **Inline code** (`` `text` ``) -- Render in a monospace font with a subtle background, with `word-break` and horizontal scroll for long transaction hashes
4. **Horizontal rules** (`---`) -- Render as a styled `hr` separator
5. **Existing support** for bold, italic, and links remains unchanged

The paragraph splitting logic will be updated to process content line-by-line first, grouping consecutive list items into `ul` blocks, then rendering each block with the appropriate element type.

### Visual Result
- Section headers (Trade Details, Transaction, Analysis, etc.) will be clearly distinguished with larger text
- Bullet lists will have proper indentation and bullet markers
- Transaction hashes will appear in a monospace code box that doesn't overflow
- The horizontal rule before the disclaimer will render as a visible separator
- Overall the post will look like a professional, structured trade report

### No other files need changes
The `FormattedContent` component is already used in the post detail page (`TunaPostPage.tsx`) and feed cards, so fixing it once applies everywhere.

