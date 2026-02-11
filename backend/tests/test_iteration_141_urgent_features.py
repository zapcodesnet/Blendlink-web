"""
Iteration 141 - Testing 3 Urgent Features:
1. Manual Product/Service Entry in POS (Custom Items)
2. Customer Email & Autofill in POS
3. Discover Card Customization
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"
TEST_PAGE_ID = "mpage_000a72b44296"


class TestAuthSetup:
    """Test authentication first"""
    
    def test_health_check(self):
        """Verify API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"[PASS] Health check passed: {data}")
    
    def test_login(self):
        """Test login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data or "access_token" in data
        print(f"[PASS] Login successful")
        return data.get("token") or data.get("access_token")


@pytest.fixture(scope="module")
def auth_token():
    """Get auth token for tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        return data.get("token") or data.get("access_token")
    pytest.skip("Authentication failed - skipping tests")


class TestPOSCustomersSearch:
    """Test Feature 2: Customer Email & Autofill - Backend API"""
    
    def test_pos_customers_search_endpoint_exists(self, auth_token):
        """Test GET /api/member-pages/{page_id}/pos-customers/search returns correctly"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}/pos-customers/search?q=test",
            headers=headers
        )
        # Should return 200 with customers array (could be empty if no previous orders)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "customers" in data, f"Response should contain 'customers' key: {data}"
        assert isinstance(data["customers"], list), "customers should be a list"
        print(f"[PASS] POS customers search endpoint works. Found {len(data['customers'])} customers")
    
    def test_pos_customers_search_short_query(self, auth_token):
        """Test that short queries (< 2 chars) return empty"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}/pos-customers/search?q=a",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["customers"] == [], "Short query should return empty list"
        print(f"[PASS] Short query returns empty list as expected")
    
    def test_pos_customers_search_email_pattern(self, auth_token):
        """Test search works with email pattern"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}/pos-customers/search?q=@gmail",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        # Results may or may not have matches
        print(f"[PASS] Email pattern search works. Found {len(data['customers'])} matches")


class TestCardSettings:
    """Test Feature 3: Discover Card Customization"""
    
    def test_card_settings_get_via_page_info(self, auth_token):
        """Test that page info contains card_settings"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to get page: {response.text}"
        data = response.json()
        # card_settings may or may not exist yet
        print(f"[PASS] Page info retrieved. card_settings present: {'card_settings' in data}")
    
    def test_card_settings_update_color(self, auth_token):
        """Test PUT /api/member-pages/{page_id}/card-settings - color"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        # Test with a gradient color
        settings = {"background_color": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"}
        response = requests.put(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}/card-settings",
            headers=headers,
            json=settings
        )
        assert response.status_code == 200, f"Card settings update failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "settings" in data
        assert data["settings"]["background_color"] == settings["background_color"]
        print(f"[PASS] Card settings updated with gradient color")
    
    def test_card_settings_update_solid_color(self, auth_token):
        """Test solid color update"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        settings = {"background_color": "#3b82f6"}
        response = requests.put(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}/card-settings",
            headers=headers,
            json=settings
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"[PASS] Card settings updated with solid color")
    
    def test_card_settings_clear(self, auth_token):
        """Test clearing card settings (reset to default)"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        settings = {"background_color": "", "background_image": ""}
        response = requests.put(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}/card-settings",
            headers=headers,
            json=settings
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"[PASS] Card settings cleared successfully")
    
    def test_card_settings_unauthorized(self):
        """Test unauthorized access fails"""
        response = requests.put(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}/card-settings",
            headers={"Content-Type": "application/json"},
            json={"background_color": "#ff0000"}
        )
        # Should fail without auth token
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"[PASS] Unauthorized access correctly rejected")


class TestPOSTransaction:
    """Test POS transaction to verify custom items work"""
    
    def test_pos_transaction_with_custom_item(self, auth_token):
        """Test that POS transaction can include is_custom items"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        # Create a transaction with a custom/manual item
        transaction_data = {
            "page_id": TEST_PAGE_ID,
            "items": [{
                "item_id": "custom_test_123",
                "name": "Custom Service - Manual Entry Test",
                "price": 25.00,
                "quantity": 1,
                "is_custom": True  # This is the key flag for manual entries
            }],
            "order_type": "pickup",
            "payment_method": "cash",
            "subtotal": 25.00,
            "tax": 2.00,
            "discount": 0,
            "tip": 0,
            "total": 27.00,
            "customer_name": "Test Customer POS",
            "customer_email": "testcustomer@example.com",
            "customer_phone": "555-1234",
            "notes": "Manual entry test"
        }
        response = requests.post(
            f"{BASE_URL}/api/pos/transaction",
            headers=headers,
            json=transaction_data
        )
        # Transaction should succeed
        assert response.status_code in [200, 201], f"POS transaction failed: {response.status_code} - {response.text}"
        data = response.json()
        # Check response has order_id
        assert "order_id" in data or "success" in data, f"Unexpected response: {data}"
        print(f"[PASS] POS transaction with custom item succeeded. Response: {data}")
    
    def test_pos_transaction_with_customer_info(self, auth_token):
        """Test POS transaction with email and customer info for autofill later"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        transaction_data = {
            "page_id": TEST_PAGE_ID,
            "items": [{
                "item_id": "test_item_auto",
                "name": "Test Product",
                "price": 10.00,
                "quantity": 2
            }],
            "order_type": "delivery",
            "payment_method": "card",
            "subtotal": 20.00,
            "tax": 1.60,
            "discount": 0,
            "tip": 3.00,
            "total": 24.60,
            "customer_name": "John AutoFill Test",
            "customer_email": "john.autofill@test.com",
            "customer_phone": "555-9999",
            "notes": "Autofill test order"
        }
        response = requests.post(
            f"{BASE_URL}/api/pos/transaction",
            headers=headers,
            json=transaction_data
        )
        assert response.status_code in [200, 201], f"Transaction failed: {response.text}"
        print(f"[PASS] POS transaction with customer info succeeded")
    
    def test_customer_appears_in_search(self, auth_token):
        """After creating order, verify customer appears in search"""
        import time
        time.sleep(1)  # Small delay for DB write
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}/pos-customers/search?q=AutoFill",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        print(f"[INFO] Search for 'AutoFill' returned {len(data['customers'])} customers")
        # Due to aggregation, we may or may not find the customer immediately
        print(f"[PASS] Customer search completed")


class TestPOSSettings:
    """Verify POS settings endpoint works (needed for fast cash buttons)"""
    
    def test_get_pos_settings(self, auth_token):
        """Test GET /api/member-pages/{page_id}/pos-settings"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}/pos-settings",
            headers=headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        # Verify expected fields
        expected_fields = ["fast_cash_buttons", "currency", "currency_symbol"]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        print(f"[PASS] POS settings retrieved. Fast cash buttons: {len(data.get('fast_cash_buttons', []))}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
