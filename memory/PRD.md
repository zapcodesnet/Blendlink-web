# Blendlink Platform - Product Requirements Document

## Latest Update: February 9, 2026 (Session 2 - PVP Game Server-Authoritative RPS)

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
