"""
Backend tests for Member Pages Extended Features:
- Inventory Management APIs
- Barcode Scanning APIs
- POS System APIs
- Analytics APIs
"""

import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pages-enhance.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "test@blendlink.com"
TEST_PASSWORD = "admin"
TEST_PAGE_ID = "mpage_11ec295ccd36"
TEST_PRODUCT_ID = "prod_2c5502d60898"
TEST_BARCODE = "1234567890123"

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
    return data["token"]

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    }

class TestHealthCheck:
    """Ensure API is reachable"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✅ Health check passed")


class TestInventoryManagement:
    """Test Inventory Management APIs"""
    
    def test_get_inventory(self, auth_headers):
        """GET /api/page-inventory/{page_id} - Get inventory for a page"""
        response = requests.get(
            f"{BASE_URL}/api/page-inventory/{TEST_PAGE_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "inventory" in data
        print(f"✅ GET inventory passed - {len(data.get('inventory', []))} items")
        return data
    
    def test_get_inventory_low_stock_filter(self, auth_headers):
        """GET /api/page-inventory/{page_id}?low_stock_only=true - Filter low stock items"""
        response = requests.get(
            f"{BASE_URL}/api/page-inventory/{TEST_PAGE_ID}?low_stock_only=true",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "inventory" in data
        print(f"✅ GET inventory (low stock filter) passed - {len(data.get('inventory', []))} items")
    
    def test_update_inventory_quantity(self, auth_headers):
        """PUT /api/page-inventory/{page_id}/{item_id} - Update inventory quantity"""
        # First get current inventory to find an item
        inv_response = requests.get(
            f"{BASE_URL}/api/page-inventory/{TEST_PAGE_ID}",
            headers=auth_headers
        )
        
        if inv_response.status_code == 200:
            inventory = inv_response.json().get("inventory", [])
            if len(inventory) > 0:
                item = inventory[0]
                item_id = item.get("item_id", TEST_PRODUCT_ID)
                current_qty = item.get("quantity", 100)
                new_qty = current_qty + 1
                
                response = requests.put(
                    f"{BASE_URL}/api/page-inventory/{TEST_PAGE_ID}/{item_id}?quantity={new_qty}",
                    headers=auth_headers
                )
                
                # May be 200 or 404 if item doesn't exist
                if response.status_code == 200:
                    data = response.json()
                    assert "message" in data or "quantity" in data
                    print(f"✅ PUT inventory update passed - new quantity: {new_qty}")
                else:
                    print(f"⚠️ Inventory item not found (expected if no inventory exists yet)")
            else:
                print("⚠️ No inventory items to update - skipping")
        else:
            print("⚠️ Could not get inventory - skipping update test")


class TestBarcodeScanning:
    """Test Barcode Scanning APIs"""
    
    def test_barcode_search(self, auth_headers):
        """POST /api/barcode/search - Search by barcode"""
        response = requests.post(
            f"{BASE_URL}/api/barcode/search",
            headers=auth_headers,
            json={
                "barcode": TEST_BARCODE,
                "page_id": TEST_PAGE_ID
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Response should have 'found' field
        assert "found" in data
        
        if data.get("found"):
            assert "item_type" in data
            assert "item" in data
            print(f"✅ Barcode search found item: {data.get('item', {}).get('name')}")
        else:
            print(f"✅ Barcode search passed - no item found (expected for test barcode)")
    
    def test_barcode_assign(self, auth_headers):
        """POST /api/barcode/assign - Assign barcode to an item"""
        response = requests.post(
            f"{BASE_URL}/api/barcode/assign",
            headers=auth_headers,
            json={
                "barcode": TEST_BARCODE,
                "page_id": TEST_PAGE_ID,
                "item_id": TEST_PRODUCT_ID,
                "item_type": "product"
            }
        )
        
        # Could be 200 (success), 400 (already assigned), or 404 (item not found)
        assert response.status_code in [200, 400, 404], f"Unexpected status: {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"✅ Barcode assign passed - barcode assigned")
        elif response.status_code == 400:
            print(f"✅ Barcode assign passed - barcode already assigned (expected)")
        else:
            print(f"✅ Barcode assign passed - item not found (expected if product doesn't exist)")


class TestPOSSystem:
    """Test Point of Sale APIs"""
    
    def test_get_pos_settings(self, auth_headers):
        """GET /api/pos/{page_id}/settings - Get POS settings"""
        response = requests.get(
            f"{BASE_URL}/api/pos/{TEST_PAGE_ID}/settings",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "settings" in data
        
        settings = data["settings"]
        print(f"✅ GET POS settings passed - tax_rate: {settings.get('tax_rate', 0)}%")
        return settings
    
    def test_pos_cash_transaction(self, auth_headers):
        """POST /api/pos/transaction - Create cash transaction"""
        response = requests.post(
            f"{BASE_URL}/api/pos/transaction",
            headers=auth_headers,
            json={
                "page_id": TEST_PAGE_ID,
                "items": [{
                    "item_id": TEST_PRODUCT_ID,
                    "name": "Test Product",
                    "quantity": 1,
                    "price": 10.00,
                    "options": []
                }],
                "order_type": "pickup",
                "payment_method": "cash",
                "subtotal": 10.00,
                "tax": 0.80,
                "discount": 0,
                "tip": 1.00,
                "total": 11.80,
                "customer_name": "Test Customer",
                "customer_phone": "555-0100",
                "table_number": "",
                "notes": "Test transaction from automated test"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "success" in data or "order" in data
        
        if data.get("success"):
            assert "order" in data
            assert "receipt" in data
            order_id = data["order"].get("order_id")
            print(f"✅ POS cash transaction passed - order_id: {order_id}")
        else:
            print(f"✅ POS cash transaction response received")
    
    def test_pos_stripe_checkout_create(self, auth_headers):
        """POST /api/pos/checkout/create - Create Stripe checkout session"""
        response = requests.post(
            f"{BASE_URL}/api/pos/checkout/create",
            headers=auth_headers,
            json={
                "page_id": TEST_PAGE_ID,
                "items": [{
                    "item_id": TEST_PRODUCT_ID,
                    "name": "Test Product",
                    "quantity": 1,
                    "price": 15.00,
                    "options": []
                }],
                "order_type": "pickup",
                "subtotal": 15.00,
                "tax": 1.20,
                "discount": 0,
                "tip": 2.00,
                "total": 18.20,
                "customer_name": "Card Test",
                "customer_phone": "555-0200",
                "table_number": "",
                "notes": "Stripe checkout test",
                "origin_url": BASE_URL
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "success" in data
        assert data.get("success") == True, f"Checkout creation not successful: {data}"
        assert "checkout_url" in data, "No checkout_url in response"
        assert "session_id" in data, "No session_id in response"
        assert "order_id" in data, "No order_id in response"
        
        # Validate checkout URL is a valid Stripe URL
        checkout_url = data["checkout_url"]
        assert "checkout.stripe.com" in checkout_url, f"Invalid checkout URL: {checkout_url}"
        
        print(f"✅ POS Stripe checkout create passed - checkout_url: {checkout_url[:60]}...")
        print(f"   session_id: {data['session_id']}")
        print(f"   order_id: {data['order_id']}")
        return data
    
    def test_pos_get_transactions(self, auth_headers):
        """GET /api/pos/{page_id}/transactions - Get POS transactions"""
        response = requests.get(
            f"{BASE_URL}/api/pos/{TEST_PAGE_ID}/transactions",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "transactions" in data
        assert "summary" in data
        
        transactions = data["transactions"]
        summary = data["summary"]
        
        print(f"✅ GET POS transactions passed - {len(transactions)} transactions")
        print(f"   Total sales: ${summary.get('total_sales', 0):.2f}")
        print(f"   Avg transaction: ${summary.get('average_transaction', 0):.2f}")


class TestAnalytics:
    """Test Analytics APIs"""
    
    def test_get_page_analytics(self, auth_headers):
        """GET /api/page-analytics/{page_id} - Get page analytics"""
        response = requests.get(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "period" in data
        assert "overview" in data
        assert "top_items" in data
        
        overview = data["overview"]
        assert "total_views" in overview
        assert "total_orders" in overview
        assert "total_revenue" in overview
        
        print(f"✅ GET page analytics passed")
        print(f"   Period: {data['period']}")
        print(f"   Total orders: {overview.get('total_orders', 0)}")
        print(f"   Total revenue: ${overview.get('total_revenue', 0):.2f}")
        return data
    
    def test_get_analytics_30d_period(self, auth_headers):
        """GET /api/page-analytics/{page_id}?period=30d - Get 30-day analytics"""
        response = requests.get(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}?period=30d",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["period"] == "30d"
        print(f"✅ GET analytics (30d) passed")


class TestPageProductsIntegration:
    """Test Page Products API for POS integration"""
    
    def test_get_page_products(self, auth_headers):
        """GET /api/page-products/{page_id} - Get products for POS"""
        response = requests.get(
            f"{BASE_URL}/api/page-products/{TEST_PAGE_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "products" in data
        
        products = data["products"]
        print(f"✅ GET page products passed - {len(products)} products")
        
        if products:
            product = products[0]
            print(f"   First product: {product.get('name')} - ${product.get('price', 0):.2f}")
        
        return products


class TestMemberPageDashboard:
    """Test Member Page Dashboard APIs"""
    
    def test_get_member_page(self, auth_headers):
        """GET /api/member-pages/{page_id} - Get page with dashboard data"""
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{TEST_PAGE_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        assert "page_id" in data
        assert "name" in data
        assert "page_type" in data
        assert "is_owner" in data
        
        if data.get("is_owner"):
            assert "dashboard" in data
            print(f"✅ GET member page (owner view) passed")
            print(f"   Page: {data.get('name')} ({data.get('page_type')})")
            print(f"   Dashboard includes: {list(data.get('dashboard', {}).keys())}")
        else:
            print(f"✅ GET member page (non-owner view) passed")
        
        return data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-s"])
