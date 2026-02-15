"""
Test suite for Stripe subscription fixes (Iteration 167):
1. Stripe Connect catches ALL exceptions (not just InvalidRequestError) for stale accounts
2. verify-latest and verify-session endpoints for subscription activation after payment
3. checkout-redirect returns 302 to checkout.stripe.com
4. Frontend calls verify-latest on subscription_success=true URL param
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://blendlink-live.preview.emergentagent.com')
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"


class TestSubscriptionEndpoints:
    """Test subscription-related endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(f'{BASE_URL}/api/auth/login', json={
            'email': TEST_EMAIL,
            'password': TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get('token')
        self.headers = {'Authorization': f'Bearer {self.token}'}
    
    # --- Test GET /api/subscriptions/tiers ---
    def test_get_subscription_tiers(self):
        """Verify all subscription tiers are returned"""
        response = requests.get(f'{BASE_URL}/api/subscriptions/tiers')
        assert response.status_code == 200
        data = response.json()
        tiers = data.get('tiers', {})
        
        # Verify all tiers exist
        expected_tiers = ['free', 'bronze', 'silver', 'gold', 'diamond']
        for tier in expected_tiers:
            assert tier in tiers, f"Missing tier: {tier}"
        
        # Verify tier prices
        assert tiers['bronze']['price_monthly'] == 4.99
        assert tiers['silver']['price_monthly'] == 9.99
        assert tiers['gold']['price_monthly'] == 14.99
        assert tiers['diamond']['price_monthly'] == 29.99
    
    # --- Test GET /api/subscriptions/checkout-redirect (Bronze) ---
    def test_checkout_redirect_bronze(self):
        """Verify checkout-redirect returns 302 to checkout.stripe.com for Bronze tier"""
        success_url = f'{BASE_URL}/wallet?subscription_success=true'
        cancel_url = f'{BASE_URL}/wallet'
        url = f'{BASE_URL}/api/subscriptions/checkout-redirect?tier=bronze&success_url={success_url}&cancel_url={cancel_url}&token={self.token}'
        
        response = requests.get(url, allow_redirects=False)
        assert response.status_code == 302, f"Expected 302, got {response.status_code}: {response.text}"
        
        location = response.headers.get('Location', '')
        assert 'checkout.stripe.com' in location, f"Expected redirect to checkout.stripe.com, got: {location}"
    
    # --- Test GET /api/subscriptions/checkout-redirect (Silver) ---
    def test_checkout_redirect_silver(self):
        """Verify checkout-redirect returns 302 to checkout.stripe.com for Silver tier"""
        success_url = f'{BASE_URL}/subscriptions?success=true'
        cancel_url = f'{BASE_URL}/subscriptions'
        url = f'{BASE_URL}/api/subscriptions/checkout-redirect?tier=silver&success_url={success_url}&cancel_url={cancel_url}&token={self.token}'
        
        response = requests.get(url, allow_redirects=False)
        assert response.status_code == 302
        assert 'checkout.stripe.com' in response.headers.get('Location', '')
    
    # --- Test GET /api/subscriptions/checkout-redirect (Gold) ---
    def test_checkout_redirect_gold(self):
        """Verify checkout-redirect returns 302 to checkout.stripe.com for Gold tier"""
        success_url = f'{BASE_URL}/subscriptions?success=true'
        cancel_url = f'{BASE_URL}/subscriptions'
        url = f'{BASE_URL}/api/subscriptions/checkout-redirect?tier=gold&success_url={success_url}&cancel_url={cancel_url}&token={self.token}'
        
        response = requests.get(url, allow_redirects=False)
        assert response.status_code == 302
        assert 'checkout.stripe.com' in response.headers.get('Location', '')
    
    # --- Test GET /api/subscriptions/checkout-redirect (Diamond) ---
    def test_checkout_redirect_diamond(self):
        """Verify checkout-redirect returns 302 to checkout.stripe.com for Diamond tier"""
        success_url = f'{BASE_URL}/subscriptions?success=true'
        cancel_url = f'{BASE_URL}/subscriptions'
        url = f'{BASE_URL}/api/subscriptions/checkout-redirect?tier=diamond&success_url={success_url}&cancel_url={cancel_url}&token={self.token}'
        
        response = requests.get(url, allow_redirects=False)
        assert response.status_code == 302
        assert 'checkout.stripe.com' in response.headers.get('Location', '')
    
    # --- Test GET /api/subscriptions/checkout-redirect (Invalid tier) ---
    def test_checkout_redirect_invalid_tier(self):
        """Verify checkout-redirect returns 400 for invalid tier"""
        success_url = f'{BASE_URL}/subscriptions?success=true'
        cancel_url = f'{BASE_URL}/subscriptions'
        url = f'{BASE_URL}/api/subscriptions/checkout-redirect?tier=invalid_tier&success_url={success_url}&cancel_url={cancel_url}&token={self.token}'
        
        response = requests.get(url, allow_redirects=False)
        assert response.status_code == 400, f"Expected 400 for invalid tier, got {response.status_code}"
    
    # --- Test GET /api/subscriptions/verify-latest ---
    def test_verify_latest_endpoint(self):
        """Verify verify-latest endpoint returns subscription status"""
        response = requests.get(f'{BASE_URL}/api/subscriptions/verify-latest', headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        # Should return status (no_customer, no_paid_session, already_active, or activated)
        assert 'status' in data
        assert data['status'] in ['no_customer', 'no_paid_session', 'already_active', 'activated', 'error']
        assert 'message' in data
    
    # --- Test GET /api/subscriptions/verify-session with invalid session ---
    def test_verify_session_invalid(self):
        """Verify verify-session returns error for invalid session"""
        response = requests.get(
            f'{BASE_URL}/api/subscriptions/verify-session?session_id=cs_test_invalid_123',
            headers=self.headers
        )
        # Should return 400 for invalid session
        assert response.status_code == 400
    
    # --- Test GET /api/subscriptions/my-subscription ---
    def test_my_subscription(self):
        """Verify my-subscription endpoint returns user's current subscription"""
        response = requests.get(f'{BASE_URL}/api/subscriptions/my-subscription', headers=self.headers)
        assert response.status_code == 200
        
        data = response.json()
        assert 'tier' in data
        assert 'tier_details' in data
        # Verify tier is valid
        assert data['tier'] in ['free', 'bronze', 'silver', 'gold', 'diamond']


class TestStripeConnectEndpoints:
    """Test Stripe Connect endpoints for withdrawals"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(f'{BASE_URL}/api/auth/login', json={
            'email': TEST_EMAIL,
            'password': TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get('token')
        self.headers = {'Authorization': f'Bearer {self.token}'}
    
    # --- Test GET /api/payments/stripe/connect/onboard-redirect ---
    def test_connect_onboard_redirect(self):
        """Verify connect/onboard-redirect returns 302 to connect.stripe.com"""
        response = requests.get(
            f'{BASE_URL}/api/payments/stripe/connect/onboard-redirect?token={self.token}',
            allow_redirects=False
        )
        # Should be 302 redirect to Stripe Connect
        assert response.status_code == 302, f"Expected 302, got {response.status_code}: {response.text[:200]}"
        
        location = response.headers.get('Location', '')
        assert 'stripe.com' in location, f"Expected redirect to stripe.com, got: {location[:100]}"
    
    # --- Test GET /api/payments/stripe/connect/status ---
    def test_connect_status(self):
        """Verify connect/status returns connection status"""
        response = requests.get(
            f'{BASE_URL}/api/payments/stripe/connect/status',
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert 'is_connected' in data
        assert 'charges_enabled' in data
        assert 'payouts_enabled' in data
    
    # --- Test POST /api/payments/stripe/connect/onboard (backward compatibility) ---
    def test_connect_onboard_post(self):
        """Verify POST connect/onboard endpoint still works (backward compatibility)"""
        response = requests.post(
            f'{BASE_URL}/api/payments/stripe/connect/onboard',
            headers=self.headers
        )
        # Should return 200 with url OR 503 if platform not configured
        assert response.status_code in [200, 503], f"Unexpected status: {response.status_code}: {response.text[:200]}"
        
        if response.status_code == 200:
            data = response.json()
            assert 'url' in data


class TestBackwardCompatibility:
    """Test backward compatibility for POST endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(f'{BASE_URL}/api/auth/login', json={
            'email': TEST_EMAIL,
            'password': TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get('token')
        self.headers = {'Authorization': f'Bearer {self.token}'}
    
    # --- Test POST /api/subscriptions/checkout ---
    def test_subscription_checkout_post(self):
        """Verify POST checkout endpoint still works"""
        success_url = f'{BASE_URL}/wallet?subscription_success=true'
        cancel_url = f'{BASE_URL}/wallet'
        
        response = requests.post(
            f'{BASE_URL}/api/subscriptions/checkout?tier=bronze&success_url={success_url}&cancel_url={cancel_url}',
            headers=self.headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        assert 'checkout_url' in data
        assert 'session_id' in data
        assert 'checkout.stripe.com' in data['checkout_url']


class TestErrorHandling:
    """Test error handling for Stripe endpoints"""
    
    # --- Test missing token ---
    def test_checkout_redirect_missing_token(self):
        """Verify checkout-redirect returns 422 for missing token"""
        success_url = f'{BASE_URL}/subscriptions?success=true'
        cancel_url = f'{BASE_URL}/subscriptions'
        url = f'{BASE_URL}/api/subscriptions/checkout-redirect?tier=bronze&success_url={success_url}&cancel_url={cancel_url}'
        # Note: missing token
        
        response = requests.get(url, allow_redirects=False)
        assert response.status_code == 422  # Missing required parameter
    
    # --- Test invalid token ---
    def test_checkout_redirect_invalid_token(self):
        """Verify checkout-redirect returns 401 for invalid token"""
        success_url = f'{BASE_URL}/subscriptions?success=true'
        cancel_url = f'{BASE_URL}/subscriptions'
        url = f'{BASE_URL}/api/subscriptions/checkout-redirect?tier=bronze&success_url={success_url}&cancel_url={cancel_url}&token=invalid_token_123'
        
        response = requests.get(url, allow_redirects=False)
        assert response.status_code == 401  # Invalid token
    
    # --- Test verify-latest without auth ---
    def test_verify_latest_no_auth(self):
        """Verify verify-latest returns 401 without authentication"""
        response = requests.get(f'{BASE_URL}/api/subscriptions/verify-latest')
        assert response.status_code == 401
    
    # --- Test verify-session without auth ---
    def test_verify_session_no_auth(self):
        """Verify verify-session returns 401 without authentication"""
        response = requests.get(f'{BASE_URL}/api/subscriptions/verify-session?session_id=cs_test_123')
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
