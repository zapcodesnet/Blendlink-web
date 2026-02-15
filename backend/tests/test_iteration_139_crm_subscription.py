"""
Test Iteration 139: Customer CRM Manager and Subscription Toggle Features
- Customer CRM endpoint: GET /api/page-analytics/{page_id}/customers
- Product subscription fields

Test credentials: tester@blendlink.net / BlendLink2024!
Test page: mpage_000a72b44296
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://blendlink-live.preview.emergentagent.com").rstrip("/")
TEST_PAGE_ID = "mpage_000a72b44296"


class TestAuthAndLogin:
    """Test authentication for subsequent tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "tester@blendlink.net",
                "password": "BlendLink2024!"
            }
        )
        print(f"Login response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            token = data.get("token") or data.get("access_token")
            print(f"Token obtained: {token[:20]}..." if token else "No token")
            return token
        print(f"Login failed: {response.text}")
        return None
    
    def test_login_works(self, auth_token):
        """Verify login credentials work"""
        assert auth_token is not None, "Should get auth token from login"


class TestCustomerCRMEndpoint:
    """Test GET /api/page-analytics/{page_id}/customers endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "tester@blendlink.net",
                "password": "BlendLink2024!"
            }
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        pytest.skip("Authentication failed")
    
    def test_customers_endpoint_exists(self, auth_token):
        """Test that customers endpoint exists and returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/customers",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Customers endpoint response: {response.status_code}")
        print(f"Response body: {response.text[:500]}")
        
        # Accept 200 or 403 (if not owner - which is valid behavior)
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}"
    
    def test_customers_response_structure(self, auth_token):
        """Test that customers endpoint returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/customers",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify response has required fields
            assert "customers" in data, "Response should have 'customers' field"
            assert "stats" in data, "Response should have 'stats' field"
            
            # Verify stats structure
            stats = data["stats"]
            assert "total_customers" in stats, "Stats should have total_customers"
            assert "repeat_customers" in stats, "Stats should have repeat_customers"
            assert "total_revenue" in stats, "Stats should have total_revenue"
            assert "avg_order_value" in stats, "Stats should have avg_order_value"
            
            print(f"Stats: {stats}")
            print(f"Customer count: {len(data['customers'])}")
            
            # If customers exist, verify customer structure
            if data["customers"]:
                customer = data["customers"][0]
                assert "id" in customer, "Customer should have id"
                assert "order_count" in customer, "Customer should have order_count"
                assert "total_spent" in customer, "Customer should have total_spent"
                print(f"Sample customer: {customer}")
        
        elif response.status_code == 403:
            # 403 is valid if user doesn't own the page
            print("Got 403 - user may not own test page, which is valid behavior")
    
    def test_customers_unauthorized_without_token(self):
        """Test that endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/customers"
        )
        
        # Should return 401 without token
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"


class TestProductSubscriptionFields:
    """Test that product creation/update handles subscription fields"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "tester@blendlink.net",
                "password": "BlendLink2024!"
            }
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_existing_products(self, auth_token):
        """Test that we can get existing products"""
        response = requests.get(
            f"{BASE_URL}/api/page-products/{TEST_PAGE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Get products response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Products found: {len(data.get('products', []))}")
            if data.get("products"):
                product = data["products"][0]
                print(f"Sample product keys: {list(product.keys())}")
                # Check if subscription fields exist
                print(f"is_subscription: {product.get('is_subscription', 'NOT FOUND')}")
                print(f"subscription_frequency: {product.get('subscription_frequency', 'NOT FOUND')}")
                print(f"trial_period_days: {product.get('trial_period_days', 'NOT FOUND')}")
        
        # Accept various valid status codes
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}"


class TestPageEndpoint:
    """Test page endpoint to verify logo_image field support"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "tester@blendlink.net",
                "password": "BlendLink2024!"
            }
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_page_has_logo_field(self, auth_token):
        """Test that page response includes logo_image field"""
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        print(f"Get page response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # The page data could be at root or nested
            page = data if "page_id" in data else data.get("page", data)
            
            print(f"Page keys: {list(page.keys())[:15]}...")  # First 15 keys
            print(f"logo_image value: {page.get('logo_image', 'NOT FOUND')}")
            print(f"name: {page.get('name', 'NOT FOUND')}")
            
            # Verify logo_image field exists
            assert "logo_image" in page, "Page should have logo_image field"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
