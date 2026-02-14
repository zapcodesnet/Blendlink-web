"""
Photo Editor P1 Features Tests - Iteration 40
Tests for new Photo Editor Phase 1 features:
- AI Auto-Enhancement (POST /api/photo-editor/auto-enhance)
- Batch Auto-Enhancement (POST /api/photo-editor/auto-enhance-batch)
- Post-Listing Editing:
  - Load listing photo (POST /api/photo-editor/listing/{listing_id}/load-photo)
  - Load all listing photos (POST /api/photo-editor/listing/{listing_id}/load-all-photos)
  - Get listing photos (GET /api/photo-editor/listing/{listing_id}/photos)
  - Apply to listing (POST /api/photo-editor/apply-to-listing)
  - Apply all to listing (POST /api/photo-editor/listing/{listing_id}/apply-all)
"""

import pytest
import requests
import os
import base64
from io import BytesIO
from PIL import Image

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://insufficient-balance.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


def create_test_image_base64(width=100, height=100, color=(255, 0, 0)):
    """Create a simple test image and return as base64"""
    img = Image.new('RGB', (width, height), color=color)
    buffer = BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)
    b64_data = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64_data}"


def create_dark_test_image_base64(width=100, height=100):
    """Create a dark test image for auto-enhance testing"""
    img = Image.new('RGB', (width, height), color=(30, 30, 30))  # Very dark
    buffer = BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)
    b64_data = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64_data}"


def create_bright_test_image_base64(width=100, height=100):
    """Create a bright test image for auto-enhance testing"""
    img = Image.new('RGB', (width, height), color=(240, 240, 240))  # Very bright
    buffer = BytesIO()
    img.save(buffer, format='JPEG', quality=85)
    buffer.seek(0)
    b64_data = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64_data}"


def upload_test_photo(auth_headers, color=(255, 0, 0)):
    """Helper to upload a test photo and return photo_id"""
    test_image = create_test_image_base64(color=color)
    response = requests.post(
        f"{BASE_URL}/api/photo-editor/upload",
        headers=auth_headers,
        json={"photos": [test_image]}
    )
    if response.status_code == 200:
        return response.json()[0]["photo_id"]
    return None


# ============== AUTO-ENHANCE TESTS ==============

