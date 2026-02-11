"""
Blendlink Marketplace Enhancement Tests - Iteration 45
Testing: Cart, Checkout, Shipping, Social Notifications, Seller Dashboard Orders
"""

import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pages-enhance.preview.emergentagent.com')

class TestMarketplaceCategories:
    """Test marketplace categories including Digital Goods & NFTs"""
    
    def test_categories_endpoint(self):
        """Test /api/marketplace/categories returns all categories"""
        response = requests.get(f"{BASE_URL}/api/marketplace/categories")
        assert response.status_code == 200
        categories = response.json()
        assert isinstance(categories, list)
        assert len(categories) >= 17, f"Expected at least 17 categories, got {len(categories)}"
        print(f"✓ Found {len(categories)} categories")
    
    def test_digital_goods_category_exists(self):
        """Test 'Digital Goods & NFTs' category exists"""
        response = requests.get(f"{BASE_URL}/api/marketplace/categories")
        assert response.status_code == 200
        categories = response.json()
        
        digital_cat = next((c for c in categories if c.get('id') == 'digital'), None)
        assert digital_cat is not None, "Digital category not found"
        assert digital_cat.get('name') == 'Digital Goods & NFTs'
        print(f"✓ Digital Goods & NFTs category found: {digital_cat}")


class TestShippoShippingEstimate:
    """Test Shippo shipping estimate API"""
    
    def test_shipping_estimate_endpoint(self):
        """Test /api/shippo/estimate returns shipping rates"""
        payload = {
            "origin_zip": "10001",
            "destination_zip": "90210",
            "weight": 2.0,
            "length": 10,
            "width": 8,
            "height": 4,
            "is_digital": False
        }
        response = requests.post(f"{BASE_URL}/api/shippo/estimate", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Should have rates or is_estimate flag
        assert 'rates' in data or 'is_estimate' in data
        print(f"✓ Shipping estimate response: {json.dumps(data, indent=2)[:500]}")
    
    def test_digital_goods_no_shipping(self):
        """Test digital goods return no shipping required"""
        payload = {
            "origin_zip": "10001",
            "destination_zip": "90210",
            "is_digital": True
        }
        response = requests.post(f"{BASE_URL}/api/shippo/estimate", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('is_digital') == True
        assert 'no shipping' in data.get('message', '').lower() or data.get('rates') == []
        print(f"✓ Digital goods correctly skip shipping: {data.get('message')}")
    
    def test_missing_weight_requires_seller_info(self):
        """Test missing weight returns requires_seller_info"""
        payload = {
            "origin_zip": "10001",
            "destination_zip": "90210",
            "is_digital": False
        }
        response = requests.post(f"{BASE_URL}/api/shippo/estimate", json=payload)
        assert response.status_code == 200
        data = response.json()
        
        # Should indicate seller info needed
        assert data.get('requires_seller_info') == True or 'rates' in data
        print(f"✓ Missing weight handled: {data}")


class TestCartEndpoints:
    """Test cart API endpoints"""
    
    def test_cart_get_guest(self):
        """Test GET /api/cart returns guest cart info"""
        response = requests.get(f"{BASE_URL}/api/cart")
        assert response.status_code == 200
        data = response.json()
        
        # Guest should get empty cart or guest flag
        assert 'items' in data or 'guest' in data
        print(f"✓ Guest cart response: {data}")
    
    def test_cart_add_guest(self):
        """Test POST /api/cart/add for guest"""
        # First get a listing
        listings_resp = requests.get(f"{BASE_URL}/api/marketplace/listings?limit=1")
        if listings_resp.status_code == 200 and listings_resp.json():
            listing = listings_resp.json()[0]
            listing_id = listing.get('listing_id')
            
            payload = {"listing_id": listing_id, "quantity": 1}
            response = requests.post(f"{BASE_URL}/api/cart/add", json=payload)
            assert response.status_code == 200
            data = response.json()
            
            assert data.get('success') == True
            print(f"✓ Add to cart response: {data}")
        else:
            pytest.skip("No listings available for cart test")


class TestSocialEngagementNotifications:
    """Test social engagement endpoints (like, share, comment)"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth token for test user"""
        login_data = {"email": "test@example.com", "password": "Test123!"}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            token = response.json().get('token')
            return {"Authorization": f"Bearer {token}"}
        return {}
    
    @pytest.fixture
    def listing_id(self):
        """Get a listing ID for testing"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings?limit=1")
        if response.status_code == 200 and response.json():
            return response.json()[0].get('listing_id')
        return None
    
    def test_like_requires_auth(self, listing_id):
        """Test like endpoint requires authentication"""
        if not listing_id:
            pytest.skip("No listing available")
        
        response = requests.post(f"{BASE_URL}/api/marketplace/listings/{listing_id}/like")
        assert response.status_code == 401
        print(f"✓ Like endpoint correctly requires auth (401)")
    
    def test_like_with_auth(self, auth_headers, listing_id):
        """Test like endpoint with authentication"""
        if not listing_id or not auth_headers:
            pytest.skip("No listing or auth available")
        
        response = requests.post(
            f"{BASE_URL}/api/marketplace/listings/{listing_id}/like",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert 'liked' in data
        assert 'likes_count' in data
        print(f"✓ Like response: {data}")
    
    def test_share_tracking(self, listing_id):
        """Test share endpoint tracks shares"""
        if not listing_id:
            pytest.skip("No listing available")
        
        response = requests.post(f"{BASE_URL}/api/marketplace/listings/{listing_id}/share")
        assert response.status_code == 200
        data = response.json()
        
        assert data.get('shared') == True
        assert 'shares_count' in data
        print(f"✓ Share tracking response: {data}")
    
    def test_comment_requires_auth(self, listing_id):
        """Test comment endpoint requires authentication"""
        if not listing_id:
            pytest.skip("No listing available")
        
        payload = {"content": "Test comment"}
        response = requests.post(
            f"{BASE_URL}/api/marketplace/listings/{listing_id}/comments",
            json=payload
        )
        assert response.status_code == 401
        print(f"✓ Comment endpoint correctly requires auth (401)")
    
    def test_comment_with_auth(self, auth_headers, listing_id):
        """Test comment endpoint with authentication"""
        if not listing_id or not auth_headers:
            pytest.skip("No listing or auth available")
        
        payload = {"content": f"Test comment at {datetime.now().isoformat()}"}
        response = requests.post(
            f"{BASE_URL}/api/marketplace/listings/{listing_id}/comments",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert 'comment_id' in data
        assert data.get('content') == payload['content']
        print(f"✓ Comment created: {data.get('comment_id')}")
    
    def test_get_listing_comments(self, listing_id):
        """Test getting comments for a listing"""
        if not listing_id:
            pytest.skip("No listing available")
        
        response = requests.get(f"{BASE_URL}/api/marketplace/listings/{listing_id}/comments")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} comments for listing")


class TestCheckoutFlow:
    """Test checkout endpoints"""
    
    def test_checkout_endpoint_exists(self):
        """Test /api/orders/checkout endpoint exists"""
        # Minimal payload to test endpoint
        payload = {
            "items": [],
            "customer": {"name": "Test", "email": "test@test.com"},
            "shipping_address": {},
            "total_items": 0,
            "shipping_cost": 0,
            "total": 0
        }
        response = requests.post(f"{BASE_URL}/api/orders/checkout", json=payload)
        # Should return 400 for empty items or 200 for success
        assert response.status_code in [200, 400]
        print(f"✓ Checkout endpoint responds: {response.status_code}")
    
    def test_checkout_requires_customer_info(self):
        """Test checkout requires customer name and email"""
        payload = {
            "items": [{"listing_id": "test", "price": 10}],
            "customer": {},  # Missing name and email
            "shipping_address": {},
            "total_items": 10,
            "shipping_cost": 0,
            "total": 10
        }
        response = requests.post(f"{BASE_URL}/api/orders/checkout", json=payload)
        assert response.status_code == 400
        assert 'name' in response.text.lower() or 'email' in response.text.lower()
        print(f"✓ Checkout correctly requires customer info")


class TestSellerOrdersEndpoint:
    """Test seller orders endpoint"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth token for test user"""
        login_data = {"email": "test@example.com", "password": "Test123!"}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            token = response.json().get('token')
            return {"Authorization": f"Bearer {token}"}
        return {}
    
    def test_seller_orders_requires_auth(self):
        """Test /api/orders/seller/list requires authentication"""
        response = requests.get(f"{BASE_URL}/api/orders/seller/list")
        assert response.status_code == 401
        print(f"✓ Seller orders endpoint requires auth (401)")
    
    def test_seller_orders_with_auth(self, auth_headers):
        """Test /api/orders/seller/list with authentication"""
        if not auth_headers:
            pytest.skip("Auth not available")
        
        response = requests.get(
            f"{BASE_URL}/api/orders/seller/list",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Seller orders response: {len(data)} orders")


class TestShippingLabelEndpoint:
    """Test shipping label creation endpoint"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth token for test user"""
        login_data = {"email": "test@example.com", "password": "Test123!"}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if response.status_code == 200:
            token = response.json().get('token')
            return {"Authorization": f"Bearer {token}"}
        return {}
    
    def test_create_label_requires_auth(self):
        """Test /api/shippo/create-label requires authentication"""
        payload = {
            "from_address": {"name": "Test", "street1": "123 Test St", "city": "NYC", "state": "NY", "zip": "10001"},
            "to_address": {"name": "Buyer", "street1": "456 Main St", "city": "LA", "state": "CA", "zip": "90001"},
            "parcel": {"length": 6, "width": 4, "height": 2, "weight": 1},
            "order_id": "test_order_123"
        }
        response = requests.post(f"{BASE_URL}/api/shippo/create-label", json=payload)
        assert response.status_code == 401
        print(f"✓ Create label endpoint requires auth (401)")
    
    def test_carriers_endpoint(self):
        """Test /api/shippo/carriers returns available carriers"""
        response = requests.get(f"{BASE_URL}/api/shippo/carriers")
        assert response.status_code == 200
        data = response.json()
        
        assert 'carriers' in data
        carriers = data['carriers']
        assert len(carriers) >= 3  # USPS, UPS, FedEx
        
        carrier_ids = [c['id'] for c in carriers]
        assert 'usps' in carrier_ids
        assert 'ups' in carrier_ids
        assert 'fedex' in carrier_ids
        print(f"✓ Available carriers: {carrier_ids}")


class TestListingDetailEndpoint:
    """Test listing detail endpoint"""
    
    def test_get_listing_detail(self):
        """Test /api/marketplace/listings/{id} returns listing with seller info"""
        # First get a listing ID
        response = requests.get(f"{BASE_URL}/api/marketplace/listings?limit=1")
        if response.status_code == 200 and response.json():
            listing_id = response.json()[0].get('listing_id')
            
            detail_response = requests.get(f"{BASE_URL}/api/marketplace/listings/{listing_id}")
            assert detail_response.status_code == 200
            data = detail_response.json()
            
            assert 'listing_id' in data
            assert 'title' in data
            assert 'price' in data
            assert 'seller' in data
            print(f"✓ Listing detail: {data.get('title')} - ${data.get('price')}")
        else:
            pytest.skip("No listings available")
    
    def test_listing_not_found(self):
        """Test 404 for non-existent listing"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings/nonexistent_listing_123")
        assert response.status_code == 404
        print(f"✓ Non-existent listing returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
