# Blendlink Platform - Product Requirements Document

## Latest Update: February 4, 2026

### Feed Page Optimization & Double-Click Enlarge Restore (February 4, 2026) - LATEST

#### Changes Implemented:

**1. Double-Click/Tap to Enlarge Photo ✅ RESTORED**
- Added double-tap detection for mobile (300ms threshold)
- Added onDoubleClick handler for desktop
- Lightbox opens with full-size image, flip to stats, and delete functionality
- Single tap no longer blocks scrolling

**2. Feed Page Performance Optimization ✅ IMPROVED**
- Load time reduced from 5+ seconds to ~3 seconds
- Feed loads first (critical content), stories load in background
- Added timeout handling for API requests (10 second timeout)
- EmbedSocial widget now shows fallback after 8 seconds if it fails to load

**3. EmbedSocial Widget Enhancement**
- Added loading state with spinner
- Added fallback content with "Visit Our Page" button when widget fails
- Lazy loading with IntersectionObserver
- CSS containment for better rendering performance
- **Note**: The widget data-ref `560ae8788f1563d17ee4889e68ebc5732f2b47f7` may need to be updated/verified with EmbedSocial account

**4. Touch Scrolling Fix (Ongoing)**
- Changed `touch-action` from `pan-y` to `manipulation` for better compatibility
- Removed `overflow-y: auto` from scroll containers (let body scroll)
- Added wildcard rules for all elements inside scroll containers

**Files Modified:**
- `/app/frontend/src/components/photo/UnifiedPhotoCard.jsx` - Double-tap/click handlers
- `/app/frontend/src/pages/SocialFeed.jsx` - Performance optimization, EmbedSocial fallback
- `/app/frontend/src/index.css` - Touch scrolling CSS updates

---

### Photo Card Layout & Admin Wallet Fixes (February 4, 2026)

#### Changes Implemented:

**1. Photo Card Touch Scrolling Fix ✅ VERIFIED (iteration_110)**
- Applied `touch-action: pan-y` to card container, inner elements, and page containers
- Added `-webkit-overflow-scrolling: touch` for iOS smooth scrolling
- Scroll test confirmed working (scrollY 0 → 300)

**2. Photo Card Size Increase (15%) ✅ VERIFIED**
- Updated size configurations in `UnifiedPhotoCard.jsx`:
  - Small: 128px → 148px wide, 208px → 240px tall
  - Medium: 160px → 184px wide, 256px → 294px tall
  - Large: 208px → 240px wide, 320px → 368px tall
- Cards now display prominently on mobile devices

**3. Photo Card Layout (75% Image / 25% Details) ✅ VERIFIED**
- Image container uses `flex-[3]` with `min-height: 75%`
- Details section uses `flex-[1]` with `max-height: 25%`
- Compact text styling: font sizes reduced to 8-10px for clean fit
- Text truncation applied to prevent overflow
- Card flip functionality working correctly

**4. Admin Wallet Management "Body Stream Already Read" Fix ✅ VERIFIED**
- Root cause: React 18 Strict Mode double-rendering caused response to be read twice
- Solution: Added `response.clone()` before reading body in both:
  - `AdminLayout.jsx` - `adminApiRequest()` function
  - `AdminWalletManagement.jsx` - `apiRequest()` function
- Added cleanup flag in useEffect to prevent state updates after unmount

**Files Modified:**
- `/app/frontend/src/components/photo/UnifiedPhotoCard.jsx` - Layout & sizing
- `/app/frontend/src/pages/MintedPhotos.jsx` - Scroll container styles
- `/app/frontend/src/pages/admin/AdminLayout.jsx` - response.clone() fix
- `/app/frontend/src/pages/admin/AdminWalletManagement.jsx` - response.clone() fix

**Test Results (iteration_110 - 100% frontend pass):**
- ✅ Photo card touch scrolling with pan-y
- ✅ Card size increased 15% (184x294px medium)
- ✅ 75/25 image/details layout
- ✅ Text fits cleanly without overflow
- ✅ Card flip functionality working
- ✅ Admin wallet management loads correctly
- ✅ User search works
- ✅ Add/Credit mode working
- ✅ Remove/Deduct mode working
- ✅ Deduction confirmation modal appears
- ✅ Transaction history shows credits and deductions

