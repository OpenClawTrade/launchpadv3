

# Add "Realistic" Launch Mode

## What This Does
Adds a 6th launch mode tab called **"Realistic"** alongside the existing Random, Describe, Custom, Phantom, and Holders tabs. It works identically to "Describe" (user types a prompt, AI generates token concept + image), but the image generation prompt enforces **photorealistic, real-life photography style** instead of cartoon/meme style.

## Changes

### 1. Update Edge Function: `supabase/functions/fun-generate/index.ts`
- Accept a new optional field `imageStyle: "realistic"` in the request body
- When `imageStyle === "realistic"`, use a different image prompt that enforces:
  - Photorealistic, DSLR-quality photography
  - Real textures, lighting, shadows
  - No cartoon, no illustration, no meme style
  - No anime, no flat colors, no bold outlines
- The concept generation (name/ticker/description) stays the same as Describe mode

### 2. Update Frontend: `src/components/launchpad/TokenLauncher.tsx`
- Add `"realistic"` to the `generatorMode` union type
- Add a new mode entry in the `modes` array with a camera icon (`Camera` from lucide-react)
- Add new state variables: `realisticPrompt`, `realisticToken`
- Add `handleRealisticGenerate` handler -- same as `handleDescribeGenerate` but passes `imageStyle: "realistic"` to the edge function
- Add `handleRealisticLaunch` handler -- same as `handleDescribeLaunch` but for `realisticToken`
- Add the UI section for `generatorMode === "realistic"` -- mirrors the Describe mode UI with:
  - Different placeholder text: "e.g., A golden retriever wearing a tiny top hat in a park..."
  - Different subtitle: "Describe what you want. AI generates a realistic, real-life image."
  - Button label: "Generate Realistic Image"

## Technical Details

**Edge function image prompt for realistic mode:**
```
Create a photorealistic image based on: "{userDescription}"

CRITICAL STYLE REQUIREMENTS:
- Photorealistic, like a real photograph taken with a DSLR camera
- Real lighting, real textures, real shadows
- NO cartoon, NO illustration, NO anime, NO meme style
- NO flat colors, NO bold outlines, NO vector art
- Must look like an actual photograph of a real scene
- Square format, centered composition
- No text, no watermarks
```

**New mode button:**
- Icon: `Camera` (from lucide-react)
- Label: "Realistic"
- Positioned after "Describe" in the tab bar

**State additions:**
- `realisticPrompt: string`
- `realisticToken: MemeToken | null`

No database changes required. No new edge functions needed -- the existing `fun-generate` function is extended with one additional parameter.

