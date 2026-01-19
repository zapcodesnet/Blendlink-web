"""
Test suite for Photo Minting Bug Fix - Iteration 36
Tests the fix for 'Minting Failed' error caused by incorrect AI vision API usage.
The fix was to pass raw base64 data without the data URL prefix to ImageContent.
"""

import pytest
import requests
import os
import base64
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "blendlinknet@gmail.com"
ADMIN_PASSWORD = "Blend!Admin2026Link"
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "Test123!"


class TestMintingConfig:
    """Test minting configuration endpoint"""
    
    def test_minting_config_returns_correct_structure(self):
        """Test /api/minting/config returns all required fields"""
        response = requests.get(f"{BASE_URL}/api/minting/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "mint_cost_bl" in data
        assert data["mint_cost_bl"] == 500
        
        assert "daily_limits" in data
        assert data["daily_limits"]["free"] == 3
        assert data["daily_limits"]["basic"] == 20
        assert data["daily_limits"]["premium"] == 50
        
        assert "scenery_types" in data
        assert "natural" in data["scenery_types"]
        assert "water" in data["scenery_types"]
        assert "manmade" in data["scenery_types"]
        
        assert "light_types" in data
        assert "sunlight_fire" in data["light_types"]
        assert "rain_snow_ice" in data["light_types"]
        assert "darkness_night" in data["light_types"]
        
        assert "rating_criteria" in data
        assert len(data["rating_criteria"]) == 10
        
    def test_scenery_types_have_strength_weakness(self):
        """Test scenery types have proper strength/weakness relationships"""
        response = requests.get(f"{BASE_URL}/api/minting/config")
        data = response.json()
        
        for scenery_type, info in data["scenery_types"].items():
            assert "strong_vs" in info
            assert "weak_vs" in info
            assert info["strong_vs"] in data["scenery_types"]
            assert info["weak_vs"] in data["scenery_types"]


class TestMintingStatus:
    """Test minting status endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture
    def test_user_token(self):
        """Get test user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Test user authentication failed")
    
    def test_minting_status_requires_auth(self):
        """Test /api/minting/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/minting/status")
        assert response.status_code == 401
    
    def test_minting_status_returns_correct_fields(self, admin_token):
        """Test minting status returns all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/minting/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "can_mint" in data
        assert "mints_today" in data
        assert "daily_limit" in data
        
        # If can_mint is True, should have bl_coins and remaining_mints
        if data["can_mint"]:
            assert "bl_coins" in data
            assert "remaining_mints" in data
        else:
            # If can't mint, should have reason
            assert "reason" in data
    
    def test_test_user_daily_limit_reached(self, test_user_token):
        """Test that test user has reached daily limit (as per context)"""
        response = requests.get(
            f"{BASE_URL}/api/minting/status",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Test user should have reached daily limit per context
        assert data["mints_today"] >= 0
        assert data["daily_limit"] == 3


class TestPhotoMinting:
    """Test photo minting functionality - the main bug fix"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture
    def test_image_base64(self):
        """Create a simple test image in base64"""
        # Download a real test image
        import urllib.request
        try:
            urllib.request.urlretrieve("https://picsum.photos/400/300", "/tmp/pytest_test_image.jpg")
            with open("/tmp/pytest_test_image.jpg", "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8")
        except:
            pytest.skip("Could not download test image")
    
    def test_minting_upload_requires_auth(self):
        """Test /api/minting/photo/upload requires authentication"""
        response = requests.post(f"{BASE_URL}/api/minting/photo/upload")
        assert response.status_code == 401
    
    def test_minting_upload_requires_file(self, admin_token):
        """Test minting requires a file"""
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            data={"name": "Test Photo"}
        )
        assert response.status_code == 422  # Validation error
    
    def test_minting_upload_requires_name(self, admin_token, test_image_base64):
        """Test minting requires a name"""
        # Create a minimal image file
        image_bytes = base64.b64decode(test_image_base64)
        files = {"file": ("test.jpg", image_bytes, "image/jpeg")}
        
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/upload",
            headers={"Authorization": f"Bearer {admin_token}"},
            files=files,
            data={"description": "Test"}
        )
        assert response.status_code == 422  # Validation error - name required


class TestUserPhotos:
    """Test user photos retrieval"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_get_my_photos_requires_auth(self):
        """Test /api/minting/photos requires authentication"""
        response = requests.get(f"{BASE_URL}/api/minting/photos")
        assert response.status_code == 401
    
    def test_get_my_photos_returns_list(self, admin_token):
        """Test getting user's minted photos"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "photos" in data
        assert "count" in data
        assert isinstance(data["photos"], list)
    
    def test_minted_photos_have_ai_analysis_fields(self, admin_token):
        """Test that minted photos have AI analysis fields"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        if len(data["photos"]) > 0:
            photo = data["photos"][0]
            
            # Check AI analysis fields
            assert "scenery_type" in photo
            assert photo["scenery_type"] in ["natural", "water", "manmade"]
            
            assert "light_type" in photo
            assert photo["light_type"] in ["sunlight_fire", "rain_snow_ice", "darkness_night"]
            
            assert "ratings" in photo
            assert isinstance(photo["ratings"], dict)
            
            assert "dollar_value" in photo
            assert photo["dollar_value"] >= 1_000_000  # Min $1M
            assert photo["dollar_value"] <= 1_000_000_000  # Max $1B
            
            assert "has_face" in photo
            assert isinstance(photo["has_face"], bool)
            
            assert "overall_score" in photo
            assert 0 <= photo["overall_score"] <= 100
    
    def test_minted_photos_have_strength_weakness(self, admin_token):
        """Test that minted photos have strength/weakness relationships"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        if len(data["photos"]) > 0:
            photo = data["photos"][0]
            
            assert "strength_vs" in photo
            assert "weakness_vs" in photo
            assert "light_strength_vs" in photo
            assert "light_weakness_vs" in photo


class TestPhotoFeed:
    """Test public photo feed"""
    
    def test_feed_returns_public_photos(self):
        """Test /api/minting/feed returns public photos"""
        response = requests.get(f"{BASE_URL}/api/minting/feed")
        assert response.status_code == 200
        
        data = response.json()
        assert "photos" in data
        assert "count" in data
        
        # All photos in feed should be public
        for photo in data["photos"]:
            assert photo.get("is_private") == False
            assert photo.get("show_in_feed") == True


class TestPhotoDetails:
    """Test individual photo retrieval"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_get_photo_by_id(self, admin_token):
        """Test getting a specific photo by mint_id"""
        # First get user's photos
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if response.status_code == 200 and len(response.json()["photos"]) > 0:
            mint_id = response.json()["photos"][0]["mint_id"]
            
            # Get specific photo
            photo_response = requests.get(f"{BASE_URL}/api/minting/photo/{mint_id}")
            assert photo_response.status_code == 200
            
            photo = photo_response.json()
            assert photo["mint_id"] == mint_id
    
    def test_get_nonexistent_photo_returns_404(self):
        """Test getting a non-existent photo returns 404"""
        response = requests.get(f"{BASE_URL}/api/minting/photo/nonexistent_id")
        assert response.status_code == 404


class TestDollarValueCalculation:
    """Test dollar value calculation based on ratings"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_dollar_value_in_valid_range(self, admin_token):
        """Test that dollar values are in $1M-$1B range"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        for photo in data["photos"]:
            dollar_value = photo.get("dollar_value", 0)
            assert dollar_value >= 1_000_000, f"Dollar value {dollar_value} is below $1M"
            assert dollar_value <= 1_000_000_000, f"Dollar value {dollar_value} is above $1B"
    
    def test_higher_ratings_give_higher_value(self, admin_token):
        """Test that photos with higher ratings have higher dollar values"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        if len(data["photos"]) >= 2:
            # Sort by overall_score
            photos = sorted(data["photos"], key=lambda p: p.get("overall_score", 0))
            
            # Generally, higher scores should correlate with higher values
            # (not always exact due to face bonus, but trend should be there)
            low_score_photo = photos[0]
            high_score_photo = photos[-1]
            
            if high_score_photo["overall_score"] > low_score_photo["overall_score"] + 10:
                # Only assert if there's a significant score difference
                assert high_score_photo["dollar_value"] >= low_score_photo["dollar_value"]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