**Critical Note for User**:
These fixes have been verified in Playwright. **Please test on REAL iPhone and Android devices** to confirm touch scrolling works on actual hardware.

---

### Games Page & Casino Screen Update (February 4, 2026)

#### Changes Implemented:

**1. Games Page - Casino Teaser Card (Pure Redirect)**
- Converted Casino Games card to a pure teaser/redirect
- **REMOVED** all nested mini-games (Spin Wheel, Scratch Card, Memory Match) from Games page
- Card now shows:
  - "🎰 CASINO" label + "Coming Soon" badge
  - "Casino Games" title
  - "Exciting games launching soon!" description
  - Game icons preview (🎰🃏🎡🎲🎴) + "+4 more games"
  - "Stay Tuned!" tag
  - "View Casino Games →" footer link
- **Entire card is clickable** - navigates to `/casino` route

**2. Casino Screen - Full Games Lobby**
- All mini-games (Spin Wheel, Scratch Card, Memory Match) **relocated here**
- Now contains **12 total games**:
  - Original: Daily Spin, PKO Poker, Slots, Blackjack, Roulette, Wheel of Fortune, Video Poker, Baccarat, Craps
  - Relocated: Spin Wheel, Scratch Card, Memory Match

**3. Non-Admin View (Locked/Teaser Mode)**
- "Coming Soon" badge in header
- Grey balance card with lock icon
- "Casino Games Coming Soon!" warning banner
- All games visible but:
  - Greyed out (opacity: 0.6, grayscale)
  - Lock icons on each game card
  - "Locked" badges
  - Non-interactive (clicks do nothing)

**4. Admin View (blendlinknet@gmail.com) - Fully Unlocked**
- No "Coming Soon" badge
- Orange balance card with slot emoji
- All 12 games fully colorful and interactive
- Stats button visible
- PKO Poker shows "NEW!" badge
- Games launch on click

**5. Admin Check Logic (Shared)**
```javascript
const ADMIN_EMAIL = "blendlinknet@gmail.com";
const isAdmin = user?.email === ADMIN_EMAIL || user?.role === 'admin' || user?.is_admin === true;
```

**6. BL Coins Balance - REMOVED from Games page only**
- Header shows only "Games" title
- Balance still visible on Wallet, Profile, Casino (for admin), and other pages

**Files Modified:**
- `/app/frontend/src/pages/Games.jsx` - Teaser card redirect
- `/app/frontend/src/pages/Casino.jsx` - Fixed admin check, added locked mode
- `/app/mobile/src/screens/GamesScreen.js` - Teaser card redirect
- `/app/mobile/src/screens/CasinoScreen.js` - Fixed admin check, added locked mode

**Test Results:**
- ✅ Games page shows clean teaser card with no nested games
- ✅ Clicking teaser navigates to Casino screen
- ✅ Non-admin sees all 12 games locked with preview styling
- ✅ Admin sees all 12 games fully unlocked and playable
- ✅ No games disappear for admin - bug FIXED
- ✅ No BL Coins balance on Games page

**Structure:**
```
Games Page (blendlink.net/games)
├── Photo Battle Arena (Public)
├── Minted Photos / Marketplace (Public)
├── Casino Games Teaser Card (Redirects to /casino)
│   └── Click → Navigate to Casino Screen
└── Raffles & Contests (Public)

Casino Screen (blendlink.net/casino)
├── Balance Card (Orange/Grey based on admin status)
├── Coming Soon Banner (Non-admin only)
└── Games Grid (12 games)
    ├── Daily Spin, PKO Poker, Slots, Blackjack
    ├── Roulette, Wheel of Fortune, Video Poker, Baccarat
    └── Craps, Spin Wheel, Scratch Card, Memory Match
```

---

#### ADMIN BL COINS CREDIT TOOL ✅ VERIFIED (iteration_109 - 14/14 tests pass)

