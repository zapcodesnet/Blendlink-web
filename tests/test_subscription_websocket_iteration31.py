"""
Test Suite for Blendlink Iteration 31
- Subscription Tiers API
- Ranked Matchmaking Leaderboard
- WebSocket Status API
- Photo Game APIs (existing)
- Minting APIs (existing)
- Marketplace APIs (existing)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestSubscriptionTiers:
    """Tests for subscription tiers system"""
    
    def test_get_subscription_tiers(self):
        """Test /api/subscriptions/tiers returns all tiers"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200
        
        data = response.json()
        assert "tiers" in data
        assert "ranked_tiers" in data
        
        # Verify subscription tiers
        tiers = data["tiers"]
        assert "free" in tiers
        assert "basic" in tiers
        assert "premium" in tiers
        
        # Verify free tier
        assert tiers["free"]["price_monthly"] == 0
        assert tiers["free"]["daily_bl_bonus"] == 0
        
        # Verify basic tier ($4.99)
        assert tiers["basic"]["price_monthly"] == 4.99
        assert tiers["basic"]["daily_bl_bonus"] == 100
        
        # Verify premium tier ($9.99)
        assert tiers["premium"]["price_monthly"] == 9.99
        assert tiers["premium"]["daily_bl_bonus"] == 300
        assert tiers["premium"]["can_create_tournaments"] == True
        
    def test_subscription_tiers_ranked_tiers(self):
        """Test ranked tiers are returned correctly"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200
        
        data = response.json()
        ranked_tiers = data["ranked_tiers"]
        
        # Verify all ranked tiers exist
        expected_tiers = ["bronze", "silver", "gold", "platinum", "diamond", "master"]
        for tier in expected_tiers:
            assert tier in ranked_tiers
            assert "name" in ranked_tiers[tier]
            assert "min_rating" in ranked_tiers[tier]
            assert "max_rating" in ranked_tiers[tier]
            assert "icon" in ranked_tiers[tier]
            assert "color" in ranked_tiers[tier]
            
        # Verify rating ranges
        assert ranked_tiers["bronze"]["min_rating"] == 0
        assert ranked_tiers["bronze"]["max_rating"] == 999
        assert ranked_tiers["master"]["min_rating"] == 3000


class TestRankedLeaderboard:
    """Tests for ranked matchmaking leaderboard"""
    
    def test_get_ranked_leaderboard(self):
        """Test /api/subscriptions/ranked/leaderboard returns leaderboard"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/ranked/leaderboard")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
    def test_ranked_leaderboard_with_limit(self):
        """Test leaderboard with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/ranked/leaderboard?limit=5")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) <= 5


class TestWebSocketStatus:
    """Tests for WebSocket notification system"""
    
    def test_websocket_status(self):
        """Test /api/ws/status returns connection stats"""
        response = requests.get(f"{BASE_URL}/api/ws/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "online_users" in data
        assert "total_connections" in data
        assert isinstance(data["online_users"], int)
        assert isinstance(data["total_connections"], int)


class TestPhotoGameAPIs:
    """Tests for existing Photo Game APIs"""
    
    def test_photo_game_config(self):
        """Test /api/photo-game/config returns configuration"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "max_stamina" in data
        assert data["max_stamina"] == 100
        assert "stamina_per_battle" in data
        assert data["stamina_per_battle"] == 4
        
    def test_photo_game_pvp_queue_status(self):
        """Test /api/photo-game/pvp/queue-status returns queue info"""
        response = requests.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        assert response.status_code == 200
        
        data = response.json()
        assert "players_waiting" in data or "queue_size" in data or isinstance(data, dict)
        
    def test_photo_game_leaderboard_wins(self):
        """Test /api/photo-game/leaderboard/wins returns leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
    def test_photo_game_leaderboard_photos(self):
        """Test /api/photo-game/leaderboard/photos returns leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/photos")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


class TestMintingAPIs:
    """Tests for existing Minting APIs"""
    
    def test_minting_config(self):
        """Test /api/minting/config returns configuration"""
        response = requests.get(f"{BASE_URL}/api/minting/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "mint_cost_bl" in data
        assert data["mint_cost_bl"] == 500
        assert "daily_limits" in data
        assert "scenery_types" in data
        
    def test_minting_feed(self):
        """Test /api/minting/feed returns public photos"""
        response = requests.get(f"{BASE_URL}/api/minting/feed")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


class TestMarketplaceAPIs:
    """Tests for existing Marketplace APIs"""
    
    def test_marketplace_config(self):
        """Test /api/marketplace/config returns configuration"""
        response = requests.get(f"{BASE_URL}/api/marketplace/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "platform_fee_percent" in data
        assert data["platform_fee_percent"] == 8
        
    def test_marketplace_listings(self):
        """Test /api/marketplace/listings returns listings"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


class TestAuthenticatedEndpoints:
    """Tests for authenticated endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "Test123!"
        })
        if response.status_code == 200:
            self.token = response.json().get("token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Authentication failed")
            
    def test_my_subscription(self):
        """Test /api/subscriptions/my-subscription returns user subscription"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/my-subscription",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "tier" in data
        assert "tier_details" in data
        
    def test_ranked_profile(self):
        """Test /api/subscriptions/ranked/profile returns user ranked profile"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/ranked/profile",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "rating" in data
        assert "tier" in data
        
    def test_photo_game_stats(self):
        """Test /api/photo-game/stats returns user stats"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
        
    def test_minting_status(self):
        """Test /api/minting/status returns user minting status"""
        response = requests.get(
            f"{BASE_URL}/api/minting/status",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, dict)
        
    def test_minting_photos(self):
        """Test /api/minting/photos returns user's minted photos"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


class TestTournaments:
    """Tests for tournament endpoints"""
    
    def test_get_tournaments(self):
        """Test /api/subscriptions/tournaments returns tournaments list"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tournaments")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


class TestHealthCheck:
    """Basic health check"""
    
    def test_health(self):
        """Test /api/health returns ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "ok"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
