# BlendLink Platform - Product Requirements Document

## Latest Update: February 15, 2026

---

## LATEST SESSION: GET Redirect Fix for Stripe Errors (Feb 15, 2026)

### Issue:
"Server error. Please try again in a moment." on:
- /wallet Connect Stripe Account button
- /wallet subscription tier buttons  
- /subscriptions upgrade tier buttons

### Root Cause:
Production CDN/proxy (Cloudflare/K8s ingress) corrupts POST response bodies, making JSON parsing impossible regardless of method (text(), json(), clone()). Multiple iterations tried different body-reading strategies — all failed in production.

### Solution:
**Bypass JSON entirely.** Created new GET redirect endpoints that return HTTP 302 redirects to Stripe. The browser follows 302 redirects natively — no JavaScript body parsing needed at all.

### New Endpoints:
- `GET /api/subscriptions/checkout-redirect?tier=...&success_url=...&cancel_url=...&token=...` → 302 to Stripe Checkout
- `GET /api/payments/stripe/connect/onboard-redirect?token=...` → 302 to Stripe Connect

### Frontend Change:
All three handlers now use `window.location.href = redirectUrl` instead of `fetch()` + JSON parsing.

### Files Changed:
- `backend/subscription_tiers.py` — new `checkout-redirect` GET endpoint
- `backend/stripe_payments.py` — new `connect/onboard-redirect` GET endpoint
- `frontend/src/pages/Wallet.jsx` — handleStripeOnboarding + handleSubscribe use redirect
- `frontend/src/pages/SubscriptionTiers.jsx` — handleUpgrade uses redirect

### Test Results:
- Backend: **100% (9/9)** — all tiers return 302 to checkout.stripe.com
- Frontend: **100%** — pages load, buttons navigate correctly
- Report: `/app/test_reports/iteration_165.json`

---

## TEST CREDENTIALS
| Role | Email | Password |
|------|-------|----------|
| Test User | tester@blendlink.net | BlendLink2024! |
| Admin | blendlinknet@gmail.com | Blend!Admin2026Link |

---
*Last Updated: February 15, 2026*