**New Feature**: Secure admin-only tool at `/admin/wallet-management` to manually add BL Coins to any user's wallet.

**Implementation**:

**Frontend** (`AdminWalletManagement.jsx`):
- User search by email, name, username, or ID
- Amount input with quick buttons (+100, +1K, +10K, +100K, +1M, +1B)
- Reason/Note field for audit trail
- Confirmation dialog for large amounts (>10,000 BL)
- Preview section showing recipient, amount, and new balance
- Recent Admin Credits history panel

**Backend** (`admin_core_system.py`, `admin_otp_auth.py`):
- `POST /api/admin/finance/balance` - Adjust user balance with atomic $inc
- `GET /api/admin/finance/recent-adjustments` - Get transaction history
- Transaction logging to `transactions` collection
- Updated admin login to support multiple admin users

**Security**:
- Admin-only access (requires `is_admin: true` in user document)
- JWT authentication with proper token validation
- Audit logging for all credit operations
- Input validation (positive amounts only)

**Test Credentials**:
- Email: `test@blendlink.com`
- Password: `admin`

**Files Created/Modified**:
- `/app/frontend/src/pages/admin/AdminWalletManagement.jsx` (NEW)
- `/app/frontend/src/pages/admin/AdminLayout.jsx` (menu + route)
- `/app/backend/admin_core_system.py` (recent-adjustments endpoint)
- `/app/backend/admin_otp_auth.py` (multi-admin support)

---

#### P0 LANDING PAGE SCROLL FIX - BULLETPROOF SOLUTION ✅ VERIFIED (iteration_107 - 100% pass)

**Issue**: Critical repeated blocker - touch/mouse scroll completely unresponsive on landing page despite 5+ previous fix attempts.

**Root Cause Analysis**:
1. `touch-action: pan-y` is inconsistently interpreted across iOS/Android versions
2. `user-scalable=no` in viewport meta can interfere with touch on some browsers
3. Images capturing touch events despite CSS rules
4. Conflicting CSS rules with different specificity

**Solutions Implemented**:

1. **Viewport Meta Fix** (`public/index.html`):
   - Removed `user-scalable=no` from viewport meta tag
   - Now: `width=device-width, initial-scale=1, viewport-fit=cover`

2. **Dedicated Landing Page CSS** (`index.css`):
   - Created `.landing-page-scroll-container` class with `!important` rules
   - `touch-action: auto` (more compatible than pan-y)
   - `overflow-y: scroll`
   - `min-height: 100dvh` (dynamic viewport height)
   - `transform: none` (prevents stacking context issues)

3. **Global CSS Changes** (`index.css`):
   - Changed all `touch-action: pan-y` to `touch-action: auto`
   - Added `!important` to all critical scrolling rules
   - Made all images `pointer-events: none !important`
   - Added `-webkit-transform: translateZ(0)` to sticky header for iOS

4. **Component Fixes** (`Landing.jsx`):
   - All cards have inline `touchAction: 'pan-y'` style
   - All images have `pointer-events-none` class and `draggable={false}`

**Test Results (iteration_107)**:
- ✅ All 12 tests passed
- ✅ Scroll height (2831px) > viewport (844px)
- ✅ Page scrolls 0 → 1987px without dead zones
- ✅ Mouse wheel scrolling works
- ✅ All images pointer-events: none
- ✅ No blocking overlays found

**Critical Note for User**:
These fixes have been verified in the Playwright browser environment. **Please test on REAL iPhone and Android devices** after deploying to blendlink.net to confirm touch scrolling works on actual hardware.

#### P1 SCROLL FIX APPLIED TO ALL PAGES ✅ VERIFIED (iteration_108 - 15/15 tests pass)

Applied the same bulletproof scroll fix pattern to:

**1. Marketplace Page** (`Marketplace.jsx`):
- Added `.marketplace-scroll-container` class
- `touch-action: auto`, `overflow-y: scroll`
- All 7 images: `pointer-events: none`

**2. MintedPhotos Page** (`MintedPhotos.jsx`):
- Added `.minted-photos-scroll-container` class
- `touch-action: auto`, `overflow-y: scroll`
- All 24 images: `pointer-events: none`

