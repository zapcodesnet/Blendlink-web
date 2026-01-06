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

## User Choices
- Auth: Both JWT + Google OAuth
- Games: Simple casual games (spin wheel, scratch cards, memory match)
- Chat: Real-time messaging with typing indicators, media support
- Push Notifications: Web Push API
- Theme: Light default with dark mode toggle

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
- Push notification capability
- Mobile-first responsive design
- Bottom navigation for easy access
- BL Coin virtual currency system
- 2-level referral commission system

## What's Been Implemented (January 2026)
### Backend (FastAPI + MongoDB)
- [x] User authentication (JWT + Google OAuth via Emergent)
- [x] User profiles with avatars, bio, followers/following
- [x] Posts system with likes, comments
- [x] Stories (24-hour expiry)
- [x] Real-time messaging with typing indicators
- [x] Marketplace listings with categories
- [x] Property rentals with filters
- [x] Professional services directory
- [x] Games: Spin Wheel, Scratch Card, Memory Match
- [x] Raffles/contests system
- [x] BL Coin wallet with transactions
- [x] 2-level referral system (50 BL level 1, 25 BL level 2)
- [x] Daily activity rewards (5 BL)

### Frontend (React + Tailwind + Shadcn)
- [x] PWA manifest and service worker
- [x] Landing page with features showcase
- [x] Login/Register with Google OAuth
- [x] Social feed with stories carousel
- [x] Create post functionality
- [x] Marketplace with category filters
- [x] Create listing form
- [x] Property rentals browser
- [x] Services directory
- [x] Games hub with 3 mini-games
- [x] Wallet with balance and transactions
- [x] Profile page with posts grid
- [x] Messages/chat interface
- [x] Referrals page with share functionality
- [x] Settings with dark mode toggle
- [x] Bottom navigation

## Prioritized Backlog
### P0 (Critical - Next)
- [ ] Shopping cart functionality
- [ ] Payment integration for marketplace
- [ ] Image upload for posts/listings

### P1 (High Priority)
- [ ] Push notification implementation
- [ ] Property inquiry/booking form
- [ ] Service booking/scheduling
- [ ] User search functionality
- [ ] Notifications center

### P2 (Medium Priority)
- [ ] Admin moderation dashboard
- [ ] Report content feature
- [ ] User verification badges
- [ ] Premium listing options
- [ ] Saved items/wishlist

## Tech Stack
- Backend: FastAPI + Motor (async MongoDB)
- Frontend: React 18 + Tailwind CSS + Shadcn UI
- Database: MongoDB
- Auth: JWT + Emergent Google OAuth
- PWA: Service Worker + Web Push API

## API Endpoints
All endpoints prefixed with `/api`
- Auth: /auth/register, /auth/login, /auth/google-session, /auth/me
- Users: /users/{id}, /users/{id}/posts, /users/{id}/follow
- Posts: /posts/feed, /posts/explore, /posts/stories, /posts, /posts/{id}/like
- Messages: /messages/conversations, /messages/{id}
- Marketplace: /marketplace/listings, /marketplace/categories
- Rentals: /rentals/properties
- Services: /services, /services/categories/list
- Games: /games/spin-wheel, /games/scratch-card, /games/memory-match
- Raffles: /raffles, /raffles/{id}/enter
- Wallet: /wallet/balance, /wallet/transactions, /wallet/stats
- Referrals: /referrals/stats

## Next Tasks
1. Implement image upload for posts and listings
2. Add shopping cart and checkout flow
3. Implement push notifications
4. Add user search and discovery
5. Build notifications center
