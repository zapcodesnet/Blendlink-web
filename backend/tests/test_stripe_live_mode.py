"""
Stripe LIVE Mode Configuration Tests - Iteration 143
Tests that Stripe is correctly configured in LIVE mode (not test mode)
"""

import pytest
import requests
import os

# Read .env files directly to verify actual configuration (not overridden test env)
def read_env_file(path):
    """Read .env file and return dict of key-value pairs"""
    env_dict = {}
    try:
        with open(path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, value = line.partition('=')
                    # Remove quotes if present
                    value = value.strip('"\'')
                    env_dict[key.strip()] = value
    except FileNotFoundError:
        pass
    return env_dict

BACKEND_ENV = read_env_file('/app/backend/.env')
FRONTEND_ENV = read_env_file('/app/frontend/.env')

BASE_URL = FRONTEND_ENV.get('REACT_APP_BACKEND_URL', '').rstrip('/')
FRONTEND_URL = FRONTEND_ENV.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"

class TestStripeConfiguration:
    """Verify Stripe is configured in LIVE mode"""
    
    def test_backend_env_has_live_secret_key(self):
        """Backend .env should have sk_live_ secret key"""
        stripe_api_key = BACKEND_ENV.get('STRIPE_API_KEY', '')
        assert stripe_api_key.startswith('sk_live_'), f"STRIPE_API_KEY should start with 'sk_live_' but got: {stripe_api_key[:10]}..."
        print(f"✅ Backend STRIPE_API_KEY is LIVE mode: {stripe_api_key[:15]}...")
    
    def test_frontend_env_has_live_publishable_key(self):
        """Frontend .env should have pk_live_ publishable key"""
        stripe_pub_key = FRONTEND_ENV.get('REACT_APP_STRIPE_PUBLISHABLE_KEY', '')
        assert stripe_pub_key.startswith('pk_live_'), f"REACT_APP_STRIPE_PUBLISHABLE_KEY should start with 'pk_live_' but got: {stripe_pub_key[:10]}..."
        print(f"✅ Frontend REACT_APP_STRIPE_PUBLISHABLE_KEY is LIVE mode: {stripe_pub_key[:15]}...")
    
    def test_backend_stripe_secret_key_also_live(self):
        """Backend .env STRIPE_SECRET_KEY should also be live"""
        stripe_secret = BACKEND_ENV.get('STRIPE_SECRET_KEY', '')
        if stripe_secret:
            assert stripe_secret.startswith('sk_live_'), f"STRIPE_SECRET_KEY should start with 'sk_live_' but got: {stripe_secret[:10]}..."
            print(f"✅ Backend STRIPE_SECRET_KEY is LIVE mode: {stripe_secret[:15]}...")
        else:
            print("⚠️ STRIPE_SECRET_KEY not set, using STRIPE_API_KEY instead")
    
    def test_backend_stripe_publishable_key_live(self):
        """Backend .env STRIPE_PUBLISHABLE_KEY should be live"""
        stripe_pub = BACKEND_ENV.get('STRIPE_PUBLISHABLE_KEY', '')
        if stripe_pub:
            assert stripe_pub.startswith('pk_live_'), f"STRIPE_PUBLISHABLE_KEY should start with 'pk_live_' but got: {stripe_pub[:10]}..."
            print(f"✅ Backend STRIPE_PUBLISHABLE_KEY is LIVE mode: {stripe_pub[:15]}...")
        else:
            print("⚠️ STRIPE_PUBLISHABLE_KEY not set in backend (ok if only used on frontend)")


class TestPaymentRoutes:
    """Verify payment-related routes exist"""
    
    def test_health_endpoint(self):
        """Health endpoint should return OK"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✅ Health endpoint returns: {data}")
    
    def test_stripe_checkout_endpoint_exists(self):
        """Stripe checkout endpoint should be accessible (even if it returns validation error)"""
        # This will return 422 Unprocessable Entity because we're not sending valid data
        # but it proves the endpoint exists and is routed correctly
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/checkout/session",
            json={},  # Empty body to trigger validation error
            headers={"Content-Type": "application/json"}
        )
        # 422 = validation error (endpoint exists, just missing required fields)
        # 404 = endpoint doesn't exist
        # 500 = server error
        assert response.status_code in [422, 400], f"Expected 422 or 400, got {response.status_code}: {response.text}"
        print(f"✅ Stripe checkout endpoint exists (returned {response.status_code} for empty body)")
    
    def test_stripe_checkout_status_endpoint_exists(self):
        """Stripe checkout status endpoint should be accessible"""
        # Use a fake session ID - will return error but proves endpoint exists
        response = requests.get(f"{BASE_URL}/api/payments/stripe/checkout/status/cs_test_fake_session_id")
        # Should return 500 (Stripe API error) or similar, not 404
        assert response.status_code != 404, f"Endpoint returned 404 - route may not exist"
        print(f"✅ Stripe checkout status endpoint exists (returned {response.status_code})")


class TestPublicPageRoutes:
    """Test public page accessibility"""
    
    def test_public_page_loads(self):
        """Public page test-store-bbadd08f should load"""
        response = requests.get(f"{BASE_URL}/api/member-pages/public/test-store-bbadd08f")
        assert response.status_code == 200, f"Public page returned {response.status_code}: {response.text}"
        data = response.json()
        print(f"✅ Public page loaded: {data.get('page_name', 'unknown')}")
        
        # Verify page data doesn't contain test mode indicators
        page_str = str(data).lower()
        assert "test mode" not in page_str, "Page contains 'test mode' text"
        assert "sandbox" not in page_str, "Page contains 'sandbox' text"
        print("✅ No 'test mode' or 'sandbox' text in page data")


class TestPaymentSuccessRoutes:
    """Test that payment success/cancel routes are configured"""
    
    def test_payment_success_frontend_route(self):
        """Payment success page should be accessible via frontend"""
        # Test the frontend route
        response = requests.get(f"{FRONTEND_URL}/payment-success?session_id=test&order_id=test")
        # Should return 200 (React app loads)
        assert response.status_code == 200, f"Payment success route returned {response.status_code}"
        print(f"✅ /payment-success route accessible (status {response.status_code})")
    
    def test_payment_cancelled_frontend_route(self):
        """Payment cancelled page should be accessible via frontend"""
        response = requests.get(f"{FRONTEND_URL}/payment-cancelled?order_id=test")
        assert response.status_code == 200, f"Payment cancelled route returned {response.status_code}"
        print(f"✅ /payment-cancelled route accessible (status {response.status_code})")


class TestStripeCheckoutSessionCreation:
    """Test Stripe checkout session creation with valid order"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip(f"Auth failed: {response.status_code}")
    
    def test_checkout_session_requires_order_id(self):
        """Checkout session creation should require order_id"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/checkout/session",
            json={"origin_url": "https://test.com"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422, f"Expected 422 for missing order_id, got {response.status_code}"
        print("✅ Checkout session correctly requires order_id")
    
    def test_checkout_session_returns_404_for_invalid_order(self):
        """Checkout session should return 404 for non-existent order"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/checkout/session",
            json={"order_id": "invalid_order_123", "origin_url": "https://test.com"},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 404, f"Expected 404 for invalid order, got {response.status_code}"
        print("✅ Checkout session returns 404 for invalid order")


class TestMakeOfferModalConfig:
    """Verify MakeOfferModal.jsx doesn't have hardcoded test keys"""
    
    def test_no_hardcoded_test_key_in_makeoffer_modal(self):
        """MakeOfferModal.jsx should not have hardcoded test Stripe key"""
        modal_path = "/app/frontend/src/components/MakeOfferModal.jsx"
        with open(modal_path, 'r') as f:
            content = f.read()
        
        # Check for test key patterns
        assert "pk_test_" not in content, "Found pk_test_ hardcoded in MakeOfferModal.jsx"
        assert "sk_test_" not in content, "Found sk_test_ hardcoded in MakeOfferModal.jsx"
        
        # Verify it uses env variable
        assert "process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY" in content, \
            "MakeOfferModal.jsx should use process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY"
        
        print("✅ MakeOfferModal.jsx uses env variable, no hardcoded test keys")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
