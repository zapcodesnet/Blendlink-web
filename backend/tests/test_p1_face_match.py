"""
P1 Integration Tests - Face Match and UnifiedPhotoCard Features
Tests for:
1. Profile page minted photos gallery
2. MintedPhotos Card View with UnifiedPhotoCard
3. Face Match button on photos with has_face=true
4. /api/minting/photo/{mint_id}/full-stats endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@blendlink.com"
TEST_PASSWORD = "admin"
TEST_PHOTO_WITH_FACE = "mint_test_a1d75b2038d747fe"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in login response"
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestMintingPhotosEndpoint:
    """Test /api/minting/photos endpoint for minted photos list"""
    
    def test_get_minted_photos_list(self, auth_headers):
        """Test that minted photos list returns photos with required fields"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get photos: {response.text}"
        
        data = response.json()
        assert "photos" in data, "No photos key in response"
        assert "count" in data, "No count key in response"
        
        photos = data["photos"]
        assert len(photos) > 0, "No photos returned"
        print(f"Found {len(photos)} minted photos")
    
    def test_photos_have_face_detection_fields(self, auth_headers):
        """Test that photos include has_face and selfie_match fields"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        photos = response.json()["photos"]
        
        # Find the test photo with has_face=true
        test_photo = next((p for p in photos if p.get("mint_id") == TEST_PHOTO_WITH_FACE), None)
        
        if test_photo:
            # Verify face detection fields are present
            assert "has_face" in test_photo, "has_face field missing"
            assert "selfie_match_completed" in test_photo, "selfie_match_completed field missing"
            assert "selfie_match_score" in test_photo, "selfie_match_score field missing"
            
            # Verify values for test photo
            assert test_photo["has_face"] == True, f"Expected has_face=True, got {test_photo['has_face']}"
            assert test_photo["selfie_match_completed"] == False, f"Expected selfie_match_completed=False"
            
            print(f"Test photo {TEST_PHOTO_WITH_FACE}:")
            print(f"  has_face: {test_photo['has_face']}")
            print(f"  selfie_match_completed: {test_photo['selfie_match_completed']}")
            print(f"  selfie_match_score: {test_photo.get('selfie_match_score', 0)}")
        else:
            pytest.skip(f"Test photo {TEST_PHOTO_WITH_FACE} not found in user's photos")


class TestFullStatsEndpoint:
    """Test /api/minting/photo/{mint_id}/full-stats endpoint"""
    
    def test_full_stats_returns_all_fields(self, auth_headers):
        """Test that full-stats endpoint returns all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{TEST_PHOTO_WITH_FACE}/full-stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get full stats: {response.text}"
        
        data = response.json()
        
        # Required fields for UnifiedPhotoCard
        required_fields = [
            "mint_id", "name", "image_url",
            "base_dollar_value", "dollar_value",
            "scenery_type", "strength_vs", "weakness_vs",
            "level", "xp", "stars", "has_golden_frame",
            "win_streak", "lose_streak",
            "has_face", "face_detection_score", "selfie_match_completed", "selfie_match_score",
            "stamina", "current_stamina", "max_stamina",
            "total_reactions", "likes_count"
        ]
        
        missing_fields = [f for f in required_fields if f not in data]
        assert len(missing_fields) == 0, f"Missing fields: {missing_fields}"
        
        print(f"Full stats for {TEST_PHOTO_WITH_FACE}:")
        print(f"  name: {data['name']}")
        print(f"  dollar_value: ${data['dollar_value']:,}")
        print(f"  has_face: {data['has_face']}")
        print(f"  face_detection_score: {data['face_detection_score']}")
        print(f"  selfie_match_completed: {data['selfie_match_completed']}")
    
    def test_full_stats_face_detection_values(self, auth_headers):
        """Test that face detection values are correct for test photo"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{TEST_PHOTO_WITH_FACE}/full-stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify face detection fields
        assert data["has_face"] == True, f"Expected has_face=True, got {data['has_face']}"
        assert data["selfie_match_completed"] == False, f"Expected selfie_match_completed=False"
        assert data["face_detection_score"] > 0, f"Expected face_detection_score > 0"
        
        print(f"Face detection verification passed:")
        print(f"  has_face: {data['has_face']}")
        print(f"  face_detection_score: {data['face_detection_score']}")
        print(f"  selfie_match_completed: {data['selfie_match_completed']}")
        print(f"  selfie_match_attempts: {data.get('selfie_match_attempts', 0)}")
    
    def test_full_stats_authenticity_calculation(self, auth_headers):
        """Test that authenticity is calculated correctly"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{TEST_PHOTO_WITH_FACE}/full-stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify authenticity calculation
        face_score = data.get("face_detection_score", 0)
        selfie_score = data.get("selfie_match_score", 0)
        total_authenticity = data.get("total_authenticity", 0)
        
        expected_total = min(face_score + selfie_score, 10)
        assert total_authenticity == expected_total, f"Expected total_authenticity={expected_total}, got {total_authenticity}"
        
        print(f"Authenticity calculation:")
        print(f"  face_detection_score: {face_score}")
        print(f"  selfie_match_score: {selfie_score}")
        print(f"  total_authenticity: {total_authenticity}")


class TestAuthenticityStatusEndpoint:
    """Test /api/minting/photo/{mint_id}/authenticity-status endpoint"""
    
    def test_authenticity_status(self, auth_headers):
        """Test authenticity status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photo/{TEST_PHOTO_WITH_FACE}/authenticity-status",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get authenticity status: {response.text}"
        
        data = response.json()
        
        # Verify required fields
        assert "mint_id" in data
        assert "has_face" in data
        assert "face_detection_score" in data
        assert "selfie_match_score" in data
        assert "can_add_selfie" in data
        
        # For test photo with has_face=true and selfie not completed
        assert data["has_face"] == True
        assert data["can_add_selfie"] == True, "Should be able to add selfie for photo with face"
        
        print(f"Authenticity status for {TEST_PHOTO_WITH_FACE}:")
        print(f"  has_face: {data['has_face']}")
        print(f"  can_add_selfie: {data['can_add_selfie']}")
        print(f"  selfie_match_attempts: {data.get('selfie_match_attempts', 0)}")
        print(f"  max_attempts: {data.get('max_attempts', 3)}")


class TestProfileMintedPhotos:
    """Test that Profile page can fetch minted photos"""
    
    def test_profile_can_fetch_minted_photos(self, auth_headers):
        """Test that the same endpoint used by Profile page works"""
        # Profile.jsx uses api.get('/minting/photos')
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        photos = data.get("photos", [])
        
        # Verify photos have fields needed for UnifiedPhotoCard
        if len(photos) > 0:
            photo = photos[0]
            card_fields = ["mint_id", "image_url", "dollar_value", "level", "scenery_type", "stamina"]
            for field in card_fields:
                assert field in photo, f"Missing field {field} for UnifiedPhotoCard"
        
        print(f"Profile can fetch {len(photos)} minted photos")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
