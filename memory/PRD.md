# BlendLink Platform - Product Requirements Document

## Latest Update: February 16, 2026

---

## LATEST SESSION: Touch Scroll Fix + Hero Card Removal (Feb 16, 2026)

### Root Cause of Scroll Issues:
`.bl-premium-bg` in `premium-design-system.css` had `overflow: hidden` — this class is used on Login, Register, and other pages. It completely blocked vertical scrolling.

### Fixes Applied:

| Fix | File | What Changed |
|-----|------|-------------|
| **`.bl-premium-bg` overflow** | `premium-design-system.css` | Changed `overflow: hidden` → `overflow-y: auto; overflow-x: hidden` |
| **Global touch-action rules** | `index.css` (bottom) | Added `touch-action: pan-y !important` on ALL card-like elements, grids, images, admin panels, subscription cards, wallet sections |
| **Hero card removed** | `Landing.jsx` | Removed "Social, Shop, Play & Earn Rewards" section. Kept "Everything You Need" + icons below |

### Pages Fixed:
1. Register (/register) — now scrollable
2. Landing (/) — cards scrollable, hero removed
3. Marketplace (/marketplace) — card scroll fixed
4. Minted Photos (/minted-photos) — photo cards scrollable
5. Photo Game (/photo-game) — same
6. Wallet (/wallet) — all sections scrollable
7. Games (/games) — arena/casino cards scrollable
8. Profile (/profile) — minted/post sections scrollable
9. Subscriptions (/subscriptions) — tier cards scrollable
10. Member Pages (/pages, /[slug]) — all cards scrollable
11. Admin Panel (/admin/*) — all pages scrollable

### Test Results:
- Frontend: **100% (16/16)**
- Report: `/app/test_reports/iteration_171.json`

---

## TEST CREDENTIALS
| Role | Email | Password |
|------|-------|----------|
| Test User | tester@blendlink.net | BlendLink2024! |
| User | vinwebs0@gmail.com | Mikaela2021! |

---
*Last Updated: February 16, 2026*