class TestAutoEnhanceSingle:
    """Test POST /api/photo-editor/auto-enhance endpoint"""
    
    def test_auto_enhance_requires_auth(self):
        """Test that auto-enhance requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance",
            json={"photo_id": "test_photo"}
        )
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        
    def test_auto_enhance_invalid_photo_returns_404(self, auth_headers):
        """Test that invalid photo_id returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance",
            headers=auth_headers,
            json={"photo_id": "invalid_photo_id_12345"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
    def test_auto_enhance_success(self, auth_headers):
        """Test successful auto-enhancement of a photo"""
        # Upload a test photo
        photo_id = upload_test_photo(auth_headers, color=(100, 100, 100))
        if not photo_id:
            pytest.skip("Failed to upload test photo")
        
        # Auto-enhance the photo
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance",
            headers=auth_headers,
            json={"photo_id": photo_id}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "photo_id" in data
        assert data["photo_id"] == photo_id
        assert "enhanced_url" in data
        assert "adjustments_applied" in data
        assert "analysis" in data
        assert "processing_time_ms" in data
        
    def test_auto_enhance_returns_adjustments(self, auth_headers):
        """Test that auto-enhance returns adjustment values"""
        photo_id = upload_test_photo(auth_headers, color=(50, 50, 50))  # Dark image
        if not photo_id:
            pytest.skip("Failed to upload test photo")
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance",
            headers=auth_headers,
            json={"photo_id": photo_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        adjustments = data["adjustments_applied"]
        assert "brightness" in adjustments
        assert "contrast" in adjustments
        assert "saturation" in adjustments
        assert "sharpness" in adjustments
        
        # All values should be floats
        assert isinstance(adjustments["brightness"], (int, float))
        assert isinstance(adjustments["contrast"], (int, float))
        assert isinstance(adjustments["saturation"], (int, float))
        assert isinstance(adjustments["sharpness"], (int, float))
        
    def test_auto_enhance_returns_analysis(self, auth_headers):
        """Test that auto-enhance returns image analysis data"""
        photo_id = upload_test_photo(auth_headers)
        if not photo_id:
            pytest.skip("Failed to upload test photo")
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance",
            headers=auth_headers,
            json={"photo_id": photo_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        analysis = data["analysis"]
        assert "avg_brightness" in analysis
        assert "std_dev" in analysis
        assert "saturation_level" in analysis
        
    def test_auto_enhance_dark_image_increases_brightness(self, auth_headers):
        """Test that auto-enhance increases brightness for dark images"""
        # Upload a dark image
        dark_image = create_dark_test_image_base64()
        upload_response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [dark_image]}
        )
        
        if upload_response.status_code != 200:
            pytest.skip("Failed to upload dark test photo")
            
        photo_id = upload_response.json()[0]["photo_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance",
            headers=auth_headers,
            json={"photo_id": photo_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # For dark images, brightness should be increased (> 1.0)
        assert data["adjustments_applied"]["brightness"] > 1.0, \
            f"Expected brightness > 1.0 for dark image, got {data['adjustments_applied']['brightness']}"


# ============== BATCH AUTO-ENHANCE TESTS ==============

class TestAutoEnhanceBatch:
    """Test POST /api/photo-editor/auto-enhance-batch endpoint"""
    
    def test_batch_auto_enhance_requires_auth(self):
        """Test that batch auto-enhance requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance-batch",
            json={"photo_ids": ["test1", "test2"]}
        )
        assert response.status_code == 401
        
    def test_batch_auto_enhance_empty_list_returns_400(self, auth_headers):
        """Test that empty photo_ids list returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance-batch",
            headers=auth_headers,
            json={"photo_ids": []}
        )
        assert response.status_code == 400
        
    def test_batch_auto_enhance_invalid_photos(self, auth_headers):
        """Test batch auto-enhance with invalid photo IDs"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance-batch",
            headers=auth_headers,
            json={"photo_ids": ["invalid_1", "invalid_2"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_requested"] == 2
        assert data["total_failed"] == 2
        assert data["total_processed"] == 0
        
    def test_batch_auto_enhance_single_photo(self, auth_headers):
        """Test batch auto-enhance with single photo"""
        photo_id = upload_test_photo(auth_headers)
        if not photo_id:
            pytest.skip("Failed to upload test photo")
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance-batch",
            headers=auth_headers,
            json={"photo_ids": [photo_id]}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_requested"] == 1
        assert data["total_processed"] == 1
        assert data["total_failed"] == 0
        assert len(data["results"]) == 1
        assert data["results"][0]["success"] == True
        
    def test_batch_auto_enhance_multiple_photos(self, auth_headers):
        """Test batch auto-enhance with multiple photos"""
        # Upload multiple photos
        photo_ids = []
        for color in [(255, 0, 0), (0, 255, 0), (0, 0, 255)]:
            photo_id = upload_test_photo(auth_headers, color=color)
            if photo_id:
                photo_ids.append(photo_id)
        
        if len(photo_ids) < 3:
            pytest.skip("Failed to upload all test photos")
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance-batch",
            headers=auth_headers,
            json={"photo_ids": photo_ids}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_requested"] == 3
        assert data["total_processed"] == 3
        assert data["total_failed"] == 0
        
        # All should have adjustments
        for result in data["results"]:
            assert result["success"] == True
            assert "adjustments" in result
            
    def test_batch_auto_enhance_skips_already_enhanced(self, auth_headers):
        """Test that batch auto-enhance skips already enhanced photos"""
        photo_id = upload_test_photo(auth_headers)
        if not photo_id:
            pytest.skip("Failed to upload test photo")
        
        # First auto-enhance
        first_response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance-batch",
            headers=auth_headers,
            json={"photo_ids": [photo_id]}
        )
        assert first_response.status_code == 200
        
        # Second auto-enhance - should be skipped
        second_response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance-batch",
            headers=auth_headers,
            json={"photo_ids": [photo_id]}
        )
        
        assert second_response.status_code == 200
        data = second_response.json()
        
        assert data["total_processed"] == 1
        assert data["results"][0]["skipped"] == True
        assert "already" in data["results"][0]["message"].lower()
        
    def test_batch_auto_enhance_max_10_photos(self, auth_headers):
        """Test that batch auto-enhance is limited to 10 photos"""
        photo_ids = [f"fake_photo_{i}" for i in range(11)]
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance-batch",
            headers=auth_headers,
            json={"photo_ids": photo_ids}
        )
        
        assert response.status_code == 400
        assert "10" in response.json().get("detail", "") or "maximum" in response.json().get("detail", "").lower()
        
    def test_batch_auto_enhance_returns_timing(self, auth_headers):
        """Test that batch auto-enhance returns timing information"""
        photo_id = upload_test_photo(auth_headers)
        if not photo_id:
            pytest.skip("Failed to upload test photo")
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance-batch",
            headers=auth_headers,
            json={"photo_ids": [photo_id]}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "total_time_ms" in data
        assert isinstance(data["total_time_ms"], int)
        assert data["total_time_ms"] >= 0


# ============== POST-LISTING EDITING TESTS ==============

class TestPostListingLoadPhoto:
    """Test POST /api/photo-editor/listing/{listing_id}/load-photo endpoint"""
    
    def test_load_listing_photo_requires_auth(self):
        """Test that loading listing photo requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/listing/test_listing/load-photo",
            params={"photo_index": 0}
        )
        assert response.status_code == 401
        
    def test_load_listing_photo_invalid_listing_returns_404(self, auth_headers):
        """Test that invalid listing_id returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/listing/invalid_listing_12345/load-photo",
            headers=auth_headers,
            params={"photo_index": 0}
        )
        assert response.status_code == 404


class TestPostListingLoadAllPhotos:
    """Test POST /api/photo-editor/listing/{listing_id}/load-all-photos endpoint"""
    
    def test_load_all_listing_photos_requires_auth(self):
        """Test that loading all listing photos requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/listing/test_listing/load-all-photos"
        )
        assert response.status_code == 401
        
    def test_load_all_listing_photos_invalid_listing_returns_404(self, auth_headers):
        """Test that invalid listing_id returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/listing/invalid_listing_12345/load-all-photos",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestPostListingGetPhotos:
    """Test GET /api/photo-editor/listing/{listing_id}/photos endpoint"""
    
    def test_get_listing_photos_requires_auth(self):
        """Test that getting listing photos requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/photo-editor/listing/test_listing/photos"
        )
        assert response.status_code == 401
        
    def test_get_listing_photos_invalid_listing_returns_404(self, auth_headers):
        """Test that invalid listing_id returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/photo-editor/listing/invalid_listing_12345/photos",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestApplyToListing:
    """Test POST /api/photo-editor/apply-to-listing endpoint"""
    
    def test_apply_to_listing_requires_auth(self):
        """Test that applying to listing requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/apply-to-listing",
            json={"photo_id": "test_photo"}
        )
        assert response.status_code == 401
        
    def test_apply_to_listing_invalid_photo_returns_404(self, auth_headers):
        """Test that invalid photo_id returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/apply-to-listing",
            headers=auth_headers,
            json={"photo_id": "invalid_photo_12345"}
        )
        assert response.status_code == 404
        
    def test_apply_to_listing_non_listing_photo_returns_400(self, auth_headers):
        """Test that applying a non-listing photo returns 400"""
        # Upload a regular photo (not from a listing)
        photo_id = upload_test_photo(auth_headers)
        if not photo_id:
            pytest.skip("Failed to upload test photo")
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/apply-to-listing",
            headers=auth_headers,
            json={"photo_id": photo_id}
        )
        
        # Should return 400 because this photo is not from a live listing
        assert response.status_code == 400
        assert "not from a live listing" in response.json().get("detail", "").lower() or \
               "listing" in response.json().get("detail", "").lower()


class TestApplyAllToListing:
    """Test POST /api/photo-editor/listing/{listing_id}/apply-all endpoint"""
    
    def test_apply_all_to_listing_requires_auth(self):
        """Test that applying all to listing requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/listing/test_listing/apply-all"
        )
        assert response.status_code == 401
        
    def test_apply_all_to_listing_invalid_listing_returns_404(self, auth_headers):
        """Test that invalid listing_id returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/listing/invalid_listing_12345/apply-all",
            headers=auth_headers
        )
        # Could be 404 (listing not found) or 404 (no edited photos)
        assert response.status_code in [404]


# ============== INTEGRATION TESTS ==============

class TestAutoEnhanceIntegration:
    """Integration tests for auto-enhance with other features"""
    
    def test_auto_enhance_then_get_photo(self, auth_headers):
        """Test that auto-enhanced photo can be retrieved"""
        photo_id = upload_test_photo(auth_headers)
        if not photo_id:
            pytest.skip("Failed to upload test photo")
        
        # Auto-enhance
        enhance_response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance",
            headers=auth_headers,
            json={"photo_id": photo_id}
        )
        assert enhance_response.status_code == 200
        
        # Get the photo
        get_response = requests.get(
            f"{BASE_URL}/api/photo-editor/photos/{photo_id}",
            headers=auth_headers
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        
        # Should have auto_enhanced flag
        assert data.get("auto_enhanced") == True
        assert "adjustments" in data
        
    def test_auto_enhance_updates_edit_history(self, auth_headers):
        """Test that auto-enhance adds entry to edit history"""
        photo_id = upload_test_photo(auth_headers)
        if not photo_id:
            pytest.skip("Failed to upload test photo")
        
        # Auto-enhance
        enhance_response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance",
            headers=auth_headers,
            json={"photo_id": photo_id}
        )
        assert enhance_response.status_code == 200
        
        # Get the photo
        get_response = requests.get(
            f"{BASE_URL}/api/photo-editor/photos/{photo_id}",
            headers=auth_headers
        )
        
        assert get_response.status_code == 200
        data = get_response.json()
        
        # Should have edit history with auto_enhance action
        assert "edit_history" in data
        assert len(data["edit_history"]) > 0
        
        # Find auto_enhance action in history
        auto_enhance_entry = None
        for entry in data["edit_history"]:
            if entry.get("action") == "auto_enhance":
                auto_enhance_entry = entry
                break
        
        assert auto_enhance_entry is not None, "auto_enhance action not found in edit history"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
