# Blendlink Platform - Product Requirements Document

## Original Problem Statement
Build a complete multi-platform referral and compensation system with a comprehensive, production-grade admin panel. The admin panel must connect to the live production database, handle real users, activities, transactions, and finances with all actions synchronizing in real-time between web PWA and mobile app.

## Admin Panel Requirements
- ✅ **Secure 2FA Login**: Admin login with Email OTP verification (using Resend) - COMPLETED
- ✅ **Security Dashboard**: Login history, failed attempts, locked accounts, location tracking - COMPLETED
- ✅ **Full User Management**: Search, filter, view, suspend, ban, reset passwords - COMPLETED
- ✅ **Real-Time Financial Oversight**: View balances, transaction histories, manual balance adjustments - COMPLETED
- ✅ **Withdrawal Management**: Approve/reject KYC and cash withdrawal requests - COMPLETED
- ✅ **Genealogy Management**: View and edit team hierarchy - COMPLETED
- ✅ **Content Moderation**: Access and moderate user content - COMPLETED
- ✅ **Platform Configuration**: Manage global settings - COMPLETED
- ✅ **RBAC**: Role-based access control - COMPLETED
- 🔄 **Real-time Push Notifications**: Admin alerts (backend done, client-side pending)
- 🔄 **100% Sync**: Mobile admin panel nearing completion

## Current Tech Stack
- **Frontend**: React (Web PWA), React Native (Mobile)
- **Backend**: FastAPI + MongoDB
- **UI**: Tailwind CSS, Shadcn UI
- **Email**: Resend (for OTP)
- **Payments**: Stripe
- **Auth**: JWT + Email OTP (2FA for admins), Emergent Google Auth

## What's Been Implemented (January 11, 2026)

### ✅ Session 1 - Admin OTP Login Fix
- Fixed blank `/admin/login` page (import path bug)
- Admin 2FA flow fully functional via Resend email

### ✅ Session 2 - Mobile Admin Panel + Security Dashboard
1. **Mobile Admin Screens Completed**:
   - `AdminGenealogyScreen.js` - Full genealogy management with tree view, orphan detection, user reassignment
   - `AdminManagementScreen.js` - Admin role management with permissions editor

2. **Admin Security Dashboard (Web)**:
   - `AdminSecurityDashboard.jsx` - New security monitoring page
   - Login history with IP, location, device tracking
   - Failed login attempts monitoring
   - Locked accounts management with unlock capability
   - Security alerts display
   - Time range filters (1h, 24h, 7d, 30d)

3. **Backend Security API**:
   - `admin_security_routes.py` - New security endpoints
   - `/api/admin/security/stats` - Security statistics
   - `/api/admin/security/login-history` - Login history
   - `/api/admin/security/failed-attempts` - Failed attempts log
   - `/api/admin/security/locked-accounts` - Locked accounts list
   - `/api/admin/security/unlock-account` - Manual unlock
   - `/api/admin/security/alerts` - Security alerts

## Architecture

```
/app/
├── backend/
│   ├── admin_otp_auth.py          # Email OTP 2FA
│   ├── admin_security_routes.py   # Security dashboard API (NEW)
│   ├── admin_notifications.py     # Push notification system
│   └── server.py                  # Main server with all routes
├── frontend/
│   └── src/pages/admin/
│       ├── AdminLogin.jsx         # 2FA login page
│       ├── AdminSecurityDashboard.jsx  # Security monitoring (NEW)
│       ├── AdminLayout.jsx        # Layout with Security menu
│       └── [other admin pages]
└── mobile/
    └── src/screens/
        ├── AdminGenealogyScreen.js   # Genealogy management (NEW)
        ├── AdminManagementScreen.js  # Admin roles (NEW)
        └── [other admin screens]
```

## Test Reports
- `/app/test_reports/iteration_20.json` - Admin OTP auth (ALL PASSED)

## Remaining Tasks

### P1 - High Priority
- Client-side push notifications (service worker implementation)
- WebSocket real-time connection for live updates

### P2 - Medium Priority
- Fix `ValueError: Invalid salt` in legacy auth

### Future/Backlog
- AI Image/Video/Music Generation
- Social Pages verification
- Media features (looping thumbnails, watermarking)
- App Store submission prep

## Test Credentials
- **Admin**: blendlinknet@gmail.com / link2026blend!
- **Regular User**: testuser@test.com / password

## API Base URL
- Production: https://super-ctrl.preview.emergentagent.com
