# PVP Testing Guide - Two Device Test

## 🔧 Fixes Applied in This Session

### Critical Bug #1: Temporal Dead Zone (TDZ) Error
**File**: `/app/mobile/src/screens/PhotoGameArenaScreen.js`
**Problem**: `routePhotos` variable was used in `useMemo` BEFORE it was declared, causing a JavaScript runtime error.
**Fix**: Moved `routePhotos` and `routeGameId` declarations to the top of the component alongside other route params.

### Critical Bug #2: WebSocket Join Message Race Condition  
**File**: `/app/mobile/src/hooks/usePVPWebSocket.js`
**Problem**: The `join` message was only sent in the `'connected'` event handler, but photos might not be available at that exact moment due to async state updates.
**Fix**: Added a separate `useEffect` that watches for `isConnected && photos.length > 0` and sends the join message when BOTH conditions are met. This eliminates the race condition between connection and photo availability.

### Verification
- ✅ Backend WebSocket tests pass
- ✅ Web app functional (tested via screenshots)
- ✅ Both test users have sufficient photos (12 and 16)
- ⏳ Awaiting user verification on physical devices

---

## Quick Start

### 1. Start the Expo Development Server

```bash
cd /app/mobile
npx expo start --tunnel
```

Wait for the QR code to appear in the terminal. The URL will look like:
`exp://[subdomain].exp.direct:443`

### 2. Open on Two Devices

**Device 1 (Creator)**:
- Scan the QR code with Expo Go app
- Login with: `test@blendlink.com` / `admin`

**Device 2 (Joiner)**:
- Scan the SAME QR code with Expo Go app  
- Login with: `test@example.com` / `test123`

### 3. Test Flow - Step by Step

#### Step 3.1: Device 1 - Create Game
1. Navigate to "Photo Game" section
2. Tap "Create Game" or "PVP Battle"
3. Select 5 photos from your collection
4. Tap "Start Game" to create the open game
5. **WAIT** - You should see "Waiting for opponent..." in the lobby

#### Step 3.2: Device 2 - Join Game
1. Navigate to "Photo Game" section
2. Look for "Open Games" or browse available games
3. Find the game created by Device 1
4. Select 5 photos
5. Tap "Join Game"
6. **VERIFY** - Both devices should now show the lobby with both players

#### Step 3.3: Both Devices - Ready Up
1. **Device 1**: Tap "Ready" button
2. **Device 2**: Tap "Ready" button
3. **VERIFY**: Countdown should start (3, 2, 1...)

#### Step 3.4: Verify Game Starts
1. **VERIFY**: Both devices transition to Round 1
2. **VERIFY**: No "Creator disconnected" error
3. **VERIFY**: No "Reconnecting..." loop
4. Both players can select photos for the round

## Expected WebSocket Events

Watch the console logs on both devices for these events:

### Lobby Phase
```
[Mobile] Creator mode - connecting to lobby: [gameId]
[useLobbyWS] Connected
[useLobbyWS] Player joined: { userId, username }
[useLobbyWS] Player ready: { userId }
[useLobbyWS] GAME START: { pvpRoomId, sessionId, session }
```

### PVP Phase
```
[Mobile] myPhotos updated: 5 photos
[usePVPWS] Sending join message with 5 photos, isCreator: true/false
[usePVPWS] Connected to room: [pvpRoomId]
[usePVPWS] Join result: { success: true }
[PVP WS] round_selecting
```

## Troubleshooting

### "Creator disconnected" Still Appearing?
1. Check console logs for: `[usePVPWS] Sending join message`
2. If not appearing, photos may not be loaded - reload the app
3. Both devices MUST have 5+ photos in their collection

### Stuck on "Reconnecting..."?
1. Check backend logs: `tail -f /var/log/supervisor/backend.err.log`
2. Look for WebSocket connection errors
3. Verify both devices have internet connectivity

### Photos Not Loading?
1. Make sure user has 5+ minted photos
2. Check API response: `GET /api/photos/my-minted`

## Backend Logs to Monitor

```bash
# Watch backend for WebSocket events
tail -f /var/log/supervisor/backend.err.log | grep -E "PVP|Lobby|WebSocket"
```

## Key Fixes Applied

1. **TDZ Bug Fix**: Moved `routePhotos` declaration to top of component to fix Temporal Dead Zone error
2. **Join Message Timing**: Added separate useEffect to send join message when both connected AND photos available
3. **Race Condition Fix**: Join message no longer depends on initial connection state

## API URLs

- Web App: https://wallet-coins.preview.emergentagent.com
- Mobile API: Same as above (via EXPO_PUBLIC_API_URL)
- Lobby WebSocket: `wss://[host]/api/ws/lobby/{gameId}/{token}`
- PVP WebSocket: `wss://[host]/api/ws/pvp-game/{roomId}/{token}`
