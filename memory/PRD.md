# Blendlink PWA - Product Requirements Document

## Original Problem Statement
Build a fully responsive Progressive Web App (PWA) version of Blendlink - an all-in-one super app combining:
- **Facebook-style Social Media** (profiles, news feed, posts, likes, comments, follows, messaging/chat, stories)
- Marketplace (buy/sell items with listings, categories, search, shopping cart)
- Property rentals (listing and browsing rental properties)
- Professional services directory
- Gaming (mini-games like spin wheel, scratch cards, memory match)
- **Casino Games** (Slots, Blackjack, Roulette, Video Poker, Baccarat, Craps, Wheel of Fortune, Daily Spin)
- Raffle draws
- Virtual currency (BL Coin system)
- 2-level unilevel referral system with commissions
- Watermark & Media Sales System
- Comprehensive Earnings & Commission Management System
- **AI Media Generation** (images via OpenAI GPT Image 1.5, videos via Sora 2)
- **React Native Mobile App** (iOS & Android)
- **Admin System** (Full admin panel with RBAC, themes, user management, genealogy)

## Latest Update: Admin System Phase 1 (January 11, 2026)

### Admin System Phase 1 ✅ COMPLETE

**Features Implemented:**

1. **Admin Authentication & Dashboard**
   - Secure admin login with role verification
   - Admin dashboard with stats (users, admins, content, finances)
   - Recent users listing
   - Beautiful dark theme UI with sidebar navigation

2. **User Management**
   - Full user listing with search/filter
   - User details view with stats
   - Suspend/unsuspend users
   - Ban users
   - Delete users (soft delete)
   - View private albums (audit logged)
   - View private messages (GDPR compliant audit logging)

3. **Role-Based Access Control (RBAC)**
   - Super Admin (full access)
   - Co-Admin (broad access, no admin management)
   - Moderator (view/suspend users, view private content)
   - Support (view-only access)
   - Granular permissions system

4. **Theme System (47+ Themes)**
   - 47 curated themes across 12 categories
   - Categories: light, dark, neon, nature, gaming, professional, minimal, colorful, seasonal, glass, gradient, social
   - Theme preview with color swatches
   - One-click theme activation
   - Real-time sync to web + mobile
   - Theme generator from base color

5. **Genealogy Tree Visualization**
   - Visual tree hierarchy for referrals
   - Expandable/collapsible nodes
   - User stats panel (level 1/2 downlines)
   - Edit mode for drag-and-drop reassignment
   - Upline reassignment with audit logging

6. **Audit Logging**
   - All admin actions logged
   - GDPR-compliant private content access logging
   - Action types: login, view content, suspend, ban, delete, theme change, etc.

**Files Created:**
- `/app/backend/admin_system.py` - Admin backend (auth, users, admins, settings, genealogy, audit)
- `/app/backend/theme_system.py` - Theme backend (47+ themes, generator)
- `/app/frontend/src/pages/admin/AdminLayout.jsx` - Admin panel layout & dashboard
- `/app/frontend/src/pages/admin/AdminUsers.jsx` - User management component
- `/app/frontend/src/pages/admin/AdminThemes.jsx` - Theme management component
- `/app/frontend/src/pages/admin/AdminGenealogy.jsx` - Genealogy tree component

**Test Admin Credentials:**
- Email: admin@blendlink.com
- Password: admin123

---

## Previous Update: Deployment Blockers Fixed (January 10, 2026)

### Deployment Readiness Fixes ✅ COMPLETE

**Issues Fixed:**
1. ✅ **Stripe Hardcoded URLs** - Removed `localhost:3000` fallbacks in Stripe payment redirects (server.py lines 988-989)
2. ✅ **N+1 Database Queries** - Optimized properties and services endpoints with batch user fetching
3. ✅ **Backend .env** - Added `FRONTEND_URL` for Stripe redirects
4. ✅ **Mobile .env** - Added `EXPO_PUBLIC_APP_NAME` and `EXPO_PUBLIC_APP_VERSION`
5. ✅ **seller_dashboard.py** - Removed hardcoded fallbacks, added proper env validation
6. ✅ **ValueError: Invalid salt** - Added error handling in `verify_password()` function
7. ✅ **Lint Issues** - Fixed unused variables and ambiguous variable names

