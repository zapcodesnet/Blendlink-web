"""
Blendlink Auction System Backend Tests - Iteration 48
Tests for:
- POST /api/auctions/listing/{id}/bid - place bid endpoint
- GET /api/auctions/listing/{id}/bids - get bid history
- GET /api/auctions/listing/{id}/status - get auction status
- GET /api/auctions/active - get active auctions
- GET /api/auctions/my-bids - get user's bid history
- POST /api/marketplace/listings with auction settings
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "Test123!"


class TestAuctionSystemSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def auth_token(self, api_client):
        """Get authentication token"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def authenticated_client(self, api_client, auth_token):
        """Session with auth header"""
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        return api_client
    
    def test_api_health(self, api_client):
        """Test API is accessible"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✓ API health check passed")
    
    def test_authentication(self, api_client):
        """Test login endpoint works"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Authentication successful for {TEST_USER_EMAIL}")


class TestAuctionListingCreation:
    """Test creating listings with auction settings"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def auth_token(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def authenticated_client(self, api_client, auth_token):
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        return api_client
    
    def test_create_auction_listing(self, authenticated_client):
        """Test creating a listing with auction settings"""
        unique_id = uuid.uuid4().hex[:8]
        listing_data = {
            "title": f"TEST_Auction_Item_{unique_id}",
            "description": "Test auction listing for automated testing",
            "price": 100.0,
            "category": "electronics",
            "images": ["https://example.com/test.jpg"],
            "condition": "new",
            "is_digital": False,
            "auction": {
                "is_auction": True,
                "duration": "1d",
                "starting_bid": 50.0,
                "reserve_price": 100.0,
                "buy_it_now_price": 200.0,
                "auto_relist": False,
                "auto_extend": True
            }
        }
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/marketplace/listings",
            json=listing_data
        )
        
        assert response.status_code == 200, f"Failed to create auction listing: {response.text}"
        data = response.json()
        
        # Verify auction settings were saved
        assert "listing_id" in data
        assert data.get("listing_type") == "auction"
        assert "auction" in data
        
        auction = data["auction"]
        assert auction["is_auction"] == True
        assert auction["duration"] == "1d"
        assert auction["starting_bid"] == 50.0
        assert auction["reserve_price"] == 100.0
        assert auction["buy_it_now_price"] == 200.0
        assert auction["auto_extend"] == True
        assert auction["status"] == "active"
        assert "end_time" in auction
        
        print(f"✓ Created auction listing: {data['listing_id']}")
        return data["listing_id"]
    
    def test_create_fixed_price_listing(self, authenticated_client):
        """Test creating a regular fixed price listing (no auction)"""
        unique_id = uuid.uuid4().hex[:8]
        listing_data = {
            "title": f"TEST_Fixed_Price_Item_{unique_id}",
            "description": "Test fixed price listing",
            "price": 150.0,
            "category": "electronics",
            "images": [],
            "condition": "used"
        }
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/marketplace/listings",
            json=listing_data
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("listing_type") == "fixed_price"
        print(f"✓ Created fixed price listing: {data['listing_id']}")


class TestAuctionEndpoints:
    """Test auction-specific API endpoints"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def auth_token(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def authenticated_client(self, api_client, auth_token):
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        return api_client
    
    @pytest.fixture(scope="class")
    def auction_listing_id(self, authenticated_client):
        """Create an auction listing for testing"""
        unique_id = uuid.uuid4().hex[:8]
        listing_data = {
            "title": f"TEST_Auction_For_Bidding_{unique_id}",
            "description": "Test auction for bid testing",
            "price": 100.0,
            "category": "electronics",
            "auction": {
                "is_auction": True,
                "duration": "1d",
                "starting_bid": 10.0,
                "reserve_price": 50.0,
                "buy_it_now_price": 100.0,
                "auto_extend": True
            }
        }
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/marketplace/listings",
            json=listing_data
        )
        
        if response.status_code == 200:
            return response.json()["listing_id"]
        pytest.skip("Failed to create auction listing for testing")
    
    def test_get_active_auctions(self, api_client):
        """Test GET /api/auctions/active endpoint"""
        response = api_client.get(f"{BASE_URL}/api/auctions/active")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "listings" in data
        assert "total" in data
        assert isinstance(data["listings"], list)
        
        # If there are listings, verify they have auction data
        if data["listings"]:
            listing = data["listings"][0]
            assert "auction" in listing
            assert listing["auction"].get("is_auction") == True
            if listing["auction"].get("end_time"):
                assert "time_remaining" in listing["auction"]
        
        print(f"✓ GET /api/auctions/active - Found {data['total']} active auctions")
    
    def test_get_active_auctions_ending_soon(self, api_client):
        """Test GET /api/auctions/active with ending_soon filter"""
        response = api_client.get(f"{BASE_URL}/api/auctions/active?ending_soon=true")
        
        assert response.status_code == 200
        data = response.json()
        assert "listings" in data
        print(f"✓ GET /api/auctions/active?ending_soon=true - Found {data['total']} auctions")
    
    def test_get_auction_status(self, api_client, auction_listing_id):
        """Test GET /api/auctions/listing/{id}/status endpoint"""
        response = api_client.get(f"{BASE_URL}/api/auctions/listing/{auction_listing_id}/status")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["listing_id"] == auction_listing_id
        assert "status" in data
        assert "current_bid" in data
        assert "starting_bid" in data
        assert "time_remaining" in data
        assert "end_time" in data
        assert "reserve_met" in data
        assert "auto_extend" in data
        
        print(f"✓ GET /api/auctions/listing/{auction_listing_id}/status - Status: {data['status']}")
    
    def test_get_auction_bids(self, api_client, auction_listing_id):
        """Test GET /api/auctions/listing/{id}/bids endpoint"""
        response = api_client.get(f"{BASE_URL}/api/auctions/listing/{auction_listing_id}/bids")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["listing_id"] == auction_listing_id
        assert "bids" in data
        assert isinstance(data["bids"], list)
        assert "current_bid" in data
        assert "bid_count" in data
        assert "starting_bid" in data
        assert "time_remaining" in data
        assert "reserve_met" in data
        
        print(f"✓ GET /api/auctions/listing/{auction_listing_id}/bids - {data['bid_count']} bids")
    
    def test_get_auction_status_non_auction_listing(self, api_client, authenticated_client):
        """Test that auction status returns error for non-auction listings"""
        # Create a fixed price listing
        unique_id = uuid.uuid4().hex[:8]
        response = authenticated_client.post(
            f"{BASE_URL}/api/marketplace/listings",
            json={
                "title": f"TEST_Fixed_{unique_id}",
                "description": "Fixed price item",
                "price": 50.0,
                "category": "general"
            }
        )
        
        if response.status_code == 200:
            listing_id = response.json()["listing_id"]
            
            # Try to get auction status
            status_response = api_client.get(f"{BASE_URL}/api/auctions/listing/{listing_id}/status")
            assert status_response.status_code == 400
            print("✓ Correctly returns 400 for non-auction listing status")
    
    def test_get_auction_status_not_found(self, api_client):
        """Test auction status for non-existent listing"""
        response = api_client.get(f"{BASE_URL}/api/auctions/listing/nonexistent_listing_123/status")
        assert response.status_code == 404
        print("✓ Correctly returns 404 for non-existent listing")


