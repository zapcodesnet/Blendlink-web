# BlendLink Platform - Product Requirements Document

## Latest Update: February 15, 2026

---

## LATEST SESSION: Fix Stale Stripe Account/Customer IDs (Feb 15, 2026)

### Issues Fixed:

| Issue | Error | Root Cause | Fix |
|-------|-------|-----------|-----|
| Connect Stripe Account | "account not connected to your platform or does not exist" | Stale Stripe Connect account IDs from test mode in database | Validate with `stripe.Account.retrieve()`, recreate if stale |
| Subscription checkout | "Internal Server Error" | Stale Stripe customer IDs from test mode | Validate with `stripe.Customer.retrieve()`, recreate if stale |

### How the Fix Works:
1. Before using any stored Stripe ID, the backend now calls `stripe.Account.retrieve()` or `stripe.Customer.retrieve()` to verify it exists on the live platform
2. If the ID is invalid (from test mode, deleted, or wrong platform), it's deleted from the database
3. A new Stripe account/customer is created with the live key
4. This ensures ALL users work correctly regardless of their Stripe history

### Files Changed:
- `backend/stripe_payments.py` — Both GET redirect and POST endpoints validate Connect accounts
- `backend/subscription_tiers.py` — `create_checkout_session` validates customers + forces live API key

### Test Results:
- Backend: **100% (12/12)**
- Frontend: **100%** — button clicks redirect to Stripe
- Report: `/app/test_reports/iteration_166.json`

---

## Previous Fixes (This Session):
- **GET redirect endpoints** — bypass CDN/proxy JSON body corruption (iteration 165)
- **response.json() approach** — simplified body parsing (iteration 164)

## TEST CREDENTIALS
| Role | Email | Password |
|------|-------|----------|
| Test User | tester@blendlink.net | BlendLink2024! |
| Admin | blendlinknet@gmail.com | Blend!Admin2026Link |

---
*Last Updated: February 15, 2026*
