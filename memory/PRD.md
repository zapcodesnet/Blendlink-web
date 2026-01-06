# Blendlink PWA - Product Requirements Document

## Original Problem Statement
Build a fully responsive Progressive Web App (PWA) version of Blendlink - an all-in-one super app combining:
- Social media features (profiles, news feed, posts, likes, comments, follows, messaging/chat, stories)
- Marketplace (buy/sell items with listings, categories, search, shopping cart)
- Property rentals (listing and browsing rental properties)
- Professional services directory
- Gaming (mini-games like spin wheel, scratch cards, memory match)
- Raffle draws
- Virtual currency (BL Coin system)
- 2-level unilevel referral system

## Architecture Change (January 2026)
**IMPORTANT**: The PWA now connects to an external mobile app backend API instead of the internal backend.
- External API: `https://mobile-games-hub-11.preview.emergentagent.com/api`
- Internal backend (`/app/backend/server.py`) is **DEPRECATED**
- All data now syncs with the native Blendlink mobile app

## User Personas
1. **Social Users**: Want to connect, share posts/stories, follow friends
2. **Buyers/Sellers**: Looking to buy/sell items in marketplace
3. **Renters**: Seeking rental properties or listing their properties
4. **Service Providers**: Offering professional services
5. **Gamers**: Play games to earn BL Coins
6. **Earners**: Focus on referrals and earning rewards

## Core Requirements (Static)
- PWA installable on mobile devices
- Offline support via service worker
- Mobile-first responsive design
- Bottom navigation for easy access
- BL Coin virtual currency system
- 2-level referral commission system
- **Deep linking to native app** (blendlink://)
- **App store redirects** for iOS/Android

## What's Been Implemented

### External API Integration (January 6, 2026)
- [x] Connected to external Blendlink mobile app API
- [x] Auth endpoints working: /auth/register, /auth/login, /auth/me
- [x] Wallet endpoints working: /bl-coins/balance, /bl-coins/transactions, /bl-coins/claim-daily
- [x] Fixed game component imports (MemoryMatch, SpinWheel, ScratchCard)

### "Coming Soon" Features
The following features are NOT available in the external API and show "Coming Soon" placeholders:
- [ ] Social Feed (/posts/feed)
- [ ] Marketplace (/marketplace/listings)
- [ ] Property Rentals (/rentals/properties)
- [ ] Professional Services (/services)
- [ ] Games - Spin Wheel, Scratch Card (/games/*)
- [ ] Raffles (/raffles/*)
- [ ] Messaging (/messages/*)

### Deep Linking & Mobile Detection
- [x] Created AppOpenPrompt component for mobile users
- [x] Full-screen prompt on first mobile visit
- [x] "Open in Blendlink App" button (attempts blendlink:// deep link)
- [x] App Store / Play Store download buttons
- [x] "Continue to web version" option
- [x] Session-based prompt dismissal

### Frontend (React + Tailwind + Shadcn)
- [x] PWA manifest and service worker
- [x] Landing page with features showcase
- [x] Login/Register with Google OAuth
- [x] ComingSoonPlaceholder component (reusable)
- [x] Wallet with balance and transactions (working with API)
- [x] Daily claim functionality (working with API)
- [x] Profile page 
- [x] Referrals page with share functionality
- [x] Settings with dark mode toggle
- [x] Bottom/sidebar navigation

## Tech Stack
- Frontend: React 18 + Tailwind CSS + Shadcn UI
- Backend: External API (https://mobile-games-hub-11.preview.emergentagent.com/api)
- Auth: JWT-based (external API)
- PWA: Service Worker + manifest.json

## Key Files
- `/app/frontend/src/services/api.js` - All API calls to external backend
- `/app/frontend/src/components/AppOpenPrompt.jsx` - Mobile deep linking prompt
- `/app/frontend/src/components/ComingSoonPlaceholder.jsx` - Feature placeholder

## API Endpoints (External)
Working:
- POST /auth/register - Register new user
- POST /auth/login - Login user
- GET /auth/me - Get current user profile
- GET /bl-coins/balance - Get BL coin balance
- GET /bl-coins/transactions - Get transaction history
- POST /bl-coins/claim-daily - Claim daily reward

Not Available (404):
- /posts/* - Social features
- /marketplace/* - Marketplace features
- /rentals/* - Rental features
- /services/* - Services features
- /games/* - Games features
- /raffles/* - Raffle features

## App Store URLs (To be updated)
- iOS: https://apps.apple.com/app/id[YOUR_APP_ID]
- Android: https://play.google.com/store/apps/details?id=com.yourcompany.blendlink

## Next Tasks
1. **P0**: Confirm external API is back online and test all features
2. **P1**: Complete deep linking logic with proper fallback timing
3. **P1**: Verify PWA installability and offline support
4. **P2**: Implement push notifications when API supports them

## Test Credentials
- Email: blendlinktest1767726161@test.com
- Password: Test123456

## Known Issues
- External API may be temporarily down - all features degrade gracefully to "Coming Soon"
- Deep link timeout (2 seconds) may need tuning for different devices
