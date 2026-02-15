"""
Test Suite for Iteration 162: Body Stream Already Read Bug Fix
Tests the fixes for:
1. POST /api/payments/stripe/connect/onboard - Stripe Connect URL
2. POST /api/subscriptions/checkout?tier=* - Subscription checkout URLs
3. Wallet and Subscriptions page API integrations

The fix involves using response.clone() fallback in frontend:
- api.js: apiRequest now uses response.clone() fallback
- Wallet.jsx: subscription checkout uses api.post() instead of raw fetch
- SubscriptionTiers.jsx: handleUpgrade uses api.post() instead of raw fetch
- memberPagesApi.js: safeFetch uses response.clone() fallback
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"


class TestBodyStreamFix:
    """Test the backend endpoints that were affected by body stream errors"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token for all tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        login_data = login_response.json()
        self.token = login_data.get("token") or login_data.get("access_token")
        assert self.token, "No token received from login"
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    # ============ Stripe Connect Onboard Tests ============
    
    def test_stripe_connect_onboard_returns_url(self):
        """POST /api/payments/stripe/connect/onboard must return valid Stripe Connect URL"""
        response = self.session.post(f"{BASE_URL}/api/payments/stripe/connect/onboard")
        
        print(f"Stripe Connect Onboard Status: {response.status_code}")
        print(f"Response: {response.text[:500] if response.text else 'Empty'}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "url" in data, f"Response missing 'url' field: {data}"
        assert data["url"].startswith("https://connect.stripe.com"), f"Invalid Stripe URL: {data['url']}"
        print(f"✅ Stripe Connect onboard URL received: {data['url'][:80]}...")
    
    def test_stripe_connect_status(self):
        """GET /api/payments/stripe/connect/status returns connection status"""
        response = self.session.get(f"{BASE_URL}/api/payments/stripe/connect/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "is_connected" in data, f"Response missing is_connected: {data}"
        print(f"✅ Stripe Connect status: is_connected={data.get('is_connected')}, charges_enabled={data.get('charges_enabled')}")
    
    # ============ Subscription Checkout Tests ============
    
    def test_subscription_checkout_bronze(self):
        """POST /api/subscriptions/checkout?tier=bronze must return checkout_url with cs_live_*"""
        response = self.session.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=bronze&success_url=https://blendlink.net/success&cancel_url=https://blendlink.net/cancel"
        )
        
        print(f"Bronze Checkout Status: {response.status_code}")
        print(f"Response: {response.text[:500] if response.text else 'Empty'}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        checkout_url = data.get("checkout_url") or data.get("url")
        assert checkout_url, f"No checkout_url in response: {data}"
        assert "cs_live_" in checkout_url or "cs_test_" in checkout_url, f"Invalid checkout URL format: {checkout_url}"
        print(f"✅ Bronze checkout URL: {checkout_url[:80]}...")
    
    def test_subscription_checkout_silver(self):
        """POST /api/subscriptions/checkout?tier=silver must return checkout_url"""
        response = self.session.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=silver&success_url=https://blendlink.net/success&cancel_url=https://blendlink.net/cancel"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        checkout_url = data.get("checkout_url") or data.get("url")
        assert checkout_url, f"No checkout_url in response: {data}"
        print(f"✅ Silver checkout URL received")
    
    def test_subscription_checkout_gold(self):
        """POST /api/subscriptions/checkout?tier=gold must return checkout_url"""
        response = self.session.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=gold&success_url=https://blendlink.net/success&cancel_url=https://blendlink.net/cancel"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        checkout_url = data.get("checkout_url") or data.get("url")
        assert checkout_url, f"No checkout_url in response: {data}"
        print(f"✅ Gold checkout URL received")
    
    def test_subscription_checkout_diamond(self):
        """POST /api/subscriptions/checkout?tier=diamond must return checkout_url"""
        response = self.session.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=diamond&success_url=https://blendlink.net/success&cancel_url=https://blendlink.net/cancel"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        checkout_url = data.get("checkout_url") or data.get("url")
        assert checkout_url, f"No checkout_url in response: {data}"
        print(f"✅ Diamond checkout URL received")
    
    # ============ Subscription Tiers Info Test ============
    
    def test_subscription_tiers_info(self):
        """GET /api/subscriptions/tiers returns tier info"""
        response = self.session.get(f"{BASE_URL}/api/subscriptions/tiers")
        
        # Endpoint may or may not exist - if it does, validate structure
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Subscription tiers data received: {type(data)}")
        elif response.status_code == 404:
            print("⚠️ /api/subscriptions/tiers endpoint not found (may use frontend config)")
            pytest.skip("Tiers endpoint not available")
        else:
            print(f"⚠️ Unexpected status {response.status_code}")
    
    # ============ Wallet Balance Test ============
    
    def test_wallet_balance(self):
        """GET /api/wallet/balance returns balance data"""
        response = self.session.get(f"{BASE_URL}/api/wallet/balance")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "balance" in data, f"Response missing balance: {data}"
        print(f"✅ Wallet balance: {data.get('balance')} BL, USD: ${data.get('usd_balance', 0):.2f}")
    
    # ============ Current Subscription Test ============
    
    def test_current_subscription(self):
        """GET /api/subscriptions/current or /api/subscriptions/my-subscription returns subscription data"""
        # Try both possible endpoints
        response = self.session.get(f"{BASE_URL}/api/subscriptions/my-subscription")
        
        if response.status_code == 404:
            response = self.session.get(f"{BASE_URL}/api/subscriptions/current")
        
        # User may or may not have an active subscription
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Current subscription: {data}")
        elif response.status_code == 404:
            print("✅ No active subscription (expected for test user)")
        else:
            print(f"⚠️ Subscription status check returned {response.status_code}")


class TestResponseBodyHandling:
    """Test that API responses can be read correctly (validates backend sends proper responses)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login for authenticated tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if login_response.status_code == 200:
            login_data = login_response.json()
            self.token = login_data.get("token") or login_data.get("access_token")
            if self.token:
                self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    def test_stripe_connect_response_is_valid_json(self):
        """Verify Stripe Connect onboard returns valid JSON body"""
        response = self.session.post(f"{BASE_URL}/api/payments/stripe/connect/onboard")
        
        # Response should have Content-Type: application/json
        content_type = response.headers.get('Content-Type', '')
        assert 'application/json' in content_type, f"Expected JSON content-type, got: {content_type}"
        
        # Response body should be valid JSON
        try:
            data = response.json()
            print(f"✅ Valid JSON response from Stripe Connect: keys={list(data.keys())}")
        except Exception as e:
            pytest.fail(f"Failed to parse JSON response: {e}")
    
    def test_subscription_checkout_response_is_valid_json(self):
        """Verify subscription checkout returns valid JSON body"""
        response = self.session.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=bronze&success_url=https://test.com&cancel_url=https://test.com"
        )
        
        content_type = response.headers.get('Content-Type', '')
        assert 'application/json' in content_type, f"Expected JSON content-type, got: {content_type}"
        
        try:
            data = response.json()
            print(f"✅ Valid JSON response from subscription checkout: keys={list(data.keys())}")
        except Exception as e:
            pytest.fail(f"Failed to parse JSON response: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
