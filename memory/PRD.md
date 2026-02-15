# BlendLink Platform - Product Requirements Document

## Latest Update: February 15, 2026

---

## LATEST SESSION: Admin User Management Actions (Feb 15, 2026)

### 6 Admin Actions Implemented

All restricted to Super Admin, Co-Admin, and Authorized Moderator roles:

| Action | Endpoint | What it does |
|--------|----------|-------------|
| **Permanently Delete User** | `DELETE /api/admin/users/{user_id}` | Removes user + all associated data from DB. Email becomes re-registerable immediately. |
| **Completely Suspend User** | `POST /api/admin/users/{user_id}/suspend` | Sets suspension flag + invalidates all sessions. Optional duration. User sees reason on login. |
| **Completely Ban User** | `POST /api/admin/users/{user_id}/ban` | Bans user + blacklists email in `banned_emails` collection + invalidates sessions. Prevents re-registration. |
| **Reset Password** | `POST /api/admin/users/{user_id}/reset-password` | Admin sets new password. Displayed in admin panel. |
| **Force Logout** | `POST /api/admin/users/{user_id}/force-logout` | Invalidates all tokens + clears sessions. Immediate effect on web + mobile. |
| **Adjust Balance** | `POST /api/admin/finance/adjust-balance/{user_id}` | Add/subtract balance with admin ID, timestamp, reason, before/after values in audit trail. |

### Security Enhancements
- Login endpoint checks `is_banned` and `is_suspended` before allowing login
- Register endpoint checks `banned_emails` collection to prevent re-registration by banned users
- Suspended users see reason + expiry date on login attempt
- Banned users see permanent ban message on login attempt
- All destructive actions invalidate sessions immediately (web + mobile)
- All actions logged in admin audit trail

### Test Results:
- Backend: **100% (25/25)**
- Report: `/app/test_reports/iteration_169.json`

---

## TEST CREDENTIALS
| Role | Email | Password |
|------|-------|----------|
| Test User | tester@blendlink.net | BlendLink2024! |
| User | vinwebs0@gmail.com | Mikaela2021! |
| Admin | blendlinknet@gmail.com | Blend!Admin2026Link |

---
*Last Updated: February 15, 2026*
