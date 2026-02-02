"""
Blendlink Bug Fixes Test Suite - Iteration 9
Tests for:
- File upload endpoint /api/upload/file
- Post creation with media uploads
- Post sharing /api/social/posts/{post_id}/share
- Referral link generation /api/referral-system/my-network
- Guest marketplace page
- Guest checkout /api/marketplace/guest-checkout
- Landing page featured listings carousel
- Add to cart functionality in guest marketplace
"""

import pytest
import requests
import os
import base64
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pvpturbo.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "Test123456"


class TestAuthentication:
    """Authentication tests to get token for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"SUCCESS: Login successful, user_id: {data['user']['user_id']}")


class TestFileUpload:
    """Tests for file upload endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_upload_file_requires_auth(self):
        """Test that upload endpoint requires authentication"""
        # Create a simple test image (1x1 pixel PNG)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        files = {"file": ("test.png", png_data, "image/png")}
        response = requests.post(f"{BASE_URL}/api/upload/file", files=files)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("SUCCESS: Upload endpoint correctly requires authentication")
    
    def test_upload_image_file(self, auth_headers):
        """Test uploading an image file"""
        # Create a simple test image (1x1 pixel PNG)
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        files = {"file": ("test_image.png", png_data, "image/png")}
        response = requests.post(
            f"{BASE_URL}/api/upload/file", 
            files=files,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        assert "upload_id" in data, "No upload_id in response"
        assert "data_url" in data, "No data_url in response"
        assert data["media_type"] == "image", f"Expected media_type 'image', got {data.get('media_type')}"
        print(f"SUCCESS: Image uploaded, upload_id: {data['upload_id']}")
        return data
    
    def test_upload_unsupported_file_type(self, auth_headers):
        """Test uploading unsupported file type"""
        files = {"file": ("test.txt", b"Hello World", "text/plain")}
        response = requests.post(
            f"{BASE_URL}/api/upload/file", 
            files=files,
            headers=auth_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("SUCCESS: Unsupported file type correctly rejected")


class TestPostCreationWithMedia:
    """Tests for post creation with media uploads"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    def test_create_post_with_image(self, auth_headers):
        """Test creating a post with an image URL"""
        # First upload an image
        png_data = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        )
        files = {"file": ("test_post_image.png", png_data, "image/png")}
        upload_headers = {"Authorization": auth_headers["Authorization"]}
        upload_response = requests.post(
            f"{BASE_URL}/api/upload/file", 
            files=files,
            headers=upload_headers
        )
        
        if upload_response.status_code == 200:
            upload_data = upload_response.json()
            image_url = upload_data.get("data_url", "")
        else:
            # Use a placeholder if upload fails
            image_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        # Create post with image
        post_data = {
            "content": f"Test post with image - {datetime.now().isoformat()}",
            "media_type": "image",
            "media_urls": [image_url],
            "privacy": "public"
        }
        response = requests.post(
            f"{BASE_URL}/api/social/posts",
            json=post_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Post creation failed: {response.text}"
        data = response.json()
        assert "post" in data, "No post in response"
        assert data["post"]["media_type"] == "image"
        assert len(data["post"]["media_urls"]) > 0
        # Public image posts should earn 20 BL coins
        assert data.get("bl_coins_earned", 0) == 20, f"Expected 20 BL coins, got {data.get('bl_coins_earned')}"
        print(f"SUCCESS: Post with image created, post_id: {data['post']['post_id']}, earned {data.get('bl_coins_earned')} BL")
        return data["post"]


class TestPostSharing:
    """Tests for post sharing functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def test_post(self, auth_headers):
        """Create a test post to share"""
        post_data = {
            "content": f"Test post for sharing - {datetime.now().isoformat()}",
            "media_type": "text",
            "media_urls": [],
            "privacy": "public"
        }
        response = requests.post(
            f"{BASE_URL}/api/social/posts",
            json=post_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        return response.json()["post"]
    
    def test_share_post(self, auth_headers, test_post):
        """Test sharing a post"""
        post_id = test_post["post_id"]
        share_data = {
            "content": f"Sharing this post - {datetime.now().isoformat()}",
            "privacy": "public"
        }
        response = requests.post(
            f"{BASE_URL}/api/social/posts/{post_id}/share",
            json=share_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Share failed: {response.text}"
        data = response.json()
        assert "post" in data, "No post in response"
        assert data["post"]["original_post_id"] == post_id
        # Public shares should earn 10 BL coins
        assert data.get("bl_coins_earned", 0) == 10, f"Expected 10 BL coins, got {data.get('bl_coins_earned')}"
        print(f"SUCCESS: Post shared, new post_id: {data['post']['post_id']}, earned {data.get('bl_coins_earned')} BL")
    
    def test_cannot_share_private_post(self, auth_headers):
        """Test that private posts cannot be shared"""
        # Create a private post
        post_data = {
            "content": f"Private post - {datetime.now().isoformat()}",
            "media_type": "text",
            "media_urls": [],
            "privacy": "private"
        }
        response = requests.post(
            f"{BASE_URL}/api/social/posts",
            json=post_data,
            headers=auth_headers
        )
        assert response.status_code == 200
        private_post = response.json()["post"]
        
        # Try to share it
        share_response = requests.post(
            f"{BASE_URL}/api/social/posts/{private_post['post_id']}/share",
            json={"content": "Trying to share private post", "privacy": "public"},
            headers=auth_headers
        )
        assert share_response.status_code == 403, f"Expected 403, got {share_response.status_code}"
        print("SUCCESS: Private posts correctly cannot be shared")


class TestReferralNetwork:
    """Tests for referral network endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_get_my_network(self, auth_headers):
        """Test getting referral network"""
        response = requests.get(
            f"{BASE_URL}/api/referral-system/my-network",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "user_id" in data, "No user_id in response"
        assert "referral_code" in data, "No referral_code in response"
        assert "level_1_count" in data, "No level_1_count in response"
        assert "level_2_count" in data, "No level_2_count in response"
        assert "total_network_size" in data, "No total_network_size in response"
        assert "total_commissions_earned" in data, "No total_commissions_earned in response"
        
        print(f"SUCCESS: Referral network retrieved")
        print(f"  - Referral code: {data['referral_code']}")
        print(f"  - Level 1 count: {data['level_1_count']}")
        print(f"  - Level 2 count: {data['level_2_count']}")
        print(f"  - Total network: {data['total_network_size']}")
        print(f"  - Total commissions: {data['total_commissions_earned']}")
    
    def test_referral_stats(self, auth_headers):
        """Test getting referral stats"""
        response = requests.get(
            f"{BASE_URL}/api/referral-system/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "level_1" in data, "No level_1 in response"
        assert "level_2" in data, "No level_2 in response"
        print(f"SUCCESS: Referral stats retrieved")


class TestGuestMarketplace:
    """Tests for guest marketplace functionality"""
    
    def test_get_marketplace_listings_no_auth(self):
        """Test that marketplace listings are accessible without auth"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of listings"
        print(f"SUCCESS: Marketplace listings accessible without auth, count: {len(data)}")
    
    def test_get_rentals_no_auth(self):
        """Test that rentals are accessible without auth"""
        response = requests.get(f"{BASE_URL}/api/rentals/properties")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of properties"
        print(f"SUCCESS: Rentals accessible without auth, count: {len(data)}")
    
    def test_get_services_no_auth(self):
        """Test that services are accessible without auth"""
        response = requests.get(f"{BASE_URL}/api/services")
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list of services"
        print(f"SUCCESS: Services accessible without auth, count: {len(data)}")


class TestGuestCheckout:
    """Tests for guest checkout functionality"""
    
    def test_guest_checkout_success(self):
        """Test guest checkout with valid data"""
        checkout_data = {
            "items": [
                {
                    "id": "test_item_1",
                    "type": "product",
                    "title": "Test Product",
                    "price": 99.99,
                    "quantity": 1
                }
            ],
            "customer": {
                "name": "Test Customer",
                "email": "testcustomer@example.com",
                "phone": "+1234567890",
                "address": "123 Test Street",
                "city": "Test City",
                "zipCode": "12345",
                "country": "US"
            },
            "total": 99.99
        }
        
        response = requests.post(
            f"{BASE_URL}/api/marketplace/guest-checkout",
            json=checkout_data
        )
        assert response.status_code == 200, f"Checkout failed: {response.text}"
        data = response.json()
        assert "order_id" in data, "No order_id in response"
        assert "message" in data, "No message in response"
        print(f"SUCCESS: Guest checkout completed, order_id: {data['order_id']}")
        print(f"  - Message: {data['message']}")
    
    def test_guest_checkout_missing_required_fields(self):
        """Test guest checkout with missing required fields"""
        checkout_data = {
            "items": [{"id": "1", "type": "product", "title": "Test", "price": 10, "quantity": 1}],
            "customer": {
                "phone": "+1234567890"  # Missing name and email
            },
            "total": 10
        }
        
        response = requests.post(
            f"{BASE_URL}/api/marketplace/guest-checkout",
            json=checkout_data
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("SUCCESS: Guest checkout correctly validates required fields")
    
    def test_guest_checkout_multiple_items(self):
        """Test guest checkout with multiple items"""
        checkout_data = {
            "items": [
                {"id": "1", "type": "product", "title": "Product 1", "price": 50, "quantity": 2},
                {"id": "2", "type": "rental", "title": "Rental 1", "price": 100, "quantity": 1},
                {"id": "3", "type": "service", "title": "Service 1", "price": 75, "quantity": 1}
            ],
            "customer": {
                "name": "Multi Item Customer",
                "email": "multi@example.com",
                "address": "456 Multi Street",
                "city": "Multi City",
                "zipCode": "67890"
            },
            "total": 275
        }
        
        response = requests.post(
            f"{BASE_URL}/api/marketplace/guest-checkout",
            json=checkout_data
        )
        assert response.status_code == 200, f"Checkout failed: {response.text}"
        data = response.json()
        assert "order_id" in data
        print(f"SUCCESS: Multi-item guest checkout completed, order_id: {data['order_id']}")


class TestLandingPageFeaturedListings:
    """Tests for landing page featured listings carousel"""
    
    def test_marketplace_listings_endpoint(self):
        """Test marketplace listings endpoint used by carousel"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings?limit=6")
        assert response.status_code == 200, f"Failed: {response.text}"
        print("SUCCESS: Marketplace listings endpoint works for carousel")
    
    def test_rentals_endpoint(self):
        """Test rentals endpoint used by carousel"""
        response = requests.get(f"{BASE_URL}/api/rentals/properties?limit=6")
        assert response.status_code == 200, f"Failed: {response.text}"
        print("SUCCESS: Rentals endpoint works for carousel")
    
    def test_services_endpoint(self):
        """Test services endpoint used by carousel"""
        response = requests.get(f"{BASE_URL}/api/services?limit=6")
        assert response.status_code == 200, f"Failed: {response.text}"
        print("SUCCESS: Services endpoint works for carousel")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
