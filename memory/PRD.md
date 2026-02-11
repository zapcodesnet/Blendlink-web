# Blendlink Platform - Product Requirements Document

## Latest Update: February 11, 2026 - Urgent Features Complete

---

## ✅ URGENT FEATURES IMPLEMENTED (Iteration 141)

### 1. Manual Product/Service Entry in POS
**Location**: Member Pages > POS Terminal

**Features**:
- "Custom Item" button (orange) next to search bar
- Modal with Name (required), Description (optional), Price (required) fields
- Real-time 8% platform fee preview
- Custom items added to cart with `is_custom: true` flag
- Full payment processing (cash/card/digital) supported
- Mobile-friendly with large inputs

**UI Elements**:
- `[data-testid='manual-entry-btn']` - Custom Item button
- `[data-testid='manual-item-name']` - Name input
- `[data-testid='manual-item-price']` - Price input
- `[data-testid='add-manual-item-btn']` - Add to Cart button

### 2. Customer Email & Autofill in POS
**Location**: Member Pages > POS Terminal > Customer Info section

**Features**:
- Customer Name, Phone, Email fields with icons
- Smart autofill search (triggers at 2+ characters)
- Suggestions dropdown shows previous customers:
  - Name, email, phone
  - Order count, total spent
  - Last purchase date
- Click to auto-populate all fields

**UI Elements**:
- `[data-testid='customer-name-input']` - Name with autofill
- `[data-testid='customer-phone-input']` - Phone
- `[data-testid='customer-email-input']` - Email (optional)
- `[data-testid^='customer-suggestion-']` - Suggestion items

**Backend Endpoint**:
- `GET /api/member-pages/{page_id}/pos-customers/search?q={query}`
- Returns: customers array with name, email, phone, order_count, total_spent, last_purchase

### 3. Discover Card Customization
**Location**: Member Pages > Settings Tab > "Discover Card Appearance"

**Features**:
- 8 predefined gradient colors (Ocean, Sunset, Forest, Night, Fire, Sky, Rose, Mint)
- Custom color input (hex or linear-gradient)
- Background image upload with preview
- Toggle preview to see changes
- Reset to default option
- Real-time WebSocket sync to mobile app

**UI Elements**:
- `[data-testid='color-{name}']` - Predefined color buttons
- Preview toggle button
- Image upload button
- Save Appearance / Reset to Default buttons

**Backend Endpoint**:
- `PUT /api/member-pages/{page_id}/card-settings`
- Fields: `background_color`, `background_image`
- WebSocket Event: `card_settings_updated`

---

## Test Results: Iteration 141
| Component | Tests | Status |
|-----------|-------|--------|
| Backend API | 14/14 | ✅ PASS |
| Frontend UI | All 3 features | ✅ PASS |
| WebSocket Sync | Verified | ✅ PASS |

**Test Customers Created**: 2 customers via POS for autofill testing

---

## Previous Implementations (Iterations 137-140)

### Iteration 137: Priority Bug Fixes
- ✅ Bottom nav overlap fix
- ✅ Product image upload fix
- ✅ Product editing

### Iteration 138: POS Enhancements
- ✅ Fast Cash Buttons ($1-$10K)
- ✅ Change Due Calculator
- ✅ Digital Wallet Input
- ✅ View/Manage Buttons
- ✅ Pages in More Menu

### Iteration 139: Subscriptions & CRM
- ✅ Subscription Toggle
- ✅ Customer CRM Manager
- ✅ Logo Upload

### Iteration 140: Full Feature Set
- ✅ Language Selector
- ✅ WebSocket Real-Time Sync
- ✅ Stripe Subscriptions API
- ✅ Customer Email Integration
- ✅ Customizable Fast Cash Buttons

---

## API Endpoints Summary

### POS
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/member-pages/{page_id}/pos-settings` | GET | Get POS settings |
| `/api/member-pages/{page_id}/pos-settings` | PUT | Update POS settings |
| `/api/member-pages/{page_id}/pos-customers/search` | GET | Search customers for autofill |
| `/api/member-pages/{page_id}/card-settings` | PUT | Update Discover card appearance |

### Stripe Subscriptions
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/payments/stripe/subscriptions/create-product` | POST | Create subscription product |
| `/api/payments/stripe/subscriptions/checkout` | POST | Create checkout session |
| `/api/payments/stripe/subscriptions/status/{session_id}` | GET | Check status |
| `/api/payments/stripe/subscriptions/cancel` | POST | Cancel subscription |

### Customer CRM
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/page-analytics/{page_id}/customers` | GET | Get customer data |
| `/api/page-analytics/{page_id}/send-customer-email` | POST | Send promotional email |

---

## Real-Time Sync Events (WebSocket)

| Event | Trigger | Data |
|-------|---------|------|
| `pos_settings_updated` | POS settings saved | settings object |
| `card_settings_updated` | Card appearance saved | background_color, background_image |
| `order_status_changed` | Order updated | order details |
| `inventory_updated` | Stock changed | product, quantity |
| `product_updated` | Product edited | product details |

---

## Test Credentials
- **Email**: tester@blendlink.net
- **Password**: BlendLink2024!
- **Test Page**: mpage_000a72b44296

---

## Critical Constraints (MUST FOLLOW)

1. ✅ All changes confined to `/pages`, `/member-pages/[slug]`, POS, Discover
2. ✅ No global changes to homepage, /feed, profiles
3. ✅ Public pages remain fully public
4. ✅ Mobile-responsive (tested 375x812)
5. ✅ Real-time WebSocket sync
6. ✅ 8% platform fee on all transactions

---

*Implementation Complete: February 11, 2026*
*All features tested and verified working (Iterations 137-141)*
