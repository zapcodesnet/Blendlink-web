# Blendlink Platform - PRD

## Latest Update: January 18, 2026 (Session 10)

---

## SESSION 10 SUMMARY - Subscription Tiers, Ranked Matchmaking & WebSocket Notifications ✅

### COMPLETED THIS SESSION

#### 1. Fixed Photo Game, Minting & Marketplace Visibility ✅
- Updated `/app/frontend/src/pages/Games.jsx` with prominent CTAs
- Photo Battle Arena now featured at top with purple gradient and "NEW" badge
- Minted Photos and Marketplace have dedicated card buttons
- Real-time stats (wins, streak, players searching) displayed

#### 2. Subscription Tiers System ✅
**New File: `/app/backend/subscription_tiers.py`**

| Tier | Price | Daily Bonus | Mint Limit | Marketplace Fee | Stamina Regen | Tournament |
|------|-------|-------------|------------|-----------------|---------------|------------|
| Free | $0 | 0 BL | 3/day | 8% | 1x | ❌ |
| Basic | $4.99/mo | 100 BL | 20/day | 7% | 1.25x | ❌ |
| Premium | $9.99/mo | 300 BL | 50/day | 6% | 1.5x | ✅ |

**Features:**
- Stripe integration for payments
- Daily bonus claiming with streak multipliers (up to 70% bonus at 7+ days)
- Automatic subscription lifecycle management

#### 3. Ranked Matchmaking System ✅

| Tier | Rating Range | Icon | Season Rewards |
|------|--------------|------|----------------|
| Bronze | 0-999 | 🥉 | 100 BL |
| Silver | 1000-1499 | 🥈 | 300 BL |
| Gold | 1500-1999 | 🥇 | 500 BL |
| Platinum | 2000-2499 | 💎 | 1000 BL |
| Diamond | 2500-2999 | 💠 | 2000 BL |
| Master | 3000+ | 👑 | 5000 BL |

**Features:**
- ELO-based rating system (K-factor: 32)
- Win/loss streak tracking
- Season stats and lifetime stats
- Ranked leaderboard

#### 4. Tournament System ✅
- Premium users can create tournaments
- Single/double elimination and Swiss formats
- Entry fees and prize pools
- Registration and scheduling

#### 5. WebSocket Notifications ✅
**File: `/app/backend/websocket_notifications.py`**
- Real-time connection manager
- Game events: match found, turn updates, battle results
- Marketplace events: new offers, offer responses, sales
- Subscription events: daily bonus, level up, achievements

#### 6. Frontend Updates ✅
- New `/app/frontend/src/pages/SubscriptionTiers.jsx` page
- Subscription tiers comparison UI
- Ranked profile display with tier icon
- Leaderboard integration
- Daily bonus claiming button

---

## TESTING RESULTS ✅

**Iteration 31 Backend Tests:** 20/20 passed
- Subscription Tiers API ✅
- Ranked Leaderboard API ✅
- WebSocket Status API ✅
- Photo Game APIs ✅
- Minting APIs ✅
- Marketplace APIs ✅
- Tournament APIs ✅

**Frontend Tests:** 12/12 passed
- Games page CTAs visible ✅
- Photo Game Arena loads ✅
- Subscription page displays all tiers ✅
- Ranked tiers displayed ✅

**Bugs Fixed:**
- Auth import error in subscription_tiers.py
- MongoDB ObjectId serialization in subscription/ranked profile creation

---

## ARCHITECTURE

