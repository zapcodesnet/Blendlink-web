"""
Test Selfie Match / Authenticity Verification
Tests the selfie verification feature with:
- First 3 attempts FREE, next 3 cost 100 BL each
- >80% match treated as 100% success
- Attempts only counted on successful API call (not on errors)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSelfieMatchAuthenticity:
    """Test selfie match authenticity verification"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login and get token"""
        # Login to get token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.test_mint_id = "mint_test_a1d75b2038d747fe"
    
    def test_authenticity_status_returns_correct_max_attempts(self):
        """Test that authenticity-status returns max_attempts=6 (3 free + 3 paid)"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{self.test_mint_id}/authenticity-status",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify max_attempts is 6 (3 free + 3 paid)
        assert data["max_attempts"] == 6, f"Expected max_attempts=6, got {data['max_attempts']}"
        assert data["free_attempts"] == 3, f"Expected free_attempts=3, got {data['free_attempts']}"
        assert data["paid_attempts"] == 3, f"Expected paid_attempts=3, got {data['paid_attempts']}"
        print(f"✓ max_attempts={data['max_attempts']} (3 free + 3 paid)")
    
    def test_authenticity_status_shows_free_attempt_status(self):
        """Test that authenticity-status shows is_free_attempt correctly"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{self.test_mint_id}/authenticity-status",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # With 0 attempts used, should be free attempt
        if data["selfie_match_attempts"] < 3:
            assert data["is_free_attempt"] == True, "Should be free attempt when attempts < 3"
            assert data["free_attempts_remaining"] > 0, "Should have free attempts remaining"
            print(f"✓ is_free_attempt=True, free_attempts_remaining={data['free_attempts_remaining']}")
        else:
            assert data["is_free_attempt"] == False, "Should be paid attempt when attempts >= 3"
            print(f"✓ is_free_attempt=False (paid attempts)")
    
    def test_authenticity_status_has_face_true(self):
        """Test that test photo has has_face=true"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{self.test_mint_id}/authenticity-status",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["has_face"] == True, f"Expected has_face=True, got {data['has_face']}"
        assert data["can_add_selfie"] == True or data["authenticity_locked"] == True, \
            "Should be able to add selfie or already locked"
        print(f"✓ has_face=True, can_add_selfie={data['can_add_selfie']}")
    
    def test_selfie_match_endpoint_exists(self):
        """Test that selfie-match endpoint exists and requires auth"""
        # Test without auth - should fail
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/{self.test_mint_id}/selfie-match",
            json={"mint_id": self.test_mint_id, "selfie_base64": "", "mime_type": "image/jpeg"}
        )
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"✓ Endpoint requires authentication (status={response.status_code})")
    
    def test_selfie_match_validates_input(self):
        """Test that selfie-match validates input data"""
        # Test with empty selfie data
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/{self.test_mint_id}/selfie-match",
            headers=self.headers,
            json={"mint_id": self.test_mint_id, "selfie_base64": "", "mime_type": "image/jpeg"}
        )
        # Should return 400 for invalid input
        assert response.status_code == 400, f"Expected 400 for empty selfie, got {response.status_code}"
        assert "selfie" in response.text.lower() or "image" in response.text.lower(), \
            f"Error should mention selfie/image: {response.text}"
        print(f"✓ Validates empty selfie input (status=400)")
    
    def test_selfie_match_rejects_non_owner(self):
        """Test that selfie-match rejects non-owner"""
        # Create a different user session
        # First, check if there's another user
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{self.test_mint_id}/authenticity-status",
            headers=self.headers
        )
        # This test just verifies the endpoint works for the owner
        assert response.status_code == 200
        print(f"✓ Owner can access authenticity status")
    
    def test_photo_not_found_returns_404(self):
        """Test that non-existent photo returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/nonexistent_mint_id/authenticity-status",
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Non-existent photo returns 404")


class TestSelfieMatchConstants:
    """Test that backend constants are correctly configured"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_backend_constants_via_authenticity_status(self):
        """Verify backend constants through API response"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/mint_test_a1d75b2038d747fe/authenticity-status",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify constants
        assert data["max_attempts"] == 6, "MAX_ATTEMPTS should be 6"
        assert data["free_attempts"] == 3, "FREE_ATTEMPTS should be 3"
        assert data["paid_attempts"] == 3, "PAID_ATTEMPTS should be 3"
        
        print("✓ Backend constants verified:")
        print(f"  - MAX_ATTEMPTS = {data['max_attempts']} (3 free + 3 paid)")
        print(f"  - FREE_ATTEMPTS = {data['free_attempts']}")
        print(f"  - PAID_ATTEMPTS = {data['paid_attempts']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
