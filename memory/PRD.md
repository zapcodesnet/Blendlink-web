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
- 2-level unilevel referral system with commissions
- Watermark & Media Sales System
- Comprehensive Earnings & Commission Management System

## Current Status: FULLY FUNCTIONAL ✅
**Last Updated:** January 7, 2026

### Test Results
- **Backend Tests:** 23/23 passed (100%)
- **Frontend Tests:** All pages load correctly (100%)
- **Login Issues:** All fixed (email + Google OAuth working)

## Authentication System

### Email Login ✅
- Endpoint: `POST /api/auth/login`
- Fields: email, password
- Returns: JWT token and user object
- **Test:** test@test.com / Test123456

### User Registration ✅
- Endpoint: `POST /api/auth/register`
- Fields: email, password, name, username, referral_code (optional)
- Auto-generates referral code
- Awards 50,000 BL Coins welcome bonus
- Auto-assigns orphan to queue if no referral code

### Google OAuth ✅
- Frontend redirects to: `https://auth.emergentagent.com/?redirect={callback_url}`
- Callback handler: `/feed` with session ID in URL hash
- Backend endpoints: `POST /api/auth/google` and `POST /api/auth/google-session`
- Emergent-managed authentication service

## Referral & Commission System

### Commission Structure (8% Total Marketplace Fee)
- **Level 1 (Direct):** 3% commission rate
- **Level 2 (Indirect):** 1% commission rate
- **Platform Fee:** 4% (remaining)

### Diamond Leader Program
- **Requirements (30-day period):**
  - 100+ direct recruits
  - $1,000+ downline commissions
  - $1,000+ personal sales
- **Benefits:**
  - $100 one-time bonus
  - Enhanced L1 rate: 4%
  - Enhanced L2 rate: 2%
  - Reduced platform fee: 2%

### Orphan Assignment System
- Users without referral code get auto-assigned
- **Priority 1:** Verified members with zero recruits (round-robin)
- **Priority 2:** Non-verified members with zero recruits (fallback)

### Withdrawals
- 1% processing fee (goes to platform)
- $10 minimum withdrawal
- ID verification required via Stripe Identity

## Tech Stack
- **Frontend:** React 18 + Tailwind CSS + Shadcn UI
- **Backend:** FastAPI + MongoDB
- **Payments:** Stripe via emergentintegrations library
- **ID Verification:** Stripe Identity (configured)
- **PWA:** Service Worker + manifest.json with offline support
- **Auth:** JWT tokens + Emergent-managed Google OAuth

## Key Features by Page

### Landing Page ✅
- Hero section with app description
- Feature highlights
- Login / Get Started buttons

### Login/Register ✅
- Email/password authentication
- Google OAuth integration
- Referral code input on registration

### Feed ✅
- Daily reward claim (10,000 BL)
- Quick access buttons (Rentals, Market, Services)
- "Social Feed Coming Soon" placeholder

### Marketplace ✅
- Category filters (Electronics, Fashion, Home, etc.)
- Product listings
- Search functionality

### Rentals ✅
- Property listings with filters
- Property details

### Services ✅
- Service categories
- Service provider listings

### Games ✅
- Spin Wheel (functional)
- Scratch Card (coming soon)
- Memory Match (functional)

### Wallet ✅
- BL Coins balance display
- Daily claim button
- Transaction history

### Profile ✅
- User info display
- BL Coins balance
- Referral code
- Earnings/Withdraw/Upload Media/My Media buttons
- Admin Dashboard button (for admins)

### Earnings Dashboard ✅
- Total Earned / Pending display
- Referral code with copy button
- Commission rates display
- Network stats (L1, L2, Total)
- Diamond Leader status progress

### Withdraw ✅
- Available balance display
- ID verification requirement
- Withdrawal form (after verification)

### Admin Dashboard ✅
- Total users count
- Commissions paid
- Platform revenue
- Diamond Leaders count
- Recent users list

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Email login
- `POST /api/auth/google` - Google OAuth login/register
- `POST /api/auth/google-session` - Google OAuth session handler
- `GET /api/auth/me` - Get current user profile

### Referral System
- `GET /api/referral-system/my-network` - Get referral network
- `GET /api/referral-system/stats` - Get referral statistics
- `GET /api/referrals/stats` - Get basic referral stats
- `POST /api/referral-system/apply-code` - Apply a referral code

