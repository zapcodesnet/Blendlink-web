# Blendlink PWA - Product Requirements Document

## Original Problem Statement
Build a fully responsive Progressive Web App (PWA) version of Blendlink - an all-in-one super app combining:
- **Facebook-style Social Media** (profiles, news feed, posts, likes, comments, follows, messaging/chat, stories)
- Marketplace (buy/sell items with listings, categories, search, shopping cart)
- Property rentals (listing and browsing rental properties)
- Professional services directory
- Gaming (mini-games like spin wheel, scratch cards, memory match)
- Raffle draws
- Virtual currency (BL Coin system)
- 2-level unilevel referral system with commissions
- Watermark & Media Sales System
- Comprehensive Earnings & Commission Management System
- **AI Media Generation** (images via OpenAI GPT Image 1.5, videos via Sora 2)
- **React Native Mobile App** (iOS & Android)

## Latest Update: React Native Mobile App (January 8, 2026)

### Mobile App Setup ✅
Created React Native/Expo mobile app at `/app/mobile/` that shares the same backend as PWA:

- **Framework**: React Native with Expo SDK
- **Navigation**: React Navigation (stack + bottom tabs)
- **Auth**: Expo SecureStore for token storage
- **API**: Axios client connecting to same FastAPI backend

### Mobile App Features
1. **Login/Register** - Email authentication with referral code support
2. **Social Feed** - Full Facebook-style feed with posts, reactions, comments
3. **Profile** - User info, BL coins balance, referral code, stats
4. **Bottom Tab Navigation** - Home, Market, Games, Wallet, Profile
5. **AI Create FAB** - Floating button for AI media generation

### Mobile App Structure
```
/app/mobile/
├── App.js                    # Entry point
├── app.json                  # Expo config (iOS/Android settings)
├── assets/                   # Icons, splash screens
├── src/
│   ├── context/AuthContext.js
│   ├── navigation/index.js
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── SocialFeedScreen.js
│   │   └── ProfileScreen.js
│   └── services/api.js       # Same API as PWA
```

### How to Run Mobile App
```bash
cd /app/mobile
npm install
npx expo start
# Scan QR with Expo Go app on your phone
```

### Building for App Stores
```bash
# iOS
npx eas build --platform ios
npx eas submit --platform ios

# Android
npx eas build --platform android
npx eas submit --platform android
```

---

## Previous Update: Social Feed Feature (January 8, 2026)
Implemented comprehensive Facebook-style social feed with all core features:

### Social Feed Features ✅
1. **Posts with Privacy Settings**
   - Public, Friends-only, Private options
   - Text, image, video, audio support
   - BL coin rewards for public posts:
     - Video: +50 BL coins
     - Story: +50 BL coins
     - Music/Audio: +30 BL coins
     - Photo/Image: +20 BL coins

2. **Custom Reactions System**
   - Golden Thumbs Up: Both reactor AND post owner get 10 BL coins
   - Silver Thumbs Down: Only reactor gets 10 BL coins (long-press to access)
   - Reactions are permanent (cannot change/remove)
   - Cannot react to your own posts

3. **Comments System**
   - First comment on a post: +10 BL coins (public posts only)
   - Additional comments on same post: 0 BL coins
   - Post owner replying: 0 BL coins
   - Threaded replies support

4. **Stories (24-hour expiry)**
   - Create story: +50 BL coins (public)
   - View stories from friends
   - Story viewer with seen indicators

5. **Social Features**
   - Friends: Send/accept/decline requests, unfriend
   - Groups: Create (+40 BL), join (with admin approval option), leave
   - Pages: Create (+40 BL), subscribe (+10 BL each for subscriber and owner)
   - Events: Create (+20 BL), RSVP (going/interested)

6. **AI Media Generation**
   - Image Generation: 200 BL coins (OpenAI GPT Image 1.5)
   - Video Generation: 400 BL coins (Sora 2, 4/8/12 seconds)
   - Music Generation: Coming soon (300 BL coins estimated)
   - Cost estimation before generation
   - Insufficient balance warning with earning suggestions

### Testing Status ✅
- **Backend Tests**: 29/29 passed (100%)
- **Frontend Tests**: All features working (100%)
- **Test File**: `/app/tests/test_social_feed.py`
- **Test Report**: `/app/test_reports/iteration_8.json`

## Tech Stack
- **Frontend**: React 18 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Payments**: Stripe via emergentintegrations library
- **AI Services**: 
  - OpenAI GPT Image 1.5 (image generation)
  - Sora 2 (video generation)
- **PWA**: Service Worker + manifest.json with offline support
- **Auth**: JWT tokens + Emergent-managed Google OAuth

## API Endpoints

### Social Posts
- `GET /api/social/feed` - Get personalized feed (friends, groups, pages)
- `POST /api/social/posts` - Create post with BL coin rewards
- `GET /api/social/posts/{id}` - Get single post
- `DELETE /api/social/posts/{id}` - Delete post
- `POST /api/social/posts/{id}/react` - React with golden/silver thumbs
- `GET /api/social/posts/{id}/reactions` - Get reactions list
- `POST /api/social/posts/{id}/comments` - Add comment
- `GET /api/social/posts/{id}/comments` - Get comments
- `POST /api/social/posts/{id}/share` - Share post

### Stories
- `GET /api/stories/` - Get stories from friends
- `POST /api/stories/` - Create story
- `POST /api/stories/{id}/view` - Mark story as viewed
- `DELETE /api/stories/{id}` - Delete story

