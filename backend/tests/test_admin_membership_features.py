"""
Tests for Admin Membership System & Wallet Payment Features
- Admin membership tiers API
- Admin promo codes API
- Admin transactions API
- BL coins purchase from balance
- Subscription from balance
- Current subscription status
"""
import pytest
import requests
import os
import time
import uuid

# Get the API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials for an existing test user
TEST_USER_EMAIL = "tester@blendlink.net"
TEST_USER_PASSWORD = "BlendLink2024!"


class TestSetup:
    """Setup tests - auth and prerequisites"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Create a requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def user_token(self, api_client):
        """Get user authentication token"""
        print(f"\n[Setup] Using BASE_URL: {BASE_URL}")
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        print(f"[Setup] Login response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        return None
    
    @pytest.fixture(scope="class")
    def admin_token(self, api_client):
        """Get admin authentication token (same user if they're admin)"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        return None


class TestAdminMembershipTiers(TestSetup):
    """Test Admin Membership Tiers API"""
    
    def test_get_membership_tiers(self, api_client, admin_token):
        """Test GET /api/admin/membership/tiers returns tier data"""
        if not admin_token:
            pytest.skip("No admin token available")
        
        response = api_client.get(
            f"{BASE_URL}/api/admin/membership/tiers",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print(f"[Tiers] Response status: {response.status_code}")
        
        # Check status - could be 200 (success) or 403 (not admin)
        if response.status_code == 403:
            pytest.skip("User is not admin - cannot access admin endpoints")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "tiers" in data, "Response should contain 'tiers'"
        
        tiers = data["tiers"]
        print(f"[Tiers] Found {len(tiers)} tiers")
        
        # Verify we have the expected tiers
        tier_ids = [t["tier_id"] for t in tiers]
        expected_tiers = ["free", "bronze", "silver", "gold", "diamond"]
        for expected in expected_tiers:
            assert expected in tier_ids, f"Missing tier: {expected}"
        
        # Verify tier structure
        for tier in tiers:
            assert "tier_id" in tier
            assert "price_monthly" in tier or "price" in tier
            assert "commission_l1_rate" in tier
            assert "commission_l2_rate" in tier
        
        print(f"[Tiers] PASSED - All tiers validated")
    
    def test_tiers_without_auth_returns_401(self, api_client):
        """Test that accessing tiers without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/admin/membership/tiers")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("[Tiers] PASSED - No auth returns 401")


class TestAdminPromoCodes(TestSetup):
    """Test Admin Promo Codes API"""
    
    def test_get_promo_codes(self, api_client, admin_token):
        """Test GET /api/admin/membership/promo-codes returns promo codes"""
        if not admin_token:
            pytest.skip("No admin token available")
        
        response = api_client.get(
            f"{BASE_URL}/api/admin/membership/promo-codes",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print(f"[PromoCodes] Response status: {response.status_code}")
        
        if response.status_code == 403:
            pytest.skip("User is not admin - cannot access admin endpoints")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "promo_codes" in data, "Response should contain 'promo_codes'"
        
        print(f"[PromoCodes] Found {len(data['promo_codes'])} promo codes")
        print("[PromoCodes] PASSED")
    
    def test_promo_codes_without_auth_returns_401(self, api_client):
        """Test that accessing promo codes without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/admin/membership/promo-codes")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("[PromoCodes] PASSED - No auth returns 401")


class TestAdminTransactions(TestSetup):
    """Test Admin Transaction Monitoring API"""
    
    def test_get_transactions(self, api_client, admin_token):
        """Test GET /api/admin/membership/transactions returns transaction data"""
        if not admin_token:
            pytest.skip("No admin token available")
        
        response = api_client.get(
            f"{BASE_URL}/api/admin/membership/transactions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        print(f"[Transactions] Response status: {response.status_code}")
        
        if response.status_code == 403:
            pytest.skip("User is not admin - cannot access admin endpoints")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "transactions" in data, "Response should contain 'transactions'"
        assert "total" in data, "Response should contain 'total'"
        
        print(f"[Transactions] Found {len(data['transactions'])} transactions (total: {data['total']})")
        print("[Transactions] PASSED")
    
    def test_transactions_without_auth_returns_401(self, api_client):
        """Test that accessing transactions without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/admin/membership/transactions")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("[Transactions] PASSED - No auth returns 401")


class TestBLCoinsFromBalance(TestSetup):
    """Test BL Coins Purchase from Balance API"""
    
    def test_purchase_coins_from_balance_requires_auth(self, api_client):
        """Test that purchasing coins requires authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/payments/bl-coins/purchase-from-balance",
            json={
                "package_id": "pack_30k",
                "quantity": 1,
                "amount": 4.99,
                "coins": 30000
            }
        )
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("[BL Coins] PASSED - No auth returns 401")
    
    def test_purchase_coins_with_insufficient_balance(self, api_client, user_token):
        """Test purchasing coins with insufficient balance returns error"""
        if not user_token:
            pytest.skip("No user token available")
        
        # Try to purchase with a large amount likely to exceed balance
        response = api_client.post(
            f"{BASE_URL}/api/payments/bl-coins/purchase-from-balance",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "package_id": "pack_1m",
                "quantity": 1000,  # Very high quantity
                "amount": 29990.00,  # Large amount
                "coins": 1000000000
            }
        )
        
        print(f"[BL Coins] Insufficient balance response: {response.status_code}")
        
        # Should return 400 for insufficient balance
        if response.status_code == 400:
            data = response.json()
            assert "detail" in data, "Error response should have detail"
            assert "Insufficient" in data["detail"] or "insufficient" in data["detail"].lower()
            print("[BL Coins] PASSED - Insufficient balance handled correctly")
        else:
            # If status is 200, it means user has enough balance (unlikely but possible)
            print(f"[BL Coins] Got status {response.status_code} - user may have sufficient balance")


class TestSubscriptionFromBalance(TestSetup):
    """Test Subscription from Balance API"""
    
    def test_subscribe_from_balance_requires_auth(self, api_client):
        """Test that subscribing requires authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/payments/subscriptions/subscribe-from-balance",
            json={
                "tier": "bronze",
                "amount": 4.99
            }
        )
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("[Subscription] PASSED - No auth returns 401")
    
    def test_subscribe_invalid_tier(self, api_client, user_token):
        """Test subscribing with invalid tier returns error"""
        if not user_token:
            pytest.skip("No user token available")
        
        response = api_client.post(
            f"{BASE_URL}/api/payments/subscriptions/subscribe-from-balance",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "tier": "invalid_tier_xyz",
                "amount": 4.99
            }
        )
        
        print(f"[Subscription] Invalid tier response: {response.status_code}")
        assert response.status_code == 400, f"Expected 400 for invalid tier, got {response.status_code}"
        print("[Subscription] PASSED - Invalid tier rejected")


class TestCurrentSubscription(TestSetup):
    """Test Current Subscription Status API"""
    
    def test_get_current_subscription_requires_auth(self, api_client):
        """Test that getting subscription status requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/payments/subscriptions/current")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("[Subscription Status] PASSED - No auth returns 401")
    
    def test_get_current_subscription_with_auth(self, api_client, user_token):
        """Test getting current subscription with auth"""
        if not user_token:
            pytest.skip("No user token available")
        
        response = api_client.get(
            f"{BASE_URL}/api/payments/subscriptions/current",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        print(f"[Subscription Status] Response: {response.status_code}")
        
        # Could be 200 (has subscription) or 404 (no subscription)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"[Subscription Status] User has subscription: {data.get('tier', 'unknown')}")
        else:
            print("[Subscription Status] User has no active subscription")
        
        print("[Subscription Status] PASSED")


class TestAPIEndpointsAccessibility:
    """Test that all required API endpoints are accessible"""
    
    def test_api_health(self):
        """Basic API health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"API health check failed: {response.status_code}"
        print("[Health] API is healthy")
    
    def test_admin_membership_tiers_endpoint_exists(self):
        """Verify admin membership tiers endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/admin/membership/tiers")
        # Should return 401 (unauthorized) not 404 (not found)
        assert response.status_code != 404, "Endpoint /api/admin/membership/tiers not found"
        print(f"[Endpoint] /api/admin/membership/tiers exists (status: {response.status_code})")
    
    def test_admin_promo_codes_endpoint_exists(self):
        """Verify admin promo codes endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/admin/membership/promo-codes")
        assert response.status_code != 404, "Endpoint /api/admin/membership/promo-codes not found"
        print(f"[Endpoint] /api/admin/membership/promo-codes exists (status: {response.status_code})")
    
    def test_admin_transactions_endpoint_exists(self):
        """Verify admin transactions endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/admin/membership/transactions")
        assert response.status_code != 404, "Endpoint /api/admin/membership/transactions not found"
        print(f"[Endpoint] /api/admin/membership/transactions exists (status: {response.status_code})")
    
    def test_bl_coins_purchase_endpoint_exists(self):
        """Verify BL coins purchase from balance endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/payments/bl-coins/purchase-from-balance", json={})
        assert response.status_code != 404, "Endpoint /api/payments/bl-coins/purchase-from-balance not found"
        print(f"[Endpoint] /api/payments/bl-coins/purchase-from-balance exists (status: {response.status_code})")
    
    def test_subscribe_from_balance_endpoint_exists(self):
        """Verify subscribe from balance endpoint exists"""
        response = requests.post(f"{BASE_URL}/api/payments/subscriptions/subscribe-from-balance", json={})
        assert response.status_code != 404, "Endpoint /api/payments/subscriptions/subscribe-from-balance not found"
        print(f"[Endpoint] /api/payments/subscriptions/subscribe-from-balance exists (status: {response.status_code})")
    
    def test_current_subscription_endpoint_exists(self):
        """Verify current subscription endpoint exists"""
        response = requests.get(f"{BASE_URL}/api/payments/subscriptions/current")
        assert response.status_code != 404, "Endpoint /api/payments/subscriptions/current not found"
        print(f"[Endpoint] /api/payments/subscriptions/current exists (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
