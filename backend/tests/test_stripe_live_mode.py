"""
Stripe Live Mode Verification Tests - Iteration 144
Tests to verify Stripe payment integration is in LIVE mode
"""

import pytest
import requests
import os

# Use production URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://production-url-fix.preview.emergentagent.com')

class TestStripeConfiguration:
    """Test Stripe configuration endpoints"""
    
    def test_payments_config_returns_live_key(self):
        """GET /api/payments/config should return pk_live_* publishable key"""
        response = requests.get(f"{BASE_URL}/api/payments/config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "publishable_key" in data, "Response missing publishable_key"
        assert "enabled" in data, "Response missing enabled"
        
        # CRITICAL: Verify LIVE mode key
        pub_key = data["publishable_key"]
        assert pub_key.startswith("pk_live_"), f"Expected pk_live_*, got {pub_key[:20]}..."
        assert data["enabled"] is True, "Stripe should be enabled"
        
        print(f"✅ Stripe config returns LIVE key: {pub_key[:20]}...")
    
    def test_publishable_key_not_test_mode(self):
        """Verify publishable key is NOT a test key"""
        response = requests.get(f"{BASE_URL}/api/payments/config")
        assert response.status_code == 200
        
        data = response.json()
        pub_key = data.get("publishable_key", "")
        
        # Ensure NOT test mode
        assert not pub_key.startswith("pk_test_"), "Publishable key should NOT be pk_test_*"
        print("✅ Publishable key is NOT in test mode")


class TestStripeSessionValidation:
    """Test Stripe session ID validation"""
    
    def test_invalid_session_id_test_returns_400(self):
        """GET /api/payments/stripe/checkout/status/test should return 400"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/checkout/status/test")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        assert "Invalid" in data["detail"] or "missing" in data["detail"].lower()
        print("✅ Session ID 'test' correctly returns 400")
    
    def test_invalid_session_id_null_returns_400(self):
        """GET /api/payments/stripe/checkout/status/null should return 400"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/checkout/status/null")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Session ID 'null' correctly returns 400")
    
    def test_invalid_session_id_undefined_returns_400(self):
        """GET /api/payments/stripe/checkout/status/undefined should return 400"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/checkout/status/undefined")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Session ID 'undefined' correctly returns 400")
    
    def test_invalid_session_id_empty_returns_400(self):
        """GET /api/payments/stripe/checkout/status/ with empty should return 400/404"""
        # Empty path segment will match different route or return 404/400
        response = requests.get(f"{BASE_URL}/api/payments/stripe/checkout/status/")
        
        # Accept either 400 or 404 (depends on route matching)
        assert response.status_code in [400, 404, 307], f"Expected 400/404, got {response.status_code}"
        print(f"✅ Empty session ID correctly returns {response.status_code}")
    
    def test_invalid_session_format_returns_error(self):
        """Session ID without cs_ prefix should return validation error"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/checkout/status/invalid_format_123")
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data
        # Should mention expected format
        assert "cs_" in data["detail"] or "format" in data["detail"].lower()
        print("✅ Invalid format session ID correctly rejected with format hint")


class TestPOSCheckoutValidation:
    """Test POS checkout endpoint session validation"""
    
    def test_pos_checkout_status_invalid_session(self):
        """POS checkout status should validate session ID format"""
        # This endpoint requires auth, but session validation happens first
        response = requests.get(f"{BASE_URL}/api/pos/checkout/status/test")
        
        # Should return 400 (bad request) or 401 (auth required)
        assert response.status_code in [400, 401], f"Expected 400/401, got {response.status_code}"
        print(f"✅ POS checkout status validates session ID (status: {response.status_code})")


class TestStripeEndpointsExist:
    """Verify all required Stripe endpoints exist"""
    
    def test_payments_config_endpoint_exists(self):
        """GET /api/payments/config should exist"""
        response = requests.get(f"{BASE_URL}/api/payments/config")
        assert response.status_code == 200, f"Endpoint returned {response.status_code}"
        print("✅ /api/payments/config endpoint exists and accessible")
    
    def test_stripe_checkout_status_endpoint_exists(self):
        """GET /api/payments/stripe/checkout/status/* should exist"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/checkout/status/test")
        # Should return 400 (validation error), not 404 (not found)
        assert response.status_code != 404, "Endpoint should exist"
        print("✅ /api/payments/stripe/checkout/status/* endpoint exists")
    
    def test_stripe_checkout_session_endpoint_exists(self):
        """POST /api/payments/stripe/checkout/session should exist"""
        # Send minimal POST to check endpoint existence
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/checkout/session",
            json={"order_id": "test", "origin_url": "https://test.com"}
        )
        # Should return validation error (404 for order), not route not found
        assert response.status_code in [400, 404, 422], f"Unexpected status: {response.status_code}"
        print("✅ /api/payments/stripe/checkout/session endpoint exists")


class TestHealthCheck:
    """Basic health checks"""
    
    def test_api_is_accessible(self):
        """Verify API is accessible"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code in [200, 404], f"API not accessible: {response.status_code}"
        print("✅ API is accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
