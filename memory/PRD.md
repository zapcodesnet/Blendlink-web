# Blendlink Platform - PRD

## Latest Update: January 16, 2026 (Session 6)

### SESSION SUMMARY - PKO Poker Fixes & Verification ✅

---

## COMPLETED THIS SESSION

### PKO Poker Web & Mobile Fixes ✅

1. **Verified Web Poker is Fully Functional**:
   - Create tournament works
   - Register for tournament works
   - Add AI bots (1, 3, fill table) works
   - Force start tournament works
   - Action buttons (Fold, Check, Call, Raise, All In) are visible and clickable
   - Bet slider and quick bet buttons work
   - Table Chat works
   - Leave & Refund works with proper refund

2. **Fixed Mobile Poker Screen**:
   - Rewrote `/app/mobile/src/screens/PokerTournamentScreen.js`
   - Fixed WebSocket URL (was hardcoded to wrong domain)
   - Added proper turn indicator ("YOUR TURN!")
   - Improved action buttons layout - now always visible when it's player's turn
   - Added loading overlay during actions
   - Added Force Start button for tournament creator
   - Added polling fallback for game state if WebSocket fails
   - Improved responsive layout with dynamic dimensions
   - Added `forceLeave` API method

3. **Verified Seller Dashboard Changes**:
   - AI Create Listing button now links to `https://blendlink.net/ai-listing-creator`
   - Header Create button is properly hidden

### Testing Results
**Test Report**: `/app/test_reports/iteration_28.json`
- **Frontend**: 100% tests passed
- All poker flows verified working
- Seller dashboard changes verified

---

## Previous Sessions

### Session 5 - PKO Poker Mobile & Chat Fixes
- Fixed handleAddBots function
- Added Chat Section to Mobile
- Improved Mobile Layout with ScrollView

### Session 4 - MongoDB Persistence
- Implemented MongoDB persistence for poker tournaments
- Tournaments survive backend restarts

### Session 3 - PKO Bug Fix
- Fixed "Failed to create tournament" error
- Added force-leave option

### Session 2 - Admin Panel
- Fixed Orphan Auto-Assignment (12-tier priority)
- Mobile Admin Panel sync started

### Session 1 - Core Bugs
- Fixed "body stream already read" errors

---

## PKO Poker - Complete Feature List ✅

1. **Tournament Management**
   - Create/Join/Leave tournaments
   - MongoDB persistence (survives restarts)
   - 2000 BL buy-in, 1000 BL bounty
   - Force start tournament (creator only)

2. **AI Bots**
   - Add 1-9 bots to fill seats
   - Bot personalities (tight-aggressive, loose-passive, etc.)
   - Bots make automatic decisions

3. **Gameplay**
   - Pre-flop, Flop, Turn, River, Showdown phases
   - Fold, Check, Call, Raise, All-In actions
   - Blinds (25/50 starting)
   - Hand evaluation

4. **PKO System**
   - Bounties tracked per player
   - 50% immediate payout, 50% added to winner's bounty

5. **Table Chat**
   - Real-time WebSocket messages
   - Visible on both web and mobile
   - Light colored text for visibility

6. **User Experience**
   - "Leave & Refund" for stuck tournaments
   - Force-leave option
   - Success/error toasts
   - Turn indicator on mobile

---

## ARCHITECTURE

### Backend Files
- `/app/backend/poker_tournament.py` - PKO Poker APIs with MongoDB persistence
- `/app/backend/server.py` - Main server with all routers
- `/app/backend/referral_system.py` - 12-tier orphan logic

### Frontend Files
- `/app/frontend/src/pages/PokerTournament.jsx` - Web poker UI
- `/app/frontend/src/pages/SellerDashboard.jsx` - Seller dashboard with AI Create link
- `/app/frontend/src/pages/admin/AdminOrphans.jsx` - Orphan management

### Mobile Files
- `/app/mobile/src/screens/PokerTournamentScreen.js` - Mobile poker UI (rewritten)
- `/app/mobile/src/services/api.js` - Mobile API service

---

## API ENDPOINTS

### Poker Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/poker/tournaments` | List open tournaments |
| GET | `/api/poker/tournaments/{id}` | Get tournament details |
| GET | `/api/poker/my-tournament` | Get player's current tournament |
| POST | `/api/poker/tournaments/create` | Create new tournament |
| POST | `/api/poker/tournaments/register` | Register for tournament |
| POST | `/api/poker/tournaments/{id}/add-bots` | Add AI bots |
| POST | `/api/poker/tournaments/{id}/force-start` | Force start tournament |
| POST | `/api/poker/tournaments/action` | Player action (fold, call, etc.) |
| POST | `/api/poker/tournaments/rebuy` | Rebuy into tournament |
| POST | `/api/poker/tournaments/leave` | Leave tournament |
| POST | `/api/poker/tournaments/force-leave` | Force leave stuck tournament |
| POST | `/api/poker/tournaments/chat` | Send chat message |
| WS | `/api/poker/ws/{tournament_id}` | WebSocket for real-time updates |

---

## CREDENTIALS

| Type | Email | Password |
|------|-------|----------|
| Admin | blendlinknet@gmail.com | Blend!Admin2026Link |
| Test User | test@example.com | Test123! |

---

## REMAINING/FUTURE TASKS

### In Progress Tasks
1. **Sync Admin Panel to Mobile (P1)** - Implement actual UI/logic for:
   - AdminSecurityScreen
   - AdminNotificationsScreen
   - AdminThemesScreen
   - AdminUIEditorScreen
   - AdminPagesScreen
   - AdminAIScreen

### Upcoming Tasks
2. **Real-Time Wallet Notifications (P2)** - Implement WebSocket-based notifications for earnings feeds

### Future Tasks
- AI-generated listings full lifecycle
- Push notification settings in admin panel
- Advanced media features (looping thumbnails, watermarks)
- App Store submission preparation

---

## TECH STACK

- **Frontend**: React, Tailwind CSS, Shadcn UI
- **Backend**: FastAPI, Pydantic, MongoDB (motor)
- **Mobile**: React Native, Expo
- **Real-Time**: WebSockets
- **Authentication**: JWT, Emergent-managed Google Auth
- **AI**: Emergent LLM Key (GPT-4o)

---

## PREVIEW URL

https://wallet-notify.preview.emergentagent.com
