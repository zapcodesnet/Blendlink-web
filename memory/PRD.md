# Blendlink Platform - Product Requirements Document

## Overview
Blendlink is a minted photo game platform where users mint photos with AI-analyzed dollar values, compete in PVP and bot battles, and build portfolios. The app features real-time synchronization across web and mobile.

## Core User Personas
1. **Casual Players** - Mint photos, view stats, participate in bot battles
2. **Competitive Players** - Engage in PVP battles, climb leaderboards
3. **Collectors** - Focus on building high-value photo portfolios

## Core Platform Features

### Photo Minting System
- **Minting Fee**: 200 BL coins per photo (Updated Feb 2026)
- AI analysis across 11 weighted categories (max $1B total)
- Face detection + optional selfie match for authenticity bonus
- Scenery classification (Natural, Water, Man-made, Neutral)

### Dollar Value (Core Power) System
- Base value from AI scoring (0-100% → $1M-$1B)
- Permanent bonuses from: Level, Stars, Age, Reactions, BL Coins, Seniority
- Temporary multipliers from Win Streaks (×1.25 to ×3.00)
- Lose Streak immunity (3+ losses = scenery immunity)

### NEW Progression System (Implemented Feb 2026)
#### Stats on Back of Photo Card (Below Authenticity):
1. **Stars** - Milestone bonuses at L10, L20, L30, L40, L50 (+$1M + 10% each)
2. **Level** - XP-based progression with bonus percentages
3. **Age** - +$1M every 30 days automatically (endless cycle)
4. **Reactions** - +$1M per 100 reactions (counter resets, total visible)
5. **BL Coins** - Direct conversion to Dollar Value boost
6. **Seniority** - Level 60 = +$1M + 20% + Golden Sparkling Frame

#### XP Meter Bar
- Located BELOW Base Value section on back of card
- Shows: Current XP / XP needed for next level
- Percentage indicator with shimmer animation
- Progress toward next level displayed

### Battle System
- **PVP Mode**: Real-time battles against other players
- **Bot Mode**: AI opponents (Easy, Medium, Hard, Expert)
- **Stamina System**: 24/24 max, -1 per win, -2 per loss, +1/hour regen
- Tapping mechanics with scenery strengths/weaknesses

### Subscription Tiers
- Bronze ($4.99/mo): 40 mints/day, ×2 XP, 15K BL daily
- Silver ($9.99/mo): 100 mints/day, ×3 XP, 35K BL daily
- Gold ($14.99/mo): 300 mints/day, ×4 XP, 80K BL daily
- Platinum ($24.99/mo): Unlimited mints, ×5 XP, 200K BL daily

## Architecture

### Backend (FastAPI + MongoDB)
- `/app/backend/minting_system.py` - Core minting logic, MINT_COST_BL, bonus calculations
- `/app/backend/minting_routes.py` - API endpoints including `/photo/{mint_id}/full-stats`
- `/app/backend/game_routes.py` - PVP and bot battle endpoints

### Frontend (React)
- `/app/frontend/src/components/photo/UnifiedPhotoCard.jsx` - Main photo card component
- `/app/frontend/src/pages/MintedPhotos.jsx` - Photo gallery with mint dialog

### Mobile (React Native/Expo)
- `/app/mobile/src/components/UnifiedPhotoCard.js` - Mobile photo card component

## API Endpoints

### Minting
- `GET /api/minting/config` - Returns mint_cost_bl (200), daily limits
- `GET /api/minting/photo/{mint_id}/full-stats` - Complete stats with all bonuses
- `POST /api/minting/photo/upload` - Mint new photo

### Battle
- `POST /api/games/pvp/start` - Start PVP game
- `GET /api/games/pvp/{session_id}/state` - Poll game state
- `POST /api/games/pvp/tap` - Submit tap action

## What's Been Implemented

### February 2026
- ✅ Changed minting fee from 500 to 200 BL coins
- ✅ Added new stats section to back of photo card (Stars, Level, Age, Reactions, BL Coins, Seniority)
- ✅ Implemented real-time bonus calculations in backend
- ✅ Added XP meter bar with percentage and shimmer animation
- ✅ Implemented Golden Sparkling Frame animation for Level 60 Seniority
- ✅ Updated mobile UnifiedPhotoCard component to match web
- ✅ All backend tests passing (100% success rate)
- ✅ Frontend verification complete

### Previously Completed
- Photo minting with AI analysis
- Scenery classification system
- Win/Lose streak mechanics
- Stamina system
- Face detection and selfie match
- Bot battle system
- Subscription tiers
- API polling system for PVP (WebSocket workaround)

## Known Issues / Backlog

### P0 - Critical
- PVP tap synchronization - User reports opponent meter shows $0

### P1 - High Priority
- Performance optimization (lag on feed/photo game pages)

### P2 - Medium Priority
- Client-side Face Match button enhancement
- Full Subscription Tiers functionality

## Technical Notes

### Real-time Sync
- API polling used instead of WebSockets for reliability
- Photo stats calculated on-the-fly when requested
- Age bonus calculated based on minted_at timestamp

### MongoDB Schema (minted_photos)
- `mint_id`, `name`, `image_url`, `thumbnail_url`
- `base_dollar_value`, `dollar_value`, `total_dollar_value`
- `level`, `xp`, `stars`, `has_golden_frame`
- `scenery_type`, `strength_vs`, `weakness_vs`
- `win_streak`, `lose_streak`, `battles_won`, `battles_lost`
- `total_reactions`, `reaction_milestone_count`
- `face_detection_score`, `selfie_match_score`, `selfie_match_completed`
- `current_stamina`, `max_stamina`
- `minted_at`, `created_at`, `last_battle_at`

### Test Credentials
- User 1: test@blendlink.com / admin
- User 2: test@example.com / test123

## Mocked APIs
- Facebook social reaction counters (EmbedSocial integration)