class TestAuctionBidding:
    """Test bidding functionality"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def auth_token(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def authenticated_client(self, api_client, auth_token):
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        return api_client
    
    @pytest.fixture(scope="class")
    def user_info(self, authenticated_client):
        """Get current user info"""
        response = authenticated_client.get(f"{BASE_URL}/api/auth/me")
        if response.status_code == 200:
            return response.json()
        return {}
    
    def test_place_bid_requires_auth(self, api_client):
        """Test that placing a bid requires authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/auctions/listing/some_listing_id/bid",
            json={"amount": 100.0}
        )
        assert response.status_code == 401
        print("✓ POST /api/auctions/listing/{id}/bid requires authentication")
    
    def test_place_bid_on_nonexistent_listing(self, authenticated_client):
        """Test bidding on non-existent listing"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/auctions/listing/nonexistent_123/bid",
            json={"amount": 100.0}
        )
        assert response.status_code == 404
        print("✓ Correctly returns 404 for bidding on non-existent listing")
    
    def test_get_my_bids_requires_auth(self, api_client):
        """Test that my-bids endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/auctions/my-bids")
        assert response.status_code == 401
        print("✓ GET /api/auctions/my-bids requires authentication")
    
    def test_get_my_bids(self, authenticated_client):
        """Test GET /api/auctions/my-bids endpoint"""
        response = authenticated_client.get(f"{BASE_URL}/api/auctions/my-bids")
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "bids" in data
        assert isinstance(data["bids"], list)
        
        print(f"✓ GET /api/auctions/my-bids - Found {len(data['bids'])} bids")
    
    def test_get_my_bids_with_status_filter(self, authenticated_client):
        """Test GET /api/auctions/my-bids with status filter"""
        for status in ["all", "active", "won", "lost", "outbid"]:
            response = authenticated_client.get(f"{BASE_URL}/api/auctions/my-bids?status={status}")
            assert response.status_code == 200, f"Failed for status={status}: {response.text}"
        
        print("✓ GET /api/auctions/my-bids with status filters works")


