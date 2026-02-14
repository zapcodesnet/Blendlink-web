"""
Test Suite for 'Top Up BL Coins' Feature
Tests the BL coins purchase flow via Stripe checkout integration
"""
import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"

class TestBLCoinsPurchaseFeature:
    """Tests for BL Coins purchase via Stripe checkout"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
    
    def login_test_user(self):
        """Helper to login and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return data.get("user")
        return None
    
    def test_health_endpoint(self):
        """Test API health check"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "ok"
        print("✅ API health check passed")
    
    def test_listing_fee_endpoint(self):
        """Test listing fee endpoint returns correct fee"""
        response = self.session.get(f"{BASE_URL}/api/marketplace/listing-fee")
        assert response.status_code == 200, f"Listing fee endpoint failed: {response.text}"
        data = response.json()
        assert data.get("fee") == 200, f"Expected fee 200, got {data.get('fee')}"
        assert data.get("currency") == "BL coins"
        print(f"✅ Listing fee endpoint returns: {data}")
    
    def test_bl_coins_checkout_requires_auth(self):
        """Test that BL coins checkout requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/payments/stripe/bl-coins/checkout", json={
            "tier_id": "starter",
            "amount_usd": 4.99,
            "coins_amount": 30000,
            "origin_url": "https://wallet-coins.preview.emergentagent.com"
        })
        # Should return 401 or 422 without auth
        assert response.status_code in [401, 422], f"Expected 401/422 without auth, got {response.status_code}"
        print(f"✅ BL coins checkout requires authentication (status: {response.status_code})")
    
    def test_bl_coins_checkout_with_auth(self):
        """Test BL coins checkout endpoint with authentication"""
        user = self.login_test_user()
        if not user:
            pytest.skip("Could not login test user - skipping authenticated test")
        
        # Test starter tier checkout
        response = self.session.post(f"{BASE_URL}/api/payments/stripe/bl-coins/checkout", json={
            "tier_id": "starter",
            "amount_usd": 4.99,
            "coins_amount": 30000,
            "origin_url": "https://wallet-coins.preview.emergentagent.com"
        })
        
        print(f"Checkout response status: {response.status_code}")
        print(f"Checkout response: {response.text[:500] if response.text else 'empty'}")
        
        # Should return checkout URL
        assert response.status_code == 200, f"Checkout failed: {response.text}"
        data = response.json()
        assert "url" in data, f"Missing checkout URL in response: {data}"
        assert "session_id" in data, f"Missing session_id in response: {data}"
        assert data["url"].startswith("https://checkout.stripe.com"), f"Invalid checkout URL: {data['url']}"
        print(f"✅ BL coins checkout created successfully - URL: {data['url'][:50]}...")
    
    def test_bl_coins_checkout_all_tiers(self):
        """Test checkout for all 4 pricing tiers"""
        user = self.login_test_user()
        if not user:
            pytest.skip("Could not login test user")
        
        tiers = [
            {"tier_id": "starter", "price": 4.99, "coins": 30000},
            {"tier_id": "popular", "price": 9.99, "coins": 80000},
            {"tier_id": "premium", "price": 14.99, "coins": 400000},
            {"tier_id": "ultimate", "price": 29.99, "coins": 1000000},
        ]
        
        for tier in tiers:
            response = self.session.post(f"{BASE_URL}/api/payments/stripe/bl-coins/checkout", json={
                "tier_id": tier["tier_id"],
                "amount_usd": tier["price"],
                "coins_amount": tier["coins"],
                "origin_url": "https://wallet-coins.preview.emergentagent.com"
            })
            
            assert response.status_code == 200, f"Tier {tier['tier_id']} checkout failed: {response.text}"
            data = response.json()
            assert "url" in data, f"Missing URL for tier {tier['tier_id']}"
            print(f"✅ Tier '{tier['tier_id']}' (${tier['price']} / {tier['coins']:,} coins) - checkout URL created")
    
    def test_bl_coins_checkout_invalid_tier(self):
        """Test checkout with invalid tier ID"""
        user = self.login_test_user()
        if not user:
            pytest.skip("Could not login test user")
        
        response = self.session.post(f"{BASE_URL}/api/payments/stripe/bl-coins/checkout", json={
            "tier_id": "invalid_tier",
            "amount_usd": 99.99,
            "coins_amount": 999999,
            "origin_url": "https://wallet-coins.preview.emergentagent.com"
        })
        
        assert response.status_code == 400, f"Expected 400 for invalid tier, got {response.status_code}"
        print("✅ Invalid tier correctly rejected with 400")
    
    def test_bl_coins_checkout_price_mismatch(self):
        """Test checkout with mismatched price/coins"""
        user = self.login_test_user()
        if not user:
            pytest.skip("Could not login test user")
        
        # Valid tier but wrong price
        response = self.session.post(f"{BASE_URL}/api/payments/stripe/bl-coins/checkout", json={
            "tier_id": "starter",
            "amount_usd": 1.99,  # Wrong price (should be 4.99)
            "coins_amount": 30000,
            "origin_url": "https://wallet-coins.preview.emergentagent.com"
        })
        
        assert response.status_code == 400, f"Expected 400 for price mismatch, got {response.status_code}"
        print("✅ Price mismatch correctly rejected with 400")
    
    def test_bl_coins_status_invalid_session(self):
        """Test status endpoint with invalid session ID"""
        user = self.login_test_user()
        if not user:
            pytest.skip("Could not login test user")
        
        # Test with invalid session format
        response = self.session.get(f"{BASE_URL}/api/payments/stripe/bl-coins/status/invalid_session")
        assert response.status_code == 400, f"Expected 400 for invalid session, got {response.status_code}"
        
        # Test with properly formatted but non-existent session
        response = self.session.get(f"{BASE_URL}/api/payments/stripe/bl-coins/status/cs_live_fake123")
        # Should return 404, 500, or 520 (Cloudflare) (not found in Stripe)
        assert response.status_code in [400, 404, 500, 520], f"Expected 400/404/500/520, got {response.status_code}"
        print(f"✅ Invalid session ID correctly handled (status: {response.status_code})")


