# BlendLink Platform - PRD

## Latest: Earnings Page Section Hiding (Feb 17, 2026)

### 3 sections hidden on Earnings/My Team screens (web + mobile sync):
1. **Referral Code card** — Hidden via `{false && (...)}` in both EarningsDashboard.jsx and MyTeamScreen.js
2. **Your Network / Stats Row** — Hidden: commission rates displayed don't match current tier structure
3. **Diamond Leader Status** — Hidden via `{false && (...)}` in both files

### Files changed (ONLY these 2):
- `frontend/src/pages/EarningsDashboard.jsx` — 3x `{false && (...)}`
- `mobile/src/screens/MyTeamScreen.js` — 3x `{false && (...)}`

### No other pages, backend, APIs, or functionality touched.

---
*Last Updated: February 17, 2026*
