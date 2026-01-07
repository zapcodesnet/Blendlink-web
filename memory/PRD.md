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
- Watermark & Media Sales System

## Latest Update: Deep Linking Removed (January 7, 2026)
All native app deep linking code has been removed. The PWA now operates as a standalone web application without any references to or prompts for native mobile apps.

### Removed Components
- `AppOpenPrompt.jsx` - Deleted entirely
- Deep link URLs (`blendlink://`) - Removed from all files
- App Store URLs - Removed from all files
- Mobile app prompts - Removed from Settings and other pages

### Simplified Components
- `ComingSoonPlaceholder.jsx` - Now shows only title, description, and icon without app download buttons

## Authentication

### Email Login
- Endpoint: `POST /api/auth/login`
- Fields: email, password
- Returns: JWT token and user object

### User Registration  
- Endpoint: `POST /api/auth/register`
- Fields: email, password, name, username
- Auto-generates referral code
- Awards 50,000 BL Coins welcome bonus

### Google OAuth (Emergent Auth)
- Frontend redirects to: `https://auth.emergentagent.com/?redirect={callback_url}`
- Callback handler: `/feed` with session ID in URL
- Backend endpoint: `POST /api/auth/google`
- Creates new user if not exists, or logs in existing user
- Fields: email, name, picture, google_id

## Tech Stack
- **Frontend**: React 18 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Payments**: Stripe via emergentintegrations library
- **PWA**: Service Worker + manifest.json
- **Auth**: JWT tokens + Emergent-managed Google OAuth

## Key API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Email login
- `POST /api/auth/google` - Google OAuth login/register
- `GET /api/auth/me` - Get current user profile

### Wallet
- `GET /api/wallet/balance` - Get BL coin balance
- `GET /api/wallet/transactions` - Get transaction history
- `POST /api/wallet/claim-daily` - Claim daily login reward (10,000 BL)
- `GET /api/wallet/stats` - Get wallet statistics

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

## Testing Status (January 7, 2026)
- Backend: 19/19 tests passed ✅
- Frontend: All pages load correctly ✅
- Deep linking: Completely removed ✅
- Test files: `/app/tests/test_blendlink_auth.py`

## File Structure
```
/app/
├── backend/
│   ├── server.py           # Main backend with auth, wallet, social routes
│   └── media_sales.py      # Watermark, media, offers, contracts routes
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   ├── api.js          # Main API service
│   │   │   └── mediaSalesApi.js # Media sales API
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Feed.jsx
│   │   │   ├── Wallet.jsx
│   │   │   ├── Profile.jsx
│   │   │   ├── MediaUpload.jsx
│   │   │   └── ...
│   │   └── components/
│   │       ├── ComingSoonPlaceholder.jsx  # Simplified
│   │       ├── WatermarkCreator.jsx
│   │       └── OfferModal.jsx
└── tests/
    └── test_blendlink_auth.py
```

## Next Tasks
1. Add cloud storage for media files (currently using data URLs)
2. Generate downloadable PDF contracts
3. Implement push notifications
4. Add social features (posts, comments, likes)

## Known Limitations
- PDF contract generation not yet implemented
- Cloud storage integration needed for media files
- Social features show "Coming Soon" placeholder
