"""
Backend API Tests for Daily Sales Report, Marketplace Integration, and Customer Options
Features tested:
- Daily Sales Report API (GET /api/page-analytics/{page_id}/daily-report)
- Marketplace Integration (GET /api/marketplace-link/{page_id}/listings, GET /api/marketplace-link/available)
- Customer Options (GET /api/customer-options/{page_id}/options, POST /api/customer-options/{page_id}/locations)
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://core-bugs-patch.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@blendlink.com"
TEST_PASSWORD = "admin"
TEST_PAGE_ID = "mpage_11ec295ccd36"

class TestAuth:
    """Authentication tests"""
    
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
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data


class TestDailySalesReport:
    """Daily Sales Report API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_daily_report_today(self, auth_token):
        """Test daily report for today"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/daily-report?date={today}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Daily report failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "date" in data, "Missing 'date' in response"
        assert "summary" in data, "Missing 'summary' in response"
        assert "hourly_sales" in data, "Missing 'hourly_sales' in response"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_sales" in summary, "Missing 'total_sales' in summary"
        assert "total_orders" in summary, "Missing 'total_orders' in summary"
        assert "average_order" in summary, "Missing 'average_order' in summary"
        assert "total_items_sold" in summary, "Missing 'total_items_sold' in summary"
        
        # Verify hourly_sales is list of 24 hours
        assert isinstance(data["hourly_sales"], list), "hourly_sales should be a list"
        assert len(data["hourly_sales"]) == 24, "hourly_sales should have 24 entries"
    
    def test_daily_report_with_data(self, auth_token):
        """Test daily report with existing transaction data"""
        # Test with a date that has known transactions
        response = requests.get(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/daily-report",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check optional fields
        if data["summary"]["total_orders"] > 0:
            assert "top_products" in data, "Missing 'top_products' when orders exist"
            assert "peak_hours" in data, "Missing 'peak_hours' when orders exist"
            assert "payment_methods" in data, "Missing 'payment_methods'"
            assert "order_types" in data, "Missing 'order_types'"
    
    def test_daily_report_invalid_date(self, auth_token):
        """Test daily report with invalid date format"""
        response = requests.get(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/daily-report?date=invalid-date",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400
    
    def test_daily_report_unauthorized(self):
        """Test daily report without auth"""
        response = requests.get(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/daily-report"
        )
        assert response.status_code == 401


class TestMarketplaceIntegration:
    """Marketplace Integration API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_linked_listings(self, auth_token):
        """Test GET /api/marketplace-link/{page_id}/listings"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace-link/{TEST_PAGE_ID}/listings",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get linked listings failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "listings" in data, "Missing 'listings' in response"
        assert "total" in data, "Missing 'total' in response"
        assert isinstance(data["listings"], list), "listings should be a list"
    
    def test_get_available_listings(self, auth_token):
        """Test GET /api/marketplace-link/available"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace-link/available",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get available listings failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "listings" in data, "Missing 'listings' in response"
        assert isinstance(data["listings"], list), "listings should be a list"
    
    def test_linked_listings_unauthorized(self):
        """Test GET linked listings without auth"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace-link/{TEST_PAGE_ID}/listings"
        )
        assert response.status_code == 401
    
    def test_available_listings_unauthorized(self):
        """Test GET available listings without auth"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace-link/available"
        )
        assert response.status_code == 401


class TestCustomerOptions:
    """Customer Options API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_customer_options_with_auth(self, auth_token):
        """Test GET /api/customer-options/{page_id}/options with authentication (owner view)"""
        response = requests.get(
            f"{BASE_URL}/api/customer-options/{TEST_PAGE_ID}/options",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get customer options failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "page_id" in data, "Missing 'page_id' in response"
        assert "page_name" in data, "Missing 'page_name' in response"
        assert "order_types" in data, "Missing 'order_types' in response"
        assert "locations" in data, "Missing 'locations' in response"
        assert "delivery_settings" in data, "Missing 'delivery_settings' in response"
        assert "pickup_settings" in data, "Missing 'pickup_settings' in response"
        assert "shipping_settings" in data, "Missing 'shipping_settings' in response"
        
        # Verify order_types is a list
        assert isinstance(data["order_types"], list), "order_types should be a list"
        
        # Verify locations is a list
        assert isinstance(data["locations"], list), "locations should be a list"
    
    def test_customer_options_order_types(self, auth_token):
        """Test that order_types contains expected options"""
        response = requests.get(
            f"{BASE_URL}/api/customer-options/{TEST_PAGE_ID}/options",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        # Valid order types
        valid_order_types = ["dine_in", "drive_thru", "pickup", "delivery", "shipping"]
        
        for order_type in data.get("order_types", []):
            assert order_type in valid_order_types, f"Invalid order type: {order_type}"
    
    def test_customer_options_locations(self, auth_token):
        """Test locations in customer options"""
        response = requests.get(
            f"{BASE_URL}/api/customer-options/{TEST_PAGE_ID}/options",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        locations = data.get("locations", [])
        if len(locations) > 0:
            location = locations[0]
            # Check location structure
            assert "location_id" in location or "address" in location
    
    def test_add_location(self, auth_token):
        """Test POST /api/customer-options/{page_id}/locations"""
        test_location = {
            "location_id": "",
            "name": "TEST_Location",
            "address": "123 Test Street",
            "city": "Test City",
            "state": "CA",
            "country": "USA",
            "postal_code": "12345",
            "phone": "555-555-5555",
            "email": "test@example.com",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "is_primary": False,
            "operating_hours": {}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/customer-options/{TEST_PAGE_ID}/locations",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json=test_location
        )
        
        # Accept both 200 and 201 as success
        assert response.status_code in [200, 201], f"Add location failed: {response.text}"
        data = response.json()
        assert "location" in data or "message" in data, "Missing response data"
    
    def test_customer_options_page_not_found(self, auth_token):
        """Test GET customer options for non-existent page"""
        response = requests.get(
            f"{BASE_URL}/api/customer-options/nonexistent_page/options",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404


class TestMapData:
    """Map Data API tests"""
    
    def test_get_map_data_public(self):
        """Test GET /api/customer-options/{page_id}/map-data (public endpoint)"""
        response = requests.get(
            f"{BASE_URL}/api/customer-options/{TEST_PAGE_ID}/map-data"
        )
        # This is a public endpoint, should return 200 even without auth
        # May return 404 if page doesn't exist or no locations
        assert response.status_code in [200, 404], f"Map data request failed: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "markers" in data, "Missing 'markers' in map data"
            assert isinstance(data["markers"], list), "markers should be a list"


class TestPOSTransactions:
    """POS Transactions API tests (for daily report data)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_pos_transactions(self, auth_token):
        """Test GET /api/pos/{page_id}/transactions"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/pos/{TEST_PAGE_ID}/transactions?date={today}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get transactions failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "transactions" in data, "Missing 'transactions' in response"
        assert "summary" in data, "Missing 'summary' in response"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_sales" in summary, "Missing 'total_sales' in summary"
        assert "total_transactions" in summary, "Missing 'total_transactions' in summary"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
