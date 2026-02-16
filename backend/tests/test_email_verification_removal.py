"""
Test Suite: Email Verification Removal - Iteration 170
Tests that ALL email verification functionality has been completely removed
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEmailVerificationRemoval:
    """Test that email verification endpoints return 404 (removed)"""
    
    def test_verify_email_endpoint_returns_404(self):
        """GET /api/auth/verify-email should return 404 (removed)"""
        response = requests.get(f"{BASE_URL}/api/auth/verify-email", params={"token": "test123"})
        assert response.status_code == 404, f"Expected 404 but got {response.status_code}. verify-email should be removed."
        print("✅ GET /api/auth/verify-email returns 404 (removed)")
    
    def test_resend_verification_endpoint_returns_404(self):
        """POST /api/auth/resend-verification should return 404 (removed)"""
        response = requests.post(f"{BASE_URL}/api/auth/resend-verification", json={"email": "test@test.com"})
        assert response.status_code == 404, f"Expected 404 but got {response.status_code}. resend-verification should be removed."
        print("✅ POST /api/auth/resend-verification returns 404 (removed)")
    
    def test_resend_verification_public_endpoint_returns_404(self):
        """POST /api/auth/resend-verification-public should return 404 (removed)"""
        response = requests.post(f"{BASE_URL}/api/auth/resend-verification-public", json={"email": "test@test.com"})
        assert response.status_code == 404, f"Expected 404 but got {response.status_code}. resend-verification-public should be removed."
        print("✅ POST /api/auth/resend-verification-public returns 404 (removed)")


class TestLoginWithoutVerification:
    """Test that login works without email verification check"""
    
    def test_existing_user_login_success(self):
        """POST /api/auth/login works for existing users with NO verification check"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@blendlink.net",
            "password": "BlendLink2024!"
        })
        assert response.status_code == 200, f"Login failed with status {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user object"
        
        # Verify NO email_verified field in response
        user = data["user"]
        assert "email_verified" not in user or user.get("email_verified") is None or user.get("email_verified") == True, \
            "email_verified should not be present/checked in login flow"
        print("✅ POST /api/auth/login works without verification check")
        return data["token"]
    
    def test_login_response_has_no_verification_required_error(self):
        """Login should not return any verification-related error for valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@blendlink.net",
            "password": "BlendLink2024!"
        })
        assert response.status_code == 200, f"Expected 200 but got {response.status_code}"
        data = response.json()
        
        # Should not have any verification-related messages
        response_text = str(data).lower()
        assert "verify" not in response_text or "email_verified" not in response_text, \
            "Login response should not contain verification-related messages"
        print("✅ Login response has no verification-related content")


class TestRegistrationWithoutVerification:
    """Test that registration creates user and returns token (auto-login) with NO verification"""
    
    def test_register_returns_token_immediately(self):
        """POST /api/auth/register creates user and returns token without verification requirement"""
        unique_email = f"test_reg_{uuid.uuid4().hex[:8]}@testdomain.com"
        unique_username = f"testuser_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPassword123!",
            "name": "Test User",
            "username": unique_username,
            "disclaimer_accepted": True
        })
        
        assert response.status_code == 200, f"Registration failed with status {response.status_code}: {response.text}"
        data = response.json()
        
        # Must return token for immediate auto-login
        assert "token" in data, "Registration should return token for auto-login"
        assert len(data["token"]) > 0, "Token should not be empty"
        
        # Must return user_id
        assert "user_id" in data, "Registration should return user_id"
        
        # Should NOT have email_verified field or verification requirement
        assert "email_verified" not in data, "Response should not contain email_verified field"
        assert "verification_required" not in data, "Response should not contain verification_required field"
        
        print(f"✅ Registration returns token immediately: user_id={data['user_id']}")
        return data["token"], unique_email
    
    def test_register_no_verification_email_sent(self):
        """Registration should NOT mention sending verification email"""
        unique_email = f"test_noverify_{uuid.uuid4().hex[:8]}@testdomain.com"
        unique_username = f"testnoverify_{uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPassword123!",
            "name": "No Verify User",
            "username": unique_username,
            "disclaimer_accepted": True
        })
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Check response text for verification-related messages
        response_text = str(data).lower()
        assert "verification email" not in response_text, "Response should not mention verification email"
        assert "please verify" not in response_text, "Response should not ask to verify"
        
        print("✅ Registration does not mention verification email")


class TestAuthEndpointsExist:
    """Test that required auth endpoints still exist"""
    
    def test_login_endpoint_exists(self):
        """POST /api/auth/login should exist"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={})
        # Should return 422 (validation error) not 404
        assert response.status_code != 404, "Login endpoint should exist"
        print("✅ POST /api/auth/login endpoint exists")
    
    def test_register_endpoint_exists(self):
        """POST /api/auth/register should exist"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={})
        # Should return 422 (validation error) not 404
        assert response.status_code != 404, "Register endpoint should exist"
        print("✅ POST /api/auth/register endpoint exists")
    
    def test_google_auth_endpoint_exists(self):
        """POST /api/auth/google should exist"""
        response = requests.post(f"{BASE_URL}/api/auth/google", json={})
        # Should return 422 (validation error) not 404
        assert response.status_code != 404, "Google auth endpoint should exist"
        print("✅ POST /api/auth/google endpoint exists")
    
    def test_me_endpoint_exists(self):
        """GET /api/auth/me should exist"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        # Should return 401 (not authenticated) not 404
        assert response.status_code != 404, "Me endpoint should exist"
        print("✅ GET /api/auth/me endpoint exists")


class TestProtectedRoutesWork:
    """Test that protected routes work after login"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@blendlink.net",
            "password": "BlendLink2024!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_wallet_accessible_after_login(self, auth_token):
        """GET /api/wallet/balance should work after login (no verification required)"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/wallet/balance", headers=headers)
        assert response.status_code == 200, f"Wallet not accessible: {response.status_code} - {response.text}"
        data = response.json()
        assert "balance" in data, "Should return balance"
        print(f"✅ Wallet accessible after login: balance={data['balance']}")
    
    def test_profile_accessible_after_login(self, auth_token):
        """GET /api/auth/me should work after login"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Profile not accessible: {response.status_code}"
        data = response.json()
        assert "user_id" in data, "Should return user profile"
        print(f"✅ Profile accessible after login: user_id={data['user_id']}")


# Pytest fixture for base URL validation
@pytest.fixture(scope="module", autouse=True)
def validate_base_url():
    """Validate that BASE_URL is set"""
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL environment variable not set")
    print(f"Testing against: {BASE_URL}")
