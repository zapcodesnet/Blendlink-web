"""
Stripe LIVE Mode Verification Tests - Iteration 145
Tests:
1. GET /api/payments/config - verify pk_live_* key returned
2. Backend health check
3. Invalid session ID validation (test, null, undefined return 400)
4. Guest order creation endpoint
5. Checkout session creation endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://blendlink-fixes.preview.emergentagent.com')


class TestStripeConfiguration:
    """Test Stripe configuration returns LIVE keys"""
    
    def test_health_check(self):
        """Verify backend health check passes"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✅ Health check passed: {data}")
    
    def test_stripe_config_returns_live_key(self):
        """Verify /api/payments/config returns pk_live_* key"""
        response = requests.get(f"{BASE_URL}/api/payments/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "publishable_key" in data
        assert data.get("enabled") == True
        
        pk_key = data.get("publishable_key", "")
        assert pk_key.startswith("pk_live_"), f"Expected pk_live_*, got: {pk_key[:20]}..."
        print(f"✅ Stripe config returns LIVE key: {pk_key[:25]}...")
    
    def test_stripe_config_no_test_key(self):
        """Verify /api/payments/config does NOT return pk_test_*"""
        response = requests.get(f"{BASE_URL}/api/payments/config")
        assert response.status_code == 200
        
        data = response.json()
        pk_key = data.get("publishable_key", "")
        
        assert not pk_key.startswith("pk_test_"), f"ERROR: Test key detected: {pk_key[:20]}..."
        print("✅ No TEST key detected in config")


class TestSessionIdValidation:
    """Test invalid session ID handling"""
    
    def test_invalid_session_test_returns_400(self):
        """GET /api/payments/stripe/checkout/status/test should return 400"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/checkout/status/test")
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
        print(f"✅ 'test' session ID returns 400: {data.get('detail')}")
    
    def test_invalid_session_null_returns_400(self):
        """GET /api/payments/stripe/checkout/status/null should return 400"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/checkout/status/null")
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
        print(f"✅ 'null' session ID returns 400: {data.get('detail')}")
    
    def test_invalid_session_undefined_returns_400(self):
        """GET /api/payments/stripe/checkout/status/undefined should return 400"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/checkout/status/undefined")
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
        print(f"✅ 'undefined' session ID returns 400: {data.get('detail')}")
    
    def test_invalid_session_wrong_format_returns_400(self):
        """Invalid format session ID should return 400"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/checkout/status/invalid_format_123")
        assert response.status_code == 400
        
        data = response.json()
        assert "detail" in data
        print(f"✅ Invalid format session ID returns 400: {data.get('detail')}")


class TestGuestOrderEndpoint:
    """Test guest order creation endpoint"""
    
    def test_guest_order_missing_page_returns_404(self):
        """Guest order with non-existent page should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/page-orders/guest",
            json={
                "page_id": "nonexistent_page_xyz",
                "customer_name": "Test User",
                "customer_phone": "123-456-7890",
                "order_type": "delivery",
                "payment_method": "card",
                "items": [{"item_id": "item1", "name": "Test Item", "price": 10.00, "quantity": 1}],
                "subtotal": 10.00,
                "total": 10.80
            }
        )
        assert response.status_code == 404
        
        data = response.json()
        assert "not found" in data.get("detail", "").lower()
        print(f"✅ Guest order with invalid page returns 404: {data.get('detail')}")
    
    def test_guest_order_endpoint_available(self):
        """Verify guest order endpoint is available (not 404 method not allowed)"""
        # POST to endpoint should return 404 for missing page, not 405 method not allowed
        response = requests.post(
            f"{BASE_URL}/api/page-orders/guest",
            json={
                "page_id": "test",
                "customer_name": "Test",
                "customer_phone": "123",
                "order_type": "delivery",
                "payment_method": "card",
                "items": [],
                "subtotal": 0,
                "total": 0
            }
        )
        # Should be 404 (page not found) or 422 (validation), not 405
        assert response.status_code in [404, 422]
        print(f"✅ Guest order endpoint available (status: {response.status_code})")


class TestCheckoutSession:
    """Test checkout session creation endpoint"""
    
    def test_checkout_session_missing_order_returns_404(self):
        """Checkout session with non-existent order should return 404"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/checkout/session",
            json={
                "order_id": "nonexistent_order_xyz",
                "origin_url": "https://blendlink.net"
            }
        )
        assert response.status_code == 404
        
        data = response.json()
        assert "not found" in data.get("detail", "").lower() or "Order" in str(data)
        print(f"✅ Checkout session with invalid order returns 404: {data.get('detail')}")


class TestMarketplaceEndpoints:
    """Test marketplace endpoints work correctly"""
    
    def test_marketplace_categories(self):
        """Verify marketplace categories endpoint works"""
        response = requests.get(f"{BASE_URL}/api/marketplace/categories")
        assert response.status_code == 200
        print("✅ Marketplace categories endpoint works")
    
    def test_marketplace_listings(self):
        """Verify marketplace listings endpoint works"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings?sort=newest")
        assert response.status_code == 200
        print("✅ Marketplace listings endpoint works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
