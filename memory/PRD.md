# Blendlink Platform - Product Requirements Document

## Overview
Blendlink is a minted photo game platform where users mint photos with AI-analyzed dollar values, compete in PVP and bot battles, and build portfolios. The app features real-time synchronization across web and mobile.

## Core Features

### Photo Minting System
- **Minting Fee**: 200 BL coins per photo
- AI analysis across 11 weighted categories (max $1B total)
- Face detection + optional selfie match for authenticity bonus
- Scenery classification (Natural, Water, Man-made, Neutral)

### NEW Progression System
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

## UI/UX Fixes Implemented (Feb 2026)

### 1. Referral Link Auto-Populate
- ✅ URL param `?ref=CODE` auto-populates registration form
- ✅ Field is locked (readonly) when populated from URL
- ✅ Green styling with checkmark icon
- ✅ Message: "✓ Referral code applied!"

### 2. Hide Bottom Nav in Game States
- ✅ NavContext created in App.js
- ✅ Bottom nav hidden during: pvp_lobby, pvp_browse, pvp_battle, auction_battle, rps_auction, pvp_create, match_history, live_battles, etc.
- ✅ Nav restored when exiting game views

### 3. Auto-Refresh & Highlight New Minted Photo
- ✅ After minting: auto-refresh photos list
- ✅ Newly minted photo has glowing purple animation
- ✅ Sparkle particles around new photo
- ✅ "✨ NEW" badge in top-right corner
- ✅ Animation clears when user clicks/views the photo

### 4. Casino Access Restriction
- ✅ Casino accessible to admin users only
- ✅ Non-admin users see "🚧 Coming Soon" on Games page
- ✅ /casino page shows restricted message for non-admin

### 5. Scrolling Fixes
- ✅ Landing page: fully scrollable
- ✅ Minted-photos page: fully scrollable
- ✅ Photo-game page: fully scrollable
- ✅ Touch and mouse scroll working

### 6. Photo Data Sync (photo-game ↔ minted-photos)
- Both pages fetch from same API endpoints
- Full-stats endpoint returns all progression data
- Real-time updates via API polling

## Architecture

### Backend (FastAPI + MongoDB)
- `/app/backend/minting_system.py` - Core minting logic
- `/app/backend/minting_routes.py` - API endpoints
- `/app/backend/game_routes.py` - PVP/Bot battle endpoints

### Frontend (React)
- `/app/frontend/src/App.js` - NavContext, AuthContext
- `/app/frontend/src/pages/Register.jsx` - Referral auto-populate
- `/app/frontend/src/pages/MintedPhotos.jsx` - Photo gallery with highlighting
- `/app/frontend/src/pages/PhotoGameArena.jsx` - Game arena with nav hiding
- `/app/frontend/src/pages/Games.jsx` - Casino restriction
- `/app/frontend/src/pages/Casino.jsx` - Admin-only access check

### Mobile (React Native/Expo)
- `/app/mobile/src/components/UnifiedPhotoCard.js` - Photo card

## Test Credentials
- Admin: test@blendlink.com / admin
- User: test@example.com / test123

## Known Issues / Backlog

### P0 - Critical
- PVP tap synchronization (ongoing investigation)

### P1 - High Priority
- Performance optimization on heavy pages

### P2 - Medium Priority
- Profile picture drag/position controls
- Image orientation preservation during minting

## Testing Status
- Latest test report: /app/test_reports/iteration_96.json
- Frontend tests: 100% pass rate (9/9 tests)
- All UI/UX fixes verified working
