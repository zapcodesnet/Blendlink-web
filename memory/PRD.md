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

## Latest Update: Social Feed Feature (January 8, 2026)
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
- **BL Coins**: 11,310+ (accumulated from testing)

## Upcoming Tasks

### P1 - React Native Mobile App
- Set up React Native/Expo project
- Share backend with PWA
- Implement native features (camera, push notifications)
- Build for iOS and Android

### P2 - Music Generation
- Integrate music generation API (Suno/Udio alternative)
- Add to AI Media Generator

### P3 - Enhanced Social Features
- Private messaging with media
- Video looping profile pictures
- Photo/video/music albums
- Advanced privacy settings

## Future Tasks
- Real-time sync with Firebase/WebSockets
- Push notifications
- ID verification (Stripe Identity)
- Shopping cart for marketplace
- Full video watermarking
