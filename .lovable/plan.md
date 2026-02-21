

## Optimize Token Image Loading in Terminal Grid

The token avatars in the terminal grid are 40x40px squares but currently load full-size images (often 500px+ or larger). This causes slow loading and wasted bandwidth.

### Changes

**1. Use `OptimizedTokenImage` in `AxiomTokenRow.tsx`**
- Replace the raw `<img>` tag with the existing `OptimizedTokenImage` component
- Set `size={48}` (slightly above 40px for retina) to request a tiny, optimized version
- This will use Supabase image transforms (quality=60, width=48) and IPFS CDN width params
- The component already handles error fallback, lazy loading, and async decoding

**2. Add `fetchpriority="high"` for eagerness**
- Since these are above-the-fold items, override the default `loading="lazy"` behavior
- Pass `loading="eager"` to ensure instant loading for visible rows

### Technical Details

In `src/components/launchpad/AxiomTokenRow.tsx`, the avatar section (~lines 93-105) will change from:

```tsx
<img
  src={token.image_url}
  alt={token.name}
  className="w-full h-full object-cover rounded-lg"
  onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
/>
```

To:

```tsx
<OptimizedTokenImage
  src={token.image_url}
  fallbackText={token.ticker}
  size={48}
  loading="eager"
  alt={token.name}
  className="w-full h-full object-cover rounded-lg"
/>
```

This reuses the existing optimization infrastructure (Supabase render API, IPFS CDN params) to request ~48px images instead of full-size ones, resulting in significantly faster loads.

