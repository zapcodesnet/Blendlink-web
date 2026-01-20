"""
Photo Editor P1 Features Tests - Iteration 39
Tests for new Photo Editor Phase 1 features:
- Batch background removal (POST /api/photo-editor/remove-background-batch)
- AI Listing generation (POST /api/photo-editor/generate-ai-listing)
- Verify 20 backgrounds available (8 solid, 5 gradient, 4 pattern)
"""

import pytest
import requests
import os
import base64
from io import BytesIO
from PIL import Image

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://ecomm-bridge-2.preview.emergentagent.com')

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


class TestBackgroundsCount:
    """Test GET /api/photo-editor/backgrounds - verify 20 backgrounds (8 solid, 5 gradient, 4 pattern)"""
    
    def test_backgrounds_total_count(self):
        """Test that there are at least 20 backgrounds total"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/backgrounds")
        assert response.status_code == 200
        data = response.json()
        
        # Total backgrounds should be at least 20
        assert len(data["backgrounds"]) >= 20, f"Expected at least 20 backgrounds, got {len(data['backgrounds'])}"
        
    def test_solid_colors_count(self):
        """Test that there are exactly 8 solid colors"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/backgrounds")
        data = response.json()
        
        solid_count = len(data["categories"]["solid"])
        assert solid_count == 8, f"Expected 8 solid colors, got {solid_count}"
        
    def test_gradient_count(self):
        """Test that there are exactly 5 gradients"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/backgrounds")
        data = response.json()
        
        gradient_count = len(data["categories"]["gradient"])
        assert gradient_count == 5, f"Expected 5 gradients, got {gradient_count}"
        
    def test_pattern_count(self):
        """Test that there are exactly 4 patterns"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/backgrounds")
        data = response.json()
        
        pattern_count = len(data["categories"]["pattern"])
        assert pattern_count == 4, f"Expected 4 patterns, got {pattern_count}"
        
    def test_texture_count(self):
        """Test that there are 3 textures"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/backgrounds")
        data = response.json()
        
        texture_count = len(data["categories"]["texture"])
        assert texture_count == 3, f"Expected 3 textures, got {texture_count}"


class TestBatchBackgroundRemoval:
    """Test POST /api/photo-editor/remove-background-batch endpoint"""
    
    def test_batch_remove_requires_auth(self):
        """Test that batch removal requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            json={"photo_ids": ["test1", "test2"]}
        )
        assert response.status_code == 401
        
    def test_batch_remove_empty_list_returns_400(self, auth_headers):
        """Test that empty photo_ids list returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            headers=auth_headers,
            json={"photo_ids": []}
        )
        assert response.status_code == 400
        
    def test_batch_remove_invalid_photos_returns_results(self, auth_headers):
        """Test batch removal with invalid photo IDs returns results with errors"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            headers=auth_headers,
            json={"photo_ids": ["invalid_id_1", "invalid_id_2"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return batch response structure
        assert "total_requested" in data
        assert "total_processed" in data
        assert "total_failed" in data
        assert "total_time_ms" in data
        assert "results" in data
        
        # All should fail since IDs are invalid
        assert data["total_requested"] == 2
        assert data["total_failed"] == 2
        
    def test_batch_remove_single_photo_success(self, auth_headers):
        """Test batch removal with single photo"""
        # First upload a photo
        test_image = create_test_image_base64()
        upload_response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        
        if upload_response.status_code != 200:
            pytest.skip("Failed to upload test photo")
            
        photo_id = upload_response.json()[0]["photo_id"]
        
        # Now batch remove
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
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
        assert data["results"][0]["photo_id"] == photo_id
        
    def test_batch_remove_multiple_photos_success(self, auth_headers):
        """Test batch removal with multiple photos"""
        # Upload multiple photos
        test_images = [
            create_test_image_base64(color=(255, 0, 0)),
            create_test_image_base64(color=(0, 255, 0)),
            create_test_image_base64(color=(0, 0, 255))
        ]
        
        upload_response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": test_images}
        )
        
        if upload_response.status_code != 200:
            pytest.skip("Failed to upload test photos")
            
        photo_ids = [p["photo_id"] for p in upload_response.json()]
        
        # Batch remove all
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            headers=auth_headers,
            json={"photo_ids": photo_ids}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["total_requested"] == 3
        assert data["total_processed"] == 3
        assert data["total_failed"] == 0
        assert len(data["results"]) == 3
        
        # All should succeed
        for result in data["results"]:
            assert result["success"] == True
            
    def test_batch_remove_skips_already_processed(self, auth_headers):
        """Test that batch removal skips photos that already have background removed"""
        # Upload a photo
        test_image = create_test_image_base64()
        upload_response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        
        if upload_response.status_code != 200:
            pytest.skip("Failed to upload test photo")
            
        photo_id = upload_response.json()[0]["photo_id"]
        
        # Remove background first time
        first_response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            headers=auth_headers,
            json={"photo_ids": [photo_id]}
        )
        assert first_response.status_code == 200
        
        # Try to remove again - should be skipped
        second_response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            headers=auth_headers,
            json={"photo_ids": [photo_id]}
        )
        
        assert second_response.status_code == 200
        data = second_response.json()
        
        # Should be marked as skipped
        assert data["total_processed"] == 1
        assert data["results"][0]["skipped"] == True
        assert "already removed" in data["results"][0]["message"].lower()
        
    def test_batch_remove_max_10_photos(self, auth_headers):
        """Test that batch removal is limited to 10 photos"""
        # Create 11 fake photo IDs
        photo_ids = [f"fake_photo_{i}" for i in range(11)]
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            headers=auth_headers,
            json={"photo_ids": photo_ids}
        )
        
        assert response.status_code == 400
        assert "maximum" in response.json().get("detail", "").lower() or "10" in response.json().get("detail", "")


