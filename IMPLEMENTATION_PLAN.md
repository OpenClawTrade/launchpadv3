# TRENCHES Implementation Plan

## ✅ COMPLETED FEATURES

### Core Social Features
- [x] Post creation with text and images
- [x] Like/Unlike posts with optimistic updates
- [x] Repost/Unrepost with notifications
- [x] Bookmark posts
- [x] Reply to posts (threaded)
- [x] Share posts (Web Share API + clipboard)
- [x] Post view counter (increments on detail view)

### User Interactions
- [x] Follow/Unfollow users
- [x] Mute users
- [x] Block users
- [x] Report posts/users

### Profiles & Authentication
- [x] User profiles with bio, location, website
- [x] Profile editing
- [x] Privy authentication (wallet, Twitter, email)
- [x] Solana wallet integration
- [x] Protected routes for authenticated pages

### Discovery & Navigation
- [x] Home feed with real-time updates
- [x] Explore page with search
- [x] Trending topics algorithm
- [x] Who to follow suggestions
- [x] User search
- [x] Hashtag extraction and linking

### Messaging & Notifications
- [x] Direct messages (real-time)
- [x] Notifications (likes, follows, replies, reposts)
- [x] Unread counts

### Community Features
- [x] Communities creation and joining
- [x] Community listings

### Legal & Footer
- [x] Terms of Service page (/terms)
- [x] Privacy Policy page (/privacy)
- [x] Cookie Policy page (/cookies)
- [x] Accessibility page (/accessibility)
- [x] Footer links working

### Admin
- [x] Admin panel for reports
- [x] Role-based access control

### AI Features
- [x] TRENCHES AI chat assistant

---

## 🚧 REMAINING ITEMS (Low Priority)

### Phase 6: ComposePost Extras
- [ ] **Emoji Picker** - UI exists, needs connection to input
- [ ] **Location Button** - No location API
- [ ] **Schedule Button** - No scheduling backend
- [ ] **"Everyone can reply" Selector** - UI only

### Phase 8: Profile Enhancements
- [ ] **Avatar Upload** - Add file upload in EditProfileModal
- [ ] **Cover Upload** - Add file upload in EditProfileModal

### Additional Nice-to-Haves
- [ ] Replies tab on user profile (show user's replies)
- [ ] Media tab on user profile (show posts with images)
- [ ] Likes tab on user profile (show user's liked posts)
- [ ] Infinite scroll / pagination for feeds
- [ ] Push notifications (service worker)
- [ ] Offline support (PWA)

---

## ✅ JUST COMPLETED (This Session)

1. **Fixed duplicate footer** - Removed version text from Settings Help section
2. **Created legal pages** - Terms, Privacy, Cookies, Accessibility with full content
3. **Fixed "Show more" links** - Navigate to Explore with tab filters
4. **Reposts on user profile** - User timeline includes their reposts
5. **View counter** - Posts increment views_count when viewed
6. **Protected /settings route** - Redirects unauthenticated users
7. **Fixed footer links** - All link to proper pages using React Router

---

## Notes
- All core X.com-like features are functional
- Backend powered by Supabase with real-time subscriptions
- Authentication via Privy with Solana wallet support
- Remaining items are enhancement/polish features
