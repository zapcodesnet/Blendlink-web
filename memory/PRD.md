# BlendLink Platform - PRD

## Latest: Membership Tiers + Daily Claim Fix (Feb 20, 2026)

### Tier Values Updated (backend SUBSCRIPTION_TIERS):
| Tier | Price | BL Daily | Mints | Pages | Listings/mo | L1/L2 | XP |
|------|-------|----------|-------|-------|-------------|-------|-----|
| Free | $0 | 2,000 | 5 | 1 | 300 | 2%/1% | x1 |
| Bronze | $4.99 | 20,000 | 20 | 3 | 2,000 | 3%/2% | x2 |
| Silver | $9.99 | 80,000 | 50 | 10 | 10,000 | 3%/2% | x3 |
| Gold | $14.99 | 200,000 | 150 | 25 | 25,000 | 3%/2% | x4 |
| Diamond | $29.99 | 500,000 | Unlimited | Unlimited | Unlimited | 4%/3% | x5 |

### Changes:
- Bronze BL daily: 15,000 → 20,000
- Silver BL daily: 40,000 → 80,000
- Added monthly_listing_limit field to all tiers
- Free tier daily claim now works (was blocked before)
- Cooldown: 24-hour rolling (not midnight reset)
- Daily claim status endpoint returns tier + claim_amount from server
- Frontend uses server-returned claim_amount (not hardcoded)
- Countdown displays hours + minutes

---
*Last Updated: February 20, 2026*