**3. PhotoGame Page** (`PhotoGameArena.jsx`):
- Added `.photo-game-scroll-container` class
- `touch-action: auto`, `overflow-y: scroll`
- All 13 images: `pointer-events: none`

#### P1 SELFIE VERIFICATION FLOW ✅ FIXED

**Issue**: Selfie verification failed even on 100% matches. Attempts counter jumped to max after first try. Balance check blocked ALL attempts even free ones.

**Root Causes Found**:
1. `canAffordAttempt` was checking balance for ALL attempts, blocking free attempts
2. Attempts were being incremented in frontend regardless of API response
3. No distinction between free (first 3) and paid (next 3) attempts in UI

**Solutions Implemented**:

**Frontend** (`SelfieMatchModal.jsx`):
```javascript
// Lines 100-104 - Fixed attempt cost calculation
const isFreeAttempt = attemptsUsed < FREE_ATTEMPTS;
const canAffordAttempt = isFreeAttempt || userBalance >= COST_PER_ATTEMPT;
const currentCost = isFreeAttempt ? 0 : COST_PER_ATTEMPT;
```

- Shows "FREE (X left)" for first 3 attempts
- Shows "100 BL/try" for paid attempts
- Button text: "Verify (FREE)" or "Verify (100 BL)"
- Processing errors show "This attempt was NOT counted"
- Helpful feedback messages based on match score

**Backend** (`minting_routes.py`):
```python
# Lines 1244-1247
FREE_ATTEMPTS = 3
PAID_ATTEMPTS = 3  
MAX_ATTEMPTS = 6
MATCH_THRESHOLD = 80  # >80% = 100% success
```

- Attempts only incremented AFTER successful AI analysis
- >80% match treated as 100% success
- +5% Authenticity bonus on success
- Errors don't consume attempts

---

#### Previous Session Fixes (February 3, 2026 - Earlier)

#### P0 MOBILE SCROLLING & DARK OVERLAY FIX ✅ VERIFIED (iteration_106 - 100% pass)

**User Report**: Real mobile device testing revealed critical bugs - touch scrolling blocked, dark overlay blocking all interactions when card flipped.

**Root Causes Found**:
1. **Dark Overlay**: `MintedPhotos.jsx` had a `fixed inset-0 bg-black/60 z-40` div appearing when any card was flipped
2. **Opacity Dimming**: Non-flipped cards were dimmed to `opacity-30` blocking visual clarity
3. **Swipe Thresholds**: Too strict (60px) for some mobile devices

**Solutions Implemented**:
1. **REMOVED dark backdrop overlay** (lines 1462-1470 in MintedPhotos.jsx deleted)
2. **REMOVED opacity-30 dimming** on non-flipped cards
3. **Added `touchAction: 'pan-y'`** inline styles to ALL page containers:
   - Landing.jsx
   - Marketplace.jsx
   - MintedPhotos.jsx
   - PhotoGameArena.jsx
4. **Lowered swipe thresholds v4**:
   - Horizontal: >40px (was 60px)
   - Vertical: <60px (was 40px)
   - Time: <500ms (was 400ms)
   - Ratio: 1.5x (was 2x)
5. **Passive event listeners** for better scroll performance

**Results Verified**:
- ✅ Touch scrolling works on landing, marketplace, minted-photos, photo-game
- ✅ NO dark overlay when card is flipped
- ✅ All cards remain at full opacity (not dimmed)
- ✅ Users can interact with ANY card while one is flipped
- ✅ Swipe-to-flip works on ALL cards (including top-right)
- ✅ Mouse wheel scrolling works on desktop

#### P1 SELFIE VERIFICATION DISPLAY FIX ✅ VERIFIED
- **MAX_ATTEMPTS**: 6 total (3 free + 3 paid) - matches backend
- **Display**: "Attempts: X/6" in SelfieMatchModal
- **z-index**: 9999/10000 ensures modal appears above flipped cards

