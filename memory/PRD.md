# Blendlink Platform - PRD

## Latest Update: January 19, 2026 (Session 13)

---

## SESSION 13 SUMMARY - Million Dollar RPS Auction + Bug Fixes ✅

### GAME SYSTEM OVERHAUL

#### New Game Flow: Dollar Auction Battles
1. **Photo Upload** → AI rates permanent Dollar value ($1M-$1B)
2. **Stage 1: Million Dollar RPS Bidding Auction** (race to 3 wins)
3. **Stage 2: Photo Dollar Auction Clash** (value comparison)
4. **Stage 3: Tiebreaker** (if split, repeat RPS auction)

#### Stage 1: Million Dollar RPS Bidding Auction
- Each player starts with **$10,000,000** bankroll
- Bids: **$1M-$5M** in $1M increments
- Players choose RPS (Rock/Paper/Scissors) + bid amount
- Winner of RPS takes the total pot (both bids)
- If tie RPS, higher bid wins
- Bankrupt ($0 balance) = automatic loss
- First to **3 wins** takes Stage 1

#### Stage 2: Photo Dollar Auction Clash
- Higher total Dollar value wins
- Effective value includes:
  - Base Dollar value from AI rating
  - Scenery strength/weakness (+25%/-25%)
  - Light condition bonus (+15%/-15%)
  - Legacy: Age (0.1%/day), Likes (0.05%/like)
  - Win streak multiplier (1.25x-2x)

### BUG FIXES VERIFIED ✅

1. **Minting Fixed** ✅ - Date comparison corrected, 500 BL deduction working
2. **BL Coin Bet Fixed** ✅ - Deducted on queue join, refunded on cancel
3. **Battle Start Fixed** ✅ - Photo validation, stamina check working

### NEW AI ANALYSIS FEATURES

#### Light Types (NEW)
- **Sunlight/Fire** ☀️ → Strong vs Darkness/Night, Weak vs Rain/Snow/Ice
- **Rain/Snow/Ice** ❄️ → Strong vs Sunlight/Fire, Weak vs Darkness/Night
- **Darkness/Night/Interior** 🌙 → Strong vs Rain/Snow/Ice, Weak vs Sunlight/Fire

#### Weighted Rating Criteria
| Criterion | Weight |
|-----------|--------|
| Originality | 12% |
| Innovation | 12% |
| Uniqueness | 12% |
| Focus/Sharpness | 10% |
| Exposure/Tonal Range | 10% |
| Color Accuracy | 8% |
| Subject Clarity | 8% |
| Composition | 10% |
| Narrative/Emotion | 10% |
| Captivating/Mesmerizing | 8% |

---

## TESTING RESULTS ✅

**Iteration 34 Backend Tests:** 15/15 passed (100%)
- Game Config with RPS Auction settings ✅
- Minting Config with light_types ✅
- Rating criteria weights sum to 100% ✅
- Battle photos sorted by dollar_value ✅
- PvP Find Match with bet deduction ✅
- RPS Auction rounds with bidding ✅
- Invalid bid rejection ✅
- Full game flow (RPS → Photo Battle → Result) ✅
- Leaderboards ✅

**Frontend Tests:** 10/10 passed (100%)
- Dollar Auction Arena title ✅
- Million Dollar RPS + Photo Battles subtitle ✅
- Photo selection with stamina, dollar value, strength ✅
- Battle settings with bet input, queue status ✅
- Find Match button ✅

---

## ARCHITECTURE

```
/app/
├── backend/
│   ├── photo_game.py             # UPDATED: Million Dollar RPS Auction logic
│   ├── minting_system.py         # UPDATED: Light types, weighted ratings
│   ├── pvp_matchmaking.py        # UPDATED: 5s timeout, bet escrow
│   ├── game_routes.py            # UPDATED: /rps-auction endpoint
│   └── minting_routes.py         # UPDATED: Light types in config
├── frontend/
│   ├── src/pages/
│   │   └── PhotoGameArena.jsx    # UPDATED: RPSAuctionBattle component
│   └── ...
└── mobile/
    └── src/services/
        └── api.js                # UPDATED: playRPSAuction method
```

---

## KEY API ENDPOINTS

### Photo Game & Battles
- `GET /api/photo-game/config` - Game config with RPS auction settings
- `GET /api/photo-game/battle-photos` - Photos sorted by dollar value
- `POST /api/photo-game/session/{id}/rps-auction` - **NEW**: RPS auction round (choice + bid)
- `POST /api/photo-game/session/{id}/photo-battle` - Photo value comparison
- `POST /api/photo-game/pvp/find-match` - Start matchmaking (5s timeout)

### Minting
- `GET /api/minting/config` - **UPDATED**: Includes light_types, weighted rating_criteria
- `POST /api/minting/photos/internal_mint` - Mint with AI analysis

---

## DATA MODELS

### Game Session (Updated)
```json
{
  "session_id": "game_xxx",
  "player1_id": "user_xxx",
  "player2_id": "bot",
  "bet_amount": 100,
  "phase": "rps_auction",  // rps_auction, photo_battle, tiebreaker, completed
  "stage_number": 1,       // 1=RPS, 2=Photo Battle, 3=Tiebreaker
  "player1_bankroll": 10000000,  // $10M start
  "player2_bankroll": 10000000,
  "player1_rps_wins": 0,
  "player2_rps_wins": 0,
  "rps_rounds": []
}
```

### RPS Auction Round
```json
{
  "round": 1,
  "player1_choice": "rock",
  "player1_bid": 2000000,
  "player2_choice": "scissors",
  "player2_bid": 1000000,
  "rps_result": "player1",  // player1, player2, tie
  "total_pot": 3000000,
  "winner": "player1",
  "player1_bankroll_after": 12000000,
  "player2_bankroll_after": 9000000
}
```

---

## UPCOMING TASKS

### P1 - High Priority
- **Stripe Price ID Integration** - Connect real Stripe products to subscriptions

### P2 - Medium Priority
- Ranked matchmaking tiers & tournaments
- Tournament bracket visualization
- Season rewards distribution
- 24-hour public lock on rewarded content
- 8% marketplace fee distribution

---

## TEST CREDENTIALS

- **Admin**: `blendlinknet@gmail.com` / `Blend!Admin2026Link`
- **Test User**: `test@example.com` / `Test123!`

---

## CHANGELOG

### January 19, 2026 (Session 13)
- ✅ Implemented Million Dollar RPS Bidding Auction
- ✅ Added light_type to AI photo analysis (sunlight_fire, rain_snow_ice, darkness_night)
- ✅ Weighted rating criteria (totals 100%)
- ✅ Reduced matchmaking timeout to 5 seconds
- ✅ Updated frontend with RPS Auction UI
- ✅ All 15 backend + 10 frontend tests passing

### January 18, 2026 (Session 12)
- ✅ Fixed minting failed bug
- ✅ Fixed BL coin bet not working
- ✅ Fixed battle not starting
- ✅ Added photo selection/preview screen
- ✅ Implemented photo-level stamina tracking
