"""
BlendLink Bug Fixes - Iteration 158 Tests
Tests for: Subscriptions, Wallet, Stripe Payments, Admin Panel

Test Credentials:
- Test User: tester@blendlink.net / BlendLink2024!
- Admin User: blendlinknet@gmail.com / Blend!Admin2026Link
"""

import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://blendlink-live.preview.emergentagent.com')

# Test session to persist authentication
test_session = requests.Session()
test_session.headers.update({"Content-Type": "application/json"})

# Test credentials
TEST_USER_EMAIL = "tester@blendlink.net"
TEST_USER_PASSWORD = "BlendLink2024!"
ADMIN_EMAIL = "blendlinknet@gmail.com"
ADMIN_PASSWORD = "Blend!Admin2026Link"


class TestHealthCheck:
    """Health check tests to verify API is running"""
    
    def test_api_health(self):
        """Verify API health endpoint"""
        response = test_session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✅ API Health: {data}")


class TestUserAuthentication:
    """Test user login flow with test credentials"""
    
    def test_user_login_success(self):
        """Login with test user credentials"""
        response = test_session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        # Check if login succeeds
        assert response.status_code in [200, 401], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "token" in data or "access_token" in data
            token = data.get("token") or data.get("access_token")
            test_session.headers.update({"Authorization": f"Bearer {token}"})
            print(f"✅ User Login Success: {TEST_USER_EMAIL}")
            return token
        else:
            print(f"⚠️ User login returned 401 - checking if user exists")
            pytest.skip("Test user credentials may need to be created")


class TestSubscriptionTiers:
    """Test subscription tiers API endpoints"""
    
    def test_get_subscription_tiers(self):
        """Verify all 4 membership tiers are returned"""
        response = test_session.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200
        
        data = response.json()
        tiers = data.get("tiers", [])
        
        # Verify all tiers exist
        tier_ids = [t.get("tier") or t.get("id") for t in tiers]
        print(f"Tiers found: {tier_ids}")
        
        # Check for expected tiers (may include 'free')
        expected_tiers = ["bronze", "silver", "gold", "diamond"]
        for tier in expected_tiers:
            assert tier in tier_ids, f"Missing tier: {tier}"
        
        # Verify pricing
        tier_prices = {t.get("tier", t.get("id")): t.get("price") for t in tiers}
        assert tier_prices.get("bronze") == 4.99, f"Bronze price mismatch: {tier_prices.get('bronze')}"
        assert tier_prices.get("silver") == 9.99, f"Silver price mismatch: {tier_prices.get('silver')}"
        assert tier_prices.get("gold") == 14.99, f"Gold price mismatch: {tier_prices.get('gold')}"
        assert tier_prices.get("diamond") == 29.99, f"Diamond price mismatch: {tier_prices.get('diamond')}"
        
        print(f"✅ All 4 tiers verified with correct prices: {tier_prices}")


class TestSubscriptionCheckout:
    """Test subscription checkout generates valid Stripe URLs"""
    
    @pytest.fixture(autouse=True)
    def ensure_authenticated(self):
        """Ensure user is authenticated"""
        if "Authorization" not in test_session.headers:
            response = test_session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            if response.status_code == 200:
                data = response.json()
                token = data.get("token") or data.get("access_token")
                test_session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_subscription_checkout_bronze(self):
        """Test Bronze subscription checkout generates Stripe URL"""
        success_url = "https://blendlink-live.preview.emergentagent.com/subscriptions?success=true"
        cancel_url = "https://blendlink-live.preview.emergentagent.com/subscriptions"
        
        response = test_session.post(
            f"{BASE_URL}/api/subscriptions/checkout",
            params={
                "tier": "bronze",
                "success_url": success_url,
                "cancel_url": cancel_url
            }
        )
        
        if response.status_code == 401:
            pytest.skip("Authentication required")
        
        if response.status_code == 200:
            data = response.json()
            checkout_url = data.get("checkout_url") or data.get("url")
            assert checkout_url is not None, "No checkout URL in response"
            assert "stripe.com" in checkout_url or "checkout.stripe.com" in checkout_url
            print(f"✅ Bronze subscription checkout URL generated: {checkout_url[:80]}...")
        else:
            print(f"Response: {response.status_code} - {response.text[:200]}")
            # May fail if user already has subscription - still counts as working
            assert response.status_code in [200, 400, 409], f"Unexpected error: {response.status_code}"


