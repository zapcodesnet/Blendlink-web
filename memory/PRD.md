# Blendlink Platform - Product Requirements Document

## Overview
Blendlink is a minted photo game platform where users mint photos with AI-analyzed dollar values, compete in PVP and bot battles, and build portfolios. The app features real-time synchronization across web and mobile.

## Core Features

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

### Subscription Tiers
- Bronze ($4.99/mo): 40 mints/day, ×2 XP, 15K BL daily
- Silver ($9.99/mo): 100 mints/day, ×3 XP, 35K BL daily
- Gold ($14.99/mo): 300 mints/day, ×4 XP, 80K BL daily
- Platinum ($24.99/mo): Unlimited mints, ×5 XP, 200K BL daily

## Architecture

### Backend (FastAPI + MongoDB)
- `/app/backend/minting_system.py` - Core minting logic, MINT_COST_BL=200
- `/app/backend/minting_routes.py` - API endpoints including `/photo/{mint_id}/full-stats`

### Frontend (React)
- `/app/frontend/src/components/photo/UnifiedPhotoCard.jsx` - Photo card component
- `/app/frontend/src/pages/MintedPhotos.jsx` - Photo gallery with lightbox

### Mobile (React Native/Expo)
- `/app/mobile/src/components/UnifiedPhotoCard.js` - Mobile photo card

## API Endpoints

### Minting
- `GET /api/minting/config` - Returns mint_cost_bl (200)
- `GET /api/minting/photo/{mint_id}/full-stats` - Complete stats with bonuses
- `POST /api/minting/photo/upload` - Mint new photo

## What's Been Implemented (Feb 2026)

### Verified Working:
- ✅ Minting fee changed to 200 BL coins (UI + Backend)
- ✅ XP Meter Bar with percentage and progress tracking
- ✅ New stats section: Stars, Level, Age, Reactions, BL Coins, Seniority
- ✅ Full-stats API endpoint returns all new fields
- ✅ Lightbox fetches full stats on flip to back
- ✅ Golden frame animation for Level 60 Seniority
- ✅ Mobile UnifiedPhotoCard updated

## Known Issues / Backlog

### P0 - Critical
- PVP tap synchronization bug

### P1 - High Priority  
- Performance optimization

### P2 - Medium Priority
- Face Match button enhancement
- Subscription tiers functionality

## Test Credentials
- User 1: test@blendlink.com / admin
- User 2: test@example.com / test123

## Mocked APIs
- Facebook social reaction counters (EmbedSocial integration)
