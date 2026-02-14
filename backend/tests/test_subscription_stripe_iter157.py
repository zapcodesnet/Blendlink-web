"""
Test Suite for BlendLink Subscription and Stripe Payment Fixes (Iteration 157)

Tests:
1. /subscriptions route accessibility
2. Subscription tiers API - all tiers with correct prices
3. Stripe payment endpoints accessibility (not 404)
4. Admin API authentication requirements (return 401, not 404)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://emergency-fixes-1.preview.emergentagent.com').rstrip('/')


class TestSubscriptionTiersAPI:
    """Test subscription tiers API - all 5 tiers should be returned"""
    
    def test_subscription_tiers_endpoint_exists(self):
        """GET /api/subscriptions/tiers should return tiers data"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        print(f"GET /api/subscriptions/tiers - Status: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "tiers" in data, "Response should contain 'tiers' key"
        
    def test_all_five_tiers_exist(self):
        """All 5 tiers should exist: free, bronze, silver, gold, diamond"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200
        
        data = response.json()
        tiers = data.get("tiers", {})
        
        expected_tiers = ["free", "bronze", "silver", "gold", "diamond"]
        for tier in expected_tiers:
            assert tier in tiers, f"Tier '{tier}' should exist in response"
            print(f"✓ Tier '{tier}' exists with price: ${tiers[tier].get('price_monthly', 0)}")
    
    def test_bronze_tier_price(self):
        """Bronze tier should be $4.99"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200
        
        data = response.json()
        bronze = data.get("tiers", {}).get("bronze", {})
        
        assert bronze.get("price_monthly") == 4.99, f"Bronze price should be 4.99, got {bronze.get('price_monthly')}"
        print(f"✓ Bronze tier price is correct: ${bronze.get('price_monthly')}")
    
    def test_silver_tier_price(self):
        """Silver tier should be $9.99"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200
        
        data = response.json()
        silver = data.get("tiers", {}).get("silver", {})
        
        assert silver.get("price_monthly") == 9.99, f"Silver price should be 9.99, got {silver.get('price_monthly')}"
        print(f"✓ Silver tier price is correct: ${silver.get('price_monthly')}")
    
    def test_gold_tier_price(self):
        """Gold tier should be $14.99"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200
        
        data = response.json()
        gold = data.get("tiers", {}).get("gold", {})
        
        assert gold.get("price_monthly") == 14.99, f"Gold price should be 14.99, got {gold.get('price_monthly')}"
        print(f"✓ Gold tier price is correct: ${gold.get('price_monthly')}")
    
    def test_diamond_tier_price(self):
        """Diamond tier should be $29.99"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200
        
        data = response.json()
        diamond = data.get("tiers", {}).get("diamond", {})
        
        assert diamond.get("price_monthly") == 29.99, f"Diamond price should be 29.99, got {diamond.get('price_monthly')}"
        print(f"✓ Diamond tier price is correct: ${diamond.get('price_monthly')}")


class TestSubscriptionCheckoutAPI:
    """Test subscription checkout requires authentication (not 404)"""
    
    def test_subscription_checkout_requires_auth(self):
        """POST /api/subscriptions/checkout should return 401 without auth (not 404)"""
        response = requests.post(f"{BASE_URL}/api/subscriptions/checkout?tier=bronze&success_url=http://test.com&cancel_url=http://test.com")
        print(f"POST /api/subscriptions/checkout - Status: {response.status_code}")
        
        # Should return 401 (auth required), NOT 404 (not found)
        assert response.status_code == 401, f"Expected 401 (auth required), got {response.status_code}"
        print("✓ Subscription checkout endpoint exists and requires authentication")
    
    def test_subscription_cancel_requires_auth(self):
        """POST /api/subscriptions/cancel should return 401 without auth (not 404)"""
        response = requests.post(f"{BASE_URL}/api/subscriptions/cancel")
        print(f"POST /api/subscriptions/cancel - Status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401 (auth required), got {response.status_code}"
        print("✓ Subscription cancel endpoint exists and requires authentication")
    
    def test_my_subscription_requires_auth(self):
        """GET /api/subscriptions/my-subscription should return 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/my-subscription")
        print(f"GET /api/subscriptions/my-subscription - Status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401 (auth required), got {response.status_code}"
        print("✓ My subscription endpoint exists and requires authentication")


class TestStripePaymentEndpoints:
    """Test Stripe payment endpoints exist (not 404)"""
    
    def test_stripe_connect_status_requires_auth(self):
        """GET /api/payments/stripe/connect/status should require auth (not 404)"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/connect/status")
        print(f"GET /api/payments/stripe/connect/status - Status: {response.status_code}")
        
        # Should be 401 (auth required), NOT 404
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Stripe Connect status endpoint exists")
    
    def test_stripe_connect_onboard_requires_auth(self):
        """POST /api/payments/stripe/connect/onboard should require auth (not 404)"""
        response = requests.post(f"{BASE_URL}/api/payments/stripe/connect/onboard")
        print(f"POST /api/payments/stripe/connect/onboard - Status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Stripe Connect onboard endpoint exists")
    
    def test_bl_coins_checkout_requires_auth(self):
        """POST /api/payments/stripe/bl-coins/checkout should require auth (not 404)"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/bl-coins/checkout",
            json={"tier_id": "starter", "amount_usd": 4.99, "coins_amount": 30000, "origin_url": "http://test.com"}
        )
        print(f"POST /api/payments/stripe/bl-coins/checkout - Status: {response.status_code}")
        
        # Should be 401 (auth required), NOT 404
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ BL coins checkout endpoint exists")
    
    def test_stripe_withdraw_requires_auth(self):
        """POST /api/payments/stripe/withdraw should require auth (not 404)"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/withdraw",
            json={"amount": 10.0}
        )
        print(f"POST /api/payments/stripe/withdraw - Status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Stripe withdraw endpoint exists")
    
    def test_subscription_from_balance_requires_auth(self):
        """POST /api/payments/stripe/subscriptions/subscribe-from-balance should require auth"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/subscriptions/subscribe-from-balance",
            json={"tier": "bronze", "amount": 4.99}
        )
        print(f"POST /api/payments/stripe/subscriptions/subscribe-from-balance - Status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Subscription from balance endpoint exists")
    
    def test_coins_from_balance_requires_auth(self):
        """POST /api/payments/stripe/bl-coins/purchase-from-balance should require auth"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/bl-coins/purchase-from-balance",
            json={"package_id": "starter", "quantity": 1, "amount": 4.99, "coins": 30000}
        )
        print(f"POST /api/payments/stripe/bl-coins/purchase-from-balance - Status: {response.status_code}")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ BL coins purchase from balance endpoint exists")


class TestAdminEndpoints:
    """Test admin endpoints require authentication (not 404)"""
    
    def test_admin_custom_benefits_requires_auth(self):
        """GET /api/admin/membership/custom-benefits should return 401 without admin auth"""
        response = requests.get(f"{BASE_URL}/api/admin/membership/custom-benefits")
        print(f"GET /api/admin/membership/custom-benefits - Status: {response.status_code}")
        
        # Should be 401 or 403 (unauthorized), NOT 404
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Admin custom benefits endpoint exists and requires authentication")
    
    def test_admin_commission_adjustments_requires_auth(self):
        """GET /api/admin/membership/commissions/adjustments should return 401"""
        response = requests.get(f"{BASE_URL}/api/admin/membership/commissions/adjustments")
        print(f"GET /api/admin/membership/commissions/adjustments - Status: {response.status_code}")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Admin commission adjustments endpoint exists")


class TestAPIHealth:
    """Test basic API health"""
    
    def test_api_health(self):
        """API root should return health status"""
        response = requests.get(f"{BASE_URL}/api/")
        print(f"GET /api/ - Status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy", f"Expected healthy, got {data.get('status')}"
        print(f"✓ API is healthy: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
