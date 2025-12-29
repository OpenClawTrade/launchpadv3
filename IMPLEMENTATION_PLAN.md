# FAUTRA Implementation Plan

## Non-Functional Elements to Fix

### Phase 1: Critical Routing & Navigation (Priority: HIGH) ✅ DONE
- [x] **Settings Page** - `/settings` route created
- [x] **Compose Modal** - Sidebar "Post" button opens modal
- [x] **Mobile Compose FAB** - Opens compose modal
- [x] **User Profile Routes** - `/:username` dynamic routing added
- [ ] **User Profile Routes** - `/:username` dynamic routing missing

### Phase 2: Post Interactions (Priority: HIGH)
- [ ] **Image Upload for Posts** - ComposePost image button is UI only
- [ ] **Reply Functionality** - Reply button has no modal/thread view
- [ ] **Repost Functionality** - Only UI updates, no DB operation
- [ ] **Share Button** - No functionality (copy link / native share)

### Phase 3: PostCard Dropdown Actions (Priority: MEDIUM)
- [ ] **"Not interested in this post"** - No functionality
- [ ] **"Follow @user"** - No functionality
- [ ] **"Mute @user"** - No functionality  
- [ ] **"Block @user"** - No functionality
- [ ] **"Report post"** - No functionality

### Phase 4: Sidebar Elements (Priority: MEDIUM)
- [ ] **Search Input** - UI only, not connected to search
- [ ] **"More" Button** - Opens nothing

### Phase 5: Right Sidebar (Priority: LOW)
- [ ] **"Subscribe to Premium"** - No Stripe integration
- [ ] **Trending "Show more"** - No navigation
- [ ] **Who to follow "Show more"** - No navigation
- [ ] **Footer Links** - Terms, Privacy, Cookies, Accessibility all `href="#"`

### Phase 6: ComposePost Extras (Priority: LOW)
- [ ] **Emoji Picker** - No functionality
- [ ] **Location Button** - No functionality
- [ ] **Schedule Button** - No functionality
- [ ] **"Everyone can reply" Selector** - UI only

### Phase 7: AI Page (Priority: LOW)
- [ ] **AI Chat** - Hardcoded mock responses, needs Lovable AI gateway

### Phase 8: Profile Enhancements (Priority: MEDIUM)
- [ ] **Avatar Upload** - No file upload in EditProfileModal
- [ ] **Cover Upload** - No file upload in EditProfileModal

---

## Completed Items
<!-- Move items here when done -->

---

## Notes
- Focus on Phase 1 first as these are critical navigation issues
- Phase 2 is essential for core social functionality
- Phases 5-7 can be deferred or simplified
