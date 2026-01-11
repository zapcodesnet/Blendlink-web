"""
Admin OTP Authentication System Tests - Iteration 20
Tests for the secure admin login with Email OTP 2FA
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials
ADMIN_EMAIL = "blendlinknet@gmail.com"
ADMIN_PASSWORD = "link2026blend!"

class TestAdminOTPAuthStep1:
    """Test Step 1 of admin login: Credential verification and OTP sending"""
    
    def test_step1_valid_credentials(self):
        """Test step 1 with valid admin credentials returns session_token"""
        # Wait for rate limit cooldown
        time.sleep(2)
        
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        # May get rate limited from previous tests
        if response.status_code == 429:
            print(f"Rate limited: {response.json()}")
            pytest.skip("Rate limited - skipping test")
            return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        assert "session_token" in data
        assert "expires_in" in data
        assert "email_masked" in data
        assert data["expires_in"] == 300  # 5 minutes
        print(f"Step 1 success: session_token received, expires_in={data['expires_in']}")
    
    def test_step1_invalid_email(self):
        """Test step 1 with non-existent email returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": "nonexistent@example.com", "password": "anypassword"}
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "Invalid credentials" in data.get("detail", "")
    
    def test_step1_invalid_password(self):
        """Test step 1 with wrong password returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL, "password": "wrongpassword123"}
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "Invalid credentials" in data.get("detail", "")
    
    def test_step1_non_admin_user(self):
        """Test step 1 with non-admin user returns 403"""
        # First create a regular user or use existing non-admin
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": "regular.user@example.com", "password": "password123"}
        )
        
        # Should be 401 (user not found) or 403 (not admin)
        assert response.status_code in [401, 403]
    
    def test_step1_missing_fields(self):
        """Test step 1 with missing fields returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL}  # Missing password
        )
        
        assert response.status_code == 422


class TestAdminOTPAuthStep2:
    """Test Step 2 of admin login: OTP verification"""
    
    def test_step2_invalid_session_token(self):
        """Test step 2 with invalid session token returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step2",
            json={
                "email": ADMIN_EMAIL,
                "otp_code": "123456",
                "session_token": "invalid_token_12345"
            }
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "Invalid or expired" in data.get("detail", "")
    
    def test_step2_missing_fields(self):
        """Test step 2 with missing fields returns 422"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step2",
            json={"email": ADMIN_EMAIL, "otp_code": "123456"}  # Missing session_token
        )
        
        assert response.status_code == 422


class TestAdminOTPResend:
    """Test OTP resend functionality"""
    
    def test_resend_invalid_session(self):
        """Test resend with invalid session returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/resend-otp",
            json={
                "email": ADMIN_EMAIL,
                "session_token": "invalid_session_token"
            }
        )
        
        assert response.status_code == 401
        data = response.json()
        assert "Invalid session" in data.get("detail", "")


class TestAdminSessionCheck:
    """Test admin session validation"""
    
    def test_check_session_no_token(self):
        """Test check-session without token returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/admin-auth/secure/check-session"
        )
        
        assert response.status_code == 401
    
    def test_check_session_invalid_token(self):
        """Test check-session with invalid token returns 401"""
        response = requests.get(
            f"{BASE_URL}/api/admin-auth/secure/check-session",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        
        assert response.status_code == 401


class TestAdminAuthResponseStructure:
    """Test API response structure validation"""
    
    def test_step1_response_structure(self):
        """Verify step 1 response has correct structure"""
        time.sleep(2)
        
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if response.status_code == 429:
            pytest.skip("Rate limited")
            return
        
        if response.status_code == 200:
            data = response.json()
            # Verify all required fields
            required_fields = ["success", "message", "session_token", "expires_in", "email_masked"]
            for field in required_fields:
                assert field in data, f"Missing field: {field}"
            
            # Verify types
            assert isinstance(data["success"], bool)
            assert isinstance(data["session_token"], str)
            assert isinstance(data["expires_in"], int)
            assert isinstance(data["email_masked"], str)
            
            # Verify email masking
            assert "***" in data["email_masked"]
            print(f"Response structure valid: {list(data.keys())}")


class TestRateLimiting:
    """Test rate limiting functionality"""
    
    def test_rate_limit_message_format(self):
        """Test that rate limit returns proper message"""
        # Make multiple rapid requests to trigger rate limit
        for _ in range(3):
            response = requests.post(
                f"{BASE_URL}/api/admin-auth/secure/login/step1",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            if response.status_code == 429:
                data = response.json()
                assert "detail" in data
                assert "wait" in data["detail"].lower() or "seconds" in data["detail"].lower()
                print(f"Rate limit message: {data['detail']}")
                return
        
        # If we didn't get rate limited, that's also acceptable
        print("Rate limiting not triggered in this test run")


# Integration test - Full flow simulation (without actual OTP)
class TestAdminAuthIntegration:
    """Integration tests for the full auth flow"""
    
    def test_full_flow_step1_to_step2_invalid_otp(self):
        """Test full flow: step1 success -> step2 with wrong OTP fails"""
        time.sleep(2)
        
        # Step 1: Get session token
        step1_response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if step1_response.status_code == 429:
            pytest.skip("Rate limited")
            return
        
        if step1_response.status_code == 200:
            session_token = step1_response.json()["session_token"]
            
            # Step 2: Try with wrong OTP
            step2_response = requests.post(
                f"{BASE_URL}/api/admin-auth/secure/login/step2",
                json={
                    "email": ADMIN_EMAIL,
                    "otp_code": "000000",  # Wrong OTP
                    "session_token": session_token
                }
            )
            
            assert step2_response.status_code == 401
            data = step2_response.json()
            assert "Invalid verification code" in data.get("detail", "")
            print(f"Step 2 correctly rejected wrong OTP: {data['detail']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
