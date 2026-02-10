# Blendlink Platform - Product Requirements Document

## Latest Update: February 10, 2026 (Session - Stripe Payment Integration)

---

## ✅ STRIPE PAYMENT INTEGRATION (Iteration 136)

### Implementation Summary

#### New Endpoints Created
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/stripe/checkout/session` | POST | Create Stripe checkout session for guest orders |
| `/api/payments/stripe/checkout/status/{session_id}` | GET | Check payment status |
| `/api/payments/stripe/refund` | POST | Process refunds with 8% fee reversal |
| `/api/payments/stripe/webhook` | POST | Handle Stripe webhook events |

#### Features
- **Real Stripe Checkout:** Creates actual Stripe checkout sessions (test mode)
- **Payment Verification:** Polls and verifies payment status
- **Automatic Fee Tracking:** 8% platform fee tracked in metadata
- **Refund Processing:** Full/partial refunds with automatic fee reversal
- **Webhook Handling:** Processes Stripe payment events

#### Integration Flow
1. Guest creates order on public page
2. Selects "Card" payment method
3. System creates Stripe checkout session
4. User redirected to Stripe payment page
5. After payment, redirected to `/payment-success`
6. System verifies payment and updates order status

### Test Results: ✅ 100% Pass Rate
- Backend: 14/14 tests passed
- Test Report: `/app/test_reports/iteration_136.json`

### Files Created/Modified
- `backend/stripe_payments.py` - New Stripe payment router
- `backend/server.py` - Router registration
- `frontend/src/components/member-pages/PageCheckout.jsx` - Stripe session creation
- `frontend/src/pages/PaymentSuccess.jsx` - Payment verification

---

## Previous: URGENT PRODUCTION BUG FIXES (Iteration 135)

### Fixes Applied

#### 1. Public Pages 404 Error - FIXED
- **Problem:** Public pages at `blendlink.net/[slug]` showed "Page Not Found"
- **Root Cause:** Query required `is_published: True` but many pages had `null`
- **Fix:** Updated query to accept pages where `is_published` is not explicitly `False`
- **Added:** Case-insensitive slug lookup with regex

#### 2. Product Image Upload - IMPLEMENTED
- **Added:** Image upload field in "Add Product" form
- **Features:**
  - Click-to-upload area with preview
  - File type validation (JPEG, PNG, GIF, WebP)
  - Size limit (5MB max)
  - Secure upload to `/api/upload/image` endpoint
- **Files:** `MemberPageDashboard.jsx` (AddItemModal), `server.py` (endpoint)

#### 3. POS Manual Payments & Refunds - IMPLEMENTED
- **Manual Cash Input:**
  - Numeric input field for cash received
  - Quick amount buttons ($10, $20, $50, $100, Exact)
  - Change calculation display
- **Manual Card Entry:**
  - Card number, expiry, CVV, cardholder name fields
  - Formatted input masks
- **8% Platform Fee:**
  - Fee displayed on every transaction
  - Shows "Added to monthly billing" for cash
  - Shows "Auto-deducted from payout" for card
- **Refund Functionality:**
  - Full or partial refund options
  - Reason required
  - **Auto-reverses 8% fee on refund**
  - Logs all refunds with timestamps

#### 4. Create Listing Button - RELINKED
- **Changed:** Button now opens `/seller-dashboard` instead of `/marketplace/create`
- **File:** `MarketplaceIntegration.jsx`

### Test Results: ✅ 100% Pass Rate
- Test Report: `/app/test_reports/iteration_135.json`
- Backend: 11/11 tests passed
- Frontend: All UI features verified

---

## Previous: Custom Slug Public Pages & Guest Checkout (Iteration 134)

### Implemented Features

#### 1. Custom Slug Public Pages
- Pages accessible via root URL: `blendlink.net/[slug]` (e.g., `/minimart`)
- Also accessible via `/p/[slug]` for backward compatibility
- Fully public - no login required for customers
- 404 handling with "Page Not Found" screen and home redirect

#### 2. Public Page Customer View
- **Products Display**: Pictures, names, descriptions, ratings, reviews
- **Contact Info**: Phone (click-to-call), Email, Website links
- **Google Maps**: Embedded location maps (no API key required)
- **Referral Code**: Owner's code displayed with Copy and Sign Up buttons
- **Add to Cart**: Add button + Buy Now (lightning bolt) for quick checkout
- **Manage Button**: ONLY visible to owner/authorized users

#### 3. Guest Checkout System
- **3-Step Checkout Flow**:
  1. Review Cart (items, quantities, delivery/pickup selection)
  2. Customer Details (name, phone, email, address - no registration)
  3. Payment Method (Card or Cash on Delivery)
- **Order Types**: Delivery or Pickup with location selection
- **No Registration Required**: Customers checkout as guests

#### 4. Guest Orders Backend
- **New Endpoint**: `POST /api/page-orders/guest` - creates order without auth
- **Order Tracking**: `GET /api/page-orders/track/{order_id}?phone=` - verify with phone
- **8% Platform Fee**: Applied to all orders (accumulated for cash, tracked for card)
- **Status Timeline**: Pending → Confirmed → Preparing → Ready/Out for Delivery → Completed

### New Files Created
- `frontend/src/components/member-pages/PageCheckout.jsx` - Guest checkout component

### Files Modified
- `frontend/src/App.js` - Added `/:slug` route for public pages
- `frontend/src/components/member-pages/PublicPageView.jsx` - 404 handling, checkout integration
- `backend/member_pages_extended.py` - Added `guest_orders_router`

### Test Results: ✅ 100% Pass Rate
- Test Report: `/app/test_reports/iteration_134.json`
- All public page features verified
- Guest checkout flow fully tested

---

## Previous: Page Management Features (Iteration 133)

### Implemented Features

#### 1. Team Members / Authorized Users Management
- Page owners can add/remove team members by email
- Team members can manage the page (POS, inventory, orders) but cannot delete the page or manage team
- New endpoints: `GET/POST/DELETE /api/member-pages/{page_id}/team`
- Authorization check endpoint: `GET /api/member-pages/{page_id}/authorization`

#### 2. Platform Fees (8% Transaction Fee)
- 8% fee applied to ALL POS transactions (including cash sales)
- **Cash payments:** Fee accumulated monthly for billing
- **Card payments:** Fee auto-deducted from payout
- Fee tracking with history: `GET /api/member-pages/{page_id}/fees`
- New collection: `platform_fee_logs` for detailed tracking

#### 3. Multi-Currency Support
- 26 currencies supported (USD, EUR, PHP, GBP, JPY, etc.)
- Currency selector in page settings
- Endpoints: `GET /api/member-pages/currencies/supported`, `PUT /api/member-pages/{page_id}/currency`

#### 4. Enhanced Public Page View
- Customer-facing view (no management UI)
- Owner's referral code displayed with clickable signup link
- Google Maps embed for locations (no API key required)
- Contact info display (phone, email, website)
- Star ratings and reviews section
- "Manage" button only visible to owner/authorized users

#### 5. Contact Information
- Phone, email, website fields added to page model
- Displayed on public page with click-to-call/email functionality

### New Files Created
- `frontend/src/components/member-pages/TeamMembersManager.jsx`
- `frontend/src/components/member-pages/PlatformFeesManager.jsx`
- `frontend/src/components/member-pages/CurrencySelector.jsx`

### Files Modified
- `backend/member_pages_system.py` - MemberPage model, team endpoints, fees endpoints, currency endpoints
- `backend/member_pages_extended.py` - POS transaction with 8% fee
- `frontend/src/components/member-pages/PublicPageView.jsx` - Enhanced customer view
- `frontend/src/components/member-pages/MemberPageDashboard.jsx` - Team & Fees tabs
- `frontend/src/services/memberPagesApi.js` - New API methods

### Test Results: ✅ 100% Pass Rate
- Test Report: `/app/test_reports/iteration_133.json`
- All 15 backend tests passed
- All frontend features verified

---

## Previous: Production 401 Fix (Iteration 132)

### Problem
Page creation at blendlink.net/pages failed with "Request failed (401)" error. The feature worked correctly in the preview environment but broke in production.

### Root Cause
**localStorage Token Key Mismatch:**
- The authentication system stores tokens under `localStorage.getItem('blendlink_token')` (defined in `api.js`)
- The `memberPagesApi.js` and several member-pages components were incorrectly using `localStorage.getItem('token')`
- This mismatch caused the `Authorization` header to be empty/undefined, resulting in 401 Unauthorized errors

### Files Fixed (7 total)
| File | Line(s) | Fix |
|------|---------|-----|
| `frontend/src/services/memberPagesApi.js` | 21 | Changed `'token'` → `'blendlink_token'` |
| `frontend/src/components/member-pages/OrdersManager.jsx` | 231, 268 | Changed `'token'` → `'blendlink_token'` |
| `frontend/src/components/member-pages/MarketplaceIntegration.jsx` | 186 | Changed `'token'` → `'blendlink_token'` |
| `frontend/src/components/member-pages/CustomerOptionsManager.jsx` | 89, 121, 154 | Changed `'token'` → `'blendlink_token'` (3 places) |
| `frontend/src/components/member-pages/MemberPageDashboard.jsx` | 616 | Changed `'token'` → `'blendlink_token'` |

### Verification Results
- **Backend API Test:** ✅ Page creation successful via curl
- **E2E Test:** ✅ Full flow (register → login → create page) works
- **Test Report:** `/app/test_reports/iteration_132.json`

---

## Previous Update: February 9, 2026 (Session 2 - PVP Game Server-Authoritative RPS)

---

## ✅ CRITICAL FIX: Server-Authoritative RPS (Iteration 131)

### Problems Fixed
1. **No winner declared** for Round 1 RPS - round outcome was not processed
2. **Reveal desync** - players saw different opponent choices during reveal
3. **Game stuck in Round 1** - never advanced to Round 2
4. **No automatic progression** - rounds didn't advance after winner declared

### Solution: Server-Authoritative RPS Handling
Players now submit their RPS choices to the server, and the server:
1. Collects both players' choices (with 10-second timeout)
2. Determines the winner server-side
3. Broadcasts **BOTH** players' choices to **BOTH** clients (FIXES DESYNC)
4. Automatically advances to the next round

### New Backend Methods
```python
# backend/pvp_game_websocket.py
async def submit_rps_choice(room_id, user_id, choice, bid)  # Handles player submissions
async def _rps_choice_timeout(room_id)  # Auto-selects random choice + $1M bid on timeout
async def _process_rps_result(room_id)  # Determines winner, broadcasts result
```

### New WebSocket Messages
| Message | Direction | Purpose |
|---------|-----------|---------|
| `rps_choice` | Client → Server | Submit player's RPS choice and bid |
| `rps_choosing_start` | Server → Client | Signal start of 10-second choice phase |
| `rps_choice_submitted` | Server → Client | Notify when a player has submitted |
| `rps_result` | Server → Client | **AUTHORITATIVE** - Contains BOTH players' choices |

### Files Modified
- `backend/pvp_game_websocket.py` - Added RPS state fields and handler methods
- `backend/server.py` - Added `rps_choice` WebSocket message handler
- `frontend/src/components/game/RPSBidding.jsx` - Added PVP mode with wsRef, serverRPSResult
- `frontend/src/components/game/PVPBattleArena.jsx` - Added RPS message handlers

---

## ✅ CRITICAL FIX: Round Sequence (Iteration 130)

### Problem
The round sequence was **BACKWARDS**. Code had: `['auction', 'rps', 'auction', 'rps', 'auction']`

### Correct Sequence (NOW FIXED)
| Round | Type | Notes |
|-------|------|-------|
| 1 | **RPS** | Rock-Paper-Scissors Bidding |
| 2 | **Auction** | Photo Auction (Tapping) |
| 3 | **RPS** | Can be final if score reaches 3-0 |
| 4 | **Auction** | Only played if score is 2-1 |
| 5 | **RPS** | Tie-breaker only if score is 2-2 |

### Files Fixed
- `backend/pvp_game_websocket.py` - Line 670: `round_types = ['rps', 'auction', 'rps', 'auction', 'rps']`
- `frontend/src/components/game/PVPBattleArena.jsx` - Line 38: `ROUND_TYPES = ['rps', 'auction', 'rps', 'auction', 'rps']`
- `mobile/src/hooks/usePVPWebSocket.js` - Line 37: `roundType: 'rps'`

---

## ✅ Photo-Battle PVP Game Fix & Update (Iteration 129)

### Issue Investigated: "Failed to join game" Error
- Added enhanced error logging to WebSocket join handler (server.py lines 3084-3124)
- Added debug logging to `connect_player` function (pvp_game_websocket.py)
- Room auto-creation logic verified working for late joiners
- **Error not reproducible during testing** - logging will help diagnose future occurrences

### Backend Config Updates
| Config | Before | After |
|--------|--------|-------|
| `advantage_bonus` | $1M | **$2M** |
| `max_bid` | $6M | **$7M** |
| `starting_bankroll_with_advantage` | N/A | **$7M** |
| `choice_timeout_seconds` | 5 | **10** |

### Files Modified (Backend)
- `backend/photo_game.py` - Updated ADVANTAGE_BONUS, MAX_BID, added STARTING_BANKROLL_WITH_ADVANTAGE
- `backend/game_routes.py` - Updated /config endpoint response
- `backend/server.py` - Added error logging to WebSocket join handler
- `backend/pvp_game_websocket.py` - Added debug logging to connect_player

---

## ✅ Photo-Battle PVP Game Frontend Updates

### 1. RPS (Rock-Paper-Scissors) Round Updates
| Feature | Before | After |
|---------|--------|-------|
| Starting Money (with advantage) | $5M | **$7M** |
| Advantage Bonus | $1M | **$2M** |
| Fast-bid buttons | $1M-$5M | **$1M-$7M** (with advantage) |
| Choice timeout | 5 seconds | **10 seconds** |
| Timeout behavior | Auto-loss | **Random choice + $1M bid** |

### 2. Countdown Display (Both RPS & Tapping)
- **Transparent background** (photos visible behind)
- **"🎯 GET READY! 🎯"** pulsing text animation
- Large countdown number with glow effect
- Pulsing ring animations around countdown

### 3. Stamina Display
- Format: **"Battles left: X/24"** (was "X/24")
- Icon changed: ⚔️ (was ⚡)
- Zero stamina warning: "⚠️ No battles left! Regenerates 1/hour"
- Photos grayed out when stamina ≤ 0

#### 4. Streak Indicators
| Condition | Icon | Display |
|-----------|------|---------|
| Win streak 3-10 | 🔥 | Streak number + multiplier tooltip |
| Lose streak ≥3 | 🛡 | "Immunity Active" |

### Files Modified

**Frontend (Web):**
- `frontend/src/components/game/RPSBidding.jsx` - Updated constants, timeout behavior, countdown UI
- `frontend/src/components/game/TappingArena.jsx` - Transparent GET READY countdown
- `frontend/src/components/game/BattleArena.jsx` - Stamina display format

**Mobile (React Native):**
- `mobile/src/components/MobileTappingArena.js` - Transparent countdown
- `mobile/src/components/UnifiedPhotoCard.js` - Stamina format + warning
- `mobile/src/components/StreakIndicator.js` - 🛡 immunity icon + tooltip

### Preserved Systems (Unchanged)
- ✅ Dollar Value (Core Power) AI scoring across 11 categories
- ✅ Background Scenery strength/weakness matrix
- ✅ Win/lose streak multipliers & immunity mechanics
- ✅ Full XP progression system
- ✅ Stamina deduction values (Win: -1, Lose: -2)
- ✅ Hourly stamina regeneration
- ✅ Monthly +$1M age-based growth
- ✅ Social reactions bonus
- ✅ BL coins permanent upgrades

---

## ✅ CRITICAL FIX COMPLETE: Production Page Creation Error

### Issue (RESOLVED - Iteration 126 Verified)
Page creation failed on production (blendlink.net) with errors:
- "Failed to execute 'clone' on 'Response': body is already used"
- "Failed to execute 'json' on 'Response': body stream already read"
- "Server returned invalid response"

### Root Cause
1. Multiple frontend API functions were reading the response body multiple times
2. Production proxies/CDN (Cloudflare, nginx) may consume response body before JavaScript can read it
3. The `response.bodyUsed` flag was not being checked before reading

### Comprehensive Solution

#### 1. Enhanced safeFetch Helper
Created a production-hardened `safeFetch` helper that:
- Checks `response.bodyUsed` before attempting to read body
- Handles body stream errors gracefully with warnings instead of throwing
- Uses text-first pattern: `response.text()` → `JSON.parse()`

```javascript
// All components now use this production-safe helper
import { safeFetch } from '../services/memberPagesApi';
const data = await safeFetch(`${API_URL}/api/member-pages/my-pages`);
```

#### 2. Files Updated (14 total)
**Services:**
- `frontend/src/services/memberPagesApi.js` - Enhanced safeFetch with bodyUsed check
- `frontend/src/services/api.js` - Fixed FormData POST handler
- `frontend/src/services/referralApi.js` - Converted to text-first pattern
- `frontend/src/services/mediaSalesApi.js` - Converted to text-first pattern

**Components:**
- `frontend/src/pages/Pages.jsx` - Uses memberPagesApi
- `frontend/src/components/member-pages/MemberPagesSystem.jsx` - Re-exports safeFetch
- `frontend/src/components/member-pages/MemberPageDashboard.jsx` - Uses safeFetch
- `frontend/src/components/member-pages/PublicPageView.jsx` - Uses memberPagesApi
- `frontend/src/components/member-pages/MarketplaceIntegration.jsx` - Uses safeFetch
- `frontend/src/components/member-pages/POSTerminal.jsx` - Uses safeFetch
- `frontend/src/components/member-pages/OrdersManager.jsx` - Uses text-first pattern
- `frontend/src/components/member-pages/DailySalesReport.jsx` - Uses safeFetch
- `frontend/src/components/member-pages/AnalyticsDashboard.jsx` - Uses safeFetch
- `frontend/src/components/member-pages/InventoryManager.jsx` - Uses safeFetch

### Verification Results (Iteration 126 - ALL PASSED ✅)
| Feature | Status | Console Errors | Body Stream Errors |
|---------|--------|----------------|-------------------|
| Page Creation | ✅ PASSED | 0 | 0 |
| Page Dashboard | ✅ PASSED | 0 | 0 |
| Marketplace Tab | ✅ PASSED | 0 | 0 |
| Follow/Unfollow | ✅ PASSED | 0 | 0 |

---

## Features Summary

### Real-Time Sync ✅
- MongoDB Change Streams (8 collections)
- WebSocket connections (<100ms latency)

### Core Features ✅
- Page CRUD operations
- Multiple page types (Store, Restaurant, Services, Rental)
- Inventory, Barcode, AI Scan
- POS with Quick Sale Mode
- Stripe payments

### Advanced Features ✅
- Orders Manager
- Daily Sales Reports with email delivery
- Marketplace Integration (Enhanced UI - Iteration 128)
- Google Maps locations
- Customer order options

---

## ✅ Marketplace Integration UI (Iteration 128)

### New Features
- **Gradient Header** with stats dashboard (linked listings, views, sales, revenue)
- **Enhanced Listing Cards** with images, price badges, status badges, stats
- **Category Filtering** dropdown for filtering listings
- **Sort Options** - Recent, Highest Price, Best Selling
- **Grid/List View Toggle** for different viewing preferences
- **Search** with real-time filtering
- **Improved Empty States** with helpful messages and CTAs
- **Pro Tips** section suggesting to add more listings

### UI Components
- `ListingCard` - Reusable card component with hover effects, badges, and action buttons
- `StatsCard` - Compact stat display with gradient icons
- Enhanced modal with filters and view options

---

## ✅ Slug Validation System (Iteration 127)

### Validation Rules
| Rule | Description |
|------|-------------|
| Length | 3-50 characters |
| Start | Must start with a letter |
| End | Cannot end with a hyphen |
| Characters | Only lowercase letters, numbers, hyphens |
| Hyphens | No consecutive hyphens (--) |
| Reserved | 45+ reserved names blocked |

### Reserved Slugs (Examples)
`admin`, `api`, `login`, `register`, `dashboard`, `marketplace`, `pages`, `profile`, `settings`, `wallet`, `blendlink`, `official`, `verified`

### API Response
```json
{
  "slug": "my-store",
  "is_available": true,
  "is_valid": true,
  "error": null,
  "suggestions": [],
  "validation_rules": { "min_length": 3, "max_length": 50, ... }
}
```

### Frontend Behavior
- Real-time validation with 500ms debounce
- Auto-sanitizes consecutive hyphens during input
- Shows green checkmark for valid slugs
- Shows red error with specific message for invalid slugs
- Provides clickable alternative suggestions
- Create Page button disabled until slug is valid

---

## Production Checklist

### Pre-Deployment ✅
- [x] All response.clone() calls removed
- [x] Text-first parsing pattern implemented in ALL API functions
- [x] Backend returns clean JSON only
- [x] No debug prints in API responses
- [x] Testing agent verified all flows
- [x] Slug validation system implemented

### Post-Deployment Verification
- [ ] Test page creation on live blendlink.net
- [ ] Check browser console for errors
- [ ] Verify WebSocket connection
- [ ] Test real-time sync web↔mobile
- [ ] Test slug validation with reserved names

---

## Test Credentials
- User: `test@blendlink.com` / `admin`
- Test Page: `mpage_11ec295ccd36`

---

## Changelog

### February 9, 2026 (Session 2 - Latest)
- **Slug Validation System**: Implemented comprehensive slug validation with 45+ reserved names, format rules, and real-time frontend validation
- **Production Bug Fix**: Fixed "body is already used" error by implementing safeFetch with bodyUsed check
- **Centralized API**: Created memberPagesApi.js with safeFetch helper for production-safe API calls
- Updated 14+ files with text-first pattern

### February 9, 2026 (Session 1)
- Initial text-first pattern fix applied to services/api.js
- Admin components fixed
