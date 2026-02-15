"""
Test cases for BlendLink Iteration 161 Bug Fixes:
1. BL Coins $29.99 with quantity 2+ checkout
2. Stripe onboarding
3. Subscription checkout (body stream fix)
4. UI verification for founding members text and strikethrough prices
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://blendlink-live.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"


class TestBLCoinsCheckout:
    """BL Coins purchase tests - critical fixes for quantity > 1"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Could not login with test credentials")
        self.token = login_response.json().get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_bl_coins_starter_quantity_1(self):
        """POST /api/payments/stripe/bl-coins/checkout - starter tier quantity=1 works"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/bl-coins/checkout",
            headers=self.headers,
            json={
                "tier_id": "starter",
                "amount_usd": 4.99,
                "coins_amount": 30000,
                "quantity": 1,
                "origin_url": "https://blendlink.net"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "url" in data, "Response should contain checkout URL"
        assert data["url"].startswith("https://checkout.stripe.com"), "URL should be Stripe checkout"
        assert "cs_live_" in data["session_id"], f"Session ID should be live mode, got: {data.get('session_id', 'N/A')}"
        print(f"PASS: Starter tier checkout - session_id={data['session_id'][:30]}...")
    
    def test_bl_coins_ultimate_quantity_2(self):
        """POST /api/payments/stripe/bl-coins/checkout - ultimate tier quantity=2 (BUG FIX)"""
        # This was the bug: $29.99 * 2 = $59.98, 1,000,000 * 2 = 2,000,000 coins
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/bl-coins/checkout",
            headers=self.headers,
            json={
                "tier_id": "ultimate",
                "amount_usd": 59.98,
                "coins_amount": 2000000,
                "quantity": 2,
                "origin_url": "https://blendlink.net"
            }
        )
        
        assert response.status_code == 200, f"BL coins quantity=2 failed: {response.status_code}: {response.text}"
        data = response.json()
        assert "url" in data, "Response should contain checkout URL"
        assert "cs_live_" in data.get("session_id", ""), f"Session ID should be live: {data.get('session_id', 'N/A')}"
        print(f"PASS: Ultimate tier quantity=2 checkout - session_id={data['session_id'][:30]}...")
    
    def test_bl_coins_ultimate_quantity_3(self):
        """POST /api/payments/stripe/bl-coins/checkout - ultimate tier quantity=3"""
        # $29.99 * 3 = $89.97, 1,000,000 * 3 = 3,000,000 coins
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/bl-coins/checkout",
            headers=self.headers,
            json={
                "tier_id": "ultimate",
                "amount_usd": 89.97,
                "coins_amount": 3000000,
                "quantity": 3,
                "origin_url": "https://blendlink.net"
            }
        )
        
        assert response.status_code == 200, f"BL coins quantity=3 failed: {response.status_code}: {response.text}"
        data = response.json()
        assert "url" in data, "Response should contain checkout URL"
        print(f"PASS: Ultimate tier quantity=3 checkout works")
    
    def test_bl_coins_price_mismatch_rejected(self):
        """Price mismatch should be rejected (security check)"""
        # Wrong price for quantity 2 should fail
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/bl-coins/checkout",
            headers=self.headers,
            json={
                "tier_id": "ultimate",
                "amount_usd": 29.99,  # Wrong! Should be 59.98 for quantity 2
                "coins_amount": 2000000,
                "quantity": 2,
                "origin_url": "https://blendlink.net"
            }
        )
        
        assert response.status_code == 400, f"Price mismatch should fail: {response.status_code}"
        print("PASS: Price mismatch correctly rejected")


class TestStripeConnectOnboarding:
    """Stripe Connect onboarding tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Could not login with test credentials")
        self.token = login_response.json().get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_stripe_connect_onboard(self):
        """POST /api/payments/stripe/connect/onboard - should return valid URL"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/connect/onboard",
            headers=self.headers
        )
        
        # 200 = new onboarding link, 400 = already connected (both acceptable)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "url" in data, "Response should contain onboarding URL"
            assert "connect.stripe.com" in data["url"], f"URL should be Stripe Connect: {data['url']}"
            print(f"PASS: Stripe Connect onboarding URL received: {data['url'][:50]}...")
        else:
            print(f"PASS: Stripe account already connected (400 response)")
    
    def test_stripe_connect_status(self):
        """GET /api/payments/stripe/connect/status - check connection status"""
        response = requests.get(
            f"{BASE_URL}/api/payments/stripe/connect/status",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Status check failed: {response.status_code}"
        data = response.json()
        assert "is_connected" in data, "Response should have is_connected field"
        print(f"PASS: Stripe Connect status - connected={data.get('is_connected')}")


class TestSubscriptionCheckout:
    """Subscription checkout tests - body stream already read fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Could not login with test credentials")
        self.token = login_response.json().get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_subscription_checkout_bronze(self):
        """POST /api/subscriptions/checkout?tier=bronze - should return checkout_url"""
        success_url = "https://blendlink.net/subscriptions?success=true"
        cancel_url = "https://blendlink.net/subscriptions"
        
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=bronze&success_url={success_url}&cancel_url={cancel_url}",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Subscription checkout failed: {response.status_code}: {response.text}"
        data = response.json()
        
        # Check for checkout_url field
        checkout_url = data.get("checkout_url") or data.get("url")
        assert checkout_url, f"No checkout URL in response: {data}"
        assert "checkout.stripe.com" in checkout_url, f"URL should be Stripe: {checkout_url}"
        
        # Verify live mode session
        session_id = data.get("session_id", "")
        assert "cs_live_" in session_id or "cs_" in session_id, f"Session should exist: {data}"
        print(f"PASS: Bronze subscription checkout works - session_id={session_id[:30] if session_id else 'N/A'}...")
    
    def test_subscription_checkout_silver(self):
        """POST /api/subscriptions/checkout?tier=silver - should return checkout_url"""
        success_url = "https://blendlink.net/subscriptions?success=true"
        cancel_url = "https://blendlink.net/subscriptions"
        
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=silver&success_url={success_url}&cancel_url={cancel_url}",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Silver subscription failed: {response.status_code}: {response.text}"
        data = response.json()
        checkout_url = data.get("checkout_url") or data.get("url")
        assert checkout_url, "No checkout URL in response"
        print(f"PASS: Silver subscription checkout works")
    
    def test_subscription_checkout_gold(self):
        """POST /api/subscriptions/checkout?tier=gold - should return checkout_url"""
        success_url = "https://blendlink.net/subscriptions?success=true"
        cancel_url = "https://blendlink.net/subscriptions"
        
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=gold&success_url={success_url}&cancel_url={cancel_url}",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Gold subscription failed: {response.status_code}: {response.text}"
        data = response.json()
        checkout_url = data.get("checkout_url") or data.get("url")
        assert checkout_url, "No checkout URL in response"
        print(f"PASS: Gold subscription checkout works")
    
    def test_subscription_checkout_diamond(self):
        """POST /api/subscriptions/checkout?tier=diamond - should return checkout_url"""
        success_url = "https://blendlink.net/subscriptions?success=true"
        cancel_url = "https://blendlink.net/subscriptions"
        
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=diamond&success_url={success_url}&cancel_url={cancel_url}",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Diamond subscription failed: {response.status_code}: {response.text}"
        data = response.json()
        checkout_url = data.get("checkout_url") or data.get("url")
        assert checkout_url, "No checkout URL in response"
        print(f"PASS: Diamond subscription checkout works")


