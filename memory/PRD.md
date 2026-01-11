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
- **Comprehensive 2-level Referral & Compensation System**
- Watermark & Media Sales System
- **AI Media Generation** (images via OpenAI GPT Image 1.5, videos via Sora 2)
- **React Native Mobile App** (iOS & Android)
- **Admin System** (Full admin panel with RBAC, themes, user management, genealogy, A/B testing, real-time analytics, withdrawals)

---

## Latest Update: Phase 2 Complete (January 11, 2026)

### All 4 Requested Features Implemented ✅

**1. Mobile App Referral System Sync ✅**
- Created `MyTeamScreen.js` for React Native mobile app
- Full feature parity with web PWA:
  - Referral code sharing with native Share API
  - Real-time genealogy tree display (L1/L2)
  - Daily BL coin claim with countdown timer
  - Diamond Leader status and progress
  - Withdrawal status and KYC badge
  - Commission structure info
- Integrated into mobile navigation

**2. Admin Withdrawal Management Panel ✅**
- New page at `/admin/withdrawals`
- Features:
  - Stats dashboard (Total Paid Out, Fees Collected, Pending Withdrawals, Pending KYC)
  - Pending KYC Verifications panel with Approve/Reject actions
  - Withdrawal status filters (Pending, Approved, Completed, Rejected)
  - Withdrawals table with user info, amount, method, status, date
  - Detail modal for each withdrawal with full action controls
  - Approve, Complete (with payout reference), Reject (with refund option)
  - Pagination and search functionality

**3. Commission Calculation on Marketplace Sales ✅**
- Integrated into Stripe webhook handler (`/api/webhook/stripe`)
- Automatically triggers on successful payment
- Calculates L1 (3%/4%) and L2 (1%/2%) commissions
- Records commission transactions in database
- Credits USD balance to upline users
- Platform fee handling

**4. Push Notifications System ✅**
- Backend notification service (`/app/backend/notifications_system.py`)
- Notification types:
  - Commission earned (instant notification)
  - Daily BL claim ready (24h reminder)
  - Daily spin ready (24h reminder)
  - Referral joined (instant)
  - Withdrawal status updates
  - Diamond promotion/warning alerts
- API endpoints:
  - `GET /api/notifications/list` - Get user notifications
  - `POST /api/notifications/mark-read/{id}` - Mark as read
  - `POST /api/notifications/mark-all-read` - Mark all as read
  - `GET /api/notifications/preferences` - Get preferences
  - `PUT /api/notifications/preferences` - Update preferences
  - `POST /api/notifications/subscribe` - Register push subscription
- User notification preferences with granular control

---

## API Endpoints Created This Session

### Admin Withdrawal Management
- `GET /api/admin/withdrawals/list` - List all withdrawals with counts
- `GET /api/admin/withdrawals/{id}` - Get withdrawal details
- `POST /api/admin/withdrawals/{id}/approve` - Approve withdrawal
- `POST /api/admin/withdrawals/{id}/complete` - Mark as completed
- `POST /api/admin/withdrawals/{id}/reject` - Reject with refund option
- `GET /api/admin/withdrawals/stats/summary` - Withdrawal statistics
- `GET /api/admin/withdrawals/kyc/pending` - List pending KYC users
- `POST /api/admin/withdrawals/kyc/{user_id}/approve` - Approve KYC
- `POST /api/admin/withdrawals/kyc/{user_id}/reject` - Reject KYC

### Notifications
- `GET /api/notifications/list` - Get notifications (with pagination, unread filter)
- `POST /api/notifications/mark-read/{id}` - Mark notification as read
- `POST /api/notifications/mark-all-read` - Mark all as read
- `DELETE /api/notifications/{id}` - Delete notification
- `GET /api/notifications/preferences` - Get notification preferences
- `PUT /api/notifications/preferences` - Update preferences
- `POST /api/notifications/subscribe` - Register push subscription

---

## Files Created/Modified

### Backend
- `/app/backend/notifications_system.py` - NEW: Push notifications service
- `/app/backend/diamond_withdrawal_system.py` - MODIFIED: Added admin_withdrawal_router
- `/app/backend/referral_system.py` - MODIFIED: Commission notifications integration
- `/app/backend/server.py` - MODIFIED: Commission processing in webhook, router registration
- `/app/backend/media_sales.py` - MODIFIED: Fixed commission function signature

### Frontend
- `/app/frontend/src/pages/admin/AdminWithdrawals.jsx` - NEW: Admin withdrawal management
- `/app/frontend/src/pages/admin/AdminLayout.jsx` - MODIFIED: Added Withdrawals route and menu

### Mobile
- `/app/mobile/src/screens/MyTeamScreen.js` - NEW: Mobile referral screen
- `/app/mobile/src/navigation/index.js` - MODIFIED: Added MyTeam navigation

---

## Testing Results
- **Iteration 17**: Backend 100% (33/33 tests), Frontend 100%
- All admin withdrawal management endpoints tested
- All notification endpoints tested
- KYC workflow tested
- Diamond status and disclaimer endpoints tested

---

## Tech Stack
- **Frontend**: React 18 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Payments**: Stripe (Checkout + Identity for KYC)
- **AI Services**: OpenAI GPT Image 1.5, Sora 2, GPT-4o
- **PWA**: Service Worker + manifest.json with offline support
- **Auth**: JWT tokens + Emergent-managed Google OAuth
- **Mobile**: React Native/Expo

## Test Credentials
- **Admin**: `blendlinknet@gmail.com` / `link2026blend!`
- **Test User 1**: `testref@test.com` / `test123` (Referral Code: BFD6E873)
- **Test User 2**: `testref2@test.com` / `test123`

---

## Remaining Tasks (Prioritized)

### P0 - Critical
- [ ] Web push notification delivery (integrate web-push library)
- [ ] Mobile push notifications (Expo notifications)

### P1 - High
- [ ] AI Music Generation feature
- [ ] Complete Friends/Groups/Events/Pages UI

### P2 - Medium
- [ ] Video watermarking with drag-and-drop UI
- [ ] Looping video thumbnails (FFmpeg)
- [ ] Mobile Admin Panel full functionality

### P3 - Lower
- [ ] App Store submission prep
- [ ] Performance optimization
