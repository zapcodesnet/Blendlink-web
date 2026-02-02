# Blendlink Platform - Product Requirements Document

## Latest Update: February 2, 2026

### Session Fixes Completed (February 2, 2026) - LATEST

#### P0 SCROLLING FIX - ROBUST SOLUTION ✅
- **Passive Touch Listeners**: Added useRef and useEffect with `{ passive: true }` event listeners
- **touch-action: pan-y**: Applied to all containers, cards, and grids
- **pointerEvents: none**: Applied to images to prevent blocking scroll
- **WebkitOverflowScrolling**: Added for smooth iOS scrolling
- **Pages Fixed**: `/minted-photos` Card View and `/photo-game` selection screen
- **Testing Status**: VERIFIED by testing agent - scrolling works when finger is over cards

#### P0 NEW UNIFIED PHOTO CARD LAYOUT ✅
Card front layout order (top to bottom):
1. **Photo Image** (~65% of card height)
2. **Name** (centered, truncated)
3. **Dollar Value & Stars** (value left, stars right)
4. **Scenery Badge & Level** (badge left, Lv X right)
5. **Stamina Bar** (with percentage)
6. **Streaks** (win/loss indicators - 🔥 for wins, 🛡️ for protection)
7. **"Tap to flip →" button** (50% smaller, at very bottom)

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
