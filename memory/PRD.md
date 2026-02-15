# BlendLink Platform - Product Requirements Document

## Latest Update: February 15, 2026

---

## LATEST SESSION: 5 Feature Changes (Feb 15, 2026)

### 1. Google Button Removal from Public Auth Pages
- **Login** (`/login`): Google button and "or" divider completely removed from JSX
- **Register** (`/register`): Google button and "or" divider completely removed from JSX
- Referral code `?ref=` parameter capture still works
- Not CSS hidden — elements physically excluded from component tree

### 2. Profile Share Link Update
- Share button on `/profile` now navigates to `/profile` instead of `/referrals`

### 3. Member Page Analytics Referral Section Removal
- `AnalyticsDashboard.jsx`: Removed "Referral Performance", "Your Referral Code", "Share Your Referral Link" sections
- `MemberPageDashboard.jsx`: Removed "Referral Program" section
- Other analytics content (stats, charts) remains intact

### 4. Hidden Staff-Only Google Auth Page (`/google`)
- **Not logged in** → "Staff Access Only" with Go to Login button
- **Logged in, non-staff** → "Access Denied: reserved for staff only"
- **Logged in, staff (admin/co_admin/moderator)** → Shows Google button
- Backend: `GET /api/auth/staff-check` checks user role
- No links from any menu, footer, nav, or sitemap

### 5. Mandatory Email Verification for New Registrations
- New users get `email_verified: false` in database
- Verification email sent via Resend API after registration
- `GET /api/auth/verify-email?token=...` verifies email
- `POST /api/auth/resend-verification` resends email
- Login returns `email_verified: false` for unverified users
- ProtectedRoute shows verification pending screen for unverified users
- **Existing users grandfathered** (no `email_verified` field = treated as verified)

### Test Results:
- Backend: **100% (15/15)**
- Frontend: **100%** (all features verified)
- Report: `/app/test_reports/iteration_168.json`

---

## TEST CREDENTIALS
| Role | Email | Password |
|------|-------|----------|
| Test User | tester@blendlink.net | BlendLink2024! |
| Admin | blendlinknet@gmail.com | Blend!Admin2026Link |

---
*Last Updated: February 15, 2026*
