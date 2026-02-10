# Local Testing Instructions for PVP

## Option 1: Run Expo Locally (Recommended)

Since the cloud environment has file watcher limitations, the easiest way to test is:

### Step 1: Clone/Download the Mobile Code
Download the `/app/mobile/` folder to your local machine.

### Step 2: Install Dependencies
```bash
cd mobile
npm install
# or
yarn install
```

### Step 3: Configure Environment
The `.env` file should already have:
```
EXPO_PUBLIC_API_URL=https://auth-sync-prod.preview.emergentagent.com
```

### Step 4: Start Expo
```bash
npx expo start --tunnel
```

### Step 5: Scan QR Code on Both Devices
- Open Expo Go app on both phones
- Scan the QR code displayed in terminal
- Both devices will connect to the same backend

---

## Option 2: Test via Web (Both Players on Web)

You can test the PVP flow using two browser windows:

### Browser 1 (Incognito/Private Window):
1. Go to: https://auth-sync-prod.preview.emergentagent.com
2. Login: `test@blendlink.com` / `admin`
3. Navigate to Games → Photo Battle
4. Create a new PVP game, select 5 photos
5. Wait in lobby

### Browser 2 (Regular Window):
1. Go to: https://auth-sync-prod.preview.emergentagent.com
2. Login: `test@example.com` / `test123`
3. Navigate to Games → Photo Battle
4. Find and join the open game
5. Select 5 photos

### Both Browsers:
1. Click "Ready" button
2. Countdown should start
3. Game should transition to Round 1

---

## What to Watch For

### ✅ Success Indicators:
- Both players see each other in lobby
- "Ready" status updates in real-time
- Countdown starts when both ready
- Smooth transition to Round 1
- No "Creator disconnected" error
- No "Reconnecting..." loop

### ❌ Failure Indicators:
- "Creator disconnected" message
- Stuck on "Reconnecting... Attempt X/5"
- One player not seeing the other
- Countdown doesn't start after both ready

---

## Backend Logs (For Debugging)

If issues occur, check:
```bash
# In the cloud environment
tail -f /var/log/supervisor/backend.err.log | grep -E "PVP|Lobby|WebSocket"
```

---

## Test Credentials

| User | Email | Password | Photos |
|------|-------|----------|--------|
| User 1 (Creator) | test@blendlink.com | admin | 12 photos |
| User 2 (Joiner) | test@example.com | test123 | 16 photos |
