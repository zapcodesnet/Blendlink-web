# Blendlink Platform - PRD

## Latest Update: January 18, 2026 (Session 12)

---

## SESSION 12 SUMMARY - Bug Fixes & Battle Photo Selection ✅

### CRITICAL BUGS FIXED

#### 1. Minting Failed ✅ FIXED
- **Issue**: Minting was failing for users
- **Root Cause**: Date comparison in `check_can_mint()` was using `.isoformat()` incorrectly
- **Fix**: Updated `/app/backend/minting_system.py` to use proper string comparison for ISO dates stored in MongoDB
- **Test Result**: Minting now works correctly, 500 BL deducted per mint, daily limit (3 free mints) tracked

#### 2. BL Coin Bet Not Working ✅ FIXED
- **Issue**: Betting wasn't deducting BL coins when joining PvP matchmaking
- **Root Cause**: Bet was only deducted when game started, not when joining queue
- **Fix**: Updated `/app/backend/pvp_matchmaking.py`:
  - `find_match()`: Now deducts bet when joining queue
  - `cancel_matchmaking()`: Refunds bet if user cancels
  - `start_match_game()`: Uses `skip_bet_deduction=True` since bet already taken
- **Test Result**: Bet properly deducted on join, refunded on cancel

#### 3. Battle Not Starting ✅ FIXED
- **Issue**: Battles were not initiating correctly
- **Root Cause**: Photo selection was required but not enforced, ObjectId serialization error
- **Fix**: Updated `/app/backend/photo_game.py`:
  - Added `skip_bet_deduction` parameter to `start_game()`
  - Added photo stamina check (0% stamina = cannot battle)
  - Fixed MongoDB `_id` serialization issue
- **Test Result**: Battles start correctly with proper photo selection

### NEW FEATURE: Battle Photo Selection/Preview Screen ✅

**Requirement**: Before starting a battle, show a preview/selection screen of all qualified minted photos

**Implementation** (Web + Mobile synchronized):

1. **New API Endpoint**: `GET /api/photo-game/battle-photos`
   - Returns user's minted photos sorted by Dollar value (highest to lowest)
   - Each photo includes: thumbnail, name, dollar_value, strength/weakness, stamina_percent, is_available, battles_remaining

2. **Photo Stamina System**:
   - Max stamina: 100% = 24 battles
   - Stamina per battle: ~4.16% (100/24)
   - Stamina recovery: 1 battle per hour (~4.16%/hour)
   - Full recovery: 24 hours
   - Defeat penalty: 25% faster stamina drain
   - Photos with 0% stamina: Grayed out, unavailable for battle

3. **UI Components**:
   - **Web**: `PhotoSelectionScreen` component in `/app/frontend/src/pages/PhotoGameArena.jsx`
   - **Mobile**: `PhotoSelectionView` component in `/app/mobile/src/screens/PhotoGameArenaScreen.js`
   - Shows: Photo thumbnail, Dollar value (power), scenery type, strength/weakness, stamina bar, battles remaining
   - Available photos: Full color, selectable
   - Resting photos: Grayed out with recovery time display

---

## TESTING RESULTS ✅

**Iteration 33 Backend Tests:** 16/16 passed (100%)
- Health & Auth ✅
- Minting Status & Config ✅
- Battle Photos Endpoint (sorted, stamina) ✅
- Photo Game Stats & Config ✅
- PvP Queue Status ✅
- Find Match with Photo ✅
- BL Coin Bet Deduction ✅
- Battle Start ✅
- Leaderboards ✅

**Frontend Tests:** 7/7 passed (100%)
- Games page with Photo Battle Arena CTA ✅
- Battle Arena loads with photo selection UI ✅
- Photo cards show name, dollar value, scenery type ✅
- Stamina display (88% = 21 battles) ✅
- Strength indicator visible ✅

---

## ARCHITECTURE

