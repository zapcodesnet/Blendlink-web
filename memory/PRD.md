# Blendlink Platform - PRD

## Latest Update: January 18, 2026 (Session 7)

### SESSION SUMMARY - Blockchain Removal & Internal Minting System ✅

---

## COMPLETED THIS SESSION

### 1. Phase 1: Blockchain Removal & Deployment Readiness ✅

**Removed Blockchain/NFT Components:**
- ❌ Deleted `nft_routes.py`, `immutable_minting.py`
- ❌ Removed `ethers.js`, `@imtbl/sdk` from package.json
- ❌ Removed NFT-related environment variables from `.env`
- ❌ Removed NFT route imports from `server.py`

**Fixed Deployment Blockers:**
- ✅ Removed hardcoded Stripe publishable key fallback in `stripe_integration.py`
- ✅ Removed `.env` blocking entries from `.gitignore` (lines 96-97)
- ✅ Verified CORS, auth redirects, and database config

**Deployment Status: ✅ PASS - Ready for Emergent Deployment**

### 2. Phase 2: Internal Minting System ✅

**New Files Created:**
- `minting_system.py` - Core minting service with AI photo analysis
- `minting_routes.py` - API endpoints for minting operations

**Features Implemented:**
- Photo minting costs 500 BL coins
- Daily mint limits: Free (3), Basic $4.99 (20), Premium $9.99 (50)
- AI photo analysis using GPT-4o Vision (via Emergent LLM Key)
- Scenery type detection: Natural, Water, Man-made/Mixed
- 10 rating criteria scoring (Originality, Innovation, etc.)
- Dollar value calculation ($1M - $1B based on ratings)
- Face detection bonus (+10%)
- Selfie matching bonus (+1% to +20% hidden)
- Mock transaction hashes for NFT-like feel
- Personal photo albums with privacy settings

**API Endpoints:**
- `GET /api/minting/config` - Get minting configuration
- `GET /api/minting/status` - Check if user can mint
- `POST /api/minting/photo` - Mint a photo (base64)
- `POST /api/minting/photo/upload` - Mint a photo (file upload)
- `GET /api/minting/photos` - Get user's minted photos
- `GET /api/minting/photo/{mint_id}` - Get specific photo
- `PUT /api/minting/photo/{mint_id}/rename` - Rename photo
- `PUT /api/minting/photo/{mint_id}/privacy` - Update privacy
- `POST /api/minting/albums` - Create album
- `GET /api/minting/albums` - Get user's albums
- `GET /api/minting/feed` - Public minted photos feed

### 3. Phase 4: Photo Game System ✅

**New Files Created:**
- `photo_game.py` - Game logic, battles, leaderboards
- `game_routes.py` - API endpoints for game operations

**Features Implemented:**
- **Stamina System:**
  - 100% stamina = 24 battles max
  - ~4 stamina per battle
  - 25% extra stamina loss on defeat
  - Full regeneration in 24 hours

- **Rock-Paper-Scissors Mini-Game:**
  - First to 3 wins advances
  - Bot opponent auto-plays

- **Photo Auction Battles:**
  - Dollar value comparison with modifiers
  - Strength/Weakness multipliers (+25%)
  - Win streak bonuses (1.25x → 2x)

- **Game Flow:**
  1. RPS race to 3 wins
  2. Photo battle (highest value wins)
  3. If split: RPS tiebreaker

- **XP & Level System:**
  - Level 1-60 progression
  - 50% marginal XP increase per level
  - 1 XP per battle

- **Leaderboards:**
  - Most wins (24h, 7d, 30d, 1y)
  - Most liked photos (24h, 7d, 30d, 1y)

**API Endpoints:**
- `GET /api/photo-game/config` - Get game configuration
- `GET /api/photo-game/stats` - Get player stats
- `POST /api/photo-game/start` - Start game session
- `POST /api/photo-game/session/{id}/rps` - Play RPS round
- `POST /api/photo-game/session/{id}/photo-battle` - Execute photo battle
- `GET /api/photo-game/leaderboard/wins` - Wins leaderboard
- `GET /api/photo-game/leaderboard/photos` - Photos leaderboard

### 4. Phase 5: Enhanced Reactions System ✅

**Updated `reactions_system.py` with:**
- **Golden Thumbs Up:** Both reactor AND owner get 10 BL coins
- **Silver Thumbs Down:** Only reactor gets 10 BL coins (owner gets nothing)
- **Permanent Reactions:** Cannot be undone or changed
- **Self-reaction Block:** Users cannot react to own content
- Support for minted_photo content type

**Reaction Flow:**
1. Tap thumbs up → Golden thumbs up (instant)
2. Long-press thumbs up (2s) → Reveal silver thumbs down option
3. Once reacted, reaction is permanent

---

## REMAINING PHASES TO IMPLEMENT

### Phase 3: AI Photo Analysis (Partially Done)
- ✅ Basic scenery detection
- ✅ 10 criteria rating
- ✅ Face detection
- ⏳ Live selfie matching for bonus verification

### Phase 5: BL Coins Economy (Partially Done)
- ✅ Reaction rewards
- ⏳ Content creation rewards (50 BL video, 30 BL music, 20 BL photo, etc.)
- ⏳ Downline activity bonuses (3%/1% regular, 4%/2% diamond)

### Phase 6: Marketplace Expansion
- ⏳ Photo/Video/Music listing for sale
- ⏳ 8% platform fee distribution
- ⏳ Offer system for public content
- ⏳ Subscription tiers integration ($4.99, $9.99)

### Phase 7: Web/Mobile Sync
- ⏳ Implement all features in Expo mobile app
- ⏳ Real-time WebSocket sync for game updates
- ⏳ Mirror UI components

---

## ARCHITECTURE

```
/app/
├── backend/
│   ├── server.py              # Main FastAPI app
│   ├── minting_system.py      # NEW: Internal minting service
│   ├── minting_routes.py      # NEW: Minting API endpoints
│   ├── photo_game.py          # NEW: Game logic & battles
│   ├── game_routes.py         # NEW: Game API endpoints
│   ├── reactions_system.py    # UPDATED: Golden/Silver reactions
│   ├── referral_system.py     # Commission & BL coin transactions
│   ├── stripe_integration.py  # Payment processing
│   └── .env                   # Environment variables
├── frontend/
│   ├── src/
│   │   ├── pages/            # React pages
│   │   └── components/       # React components
│   └── .env                  # Frontend env
├── mobile/
│   └── src/                  # Expo React Native app
└── .gitignore                # FIXED: No longer blocks .env
```

---

## KEY CONSTANTS

**Minting:**
- Cost: 500 BL coins
- Daily limits: Free(3), Basic(20), Premium(50)
- Scenery types: Natural, Water, Man-made

**Game:**
- Max stamina: 100
- Battles per full stamina: 24
- Strength multiplier: 1.25x (+25%)
- Win streak max: 2x power

**Reactions:**
- Golden thumbs up: +10 BL to both parties
- Silver thumbs down: +10 BL to reactor only
- First comment: +10 BL to commenter

**Commissions:**
- Platform fee: 8% on sales
- Regular: 3% L1, 1% L2, 4% platform
- Diamond: 4% L1, 2% L2, 2% platform

---

## TEST CREDENTIALS

- **Admin:** `blendlinknet@gmail.com` / `Blend!Admin2026Link`
- **Test User:** `test@example.com` / `Test123!`

---

## DEPLOYMENT STATUS

✅ **READY FOR EMERGENT DEPLOYMENT**
- No blockchain dependencies
- No hardcoded secrets
- .env files can be committed
- CORS properly configured
- Auth redirects use window.location.origin