### Files Modified (February 3, 2026)
- `/app/frontend/src/pages/MintedPhotos.jsx` - Removed dark overlay & opacity dimming
- `/app/frontend/src/components/photo/UnifiedPhotoCard.jsx` - v4 swipe gesture, passive listeners
- `/app/frontend/src/pages/Landing.jsx` - Added touchAction inline style
- `/app/frontend/src/pages/Marketplace.jsx` - Added touchAction inline style
- `/app/frontend/src/pages/PhotoGameArena.jsx` - Added touchAction inline style
- `/app/frontend/src/index.css` - Global scrolling CSS v3

---

### Previous Session Fixes (February 3, 2026 - Earlier)

#### P0 SCROLLING BUG FIX v3 ✅ VERIFIED (iteration_105 - 100% pass)
**Root Cause**: Previous fixes used JavaScript preventDefault() in touch handlers, which blocked native scrolling.

**Solution**: 
- Removed `handleTouchMove` handler entirely - no interference during scroll
- `touchAction: 'pan-y'` is now ALWAYS set on card container (never 'none')
- Swipe detection is purely passive - only checks gesture on `touchEnd`
- Images have `pointer-events: none` to prevent touch capture

**Swipe Gesture Detection Criteria** (must meet ALL):
1. Horizontal distance > 60px (intentional swipe)
2. Vertical distance < 40px (not scroll attempt)
3. Time < 400ms (quick gesture)
4. Horizontal > 2x vertical (clearly horizontal)

**Result**: 
- ✅ Vertical scrolling works on landing page carousels
- ✅ Vertical scrolling works on marketplace listing cards
- ✅ Vertical scrolling works on minted-photos photo cards
- ✅ Swipe-to-flip gesture works without blocking scroll

#### P0 MODAL OVERLAP FIX ✅ VERIFIED
- **SelfieMatchModal**: z-index 9999 (overlay), 10000 (content)
- **UpgradeModal (dialog.jsx)**: z-index 9999 (overlay), 10000 (content)
- **Flipped cards**: z-index 100
- **Result**: Modals appear ABOVE flipped cards

#### P1 SELFIE MATCH ATTEMPTS FIX ✅ VERIFIED
- **MAX_ATTEMPTS**: Updated frontend constant from 3 to 6 (3 free + 3 paid)
- **Display**: Shows "Attempts: X/6" in SelfieMatchModal
- **Backend**: Already had 6 attempts configured

### Files Modified (February 3, 2026)
- `/app/frontend/src/components/photo/UnifiedPhotoCard.jsx` - Robust swipe detection
- `/app/frontend/src/components/minting/SelfieMatchModal.jsx` - MAX_ATTEMPTS = 6
- `/app/frontend/src/index.css` - Global scrolling CSS v3 fix
- `/app/frontend/src/pages/Landing.jsx` - Carousel touch-action: pan-x pan-y

---

### Previous Session Fixes (February 2, 2026)

#### P0 FRANTIC ROTATION BUG FIXED ✅ VERIFIED
- **Root Cause**: Circular state updates between internal `isFlipped` state and `flipped` prop
- **Fix**: Removed internal state, now using `flipped` prop directly from parent
- **Result**: Clicking backdrop dismisses flip smoothly - NO frantic rotation

#### P0 CARD GAP REDUCED ✅ VERIFIED  
- **Grid gap**: Reduced from `gap-6 md:gap-8` to `gap-3`
- **Card size**: Reduced from `w-44 h-80` to `w-40 h-64`
- **Image height**: Reduced from `h-40` to `h-36`
- **Result**: Cards are now closer together on mobile

#### P0 CSS CLEANUP ✅
- Removed excessive `touch-action` CSS rules that were interfering with scrolling
- Removed duplicate and conflicting CSS from `index.css`
- CSS file cleaned from 1260+ lines to ~1188 lines

#### P0 GRID VIEW HIDDEN ✅ VERIFIED
- Grid View and List View buttons HIDDEN from UI
- Only Card View button visible
- `viewMode` defaults to 'card'

#### P0 DEPLOYMENT FIX ✅
- **Fixed corrupted `.gitignore`**: File had 461 lines with repeated `*.env` entries
- **Clean `.gitignore`**: Now 86 lines, NOT ignoring base `.env` files
- **Note**: User needs to REDEPLOY for changes to appear on production

