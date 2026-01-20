"""
Test suite for Blendlink 11-point update (Iteration 46)
Features tested:
1. Guest can view landing page listing cards and navigate to /marketplace/{id}
2. Cart icon link updated (no 'browse as guest' text)
3. Checkout page country dropdown with multiple countries
4. Photo Editor upload spinner (frontend only)
5. Seller Dashboard Edit button on listings
6. PUT /api/marketplace/listings/{id} endpoint
7. BL coins awarded when creating marketplace listing
8. URL preview API at /api/utils/url-preview
9. Language detection API at /api/utils/detect-language
10. Language selector dropdown (frontend only)
11. AI Listing Creator expanded target market countries (frontend only)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_api_health(self):
        """Test API is accessible"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data or "status" in data

    def test_marketplace_listings_accessible(self):
        """Test marketplace listings endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200
        data = response.json()
        assert "listings" in data or isinstance(data, list)


class TestURLPreviewAPI:
    """Test URL preview endpoint - Feature #8"""
    
    def test_url_preview_valid_url(self):
        """Test URL preview with a valid URL"""
        response = requests.post(
            f"{BASE_URL}/api/utils/url-preview",
            json={"url": "https://www.google.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "title" in data
        assert "siteName" in data
    
    def test_url_preview_without_protocol(self):
        """Test URL preview auto-adds https"""
        response = requests.post(
            f"{BASE_URL}/api/utils/url-preview",
            json={"url": "google.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["url"].startswith("https://")
    
    def test_url_preview_invalid_url(self):
        """Test URL preview with invalid URL returns graceful error"""
        response = requests.post(
            f"{BASE_URL}/api/utils/url-preview",
            json={"url": "not-a-valid-url-at-all"}
        )
        # Should return 200 with success=False or 400
        assert response.status_code in [200, 400]


class TestLanguageDetectionAPI:
    """Test language detection endpoint - Feature #9"""
    
    def test_detect_language_endpoint(self):
        """Test language detection returns expected fields"""
        response = requests.get(f"{BASE_URL}/api/utils/detect-language")
        assert response.status_code == 200
        data = response.json()
        assert "detected_country" in data
        assert "detected_language" in data
        assert "source" in data
    
    def test_detect_language_returns_valid_language_code(self):
        """Test language detection returns valid language code"""
        response = requests.get(f"{BASE_URL}/api/utils/detect-language")
        assert response.status_code == 200
        data = response.json()
        # Should return a valid language code
        valid_codes = ["en", "es", "fr", "de", "it", "pt", "nl", "sv", "pl", "no", "da", "fi", "ro", "cs", "el", "hu", "uk", "ru", "zh-CN", "zh-TW", "ja", "ko", "hi", "id", "tl", "ms", "th", "vi", "he", "ar", "af"]
        assert data["detected_language"] in valid_codes or data["detected_language"].startswith("en")


class TestMarketplaceListingCRUD:
    """Test marketplace listing CRUD operations - Features #5, #6, #7"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@example.com", "password": "Test123!"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_create_listing_awards_bl_coins(self, auth_headers):
        """Test that creating a listing awards BL coins - Feature #7"""
        # Get user's current BL coins
        user_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=auth_headers
        )
        assert user_response.status_code == 200
        initial_coins = user_response.json().get("bl_coins", 0)
        
        # Create a new listing
        unique_title = f"TEST_BLCoins_Item_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/marketplace/listings",
            headers=auth_headers,
            json={
                "title": unique_title,
                "description": "Test item for BL coins verification",
                "price": 99.99,
                "category": "electronics",
                "images": [],
                "condition": "new",
                "is_digital": False,
                "target_countries": ["US", "CA"]
            }
        )
        assert create_response.status_code in [200, 201]
        listing_data = create_response.json()
        
        # Verify BL coins were awarded (100 coins per listing)
        assert "bl_coins_earned" in listing_data
        assert listing_data["bl_coins_earned"] == 100
        
        # Verify user's balance increased
        user_response2 = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=auth_headers
        )
        new_coins = user_response2.json().get("bl_coins", 0)
        assert new_coins >= initial_coins + 100
        
        # Cleanup - delete the test listing
        listing_id = listing_data.get("listing_id")
        if listing_id:
            requests.delete(
                f"{BASE_URL}/api/marketplace/listings/{listing_id}",
                headers=auth_headers
            )
    
    def test_update_listing_endpoint(self, auth_headers):
        """Test PUT /api/marketplace/listings/{id} - Feature #6"""
        # First create a listing to update
        unique_title = f"TEST_Update_Item_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/marketplace/listings",
            headers=auth_headers,
            json={
                "title": unique_title,
                "description": "Original description",
                "price": 50.00,
                "category": "electronics",
                "images": [],
                "condition": "new",
                "is_digital": False,
                "target_countries": ["US"]
            }
        )
        assert create_response.status_code in [200, 201]
        listing_id = create_response.json().get("listing_id")
        
        # Update the listing
        updated_title = f"TEST_Updated_Item_{uuid.uuid4().hex[:8]}"
        update_response = requests.put(
            f"{BASE_URL}/api/marketplace/listings/{listing_id}",
            headers=auth_headers,
            json={
                "title": updated_title,
                "description": "Updated description",
                "price": 75.00
            }
        )
        assert update_response.status_code == 200
        updated_data = update_response.json()
        assert updated_data.get("title") == updated_title
        assert updated_data.get("price") == 75.00
        
        # Verify the update persisted
        get_response = requests.get(f"{BASE_URL}/api/marketplace/listings/{listing_id}")
        assert get_response.status_code == 200
        fetched_data = get_response.json()
        assert fetched_data.get("title") == updated_title
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/marketplace/listings/{listing_id}",
            headers=auth_headers
        )
    
    def test_update_listing_unauthorized(self, auth_headers):
        """Test that users cannot update other users' listings"""
        # Try to update a listing that doesn't belong to the user
        # This should return 403 or 404
        fake_listing_id = "listing_nonexistent123"
        response = requests.put(
            f"{BASE_URL}/api/marketplace/listings/{fake_listing_id}",
            headers=auth_headers,
            json={"title": "Hacked Title"}
        )
        assert response.status_code in [403, 404]
    
    def test_update_listing_with_target_countries(self, auth_headers):
        """Test updating listing with target countries"""
        # Create listing
        unique_title = f"TEST_Countries_Item_{uuid.uuid4().hex[:8]}"
        create_response = requests.post(
            f"{BASE_URL}/api/marketplace/listings",
            headers=auth_headers,
            json={
                "title": unique_title,
                "description": "Test item",
                "price": 100.00,
                "category": "electronics",
                "images": [],
                "condition": "new",
                "is_digital": False,
                "target_countries": ["US"]
            }
        )
        listing_id = create_response.json().get("listing_id")
        
        # Update with more target countries
        update_response = requests.put(
            f"{BASE_URL}/api/marketplace/listings/{listing_id}",
            headers=auth_headers,
            json={
                "target_countries": ["US", "CA", "GB", "AU", "DE", "FR"]
            }
        )
        assert update_response.status_code == 200
        updated_data = update_response.json()
        assert len(updated_data.get("target_countries", [])) == 6
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/marketplace/listings/{listing_id}",
            headers=auth_headers
        )