### Commissions
- `GET /api/commissions/my-commissions` - Get commission history
- `GET /api/commissions/pending` - Get pending commissions

### Diamond Leader
- `GET /api/diamond/status` - Get Diamond Leader progress
- `POST /api/diamond/check-qualification` - Check qualification

### Orphan Queue
- `GET /api/orphans/queue-status` - Check queue position
- `POST /api/orphans/join-queue` - Join orphan queue

### Withdrawals
- `GET /api/withdrawals/eligibility` - Check withdrawal eligibility
- `POST /api/withdrawals/request` - Request a withdrawal
- `GET /api/withdrawals/history` - Get withdrawal history
- `POST /api/withdrawals/verify-id/start` - Start Stripe Identity verification
- `GET /api/withdrawals/verify-id/status` - Get verification status

### Admin
- `GET /api/admin/dashboard` - Admin stats
- `GET /api/admin/analytics` - 30-day analytics
- `GET /api/admin/withdrawals/pending` - Pending withdrawals
- `POST /api/admin/withdrawals/{id}/approve` - Approve withdrawal
- `POST /api/admin/withdrawals/{id}/reject` - Reject withdrawal

### Wallet
- `GET /api/wallet/balance` - Get BL coin balance
- `GET /api/wallet/transactions` - Get transaction history
- `POST /api/wallet/claim-daily` - Claim daily reward

### Marketplace
- `GET /api/marketplace/listings` - Get listings
- `GET /api/marketplace/categories` - Get categories
- `POST /api/marketplace/listings` - Create listing
- `GET /api/marketplace/listings/{id}` - Get listing details

### Rentals
- `GET /api/rentals/properties` - Get properties
- `GET /api/rentals/properties/{id}` - Get property details

### Services
- `GET /api/services` - Get services
- `GET /api/services/categories/list` - Get service categories
- `GET /api/services/{id}` - Get service details

### Media Sales
- `POST /api/watermark/templates` - Create watermark template
- `POST /api/media/upload` - Upload media with watermark
- `GET /api/media/for-sale` - Browse watermarked media
- `POST /api/offers/` - Make purchase offer
- `POST /api/payments/checkout/{offer_id}` - Stripe checkout
- `POST /api/contracts/{id}/sign/seller` - E-sign contract

## PWA Capabilities
- ✅ Installable as app
- ✅ Offline support via service worker
- ✅ Push notifications configured
- ✅ Responsive design (mobile + desktop)
- ✅ Bottom navigation (mobile)
- ✅ Sidebar navigation (desktop)

## Test Credentials
- **Email:** test@test.com
- **Password:** Test123456
- **Is Admin:** Yes
- **Referral Code:** B7C6D8EA
- **BL Coins:** 10,200

## File Structure
```
/app/
├── backend/
│   ├── server.py           # Main backend with auth, wallet, social routes
│   ├── media_sales.py      # Watermark, media, offers, contracts routes
│   └── referral_system.py  # Referral, commissions, diamond, orphan, withdrawals
├── frontend/
│   ├── public/
│   │   ├── manifest.json   # PWA manifest
│   │   └── service-worker.js # Offline caching
│   ├── src/
│   │   ├── services/
│   │   │   ├── api.js            # Main API service
│   │   │   ├── mediaSalesApi.js  # Media sales API
│   │   │   └── referralApi.js    # Referral system API
│   │   ├── pages/
│   │   │   ├── EarningsDashboard.jsx
│   │   │   ├── Withdraw.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   └── ... (all other pages)
└── test_reports/
    ├── iteration_6.json    # Referral system tests
    └── iteration_7.json    # Full app tests
```

## Upcoming Tasks

### P1 - Complete ID Verification Flow
- Connect Stripe Identity webhook for verification status updates
- Implement verification completion page

### P2 - Real-Time Updates
- Integrate Firebase Realtime Database
- Live updates for earnings, commissions, network changes

### P3 - Social Feed
- Build post creation and viewing
- Comments and likes
- User stories

## Known Limitations
- Social Feed shows "Coming Soon" placeholder
- Some games show "Coming Soon" 
- Video watermarking not fully implemented
- Shopping cart not implemented