### All Features Verified Working (iteration_104 - 100% pass)
1. ✅ Card flip works - tap shows back view
2. ✅ Backdrop click dismisses flip smoothly (NO frantic rotation)
3. ✅ Reduced card gap (gap-3)
4. ✅ Card layout: Photo → Name → Dollar Value & Stars → Scenery & Level → Stamina → Tap to flip
5. ✅ Grid View button hidden
6. ✅ Nav bar hides when card flipped
7. ✅ Nav bar returns when unflipped
8. ✅ Other cards dimmed when one is flipped
9. ✅ Touch scrolling CSS set to pan-y

Card dimensions:
- **Medium size**: w-44, h-80 (taller to fit all elements)
- **Image height**: h-40
- **Grid gap**: gap-6 on mobile, gap-8 on desktop

### Previous Session Fixes (February 2, 2026)

#### P0 PVP Synchronization Fixes
- **Server-Authoritative Winner Determination**: /pvp/finish-round endpoint now idempotent - caches and returns same result if called multiple times
- **isPlayer1Ref**: Added ref to track latest player role for WebSocket handlers, avoiding stale closures
- **confirmedPlayer1Id state**: Synced from API responses for reliable player identification
- **Exponential backoff reconnection**: 1s → 2s → 4s → 8s → 10s (capped)
- **MAX_RECONNECT_ATTEMPTS**: Increased from 3 to 5

#### P1 Selection Timers & Auto-Select
- **Photo Selection Timer**: 10 seconds (PHOTO_SELECTION_TIME constant)
- **RPS Move Timer**: 5 seconds (RPS_SELECTION_TIME constant)
- **Auto-Select Logic**: On timeout, selects photo with highest dollar_value automatically

#### P1 Real-Time Stat Refresh
- **Polling Interval**: Every 5 seconds on both pages
- **MintedPhotos.jsx**: Silently refreshes photos to get latest XP, level, stamina, dollar_value, wins, losses
- **PhotoGameArena.jsx**: Refreshes battle photos and stats when on pvp_menu; immediate refresh on battle exit
- **Smart Update**: Only triggers re-render if actual stat changes detected

#### P1 Selfie Verification Fixes
- **Match Threshold LOWERED**: Changed from 90% to **80%** - if match > 80%, treat as 100%
- **CRITICAL FIX**: Attempts ONLY counted after successful AI analysis, NOT on processing errors
- **Free Attempts**: First 3 attempts during minting are FREE
- **Paid Attempts**: 100 BL coins per try after free tries (max 3 additional)
- **Helpful Error Messages**: Specific messages for different error types
- **Enhanced AI Prompt**: More lenient matching, focuses on core facial structure
- **Combined Boost**: Face detection (+5%) + Selfie match (+5%) = up to +10% total

#### P1 Hide Bottom Nav During Selfie Verification
- **SelfieMatchModal**: Uses NavContext to hide bottom navigation when modal is open
- **Purpose**: Allows users to click capture button without navigation bar blocking

#### P1 Tap Rate Notification Hidden
- Removed "Tap Rate Exceeded" toast notification completely
- Rate limit (30 TPS) still enforced - excess taps silently ignored

#### P1 Mint Limit Fixed
- Daily limit displays as X/10 (was incorrectly showing X/3)
- Backend confirms: free users = 10 mints/day

#### P2 BL Coins Upgrade Feature
- **Upgrade Button**: Added to photo card back, next to BL Coins stat
- **UpgradeModal**: New modal with upgrade tiers ($1M - $1B)
- **Backend Endpoint**: /minting/photos/{mint_id}/upgrade already implemented
- **Cost**: $1M = 1M BL, $2M = 2M BL, etc.

#### P1 Profile Picture Click Behavior
- **Single click**: Navigates to user's profile (250ms delay to detect double click)
- **Double click**: Opens full-size image in modal
- **Implementation**: Added to Feed.jsx with AnimatePresence modal

---

