

## Batch Copy Feature for Follower Scanner

Add a "Batch Copy 50" button to each tab that lets you copy 50 usernames at a time in `@username @username @username...` format, marking copied batches as "used."

### How it works

1. A "Copy Next 50" button appears above each follower table
2. Clicking it copies the next 50 usernames (e.g., `@user1 @user2 @user3 ...`) to clipboard
3. Copied batches get visually marked (grayed out rows) so you know which ones are done
4. A counter shows progress: "Copied 0/880" updating as you go
5. A "Reset" button clears all "used" marks to start over

### Technical Details

**File: `src/pages/FollowerScanPage.tsx`**

- Add a `copiedIndices` state (`Set<number>`) tracking which follower indices have been copied
- Add a `batchCopy(data: FollowerRecord[])` function that:
  - Finds the first 50 un-copied indices in the given filtered list
  - Builds a string: `@user1 @user2 @user3 ...` (space-separated)
  - Calls `copyToClipboard()` from `src/lib/clipboard.ts`
  - Shows a toast: "Copied 50 usernames!"
  - Adds those indices to `copiedIndices`
- Add a "Copy Next 50" button + progress counter above each `FollowerTable`
- In `FollowerTable`, apply `opacity-40` to rows whose index is in `copiedIndices`
- Add a "Reset" button to clear `copiedIndices`

No backend changes needed -- purely frontend.

