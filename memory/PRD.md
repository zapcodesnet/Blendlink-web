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
- **NEW: Watermark & Media Sales System**

## Latest Feature: Watermark & Media Sales (January 7, 2026)
Users can create customizable watermarks and upload photos/videos with watermarks. Public watermarked media is automatically listed for sale. Anyone can make purchase offers, and sales are completed with Stripe payments and e-signed copyright transfer contracts.

### Watermark Features
- Text-based watermarks only
- 70-90% transparency (0.1-0.3 opacity)
- Customizable: font family, size, color, rotation
- Drag-and-drop positioning on canvas preview
- Multiple watermark templates per user
- Set default watermark option

### Media Upload
- Upload photos and videos
- Apply watermark before publishing
- Privacy settings: Public (auto-listed for sale) or Private
- Optional fixed price for marketplace listing

### Offer System
- Guests and members can make offers on watermarked media
- Offers include: amount, name, email, optional message
- Sellers receive/accept/reject offers
- No price tag required - accept any offer

### Payment & Contract
- Stripe integration for credit/debit card payments
- E-signature contract system:
  - Both seller and buyer must sign
  - Typed or drawn signature options
  - PDF contract generation (planned)
- After both signatures: buyer downloads original unwatermarked media
- Media removed from seller's profile after sale

## Tech Stack
- **Frontend**: React 18 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Payments**: Stripe via emergentintegrations library
- **PWA**: Service Worker + manifest.json

## Key Files

### Backend
- `/app/backend/server.py` - Main backend with auth, wallet, social routes
- `/app/backend/media_sales.py` - Watermark, media, offers, contracts, payments routes

### Frontend - Pages
- `/app/frontend/src/pages/MediaUpload.jsx` - 3-step media upload with watermark
- `/app/frontend/src/pages/MyMedia.jsx` - User's uploaded media gallery
- `/app/frontend/src/pages/MediaForSale.jsx` - Browse all watermarked media
- `/app/frontend/src/pages/Offers.jsx` - Received/Sent offers management
- `/app/frontend/src/pages/Contract.jsx` - E-signature contract page
- `/app/frontend/src/pages/PaymentSuccess.jsx` - Payment confirmation
- `/app/frontend/src/pages/PaymentCancel.jsx` - Payment cancelled

### Frontend - Components
- `/app/frontend/src/components/WatermarkCreator.jsx` - Watermark template creator with preview
- `/app/frontend/src/components/OfferModal.jsx` - Make offer modal

### Frontend - Services
- `/app/frontend/src/services/api.js` - Main API service
- `/app/frontend/src/services/mediaSalesApi.js` - Media sales API service

## API Endpoints

### Watermarks
- `POST /api/watermark/templates` - Create watermark template
- `GET /api/watermark/templates` - Get all templates
- `GET /api/watermark/templates/{id}` - Get specific template
- `PUT /api/watermark/templates/{id}` - Update template
- `DELETE /api/watermark/templates/{id}` - Delete template

### Media
- `POST /api/media/upload` - Upload media with watermark
- `GET /api/media/my-media` - Get user's media
- `GET /api/media/for-sale` - Get all public media for sale
- `GET /api/media/{id}` - Get media detail
- `DELETE /api/media/{id}` - Delete media

### Offers
- `POST /api/offers/` - Create offer
- `GET /api/offers/received` - Get received offers
- `GET /api/offers/sent` - Get sent offers
- `POST /api/offers/{id}/accept` - Accept offer
- `POST /api/offers/{id}/reject` - Reject offer

### Payments
- `POST /api/payments/checkout/{offer_id}` - Create Stripe checkout
- `GET /api/payments/status/{session_id}` - Check payment status

### Contracts
- `GET /api/contracts/{id}` - Get contract details
- `POST /api/contracts/{id}/sign/seller` - Seller signs
- `POST /api/contracts/{id}/sign/buyer` - Buyer signs
- `GET /api/contracts/{id}/download` - Download original media
- `GET /api/contracts/my/seller` - Get seller's contracts
- `GET /api/contracts/my/buyer` - Get buyer's contracts

### Wallet
- `GET /api/wallet/balance` - Get BL coin balance
- `GET /api/wallet/transactions` - Get transaction history
- `POST /api/wallet/claim-daily` - Claim daily login reward
- `GET /api/wallet/stats` - Get wallet statistics

## Test Credentials
- Email: test@test.com
- Password: Test123456

## Testing Status
- Backend: 24/24 tests passed ✅
- Frontend: All pages load correctly ✅
- Test file: `/app/tests/test_media_sales.py`

## Known Limitations
- PDF contract generation not yet implemented (contracts displayed inline)
- Cloud storage integration needed for media files (currently using data URLs)
- Deep linking to native app not fully integrated yet

## Next Tasks
1. Add cloud storage for media files (S3/GCS)
2. Generate downloadable PDF contracts
3. Implement native app deep linking
4. Add push notifications for offers
5. Implement actual watermark overlay for videos

## App Store URLs (Placeholder)
- iOS: https://apps.apple.com/app/id[YOUR_APP_ID]
- Android: https://play.google.com/store/apps/details?id=com.yourcompany.blendlink