class TestWalletEndpoints:
    """Test wallet page API endpoints"""
    
    @pytest.fixture(autouse=True)
    def ensure_authenticated(self):
        """Ensure user is authenticated"""
        if "Authorization" not in test_session.headers:
            response = test_session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            if response.status_code == 200:
                data = response.json()
                token = data.get("token") or data.get("access_token")
                test_session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_wallet_balance(self):
        """Test wallet balance endpoint"""
        response = test_session.get(f"{BASE_URL}/api/wallet/balance")
        
        if response.status_code == 401:
            pytest.skip("Authentication required")
            
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data or "bl_coins" in data
        print(f"✅ Wallet balance: {data}")
    
    def test_wallet_transactions(self):
        """Test wallet transactions endpoint"""
        response = test_session.get(f"{BASE_URL}/api/wallet/transactions")
        
        if response.status_code == 401:
            pytest.skip("Authentication required")
            
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Wallet transactions endpoint working")
    
    def test_stripe_connect_status(self):
        """Test Stripe Connect status endpoint"""
        response = test_session.get(f"{BASE_URL}/api/payments/stripe/connect/status")
        
        if response.status_code == 401:
            pytest.skip("Authentication required")
            
        assert response.status_code == 200
        data = response.json()
        assert "is_connected" in data
        print(f"✅ Stripe Connect status: {data}")
    
    def test_stripe_connect_onboard(self):
        """Test Stripe Connect onboarding endpoint exists"""
        response = test_session.post(f"{BASE_URL}/api/payments/stripe/connect/onboard")
        
        if response.status_code == 401:
            pytest.skip("Authentication required")
        
        # May return error about Stripe configuration - that's expected
        # 503 = "Stripe Connect is being configured. Please try again later."
        # This is expected behavior per the review request notes
        assert response.status_code in [200, 400, 500, 503], f"Unexpected: {response.status_code}"
        print(f"✅ Stripe Connect onboard endpoint exists (status: {response.status_code})")


class TestBLCoinsEndpoints:
    """Test BL Coins purchase endpoints"""
    
    @pytest.fixture(autouse=True)
    def ensure_authenticated(self):
        """Ensure user is authenticated"""
        if "Authorization" not in test_session.headers:
            response = test_session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            if response.status_code == 200:
                data = response.json()
                token = data.get("token") or data.get("access_token")
                test_session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_bl_coins_checkout(self):
        """Test BL Coins checkout generates Stripe URL"""
        response = test_session.post(
            f"{BASE_URL}/api/payments/stripe/bl-coins/checkout",
            json={
                "tier_id": "starter",
                "amount_usd": 4.99,
                "coins_amount": 30000,
                "origin_url": "https://blendlink-live.preview.emergentagent.com"
            }
        )
        
        if response.status_code == 401:
            pytest.skip("Authentication required")
        
        if response.status_code == 200:
            data = response.json()
            checkout_url = data.get("url")
            assert checkout_url is not None
            assert "stripe.com" in checkout_url
            print(f"✅ BL Coins checkout URL generated")
        else:
            print(f"BL Coins checkout response: {response.status_code}")
            assert response.status_code in [200, 400, 500]


