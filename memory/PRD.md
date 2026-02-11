# Blendlink Platform - Product Requirements Document

## Latest Update: February 11, 2026 - Returning Customer Notifications Added

---

## ✅ RETURNING CUSTOMER NOTIFICATIONS (Iteration 142)

### Feature Overview
Page owners receive notifications when a recognized customer returns, enabling personalized service.

### Implementation Details

#### Notification Types (Toast Display)
| Customer Type | Condition | Emoji | Message |
|--------------|-----------|-------|---------|
| VIP Customer | 5+ orders | 🌟 | "VIP Customer!" + name + total spent |
| Returning | 2+ orders | 👋 | "Welcome back!" + name + last visit |
| Regular | 1 order | - | "Customer selected: {name}" |

#### Settings Toggle
- **Location**: Settings > POS Fast Cash Buttons section
- **Label**: "Returning Customer Alerts"
- **Description**: "Get notified when a recognized customer returns"
- **Test ID**: `returning-customer-notifications-toggle`
- **Default**: Enabled (true)

#### Backend Integration
- **GET /api/member-pages/{page_id}/pos-settings** - Returns `enable_returning_customer_notifications`
- **PUT /api/member-pages/{page_id}/pos-settings** - Saves notification preference
- **Customer Search** - Triggers `notify_returning_customer()` when enabled

#### WebSocket Notification
- **Type**: `RETURNING_CUSTOMER`
- **Data**: customer_name, email, phone, order_count, total_spent, last_purchase, page_id, page_name
- **Delivery**: WebSocket + Push notification (for offline users)

### Test Results: 100% Pass (9/9 backend, all frontend features)

---

## Previous Implementations Summary

### Iteration 141: Urgent Features
- ✅ Manual Product Entry in POS
- ✅ Customer Email & Autofill
- ✅ Discover Card Customization

### Iteration 140: Full Feature Set
- ✅ Language Selector (6 languages)
- ✅ WebSocket Real-Time Sync
- ✅ Stripe Subscriptions API
- ✅ Customer Email Integration (Resend)
- ✅ Customizable Fast Cash Buttons

### Iteration 139: Subscriptions & CRM
- ✅ Subscription Toggle (weekly/monthly/yearly)
- ✅ Customer CRM Manager
- ✅ Logo Upload

### Iteration 138: POS Enhancements
- ✅ Fast Cash Buttons ($1-$10K)
- ✅ Change Due Calculator
- ✅ Digital Wallet Input
- ✅ View/Manage Buttons in Discover
- ✅ Pages in More Menu

### Iteration 137: Priority Bug Fixes
- ✅ Bottom nav overlap fix
- ✅ Product image upload fix
- ✅ Product editing

---

## Complete API Endpoints

### POS & Notifications
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/member-pages/{page_id}/pos-settings` | GET | Get POS settings incl. notification prefs |
| `/api/member-pages/{page_id}/pos-settings` | PUT | Update POS settings |
| `/api/member-pages/{page_id}/pos-customers/search` | GET | Search customers (triggers notification) |
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

## WebSocket Events

| Event | Trigger | Description |
|-------|---------|-------------|
| `RETURNING_CUSTOMER` | Customer recognized in POS | Alert page owner |
| `pos_settings_updated` | POS settings saved | Sync to mobile |
| `card_settings_updated` | Card appearance saved | Sync to mobile |
| `order_status_changed` | Order updated | Notify relevant parties |

---

## Test Credentials
- **Email**: tester@blendlink.net
- **Password**: BlendLink2024!
- **Test Page**: mpage_000a72b44296

---

## All Testing Iterations

| Iteration | Focus | Backend | Frontend | Status |
|-----------|-------|---------|----------|--------|
| 137 | Priority Fixes | 11/11 | 100% | ✅ |
| 138 | POS Enhancements | N/A | 10/10 | ✅ |
| 139 | Subscriptions | 6/6 | 9/9 | ✅ |
| 140 | Full Features | 14/14 | 11/11 | ✅ |
| 141 | Urgent Features | 14/14 | All | ✅ |
| 142 | Notifications | 9/9 | All | ✅ |

**Total: 54+ backend tests, 50+ frontend verifications - All Passed**

---

*Implementation Complete: February 11, 2026*
*All features tested and verified working*