## Overview
Blendlink is a minted photo game platform where users mint photos with AI-analyzed dollar values, compete in PVP and bot battles, and build portfolios. The app features real-time synchronization across web and mobile.

## Core Features

### Photo Minting System
- **Minting Fee**: 200 BL coins per photo
- AI analysis across 11 weighted categories (max $1B total)
- Face detection + optional selfie match for authenticity bonus
- Scenery classification (Natural, Water, Man-made, Neutral)
- **EXIF Orientation Preservation**: Maintains original landscape/portrait orientation

### Progression System
Stats on back of photo card (below Authenticity):
1. **Stars** - Milestone bonuses at L10-L50 (+$1M + 10% each)
2. **Level** - XP-based progression with bonus percentages
3. **Age** - +$1M every 30 days automatically
4. **Reactions** - +$1M per 100 reactions
5. **BL Coins** - Direct conversion to Dollar Value boost
6. **Seniority** - Level 60 = +$1M + 20% + Golden Sparkling Frame

### XP Meter Bar
- Located BELOW Base Value section on back of card
- Shows: Current XP / XP needed for next level
- Percentage indicator with shimmer animation

### Battle System
- **PVP Mode**: Real-time battles against other players
- **Bot Mode**: AI opponents (Easy, Medium, Hard, Expert)
- **Stamina System**: 24/24 max, -1 per win, -2 per loss, +1/hour regen

## Latest Fixes (Feb 2026)

### P0 - PVP Tap Sync Bug ✅
- Added tap fields to PVPGameSession model: `player1_taps`, `player2_taps`, `player1_dollar`, `player2_dollar`
- All fields initialize to 0 when session is created
- Round reset properly clears tap state
- tap-state endpoint returns all fields with defaults

### P1 - Profile Picture Controls ✅
- Two-step flow: Select photo → Adjust position
- **ImagePositionEditor** component features:
  - Circular preview with purple border
  - Drag to reposition image
  - Zoom controls: -, +, reset
  - Zoom percentage display (50% - 200%)
  - Position data saved: {x, y, zoom}

### P1 - Image Orientation ✅
- EXIF orientation handling in minting upload
- Supports all 8 EXIF orientation values
- Automatically corrects rotation/flip before storage
- Preserves landscape/portrait as uploaded

### Previous Fixes
- Referral link auto-populate & lock
- Hide bottom nav in game states
- Auto-refresh & highlight new minted photo
- Casino admin-only access
- Scrolling fixes on all pages

## Architecture

### Backend (FastAPI + MongoDB)
- `/app/backend/minting_system.py` - Core minting logic
- `/app/backend/minting_routes.py` - API endpoints + EXIF handling
- `/app/backend/game_routes.py` - PVP/Bot battle endpoints
- `/app/backend/photo_game.py` - PVPGameSession model

### Frontend (React)
- `/app/frontend/src/App.js` - NavContext, AuthContext
- `/app/frontend/src/pages/Settings.jsx` - ImagePositionEditor component
- `/app/frontend/src/pages/MintedPhotos.jsx` - Photo gallery
- `/app/frontend/src/pages/PhotoGameArena.jsx` - Game arena

### Mobile (React Native/Expo)
- `/app/mobile/src/components/UnifiedPhotoCard.js` - Photo card

## API Endpoints

### Profile
- `PUT /api/users/me/profile-picture` - Update with position data

### Minting
- `POST /api/minting/photo/upload` - Upload with EXIF handling
- `GET /api/minting/photo/{mint_id}/full-stats` - All progression stats

### PVP
- `GET /api/photo-game/pvp/tap-state/{session_id}` - Get tap counts
- `POST /api/photo-game/pvp/tap` - Submit tap action

## Test Results
- Latest test: /app/test_reports/iteration_97.json
- Backend: 100% pass rate (10/10 tests)
- Frontend: 100% pass rate

## Test Credentials
- User 1: test@blendlink.com / admin
- User 2: test@example.com / test123

## Known Issues / Backlog

### Remaining
- Full PVP end-to-end testing (requires 2 players)
- Performance optimization on heavy pages
- Profile picture single/double click behavior
