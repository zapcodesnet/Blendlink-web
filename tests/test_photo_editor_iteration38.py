"""
Photo Editor API Tests - Iteration 38
Tests for the new Photo Editor feature in Seller Dashboard:
- Multi-photo upload (up to 10 photos, 60MB each)
- AI Background Removal using rembg
- Brightness/Contrast adjustments
- Background customization (solid colors, gradients, patterns)
- Undo/Reset functionality
- Save background preferences
"""

import pytest
import requests
import os
import base64
from io import BytesIO
from PIL import Image

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://production-url-fix.preview.emergentagent.com')

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


class TestPhotoEditorBackgrounds:
    """Test GET /api/photo-editor/backgrounds endpoint"""
    
    def test_get_backgrounds_returns_200(self):
        """Test that backgrounds endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/backgrounds")
        assert response.status_code == 200
        
    def test_get_backgrounds_has_categories(self):
        """Test that backgrounds response has all categories"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/backgrounds")
        data = response.json()
        
        assert "backgrounds" in data
        assert "categories" in data
        assert "solid" in data["categories"]
        assert "gradient" in data["categories"]
        assert "pattern" in data["categories"]
        assert "texture" in data["categories"]
        
    def test_get_backgrounds_solid_colors(self):
        """Test that solid colors are present"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/backgrounds")
        data = response.json()
        
        solid_colors = data["categories"]["solid"]
        assert len(solid_colors) >= 8  # At least 8 solid colors
        
        # Check for specific colors
        color_ids = [c["id"] for c in solid_colors]
        assert "solid_white" in color_ids
        assert "solid_black" in color_ids
        
    def test_get_backgrounds_gradients(self):
        """Test that gradients are present"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/backgrounds")
        data = response.json()
        
        gradients = data["categories"]["gradient"]
        assert len(gradients) >= 5  # At least 5 gradients
        
        # Check gradient structure
        for gradient in gradients:
            assert "colors" in gradient
            assert len(gradient["colors"]) >= 2


class TestPhotoEditorUpload:
    """Test POST /api/photo-editor/upload endpoint"""
    
    def test_upload_requires_auth(self):
        """Test that upload requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            json={"photos": []}
        )
        assert response.status_code == 401
        
    def test_upload_empty_photos_returns_400(self, auth_headers):
        """Test that uploading empty photos returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": []}
        )
        assert response.status_code == 400
        
    def test_upload_single_photo_success(self, auth_headers):
        """Test uploading a single photo"""
        test_image = create_test_image_base64()
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert "photo_id" in data[0]
        assert "thumbnail_url" in data[0]
        assert "width" in data[0]
        assert "height" in data[0]
        
    def test_upload_multiple_photos_success(self, auth_headers):
        """Test uploading multiple photos"""
        test_images = [
            create_test_image_base64(color=(255, 0, 0)),
            create_test_image_base64(color=(0, 255, 0)),
            create_test_image_base64(color=(0, 0, 255))
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": test_images}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3


class TestPhotoEditorPhotos:
    """Test GET /api/photo-editor/photos endpoint"""
    
    def test_get_photos_requires_auth(self):
        """Test that getting photos requires authentication"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/photos")
        assert response.status_code == 401
        
    def test_get_photos_returns_list(self, auth_headers):
        """Test that getting photos returns a list"""
        response = requests.get(
            f"{BASE_URL}/api/photo-editor/photos",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "photos" in data
        assert "total" in data
        assert isinstance(data["photos"], list)


class TestPhotoEditorRemoveBackground:
    """Test POST /api/photo-editor/remove-background endpoint"""
    
    @pytest.fixture
    def uploaded_photo_id(self, auth_headers):
        """Upload a photo and return its ID"""
        test_image = create_test_image_base64()
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        if response.status_code == 200:
            return response.json()[0]["photo_id"]
        pytest.skip("Failed to upload test photo")
        
    def test_remove_background_requires_auth(self):
        """Test that background removal requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background",
            json={"photo_id": "test"}
        )
        assert response.status_code == 401
        
    def test_remove_background_invalid_photo_returns_404(self, auth_headers):
        """Test that removing background from invalid photo returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background",
            headers=auth_headers,
            json={"photo_id": "invalid_photo_id"}
        )
        assert response.status_code == 404
        
    def test_remove_background_success(self, auth_headers, uploaded_photo_id):
        """Test successful background removal"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background",
            headers=auth_headers,
            json={"photo_id": uploaded_photo_id}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "photo_id" in data
        assert "processed_url" in data
        assert "has_transparency" in data
        assert "processing_time_ms" in data
        assert data["has_transparency"] == True


