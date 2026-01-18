# Blendlink Stripe Subscription Setup Guide

## Step 1: Create Stripe Products

Go to your Stripe Dashboard > Products and create the following:

### Basic Subscription ($4.99/month)
1. Click "Add product"
2. Name: "Blendlink Basic"
3. Description: "20 daily mints, 100 BL daily bonus, 7% marketplace fee, 25% faster stamina regen"
4. Pricing: $4.99 USD, Recurring, Monthly
5. After creation, copy the **Price ID** (starts with `price_`)

### Premium Subscription ($9.99/month)
1. Click "Add product"
2. Name: "Blendlink Premium"
3. Description: "50 daily mints, 300 BL daily bonus, 6% marketplace fee, 50% faster stamina, create tournaments"
4. Pricing: $9.99 USD, Recurring, Monthly
5. After creation, copy the **Price ID** (starts with `price_`)

## Step 2: Set Up Webhook

1. Go to Stripe Dashboard > Developers > Webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-domain.com/api/subscriptions/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Webhook Signing Secret** (starts with `whsec_`)

## Step 3: Update Environment Variables

Add to `/app/backend/.env`:

```
# Stripe Subscription Products
STRIPE_BASIC_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_PREMIUM_PRICE_ID=price_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

## Step 4: Test the Integration

### Test Checkout Flow
```bash
# Login and get token
TOKEN=$(curl -s -X POST "https://your-domain.com/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}' | jq -r '.token')

# Create checkout session
curl -X POST "https://your-domain.com/api/subscriptions/checkout?tier=basic&success_url=https://your-domain.com/subscription?success=true&cancel_url=https://your-domain.com/subscription" \
  -H "Authorization: Bearer $TOKEN"
```

### Test Daily Bonus
```bash
curl -X POST "https://your-domain.com/api/subscriptions/claim-daily-bonus" \
  -H "Authorization: Bearer $TOKEN"
```

## Subscription Tiers Summary

| Feature | Free | Basic ($4.99) | Premium ($9.99) |
|---------|------|---------------|-----------------|
| Daily Mints | 3 | 20 | 50 |
| Daily BL Bonus | 0 | 100 | 300 |
| Marketplace Fee | 8% | 7% | 6% |
| Stamina Regen | 1x | 1.25x | 1.5x |
| Matchmaking Priority | Standard | Priority | VIP |
| Create Tournaments | ❌ | ❌ | ✅ |
| Exclusive Badges | - | Basic Supporter | Premium + Tournament Host |

## Stripe Test Cards

For testing, use these Stripe test cards:
- **Success**: 4242 4242 4242 4242
- **Requires Auth**: 4000 0025 0000 3155
- **Declined**: 4000 0000 0000 9995

All test cards use:
- Any future expiry date (e.g., 12/34)
- Any 3-digit CVC
- Any postal code
