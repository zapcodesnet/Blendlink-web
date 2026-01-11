# Blendlink PWA - Product Requirements Document

## Original Problem Statement
Build a fully responsive Progressive Web App (PWA) version of Blendlink - an all-in-one super app combining:
- **Facebook-style Social Media** (profiles, news feed, posts, likes, comments, follows, messaging/chat, stories)
- Marketplace (buy/sell items with listings, categories, search, shopping cart)
- Property rentals (listing and browsing rental properties)
- Professional services directory
- Gaming (mini-games like spin wheel, scratch cards, memory match)
- **Casino Games** (Slots, Blackjack, Roulette, Video Poker, Baccarat, Craps, Wheel of Fortune, Daily Spin)
- Raffle draws
- Virtual currency (BL Coin system)
- 2-level unilevel referral system with commissions
- Watermark & Media Sales System
- Comprehensive Earnings & Commission Management System
- **AI Media Generation** (images via OpenAI GPT Image 1.5, videos via Sora 2)
- **React Native Mobile App** (iOS & Android)
- **Admin System** (Full admin panel with RBAC, themes, user management, genealogy)

## Latest Update: Admin System Phase 3 Complete (January 11, 2026)

### Admin System Phase 3 ✅ COMPLETE

**Features Implemented:**

1. **Admin Management** (`/admin/admins`)
   - List all admin accounts with roles
   - Create new admins (Super Admin, Co-Admin, Moderator, Support)
   - Edit admin roles and permissions
   - Deactivate admins
   - Role legend with permission descriptions
   - Search users to promote to admin

2. **Audit Logs** (`/admin/audit`)
   - Full audit log viewer with pagination
   - Filter by action type (login, suspend, ban, delete, etc.)
   - Filter by target type (users, admins, themes, pages)
   - Export to CSV for compliance
   - Color-coded action icons
   - IP address and timestamp tracking
   - GDPR compliant logging

3. **Analytics Dashboard** (`/admin/analytics`)
   - Facebook/eBay-style analytics UI
   - 5 tabbed sections: Overview, Users, Content, Revenue, Engagement
   - Key metrics with growth indicators:
     - Total Users, Posts, Listings, BL Coins
     - Daily/Weekly/Monthly Active Users (DAU/WAU/MAU)
     - Session duration, bounce rate, pages per session
   - Interactive charts:
     - User Growth bar chart
     - Platform Distribution (Web vs Mobile, iOS vs Android)
     - Content Activity trends
     - Revenue breakdown
   - User acquisition sources
   - Retention metrics
   - Export functionality

4. **Platform Settings** (`/admin/settings`)
   - Comprehensive Facebook/eBay-style admin control panel
   - 11 setting categories with 80+ configurable options:
     - **Registration & Auth**: Enable/disable registration, email/phone verification, password policies, session timeout, login attempts
     - **Platform Features**: Toggle social feed, messaging, marketplace, casino, stories, groups, pages, events, AI generation, referrals
     - **Content Policies**: Post length limits, media size limits, file formats, auto-moderation, profanity filter, spam detection
     - **Rewards & BL Coins**: Welcome bonus, referral bonus, daily login, post rewards, reaction rewards
     - **Referral & Commissions**: Level 1/2 commission rates, withdrawal limits, fees, payout delays
     - **Marketplace**: Platform fees, listing limits, featured listing cost, Stripe/crypto payments, escrow
     - **Casino**: Min/max bets, enable individual games, house edge, daily spin rewards
     - **Notifications**: Email/push notifications, digest frequency
     - **Moderation & Safety**: Report thresholds, auto-ban, adult content, VPN blocking, geo restrictions
     - **Platform & Branding**: Platform name, tagline, support email, terms/privacy URLs, language, timezone, currency
     - **Maintenance**: Maintenance mode, read-only mode, rate limiting, backup frequency, log retention
   - Search settings functionality
   - Expandable/collapsible sections
   - Unsaved changes warning
   - Quick Actions: Enable Maintenance, Disable Registration, Disable Casino, Enable All
   - Reset to defaults

5. **Dashboard Widgets** (Customizable)
   - Drag-and-drop widget arrangement
   - Add/remove widgets
   - Small widgets: Total Users, New Users, Suspended, Banned, Posts, Listings, BL Coins, Admins, Albums
   - Large widgets: Recent Users, Quick Stats
   - Persisted to localStorage

**Files Modified/Created:**
- `/app/frontend/src/pages/admin/AdminLayout.jsx` - Wired up all new components
- `/app/frontend/src/pages/admin/AdminManagement.jsx` - Admin management component
- `/app/frontend/src/pages/admin/AdminAudit.jsx` - Audit logs viewer
- `/app/frontend/src/pages/admin/AdminAnalytics.jsx` - Analytics dashboard with tabs
- `/app/frontend/src/pages/admin/AdminSettings.jsx` - Comprehensive settings panel
- `/app/frontend/src/pages/admin/DashboardWidgets.jsx` - Customizable widgets
- `/app/frontend/src/App.js` - Removed obsolete AdminDashboard import

**Cleanup:**
- Removed obsolete `/app/frontend/src/pages/AdminDashboard.jsx`

---

## Previous Updates

### Admin System Phase 2 ✅ COMPLETE (January 11, 2026)
- AI Admin Assistant (GPT-4o)
- Page/Screen Management with drag-and-drop
- Mobile Theme Sync Service

### Admin System Phase 1 ✅ COMPLETE (January 11, 2026)
- Admin Authentication & Dashboard
- User Management (suspend, ban, delete, view private content)
- Role-Based Access Control (RBAC)
- Theme System (47+ themes)
- Genealogy Tree Visualization

### Previous Features
- Deployment Readiness Fixes
- Daily Spin Bonus + Mobile Casino
- Casino Games System (8 games)
- React Native Mobile App
- Social Feed Feature (Facebook-style)
- Album System, AI Listing Creator, FFmpeg Integration

---

## Tech Stack
- **Frontend**: React 18 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI + MongoDB
- **Payments**: Stripe via emergentintegrations library
- **AI Services**: OpenAI GPT Image 1.5, Sora 2, GPT-4o (AI Assistant)
- **PWA**: Service Worker + manifest.json with offline support
- **Auth**: JWT tokens + Emergent-managed Google OAuth
- **Mobile**: React Native/Expo

## Test Credentials
- **Admin**: `admin@test.com` / `testpassword` (has is_admin: true)
- **Regular User**: `test@test.com` / Create via registration

## Key Admin Routes
- `/admin` - Dashboard
- `/admin/users` - User Management
- `/admin/admins` - Admin Management
- `/admin/themes` - Theme Picker
- `/admin/pages` - Page Manager
- `/admin/genealogy` - Genealogy Tree
- `/admin/ai` - AI Assistant
- `/admin/audit` - Audit Logs
- `/admin/analytics` - Analytics Dashboard
- `/admin/settings` - Platform Settings

## Remaining Tasks (Prioritized)

### P1 - Mobile App Admin Panel
- Implement admin panel UI/UX on mobile app
- Sync with PWA admin functionality

### P2 - Core Social Features UI
- Complete Friends system UI
- Complete Groups system UI
- Complete Pages system UI
- Complete Events system UI

### P3 - Media Enhancements
- Video watermarking with drag-and-drop UI
- Looping video thumbnails (FFmpeg installed)

### P4 - Mobile App Testing
- Comprehensive React Native testing
- Run: `cd /app/mobile && npx expo start`

### Future Tasks
- AI Photo Studio (batch watermarking)
- Full mobile app feature parity
- Digital goods delivery system
- Secure large file transfer
