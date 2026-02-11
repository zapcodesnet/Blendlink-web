"""
Test Photo Editor Bug Fixes - Iteration 41
Tests for:
1. Photo upload working
2. Background removal returns has_transparency=True
3. GET /api/photo-editor/photos?limit=10 returns max 10 photos
4. Frontend: Edit tab is default (verified via code review)
5. Frontend: Navigation to AI Listing Creator with photos (verified via Playwright)
"""

import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://stripe-fix-29.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"

# Small test image (1x1 red pixel PNG)
TEST_IMAGE_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping tests")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestPhotoEditorUpload:
    """Test photo upload functionality"""
    
    def test_upload_requires_auth(self):
        """POST /api/photo-editor/upload requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/upload",
            json={"photos": [TEST_IMAGE_BASE64]}
        )
        assert response.status_code == 401
    
    def test_upload_single_photo(self, api_client):
        """POST /api/photo-editor/upload successfully uploads a photo"""
        response = api_client.post(
            f"{BASE_URL}/api/photo-editor/upload",
            json={"photos": [TEST_IMAGE_BASE64]}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        assert "photo_id" in data[0]
        assert data[0]["photo_id"].startswith("photo_")
    
    def test_upload_multiple_photos(self, api_client):
        """POST /api/photo-editor/upload can upload multiple photos"""
        response = api_client.post(
            f"{BASE_URL}/api/photo-editor/upload",
            json={"photos": [TEST_IMAGE_BASE64, TEST_IMAGE_BASE64]}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
    
    def test_upload_empty_list_fails(self, api_client):
        """POST /api/photo-editor/upload fails with empty list"""
        response = api_client.post(
            f"{BASE_URL}/api/photo-editor/upload",
            json={"photos": []}
        )
        assert response.status_code == 400


class TestPhotoEditorGetPhotos:
    """Test GET /api/photo-editor/photos endpoint"""
    
    def test_get_photos_requires_auth(self):
        """GET /api/photo-editor/photos requires authentication"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/photos")
        assert response.status_code == 401
    
    def test_get_photos_with_limit(self, api_client):
        """GET /api/photo-editor/photos?limit=10 returns max 10 photos"""
        response = api_client.get(f"{BASE_URL}/api/photo-editor/photos?limit=10")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "photos" in data
        assert "total" in data
        assert "limit" in data
        
        # Verify limit is respected
        assert data["limit"] == 10
        assert len(data["photos"]) <= 10
    
    def test_get_photos_default_limit(self, api_client):
        """GET /api/photo-editor/photos uses default limit of 20"""
        response = api_client.get(f"{BASE_URL}/api/photo-editor/photos")
        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 20


class TestBackgroundRemoval:
    """Test background removal functionality"""
    
    @pytest.fixture
    def uploaded_photo_id(self, api_client):
        """Upload a photo and return its ID"""
        response = api_client.post(
            f"{BASE_URL}/api/photo-editor/upload",
            json={"photos": [TEST_IMAGE_BASE64]}
        )
        if response.status_code == 200:
            return response.json()[0]["photo_id"]
        pytest.skip("Failed to upload test photo")
    
    def test_remove_background_requires_auth(self):
        """POST /api/photo-editor/remove-background requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background",
            json={"photo_id": "test_photo_id"}
        )
        assert response.status_code == 401
    
    def test_remove_background_invalid_photo(self, api_client):
        """POST /api/photo-editor/remove-background returns 404 for invalid photo"""
        response = api_client.post(
            f"{BASE_URL}/api/photo-editor/remove-background",
            json={"photo_id": "invalid_photo_id_12345"}
        )
        assert response.status_code == 404
    
    def test_remove_background_returns_transparency(self, api_client, uploaded_photo_id):
        """POST /api/photo-editor/remove-background returns has_transparency=True"""
        response = api_client.post(
            f"{BASE_URL}/api/photo-editor/remove-background",
            json={"photo_id": uploaded_photo_id},
            timeout=60  # Background removal can take time
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "photo_id" in data
        assert "has_transparency" in data
        assert "processing_time_ms" in data
        
        # CRITICAL: Verify actual background removal
        assert data["has_transparency"] == True, "Background removal must return has_transparency=True"
        assert data["processing_time_ms"] > 0
    
    def test_remove_background_updates_photo(self, api_client, uploaded_photo_id):
        """Background removal updates the photo record"""
        # Remove background
        api_client.post(
            f"{BASE_URL}/api/photo-editor/remove-background",
            json={"photo_id": uploaded_photo_id},
            timeout=60
        )
        
        # Get photo and verify it's updated
        response = api_client.get(f"{BASE_URL}/api/photo-editor/photos/{uploaded_photo_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["has_background_removed"] == True


class TestBatchBackgroundRemoval:
    """Test batch background removal"""
    
    def test_batch_remove_requires_auth(self):
        """POST /api/photo-editor/remove-background-batch requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            json={"photo_ids": ["test1", "test2"]}
        )
        assert response.status_code == 401
    
    def test_batch_remove_empty_list(self, api_client):
        """POST /api/photo-editor/remove-background-batch fails with empty list"""
        response = api_client.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            json={"photo_ids": []}
        )
        assert response.status_code == 400
    
    def test_batch_remove_max_10(self, api_client):
        """POST /api/photo-editor/remove-background-batch limits to 10 photos"""
        # Try to process 11 photos
        photo_ids = [f"photo_{i}" for i in range(11)]
        response = api_client.post(
            f"{BASE_URL}/api/photo-editor/remove-background-batch",
            json={"photo_ids": photo_ids}
        )
        assert response.status_code == 400


