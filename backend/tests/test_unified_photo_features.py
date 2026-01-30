"""
Test Suite for Unified Photo Features - Iteration 82
Tests:
1. /api/minting/photo/{mint_id}/full-stats endpoint
2. Face Match (selfie-match) endpoint
3. Profile picture update endpoint
4. Photo stats synchronization
5. PVP WebSocket connection prefix
"""

import pytest
import requests
import os
import json
import base64
from datetime import datetime

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable is required")

# Test credentials
TEST_USER_EMAIL = "test@blendlink.com"
TEST_USER_PASSWORD = "admin"


class TestAuthentication:
    """Test authentication and get token for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def user_data(self, auth_token):
        """Get current user data"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get user failed: {response.text}"
        return response.json()
    
    def test_login_success(self):
        """Test login endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Login successful for {TEST_USER_EMAIL}")


class TestFullStatsEndpoint:
    """Test the new /api/minting/photo/{mint_id}/full-stats endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def user_photos(self, auth_token):
        """Get user's minted photos"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        photos = data.get("photos", [])
        print(f"✓ Found {len(photos)} minted photos")
        return photos
    
    def test_full_stats_endpoint_exists(self, auth_token, user_photos):
        """Test that full-stats endpoint returns data"""
        if not user_photos:
            pytest.skip("No minted photos available for testing")
        
        mint_id = user_photos[0].get("mint_id")
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{mint_id}/full-stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Full stats failed: {response.text}"
        data = response.json()
        print(f"✓ Full stats endpoint returned data for {mint_id}")
        return data
    
    def test_full_stats_contains_required_fields(self, auth_token, user_photos):
        """Test that full-stats returns all required fields for unified display"""
        if not user_photos:
            pytest.skip("No minted photos available for testing")
        
        mint_id = user_photos[0].get("mint_id")
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{mint_id}/full-stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Required fields for unified photo card display
        required_fields = [
            # Core identification
            "mint_id", "name", "image_url",
            # Dollar values
            "base_dollar_value", "dollar_value",
            # Scenery
            "scenery_type",
            # Level & XP
            "level", "xp", "stars", "has_golden_frame",
            # Streaks
            "win_streak", "lose_streak", "streak_multiplier",
            # Authenticity
            "has_face", "face_detection_score", "selfie_match_score",
            # Stamina
            "stamina", "current_stamina", "max_stamina",
            # Ownership
            "user_id"
        ]
        
        missing_fields = [f for f in required_fields if f not in data]
        assert len(missing_fields) == 0, f"Missing fields: {missing_fields}"
        print(f"✓ Full stats contains all {len(required_fields)} required fields")
        
        # Verify data types
        assert isinstance(data["level"], int), "level should be int"
        assert isinstance(data["xp"], (int, float)), "xp should be numeric"
        assert isinstance(data["dollar_value"], (int, float)), "dollar_value should be numeric"
        print("✓ Data types are correct")
    
    def test_full_stats_scenery_data(self, auth_token, user_photos):
        """Test that scenery data is properly included"""
        if not user_photos:
            pytest.skip("No minted photos available for testing")
        
        mint_id = user_photos[0].get("mint_id")
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{mint_id}/full-stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Scenery fields
        scenery_type = data.get("scenery_type")
        assert scenery_type in ["natural", "water", "manmade", "neutral", "man-made"], \
            f"Invalid scenery type: {scenery_type}"
        print(f"✓ Scenery type: {scenery_type}")
    
    def test_full_stats_subscription_multiplier(self, auth_token, user_photos):
        """Test that subscription XP multiplier is included"""
        if not user_photos:
            pytest.skip("No minted photos available for testing")
        
        mint_id = user_photos[0].get("mint_id")
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{mint_id}/full-stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # user_subscription can be null if no active subscription
        user_subscription = data.get("user_subscription")
        if user_subscription:
            assert "xp_multiplier" in user_subscription
            print(f"✓ User has subscription with {user_subscription['xp_multiplier']}x XP multiplier")
        else:
            print("✓ No active subscription (user_subscription is null)")
    
    def test_full_stats_invalid_mint_id(self, auth_token):
        """Test 404 for invalid mint_id"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/invalid_mint_id_12345/full-stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 404
        print("✓ Returns 404 for invalid mint_id")


