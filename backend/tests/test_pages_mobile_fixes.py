"""
Backend Tests for Member Pages Mobile Fixes:
1. PUT /api/page-products/{page_id}/{product_id} - Product update endpoint
2. DELETE /api/page-products/{page_id}/{product_id} - Product delete endpoint
3. POST /api/upload/image - Image upload endpoint returns correct URL
4. GET /api/upload/files/{filename} - Serve uploaded files
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"


class TestProductUpdateDelete:
    """Test product update and delete endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def test_page(self, auth_token):
        """Create or get a test page for product testing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Get user's pages first
        response = requests.get(f"{BASE_URL}/api/member-pages/my-pages", headers=headers)
        assert response.status_code == 200
        pages = response.json().get("pages", [])
        
        # Use existing store page or create new one
        store_pages = [p for p in pages if p.get("page_type") == "store"]
        if store_pages:
            return store_pages[0]
        
        # Create a new test store page
        unique_slug = f"test-store-{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/member-pages/", headers=headers, json={
            "page_type": "store",
            "name": "Test Store",
            "slug": unique_slug,
            "description": "Test store for product testing"
        })
        assert response.status_code == 200, f"Failed to create page: {response.text}"
        return response.json()["page"]
    
    def test_create_product_for_testing(self, auth_token, test_page):
        """Create a product to use in update/delete tests"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        page_id = test_page["page_id"]
        
        response = requests.post(f"{BASE_URL}/api/page-products/{page_id}", headers=headers, json={
            "name": f"Test Product {uuid.uuid4().hex[:6]}",
            "description": "Test product for update/delete testing",
            "price": 19.99,
            "category": "Test",
            "images": [],
            "stock_quantity": 10
        })
        assert response.status_code == 200, f"Create product failed: {response.text}"
        data = response.json()
        assert "product" in data
        assert "product_id" in data["product"]
        print(f"✓ Created test product: {data['product']['product_id']}")
        return data["product"]
    
    def test_update_product_endpoint(self, auth_token, test_page):
        """Test PUT /api/page-products/{page_id}/{product_id}"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        page_id = test_page["page_id"]
        
        # First create a product
        create_resp = requests.post(f"{BASE_URL}/api/page-products/{page_id}", headers=headers, json={
            "name": f"Update Test Product {uuid.uuid4().hex[:6]}",
            "description": "Original description",
            "price": 25.00,
            "category": "Test",
            "images": []
        })
        assert create_resp.status_code == 200, f"Create failed: {create_resp.text}"
        product_id = create_resp.json()["product"]["product_id"]
        
        # Update the product
        update_data = {
            "name": "Updated Product Name",
            "description": "Updated description",
            "price": 35.00,
            "category": "Updated Category",
            "images": ["https://example.com/image.jpg"]
        }
        
        response = requests.put(
            f"{BASE_URL}/api/page-products/{page_id}/{product_id}",
            headers=headers,
            json=update_data
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert "product" in data
        assert data["product"]["name"] == "Updated Product Name"
        assert data["product"]["price"] == 35.00
        print(f"✓ Product update endpoint works - updated {product_id}")
        
        # Verify with GET
        get_resp = requests.get(f"{BASE_URL}/api/page-products/{page_id}", headers=headers)
        assert get_resp.status_code == 200
        products = get_resp.json().get("products", [])
        updated = next((p for p in products if p["product_id"] == product_id), None)
        assert updated is not None
        assert updated["name"] == "Updated Product Name"
        print(f"✓ GET confirms update persisted")
    
    def test_delete_product_endpoint(self, auth_token, test_page):
        """Test DELETE /api/page-products/{page_id}/{product_id}"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        page_id = test_page["page_id"]
        
        # First create a product
        create_resp = requests.post(f"{BASE_URL}/api/page-products/{page_id}", headers=headers, json={
            "name": f"Delete Test Product {uuid.uuid4().hex[:6]}",
            "description": "Will be deleted",
            "price": 15.00,
            "category": "Test"
        })
        assert create_resp.status_code == 200
        product_id = create_resp.json()["product"]["product_id"]
        
        # Delete the product
        response = requests.delete(
            f"{BASE_URL}/api/page-products/{page_id}/{product_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"✓ Product delete endpoint works - deleted {product_id}")
        
        # Verify deletion with GET
        get_resp = requests.get(f"{BASE_URL}/api/page-products/{page_id}", headers=headers)
        assert get_resp.status_code == 200
        products = get_resp.json().get("products", [])
        deleted = next((p for p in products if p["product_id"] == product_id), None)
        assert deleted is None, "Product should have been deleted"
        print(f"✓ GET confirms product was deleted")
    
    def test_update_nonexistent_product_returns_404(self, auth_token, test_page):
        """Test that updating non-existent product returns 404"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        page_id = test_page["page_id"]
        
        response = requests.put(
            f"{BASE_URL}/api/page-products/{page_id}/nonexistent_prod_123",
            headers=headers,
            json={"name": "Test", "price": 10.00}
        )
        assert response.status_code == 404
        print(f"✓ Update non-existent product returns 404")
    
    def test_delete_nonexistent_product_returns_404(self, auth_token, test_page):
        """Test that deleting non-existent product returns 404"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        page_id = test_page["page_id"]
        
        response = requests.delete(
            f"{BASE_URL}/api/page-products/{page_id}/nonexistent_prod_456",
            headers=headers
        )
        assert response.status_code == 404
        print(f"✓ Delete non-existent product returns 404")


class TestImageUpload:
    """Test image upload endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_image_upload_requires_auth(self):
        """Test POST /api/upload/image requires authentication"""
        # Create a simple test image (1x1 red pixel PNG)
        from io import BytesIO
        image_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
            0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
            0x42, 0x60, 0x82
        ])
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            files={"file": ("test.png", BytesIO(image_data), "image/png")}
        )
        assert response.status_code == 401, "Should require auth"
        print(f"✓ Image upload requires authentication")
    
    def test_image_upload_returns_url(self, auth_token):
        """Test POST /api/upload/image returns correct URL format"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a simple test image (1x1 red pixel PNG)
        from io import BytesIO
        image_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
            0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
            0x42, 0x60, 0x82
        ])
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            headers=headers,
            files={"file": ("test.png", BytesIO(image_data), "image/png")}
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        data = response.json()
        
        assert "url" in data, "Response should contain 'url' field"
        assert data["url"].startswith("/api/upload/files/"), f"URL should start with /api/upload/files/, got: {data['url']}"
        assert "filename" in data
        print(f"✓ Image upload returns URL: {data['url']}")
        return data
    
    def test_serve_uploaded_file(self, auth_token):
        """Test GET /api/upload/files/{filename} serves the file"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First upload an image
        from io import BytesIO
        image_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
            0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
            0x42, 0x60, 0x82
        ])
        
        upload_resp = requests.post(
            f"{BASE_URL}/api/upload/image",
            headers=headers,
            files={"file": ("serve_test.png", BytesIO(image_data), "image/png")}
        )
        assert upload_resp.status_code == 200
        filename = upload_resp.json()["filename"]
        
        # Now try to fetch the file (no auth required for serving)
        get_resp = requests.get(f"{BASE_URL}/api/upload/files/{filename}")
        assert get_resp.status_code == 200, f"Failed to serve file: {get_resp.status_code}"
        assert len(get_resp.content) > 0
        print(f"✓ GET /api/upload/files/{filename} serves the file correctly")
    
    def test_serve_nonexistent_file_returns_404(self):
        """Test GET /api/upload/files/{filename} returns 404 for nonexistent"""
        response = requests.get(f"{BASE_URL}/api/upload/files/nonexistent_file_xyz123.png")
        assert response.status_code == 404
        print(f"✓ GET nonexistent file returns 404")
    
    def test_upload_rejects_non_image(self, auth_token):
        """Test that upload endpoint rejects non-image files"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        from io import BytesIO
        text_data = b"This is not an image"
        
        response = requests.post(
            f"{BASE_URL}/api/upload/image",
            headers=headers,
            files={"file": ("test.txt", BytesIO(text_data), "text/plain")}
        )
        assert response.status_code == 400, f"Should reject non-image, got: {response.status_code}"
        print(f"✓ Upload rejects non-image files")


