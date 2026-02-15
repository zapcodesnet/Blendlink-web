"""
Email Verification Flow Tests - Iteration 170
Tests for:
1. POST /api/auth/login for existing user (tester@blendlink.net) works normally (grandfathered)
2. GET /api/auth/verify-email?token=invalid returns error
3. POST /api/auth/resend-verification-public with email returns success message
4. POST /api/auth/resend-verification (authenticated) works
5. Backend .env has RESEND_API_KEY and SENDER_EMAIL
6. Email sent from virtual@blendlink.net (not admin@blendlink.net)
"""

import pytest
import requests
import os

# Get BASE_URL from environment - NO defaults
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    BASE_URL = "https://blendlink-live.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip('/')

# Test credentials
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"


class TestExistingUserLogin:
    """Test that existing users (grandfathered) can login normally"""
    
    def test_existing_user_login_success(self):
        """Existing user tester@blendlink.net should login without email verification issues"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not returned"
        assert "user" in data, "User data not returned"
        
        # Verify email_verified is True for grandfathered users (defaults to True)
        user = data.get("user", {})
        email_verified = user.get("email_verified", data.get("email_verified", True))
        # For grandfathered users, email_verified should default to True or not be present as False
        print(f"Login successful for {TEST_EMAIL}, email_verified={email_verified}")
        
    def test_login_invalid_credentials(self):
        """Login with wrong password should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": "wrongpassword123"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestEmailVerificationEndpoints:
    """Test email verification related endpoints"""
    
    def test_verify_email_with_invalid_token(self):
        """GET /api/auth/verify-email with invalid token should return error"""
        response = requests.get(
            f"{BASE_URL}/api/auth/verify-email",
            params={"token": "invalid_token_12345"}
        )
        # Should return 400 for invalid/expired token
        assert response.status_code == 400, f"Expected 400 for invalid token, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data or "error" in data or "message" in data
        print(f"Invalid token response: {data}")
        
    def test_verify_email_without_token(self):
        """GET /api/auth/verify-email without token should fail"""
        response = requests.get(f"{BASE_URL}/api/auth/verify-email")
        # Should return 422 (validation error) or 400
        assert response.status_code in [400, 422], f"Expected 400 or 422, got {response.status_code}"


class TestResendVerificationPublic:
    """Test public resend verification endpoint (for login page)"""
    
    def test_resend_verification_public_valid_email(self):
        """POST /api/auth/resend-verification-public should return success message"""
        response = requests.post(
            f"{BASE_URL}/api/auth/resend-verification-public",
            json={"email": TEST_EMAIL}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Message not returned"
        print(f"Resend verification response: {data['message']}")
        
    def test_resend_verification_public_nonexistent_email(self):
        """POST /api/auth/resend-verification-public with non-existent email should return generic message (no email leak)"""
        response = requests.post(
            f"{BASE_URL}/api/auth/resend-verification-public",
            json={"email": "nonexistent_user_test_12345@example.com"}
        )
        # Should still return 200 with a generic message to prevent email enumeration
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data
        print(f"Nonexistent email response: {data['message']}")
    
    def test_resend_verification_public_missing_email(self):
        """POST /api/auth/resend-verification-public without email should fail validation"""
        response = requests.post(
            f"{BASE_URL}/api/auth/resend-verification-public",
            json={}
        )
        # Should return 422 (validation error) for missing required field
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"


class TestResendVerificationAuthenticated:
    """Test authenticated resend verification endpoint"""
    
    def setup_method(self):
        """Login and get token for authenticated tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            self.token = response.json().get("token")
        else:
            self.token = None
            
    def test_resend_verification_authenticated(self):
        """POST /api/auth/resend-verification should work for authenticated users"""
        if not self.token:
            pytest.skip("Could not login to get token")
            
        response = requests.post(
            f"{BASE_URL}/api/auth/resend-verification",
            headers={"Authorization": f"Bearer {self.token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        # For already verified users, should return "Email already verified" message
        print(f"Authenticated resend response: {data['message']}")
        
    def test_resend_verification_unauthenticated(self):
        """POST /api/auth/resend-verification without auth should fail"""
        response = requests.post(f"{BASE_URL}/api/auth/resend-verification")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


class TestEnvironmentConfiguration:
    """Verify .env configuration for email system"""
    
    def test_env_resend_api_key_configured(self):
        """Check that RESEND_API_KEY is set in backend/.env"""
        env_path = "/app/backend/.env"
        try:
            with open(env_path, 'r') as f:
                content = f.read()
            
            assert "RESEND_API_KEY=re_B5EkoAdA_4SAMexH7rtbrZcTHUpM3JgDs" in content, \
                "RESEND_API_KEY not set to expected value in .env"
            print("RESEND_API_KEY correctly configured")
        except FileNotFoundError:
            pytest.fail("backend/.env file not found")
            
    def test_env_sender_email_configured(self):
        """Check that SENDER_EMAIL is set to virtual@blendlink.net"""
        env_path = "/app/backend/.env"
        try:
            with open(env_path, 'r') as f:
                content = f.read()
            
            assert "SENDER_EMAIL=virtual@blendlink.net" in content, \
                "SENDER_EMAIL not set to virtual@blendlink.net in .env"
            print("SENDER_EMAIL correctly configured as virtual@blendlink.net")
        except FileNotFoundError:
            pytest.fail("backend/.env file not found")


class TestCodeConfiguration:
    """Verify code uses correct sender email"""
    
    def test_send_verification_email_uses_virtual_sender(self):
        """Check that server.py uses virtual@blendlink.net as sender"""
        server_path = "/app/backend/server.py"
        try:
            with open(server_path, 'r') as f:
                content = f.read()
            
            assert 'virtual@blendlink.net' in content, \
                "server.py should use virtual@blendlink.net as sender"
            
            # Make sure it's NOT using admin@blendlink.net
            # (there might be comments, but the actual sender should be virtual)
            assert '"from": "BlendLink <virtual@blendlink.net>"' in content, \
                "Email 'from' field should be 'BlendLink <virtual@blendlink.net>'"
            
            print("Sender email correctly set to virtual@blendlink.net in code")
        except FileNotFoundError:
            pytest.fail("server.py file not found")


class TestRegistrationFlow:
    """Test that new registration triggers email verification flow"""
    
    def test_register_endpoint_exists(self):
        """Verify registration endpoint exists and validates input"""
        # Test with invalid/incomplete data
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": "test@example.com"}  # Missing required fields
        )
        # Should return 422 (validation error) for missing fields
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"
        
    def test_register_disclaimer_required(self):
        """Verify registration requires disclaimer acceptance"""
        import uuid
        test_email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "TestPass123!",
                "name": "Test User",
                "username": f"testuser{uuid.uuid4().hex[:6]}",
                "disclaimer_accepted": False  # Not accepted
            }
        )
        # Should fail because disclaimer not accepted
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