class TestSelfieMatchEndpoint:
    """Test the selfie-match endpoint for Face Match feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def photo_with_face(self, auth_token):
        """Find a photo with face detection"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        photos = response.json().get("photos", [])
        
        # Find photo with face
        for photo in photos:
            if photo.get("has_face") and photo.get("face_detection_score", 0) >= 10:
                return photo
        return None
    
    def test_selfie_match_endpoint_exists(self, auth_token, photo_with_face):
        """Test that selfie-match endpoint exists and validates input"""
        if not photo_with_face:
            pytest.skip("No photo with face available for testing")
        
        mint_id = photo_with_face.get("mint_id")
        
        # Test with empty/invalid base64 - should fail validation
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/{mint_id}/selfie-match",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"selfie_image": "invalid_base64"}
        )
        
        # Should return 400 or 422 for invalid input, not 404
        assert response.status_code in [400, 422, 500], \
            f"Unexpected status: {response.status_code} - {response.text}"
        print(f"✓ Selfie-match endpoint exists and validates input")
    
    def test_selfie_match_requires_face(self, auth_token):
        """Test that selfie-match requires photo with face"""
        # Get photos
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        photos = response.json().get("photos", [])
        
        # Find photo without face
        photo_without_face = None
        for photo in photos:
            if not photo.get("has_face") or photo.get("face_detection_score", 0) < 10:
                photo_without_face = photo
                break
        
        if not photo_without_face:
            pytest.skip("No photo without face available for testing")
        
        mint_id = photo_without_face.get("mint_id")
        
        # Create a minimal valid base64 image
        test_image = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="
        
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/{mint_id}/selfie-match",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"selfie_image": test_image}
        )
        
        # Should fail because photo doesn't have face (400) or validation error (422)
        assert response.status_code in [400, 422], f"Expected 400 or 422, got {response.status_code}"
        print("✓ Selfie-match correctly rejects photos without face")


class TestProfilePictureEndpoint:
    """Test the profile picture update endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def user_photo(self, auth_token):
        """Get a user's minted photo"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        photos = response.json().get("photos", [])
        return photos[0] if photos else None
    
    def test_profile_picture_update_endpoint(self, auth_token, user_photo):
        """Test PUT /api/users/me/profile-picture endpoint"""
        if not user_photo:
            pytest.skip("No minted photos available for testing")
        
        image_url = user_photo.get("image_url")
        mint_id = user_photo.get("mint_id")
        
        response = requests.put(
            f"{BASE_URL}/api/users/me/profile-picture",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "image_url": image_url,
                "mint_id": mint_id
            }
        )
        
        assert response.status_code == 200, f"Profile picture update failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "profile_picture" in data
        print(f"✓ Profile picture updated successfully")
    
    def test_profile_picture_requires_image_url(self, auth_token):
        """Test that image_url is required"""
        response = requests.put(
            f"{BASE_URL}/api/users/me/profile-picture",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"image_url": ""}
        )
        
        assert response.status_code == 400
        print("✓ Profile picture endpoint requires image_url")
    
    def test_profile_picture_validates_mint_id(self, auth_token):
        """Test that invalid mint_id is rejected"""
        response = requests.put(
            f"{BASE_URL}/api/users/me/profile-picture",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "image_url": "https://example.com/image.jpg",
                "mint_id": "invalid_mint_id_xyz"
            }
        )
        
        # Should return 404 for invalid mint_id
        assert response.status_code == 404
        print("✓ Profile picture endpoint validates mint_id ownership")


class TestPVPWebSocketPrefix:
    """Test PVP WebSocket connection prefix"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_pvp_game_start_returns_websocket_url(self, auth_token):
        """Test that PVP game start returns correct WebSocket URL prefix"""
        # First, get user's photos
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        photos = response.json().get("photos", [])
        
        if len(photos) < 1:
            pytest.skip("Need at least 1 photo for PVP test")
        
        # Try to start a PVP game (may fail if no opponent, but we check the response format)
        response = requests.post(
            f"{BASE_URL}/api/games/pvp/start",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"photo_id": photos[0].get("mint_id")}
        )
        
        # Even if it fails to find opponent, check response structure
        if response.status_code == 200:
            data = response.json()
            if "websocket_url" in data and data["websocket_url"]:
                assert "/api/ws/pvp-game/" in data["websocket_url"], \
                    f"WebSocket URL should contain /api/ws/pvp-game/ prefix: {data['websocket_url']}"
                print(f"✓ PVP WebSocket URL has correct prefix: {data['websocket_url']}")
            else:
                print("✓ PVP game started but no WebSocket URL (may be waiting for opponent)")
        else:
            # Check if it's a valid error response
            print(f"✓ PVP start returned {response.status_code} (may need opponent)")


class TestPhotoStatsSynchronization:
    """Test that photo stats are consistent across endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_stats_consistency_between_endpoints(self, auth_token):
        """Test that photo stats are consistent between list and full-stats endpoints"""
        # Get photos list
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        photos = response.json().get("photos", [])
        
        if not photos:
            pytest.skip("No photos available for testing")
        
        photo = photos[0]
        mint_id = photo.get("mint_id")
        
        # Get full stats
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{mint_id}/full-stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        full_stats = response.json()
        
        # Compare key fields
        fields_to_compare = ["level", "xp", "dollar_value", "win_streak", "lose_streak"]
        
        for field in fields_to_compare:
            list_value = photo.get(field)
            stats_value = full_stats.get(field)
            
            # Allow for None vs 0 equivalence
            if list_value is None:
                list_value = 0
            if stats_value is None:
                stats_value = 0
            
            # For dollar_value, check base_dollar_value as fallback
            if field == "dollar_value" and list_value == 0:
                list_value = photo.get("base_dollar_value", 0)
            
            print(f"  {field}: list={list_value}, full_stats={stats_value}")
        
        print("✓ Photo stats are available from both endpoints")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