### Friends
- `GET /api/friends/` - Get friends list
- `GET /api/friends/requests` - Get pending friend requests
- `POST /api/friends/request/{user_id}` - Send friend request
- `POST /api/friends/accept/{request_id}` - Accept request
- `POST /api/friends/decline/{request_id}` - Decline request
- `DELETE /api/friends/{friend_id}` - Unfriend
- `GET /api/friends/search` - Search users

### Groups
- `GET /api/groups/` - Get groups
- `POST /api/groups/` - Create group (+40 BL)
- `POST /api/groups/{id}/join` - Join group
- `POST /api/groups/{id}/leave` - Leave group

### Pages
- `GET /api/pages/` - Get pages
- `POST /api/pages/` - Create page (+40 BL)
- `POST /api/pages/{id}/subscribe` - Subscribe (+10 BL each)
- `POST /api/pages/{id}/unsubscribe` - Unsubscribe

### Events
- `GET /api/events/` - Get upcoming events
- `POST /api/events/` - Create event (+20 BL)
- `POST /api/events/{id}/rsvp` - RSVP to event

### AI Media Generation
- `POST /api/ai-media/estimate-cost` - Estimate generation cost
- `POST /api/ai-media/generate` - Generate AI media
- `GET /api/ai-media/my-generations` - Get generation history

## BL Coin Rewards Summary
| Action | BL Coins |
|--------|----------|
| Post video (public) | +50 |
| Post story (public) | +50 |
| Create group | +40 |
| Create page | +40 |
| Post music (public) | +30 |
| Create event | +20 |
| Post photo (public) | +20 |
| Golden thumbs up (reactor) | +10 |
| Golden thumbs up (owner) | +10 |
| Silver thumbs down (reactor only) | +10 |
| First comment (public post) | +10 |
| Share post (public) | +10 |
| Page subscribe (both) | +10 each |

## File Structure
```
/app/
├── backend/
│   ├── server.py           # Main backend with auth, wallet routes
│   ├── media_sales.py      # Watermark, media, offers routes
│   ├── referral_system.py  # Referral, commissions routes
│   └── social_system.py    # NEW: Social feed, stories, friends, groups, pages, events, AI media
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── SocialFeed.jsx     # NEW: Facebook-style social feed
│   │   │   ├── EarningsDashboard.jsx
│   │   │   └── ... (other pages)
│   │   ├── services/
│   │   │   └── api.js
│   │   └── App.js                 # Updated routes
└── tests/
    └── test_social_feed.py        # NEW: 29 comprehensive tests
```

## Test Credentials
- **Email**: test@test.com
- **Password**: Test123456
- **Is Admin**: Yes
- **BL Coins**: 11,362+ (accumulated from testing)

## Latest Update: Album System, AI Listing Creator & FFmpeg Integration (January 10, 2026)

### New Features Implemented ✅

**1. Album Management System**
- Full CRUD for albums (create, read, update, delete)
- Support for mixed media types (photo, video, music)
- Privacy settings (public, friends, private)
- Auto-post to feed when public media is added
- Album cover image from first media item
- Backend: `/app/backend/album_system.py`
- Frontend: `/app/frontend/src/pages/Albums.jsx`

**2. Video Thumbnail Generation**
- FFmpeg installed and configured at `/usr/bin/ffmpeg`
- Static thumbnail generation from any timestamp
- Animated GIF preview generation (3-5s loops)
- Endpoints:
  - `POST /api/albums/generate-thumbnail`
  - `POST /api/albums/generate-preview-gif`

**3. AI Listing Creator (End-to-End Flow)**
- Step 1: Upload Photos (drag-drop, up to 10 images)
- Step 2: AI Analysis (title, description, category, tags, flaws detection)
- Step 3: Price Suggestion (market research, comparisons)
- Step 4: Publish (creates listing with uploaded images)
- Fallback: Demo data when AI budget exceeded
- Frontend: `/app/frontend/src/pages/AIListingCreator.jsx`

**4. Profile Shortcuts**
- My Albums (purple folder icon)
- AI Listing (amber sparkles icon)
- Seller Tools (green shopping bag icon)
- Plus existing: Earnings, Withdraw, Upload Media

### Bug Fixes ✅
- Fixed AIListingCreator endpoint: Changed from `/api/ai-tools/suggest-price` to `/api/ai-tools/price-suggestions`
- Fixed thumbnail file serving endpoint for video previews

### Test Results
- Iteration 11: 21/21 backend tests passed (100%)
- Frontend: All features verified working
- FFmpeg: Video thumbnail generation working

## Remaining Tasks (Prioritized)

### P1 - Core Social Features
- Friends system UI
- Groups system UI
- Pages system UI
- Events system UI
- Activity feed implementation

### P2 - Watermarking System Enhancements
- Drag-and-drop watermark positioning UI
- AI Photo Studio (batch watermark, AI enhancement)
- Video watermarking (FFmpeg already installed)

### P3 - Mobile App UI Parity
- Complete SellerDashboardScreen
- Implement AlbumsScreen
- Implement AIListingCreatorScreen

### P4 - Digital Goods & Large File Transfer
- Digital goods delivery (email/Google Drive/crypto wallet)
- Secure Large File Transfer (5-15GB)
- Pricing: 5GB=1000 BL, 10GB=5000 BL, 15GB=10000 BL

## MOCKED Features
- **AI Analysis** - Falls back to demo data when LLM budget exceeded
- **Video watermarking** - Endpoint ready, FFmpeg installed
- **Music generation** - Not available (returns 501)

## Architecture Summary
- Frontend: React (web) + React Native (mobile)
- Backend: FastAPI + MongoDB
- Video Processing: FFmpeg 5.1.8
- AI: emergentintegrations library with Emergent LLM Key
- File Storage: Local /app/uploads with thumbnails directory
