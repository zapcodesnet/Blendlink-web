"""
Iteration 163: Test that response.clone() has been removed and simple text() parsing works

Tests:
1. All backend APIs return valid responses
2. Frontend codebase has no response.clone() calls
3. Stripe Connect and Subscription endpoints work correctly
"""

import pytest
import requests
import subprocess
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://blendlink-live.preview.emergentagent.com').rstrip('/')
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data.get("token")


class TestCodebaseCloneRemoval:
    """Verify that response.clone() has been removed from frontend codebase"""
    
    def test_no_clone_in_api_js(self):
        """Check api.js has no response.clone() calls"""
        result = subprocess.run(
            ["grep", "-c", "response.clone()", "/app/frontend/src/services/api.js"],
            capture_output=True, text=True
        )
        count = int(result.stdout.strip()) if result.returncode == 0 else 0
        assert count == 0, f"Found {count} response.clone() calls in api.js - should be 0"
        print("PASS: api.js has no response.clone() calls")
    
    def test_no_clone_in_member_pages_api(self):
        """Check memberPagesApi.js has no response.clone() calls"""
        result = subprocess.run(
            ["grep", "-c", "response.clone()", "/app/frontend/src/services/memberPagesApi.js"],
            capture_output=True, text=True
        )
        count = int(result.stdout.strip()) if result.returncode == 0 else 0
        assert count == 0, f"Found {count} response.clone() calls in memberPagesApi.js - should be 0"
        print("PASS: memberPagesApi.js has no response.clone() calls")
    
    def test_no_clone_in_orphan_trends_widget(self):
        """Check OrphanTrendsWidget.jsx has no response.clone() calls"""
        result = subprocess.run(
            ["grep", "-c", "response.clone()", "/app/frontend/src/components/OrphanTrendsWidget.jsx"],
            capture_output=True, text=True
        )
        count = int(result.stdout.strip()) if result.returncode == 0 else 0
        assert count == 0, f"Found {count} response.clone() calls in OrphanTrendsWidget.jsx - should be 0"
        print("PASS: OrphanTrendsWidget.jsx has no response.clone() calls")
    
    def test_no_clone_in_admin_orphans(self):
        """Check AdminOrphans.jsx has no response.clone() calls"""
        result = subprocess.run(
            ["grep", "-c", "response.clone()", "/app/frontend/src/pages/admin/AdminOrphans.jsx"],
            capture_output=True, text=True
        )
        count = int(result.stdout.strip()) if result.returncode == 0 else 0
        assert count == 0, f"Found {count} response.clone() calls in AdminOrphans.jsx - should be 0"
        print("PASS: AdminOrphans.jsx has no response.clone() calls")
    
    def test_no_clone_in_entire_frontend(self):
        """Check entire frontend src folder has no response.clone() calls"""
        result = subprocess.run(
            ["grep", "-r", "response.clone()", "/app/frontend/src", "--include=*.js", "--include=*.jsx"],
            capture_output=True, text=True
        )
        # If grep finds nothing, returncode is 1 (no match)
        if result.returncode == 0 and result.stdout.strip():
            pytest.fail(f"Found response.clone() calls in frontend:\n{result.stdout}")
        print("PASS: No response.clone() calls found in entire frontend codebase")


class TestStripeConnectAPI:
    """Test Stripe Connect onboarding endpoint"""
    
    def test_stripe_connect_onboard(self, auth_token):
        """POST /api/payments/stripe/connect/onboard returns valid Stripe URL"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/connect/onboard",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "url" in data, "Response missing 'url' field"
        assert data["url"].startswith("https://connect.stripe.com"), f"Invalid URL: {data['url']}"
        print(f"PASS: Stripe Connect URL returned: {data['url'][:60]}...")
    
    def test_stripe_connect_status(self, auth_token):
        """GET /api/payments/stripe/connect/status returns connection status"""
        response = requests.get(
            f"{BASE_URL}/api/payments/stripe/connect/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "is_connected" in data, "Response missing 'is_connected' field"
        print(f"PASS: Stripe Connect status: is_connected={data.get('is_connected')}")


class TestSubscriptionCheckoutAPI:
    """Test subscription checkout endpoints for all tiers"""
    
    @pytest.fixture
    def success_url(self):
        return f"{BASE_URL}/subscriptions/success"
    
    @pytest.fixture
    def cancel_url(self):
        return f"{BASE_URL}/subscriptions/cancel"
    
    def test_bronze_checkout(self, auth_token, success_url, cancel_url):
        """POST /api/subscriptions/checkout?tier=bronze returns checkout_url"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=bronze&success_url={success_url}&cancel_url={cancel_url}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "checkout_url" in data, f"Response missing 'checkout_url': {data}"
        assert "stripe.com" in data["checkout_url"], f"Invalid checkout URL: {data['checkout_url']}"
        print(f"PASS: Bronze checkout URL generated")
    
    def test_silver_checkout(self, auth_token, success_url, cancel_url):
        """POST /api/subscriptions/checkout?tier=silver returns checkout_url"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=silver&success_url={success_url}&cancel_url={cancel_url}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "checkout_url" in data, f"Response missing 'checkout_url': {data}"
        print(f"PASS: Silver checkout URL generated")
    
    def test_gold_checkout(self, auth_token, success_url, cancel_url):
        """POST /api/subscriptions/checkout?tier=gold returns checkout_url"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=gold&success_url={success_url}&cancel_url={cancel_url}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "checkout_url" in data, f"Response missing 'checkout_url': {data}"
        print(f"PASS: Gold checkout URL generated")
    
    def test_diamond_checkout(self, auth_token, success_url, cancel_url):
        """POST /api/subscriptions/checkout?tier=diamond returns checkout_url"""
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout?tier=diamond&success_url={success_url}&cancel_url={cancel_url}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "checkout_url" in data, f"Response missing 'checkout_url': {data}"
        print(f"PASS: Diamond checkout URL generated")


class TestWalletAPI:
    """Test wallet balance endpoint"""
    
    def test_wallet_balance(self, auth_token):
        """GET /api/wallet/balance returns balance data"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "balance" in data, f"Response missing 'balance': {data}"
        print(f"PASS: Wallet balance returned: {data.get('balance')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
