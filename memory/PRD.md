# Blendlink Platform - Product Requirements Document

## Original Problem Statement
Build a complete multi-platform referral and compensation system with a comprehensive, production-grade admin panel with secure 2FA authentication and automatic session management.

## Admin Panel Requirements
- ✅ **Secure 2FA Login**: Admin login with Email OTP verification (using Resend) - WORKING
- ✅ **Auto-Logout on Inactivity**: 5-minute timeout for Admin, Co-Admin, Moderator - IMPLEMENTED
- ✅ **Security Dashboard**: Login history, failed attempts, locked accounts - COMPLETED
- ✅ **Full User Management**: Search, filter, view, suspend, ban, reset passwords - COMPLETED
- ✅ **Withdrawal Management**: Approve/reject KYC and cash withdrawals - COMPLETED
- ✅ **Genealogy Management**: View and edit team hierarchy - COMPLETED
- ✅ **RBAC**: Role-based access control - COMPLETED

## Current Tech Stack
- **Frontend**: React (Web PWA), React Native (Mobile)
- **Backend**: FastAPI + MongoDB
- **UI**: Tailwind CSS, Shadcn UI
- **Email**: Resend (for OTP)
- **Payments**: Stripe
- **Auth**: JWT + Email OTP (2FA for admins)

## What's Been Implemented (January 11, 2026)

### ✅ Bug Fix - Admin Login Error
- Fixed "Failed to execute 'clone' on 'Response': Response body is already used" error
- Removed unnecessary response cloning logic from `AdminLogin.jsx`
- Simplified error handling in Step 1 and Step 2 submission

### ✅ Auto-Logout Feature
- Implemented 5-minute inactivity auto-logout in `AdminLayout.jsx`
- Tracks user activity via mouse, keyboard, scroll, touch events
- Stores last activity timestamp in localStorage
- Shows toast notification on auto-logout
- Applies to all admin roles (Admin, Co-Admin, Moderator)

### ✅ Previous Implementations
- Admin Security Dashboard with login/activity monitoring
- Mobile Admin Panel screens (Genealogy, Management)
- Backend Security API endpoints

## Architecture

```
/app/frontend/src/pages/admin/
├── AdminLogin.jsx      # 2FA login (FIXED)
├── AdminLayout.jsx     # Layout with auto-logout (NEW FEATURE)
├── AdminSecurityDashboard.jsx
└── [other admin pages]
```

## Auto-Logout Implementation Details
```javascript
// 5-minute inactivity timeout
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 300,000ms

// Tracked events
const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

// On timeout: clear token, redirect to /admin/login
```

## Test Credentials
- **Admin**: blendlinknet@gmail.com / link2026blend!

## API Base URL
- Production: https://super-ctrl.preview.emergentagent.com

## Remaining Tasks
- Client-side push notifications (service worker)
- WebSocket real-time connection
- AI Image/Video/Music Generation
