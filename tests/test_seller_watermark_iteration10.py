"""
Blendlink Iteration 10 Tests - Seller Dashboard, Watermarking, AI Image Generation
Tests for:
- Seller Dashboard /api/seller/stats endpoint
- Image watermarking /api/watermark/apply-to-image
- AI Image Generation /api/ai-media/estimate-cost and /api/ai-media/generate
- File upload /api/upload/file
- Marketplace AI Seller Tools accessibility
- Guest Marketplace /marketplace/guest
"""

import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://priority-tier.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "Test123456"

# Small 1x1 red pixel PNG for testing
TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestSellerDashboard:
    """Seller Dashboard endpoint tests"""
    
    def test_seller_stats_requires_auth(self):
        """Test that /api/seller/stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/seller/stats")
        assert response.status_code == 401
        
    def test_seller_stats_returns_data(self, auth_headers):
        """Test that /api/seller/stats returns seller statistics"""
        response = requests.get(f"{BASE_URL}/api/seller/stats", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        # Verify all expected fields are present
        assert "total_listings" in data
        assert "active_listings" in data
        assert "sold_items" in data
        assert "total_revenue" in data
        assert "average_rating" in data
        assert "total_views" in data
        assert "conversion_rate" in data
        assert "bl_coins_earned" in data
        
        # Verify data types
        assert isinstance(data["total_listings"], int)
        assert isinstance(data["active_listings"], int)
        assert isinstance(data["sold_items"], int)
        assert isinstance(data["total_revenue"], (int, float))
        assert isinstance(data["average_rating"], (int, float))
        assert isinstance(data["total_views"], int)
        assert isinstance(data["conversion_rate"], (int, float))
        assert isinstance(data["bl_coins_earned"], (int, float))
        
    def test_seller_listings_endpoint(self, auth_headers):
        """Test that /api/seller/listings returns seller's listings"""
        response = requests.get(f"{BASE_URL}/api/seller/listings", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "listings" in data
        assert "total" in data
        assert isinstance(data["listings"], list)
        
    def test_seller_performance_endpoint(self, auth_headers):
        """Test that /api/seller/performance returns performance data"""
        response = requests.get(f"{BASE_URL}/api/seller/performance?days=30", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "listings" in data
        assert "period_days" in data


class TestImageWatermarking:
    """Image watermarking endpoint tests"""
    
    def test_watermark_requires_auth(self):
        """Test that /api/watermark/apply-to-image requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/watermark/apply-to-image",
            json={
                "image_base64": TEST_IMAGE_BASE64,
                "watermark_text": "Test",
                "opacity": 0.2,
                "position": "diagonal"
            }
        )
        assert response.status_code == 401
        
    def test_watermark_apply_to_image_success(self, auth_headers):
        """Test that watermark is successfully applied to image"""
        response = requests.post(
            f"{BASE_URL}/api/watermark/apply-to-image",
            headers=auth_headers,
            json={
                "image_base64": TEST_IMAGE_BASE64,
                "watermark_text": "Blendlink Test",
                "opacity": 0.2,
                "position": "diagonal"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "watermarked_image" in data
        assert "watermark_text" in data
        assert "message" in data
        
        # Verify watermarked image is base64 encoded
        assert data["watermarked_image"].startswith("data:image/png;base64,")
        assert data["watermark_text"] == "Blendlink Test"
        assert data["message"] == "Watermark applied successfully"
        
    def test_watermark_with_center_position(self, auth_headers):
        """Test watermark with center position"""
        response = requests.post(
            f"{BASE_URL}/api/watermark/apply-to-image",
            headers=auth_headers,
            json={
                "image_base64": TEST_IMAGE_BASE64,
                "watermark_text": "Center Test",
                "opacity": 0.3,
                "position": "center"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "watermarked_image" in data
        
    def test_watermark_with_data_url_prefix(self, auth_headers):
        """Test watermark with data URL prefix in base64"""
        response = requests.post(
            f"{BASE_URL}/api/watermark/apply-to-image",
            headers=auth_headers,
            json={
                "image_base64": f"data:image/png;base64,{TEST_IMAGE_BASE64}",
                "watermark_text": "Data URL Test",
                "opacity": 0.2,
                "position": "diagonal"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "watermarked_image" in data


class TestAIImageGeneration:
    """AI Image Generation endpoint tests"""
    
    def test_ai_estimate_cost_requires_auth(self):
        """Test that /api/ai-media/estimate-cost requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-media/estimate-cost",
            json={"prompt": "Test", "media_type": "image"}
        )
        assert response.status_code == 401
        
    def test_ai_estimate_cost_for_image(self, auth_headers):
        """Test AI cost estimation for image generation"""
        response = requests.post(
            f"{BASE_URL}/api/ai-media/estimate-cost",
            headers=auth_headers,
            json={
                "prompt": "A beautiful sunset over mountains",
                "media_type": "image"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "estimated_cost" in data
        assert "current_balance" in data
        assert "can_afford" in data
        assert "media_type" in data
        
        assert data["media_type"] == "image"
        assert isinstance(data["estimated_cost"], int)
        assert isinstance(data["current_balance"], (int, float))
        assert isinstance(data["can_afford"], bool)
        
    def test_ai_estimate_cost_for_video(self, auth_headers):
        """Test AI cost estimation for video generation"""
        response = requests.post(
            f"{BASE_URL}/api/ai-media/estimate-cost",
            headers=auth_headers,
            json={
                "prompt": "A cat playing with a ball",
                "media_type": "video",
                "duration": 6
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["media_type"] == "video"
        # Video should cost more than image
        assert data["estimated_cost"] >= 200


class TestFileUpload:
    """File upload endpoint tests"""
    
    def test_upload_requires_auth(self):
        """Test that /api/upload/file requires authentication"""
        files = {"file": ("test.png", base64.b64decode(TEST_IMAGE_BASE64), "image/png")}
        response = requests.post(f"{BASE_URL}/api/upload/file", files=files)
        assert response.status_code == 401
        
    def test_upload_image_success(self, auth_headers):
        """Test successful image upload"""
        files = {"file": ("test.png", base64.b64decode(TEST_IMAGE_BASE64), "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/upload/file",
            headers=auth_headers,
            files=files
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "upload_id" in data
        assert "filename" in data
        assert "media_type" in data
        assert "content_type" in data
        assert "size" in data
        assert "data_url" in data
        assert "file_url" in data
        
        assert data["media_type"] == "image"
        assert data["content_type"] == "image/png"
        
    def test_upload_rejects_unsupported_type(self, auth_headers):
        """Test that unsupported file types are rejected"""
        files = {"file": ("test.txt", b"Hello World", "text/plain")}
        response = requests.post(
            f"{BASE_URL}/api/upload/file",
            headers=auth_headers,
            files=files
        )
        assert response.status_code == 400


class TestGuestMarketplace:
    """Guest Marketplace endpoint tests (no auth required)"""
    
    def test_marketplace_listings_no_auth(self):
        """Test that /api/marketplace/listings works without authentication"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
    def test_marketplace_categories_no_auth(self):
        """Test that /api/marketplace/categories works without authentication"""
        response = requests.get(f"{BASE_URL}/api/marketplace/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Verify category structure
        for cat in data:
            assert "id" in cat
            assert "name" in cat
            assert "icon" in cat
            
    def test_marketplace_search(self):
        """Test marketplace search functionality"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings?search=test")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
    def test_marketplace_category_filter(self):
        """Test marketplace category filter"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings?category=electronics")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


class TestWatermarkTemplates:
    """Watermark template management tests"""
    
    def test_create_watermark_template(self, auth_headers):
        """Test creating a watermark template"""
        response = requests.post(
            f"{BASE_URL}/api/watermark/templates",
            headers=auth_headers,
            json={
                "name": "Test Template",
                "text": "© Test User",
                "font_family": "Arial",
                "font_size": 24,
                "color": "#ffffff",
                "opacity": 0.2,
                "position_x": 50.0,
                "position_y": 50.0,
                "rotation": 0.0,
                "is_default": False
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "watermark_id" in data
        assert "message" in data
        
    def test_get_watermark_templates(self, auth_headers):
        """Test getting watermark templates"""
        response = requests.get(
            f"{BASE_URL}/api/watermark/templates",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


class TestAISellerTools:
    """AI Seller Tools endpoint tests"""
    
    def test_ai_analyze_listing_requires_auth(self):
        """Test that /api/ai-tools/analyze-listing requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-tools/analyze-listing",
            json={"images": [TEST_IMAGE_BASE64], "condition": "new"}
        )
        assert response.status_code == 401
        
    def test_ai_price_suggestions_requires_auth(self):
        """Test that /api/ai-tools/price-suggestions requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-tools/price-suggestions",
            json={
                "title": "Test Product",
                "description": "Test description",
                "condition": "new",
                "target_countries": ["US"]
            }
        )
        assert response.status_code == 401
        
    def test_ai_shipping_estimate_requires_auth(self):
        """Test that /api/ai-tools/shipping-estimate requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-tools/shipping-estimate",
            json={
                "origin_zip": "90210",
                "destination_zip": "10001",
                "destination_country": "US"
            }
        )
        assert response.status_code == 401
        
    def test_ai_shipping_estimate_success(self, auth_headers):
        """Test AI shipping estimate endpoint"""
        response = requests.post(
            f"{BASE_URL}/api/ai-tools/shipping-estimate",
            headers=auth_headers,
            json={
                "origin_zip": "90210",
                "destination_zip": "10001",
                "destination_country": "US"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "estimated_dimensions" in data
        assert "estimated_weight" in data
        assert "shipping_options" in data
        assert "recommended_provider" in data
        assert "packaging_advice" in data
        
        # Verify shipping options structure
        assert isinstance(data["shipping_options"], list)
        if len(data["shipping_options"]) > 0:
            option = data["shipping_options"][0]
            assert "provider" in option
            assert "estimated_cost" in option
            assert "delivery_days" in option


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
