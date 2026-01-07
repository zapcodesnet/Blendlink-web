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

## Latest Update: Referral & Commission System (January 7, 2026)
Implemented comprehensive referral and commission system with:

### Commission Structure (8% Total Marketplace Fee)
- **Level 1 (Direct)**: 3% commission rate
- **Level 2 (Indirect)**: 1% commission rate
- **Platform Fee**: 4% (remaining)

### Diamond Leader Program
- **Requirements (30-day period)**:
  - 100+ direct recruits
  - $1,000+ downline commissions
  - $1,000+ personal sales
- **Benefits**:
  - $100 one-time bonus
  - Enhanced L1 rate: 4%
  - Enhanced L2 rate: 2%
  - Reduced platform fee: 2%

### Orphan Assignment System
- Users who register without referral code get auto-assigned
- **Priority 1**: Verified members with zero recruits (round-robin)
- **Priority 2**: Non-verified members with zero recruits (fallback)
- Non-verified users can join queue but have lower priority

### Withdrawals
- 1% processing fee (goes to platform)
- $10 minimum withdrawal
- ID verification required via Stripe Identity

## Authentication

### Email Login
- Endpoint: `POST /api/auth/login`
- Fields: email, password
- Returns: JWT token and user object

### User Registration  
- Endpoint: `POST /api/auth/register`
- Fields: email, password, name, username, referral_code (optional)
- Auto-generates referral code
- Awards 50,000 BL Coins welcome bonus
- Creates referral relationship if code provided
- Auto-assigns orphan to queue if no referral code

### Google OAuth (Emergent Auth)
- Frontend redirects to: `https://auth.emergentagent.com/?redirect={callback_url}`
- Callback handler: `/feed` with session ID in URL
- Backend endpoint: `POST /api/auth/google-session`
- Creates new user if not exists, or logs in existing user
- Auto-assigns orphan to queue for new users

## Tech Stack
- **Frontend**: React 18 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Payments**: Stripe via emergentintegrations library
- **ID Verification**: Stripe Identity (planned)
- **PWA**: Service Worker + manifest.json
- **Auth**: JWT tokens + Emergent-managed Google OAuth

## Key API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Email login
- `POST /api/auth/google-session` - Google OAuth login/register
- `GET /api/auth/me` - Get current user profile

### Referral System
- `GET /api/referral-system/my-network` - Get referral network (upline, L1/L2 counts, members)
- `GET /api/referral-system/stats` - Get detailed referral statistics with commission rates
- `POST /api/referral-system/apply-code` - Apply a referral code

### Commissions
- `GET /api/commissions/my-commissions` - Get commission history with totals
- `GET /api/commissions/pending` - Get pending commissions

### Diamond Leader
- `GET /api/diamond/status` - Get Diamond Leader progress
- `POST /api/diamond/check-qualification` - Check qualification status

### Orphan Queue
- `GET /api/orphans/queue-status` - Check position in orphan queue
- `POST /api/orphans/join-queue` - Join orphan assignment queue

### Withdrawals
- `GET /api/withdrawals/eligibility` - Check withdrawal eligibility
- `POST /api/withdrawals/request` - Request a withdrawal
- `GET /api/withdrawals/history` - Get withdrawal history
- `POST /api/withdrawals/verify-id/start` - Start Stripe Identity verification
- `GET /api/withdrawals/verify-id/status` - Get ID verification status

### Admin
- `GET /api/admin/dashboard` - Admin stats (users, commissions, revenue)
- `GET /api/admin/withdrawals/pending` - Pending withdrawal requests
- `POST /api/admin/withdrawals/{id}/approve` - Approve withdrawal
- `POST /api/admin/withdrawals/{id}/reject` - Reject withdrawal
- `GET /api/admin/analytics` - 30-day analytics

### Wallet
- `GET /api/wallet/balance` - Get BL coin balance
- `GET /api/wallet/transactions` - Get transaction history
- `POST /api/wallet/claim-daily` - Claim daily login reward (10,000 BL)

### Media Sales
- `POST /api/watermark/templates` - Create watermark template
- `POST /api/media/upload` - Upload media with watermark
- `GET /api/media/for-sale` - Browse watermarked media
- `POST /api/offers/` - Make purchase offer
- `POST /api/payments/checkout/{offer_id}` - Stripe checkout
- `POST /api/contracts/{id}/sign/seller` - E-sign contract

## Test Credentials
- Email: test@test.com
- Password: Test123456
- Is Admin: Yes

## Testing Status (January 7, 2026)
- Backend: 25/25 tests passed ✅
- Frontend: All pages load correctly ✅
- Referral System: Fully functional ✅
- Commission Processing: Integrated into media sales ✅
- Test files: 
  - `/app/tests/test_referral_system.py`
  - `/app/tests/test_referral_features.py`
  - `/app/test_reports/iteration_6.json`

## File Structure
```
/app/
├── backend/
│   ├── server.py           # Main backend with auth, wallet, social routes
│   ├── media_sales.py      # Watermark, media, offers, contracts routes
│   └── referral_system.py  # Referral, commissions, diamond, orphan, withdrawals
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── api.js            # Main API service
│   │   │   ├── mediaSalesApi.js  # Media sales API
│   │   │   └── referralApi.js    # Referral system API
│   │   ├── pages/
│   │   │   ├── EarningsDashboard.jsx  # Main earnings/referral UI
│   │   │   ├── Withdraw.jsx           # Withdrawal with ID verification
│   │   │   ├── AdminDashboard.jsx     # Admin panel
│   │   │   └── ... other pages
└── test_reports/
    └── iteration_6.json    # Latest test results
```

## Upcoming Tasks

### P1 - ID Verification Integration
- Complete Stripe Identity integration for automated verification
- Connect verification status to withdrawal eligibility

### P2 - Real-Time Syncing
- Integrate Firebase Realtime Database
- Live updates for earnings, commissions, network changes

### P3 - Enhanced Admin Panel
- Full user management
- Commission payout processing
- Platform analytics dashboard

## Future Tasks
- Social Feed functionality (currently "Coming Soon")
- Activity feed implementation
- Video watermarking completion
- Shopping cart for marketplace
