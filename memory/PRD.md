# Blendlink Platform - Product Requirements Document

## Original Problem Statement
Build a complete multi-platform referral and compensation system with a comprehensive, production-grade admin panel with secure 2FA authentication, automatic session management, and real-time push notifications.

## Admin Panel Requirements - Status
- ✅ **Secure 2FA Login**: Admin login with Email OTP verification (using Resend) - WORKING
- ✅ **Auto-Logout on Inactivity**: 5-minute timeout for Admin, Co-Admin, Moderator - IMPLEMENTED
- ✅ **Browser Push Notifications**: Service worker + subscription management - IMPLEMENTED
- ✅ **Security Dashboard**: Login history, failed attempts, locked accounts - COMPLETED
- ✅ **Full User Management**: Search, filter, view, suspend, ban - COMPLETED
- ✅ **Withdrawal Management**: Approve/reject KYC and cash withdrawals - COMPLETED

## Current Tech Stack
- **Frontend**: React (Web PWA), React Native (Mobile)
- **Backend**: FastAPI + MongoDB
- **UI**: Tailwind CSS, Shadcn UI
- **Email**: Resend (for OTP)
- **Payments**: Stripe
- **Auth**: JWT + Email OTP (2FA for admins)

## What's Been Implemented (January 11, 2026)

### ✅ P0 - Bug Fixes
1. Fixed "Response body already used" error in AdminLogin.jsx
2. Removed unnecessary response cloning logic
3. Admin 2FA login now works correctly

### ✅ P1 - Auto-Logout Feature
- 5-minute inactivity timeout for all admin roles
- Activity tracking via mouse, keyboard, scroll, touch events
- Toast notification on session expiry
- Automatic redirect to `/admin/login`

### ✅ P1 - Client-Side Push Notifications
1. **Enhanced Service Worker** (`/frontend/public/service-worker.js`):
   - Push notification handling with priority-based vibration patterns
   - Action buttons for KYC review, withdrawal review, security investigate
   - Smart notification routing on click

2. **Push Notification Hook** (`/frontend/src/hooks/usePushNotifications.js`):
   - Permission management
   - Subscription/unsubscription to web push
   - Test notification functionality

3. **Backend Endpoints** (`/backend/admin_notifications.py`):
   - `POST /api/admin/notifications/subscribe-web-push` - Register subscription
   - `POST /api/admin/notifications/unsubscribe-web-push` - Remove subscription
   - `POST /api/admin/notifications/test-push` - Send test notification
   - `GET /api/admin/notifications/web-push-status` - Check subscription status

4. **UI Updates** (`AdminNotificationSettings.jsx`):
   - Browser push notification settings section
   - Enable/disable controls
   - Permission status display
   - Test notification button

## Architecture

```
/app/frontend/
├── public/
│   └── service-worker.js       # Enhanced push notification handling
├── src/
│   ├── hooks/
│   │   └── usePushNotifications.js  # Push subscription hook (NEW)
│   └── pages/admin/
│       ├── AdminLogin.jsx           # 2FA login (FIXED)
│       ├── AdminLayout.jsx          # Auto-logout (UPDATED)
│       └── AdminNotificationSettings.jsx  # Push UI (UPDATED)
/app/backend/
└── admin_notifications.py           # Web push endpoints (UPDATED)
```

## Notification Types Supported
- `new_kyc_request` - KYC verification requests
- `new_withdrawal` - Withdrawal requests
- `security_alert` - Security alerts
- `suspicious_activity` - Suspicious activity detection
- `brute_force_detected` - Brute force attack detection
- `admin_login` - Admin login events
- `system_alert` - System notifications

## Test Credentials
- **Admin**: blendlinknet@gmail.com / link2026blend!

## API Base URL
- Production: https://super-ctrl.preview.emergentagent.com

## Remaining Tasks
- **P2**: WebSocket real-time connection for live updates
- **P3**: AI Image/Video/Music Generation features