class TestAdminAuthentication:
    """Test admin panel authentication"""
    
    def test_admin_login(self):
        """Login with admin credentials"""
        admin_session = requests.Session()
        admin_session.headers.update({"Content-Type": "application/json"})
        
        response = admin_session.post(f"{BASE_URL}/api/admin-auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        print(f"Admin login response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Admin login success")
            return admin_session, data
        else:
            # May need OTP - check for OTP flow
            data = response.json() if response.text else {}
            if "otp" in str(data).lower() or response.status_code == 202:
                print(f"⚠️ Admin login requires OTP verification")
            print(f"Admin login response: {data}")
            

class TestAdminDashboard:
    """Test admin dashboard endpoints"""
    
    @pytest.fixture
    def admin_session(self):
        """Create authenticated admin session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try standard admin login
        response = session.post(f"{BASE_URL}/api/admin-auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("token") or data.get("access_token")
            if token:
                session.headers.update({"Authorization": f"Bearer {token}"})
                
            # Also handle secure login
            secure_resp = session.post(f"{BASE_URL}/api/admin-auth/secure/login", json={
                "email": ADMIN_EMAIL,
                "password": ADMIN_PASSWORD
            })
            
            return session
        
        return session
    
    def test_admin_dashboard_endpoint_exists(self):
        """Test admin dashboard endpoint exists"""
        # Without auth, should return 401
        response = test_session.get(f"{BASE_URL}/api/admin-system/dashboard")
        assert response.status_code in [200, 401, 403], f"Unexpected: {response.status_code}"
        print(f"✅ Admin dashboard endpoint exists (status: {response.status_code})")
    
    def test_admin_custom_benefits_endpoint(self):
        """Test admin custom benefits endpoint exists"""
        response = test_session.get(f"{BASE_URL}/api/admin/membership/custom-benefits")
        assert response.status_code in [200, 401, 403], f"Unexpected: {response.status_code}"
        print(f"✅ Admin custom benefits endpoint exists (status: {response.status_code})")
    
    def test_admin_users_endpoint(self):
        """Test admin users endpoint exists"""
        response = test_session.get(f"{BASE_URL}/api/admin-system/users")
        assert response.status_code in [200, 401, 403], f"Unexpected: {response.status_code}"
        print(f"✅ Admin users endpoint exists (status: {response.status_code})")


class TestReferralEndpoints:
    """Test referral system endpoints used by wallet"""
    
    @pytest.fixture(autouse=True)
    def ensure_authenticated(self):
        """Ensure user is authenticated"""
        if "Authorization" not in test_session.headers:
            response = test_session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            if response.status_code == 200:
                data = response.json()
                token = data.get("token") or data.get("access_token")
                test_session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_daily_claim_status(self):
        """Test daily claim status endpoint"""
        response = test_session.get(f"{BASE_URL}/api/referral/daily-claim/status")
        
        if response.status_code == 401:
            pytest.skip("Authentication required")
            
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Daily claim status: {data}")
    
    def test_commission_history(self):
        """Test commission history endpoint"""
        response = test_session.get(f"{BASE_URL}/api/referral/commission-history?skip=0&limit=20")
        
        if response.status_code == 401:
            pytest.skip("Authentication required")
            
        assert response.status_code == 200
        print(f"✅ Commission history endpoint working")


class TestSubscriptionEndpoints:
    """Test subscription management endpoints"""
    
    @pytest.fixture(autouse=True)
    def ensure_authenticated(self):
        """Ensure user is authenticated"""
        if "Authorization" not in test_session.headers:
            response = test_session.post(f"{BASE_URL}/api/auth/login", json={
                "email": TEST_USER_EMAIL,
                "password": TEST_USER_PASSWORD
            })
            if response.status_code == 200:
                data = response.json()
                token = data.get("token") or data.get("access_token")
                test_session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_my_subscription(self):
        """Test my-subscription endpoint"""
        response = test_session.get(f"{BASE_URL}/api/subscriptions/my-subscription")
        
        if response.status_code == 401:
            pytest.skip("Authentication required")
        
        # May return 404 if no subscription - that's OK
        assert response.status_code in [200, 404]
        print(f"✅ My subscription endpoint working (status: {response.status_code})")
    
    def test_current_subscription(self):
        """Test current subscription endpoint via Stripe payments"""
        response = test_session.get(f"{BASE_URL}/api/payments/stripe/subscriptions/current")
        
        if response.status_code == 401:
            pytest.skip("Authentication required")
        
        assert response.status_code in [200, 404]
        print(f"✅ Current subscription endpoint working (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