class TestAIListingGeneration:
    """Test POST /api/photo-editor/generate-ai-listing endpoint"""
    
    def test_ai_listing_requires_auth(self):
        """Test that AI listing generation requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/generate-ai-listing",
            json={"photo_ids": ["test"], "condition": "like_new"}
        )
        assert response.status_code == 401
        
    def test_ai_listing_empty_photos_returns_400(self, auth_headers):
        """Test that empty photo_ids returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/generate-ai-listing",
            headers=auth_headers,
            json={"photo_ids": [], "condition": "like_new"}
        )
        assert response.status_code == 400
        
    def test_ai_listing_invalid_photos_returns_404(self, auth_headers):
        """Test that invalid photo IDs returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/generate-ai-listing",
            headers=auth_headers,
            json={"photo_ids": ["invalid_photo_id"], "condition": "like_new"}
        )
        assert response.status_code == 404
        
    def test_ai_listing_success(self, auth_headers):
        """Test successful AI listing generation"""
        # First upload a photo
        test_image = create_test_image_base64(width=200, height=200, color=(100, 150, 200))
        upload_response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        
        if upload_response.status_code != 200:
            pytest.skip("Failed to upload test photo")
            
        photo_id = upload_response.json()[0]["photo_id"]
        
        # Generate AI listing
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/generate-ai-listing",
            headers=auth_headers,
            json={"photo_ids": [photo_id], "condition": "like_new"},
            timeout=60  # AI processing may take time
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "analysis_id" in data
        assert "listing_data" in data
        assert "photo_count" in data
        assert data["photo_count"] == 1
        
    def test_ai_listing_with_condition_parameter(self, auth_headers):
        """Test AI listing with different condition parameters"""
        # Upload a photo
        test_image = create_test_image_base64()
        upload_response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        
        if upload_response.status_code != 200:
            pytest.skip("Failed to upload test photo")
            
        photo_id = upload_response.json()[0]["photo_id"]
        
        # Test with "good" condition
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/generate-ai-listing",
            headers=auth_headers,
            json={"photo_ids": [photo_id], "condition": "good"},
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True


class TestBatchRemovalResponseStructure:
    """Test the response structure of batch background removal"""
    
    def test_response_has_timing_info(self, auth_headers):
        """Test that response includes timing information"""
        # Upload a photo
        test_image = create_test_image_base64()
        upload_response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        
        if upload_response.status_code != 200:
            pytest.skip("Failed to upload test photo")
            
        photo_id = upload_response.json()[0]["photo_id"]
        
        # Batch remove
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            headers=auth_headers,
            json={"photo_ids": [photo_id]}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check timing info
        assert "total_time_ms" in data
        assert isinstance(data["total_time_ms"], int)
        assert data["total_time_ms"] >= 0
        
        # Check individual result timing
        assert "processing_time_ms" in data["results"][0]
        
    def test_response_has_transparency_flag(self, auth_headers):
        """Test that successful results include has_transparency flag"""
        # Upload a photo
        test_image = create_test_image_base64()
        upload_response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        
        if upload_response.status_code != 200:
            pytest.skip("Failed to upload test photo")
            
        photo_id = upload_response.json()[0]["photo_id"]
        
        # Batch remove
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            headers=auth_headers,
            json={"photo_ids": [photo_id]}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check transparency flag in result
        result = data["results"][0]
        if result["success"] and not result.get("skipped"):
            assert "has_transparency" in result
            assert result["has_transparency"] == True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
