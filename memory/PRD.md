# Blendlink Platform - Product Requirements Document

## Original Problem Statement
Build a complete multi-platform referral and compensation system with a comprehensive, production-grade admin panel. The admin panel must connect to the live production database, handle real users, activities, transactions, and finances with all actions synchronizing in real-time between web PWA and mobile app.

## Admin Panel Requirements
- **Secure 2FA Login**: Admin login with Email OTP verification (using Resend)
- **Full User Management**: Search, filter, view, suspend, ban, reset passwords
- **Real-Time Financial Oversight**: View balances, transaction histories, manual balance adjustments with audit logging
- **Withdrawal Management**: Approve/reject KYC and cash withdrawal requests
- **Genealogy Management**: View and edit team hierarchy
- **Content Moderation**: Access and moderate user content
- **Platform Configuration**: Manage global settings
- **RBAC**: Role-based access control
- **Real-time Push Notifications**: Admin alerts for KYC, withdrawals, etc.
- **100% Sync**: Full synchronization between web PWA and mobile app

## Current Tech Stack
- **Frontend**: React (Web PWA), React Native (Mobile)
- **Backend**: FastAPI + MongoDB
- **UI**: Tailwind CSS, Shadcn UI
- **Email**: Resend (for OTP)
- **Payments**: Stripe
- **Auth**: JWT + Email OTP (2FA for admins), Emergent Google Auth

## What's Been Implemented

### ✅ Completed (January 2026)
1. **Admin Panel Frontend Overhaul** - All core pages rebuilt and connected to production APIs
2. **Admin Push Notification System** - Backend + settings page (tested via curl)
3. **Mobile Admin Panel Foundation** - API service updated, initial screens created
4. **Email OTP Backend** - `admin_otp_auth.py` with Resend integration
5. **Admin Login Page Fix (P0)** - Fixed import paths in `AdminLogin.jsx`, page now renders correctly
6. **OTP Authentication Testing** - Full test suite at `/app/tests/test_admin_otp_auth_iteration20.py`

### 🔄 In Progress
1. **Complete Mobile Admin Panel** - Remaining screens needed (Genealogy, Analytics, Settings, Management)
2. **Client-Side Push Notifications** - Service worker and browser push subscription

### 📋 Pending
1. **WebSocket Real-Time Connection** - Connect frontend to backend WebSocket
2. **Fix `ValueError: Invalid salt`** - Legacy auth issue in server.py

## Architecture

```
/app/
├── backend/
│   ├── admin_auth_system.py
│   ├── admin_core_system.py
│   ├── admin_notifications.py
│   ├── admin_otp_auth.py        # Email OTP 2FA system
│   └── server.py
├── frontend/
│   └── src/
│       ├── App.js
│       └── pages/admin/
│           ├── AdminLayout.jsx
│           ├── AdminLogin.jsx   # 2FA login page
│           ├── AdminUsers.jsx
│           ├── AdminGenealogy.jsx
│           ├── AdminAudit.jsx
│           ├── AdminAnalytics.jsx
│           └── AdminManagement.jsx
└── mobile/
    └── src/
        ├── screens/
        │   ├── AdminScreen.js
        │   ├── AdminUsersScreen.js
        │   └── AdminWithdrawalsScreen.js
        └── services/api.js
```

## Key API Endpoints
- `POST /api/admin-auth/secure/login/step1` - Verify credentials, send OTP
- `POST /api/admin-auth/secure/login/step2` - Verify OTP, return JWT
- `POST /api/admin-auth/secure/login/resend-otp` - Resend OTP
- `GET /api/admin-auth/secure/check-session` - Validate admin session

## Test Credentials
- **Admin**: blendlinknet@gmail.com / link2026blend!
- **Regular User**: testuser@test.com / password

## Future/Backlog
- AI Image, Video, Music Generation
- Social Pages verification (Friends, Groups, Events)
- Media features (looping video thumbnails, watermarking)
- App Store submission prep

## Test Reports
- `/app/test_reports/iteration_20.json` - Admin OTP auth testing (ALL PASSED)
