

## Plan: Vanity Address Fix + Matrix Mode Content Readability

### Part 1: Vanity Address Investigation

**Finding:** The two recently launched tokens (PPA and PNQR) did NOT receive vanity addresses. Here's why:

- The `fun-create` edge function sends `useVanityAddress: true` to the external Vercel API (`/api/pool/create-fun`), but it does NOT call `backend_reserve_vanity_address` itself -- it relies entirely on the Vercel backend to handle vanity assignment.
- Meanwhile, `pump-agent-launch` and `bags-agent-launch` handle vanity locally by calling `backend_reserve_vanity_address` RPC and passing the keypair to the on-chain transaction.
- There are 7 vanity keypairs available in the database (all with suffix "claw"), but the Vercel API likely cannot access them or has its own depleted pool.

**Fix:** Move vanity keypair reservation INTO `fun-create` (same pattern as `pump-agent-launch`), so the edge function reserves and decrypts the keypair, then passes the private key bytes to the Vercel API instead of just a boolean flag.

Changes:
- `supabase/functions/fun-create/index.ts` -- Add `getVanityKeypair()` function (copy from `pump-agent-launch`), call it before the Vercel API request, and pass the vanity keypair data (`vanityPrivateKey`, `vanityPublicKey`) to the Vercel payload instead of just `useVanityAddress: true`.

---

### Part 2: Matrix Mode Content Readability

**Problem:** When Matrix Mode is active, the animated green rain canvas sits at z-0 while page content is at z-1, but the content containers use `bg-background` (opaque or near-opaque), which the `.matrix-active` CSS class strips away for transparency. This makes long-form text pages (Whitepaper, Tokenomics, docs) hard to read as the rain shows through the text.

**Solution:** Create a reusable `MatrixContentCard` wrapper component that, when Matrix Mode is active, adds a semi-transparent glassmorphic backdrop behind the main content area. When Matrix Mode is off, it renders children with no extra styling.

Changes:

1. **New file: `src/components/layout/MatrixContentCard.tsx`**
   - A wrapper component that reads `useMatrixMode()` 
   - When active: renders a `div` with `bg-background/85 backdrop-blur-md rounded-2xl border border-border/30 p-6 sm:p-8`
   - When inactive: renders children as-is (no wrapper div)

2. **`src/pages/WhitepaperPage.tsx`** -- Wrap the `<main>` content (lines 44-1228) inside `<MatrixContentCard>`

3. **`src/pages/TokenomicsPage.tsx`** -- Same treatment for its main content area

4. **`src/pages/ClawModePage.tsx`** -- Wrap `<main>` content inside `<MatrixContentCard>`

5. **Other text-heavy pages** (ApiDocsPage, AgentDocsPage, ClawSDKPage, CareersPage) -- Same pattern applied

This keeps the matrix rain visible around the edges (header, sidebar gaps, footer) while making the primary reading area clear and professional.

---

### Technical Details

**Vanity keypair flow (Part 1):**
```text
fun-create receives request
  |
  v
Call backend_reserve_vanity_address('claw')
  |
  +-- Success: decrypt keypair, pass to Vercel as vanityPrivateKey + vanityPublicKey
  +-- Failure: fall back to useVanityAddress: false (random mint)
  |
  v
Vercel API creates token with provided keypair (or generates random one)
```

**MatrixContentCard component (Part 2):**
```tsx
// Conditional glassmorphic wrapper
const MatrixContentCard = ({ children }) => {
  const { matrixEnabled } = useMatrixMode();
  if (!matrixEnabled) return <>{children}</>;
  return (
    <div className="bg-background/85 backdrop-blur-md rounded-2xl 
                    border border-border/30 p-6 sm:p-8 my-4">
      {children}
    </div>
  );
};
```

**Pages to update:** WhitepaperPage, TokenomicsPage, ClawModePage, ApiDocsPage, AgentDocsPage, ClawSDKPage, CareersPage (wrap their `<main>` content blocks).