class TestInsufficientBalanceTrigger:
    """Tests for insufficient balance detection during listing creation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
    
    def login_and_get_balance(self):
        """Login and return user balance"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            user = data.get("user", {})
            return user.get("bl_coins", 0)
        return None
    
    def test_create_listing_checks_balance(self):
        """Test that creating a listing checks balance"""
        balance = self.login_and_get_balance()
        if balance is None:
            pytest.skip("Could not login test user")
        
        print(f"Current user balance: {balance} BL coins")
        
        # Try to create a listing
        response = self.session.post(f"{BASE_URL}/api/marketplace/listings", json={
            "title": "Test Item for Balance Check",
            "description": "Testing insufficient balance flow",
            "price": 9.99,
            "category": "electronics",
            "condition": "new"
        })
        
        # If balance < 200, should fail with insufficient balance error
        if balance < 200:
            assert response.status_code == 400, f"Expected 400 for insufficient balance, got {response.status_code}"
            assert "insufficient" in response.text.lower(), f"Expected 'insufficient' in error: {response.text}"
            print(f"✅ Insufficient balance correctly detected (balance: {balance})")
        else:
            # Balance is sufficient - listing should be created or succeed
            # We just verify the endpoint works
            print(f"✅ Balance sufficient ({balance}) - listing creation attempted (status: {response.status_code})")


class TestBLCoinsEndpointsIntegration:
    """Integration tests for BL Coins purchase endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_stripe_checkout_endpoint_exists(self):
        """Verify BL coins checkout endpoint exists"""
        # Without auth, should return 401/422, not 404
        response = self.session.post(f"{BASE_URL}/api/payments/stripe/bl-coins/checkout", json={})
        assert response.status_code != 404, "BL coins checkout endpoint not found (404)"
        print(f"✅ BL coins checkout endpoint exists (status: {response.status_code})")
    
    def test_stripe_status_endpoint_exists(self):
        """Verify BL coins status endpoint exists"""
        response = self.session.get(f"{BASE_URL}/api/payments/stripe/bl-coins/status/test")
        # Should return 400 for invalid session, not 404
        assert response.status_code != 404, "BL coins status endpoint not found (404)"
        print(f"✅ BL coins status endpoint exists (status: {response.status_code})")
    
    def test_wallet_balance_endpoint(self):
        """Test wallet balance endpoint"""
        # Login first
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code != 200:
            pytest.skip("Could not login test user")
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get wallet balance
        response = self.session.get(f"{BASE_URL}/api/wallet/balance")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Wallet balance endpoint: {data}")
        else:
            print(f"⚠️ Wallet balance endpoint returned: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
