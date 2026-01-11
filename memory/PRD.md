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
- **Admin System** (Full admin panel with RBAC, themes, user management, genealogy, A/B testing, real-time analytics)

---

## Latest Update: Referral & Compensation System Phase 1 Complete (January 11, 2026)

### Referral & Compensation System ✅ COMPLETE

**Backend Implementation:**

1. **2-Level Unilevel Commission Plan**
   - Regular Members: 3% L1, 1% L2
   - Diamond Leaders: 4% L1, 2% L2
   - Platform fee: 90% (configurable)
   - Commissions recorded in `commissions` collection

2. **Sign-up Bonus System**
   - 50,000 BL coins for referrer on new signup with code
   - Referral relationships tracked in `referral_relationships` collection
   - Orphan assignment system for users without referral code (11-tier priority)

3. **Daily BL Coin Claim**
   - Regular members: 2,000 BL coins per 24 hours
   - Diamond Leaders: 5,000 BL coins per 24 hours
   - Server-side validation with cooldown tracking
   - WebSocket broadcast on balance update

4. **Diamond Leader System**
   - Qualification (within 30 days): 100 direct recruits, $1,000 downline commissions, $1,000 personal sales
   - One-time rewards: $100 USD + 500,000 BL coins
   - Maintenance (every 30 days): 1 new recruit, $10 personal sales, $10 commissions
   - Automatic demotion on maintenance failure

5. **KYC Verification (Stripe Identity)**
   - Integration with Stripe Identity API
   - Manual fallback when Identity not available
   - Status tracking: not_started, pending, verified

6. **Cash Withdrawals**
   - 1% platform fee
   - $10 minimum withdrawal
   - Requires KYC verification
   - Admin manual payout system
   - Withdrawal history tracking

7. **Inactivity Reassignment**
   - 5-year inactivity threshold
   - Admin-approved reassignment
   - Downline transferred to new upline

**Frontend Implementation:**

1. **My Team Page (`/my-team`)**
   - Referral code card with copy and share buttons
   - Stats row: L1 count, L2 count, BL Coins balance
   - Daily BL Claim section with countdown timer
   - Diamond Leader progress section with qualification bars
   - Withdrawal section with KYC status badge
   - Visual genealogy tree with zoom controls
   - Commission structure info (Regular vs Diamond rates)
   - Privacy notice
   - Legal disclaimer modal

**API Endpoints Created:**
- `GET /api/referral/genealogy` - Get L1/L2 downlines
- `POST /api/referral/daily-claim` - Claim daily BL coins
- `GET /api/referral/my-stats` - Get referral statistics
- `GET /api/referral/upline` - Get L1/L2 upline
- `GET /api/referral/balances` - Get BL and USD balances
- `GET /api/diamond/status` - Get Diamond qualification progress
- `POST /api/diamond/check-qualification` - Check and promote
- `GET /api/diamond/disclaimer` - Get legal disclaimer
- `GET /api/kyc/status` - Get KYC verification status
- `POST /api/kyc/init` - Initialize KYC (Stripe Identity)
- `GET /api/withdrawal/status` - Get withdrawal eligibility
- `POST /api/withdrawal/request` - Request withdrawal
- `GET /api/withdrawal/history` - Get withdrawal history
- `POST /api/reassignment/request` - Request reassignment (admin)
- `GET /api/reassignment/admin/list` - List pending reassignments
- `POST /api/reassignment/admin/approve/{id}` - Approve reassignment
- `POST /api/reassignment/admin/reject/{id}` - Reject reassignment

**Files Created/Modified:**
- `/app/backend/referral_system.py` - Core referral logic
- `/app/backend/diamond_withdrawal_system.py` - Diamond, KYC, Withdrawal routers
- `/app/backend/server.py` - Router registration
- `/app/frontend/src/pages/MyTeam.jsx` - New My Team page
- `/app/frontend/src/services/referralApi.js` - Updated API service
- `/app/frontend/src/App.js` - Route added
- `/app/frontend/src/pages/Wallet.jsx` - Link to My Team
- `/app/frontend/src/pages/EarningsDashboard.jsx` - Fixed imports
- `/app/frontend/src/pages/Withdraw.jsx` - Fixed imports

**Testing Results:**
- Backend: 85% (17/20 tests passed)
- Frontend: 100% (All UI elements working)

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
- **Test User 1**: `testref@test.com` / `test123` (Referral Code: BFD6E873)
- **Test User 2**: `testref2@test.com` / `test123`
- **Admin**: `blendlinknet@gmail.com` / `link2026blend!`

---

## Remaining Tasks (Prioritized)

### P0 - High Priority
- [ ] Mobile App Referral System Integration (sync with PWA)
- [ ] Admin Withdrawal Management Panel
- [ ] Commission calculation on marketplace sales

### P1 - Medium Priority
- [ ] Mobile Admin Panel full functionality
- [ ] AI Music Generation feature
- [ ] Complete Friends/Groups/Events/Pages UI

### P2 - Lower Priority
- [ ] Video watermarking with drag-and-drop UI
- [ ] Looping video thumbnails (FFmpeg)
- [ ] App Store submission prep

---

## Code Architecture
```
/app/
├── backend/
│   ├── referral_system.py      # Referral & commission logic
│   ├── diamond_withdrawal_system.py # Diamond, KYC, Withdrawal
│   ├── admin_system.py         # Admin panel
│   ├── realtime_ab_system.py   # WebSockets, A/B testing
│   └── server.py               # Main FastAPI app
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── MyTeam.jsx      # Referral/Genealogy page
│       │   └── admin/          # Admin panel pages
│       └── services/
│           └── referralApi.js  # Referral API client
└── mobile/
    └── src/
        └── screens/            # React Native screens
```