```
/app/
├── backend/
│   ├── server.py                  # Main FastAPI app
│   ├── subscription_tiers.py      # NEW: Subscription & Ranked system
│   ├── websocket_notifications.py # Real-time notifications
│   ├── minting_system.py          # Internal minting service
│   ├── minting_routes.py          # Minting API endpoints
│   ├── photo_game.py              # Game logic & battles
│   ├── game_routes.py             # Game API + PvP endpoints
│   ├── pvp_matchmaking.py         # PvP matchmaking queue
│   ├── marketplace_system.py      # Marketplace service
│   ├── marketplace_routes.py      # Marketplace API
│   ├── bl_rewards.py              # BL coin rewards system
│   ├── reactions_system.py        # Golden/Silver reactions
│   ├── referral_system.py         # Commission & transactions
│   └── .env                       # Environment variables
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Games.jsx              # UPDATED: Photo Game CTAs
│   │   │   ├── SubscriptionTiers.jsx  # NEW: Subscription page
│   │   │   ├── PhotoGameArena.jsx     # Battle arena UI
│   │   │   └── MintedPhotos.jsx       # Minted photos page
│   │   └── components/
│   │       └── MintAnimation.jsx      # Mint animation effects
│   └── .env                       # Frontend env
└── mobile/
    ├── App.js                     # Root with ThemeProvider
    └── src/
        ├── context/
        │   ├── AuthContext.js
        │   └── ThemeContext.js        # Light/Dark theme
        ├── navigation/
        │   └── index.js               # All screens
        ├── screens/
        │   ├── PhotoGameArenaScreen.js    # Mobile battle UI
        │   ├── MintedPhotosScreen.js      # Photo collection
        │   ├── PhotoMarketplaceScreen.js  # Photo trading
        │   ├── GamesScreen.js             # Arena CTA
        │   └── MarketplaceScreen.js       # Photo marketplace link
        └── services/
            └── api.js                 # All API modules
```

---

## API ENDPOINTS

### Subscription APIs
- `GET /api/subscriptions/tiers` - Get all subscription and ranked tiers
- `GET /api/subscriptions/my-subscription` - Get user's subscription
- `POST /api/subscriptions/checkout` - Create Stripe checkout session
- `POST /api/subscriptions/claim-daily-bonus` - Claim daily BL bonus
- `POST /api/subscriptions/cancel` - Cancel subscription
- `GET /api/subscriptions/ranked/profile` - Get user's ranked profile
- `GET /api/subscriptions/ranked/leaderboard` - Get ranked leaderboard
- `GET /api/subscriptions/tournaments` - List tournaments
- `POST /api/subscriptions/tournaments` - Create tournament (Premium only)
- `POST /api/subscriptions/tournaments/{id}/join` - Join tournament

### WebSocket
- `WS /ws/{token}` - Real-time notifications endpoint
- `GET /api/ws/status` - WebSocket connection stats

---

## KEY CONSTANTS

**BL Rewards:**
| Content Type | Reward | Privacy Lock |
|--------------|--------|--------------|
| Video | 50 BL | 24h |
| Story | 50 BL | 24h |
| Music | 30 BL | 24h |
| Photo | 20 BL | 24h |
| Event | 20 BL | 24h |
| Group | 40 BL | 24h |
| Page | 40 BL | 24h |
| Subscribe | 10 BL each | - |
| Share | 10 BL | - |

**Marketplace:**
- Platform fee: 8%
- Min price: $1.00
- Max auction: 7 days

**Photo Game:**
- Max stamina: 100
- Battles per full: 24
- Stamina/battle: ~4
- Regen time: 24h full
- Win streak max: 2x

---

## DEPLOYMENT STATUS

✅ **READY FOR EMERGENT DEPLOYMENT**
- All blockchain code removed
- No hardcoded secrets
- All tests passing (39/39)
- PvP matchmaking operational
- Mobile app screens created and API-integrated

---

## NEXT STEPS

### Upcoming Tasks (P1)
- 🟡 **WebSocket Notifications** - Real-time game events (match found, turn updates)
- 🟡 **Expo Push Notifications** - Background alerts for matches/offers
- 🟡 **Subscription Tiers** - $4.99/$9.99 monthly via Stripe

### Pending Implementation (P2)
- 🔵 **24-hour public lock** on BL-rewarded content (code in bl_rewards.py needs hook in create endpoints)
- 🔵 **Immediate fee distribution** on marketplace sales (code in marketplace_system.py needs hook on purchase)
- 🔵 **AI Photo Analysis** - GPT-4o Vision integration for stat generation

### Future/Backlog
- (P2) Live selfie matching for bonus verification
- (P2) Ranked matchmaking tiers
- (P2) Tournament mode
- (P2) Legacy mobile PKO Poker UI/UX fixes

---

## TEST CREDENTIALS

- **Admin:** `blendlinknet@gmail.com` / `Blend!Admin2026Link`
- **Test User:** `test@example.com` / `Test123!`