```
/app/
├── backend/
│   ├── server.py                  # Main FastAPI app
│   ├── minting_system.py          # FIXED: Date comparison for daily limits
│   ├── photo_game.py              # FIXED: skip_bet_deduction, ObjectId removal
│   ├── pvp_matchmaking.py         # FIXED: Bet deduction on join, refund on cancel
│   ├── game_routes.py             # NEW: GET /battle-photos endpoint
│   ├── subscription_tiers.py      # Subscription & Ranked system
│   ├── websocket_notifications.py # Real-time notifications
│   ├── push_notifications.py      # Expo push notifications
│   ├── marketplace_system.py      # Marketplace service
│   └── .env                       # Environment variables
├── frontend/
│   ├── src/pages/
│   │   ├── PhotoGameArena.jsx     # UPDATED: PhotoSelectionScreen component
│   │   ├── Games.jsx              # Photo Game CTAs + stats
│   │   ├── MintedPhotos.jsx       # Minted photos page
│   │   └── SubscriptionTiers.jsx  # Subscription page
│   └── .env
├── mobile/
│   ├── src/screens/
│   │   └── PhotoGameArenaScreen.js # UPDATED: PhotoSelectionView component
│   ├── src/services/
│   │   └── api.js                   # UPDATED: getBattlePhotos() added
│   └── App.js
└── docs/
    └── STRIPE_SETUP.md
```

---

## KEY API ENDPOINTS

### Photo Game & Battles
- `GET /api/photo-game/battle-photos` - **NEW**: Get battle-ready photos sorted by dollar value
- `POST /api/photo-game/pvp/find-match` - **FIXED**: Deducts bet on join
- `POST /api/photo-game/pvp/cancel` - **FIXED**: Refunds bet
- `POST /api/photo-game/pvp/match/{match_id}/start` - **FIXED**: Uses skip_bet_deduction
- `GET /api/photo-game/stats` - Player game stats
- `POST /api/photo-game/session/{session_id}/rps` - RPS round
- `POST /api/photo-game/session/{session_id}/photo-battle` - Photo battle

### Minting
- `POST /api/minting/photos/internal_mint` - **FIXED**: Mint a photo (500 BL)
- `GET /api/minting/status` - **FIXED**: Daily limit tracking
- `GET /api/minting/photos` - User's minted photos

---

## DATA MODELS

### Minted Photo (with Stamina)
```json
{
  "mint_id": "string",
  "name": "string",
  "description": "string",
  "scenery_type": "natural|water|manmade",
  "strength_vs": "string",
  "weakness_vs": "string",
  "dollar_value": 1000000,
  "overall_score": 50,
  "power": 100,
  "level": 1,
  "xp": 0,
  "stamina": 100.0,           // NEW: 100% = 24 battles
  "last_battle_at": "datetime" // NEW: For stamina regeneration
}
```

### Battle Photo Response
```json
{
  "photos": [{
    "mint_id": "string",
    "name": "string",
    "dollar_value": 86800000,
    "stamina": 88.0,
    "stamina_percent": 88.0,
    "battles_remaining": 21,
    "is_available": true,
    "time_until_available": null
  }],
  "count": 1,
  "available_count": 1
}
```

---

## UPCOMING TASKS

### P1 - High Priority
- **Stripe Price ID Integration**: Use `/app/docs/STRIPE_SETUP.md` to create products and connect Price IDs to `/frontend/src/pages/SubscriptionTiers.jsx`

### P2 - Medium Priority
- Ranked matchmaking tiers and tournament modes
- 24-hour "public" lock on content with BL coin rewards
- Immediate 8% marketplace fee deduction
- Tournament bracket visualization
- Season rewards distribution

### P3 - Lower Priority
- Live selfie matching for minting bonus
- Legacy PKO Poker UI improvements

---

## TEST CREDENTIALS

- **Admin**: `blendlinknet@gmail.com` / `Blend!Admin2026Link`
- **Test User**: `test@example.com` / `Test123!`

---

## CHANGELOG

### January 18, 2026 (Session 12)
- ✅ Fixed minting failed bug (date comparison)
- ✅ Fixed BL coin bet not working (deduction timing)
- ✅ Fixed battle not starting (photo validation, ObjectId)
- ✅ Added photo selection/preview screen before battle
- ✅ Implemented photo-level stamina tracking
- ✅ Added stamina regeneration (1 battle/hour)
- ✅ Added defeat stamina penalty (25% faster drain)
- ✅ All 16 backend + 7 frontend tests passing

### January 18, 2026 (Session 11)
- ✅ AI Photo Analysis with GPT-4o Vision
- ✅ Expo Push Notifications
- ✅ Stripe Setup Documentation
- ✅ 27 backend + 6 frontend tests passing