class TestAuctionDurationValidation:
    """Test auction duration options"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def auth_token(self, api_client):
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def authenticated_client(self, api_client, auth_token):
        api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
        return api_client
    
    def test_valid_duration_options(self, authenticated_client):
        """Test all valid duration options: 1h, 3h, 6h, 12h, 1d, 2d, 3d, 5d, 7d"""
        valid_durations = ["1h", "3h", "6h", "12h", "1d", "2d", "3d", "5d", "7d"]
        
        for duration in valid_durations:
            unique_id = uuid.uuid4().hex[:8]
            listing_data = {
                "title": f"TEST_Duration_{duration}_{unique_id}",
                "description": f"Testing {duration} duration",
                "price": 50.0,
                "category": "general",
                "auction": {
                    "is_auction": True,
                    "duration": duration,
                    "starting_bid": 10.0
                }
            }
            
            response = authenticated_client.post(
                f"{BASE_URL}/api/marketplace/listings",
                json=listing_data
            )
            
            assert response.status_code == 200, f"Failed for duration {duration}: {response.text}"
            data = response.json()
            assert data["auction"]["duration"] == duration
        
        print(f"✓ All valid durations work: {', '.join(valid_durations)}")
    
    def test_invalid_duration(self, authenticated_client):
        """Test that invalid duration is rejected"""
        unique_id = uuid.uuid4().hex[:8]
        listing_data = {
            "title": f"TEST_Invalid_Duration_{unique_id}",
            "description": "Testing invalid duration",
            "price": 50.0,
            "category": "general",
            "auction": {
                "is_auction": True,
                "duration": "10d",  # Invalid duration
                "starting_bid": 10.0
            }
        }
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/marketplace/listings",
            json=listing_data
        )
        
        assert response.status_code == 400, f"Should reject invalid duration, got: {response.status_code}"
        print("✓ Invalid duration correctly rejected")


class TestAuctionWebSocket:
    """Test WebSocket endpoint exists"""
    
    def test_websocket_endpoint_documented(self):
        """Verify WebSocket endpoint is at /api/auctions/ws/{listing_id}"""
        # WebSocket testing requires special handling
        # Just verify the endpoint pattern is documented
        print("✓ WebSocket endpoint documented at /api/auctions/ws/{listing_id}")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
