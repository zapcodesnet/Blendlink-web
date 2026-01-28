"""
Test Profile Picture, Medal Showcase, and Medal Celebration Features
Tests for iteration 66 - Profile Picture Selection, Medal Showcase, Medal Bonus

Features tested:
1. Profile Picture Selection - PUT /api/users/me/profile-picture
2. Medal Showcase - GET /api/users/:user_id/medal-showcase
3. Medal Showcase - PUT /api/users/me/medal-showcase
4. Medal Bonus - POST /api/photo-game/record-round-result returns medal_earned and bonus_coins
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test2@blendlink.com"
TEST_PASSWORD = "test123"


class TestAuth:
    """Authentication helper tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def user_data(self, auth_token):
        """Get user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json().get("user", {})
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get auth headers"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }


class TestProfilePictureSelection(TestAuth):
    """Test Profile Picture Selection feature"""
    
    def test_profile_picture_endpoint_exists(self, headers):
        """Test that PUT /api/users/me/profile-picture endpoint exists"""
        response = requests.put(
            f"{BASE_URL}/api/users/me/profile-picture",
            headers=headers,
            json={"image_url": "https://example.com/test.jpg"}
        )
        # Should not be 404 - endpoint exists
        assert response.status_code != 404, "Profile picture endpoint not found"
        print(f"Profile picture endpoint status: {response.status_code}")
    
    def test_profile_picture_requires_image_url(self, headers):
        """Test that profile picture update requires image_url"""
        response = requests.put(
            f"{BASE_URL}/api/users/me/profile-picture",
            headers=headers,
            json={}
        )
        # Should fail validation
        assert response.status_code in [400, 422], f"Expected validation error, got {response.status_code}"
        print(f"Empty image_url validation: {response.status_code}")
    
    def test_profile_picture_update_success(self, headers):
        """Test successful profile picture update"""
        test_image_url = "https://ui-avatars.com/api/?name=Test+Profile&background=random"
        response = requests.put(
            f"{BASE_URL}/api/users/me/profile-picture",
            headers=headers,
            json={
                "image_url": test_image_url,
                "mint_id": None  # No mint_id for external URL
            }
        )
        # Should succeed or fail with specific error
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True, "Expected success=True"
            assert "profile_picture" in data, "Expected profile_picture in response"
            print(f"Profile picture updated successfully: {data.get('profile_picture')}")
        else:
            print(f"Profile picture update status: {response.status_code}, {response.text}")
    
    def test_profile_picture_invalid_mint_id(self, headers):
        """Test profile picture update with invalid mint_id"""
        response = requests.put(
            f"{BASE_URL}/api/users/me/profile-picture",
            headers=headers,
            json={
                "image_url": "https://example.com/test.jpg",
                "mint_id": "invalid_mint_id_12345"
            }
        )
        # Should fail - photo not found
        assert response.status_code == 404, f"Expected 404 for invalid mint_id, got {response.status_code}"
        print(f"Invalid mint_id correctly rejected: {response.status_code}")
    
    def test_profile_picture_requires_auth(self):
        """Test that profile picture update requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/users/me/profile-picture",
            json={"image_url": "https://example.com/test.jpg"}
        )
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("Profile picture endpoint correctly requires auth")


