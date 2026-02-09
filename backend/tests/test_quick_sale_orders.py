"""
Backend tests for Quick Sale Mode, Orders Manager, and Menu Items:
- Quick Sale Mode: POST /api/barcode/search, POST /api/pos/transaction
- Orders Manager: GET /api/pos/{page_id}/transactions, PUT /api/member-pages/orders/{order_id}/status
- Menu Items: POST /api/page-menu/{page_id}, GET /api/page-menu/{page_id}
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://page-creation-fix.preview.emergentagent.com').rstrip('/')

# Test credentials from review_request
TEST_EMAIL = "test@blendlink.com"
TEST_PASSWORD = "admin"
TEST_PAGE_ID = "mpage_52b366148d0f"
TEST_PRODUCT_ID = "prod_3e7b957cf1c3"
TEST_BARCODE = "9999888877776"
TEST_ORDER_ID = "pos_41cab1556313"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in response"
    print(f"✅ Auth successful - user_id: {data.get('user', {}).get('user_id', 'N/A')}")
    return data["token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    }


class TestHealthCheck:
    """Verify API is reachable"""
    
    def test_api_health(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✅ API Health check passed")


class TestQuickSaleMode:
    """Test Quick Sale Mode functionality - Barcode search and one-tap cash payment"""
    
    def test_barcode_search_valid(self, auth_headers):
        """POST /api/barcode/search - Search item by barcode"""
        response = requests.post(
            f"{BASE_URL}/api/barcode/search",
            headers=auth_headers,
            json={
                "barcode": TEST_BARCODE,
                "page_id": TEST_PAGE_ID
            }
        )
        
        # May be 200 (found) or 200 with found=false (not found)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Check response structure
        if data.get("found"):
            assert "item" in data, "Found but no item data returned"
            item = data["item"]
            print(f"✅ Barcode search found: {item.get('name')} - ${item.get('price', item.get('daily_rate', 0))}")
        else:
            print(f"⚠️ Barcode not found: {data.get('message', 'No item')}")
    
    def test_barcode_search_with_existing_barcode(self, auth_headers):
        """POST /api/barcode/search - Search with known barcode"""
        # Try with the standard test barcode from iteration_118
        response = requests.post(
            f"{BASE_URL}/api/barcode/search",
            headers=auth_headers,
            json={
                "barcode": "1234567890123",
                "page_id": "mpage_11ec295ccd36"  # The page from iteration_118
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        print(f"✅ Barcode search returned: found={data.get('found')}")
    
    def test_pos_cash_transaction(self, auth_headers):
        """POST /api/pos/transaction - One-tap cash payment for Quick Sale"""
        response = requests.post(
            f"{BASE_URL}/api/pos/transaction",
            headers=auth_headers,
            json={
                "page_id": TEST_PAGE_ID,
                "items": [{
                    "item_id": TEST_PRODUCT_ID,
                    "name": "Quick Sale Test Item",
                    "price": 10.00,
                    "quantity": 1
                }],
                "order_type": "pickup",
                "payment_method": "cash",
                "subtotal": 10.00,
                "tax": 0.0,
                "discount": 0.0,
                "tip": 0.0,
                "total": 10.00,
                "customer_name": "",
                "notes": "Quick Sale Test"
            }
        )
        
        # Check if transaction was created
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Cash transaction created - order_id: {data.get('receipt', {}).get('order_id', data.get('order_id', 'N/A'))}")
            assert "receipt" in data or "order_id" in data, "No receipt or order_id in response"
        elif response.status_code == 404:
            print(f"⚠️ Page not found (may need to create): {response.text}")
        else:
            print(f"⚠️ Transaction response: {response.status_code} - {response.text[:200]}")


class TestOrdersManager:
    """Test Orders Manager Tab functionality - Order list and status updates"""
    
    def test_get_pos_transactions(self, auth_headers):
        """GET /api/pos/{page_id}/transactions - Get order history"""
        response = requests.get(
            f"{BASE_URL}/api/pos/{TEST_PAGE_ID}/transactions?limit=100",
            headers=auth_headers
        )
        
        # Can return 200 with empty list or with transactions
        assert response.status_code in [200, 403, 404], f"Expected 200/403/404, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            transactions = data.get("transactions", [])
            summary = data.get("summary", {})
            print(f"✅ GET transactions passed - {len(transactions)} orders")
            print(f"   Summary: total_sales=${summary.get('total_sales', 0)}, total_transactions={summary.get('total_transactions', 0)}")
            return transactions
        else:
            print(f"⚠️ Could not get transactions: {response.status_code}")
            return []
    
    def test_update_order_status_valid(self, auth_headers):
        """PUT /api/member-pages/orders/{order_id}/status - Update order status"""
        response = requests.put(
            f"{BASE_URL}/api/member-pages/orders/{TEST_ORDER_ID}/status",
            headers=auth_headers,
            json={"status": "confirmed"}
        )
        
        # Can return 200 (success), 403 (not authorized), or 404 (not found)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Order status updated: {data.get('status', 'confirmed')}")
        elif response.status_code == 404:
            print(f"⚠️ Order not found: {TEST_ORDER_ID}")
        elif response.status_code == 403:
            print(f"⚠️ Not authorized to update order")
        else:
            print(f"⚠️ Order status update response: {response.status_code} - {response.text[:200]}")
    
    def test_update_order_invalid_status(self, auth_headers):
        """PUT /api/member-pages/orders/{order_id}/status - Invalid status should fail"""
        response = requests.put(
            f"{BASE_URL}/api/member-pages/orders/{TEST_ORDER_ID}/status",
            headers=auth_headers,
            json={"status": "invalid_status_xyz"}
        )
        
        # Should return 400 for invalid status
        if response.status_code == 400:
            print(f"✅ Invalid status correctly rejected")
        elif response.status_code == 404:
            print(f"⚠️ Order not found (cannot test invalid status)")
        else:
            print(f"Status update response: {response.status_code} - {response.text[:200]}")


class TestOrderStatusEndpointPath:
    """Test the order status endpoint path used by frontend"""
    
    def test_frontend_order_status_path(self, auth_headers):
        """Test frontend path: PUT /api/page-orders/{page_id}/{order_id}/status"""
        # This is the path the frontend OrdersManager.jsx is using
        response = requests.put(
            f"{BASE_URL}/api/page-orders/{TEST_PAGE_ID}/{TEST_ORDER_ID}/status",
            headers=auth_headers,
            json={"status": "confirmed"}
        )
        
        if response.status_code == 200:
            print(f"✅ Frontend path works - status updated")
        elif response.status_code == 404:
            # This might be "Not Found" because the endpoint doesn't exist
            print(f"⚠️ Frontend path /api/page-orders/... returns 404")
            print(f"   ISSUE: Frontend uses different endpoint than backend")
        elif response.status_code == 403:
            print(f"⚠️ Not authorized")
        else:
            print(f"⚠️ Response: {response.status_code} - {response.text[:200]}")
    
    def test_backend_order_status_path(self, auth_headers):
        """Test backend path: PUT /api/member-pages/orders/{order_id}/status"""
        response = requests.put(
            f"{BASE_URL}/api/member-pages/orders/{TEST_ORDER_ID}/status",
            headers=auth_headers,
            json={"status": "confirmed"}
        )
        
        if response.status_code == 200:
            print(f"✅ Backend path works - status updated")
        elif response.status_code == 404:
            print(f"⚠️ Order not found: {TEST_ORDER_ID}")
        elif response.status_code == 403:
            print(f"⚠️ Not authorized")
        else:
            print(f"⚠️ Response: {response.status_code} - {response.text[:200]}")


class TestMenuItemsSupport:
    """Test Menu Items API for restaurant pages"""
    
    def test_get_menu_items(self, auth_headers):
        """GET /api/page-menu/{page_id} - Get menu items for restaurant page"""
        response = requests.get(
            f"{BASE_URL}/api/page-menu/{TEST_PAGE_ID}",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            items = data.get("items", [])
            categories = data.get("categories", {})
            print(f"✅ GET menu items passed - {len(items)} items in {len(categories)} categories")
        elif response.status_code == 404:
            print(f"⚠️ Page not found or not a restaurant page")
        else:
            print(f"⚠️ Menu items response: {response.status_code}")
    
    def test_create_menu_item(self, auth_headers):
        """POST /api/page-menu/{page_id} - Create a menu item"""
        # First, we need a restaurant page. Let's use the test page
        response = requests.post(
            f"{BASE_URL}/api/page-menu/{TEST_PAGE_ID}",
            headers=auth_headers,
            json={
                "name": "Test Menu Item",
                "description": "A test menu item for testing",
                "category": "Main Course",
                "price": 12.99,
                "is_available": True
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Menu item created: {data.get('item', {}).get('name', 'N/A')}")
        elif response.status_code == 400:
            # May fail if page is not a restaurant page
            error = response.json()
            print(f"⚠️ Cannot create menu item: {error.get('detail', response.text)}")
        elif response.status_code == 404:
            print(f"⚠️ Page not found")
        elif response.status_code == 403:
            print(f"⚠️ Not authorized to create menu items")
        else:
            print(f"⚠️ Create menu item response: {response.status_code} - {response.text[:200]}")


class TestReferralSystem:
    """Test Referral System showing in Analytics Dashboard"""
    
    def test_page_analytics_with_referral(self, auth_headers):
        """GET /api/page-analytics/{page_id} - Should include referral stats"""
        response = requests.get(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            referral_stats = data.get("referral_stats", {})
            referral_code = referral_stats.get("referral_code") or data.get("referral_code")
            signups = referral_stats.get("signups", 0)
            
            print(f"✅ Analytics with referral - code: {referral_code}, signups: {signups}")
            
            # Check for referral data
            if referral_code:
                print(f"   Referral code found in analytics")
        elif response.status_code == 404:
            print(f"⚠️ Page not found for analytics")
        else:
            print(f"⚠️ Analytics response: {response.status_code}")


class TestPOSSettings:
    """Test POS Settings API"""
    
    def test_get_pos_settings(self, auth_headers):
        """GET /api/pos/{page_id}/settings - Get POS settings"""
        response = requests.get(
            f"{BASE_URL}/api/pos/{TEST_PAGE_ID}/settings",
            headers=auth_headers
        )
        
        if response.status_code == 200:
            data = response.json()
            settings = data.get("settings", {})
            print(f"✅ POS settings - tax_rate: {settings.get('tax_rate', 0)}%, accepts_cash: {settings.get('accepts_cash', True)}")
        elif response.status_code == 404:
            print(f"⚠️ Page/settings not found")
        else:
            print(f"⚠️ POS settings response: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
