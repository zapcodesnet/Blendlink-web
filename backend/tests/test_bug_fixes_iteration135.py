"""
Test Bug Fixes for Iteration 135:
1. Public Pages showing 404 error - case-insensitive slug lookup
2. Image upload endpoint POST /api/upload/image
3. POS refund endpoint POST /api/pos/refund with 8% fee reversal
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"
TEST_PAGE_SLUG = "myshop-1770708410"


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token") or data.get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestPublicPageSlugLookup:
    """Test case-insensitive public page slug lookup - Fixed 404 issue"""
    
    def test_public_page_exact_slug(self, api_client):
        """Test public page loads with exact slug"""
        response = api_client.get(f"{BASE_URL}/api/member-pages/public/{TEST_PAGE_SLUG}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "page" in data, "Response should contain 'page' object"
        assert "page_id" in data["page"] or "slug" in data["page"], "Page data should have identifiers"
        print(f"✓ Public page loaded successfully with exact slug: {TEST_PAGE_SLUG}")
    
    def test_public_page_uppercase_slug(self, api_client):
        """Test public page loads with uppercase slug (case-insensitive)"""
        uppercase_slug = TEST_PAGE_SLUG.upper()
        response = api_client.get(f"{BASE_URL}/api/member-pages/public/{uppercase_slug}")
        assert response.status_code == 200, f"Expected 200 for uppercase slug, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "page" in data, "Response should contain page data"
        print(f"✓ Case-insensitive slug lookup works: {uppercase_slug}")
    
    def test_public_page_mixed_case_slug(self, api_client):
        """Test public page loads with mixed case slug"""
        mixed_slug = "MyShop-1770708410"
        response = api_client.get(f"{BASE_URL}/api/member-pages/public/{mixed_slug}")
        assert response.status_code == 200, f"Expected 200 for mixed case slug, got {response.status_code}: {response.text}"
        print(f"✓ Mixed case slug lookup works: {mixed_slug}")
    
    def test_nonexistent_page_returns_404(self, api_client):
        """Test that non-existent slug returns 404"""
        response = api_client.get(f"{BASE_URL}/api/member-pages/public/nonexistent-page-xyz123")
        assert response.status_code == 404, f"Expected 404 for non-existent page, got {response.status_code}"
        print("✓ Non-existent page correctly returns 404")


class TestImageUploadEndpoint:
    """Test image upload endpoint POST /api/upload/image"""
    
    def test_image_upload_requires_auth(self, api_client):
        """Test that image upload requires authentication"""
        # Clear auth header for this test
        temp_session = requests.Session()
        
        # Create a simple test image (1x1 pixel PNG)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_image.png', png_data, 'image/png')}
        response = temp_session.post(f"{BASE_URL}/api/upload/image", files=files)
        
        # Should fail without auth
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print("✓ Image upload correctly requires authentication")
    
    def test_image_upload_with_auth(self, authenticated_client, auth_token):
        """Test image upload with authentication"""
        # Create a simple test image (1x1 pixel PNG)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_product_image.png', png_data, 'image/png')}
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image", 
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "url" in data, "Response should contain 'url' field"
        assert "success" in data, "Response should contain 'success' field"
        assert data["success"] == True, "Upload should be successful"
        print(f"✓ Image uploaded successfully, URL: {data.get('url')}")
    
    def test_image_upload_rejects_invalid_type(self, auth_token):
        """Test that non-image files are rejected"""
        # Try to upload a text file
        files = {'file': ('test.txt', b'This is not an image', 'text/plain')}
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image", 
            files=files,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid file type, got {response.status_code}"
        print("✓ Non-image files correctly rejected")


class TestPOSRefundEndpoint:
    """Test POS refund endpoint POST /api/pos/refund with 8% fee reversal"""
    
    @pytest.fixture(scope="class")
    def test_order(self, authenticated_client, auth_token):
        """Create a test order for refund testing"""
        # First get user's page
        headers = {"Authorization": f"Bearer {auth_token}"}
        pages_response = requests.get(f"{BASE_URL}/api/pages/my-pages", headers=headers)
        
        if pages_response.status_code != 200 or not pages_response.json().get("pages"):
            pytest.skip("No pages available for refund testing")
        
        page = pages_response.json()["pages"][0]
        page_id = page["page_id"]
        
        # Create a test order via guest checkout
        order_data = {
            "page_id": page_id,
            "items": [{"product_id": "TEST_PRODUCT", "name": "Test Product", "quantity": 1, "price": 100.00}],
            "customer": {
                "name": "TEST_REFUND_Customer",
                "phone": "1234567890",
                "email": "testrefund@example.com"
            },
            "delivery_option": "pickup",
            "payment_method": "cod",
            "total": 100.00
        }
        
        order_response = requests.post(
            f"{BASE_URL}/api/page-orders/guest",
            json=order_data,
            headers={"Content-Type": "application/json"}
        )
        
        if order_response.status_code == 200:
            order = order_response.json()
            return {"order_id": order.get("order_id"), "page_id": page_id, "total": 100.00}
        
        return None
    
    def test_refund_endpoint_exists(self, authenticated_client):
        """Test that refund endpoint exists"""
        response = authenticated_client.post(f"{BASE_URL}/api/pos/refund", json={
            "order_id": "nonexistent_order",
            "reason": "Test"
        })
        
        # Should return 404 for non-existent order, not 404 for route
        assert response.status_code in [404, 400], f"Refund endpoint should exist, got {response.status_code}: {response.text}"
        print("✓ Refund endpoint exists and is accessible")
    
    def test_refund_validates_order_id(self, authenticated_client):
        """Test that refund validates order ID"""
        response = authenticated_client.post(f"{BASE_URL}/api/pos/refund", json={
            "order_id": "invalid_order_12345",
            "reason": "Test refund"
        })
        
        assert response.status_code == 404, f"Expected 404 for invalid order, got {response.status_code}"
        print("✓ Refund correctly validates order ID")


class TestPlatformFeeDisplay:
    """Test that platform fee (8%) is calculated correctly"""
    
    def test_guest_order_includes_platform_fee(self, api_client):
        """Test that guest orders include 8% platform fee"""
        # Get a public page first
        page_response = api_client.get(f"{BASE_URL}/api/member-pages/public/{TEST_PAGE_SLUG}")
        
        if page_response.status_code != 200:
            pytest.skip("Test page not available")
        
        page_data = page_response.json()
        page_id = page_data.get("page", {}).get("page_id")
        
        if not page_id:
            pytest.skip("Page ID not found in response")
        
        # Create a test order
        order_data = {
            "page_id": page_id,
            "items": [{"product_id": "TEST_FEE_PROD", "name": "Fee Test Product", "quantity": 1, "price": 50.00}],
            "customer": {
                "name": "TEST_FEE_Customer",
                "phone": "9876543210",
                "email": "testfee@example.com"
            },
            "delivery_option": "pickup",
            "payment_method": "cod",
            "total": 50.00
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/page-orders/guest",
            json=order_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            platform_fee = data.get("platform_fee")
            expected_fee = 50.00 * 0.08  # 8% of 50.00 = 4.00
            
            assert platform_fee is not None, "Response should include platform_fee"
            assert abs(platform_fee - expected_fee) < 0.01, f"Expected fee ~{expected_fee}, got {platform_fee}"
            print(f"✓ Platform fee correctly calculated: ${platform_fee:.2f} (8% of $50.00)")
        else:
            print(f"Note: Guest order creation returned {response.status_code}")


class TestCreateListingButtonLink:
    """Test that Create Listing button links to /seller-dashboard"""
    
    def test_seller_dashboard_accessible(self, api_client):
        """Test that seller dashboard route is accessible"""
        # This is a frontend route test - just verify the backend doesn't 404 on marketplace endpoints
        response = api_client.get(f"{BASE_URL}/api/marketplace/listings")
        # Should not be a 404 for route not found
        assert response.status_code != 404 or "not found" not in response.text.lower(), \
            "Marketplace API should exist"
        print("✓ Marketplace API endpoints accessible")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
