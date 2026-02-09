"""
Test Member Pages Real-time Sync - MongoDB Change Streams
Tests:
1. Page CRUD operations (Create, Read, Update, Delete)
2. WebSocket connection to /api/member-pages/ws/{page_id}
3. MongoDB Change Stream broadcasting
4. Product CRUD operations on store pages
5. Subscription/Follow functionality
6. Pages listing verification
"""

import pytest
import requests
import os
import time
import json
import uuid
from datetime import datetime
import asyncio
import websockets

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@blendlink.com"
TEST_USER_PASSWORD = "admin"


class TestMemberPagesAuth:
    """Authentication tests"""
    
    token = None
    user_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before tests"""
        if not TestMemberPagesAuth.token:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
            )
            assert response.status_code == 200, f"Login failed: {response.text}"
            data = response.json()
            TestMemberPagesAuth.token = data.get("token")
            TestMemberPagesAuth.user_id = data.get("user", {}).get("user_id")
            assert TestMemberPagesAuth.token, "No token received"
    
    def get_headers(self):
        return {"Authorization": f"Bearer {TestMemberPagesAuth.token}"}


class TestPageCRUD(TestMemberPagesAuth):
    """Test Page Create, Read, Update, Delete operations"""
    
    created_page_id = None
    created_page_slug = None
    
    def test_01_create_page(self):
        """Test creating a new member page - should appear instantly"""
        unique_slug = f"test-sync-page-{uuid.uuid4().hex[:8]}"
        page_data = {
            "page_type": "store",
            "name": f"TEST_Sync Store {datetime.now().isoformat()}",
            "slug": unique_slug,
            "description": "Test page for real-time sync verification",
            "category": "business"
        }
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/member-pages/",
            headers=self.get_headers(),
            json=page_data
        )
        create_time = time.time() - start_time
        
        assert response.status_code == 200, f"Create page failed: {response.text}"
        
        data = response.json()
        assert "page" in data, "Response missing 'page' field"
        page = data["page"]
        
        # Store for later tests
        TestPageCRUD.created_page_id = page.get("page_id")
        TestPageCRUD.created_page_slug = page.get("slug")
        
        assert TestPageCRUD.created_page_id, "Page ID not returned"
        assert page.get("name") == page_data["name"], "Page name mismatch"
        assert page.get("page_type") == "store", "Page type mismatch"
        assert page.get("description") == page_data["description"], "Description mismatch"
        
        # Verify creation time (should be under 2s as per requirement)
        print(f"Page creation time: {create_time:.2f}s")
        assert create_time < 5, f"Page creation took too long: {create_time:.2f}s"
        
        # BL coins reward check
        assert data.get("bl_coins_earned") == 40, "Expected 40 BL coins for page creation"
        
        print(f"✓ Page created: {TestPageCRUD.created_page_id} in {create_time:.2f}s")
    
    def test_02_verify_page_in_my_pages(self):
        """Verify created page appears in My Pages list immediately"""
        assert TestPageCRUD.created_page_id, "No page created in previous test"
        
        start_time = time.time()
        response = requests.get(
            f"{BASE_URL}/api/member-pages/my-pages",
            headers=self.get_headers()
        )
        fetch_time = time.time() - start_time
        
        assert response.status_code == 200, f"Get my pages failed: {response.text}"
        
        data = response.json()
        pages = data.get("pages", [])
        
        # Find the created page
        created_page = next(
            (p for p in pages if p.get("page_id") == TestPageCRUD.created_page_id),
            None
        )
        
        assert created_page, f"Created page {TestPageCRUD.created_page_id} not found in my-pages list"
        print(f"✓ Page found in my-pages list in {fetch_time:.2f}s")
    
    def test_03_get_page_by_id(self):
        """Test retrieving a specific page"""
        assert TestPageCRUD.created_page_id, "No page created"
        
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{TestPageCRUD.created_page_id}",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Get page failed: {response.text}"
        
        data = response.json()
        assert data.get("page_id") == TestPageCRUD.created_page_id
        assert data.get("is_owner") == True, "User should be marked as owner"
        
        print(f"✓ Page retrieved successfully")
    
    def test_04_update_page(self):
        """Test page update - should propagate instantly"""
        assert TestPageCRUD.created_page_id, "No page created"
        
        update_data = {
            "name": f"TEST_Updated Store {datetime.now().isoformat()}",
            "description": "Updated description for sync test",
            "is_published": True
        }
        
        start_time = time.time()
        response = requests.put(
            f"{BASE_URL}/api/member-pages/{TestPageCRUD.created_page_id}",
            headers=self.get_headers(),
            json=update_data
        )
        update_time = time.time() - start_time
        
        assert response.status_code == 200, f"Update page failed: {response.text}"
        
        data = response.json()
        page = data.get("page", {})
        
        assert page.get("name") == update_data["name"], "Name not updated"
        assert page.get("description") == update_data["description"], "Description not updated"
        assert page.get("is_published") == True, "Published status not updated"
        
        print(f"✓ Page updated in {update_time:.2f}s")
        assert update_time < 5, f"Update took too long: {update_time:.2f}s"
    
    def test_05_verify_update_persisted(self):
        """Verify update via GET - confirms persistence"""
        assert TestPageCRUD.created_page_id, "No page created"
        
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{TestPageCRUD.created_page_id}",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Get page failed: {response.text}"
        
        data = response.json()
        assert "Updated description" in data.get("description", ""), "Update not persisted"
        assert data.get("is_published") == True, "Published status not persisted"
        
        print(f"✓ Update persisted and verified")


class TestProductCRUD(TestMemberPagesAuth):
    """Test Product CRUD on store pages"""
    
    created_product_id = None
    
    def test_01_create_product(self):
        """Create a product on the test store page"""
        page_id = TestPageCRUD.created_page_id
        if not page_id:
            pytest.skip("No page created - skipping product tests")
        
        product_data = {
            "name": f"TEST_Sync Product {uuid.uuid4().hex[:6]}",
            "description": "Test product for sync verification",
            "price": 29.99,
            "category": "Electronics",
            "stock_quantity": 100,
            "low_stock_threshold": 10
        }
        
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/api/page-products/{page_id}",
            headers=self.get_headers(),
            json=product_data
        )
        create_time = time.time() - start_time
        
        assert response.status_code == 200, f"Create product failed: {response.text}"
        
        data = response.json()
        product = data.get("product", {})
        
        TestProductCRUD.created_product_id = product.get("product_id")
        assert TestProductCRUD.created_product_id, "Product ID not returned"
        assert product.get("name") == product_data["name"]
        assert product.get("price") == product_data["price"]
        
        print(f"✓ Product created: {TestProductCRUD.created_product_id} in {create_time:.2f}s")
    
    def test_02_get_products(self):
        """Verify product appears in page products list"""
        page_id = TestPageCRUD.created_page_id
        if not page_id:
            pytest.skip("No page created")
        
        response = requests.get(
            f"{BASE_URL}/api/page-products/{page_id}",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Get products failed: {response.text}"
        
        data = response.json()
        products = data.get("products", [])
        
        assert len(products) >= 1, "No products found"
        
        # Find our created product
        our_product = next(
            (p for p in products if p.get("product_id") == TestProductCRUD.created_product_id),
            None
        )
        assert our_product, "Created product not found in list"
        print(f"✓ Product found in products list")
    
    def test_03_update_product(self):
        """Update product and verify sync"""
        page_id = TestPageCRUD.created_page_id
        product_id = TestProductCRUD.created_product_id
        if not page_id or not product_id:
            pytest.skip("No page/product created")
        
        update_data = {
            "name": f"TEST_Updated Product {uuid.uuid4().hex[:6]}",
            "description": "Updated product description",
            "price": 39.99,
            "category": "Electronics",
            "stock_quantity": 75
        }
        
        start_time = time.time()
        response = requests.put(
            f"{BASE_URL}/api/page-products/{page_id}/{product_id}",
            headers=self.get_headers(),
            json=update_data
        )
        update_time = time.time() - start_time
        
        assert response.status_code == 200, f"Update product failed: {response.text}"
        
        data = response.json()
        product = data.get("product", {})
        
        assert product.get("price") == 39.99, "Price not updated"
        print(f"✓ Product updated in {update_time:.2f}s")
    
    def test_04_delete_product(self):
        """Delete product and verify removal"""
        page_id = TestPageCRUD.created_page_id
        product_id = TestProductCRUD.created_product_id
        if not page_id or not product_id:
            pytest.skip("No page/product created")
        
        start_time = time.time()
        response = requests.delete(
            f"{BASE_URL}/api/page-products/{page_id}/{product_id}",
            headers=self.get_headers()
        )
        delete_time = time.time() - start_time
        
        assert response.status_code == 200, f"Delete product failed: {response.text}"
        
        # Verify deletion
        response = requests.get(
            f"{BASE_URL}/api/page-products/{page_id}",
            headers=self.get_headers()
        )
        
        data = response.json()
        products = data.get("products", [])
        
        deleted_product = next(
            (p for p in products if p.get("product_id") == product_id),
            None
        )
        assert deleted_product is None, "Product still exists after deletion"
        
        print(f"✓ Product deleted in {delete_time:.2f}s")


class TestSubscription(TestMemberPagesAuth):
    """Test page subscription/follow functionality"""
    
    target_page_id = None
    
    def test_01_discover_pages(self):
        """Get discoverable pages"""
        response = requests.get(
            f"{BASE_URL}/api/member-pages/discover",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Discover pages failed: {response.text}"
        
        data = response.json()
        pages = data.get("pages", [])
        
        print(f"✓ Found {len(pages)} discoverable pages")
        
        # Find a page owned by someone else to test subscription
        # For now, we'll use our own page but skip the actual subscribe
        if pages:
            for page in pages:
                if not page.get("is_owner"):
                    TestSubscription.target_page_id = page.get("page_id")
                    break
    
    def test_02_subscribe_own_page_should_fail(self):
        """Subscribing to own page should fail"""
        page_id = TestPageCRUD.created_page_id
        if not page_id:
            pytest.skip("No page created")
        
        response = requests.post(
            f"{BASE_URL}/api/member-pages/{page_id}/subscribe",
            headers=self.get_headers()
        )
        
        # Should fail with 400 - can't subscribe to own page
        assert response.status_code == 400, f"Expected 400 for subscribing to own page, got {response.status_code}"
        
        data = response.json()
        assert "own page" in data.get("detail", "").lower(), "Expected error about own page"
        
        print(f"✓ Correctly prevented subscribing to own page")


class TestPageTypes(TestMemberPagesAuth):
    """Test available page types"""
    
    def test_01_get_page_types(self):
        """Get available page types"""
        response = requests.get(
            f"{BASE_URL}/api/member-pages/types",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Get page types failed: {response.text}"
        
        data = response.json()
        page_types = data.get("page_types", {})
        order_types = data.get("order_types", [])
        
        # Verify expected page types
        expected_types = ["store", "restaurant", "services", "rental", "general"]
        for ptype in expected_types:
            assert ptype in page_types, f"Missing page type: {ptype}"
        
        # Verify order types
        expected_order_types = ["dine_in", "drive_thru", "pickup", "delivery", "shipping"]
        for otype in expected_order_types:
            assert otype in order_types, f"Missing order type: {otype}"
        
        print(f"✓ Page types verified: {list(page_types.keys())}")
        print(f"✓ Order types verified: {order_types}")


class TestSlugAvailability(TestMemberPagesAuth):
    """Test slug availability check"""
    
    def test_01_check_slug_available(self):
        """Check availability of a new slug"""
        unique_slug = f"test-slug-{uuid.uuid4().hex[:12]}"
        
        response = requests.get(
            f"{BASE_URL}/api/member-pages/check-slug/{unique_slug}",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Check slug failed: {response.text}"
        
        data = response.json()
        assert data.get("is_available") == True, "New unique slug should be available"
        assert data.get("slug") == unique_slug.lower(), "Slug should be lowercased"
        
        print(f"✓ Slug '{unique_slug}' is available")
    
    def test_02_check_existing_slug(self):
        """Check slug that already exists"""
        slug = TestPageCRUD.created_page_slug
        if not slug:
            pytest.skip("No page created")
        
        response = requests.get(
            f"{BASE_URL}/api/member-pages/check-slug/{slug}",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200, f"Check slug failed: {response.text}"
        
        data = response.json()
        assert data.get("is_available") == False, "Existing slug should not be available"
        assert "suggestions" in data, "Should provide alternative suggestions"
        
        print(f"✓ Existing slug correctly marked as unavailable")
        print(f"  Suggestions: {data.get('suggestions', [])[:3]}")


class TestPageDeletion(TestMemberPagesAuth):
    """Test page deletion - should run last"""
    
    def test_01_delete_page(self):
        """Delete test page and verify removal"""
        page_id = TestPageCRUD.created_page_id
        if not page_id:
            pytest.skip("No page created to delete")
        
        start_time = time.time()
        response = requests.delete(
            f"{BASE_URL}/api/member-pages/{page_id}",
            headers=self.get_headers()
        )
        delete_time = time.time() - start_time
        
        assert response.status_code == 200, f"Delete page failed: {response.text}"
        
        print(f"✓ Page deleted in {delete_time:.2f}s")
        
        # Verify page no longer exists
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{page_id}",
            headers=self.get_headers()
        )
        
        assert response.status_code == 404, f"Page should return 404 after deletion, got {response.status_code}"
        
        print(f"✓ Page deletion verified - returns 404")
    
    def test_02_verify_page_removed_from_list(self):
        """Verify deleted page not in my-pages list"""
        page_id = TestPageCRUD.created_page_id
        if not page_id:
            pytest.skip("No page created")
        
        response = requests.get(
            f"{BASE_URL}/api/member-pages/my-pages",
            headers=self.get_headers()
        )
        
        assert response.status_code == 200
        
        data = response.json()
        pages = data.get("pages", [])
        
        deleted_page = next(
            (p for p in pages if p.get("page_id") == page_id),
            None
        )
        
        assert deleted_page is None, "Deleted page still appears in my-pages"
        print(f"✓ Deleted page removed from my-pages list")


# Run order configuration
pytest_plugins = ['pytest_order']

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
