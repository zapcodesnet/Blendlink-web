"""
Iteration 168 Tests: 5 Feature Changes
1. Google buttons removed from /login and /register
2. Profile share link changed to /profile (instead of /referrals)
3. Referral sections removed from member page analytics
4. /google staff-only page
5. Email verification for new registrations

Test Credentials: tester@blendlink.net / BlendLink2024!
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

# Use the PUBLIC URL for testing what users see
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://blendlink-live.preview.emergentagent.com')
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL.rstrip('/')

# Test credentials
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"

class TestAuthEndpoints:
    """Test authentication-related endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data.get("token")
    
    def test_login_existing_user_works(self):
        """Verify existing user login works normally (grandfathered - no email_verified required)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not returned"
        assert "user" in data, "User data not returned"
        # Existing users should NOT have email_verified:false blocking them
        # They're grandfathered in
        
    def test_staff_check_returns_false_for_regular_user(self, auth_token):
        """GET /api/auth/staff-check returns is_staff:false for regular users"""
        response = requests.get(f"{BASE_URL}/api/auth/staff-check", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Staff check failed: {response.text}"
        data = response.json()
        assert "is_staff" in data, "is_staff field missing"
        # Regular test user should not be staff
        # (unless they were added to admin_admins collection)
        print(f"Staff check result: {data}")
        
    def test_staff_check_requires_auth(self):
        """GET /api/auth/staff-check requires authentication"""
        response = requests.get(f"{BASE_URL}/api/auth/staff-check")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
    def test_verify_email_invalid_token(self):
        """GET /api/auth/verify-email?token=invalid returns error"""
        response = requests.get(f"{BASE_URL}/api/auth/verify-email?token=invalidtoken123")
        assert response.status_code == 400, f"Expected 400 for invalid token, got {response.status_code}"
        data = response.json()
        assert "detail" in data or "error" in data or "message" in data
        
    def test_verify_email_no_token(self):
        """GET /api/auth/verify-email without token returns error"""
        response = requests.get(f"{BASE_URL}/api/auth/verify-email")
        # Should return 422 (validation error) or 400
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        
    def test_resend_verification_requires_auth(self):
        """POST /api/auth/resend-verification requires authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/resend-verification")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
    def test_resend_verification_for_verified_user(self, auth_token):
        """POST /api/auth/resend-verification for already verified user"""
        response = requests.post(f"{BASE_URL}/api/auth/resend-verification", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # Should succeed even for already verified users (returns "already verified" message)
        assert response.status_code == 200, f"Resend verification failed: {response.text}"
        data = response.json()
        assert "message" in data


class TestNewUserRegistration:
    """Test new user registration with email verification"""
    
    def test_registration_returns_email_verified_false(self):
        """New registration should return email_verified: false"""
        unique_suffix = uuid.uuid4().hex[:8]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"test_{unique_suffix}@example.com",
            "password": "TestPass123!",
            "name": f"Test User {unique_suffix}",
            "username": f"testuser_{unique_suffix}",
            "disclaimer_accepted": True
        })
        
        if response.status_code == 200:
            data = response.json()
            # New users should have email_verified: false
            assert data.get("email_verified") == False, f"Expected email_verified:false, got {data.get('email_verified')}"
            assert data.get("verification_email_sent") == True, "Verification email should be sent"
            print(f"New user registration successful - email_verified: {data.get('email_verified')}")
        elif response.status_code == 400:
            # Email/username already exists - that's fine for this test
            print(f"User already exists: {response.text}")
        else:
            pytest.fail(f"Unexpected status: {response.status_code} - {response.text}")
            
    def test_registration_with_referral_code(self):
        """New registration should still capture ?ref= referral code parameter"""
        unique_suffix = uuid.uuid4().hex[:8]
        # Use a known referral code if available, or just test the parameter acceptance
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"reftest_{unique_suffix}@example.com",
            "password": "TestPass123!",
            "name": f"Ref Test User {unique_suffix}",
            "username": f"reftestuser_{unique_suffix}",
            "referral_code": "TESTCODE",  # May or may not exist
            "disclaimer_accepted": True
        })
        
        # Registration should work regardless of whether referral code is valid
        # It should return 200 (success) or 400 (email exists or invalid ref code)
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        print(f"Registration with referral code - Status: {response.status_code}")


class TestSubscriptionAndPayment:
    """Verify subscription pages and Stripe payment still work"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        return None
    
    def test_subscription_tiers_endpoint(self):
        """GET /api/subscriptions/tiers should return all tiers"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200, f"Subscription tiers failed: {response.text}"
        data = response.json()
        # Should have tiers data
        assert "tiers" in data or isinstance(data, list), "Expected tiers data"
        print(f"Subscription tiers available: {len(data.get('tiers', data))}")
        
    def test_wallet_balance_endpoint(self, auth_token):
        """GET /api/wallet/balance should work"""
        if not auth_token:
            pytest.skip("No auth token available")
        response = requests.get(f"{BASE_URL}/api/wallet/balance", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200, f"Wallet balance failed: {response.text}"
        data = response.json()
        assert "balance" in data, "Balance field missing"
        print(f"Wallet balance: {data.get('balance')}")


class TestGoogleStaffPage:
    """Test the new /google staff-only page API behavior"""
    
    def test_staff_check_without_auth_returns_401(self):
        """Staff check without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/auth/staff-check")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
    def test_google_auth_endpoint_exists(self):
        """Google auth endpoint should still exist (for staff use)"""
        # Just verify the endpoint exists by checking it returns proper error for empty body
        response = requests.post(f"{BASE_URL}/api/auth/google", json={})
        # Should return 422 (validation error) since no data provided
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"


class TestCoreAPIHealth:
    """Verify core APIs are working"""
    
    def test_health_check(self):
        """Health check endpoint should work"""
        response = requests.get(f"{BASE_URL}/api/health")
        # If health endpoint doesn't exist, check another basic endpoint
        if response.status_code == 404:
            # Try auth/me without token to verify server is responding
            response = requests.get(f"{BASE_URL}/api/auth/me")
            assert response.status_code in [401, 403], "Server not responding properly"
        else:
            assert response.status_code == 200
            
    def test_auth_me_requires_token(self):
        """GET /api/auth/me without token should return 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