class TestFullProductWorkflow:
    """Test full product workflow with image upload"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def test_page(self, auth_token):
        """Get or create test page"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/member-pages/my-pages", headers=headers)
        assert response.status_code == 200
        pages = response.json().get("pages", [])
        store_pages = [p for p in pages if p.get("page_type") == "store"]
        if store_pages:
            return store_pages[0]
        
        unique_slug = f"workflow-test-{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/member-pages/", headers=headers, json={
            "page_type": "store",
            "name": "Workflow Test Store",
            "slug": unique_slug
        })
        assert response.status_code == 200
        return response.json()["page"]
    
    def test_create_product_with_image_then_update_then_delete(self, auth_token, test_page):
        """Test full workflow: upload image -> create product -> update -> delete"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        page_id = test_page["page_id"]
        
        # Step 1: Upload an image
        from io import BytesIO
        image_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0x00, 0x00, 0x00,
            0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
            0x42, 0x60, 0x82
        ])
        
        upload_resp = requests.post(
            f"{BASE_URL}/api/upload/image",
            headers=headers,
            files={"file": ("workflow.png", BytesIO(image_data), "image/png")}
        )
        assert upload_resp.status_code == 200
        image_url = upload_resp.json()["url"]
        full_image_url = f"{BASE_URL}{image_url}"
        print(f"✓ Step 1: Uploaded image, URL: {image_url}")
        
        # Step 2: Create product with image
        create_resp = requests.post(f"{BASE_URL}/api/page-products/{page_id}", headers=headers, json={
            "name": "Workflow Test Product",
            "description": "Testing the full workflow",
            "price": 49.99,
            "category": "Test",
            "images": [full_image_url]
        })
        assert create_resp.status_code == 200
        product = create_resp.json()["product"]
        product_id = product["product_id"]
        assert len(product.get("images", [])) > 0
        print(f"✓ Step 2: Created product with image: {product_id}")
        
        # Step 3: Update the product
        update_resp = requests.put(
            f"{BASE_URL}/api/page-products/{page_id}/{product_id}",
            headers=headers,
            json={
                "name": "Updated Workflow Product",
                "description": "Updated description",
                "price": 59.99,
                "category": "Test Updated",
                "images": [full_image_url]
            }
        )
        assert update_resp.status_code == 200
        updated_product = update_resp.json()["product"]
        assert updated_product["name"] == "Updated Workflow Product"
        assert updated_product["price"] == 59.99
        print(f"✓ Step 3: Updated product successfully")
        
        # Step 4: Delete the product
        delete_resp = requests.delete(
            f"{BASE_URL}/api/page-products/{page_id}/{product_id}",
            headers=headers
        )
        assert delete_resp.status_code == 200
        print(f"✓ Step 4: Deleted product successfully")
        
        # Verify deletion
        get_resp = requests.get(f"{BASE_URL}/api/page-products/{page_id}", headers=headers)
        products = get_resp.json().get("products", [])
        assert not any(p["product_id"] == product_id for p in products)
        print(f"✓ Full workflow completed successfully!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