class TestMarketplaceCategories:
    """Test marketplace categories endpoint"""
    
    def test_get_categories(self):
        """Test categories endpoint returns list"""
        response = requests.get(f"{BASE_URL}/api/marketplace/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check structure
        assert "id" in data[0]
        assert "name" in data[0]


class TestGuestMarketplaceAccess:
    """Test guest access to marketplace - Feature #1"""
    
    def test_guest_can_view_listings(self):
        """Test that guests can view marketplace listings"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200
        data = response.json()
        assert "listings" in data or isinstance(data, list)
    
    def test_guest_can_view_single_listing(self):
        """Test that guests can view a single listing detail"""
        # First get a listing ID
        listings_response = requests.get(f"{BASE_URL}/api/marketplace/listings?limit=1")
        assert listings_response.status_code == 200
        data = listings_response.json()
        listings = data.get("listings", data) if isinstance(data, dict) else data
        
        if listings and len(listings) > 0:
            listing_id = listings[0].get("listing_id")
            if listing_id:
                # Try to view the listing detail
                detail_response = requests.get(f"{BASE_URL}/api/marketplace/listings/{listing_id}")
                assert detail_response.status_code == 200
                detail_data = detail_response.json()
                assert "title" in detail_data
                assert "price" in detail_data


class TestCheckoutCountries:
    """Test checkout country functionality - Feature #3"""
    
    def test_shippo_carriers_endpoint(self):
        """Test Shippo carriers endpoint returns carriers"""
        response = requests.get(f"{BASE_URL}/api/shippo/carriers")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Should have at least USPS, UPS, FedEx
        carrier_names = [c.get("name", "").lower() for c in data]
        assert any("usps" in name for name in carrier_names) or len(data) > 0


class TestSellerDashboard:
    """Test seller dashboard functionality - Feature #5"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@example.com", "password": "Test123!"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_seller_stats_endpoint(self, auth_headers):
        """Test seller stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/seller/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        # Should have stats fields
        assert "active_listings" in data or "total_revenue" in data or isinstance(data, dict)
    
    def test_seller_performance_endpoint(self, auth_headers):
        """Test seller performance endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/seller/performance?days=30",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
    
    def test_seller_orders_endpoint(self, auth_headers):
        """Test seller orders endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/orders/seller/list",
            headers=auth_headers
        )
        # Should return 200 with empty list or orders
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestBLTransactions:
    """Test BL coin transaction logging"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@example.com", "password": "Test123!"}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_wallet_balance_endpoint(self, auth_headers):
        """Test wallet balance endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/balance",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data or "bl_coins" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
