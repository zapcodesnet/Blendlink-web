# Blendlink Mobile App

React Native/Expo mobile app for Blendlink - sharing the same backend as the PWA.

## Features

- **Social Feed** - Facebook-style posts, reactions (golden/silver thumbs), comments
- **BL Coins** - Virtual currency system with rewards for posting, reacting, commenting
- **AI Media Generation** - Create images (GPT Image 1.5) and videos (Sora 2)
- **Friends** - Add, accept, decline friend requests
- **Groups & Pages** - Create and join communities
- **Events** - Create and RSVP to events
- **Marketplace** - Buy and sell items
- **Games** - Mini-games to earn BL coins
- **Wallet** - Track BL coin balance and transactions

## Tech Stack

- **React Native** with Expo
- **React Navigation** for routing
- **Expo SecureStore** for auth token storage
- **Axios** for API calls
- Same FastAPI + MongoDB backend as PWA

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)

## Setup

1. **Install dependencies:**
   ```bash
   cd /app/mobile
   npm install
   ```

2. **Configure API URL:**
   
   Create `.env` file:
   ```
   EXPO_PUBLIC_API_URL=https://your-backend-url.com
   ```

3. **Start development server:**
   ```bash
   npx expo start
   ```

4. **Test on device:**
   - Scan QR code with Expo Go app (iOS/Android)
   - Or press `w` for web, `a` for Android emulator, `i` for iOS simulator

## Project Structure

```
mobile/
├── App.js                 # App entry point
├── app.json               # Expo configuration
├── assets/                # Icons, splash screens
├── src/
│   ├── context/
│   │   └── AuthContext.js # Authentication state
│   ├── navigation/
│   │   └── index.js       # Navigation configuration
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── SocialFeedScreen.js
│   │   └── ProfileScreen.js
│   ├── services/
│   │   └── api.js         # API client (same endpoints as PWA)
│   └── components/        # Reusable components
```

## Building for Production

### iOS App Store

1. **Configure app.json:**
   - Update `expo.ios.bundleIdentifier`
   - Add Apple Developer Team ID

2. **Build:**
   ```bash
   npx eas build --platform ios
   ```

3. **Submit:**
   ```bash
   npx eas submit --platform ios
   ```

### Google Play Store

1. **Configure app.json:**
   - Update `expo.android.package`
   - Set `expo.android.versionCode`

2. **Build:**
   ```bash
   npx eas build --platform android
   ```

3. **Submit:**
   ```bash
   npx eas submit --platform android
   ```

## API Integration

The mobile app uses the same backend API as the PWA:

| Feature | Endpoint |
|---------|----------|
| Auth | `/api/auth/login`, `/api/auth/register` |
| Feed | `/api/social/feed` |
| Posts | `/api/social/posts` |
| Reactions | `/api/social/posts/{id}/react` |
| Comments | `/api/social/posts/{id}/comments` |
| Stories | `/api/stories/` |
| Friends | `/api/friends/` |
| Wallet | `/api/wallet/balance` |
| AI Media | `/api/ai-media/generate` |

## BL Coin Rewards

Same reward structure as PWA:

| Action | BL Coins |
|--------|----------|
| Post video | +50 |
| Post story | +50 |
| Create group | +40 |
| Create page | +40 |
| Post music | +30 |
| Create event | +20 |
| Post photo | +20 |
| React (golden thumbs up) | +10 each |
| React (silver thumbs down) | +10 (reactor only) |
| First comment | +10 |
| Share post | +10 |

## Customization

### App Icons

Replace files in `assets/`:
- `icon.png` (1024x1024) - App icon
- `adaptive-icon.png` (1024x1024) - Android adaptive icon
- `splash-icon.png` - Splash screen icon
- `favicon.png` (48x48) - Web favicon

### Colors

Primary colors are defined in each screen's StyleSheet:
- Primary: `#2563EB` (blue)
- Background: `#0F172A` (dark)
- Card: `#1E293B`
- Accent: `#F59E0B` (amber for coins)

## Troubleshooting

**"Network error" on login:**
- Check API URL in `.env`
- Ensure backend is running
- Check if device can reach the API

**"SecureStore is not available":**
- Running on web? SecureStore only works on native
- Use AsyncStorage fallback for web testing

**Build fails:**
- Clear cache: `npx expo start -c`
- Reinstall deps: `rm -rf node_modules && npm install`

## License

Proprietary - Blendlink