class TestPhotoEditorAdjust:
    """Test POST /api/photo-editor/adjust endpoint"""
    
    @pytest.fixture
    def uploaded_photo_id(self, auth_headers):
        """Upload a photo and return its ID"""
        test_image = create_test_image_base64()
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        if response.status_code == 200:
            return response.json()[0]["photo_id"]
        pytest.skip("Failed to upload test photo")
        
    def test_adjust_requires_auth(self):
        """Test that adjustments require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/adjust",
            json={"photo_id": "test", "brightness": 1.5}
        )
        assert response.status_code == 401
        
    def test_adjust_brightness_success(self, auth_headers, uploaded_photo_id):
        """Test adjusting brightness"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/adjust",
            headers=auth_headers,
            json={
                "photo_id": uploaded_photo_id,
                "brightness": 1.5,
                "contrast": 1.0,
                "saturation": 1.0,
                "sharpness": 1.0
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "photo_id" in data
        assert "adjusted_url" in data
        assert "adjustments" in data
        assert data["adjustments"]["brightness"] == 1.5
        
    def test_adjust_all_parameters(self, auth_headers, uploaded_photo_id):
        """Test adjusting all parameters"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/adjust",
            headers=auth_headers,
            json={
                "photo_id": uploaded_photo_id,
                "brightness": 1.2,
                "contrast": 1.3,
                "saturation": 0.8,
                "sharpness": 1.5
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["adjustments"]["brightness"] == 1.2
        assert data["adjustments"]["contrast"] == 1.3
        assert data["adjustments"]["saturation"] == 0.8
        assert data["adjustments"]["sharpness"] == 1.5


class TestPhotoEditorApplyBackground:
    """Test POST /api/photo-editor/apply-background endpoint"""
    
    @pytest.fixture
    def photo_with_removed_bg(self, auth_headers):
        """Upload a photo and remove its background"""
        # Upload
        test_image = create_test_image_base64()
        upload_response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        if upload_response.status_code != 200:
            pytest.skip("Failed to upload test photo")
            
        photo_id = upload_response.json()[0]["photo_id"]
        
        # Remove background
        remove_response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background",
            headers=auth_headers,
            json={"photo_id": photo_id}
        )
        if remove_response.status_code != 200:
            pytest.skip("Failed to remove background")
            
        return photo_id
        
    def test_apply_background_requires_auth(self):
        """Test that applying background requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/apply-background",
            json={"photo_id": "test", "background_type": "solid", "background_value": "#FFFFFF"}
        )
        assert response.status_code == 401
        
    def test_apply_solid_background_success(self, auth_headers, photo_with_removed_bg):
        """Test applying solid color background"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/apply-background",
            headers=auth_headers,
            json={
                "photo_id": photo_with_removed_bg,
                "background_type": "solid",
                "background_value": "#FFFFFF"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "photo_id" in data
        assert "result_url" in data
        assert "background" in data
        assert data["background"]["type"] == "solid"
        
    def test_apply_gradient_background_success(self, auth_headers, photo_with_removed_bg):
        """Test applying gradient background"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/apply-background",
            headers=auth_headers,
            json={
                "photo_id": photo_with_removed_bg,
                "background_type": "gradient",
                "background_value": "gradient_sunset"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["background"]["type"] == "gradient"
        
    def test_apply_pattern_background_success(self, auth_headers, photo_with_removed_bg):
        """Test applying pattern background"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/apply-background",
            headers=auth_headers,
            json={
                "photo_id": photo_with_removed_bg,
                "background_type": "pattern",
                "background_value": "pattern_dots"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["background"]["type"] == "pattern"


class TestPhotoEditorResetUndo:
    """Test reset and undo functionality"""
    
    @pytest.fixture
    def edited_photo_id(self, auth_headers):
        """Upload and edit a photo"""
        # Upload
        test_image = create_test_image_base64()
        upload_response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        if upload_response.status_code != 200:
            pytest.skip("Failed to upload test photo")
            
        photo_id = upload_response.json()[0]["photo_id"]
        
        # Apply adjustment
        requests.post(
            f"{BASE_URL}/api/photo-editor/adjust",
            headers=auth_headers,
            json={
                "photo_id": photo_id,
                "brightness": 1.5,
                "contrast": 1.0,
                "saturation": 1.0,
                "sharpness": 1.0
            }
        )
        
        return photo_id
        
    def test_reset_photo_success(self, auth_headers, edited_photo_id):
        """Test resetting photo to original"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/reset/{edited_photo_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "photo_id" in data
        assert "message" in data
        assert "reset" in data["message"].lower()
        
    def test_undo_edit_success(self, auth_headers, edited_photo_id):
        """Test undoing last edit"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/undo/{edited_photo_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "photo_id" in data
        assert "message" in data


class TestPhotoEditorPreferences:
    """Test background preference saving"""
    
    def test_save_preference_requires_auth(self):
        """Test that saving preference requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/save-preference",
            params={"background_type": "solid", "background_value": "#FFFFFF"}
        )
        assert response.status_code == 401
        
    def test_save_preference_success(self, auth_headers):
        """Test saving background preference"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/save-preference",
            headers=auth_headers,
            params={"background_type": "solid", "background_value": "#FFFFFF"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
    def test_get_preference_success(self, auth_headers):
        """Test getting saved preference"""
        response = requests.get(
            f"{BASE_URL}/api/photo-editor/preference",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "default_background" in data or "preferences" in data


class TestPhotoEditorDelete:
    """Test photo deletion"""
    
    @pytest.fixture
    def uploaded_photo_id(self, auth_headers):
        """Upload a photo and return its ID"""
        test_image = create_test_image_base64()
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": [test_image]}
        )
        if response.status_code == 200:
            return response.json()[0]["photo_id"]
        pytest.skip("Failed to upload test photo")
        
    def test_delete_photo_success(self, auth_headers, uploaded_photo_id):
        """Test deleting a photo"""
        response = requests.delete(
            f"{BASE_URL}/api/photo-editor/photos/{uploaded_photo_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
    def test_delete_invalid_photo_returns_404(self, auth_headers):
        """Test deleting invalid photo returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/photo-editor/photos/invalid_photo_id",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestPhotoEditorFinalize:
    """Test photo finalization for listing"""
    
    @pytest.fixture
    def uploaded_photo_ids(self, auth_headers):
        """Upload multiple photos and return their IDs"""
        test_images = [
            create_test_image_base64(color=(255, 0, 0)),
            create_test_image_base64(color=(0, 255, 0))
        ]
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            headers=auth_headers,
            json={"photos": test_images}
        )
        if response.status_code == 200:
            return [p["photo_id"] for p in response.json()]
        pytest.skip("Failed to upload test photos")
        
    def test_finalize_photos_success(self, auth_headers, uploaded_photo_ids):
        """Test finalizing photos for listing"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/finalize",
            headers=auth_headers,
            json={"photo_ids": uploaded_photo_ids}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "finalized_photos" in data
        assert data["count"] == len(uploaded_photo_ids)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
