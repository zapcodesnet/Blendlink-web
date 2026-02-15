"""
Tests for Stripe stale ID fix - Iteration 166
Tests the fixes for:
1. 'account not connected to your platform or does not exist' on Stripe Connect
2. 'Internal Server Error' on subscription checkout

Both issues caused by stale Stripe IDs in database from test mode.
Fix: validate existing Stripe IDs before using, recreate if stale.
"""

import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://blendlink-live.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("token")


class TestStripeConnectOnboardRedirect:
    """Test Stripe Connect onboard-redirect endpoint (GET)"""
    
    def test_connect_onboard_redirect_returns_302(self, auth_token):
        """GET /api/payments/stripe/connect/onboard-redirect should return 302 to Stripe"""
        response = requests.get(
            f"{BASE_URL}/api/payments/stripe/connect/onboard-redirect",
            params={"token": auth_token},
            allow_redirects=False
        )
        
        assert response.status_code == 302, f"Expected 302, got {response.status_code}"
        location = response.headers.get("location", "")
        assert "connect.stripe.com" in location, f"Expected redirect to connect.stripe.com, got: {location}"
        print(f"✓ Connect onboard redirect -> {location[:80]}...")
    
    def test_connect_onboard_redirect_invalid_token(self):
        """GET /api/payments/stripe/connect/onboard-redirect with invalid token should fail"""
        response = requests.get(
            f"{BASE_URL}/api/payments/stripe/connect/onboard-redirect",
            params={"token": "invalid_token"},
            allow_redirects=False
        )
        
        # Should return 401 Unauthorized
        assert response.status_code == 401, f"Expected 401 for invalid token, got {response.status_code}"
    
    def test_connect_onboard_post_returns_json(self, auth_token):
        """POST /api/payments/stripe/connect/onboard should return JSON with url (backward compat)"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/connect/onboard",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "url" in data, f"Expected 'url' in response, got: {data}"
        assert "connect.stripe.com" in data["url"], f"Expected Stripe URL, got: {data['url']}"
        print(f"✓ Connect onboard POST -> {data['url'][:80]}...")


class TestSubscriptionCheckoutRedirect:
    """Test subscription checkout-redirect endpoints (GET)"""
    
    @pytest.mark.parametrize("tier,expected_price", [
        ("bronze", "$4.99"),
        ("silver", "$9.99"),
        ("gold", "$14.99"),
        ("diamond", "$29.99"),
    ])
    def test_checkout_redirect_tiers(self, auth_token, tier, expected_price):
        """GET /api/subscriptions/checkout-redirect for each tier should return 302 to Stripe"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/checkout-redirect",
            params={
                "tier": tier,
                "success_url": "https://blendlink.net/ok",
                "cancel_url": "https://blendlink.net",
                "token": auth_token
            },
            allow_redirects=False
        )
        
        assert response.status_code == 302, f"Expected 302 for {tier}, got {response.status_code}"
        location = response.headers.get("location", "")
        assert "checkout.stripe.com" in location, f"Expected redirect to checkout.stripe.com for {tier}, got: {location}"
        print(f"✓ {tier.capitalize()} checkout redirect -> {location[:60]}...")
    
    def test_checkout_redirect_invalid_tier(self, auth_token):
        """GET /api/subscriptions/checkout-redirect with invalid tier should return 400"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/checkout-redirect",
            params={
                "tier": "invalid_tier",
                "success_url": "https://blendlink.net/ok",
                "cancel_url": "https://blendlink.net",
                "token": auth_token
            },
            allow_redirects=False
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid tier, got {response.status_code}"
    
    def test_checkout_redirect_missing_token(self):
        """GET /api/subscriptions/checkout-redirect without token should return 422"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/checkout-redirect",
            params={
                "tier": "bronze",
                "success_url": "https://blendlink.net/ok",
                "cancel_url": "https://blendlink.net"
                # No token provided
            },
            allow_redirects=False
        )
        
        # FastAPI returns 422 for missing required query parameters
        assert response.status_code == 422, f"Expected 422 for missing token, got {response.status_code}"


class TestSubscriptionCheckoutPost:
    """Test subscription checkout POST endpoint (backward compatibility)"""
    
    def test_checkout_post_returns_json(self, auth_token):
        """POST /api/subscriptions/checkout should return JSON with checkout_url"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout",
            params={
                "tier": "bronze",
                "success_url": "https://blendlink.net/ok",
                "cancel_url": "https://blendlink.net"
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {auth_token}"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "checkout_url" in data, f"Expected 'checkout_url' in response, got: {data}"
        assert "checkout.stripe.com" in data["checkout_url"], f"Expected Stripe checkout URL, got: {data['checkout_url']}"
        assert "session_id" in data, f"Expected 'session_id' in response, got: {data}"
        print(f"✓ Checkout POST -> session_id: {data['session_id'][:40]}...")


class TestStripeConnectStatus:
    """Test Stripe Connect status endpoint"""
    
    def test_connect_status(self, auth_token):
        """GET /api/payments/stripe/connect/status should return connection status"""
        response = requests.get(
            f"{BASE_URL}/api/payments/stripe/connect/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check expected fields
        assert "is_connected" in data, f"Expected 'is_connected' in response"
        assert "charges_enabled" in data, f"Expected 'charges_enabled' in response"
        assert "payouts_enabled" in data, f"Expected 'payouts_enabled' in response"
        
        print(f"✓ Connect status: is_connected={data['is_connected']}, charges_enabled={data['charges_enabled']}")


class TestSubscriptionTiers:
    """Test subscription tiers endpoint"""
    
    def test_get_subscription_tiers(self):
        """GET /api/subscriptions/tiers should return all tier info"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "tiers" in data, "Expected 'tiers' in response"
        tiers = data["tiers"]
        
        # Verify all expected tiers exist
        expected_tiers = ["free", "bronze", "silver", "gold", "diamond"]
        for tier in expected_tiers:
            assert tier in tiers, f"Expected tier '{tier}' in response"
            assert "price_monthly" in tiers[tier], f"Expected 'price_monthly' for tier {tier}"
        
        # Verify prices
        assert tiers["bronze"]["price_monthly"] == 4.99
        assert tiers["silver"]["price_monthly"] == 9.99
        assert tiers["gold"]["price_monthly"] == 14.99
        assert tiers["diamond"]["price_monthly"] == 29.99
        
        print("✓ All subscription tiers present with correct prices")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
