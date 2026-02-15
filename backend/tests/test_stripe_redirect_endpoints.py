"""
Test GET redirect endpoints for Stripe - iteration 165
These endpoints bypass JSON body parsing by returning 302 redirects directly to Stripe

Testing:
- GET /api/subscriptions/checkout-redirect?tier={tier}&success_url=...&cancel_url=...&token=...
- GET /api/payments/stripe/connect/onboard-redirect?token=...
- POST /api/subscriptions/checkout (backward compatibility)
- POST /api/payments/stripe/connect/onboard (backward compatibility)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://blendlink-live.preview.emergentagent.com').rstrip('/')


class TestStripeRedirectEndpoints:
    """Test GET redirect endpoints for Stripe integration"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "tester@blendlink.net", "password": "BlendLink2024!"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    def test_subscription_checkout_redirect_bronze(self, auth_token):
        """Test GET /api/subscriptions/checkout-redirect?tier=bronze returns 302 to checkout.stripe.com"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/checkout-redirect",
            params={
                "tier": "bronze",
                "success_url": f"{BASE_URL}/wallet?success=true",
                "cancel_url": f"{BASE_URL}/wallet",
                "token": auth_token
            },
            allow_redirects=False
        )
        
        assert response.status_code == 302, f"Expected 302 redirect, got {response.status_code}"
        location = response.headers.get("Location", "")
        assert "checkout.stripe.com" in location, f"Expected redirect to checkout.stripe.com, got: {location}"
        print(f"✅ Bronze checkout redirect: {location[:80]}...")
    
    def test_subscription_checkout_redirect_diamond(self, auth_token):
        """Test GET /api/subscriptions/checkout-redirect?tier=diamond returns 302 to checkout.stripe.com"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/checkout-redirect",
            params={
                "tier": "diamond",
                "success_url": f"{BASE_URL}/wallet?success=true",
                "cancel_url": f"{BASE_URL}/wallet",
                "token": auth_token
            },
            allow_redirects=False
        )
        
        assert response.status_code == 302, f"Expected 302 redirect, got {response.status_code}"
        location = response.headers.get("Location", "")
        assert "checkout.stripe.com" in location, f"Expected redirect to checkout.stripe.com, got: {location}"
        print(f"✅ Diamond checkout redirect: {location[:80]}...")
    
    def test_subscription_checkout_redirect_silver(self, auth_token):
        """Test GET /api/subscriptions/checkout-redirect?tier=silver returns 302"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/checkout-redirect",
            params={
                "tier": "silver",
                "success_url": f"{BASE_URL}/wallet?success=true",
                "cancel_url": f"{BASE_URL}/wallet",
                "token": auth_token
            },
            allow_redirects=False
        )
        
        assert response.status_code == 302, f"Expected 302, got {response.status_code}"
        location = response.headers.get("Location", "")
        assert "checkout.stripe.com" in location or "cs_live" in location
        print(f"✅ Silver checkout redirect working")
    
    def test_subscription_checkout_redirect_gold(self, auth_token):
        """Test GET /api/subscriptions/checkout-redirect?tier=gold returns 302"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/checkout-redirect",
            params={
                "tier": "gold",
                "success_url": f"{BASE_URL}/wallet?success=true",
                "cancel_url": f"{BASE_URL}/wallet",
                "token": auth_token
            },
            allow_redirects=False
        )
        
        assert response.status_code == 302, f"Expected 302, got {response.status_code}"
        location = response.headers.get("Location", "")
        assert "checkout.stripe.com" in location or "cs_live" in location
        print(f"✅ Gold checkout redirect working")
    
    def test_stripe_connect_onboard_redirect(self, auth_token):
        """Test GET /api/payments/stripe/connect/onboard-redirect returns 302 to connect.stripe.com"""
        response = requests.get(
            f"{BASE_URL}/api/payments/stripe/connect/onboard-redirect",
            params={"token": auth_token},
            allow_redirects=False
        )
        
        assert response.status_code == 302, f"Expected 302 redirect, got {response.status_code}"
        location = response.headers.get("Location", "")
        assert "connect.stripe.com" in location, f"Expected redirect to connect.stripe.com, got: {location}"
        print(f"✅ Stripe Connect onboard redirect: {location[:80]}...")
    
    def test_post_subscription_checkout_backward_compat(self, auth_token):
        """Test original POST /api/subscriptions/checkout still works (backward compatibility)"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout",
            params={
                "tier": "bronze",
                "success_url": f"{BASE_URL}/wallet?success=true",
                "cancel_url": f"{BASE_URL}/wallet"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "checkout_url" in data, "No checkout_url in response"
        assert "checkout.stripe.com" in data["checkout_url"], "Invalid checkout URL"
        print(f"✅ POST checkout backward compat working: {data['checkout_url'][:50]}...")
    
    def test_post_stripe_connect_onboard_backward_compat(self, auth_token):
        """Test original POST /api/payments/stripe/connect/onboard still works"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/connect/onboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "url" in data, "No url in response"
        assert "connect.stripe.com" in data["url"], "Invalid connect URL"
        print(f"✅ POST connect onboard backward compat working: {data['url'][:50]}...")
    
    def test_invalid_tier_returns_400(self, auth_token):
        """Test invalid tier returns 400 error"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/checkout-redirect",
            params={
                "tier": "invalid_tier",
                "success_url": f"{BASE_URL}/wallet?success=true",
                "cancel_url": f"{BASE_URL}/wallet",
                "token": auth_token
            },
            allow_redirects=False
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid tier, got {response.status_code}"
        print("✅ Invalid tier correctly returns 400")
    
    def test_missing_token_returns_401(self):
        """Test missing token returns 401 error"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/checkout-redirect",
            params={
                "tier": "bronze",
                "success_url": f"{BASE_URL}/wallet?success=true",
                "cancel_url": f"{BASE_URL}/wallet"
            },
            allow_redirects=False
        )
        
        # Should return 422 (missing required param) or 401 (invalid token)
        assert response.status_code in [401, 422], f"Expected 401 or 422, got {response.status_code}"
        print("✅ Missing token correctly returns error")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
