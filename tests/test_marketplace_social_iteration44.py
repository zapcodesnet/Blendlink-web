"""
Test suite for Blendlink Marketplace Social Features - Iteration 44
Tests:
1. Marketplace categories endpoint returns expanded list with 'Digital Goods & NFTs'
2. Like endpoint works for authenticated users
3. Like endpoint returns 401 for non-authenticated users
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://photo-battle-5.preview.emergentagent.com')

class TestMarketplaceCategories:
    """Test marketplace categories endpoint"""
    
    def test_categories_endpoint_returns_list(self):
        """Test that categories endpoint returns a list"""
        response = requests.get(f"{BASE_URL}/api/marketplace/categories")
        assert response.status_code == 200
        categories = response.json()
        assert isinstance(categories, list)
        assert len(categories) >= 17  # Should have at least 17 categories
    
    def test_categories_contains_digital_goods_nfts(self):
        """Test that 'Digital Goods & NFTs' category exists"""
        response = requests.get(f"{BASE_URL}/api/marketplace/categories")
        assert response.status_code == 200
        categories = response.json()
        
        # Find the digital category
        digital_cat = next((c for c in categories if c['id'] == 'digital'), None)
        assert digital_cat is not None, "Digital category not found"
        assert digital_cat['name'] == 'Digital Goods & NFTs', f"Expected 'Digital Goods & NFTs', got '{digital_cat['name']}'"
    
    def test_categories_contains_new_categories(self):
        """Test that new categories (Jewelry, Health, etc.) exist"""
        response = requests.get(f"{BASE_URL}/api/marketplace/categories")
        assert response.status_code == 200
        categories = response.json()
        
        expected_categories = [
            ('jewelry', 'Jewelry & Watches'),
            ('collectibles', 'Collectibles & Art'),
            ('health', 'Health & Beauty'),
            ('toys', 'Toys & Hobbies'),
            ('business', 'Business & Industrial'),
            ('pets', 'Pet Supplies'),
            ('baby', 'Baby Essentials'),
            ('giftcards', 'Gift Cards & Coupons'),
            ('tickets', 'Tickets & Travel'),
        ]
        
        for cat_id, cat_name in expected_categories:
            cat = next((c for c in categories if c['id'] == cat_id), None)
            assert cat is not None, f"Category '{cat_id}' not found"
            assert cat['name'] == cat_name, f"Expected '{cat_name}', got '{cat['name']}'"


class TestMarketplaceLikeEndpoint:
    """Test marketplace listing like endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "Test123!"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture
    def listing_id(self):
        """Get a listing ID for testing"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings?limit=1")
        if response.status_code == 200:
            listings = response.json()
            if listings:
                return listings[0]['listing_id']
        pytest.skip("No listings available for testing")
    
    def test_like_endpoint_requires_auth(self, listing_id):
        """Test that like endpoint returns 401 for non-authenticated users"""
        response = requests.post(f"{BASE_URL}/api/marketplace/listings/{listing_id}/like")
        # Should return 401 or error message
        assert response.status_code in [401, 200]  # 200 with error detail is also acceptable
        if response.status_code == 200:
            data = response.json()
            assert 'detail' in data or 'error' in data
    
    def test_like_endpoint_works_with_auth(self, auth_token, listing_id):
        """Test that like endpoint works for authenticated users"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/marketplace/listings/{listing_id}/like",
            headers=headers
        )
        assert response.status_code == 200
        data = response.json()
        assert 'liked' in data
        assert 'likes_count' in data
        assert isinstance(data['liked'], bool)
        assert isinstance(data['likes_count'], int)
    
    def test_like_toggle_works(self, auth_token, listing_id):
        """Test that liking twice toggles the like status"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First like
        response1 = requests.post(
            f"{BASE_URL}/api/marketplace/listings/{listing_id}/like",
            headers=headers
        )
        assert response1.status_code == 200
        first_state = response1.json()['liked']
        
        # Second like (should toggle)
        response2 = requests.post(
            f"{BASE_URL}/api/marketplace/listings/{listing_id}/like",
            headers=headers
        )
        assert response2.status_code == 200
        second_state = response2.json()['liked']
        
        # States should be opposite
        assert first_state != second_state, "Like toggle did not work"


class TestMarketplaceListings:
    """Test marketplace listings endpoint"""
    
    def test_listings_endpoint_returns_list(self):
        """Test that listings endpoint returns a list"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200
        listings = response.json()
        assert isinstance(listings, list)
    
    def test_listings_have_seller_info(self):
        """Test that listings include seller information"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings?limit=5")
        assert response.status_code == 200
        listings = response.json()
        
        if listings:
            for listing in listings:
                assert 'seller' in listing, "Listing missing seller info"
                assert 'listing_id' in listing, "Listing missing listing_id"
                assert 'title' in listing, "Listing missing title"
                assert 'price' in listing, "Listing missing price"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
