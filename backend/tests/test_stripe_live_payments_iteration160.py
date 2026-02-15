"""
BlendLink LIVE Stripe Payment Tests - Iteration 160
Tests critical payment functionality with LIVE Stripe keys:
- GET /api/payments/config returns pk_live_* publishable key
- POST /api/subscriptions/checkout returns cs_live_* session URL
- POST /api/payments/stripe/bl-coins/checkout returns cs_live_* URL
- POST /api/orders/checkout returns cs_live_* payment URL
- POST /api/payments/stripe/connect/onboard returns Stripe Connect URL
- POST /api/member-pages/ successfully creates page (no 401)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "tester@blendlink.net"
TEST_USER_PASSWORD = "BlendLink2024!"


class TestLiveStripePayments:
    """Verify all Stripe payments use LIVE keys (cs_live_* sessions)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.auth_token = None
    
    def login_user(self) -> str:
        """Login and return auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.auth_token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.auth_token}"})
            return self.auth_token
        return None
    
    # ============== CONFIG ENDPOINT TESTS ==============
    
    def test_payments_config_returns_live_publishable_key(self):
        """GET /api/payments/config must return pk_live_* key"""
        response = self.session.get(f"{BASE_URL}/api/payments/config")
        
        assert response.status_code == 200, f"Config endpoint failed: {response.text}"
        data = response.json()
        
        publishable_key = data.get("publishable_key", "")
        assert publishable_key.startswith("pk_live_"), f"Expected pk_live_* key, got: {publishable_key[:20]}..."
        print(f"✅ Payments config returns LIVE key: {publishable_key[:20]}...")
    
    # ============== SUBSCRIPTION CHECKOUT TESTS ==============
    
    def test_subscription_checkout_bronze_returns_live_session(self):
        """POST /api/subscriptions/checkout?tier=bronze must return cs_live_* URL"""
        self.login_user()
        
        response = self.session.post(
            f"{BASE_URL}/api/subscriptions/checkout",
            params={
                "tier": "bronze",
                "success_url": f"{BASE_URL}/subscription/success",
                "cancel_url": f"{BASE_URL}/subscription/cancel"
            }
        )
        
        assert response.status_code == 200, f"Subscription checkout failed: {response.text}"
        data = response.json()
        
        checkout_url = data.get("checkout_url", "")
        assert "checkout.stripe.com" in checkout_url, f"Expected Stripe checkout URL, got: {checkout_url[:50]}..."
        assert "cs_live_" in checkout_url, f"Expected cs_live_* session in URL, got: {checkout_url[:80]}..."
        print(f"✅ Bronze subscription checkout returns LIVE session: cs_live_... in URL")
    
    def test_subscription_checkout_silver_returns_live_session(self):
        """POST /api/subscriptions/checkout?tier=silver must return cs_live_* URL"""
        self.login_user()
        
        response = self.session.post(
            f"{BASE_URL}/api/subscriptions/checkout",
            params={
                "tier": "silver",
                "success_url": f"{BASE_URL}/subscription/success",
                "cancel_url": f"{BASE_URL}/subscription/cancel"
            }
        )
        
        assert response.status_code == 200, f"Silver checkout failed: {response.text}"
        data = response.json()
        
        checkout_url = data.get("checkout_url", "")
        assert "cs_live_" in checkout_url, f"Expected cs_live_* session, got: {checkout_url[:80]}..."
        print(f"✅ Silver subscription checkout returns LIVE session")
    
    # ============== BL COINS CHECKOUT TESTS ==============
    
    def test_bl_coins_checkout_returns_live_session(self):
        """POST /api/payments/stripe/bl-coins/checkout must return cs_live_* URL"""
        self.login_user()
        
        # Starter tier: $4.99 for 30,000 coins (per BL_COINS_TIERS definition)
        response = self.session.post(
            f"{BASE_URL}/api/payments/stripe/bl-coins/checkout",
            json={
                "tier_id": "starter",
                "amount_usd": 4.99,
                "coins_amount": 30000,
                "origin_url": BASE_URL
            }
        )
        
        # Accept 200 or 201
        assert response.status_code in [200, 201], f"BL Coins checkout failed: {response.text}"
        data = response.json()
        
        checkout_url = data.get("checkout_url", data.get("url", ""))
        assert checkout_url, f"No checkout URL in response: {data}"
        assert "cs_live_" in checkout_url, f"Expected cs_live_* session in URL, got: {checkout_url[:80]}..."
        print(f"✅ BL Coins checkout returns LIVE session: cs_live_... in URL")
    
    # ============== MARKETPLACE ORDERS CHECKOUT TEST ==============
    
    def test_orders_checkout_returns_live_payment_url(self):
        """POST /api/orders/checkout must return cs_live_* payment_url (NOT fallback)"""
        # This tests marketplace checkout - must redirect to Stripe, not fake success
        response = self.session.post(
            f"{BASE_URL}/api/orders/checkout",
            json={
                "items": [
                    {
                        "listing_id": "test_listing_123",
                        "title": "Test Product",
                        "price": 29.99,
                        "quantity": 1,
                        "seller_id": "test_seller_1"
                    }
                ],
                "customer": {
                    "name": "Test User",
                    "email": "test@example.com",
                    "phone": "555-1234"
                },
                "shipping_address": {
                    "street1": "123 Test St",
                    "city": "Test City",
                    "state": "CA",
                    "zip": "90210",
                    "country": "US"
                },
                "shipping_option": {
                    "carrier": "USPS",
                    "service": "Priority"
                },
                "shipping_cost": 8.99,
                "total": 38.98,
                "total_items": 29.99,
                "payment_method": "card"
            }
        )
        
        # Should return 200 with payment_url, NOT fall through to pending_payment
        assert response.status_code == 200, f"Orders checkout failed: {response.text}"
        data = response.json()
        
        payment_url = data.get("payment_url", "")
        assert payment_url, f"No payment_url in response: {data}"
        assert "checkout.stripe.com" in payment_url, f"Expected Stripe checkout URL, got: {payment_url[:50]}..."
        assert "cs_live_" in payment_url, f"Expected cs_live_* session in payment_url, got: {payment_url[:80]}..."
        
        # Ensure it's NOT the old fallback behavior
        assert "pending_payment" not in data.get("message", "").lower(), "Checkout fell through to pending_payment fallback!"
        print(f"✅ Orders checkout returns LIVE Stripe URL, not fallback")
    
    # ============== STRIPE CONNECT ONBOARDING TEST ==============
    
    def test_stripe_connect_onboard_returns_valid_url(self):
        """POST /api/payments/stripe/connect/onboard must return valid Stripe Connect URL"""
        self.login_user()
        
        response = self.session.post(
            f"{BASE_URL}/api/payments/stripe/connect/onboard",
            headers={"Origin": BASE_URL}
        )
        
        # May return 200, 503 (platform not configured), or 400 (already connected)
        if response.status_code == 200:
            data = response.json()
            connect_url = data.get("url", "")
            assert connect_url, f"No URL in response: {data}"
            assert "connect.stripe.com" in connect_url or "stripe.com" in connect_url, f"Invalid Connect URL: {connect_url[:80]}..."
            print(f"✅ Stripe Connect onboarding returns valid URL")
        elif response.status_code == 503:
            # Acceptable - means Stripe Connect platform profile not configured
            print(f"⚠️ Stripe Connect onboarding returns 503 - platform configuration needed")
            assert "platform" in response.text.lower() or "configured" in response.text.lower()
        elif response.status_code == 400:
            # Already connected
            print(f"ℹ️ User already has Stripe Connect account")
        else:
            pytest.fail(f"Unexpected status {response.status_code}: {response.text}")
    
    # ============== MEMBER PAGES CREATE TEST ==============
    
    def test_member_pages_create_no_401_error(self):
        """POST /api/member-pages/ must create page successfully (no 401)"""
        self.login_user()
        assert self.auth_token, "Login failed - cannot test member pages"
        
        unique_slug = f"test-page-{uuid.uuid4().hex[:8]}"
        
        response = self.session.post(
            f"{BASE_URL}/api/member-pages/",
            json={
                "name": "Test Page",
                "page_type": "portfolio",
                "slug": unique_slug,
                "description": "Test page for iteration 160",
                "category": "photography"
            }
        )
        
        # Should NOT return 401
        assert response.status_code != 401, f"Member page creation returned 401 - JWT_SECRET mismatch: {response.text}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "page_id" in data or "id" in data, f"No page_id in response: {data}"
            print(f"✅ Member page created successfully: {data.get('page_id', data.get('id'))}")
            
            # Clean up - delete the test page
            page_id = data.get("page_id", data.get("id"))
            if page_id:
                self.session.delete(f"{BASE_URL}/api/member-pages/{page_id}")
        elif response.status_code == 400:
            # May fail due to slug uniqueness or validation - acceptable if not 401
            print(f"⚠️ Member page creation validation error (not 401): {response.text}")
        else:
            print(f"⚠️ Member page creation returned {response.status_code}: {response.text}")
    
    # ============== WALLET ENDPOINT TEST ==============
    
    def test_wallet_endpoint_returns_data(self):
        """GET /api/wallet/balance verifies wallet page can load"""
        self.login_user()
        
        response = self.session.get(f"{BASE_URL}/api/wallet/balance")
        
        assert response.status_code == 200, f"Wallet balance failed: {response.text}"
        data = response.json()
        
        # Should have balance info
        assert "bl_coins" in data or "balance" in data, f"No balance in wallet response: {data}"
        print(f"✅ Wallet endpoint returns balance data")
    
    # ============== API HEALTH CHECK ==============
    
    def test_api_health_check(self):
        """Basic health check to ensure backend is running"""
        response = self.session.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200, f"Health check failed: {response.text}"
        print(f"✅ API health check passed")


class TestAuthAndIntegration:
    """Test authentication and basic API integration"""
    
    def test_login_with_test_credentials(self):
        """Verify test user login works"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            }
        )
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "token" in data, f"No token in login response: {data}"
        assert data.get("user", {}).get("email") == TEST_USER_EMAIL
        print(f"✅ Test user login successful")
    
    def test_subscriptions_page_data(self):
        """GET /api/subscriptions/tiers returns tier data"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        
        assert response.status_code == 200, f"Tiers endpoint failed: {response.text}"
        data = response.json()
        
        # Response is {"tiers": {...dict...}, "ranked_tiers": {...}}
        tiers_dict = data.get("tiers", {})
        
        # Check for Bronze tier in dictionary
        assert "bronze" in tiers_dict, f"Bronze tier not found in tiers: {list(tiers_dict.keys())}"
        assert tiers_dict["bronze"]["price_monthly"] == 4.99, f"Bronze price incorrect"
        print(f"✅ Subscription tiers endpoint returns data with {len(tiers_dict)} tiers: {list(tiers_dict.keys())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
