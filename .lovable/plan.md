
# Add Custom Image Upload to Trading Agent Creation

## Password Answer
The **Trading Agent beta access password is: `TUNA`** (case-insensitive)

---

## Current State
- The trading agent creation form already has fields for custom Name and Ticker
- Currently, users can only use AI-generated avatars via the "Generate Character" button
- The backend (`trading-agent-create`) already accepts an `avatarUrl` parameter

## Implementation Plan

### 1. Update the Form Component

**File: `src/components/trading/CreateTradingAgentModal.tsx`**

Add a new section for custom image upload alongside the existing avatar preview:

- Add a file input for image upload (accepts PNG, JPG, WebP)
- Add a state for `customImage` (File or null)
- Add a preview for the uploaded custom image
- Allow user to choose between:
  - AI-generated avatar (existing "Generate Character" flow)
  - Custom uploaded image

**UI Changes:**
- Add an "Upload Custom" button next to the avatar preview area
- Show the uploaded image as preview when selected
- Clear custom image when "Generate Character" is clicked (and vice versa)
- Show file size/type validation feedback

### 2. Upload Image to Storage

**Flow:**
1. When user selects an image file, validate it (max 2MB, image types only)
2. On form submit, if `customImage` exists:
   - Upload to Supabase storage (`agent-avatars` bucket)
   - Get the public URL
   - Use that URL as `avatarUrl` in the API call
3. If no custom image, use `generatedAvatar` as before

**Implementation in Modal:**
```typescript
const [customImageFile, setCustomImageFile] = useState<File | null>(null);
const [customImagePreview, setCustomImagePreview] = useState<string | null>(null);

const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image too large", description: "Max 2MB", variant: "destructive" });
      return;
    }
    setCustomImageFile(file);
    setCustomImagePreview(URL.createObjectURL(file));
    setGeneratedAvatar(null); // Clear AI avatar when custom is uploaded
  }
};
```

### 3. Create Storage Bucket (if needed)

Check if `agent-avatars` bucket exists, or use existing bucket for agent images. The bucket should allow public read access for avatar URLs.

### 4. Update Submit Handler

Modify `onSubmit` to:
1. Check if `customImageFile` exists
2. If yes, upload to storage and get URL
3. Pass the URL (custom or generated) to the API

```typescript
const onSubmit = async (values: FormValues) => {
  try {
    let finalAvatarUrl = generatedAvatar;
    
    // Upload custom image if provided
    if (customImageFile) {
      const fileName = `trading-agent-${Date.now()}.${customImageFile.name.split('.').pop()}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("agent-avatars")
        .upload(fileName, customImageFile, { upsert: true });
      
      if (uploadError) throw new Error("Failed to upload image");
      
      const { data: { publicUrl } } = supabase.storage
        .from("agent-avatars")
        .getPublicUrl(fileName);
      
      finalAvatarUrl = publicUrl;
    }
    
    const result = await createAgent.mutateAsync({
      ...values,
      avatarUrl: finalAvatarUrl || undefined,
    });
    // ... rest of handler
  }
};
```

### 5. UI Layout Update

The avatar section will have:

```
+--------------------------------------------------+
|  [Avatar Preview]    | [Generate Character] btn  |
|  (shows custom or    | [Upload Custom Image] btn |
|   generated avatar)  | (hidden file input)       |
+--------------------------------------------------+
```

With clear visual indication of which mode is active.

---

## Files to Modify

1. **`src/components/trading/CreateTradingAgentModal.tsx`**
   - Add custom image upload state
   - Add file input (hidden) with click handler
   - Update avatar preview section to show custom OR generated
   - Modify submit handler to upload custom image first
   - Add clear buttons to switch between custom/generated

---

## Technical Details

**Validation:**
- Max file size: 2MB
- Accepted types: image/png, image/jpeg, image/webp

**Storage:**
- Use existing Supabase storage bucket (will check for `agent-avatars` or similar)
- Generate unique filename with timestamp
- Get public URL after upload

**UX:**
- Clicking "Upload Custom" opens file picker
- After upload, preview shows the custom image
- Clicking "Generate Character" clears custom and generates AI avatar
- User can switch between custom and generated freely before submitting