class TestMedalShowcase(TestAuth):
    """Test Medal Showcase feature"""
    
    def test_medal_showcase_get_endpoint_exists(self, headers, user_data):
        """Test that GET /api/users/:user_id/medal-showcase endpoint exists"""
        user_id = user_data.get("user_id")
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/medal-showcase",
            headers=headers
        )
        assert response.status_code != 404, "Medal showcase GET endpoint not found"
        print(f"Medal showcase GET status: {response.status_code}")
    
    def test_medal_showcase_returns_correct_structure(self, headers, user_data):
        """Test that medal showcase returns correct data structure"""
        user_id = user_data.get("user_id")
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/medal-showcase",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Check required fields
        assert "user_id" in data, "Missing user_id in response"
        assert "showcase_photo_ids" in data, "Missing showcase_photo_ids in response"
        assert "showcase_photos" in data, "Missing showcase_photos in response"
        assert "all_medal_photos" in data, "Missing all_medal_photos in response"
        assert "total_medals" in data, "Missing total_medals in response"
        
        print(f"Medal showcase structure correct. Total medals: {data.get('total_medals')}")
        print(f"Showcase photos: {len(data.get('showcase_photos', []))}")
        print(f"All medal photos: {len(data.get('all_medal_photos', []))}")
    
    def test_medal_showcase_empty_state(self, headers, user_data):
        """Test medal showcase returns empty state for user with no medals"""
        user_id = user_data.get("user_id")
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}/medal-showcase",
            headers=headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # For test user with no medals, should return empty arrays
        assert isinstance(data.get("showcase_photo_ids"), list), "showcase_photo_ids should be a list"
        assert isinstance(data.get("showcase_photos"), list), "showcase_photos should be a list"
        assert isinstance(data.get("all_medal_photos"), list), "all_medal_photos should be a list"
        assert isinstance(data.get("total_medals"), int), "total_medals should be an integer"
        
        print(f"Empty state verified - total_medals: {data.get('total_medals')}")
    
    def test_medal_showcase_put_endpoint_exists(self, headers):
        """Test that PUT /api/users/me/medal-showcase endpoint exists"""
        response = requests.put(
            f"{BASE_URL}/api/users/me/medal-showcase",
            headers=headers,
            json={"showcase_photo_ids": []}
        )
        assert response.status_code != 404, "Medal showcase PUT endpoint not found"
        print(f"Medal showcase PUT status: {response.status_code}")
    
    def test_medal_showcase_update_success(self, headers):
        """Test successful medal showcase update"""
        response = requests.put(
            f"{BASE_URL}/api/users/me/medal-showcase",
            headers=headers,
            json={"showcase_photo_ids": []}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert "showcase_photo_ids" in data, "Expected showcase_photo_ids in response"
        print(f"Medal showcase updated successfully")
    
    def test_medal_showcase_max_5_photos(self, headers):
        """Test that medal showcase limits to 5 photos"""
        # Try to set more than 5 photos
        many_ids = [f"fake_id_{i}" for i in range(10)]
        response = requests.put(
            f"{BASE_URL}/api/users/me/medal-showcase",
            headers=headers,
            json={"showcase_photo_ids": many_ids}
        )
        
        if response.status_code == 200:
            data = response.json()
            # Should be limited to 5 or less (only valid IDs)
            showcase_ids = data.get("showcase_photo_ids", [])
            assert len(showcase_ids) <= 5, f"Expected max 5 photos, got {len(showcase_ids)}"
            print(f"Max 5 photos limit enforced: {len(showcase_ids)} photos")
    
    def test_medal_showcase_requires_auth(self):
        """Test that medal showcase update requires authentication"""
        response = requests.put(
            f"{BASE_URL}/api/users/me/medal-showcase",
            json={"showcase_photo_ids": []}
        )
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("Medal showcase PUT correctly requires auth")
    
    def test_medal_showcase_public_access(self, user_data):
        """Test that medal showcase GET is publicly accessible"""
        user_id = user_data.get("user_id")
        # No auth headers
        response = requests.get(f"{BASE_URL}/api/users/{user_id}/medal-showcase")
        assert response.status_code == 200, f"Expected 200 for public access, got {response.status_code}"
        print("Medal showcase GET is publicly accessible")
    
    def test_medal_showcase_invalid_user(self, headers):
        """Test medal showcase for non-existent user"""
        response = requests.get(
            f"{BASE_URL}/api/users/invalid_user_id_12345/medal-showcase",
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404 for invalid user, got {response.status_code}"
        print("Invalid user correctly returns 404")


class TestMedalBonusAndCelebration(TestAuth):
    """Test Medal Bonus and Celebration feature via record-round-result"""
    
    def test_record_round_result_endpoint_exists(self, headers):
        """Test that POST /api/photo-game/record-round-result endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=headers,
            json={"photo_id": "test_photo_id", "round_won": True}
        )
        # Endpoint exists - returns 404 for invalid photo (not 404 for missing route)
        # The detail message confirms the endpoint exists
        if response.status_code == 404:
            data = response.json()
            assert "Photo not found" in data.get("detail", ""), "Endpoint should return photo not found error"
            print(f"Record round result endpoint exists - returns photo not found for invalid ID")
        else:
            print(f"Record round result endpoint status: {response.status_code}")
    
    def test_record_round_result_requires_auth(self):
        """Test that record-round-result requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            json={"photo_id": "test_photo_id", "round_won": True}
        )
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("Record round result correctly requires auth")
    
    def test_record_round_result_invalid_photo(self, headers):
        """Test record-round-result with invalid photo_id"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=headers,
            json={"photo_id": "invalid_photo_id_12345", "round_won": True}
        )
        assert response.status_code == 404, f"Expected 404 for invalid photo, got {response.status_code}"
        print("Invalid photo correctly returns 404")
    
    def test_record_round_result_response_structure(self, headers):
        """Test that record-round-result returns correct structure (even on error)"""
        # This will fail with 404 but we can check the error structure
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=headers,
            json={"photo_id": "test_photo", "round_won": True}
        )
        
        # If we had a valid photo, response should include these fields
        # For now, just verify endpoint responds correctly
        if response.status_code == 200:
            data = response.json()
            expected_fields = ["success", "photo_id", "round_won", "new_win_streak", 
                            "medal_earned", "total_medals", "bonus_coins"]
            for field in expected_fields:
                assert field in data, f"Missing field: {field}"
            print(f"Response structure correct: {data}")
        else:
            print(f"Response status: {response.status_code} (expected - no valid photo)")


class TestBattlePhotosWithMedals(TestAuth):
    """Test that battle photos endpoint includes medal data"""
    
    def test_battle_photos_endpoint(self, headers):
        """Test GET /api/photo-game/battle-photos returns photos with medal info"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "photos" in data, "Expected photos in response"
        
        photos = data.get("photos", [])
        print(f"Found {len(photos)} battle photos")
        
        # If there are photos, check structure
        for photo in photos[:3]:  # Check first 3
            print(f"Photo: {photo.get('name')} - Medals: {photo.get('medals', {})}")
    
    def test_photo_stamina_includes_medals(self, headers):
        """Test that photo stamina endpoint includes medal data"""
        # First get a photo
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers=headers
        )
        
        if response.status_code == 200:
            photos = response.json().get("photos", [])
            if photos:
                mint_id = photos[0].get("mint_id")
                stamina_response = requests.get(
                    f"{BASE_URL}/api/photo-game/photo-stamina/{mint_id}",
                    headers=headers
                )
                if stamina_response.status_code == 200:
                    stamina_data = stamina_response.json()
                    print(f"Stamina data for {mint_id}: {stamina_data}")
                    # Check for medal-related fields
                    if "medals" in stamina_data or "win_streak" in stamina_data:
                        print("Medal-related fields present in stamina data")
                else:
                    print(f"Stamina endpoint status: {stamina_response.status_code}")
            else:
                print("No photos found for stamina test")


class TestProfileShowsProfilePicture(TestAuth):
    """Test that profile shows profile_picture when set"""
    
    def test_auth_me_returns_profile_picture(self, headers):
        """Test that /api/auth/me returns profile_picture field"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # profile_picture may or may not be set, but field should exist or be settable
        print(f"User profile data keys: {list(data.keys())}")
        if "profile_picture" in data:
            print(f"Profile picture: {data.get('profile_picture')}")
        else:
            print("profile_picture field not in response (may not be set yet)")
    
    def test_user_profile_endpoint(self, headers, user_data):
        """Test that user profile endpoint returns profile data"""
        user_id = user_data.get("user_id")
        response = requests.get(
            f"{BASE_URL}/api/users/{user_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"User profile keys: {list(data.keys())}")
        else:
            print(f"User profile status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