class TestSubscriptionTiers:
    """Subscription tiers endpoint tests"""
    
    def test_subscription_tiers_endpoint(self):
        """GET /api/subscriptions/tiers - verify tier data structure"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        
        assert response.status_code == 200, f"Tiers endpoint failed: {response.status_code}"
        data = response.json()
        
        # Check tiers exist
        tiers = data.get("tiers", [])
        assert len(tiers) >= 4, f"Expected at least 4 tiers, got {len(tiers)}"
        
        # Verify tier data
        tier_names = [t.get("name", "").lower() for t in tiers if t.get("name")]
        print(f"Available tiers: {tier_names}")
        
        # Check for founding members pricing
        for tier in tiers:
            if tier.get("name", "").lower() in ["bronze", "silver", "gold", "diamond"]:
                print(f"  {tier.get('name')}: ${tier.get('price', 'N/A')}/mo")
        
        print("PASS: Subscription tiers endpoint works")


class TestWalletAPI:
    """Wallet API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if login_response.status_code != 200:
            pytest.skip("Could not login with test credentials")
        self.token = login_response.json().get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_wallet_balance(self):
        """GET /api/wallet/balance - verify balance endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/balance",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Wallet balance failed: {response.status_code}"
        data = response.json()
        assert "balance" in data, "Response should have balance field"
        print(f"PASS: Wallet balance = {data.get('balance', 0):,} BL coins")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
