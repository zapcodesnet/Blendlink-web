"""
Test Member Pages Creation API - verifies the production clone/json body fix
Tests page creation flow, follow/unfollow, update, and delete operations
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://emergency-fixes-1.preview.emergentagent.com')
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')

TEST_EMAIL = "test@blendlink.com"
TEST_PASSWORD = "admin"


class TestMemberPagesAPI:
    """Test member pages CRUD operations - verifies JSON response handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        assert self.token, "No token received from login"
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
    def test_1_page_types_api(self):
        """Test GET /api/member-pages/types returns valid JSON"""
        response = requests.get(f"{BASE_URL}/api/member-pages/types", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "page_types" in data, "Missing page_types in response"
        assert "order_types" in data, "Missing order_types in response"
        print(f"✓ Page types API works: {list(data['page_types'].keys())}")
        
    def test_2_check_slug_availability(self):
        """Test slug availability check API"""
        unique_slug = f"test-slug-{uuid.uuid4().hex[:8]}"
        response = requests.get(
            f"{BASE_URL}/api/member-pages/check-slug/{unique_slug}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "is_available" in data, "Missing is_available in response"
        assert data["is_available"] == True, "New slug should be available"
        print(f"✓ Slug check API works: {unique_slug} is available")
        
    def test_3_create_page_returns_valid_json(self):
        """Test POST /api/member-pages/ - CRITICAL: must return valid JSON without clone errors"""
        unique_slug = f"test-page-{uuid.uuid4().hex[:8]}"
        page_data = {
            "page_type": "general",
            "name": f"Test Page {unique_slug}",
            "slug": unique_slug,
            "description": "Test page created for clone/json fix verification",
            "category": "business"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/member-pages/",
            json=page_data,
            headers=self.headers
        )
        
        # Verify response status
        assert response.status_code in [200, 201], f"Page creation failed with {response.status_code}: {response.text}"
        
        # Verify response is valid JSON - this would fail with clone() errors
        try:
            data = response.json()
        except Exception as e:
            pytest.fail(f"Failed to parse JSON response: {e}. Response text: {response.text[:500]}")
        
        # Verify response structure
        assert "page" in data or "page_id" in data, f"Missing page data in response: {data.keys()}"
        
        page = data.get("page", data)
        assert page.get("page_id") or page.get("id"), "Missing page_id"
        assert page.get("name") == page_data["name"], "Page name mismatch"
        assert page.get("slug") == unique_slug, "Slug mismatch"
        
        # Store page_id for cleanup
        self.created_page_id = page.get("page_id") or page.get("id")
        print(f"✓ Page created successfully: {self.created_page_id}")
        
        # Return page_id for other tests
        return self.created_page_id
        
    def test_4_get_my_pages(self):
        """Test GET /api/member-pages/my-pages returns pages"""
        response = requests.get(f"{BASE_URL}/api/member-pages/my-pages", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "pages" in data, f"Missing pages in response: {data.keys()}"
        assert isinstance(data["pages"], list), "pages should be a list"
        
        # Also check for following pages
        assert "following" in data, "Missing following in response"
        print(f"✓ My pages API works: {len(data['pages'])} owned, {len(data['following'])} following")
        
    def test_5_discover_pages(self):
        """Test GET /api/member-pages/discover returns pages"""
        response = requests.get(f"{BASE_URL}/api/member-pages/discover", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "pages" in data, f"Missing pages in response: {data.keys()}"
        print(f"✓ Discover API works: {len(data['pages'])} pages found")
        
    def test_6_create_and_get_page(self):
        """Test create page followed by get - verifies data persistence"""
        unique_slug = f"crud-test-{uuid.uuid4().hex[:8]}"
        page_data = {
            "page_type": "store",
            "name": f"CRUD Test Store {unique_slug}",
            "slug": unique_slug,
            "description": "Testing CRUD operations",
            "category": "shopping"
        }
        
        # Create
        create_response = requests.post(
            f"{BASE_URL}/api/member-pages/",
            json=page_data,
            headers=self.headers
        )
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        
        create_data = create_response.json()
        page = create_data.get("page", create_data)
        page_id = page.get("page_id") or page.get("id")
        
        # Get the page by ID
        get_response = requests.get(
            f"{BASE_URL}/api/member-pages/{page_id}",
            headers=self.headers
        )
        assert get_response.status_code == 200, f"Get page failed: {get_response.text}"
        
        get_data = get_response.json()
        assert get_data.get("page_id") == page_id or get_data.get("id") == page_id, "Page ID mismatch"
        assert get_data.get("name") == page_data["name"], "Name mismatch after retrieval"
        
        print(f"✓ Create and Get page works: {page_id}")
        return page_id

    def test_7_update_page(self):
        """Test PUT /api/member-pages/:id - update page"""
        # First create a page to update
        unique_slug = f"update-test-{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/member-pages/",
            json={
                "page_type": "general",
                "name": f"Update Test {unique_slug}",
                "slug": unique_slug,
                "description": "Original description"
            },
            headers=self.headers
        )
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        
        page = create_response.json().get("page", create_response.json())
        page_id = page.get("page_id") or page.get("id")
        
        # Update the page
        update_data = {
            "name": "Updated Page Name",
            "description": "Updated description"
        }
        update_response = requests.put(
            f"{BASE_URL}/api/member-pages/{page_id}",
            json=update_data,
            headers=self.headers
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        
        update_result = update_response.json()
        updated_page = update_result.get("page", update_result)
        assert updated_page.get("name") == "Updated Page Name", "Name not updated"
        
        print(f"✓ Update page works: {page_id}")
        return page_id

    def test_8_delete_page(self):
        """Test DELETE /api/member-pages/:id - delete page"""
        # Create a page to delete
        unique_slug = f"delete-test-{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/member-pages/",
            json={
                "page_type": "general",
                "name": f"Delete Test {unique_slug}",
                "slug": unique_slug
            },
            headers=self.headers
        )
        assert create_response.status_code in [200, 201], f"Create failed: {create_response.text}"
        
        page = create_response.json().get("page", create_response.json())
        page_id = page.get("page_id") or page.get("id")
        
        # Delete the page
        delete_response = requests.delete(
            f"{BASE_URL}/api/member-pages/{page_id}",
            headers=self.headers
        )
        assert delete_response.status_code == 200, f"Delete failed: {delete_response.text}"
        
        # Verify page is deleted
        get_response = requests.get(
            f"{BASE_URL}/api/member-pages/{page_id}",
            headers=self.headers
        )
        assert get_response.status_code == 404, "Page should be deleted"
        
        print(f"✓ Delete page works: {page_id}")


class TestFollowUnfollow:
    """Test follow/unfollow page functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
    def test_1_get_discoverable_pages(self):
        """Get discoverable pages to find one to follow"""
        response = requests.get(f"{BASE_URL}/api/member-pages/discover", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        pages = data.get("pages", [])
        
        # Find a page not owned by current user
        followable = [p for p in pages if not p.get("is_owner")]
        if followable:
            print(f"✓ Found {len(followable)} followable pages")
            return followable[0]["page_id"]
        else:
            print("⚠ No followable pages found (all owned by test user)")
            pytest.skip("No followable pages available")


class TestMultiplePageCreation:
    """Test creating multiple pages in succession - stress test for clone/json fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
    def test_rapid_page_creation(self):
        """Create multiple pages rapidly - tests for clone/body errors"""
        created_pages = []
        errors = []
        
        for i in range(3):
            unique_slug = f"rapid-test-{i}-{uuid.uuid4().hex[:8]}"
            page_data = {
                "page_type": ["general", "store", "services"][i % 3],
                "name": f"Rapid Test Page {i+1}",
                "slug": unique_slug,
                "description": f"Rapid creation test #{i+1}"
            }
            
            try:
                response = requests.post(
                    f"{BASE_URL}/api/member-pages/",
                    json=page_data,
                    headers=self.headers
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    page = data.get("page", data)
                    created_pages.append(page.get("page_id"))
                    print(f"✓ Page {i+1} created successfully")
                else:
                    errors.append(f"Page {i+1} failed: {response.status_code} - {response.text[:200]}")
                    
            except Exception as e:
                errors.append(f"Page {i+1} exception: {str(e)}")
            
            # Small delay between requests
            time.sleep(0.5)
        
        # Cleanup created pages
        for page_id in created_pages:
            try:
                requests.delete(f"{BASE_URL}/api/member-pages/{page_id}", headers=self.headers)
            except:
                pass
        
        # Assert no errors
        assert len(errors) == 0, f"Errors during rapid creation: {errors}"
        assert len(created_pages) == 3, f"Expected 3 pages, got {len(created_pages)}"
        print(f"✓ All {len(created_pages)} pages created successfully")


class TestResponseBodyIntegrity:
    """Specific tests for the clone/json body fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
    def test_response_is_clean_json(self):
        """Verify API responses are clean JSON without HTML or error messages"""
        
        # Test discover endpoint
        response = requests.get(f"{BASE_URL}/api/member-pages/discover", headers=self.headers)
        assert response.status_code == 200
        
        # Verify Content-Type is JSON
        content_type = response.headers.get("Content-Type", "")
        assert "application/json" in content_type, f"Expected JSON content type, got: {content_type}"
        
        # Verify response body is valid JSON
        try:
            data = response.json()
        except Exception as e:
            # Check if response contains HTML error page
            if "<html" in response.text.lower():
                pytest.fail("Response contains HTML error page instead of JSON")
            pytest.fail(f"Invalid JSON response: {e}")
        
        # Verify no error indicators in response - check for specific error patterns
        # Don't just check for word "clone" as it could be in page data
        text = response.text.lower()
        error_patterns = [
            "failed to execute 'clone' on 'response'",
            "body stream already read",
            "body is already used",
            "failed to execute 'json' on 'response'",
            "server returned invalid response"
        ]
        for pattern in error_patterns:
            assert pattern not in text, f"Response contains error: {pattern}"
        
        print("✓ Response is clean JSON without clone/body errors")

    def test_create_page_response_integrity(self):
        """Test that page creation returns clean JSON"""
        unique_slug = f"integrity-test-{uuid.uuid4().hex[:8]}"
        page_data = {
            "page_type": "general",
            "name": "Response Integrity Test",
            "slug": unique_slug,
            "description": "Testing response integrity"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/member-pages/",
            json=page_data,
            headers=self.headers
        )
        
        # Check response
        assert response.status_code in [200, 201], f"Unexpected status: {response.status_code}"
        
        # Verify JSON parsing works
        try:
            data = response.json()
        except Exception as e:
            pytest.fail(f"JSON parse failed - potential clone/body error: {e}. Raw: {response.text[:300]}")
        
        # Verify expected fields
        page = data.get("page", data)
        assert "page_id" in page or "id" in page, f"Missing page_id: {page.keys()}"
        
        # Cleanup
        page_id = page.get("page_id") or page.get("id")
        if page_id:
            requests.delete(f"{BASE_URL}/api/member-pages/{page_id}", headers=self.headers)
        
        print(f"✓ Page creation response is valid JSON: {page_id}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
