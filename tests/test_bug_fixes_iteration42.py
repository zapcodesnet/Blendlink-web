"""
Bug Fixes Iteration 42 - Testing:
1) Login functionality
2) Photo Editor - Select Photos, Remove Background, Auto-Enhance
3) AI Listing Creator - ZIP code validation
4) Seller Dashboard - /api/seller/stats and /api/seller/performance
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://prod-verify-1.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"


class TestAuthentication:
    """Test login functionality"""
    
    def test_login_success(self):
        """Test successful login returns token and user data"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "token" in data, "Token not in response"
        assert "user" in data, "User not in response"
        assert data["user"]["email"] == TEST_EMAIL
        print(f"Login successful, user_id: {data['user']['user_id']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestSellerDashboard:
    """Test seller dashboard endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_seller_stats(self, auth_token):
        """Test GET /api/seller/stats returns seller statistics"""
        response = requests.get(
            f"{BASE_URL}/api/seller/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "total_listings" in data
        assert "active_listings" in data
        assert "sold_items" in data
        assert "total_revenue" in data
        assert "average_rating" in data
        assert "total_views" in data
        assert "conversion_rate" in data
        assert "bl_coins_earned" in data
        print(f"Seller stats: {data}")
    
    def test_seller_performance(self, auth_token):
        """Test GET /api/seller/performance returns performance data (was returning 500)"""
        response = requests.get(
            f"{BASE_URL}/api/seller/performance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "listings" in data
        assert "underperforming" in data
        assert "total_listings" in data
        assert "average_score" in data
        assert "period_days" in data
        print(f"Performance data: total_listings={data['total_listings']}, avg_score={data['average_score']}")
    
    def test_seller_stats_requires_auth(self):
        """Test seller stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/seller/stats")
        assert response.status_code == 401
    
    def test_seller_performance_requires_auth(self):
        """Test seller performance requires authentication"""
        response = requests.get(f"{BASE_URL}/api/seller/performance")
        assert response.status_code == 401


class TestPhotoEditor:
    """Test photo editor endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_photos(self, auth_token):
        """Test GET /api/photo-editor/photos returns photos"""
        response = requests.get(
            f"{BASE_URL}/api/photo-editor/photos?limit=5",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "photos" in data
        assert "total" in data
        print(f"Photos: {len(data['photos'])} of {data['total']}")
    
    def test_remove_background_returns_has_transparency(self, auth_token):
        """Test POST /api/photo-editor/remove-background returns has_transparency=True"""
        # First get a photo without background removed
        photos_response = requests.get(
            f"{BASE_URL}/api/photo-editor/photos?limit=20",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert photos_response.status_code == 200
        
        photos = photos_response.json().get("photos", [])
        photo_without_bg = None
        for photo in photos:
            if not photo.get("has_background_removed"):
                photo_without_bg = photo
                break
        
        if not photo_without_bg:
            # All photos have background removed, skip test
            pytest.skip("No photos without background removed available")
        
        # Remove background
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={"photo_id": photo_without_bg["photo_id"]}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "has_transparency" in data, "has_transparency not in response"
        assert data["has_transparency"] == True, "has_transparency should be True"
        assert "processing_time_ms" in data
        print(f"Background removed: has_transparency={data['has_transparency']}, time={data['processing_time_ms']}ms")
    
    def test_auto_enhance_returns_adjustments(self, auth_token):
        """Test POST /api/photo-editor/auto-enhance returns adjustments_applied"""
        # First get a photo
        photos_response = requests.get(
            f"{BASE_URL}/api/photo-editor/photos?limit=5",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert photos_response.status_code == 200
        
        photos = photos_response.json().get("photos", [])
        if not photos:
            pytest.skip("No photos available")
        
        photo = photos[0]
        
        # Auto-enhance
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={"photo_id": photo["photo_id"]}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "adjustments_applied" in data, "adjustments_applied not in response"
        adjustments = data["adjustments_applied"]
        assert "brightness" in adjustments
        assert "contrast" in adjustments
        assert "saturation" in adjustments
        assert "sharpness" in adjustments
        print(f"Auto-enhance: adjustments={adjustments}")
    
    def test_photo_editor_requires_auth(self):
        """Test photo editor endpoints require authentication"""
        response = requests.get(f"{BASE_URL}/api/photo-editor/photos")
        assert response.status_code == 401
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/remove-background",
            json={"photo_id": "test"}
        )
        assert response.status_code == 401
        
        response = requests.post(
            f"{BASE_URL}/api/photo-editor/auto-enhance",
            json={"photo_id": "test"}
        )
        assert response.status_code == 401


class TestCodeReview:
    """Code review tests to verify fixes are in place"""
    
    def test_photo_editor_modal_default_tab_is_edit(self):
        """Verify PhotoEditorModal.jsx has activeTab='edit' as default"""
        with open("/app/frontend/src/components/PhotoEditorModal.jsx", "r") as f:
            content = f.read()
        
        # Check that activeTab defaults to 'edit'
        assert "useState('edit')" in content, "activeTab should default to 'edit'"
        print("PhotoEditorModal.jsx: activeTab defaults to 'edit' ✓")
    
    def test_ai_listing_creator_uses_user_location_zip(self):
        """Verify AIListingCreator.jsx uses userLocation?.zip instead of location?.zip"""
        with open("/app/frontend/src/pages/AIListingCreator.jsx", "r") as f:
            content = f.read()
        
        # Check that publishListing uses userLocation?.zip
        assert "userLocation?.zip" in content, "Should use userLocation?.zip"
        # Make sure the old bug (location?.zip) is not present in publishListing
        # Note: location is used for useLocation hook, so we check the specific context
        assert "if (!userLocation?.zip)" in content, "ZIP validation should use userLocation?.zip"
        print("AIListingCreator.jsx: Uses userLocation?.zip for ZIP validation ✓")
    
    def test_seller_dashboard_datetime_fix(self):
        """Verify seller_dashboard.py handles datetime properly"""
        with open("/app/backend/seller_dashboard.py", "r") as f:
            content = f.read()
        
        # Check that the datetime handling is fixed
        assert "isinstance(created_at_raw, str)" in content, "Should check if created_at is string"
        assert "isinstance(created_at_raw, datetime)" in content, "Should check if created_at is datetime"
        print("seller_dashboard.py: datetime handling fixed ✓")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