class TestPhotoEditorFinalize:
    """Test photo finalization for listing creation"""
    
    def test_finalize_requires_auth(self):
        """POST /api/photo-editor/finalize requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/finalize",
            json={"photo_ids": ["test1"]}
        )
        assert response.status_code == 401
    
    def test_finalize_returns_photos(self, api_client):
        """POST /api/photo-editor/finalize returns finalized photos"""
        # First upload a photo
        upload_response = api_client.post(
            f"{BASE_URL}/api/photo-editor/upload",
            json={"photos": [TEST_IMAGE_BASE64]}
        )
        photo_id = upload_response.json()[0]["photo_id"]
        
        # Finalize
        response = api_client.post(
            f"{BASE_URL}/api/photo-editor/finalize",
            json={"photo_ids": [photo_id]}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "finalized_photos" in data
        assert data["count"] >= 1


class TestPhotoEditorBackgrounds:
    """Test background presets endpoint"""
    
    def test_get_backgrounds_no_auth_required(self):
        """GET /api/photo-editor/backgrounds doesn't require auth"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/backgrounds")
        assert response.status_code == 200
        data = response.json()
        
        assert "backgrounds" in data
        assert "categories" in data
        assert "solid" in data["categories"]
        assert "gradient" in data["categories"]
        assert "pattern" in data["categories"]


class TestPhotoEditorCodeReview:
    """Code review verification tests"""
    
    def test_frontend_edit_tab_default(self):
        """Verify PhotoEditorModal.jsx has activeTab='edit' as default"""
        with open("/app/frontend/src/components/PhotoEditorModal.jsx", "r") as f:
            content = f.read()
        
        # Check that activeTab is initialized to 'edit'
        assert "const [activeTab, setActiveTab] = useState('edit')" in content, \
            "activeTab should default to 'edit'"
    
    def test_frontend_photos_limit_10(self):
        """Verify PhotoEditorModal.jsx uses limit=10 for loadPhotos"""
        with open("/app/frontend/src/components/PhotoEditorModal.jsx", "r") as f:
            content = f.read()
        
        # Check that loadPhotos uses limit=10
        assert "limit=10" in content, \
            "loadPhotos should use limit=10"
    
    def test_frontend_navigate_to_ai_listing(self):
        """Verify SellerDashboard.jsx navigates to /ai-listing-creator with photos"""
        with open("/app/frontend/src/pages/SellerDashboard.jsx", "r") as f:
            content = f.read()
        
        # Check navigation to AI Listing Creator
        assert "navigate('/ai-listing-creator'" in content, \
            "Should navigate to /ai-listing-creator"
        assert "fromPhotoEditor: true" in content, \
            "Should pass fromPhotoEditor flag"
    
    def test_frontend_ai_listing_receives_photos(self):
        """Verify AIListingCreator.jsx receives photos from location.state"""
        with open("/app/frontend/src/pages/AIListingCreator.jsx", "r") as f:
            content = f.read()
        
        # Check useLocation hook
        assert "useLocation" in content, \
            "Should use useLocation hook"
        assert "location.state?.fromPhotoEditor" in content, \
            "Should check for fromPhotoEditor in location.state"
        assert "location.state?.photos" in content, \
            "Should access photos from location.state"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