**Environment Files Verified:**
- `/app/backend/.env` - MONGO_URL, DB_NAME, JWT_SECRET, STRIPE_API_KEY, FRONTEND_URL, EMERGENT_LLM_KEY
- `/app/frontend/.env` - REACT_APP_BACKEND_URL, WDS_SOCKET_PORT
- `/app/mobile/.env` - EXPO_PUBLIC_API_URL, EXPO_TUNNEL_SUBDOMAIN, EXPO_PUBLIC_BACKEND_URL

**Code Quality:**
- All Python lint checks pass
- No hardcoded localhost values in production code
- Proper error handling for authentication

---

## Previous Update: Daily Spin Bonus + Mobile Casino (January 10, 2026)

### Daily Spin Bonus Feature ✅ COMPLETE
Added daily free spin bonus wheel to Casino:

**Rewards (User-Specified):**
| Reward | Probability |
|--------|-------------|
| 1,000 BL | 40% |
| 5,000 BL | 30% |
| 15,000 BL | 15% |
| 35,000 BL | 10% |
| 80,000 BL | 4% |
| 200,000 BL | 1% |

**Features:**
- One FREE spin per day (resets at midnight UTC)
- Provably fair RNG with server seed hash
- Animated wheel with 6 colorful segments
- Balance synced 100% between website and mobile app
- Recorded in casino history

**API Endpoints:**
- `GET /api/casino/daily-spin/status` - Check if user can spin today
- `POST /api/casino/daily-spin/claim` - Claim daily spin reward

### Mobile Casino Integration ✅ COMPLETE
Added full casino to React Native mobile app:

**New Mobile Screens:**
- `CasinoScreen.js` - Casino lobby with all 8 games
- `CasinoGameScreen.js` - Individual game implementations
- `CasinoStatsScreen.js` - Player statistics and history
- `GamesScreen.js` - Games section with Casino CTA (poker cards thumbnail)

**Features:**
- All 8 games: Daily Spin, Slots, Blackjack, Roulette, Wheel, Video Poker, Baccarat, Craps
- Same design and colors as website (amber/orange theme)
- Balance synced via same API endpoints
- Navigation from Games tab → Casino → Individual games

**Testing:** 13/13 tests passed (100%) - `/app/test_reports/iteration_13.json`

---

## Previous Update: Casino Games System (January 10, 2026)

### Casino Games Feature ✅ COMPLETE
Implemented comprehensive casino gambling system using BL Coins:

**Games Available (8 Total):**
1. **Daily Spin** - FREE daily bonus wheel with rewards up to 200K BL
2. **Slot Machine** - 3x3 reel slots with various symbols and payouts up to 500x
3. **Blackjack** - Classic 21 card game with hit/stand/double actions
4. **Roulette** - European roulette with red/black/odd/even/number bets
5. **Wheel of Fortune** - Spin wheel with multipliers from 0x to 50x (jackpot)
6. **Video Poker** - Jacks or Better with hold and draw mechanics
7. **Baccarat** - Player/Banker/Tie betting
8. **Craps** - Dice game with pass/don't pass/field/any seven/any craps bets

**Features:**
- Bet limits: Min 10 BL, Max 10,000 BL per game
- Provably fair RNG using server_seed + client_seed + nonce hashing
- Real-time balance updates
- Game history tracking
- Player statistics (games played, total wagered, total won, net profit)
- Leaderboard system

**Backend Files:**
- `/app/backend/casino_system.py` - All game logic and API endpoints

**Frontend Files:**
- `/app/frontend/src/pages/Casino.jsx` - Casino page with all 7 game components
- `/app/frontend/src/services/api.js` - casinoAPI methods

**API Endpoints:**
- `POST /api/casino/slots/spin` - Spin slot machine
- `POST /api/casino/blackjack/start` - Start blackjack game
- `POST /api/casino/blackjack/action` - Hit/Stand/Double in blackjack
- `POST /api/casino/roulette/spin` - Spin roulette wheel
- `POST /api/casino/poker/deal` - Deal video poker hand
- `POST /api/casino/poker/draw` - Draw new cards in poker
- `POST /api/casino/baccarat/play` - Play baccarat hand
- `POST /api/casino/craps/roll` - Roll dice in craps
- `POST /api/casino/wheel/spin` - Spin wheel of fortune
- `GET /api/casino/stats` - Get player statistics
- `GET /api/casino/history` - Get game history
- `GET /api/casino/leaderboard` - Get casino leaderboard

**Testing:** 32/32 tests passed (100%) - `/app/test_reports/iteration_12.json`

---

## Previous Update: React Native Mobile App (January 8, 2026)

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
