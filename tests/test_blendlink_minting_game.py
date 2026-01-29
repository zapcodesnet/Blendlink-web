"""
Blendlink Minting, Photo Game, and Marketplace API Tests
Tests for:
- Minting config API
- Photo game config API
- Marketplace config API
- PvP queue status API
- Game stats API (authenticated)
- Mint status API (authenticated)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://mintbid-upgrade.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"


class TestPublicConfigAPIs:
    """Test public configuration endpoints (no auth required)"""
    
    def test_minting_config(self):
        """Test /api/minting/config returns correct configuration"""
        response = requests.get(f"{BASE_URL}/api/minting/config")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields
        assert "mint_cost_bl" in data
        assert data["mint_cost_bl"] == 500
        
        assert "daily_limits" in data
        assert data["daily_limits"]["free"] == 3
        assert data["daily_limits"]["basic"] == 20
        assert data["daily_limits"]["premium"] == 50
        
        assert "scenery_types" in data
        assert "natural" in data["scenery_types"]
        assert "water" in data["scenery_types"]
        assert "manmade" in data["scenery_types"]
        
        assert "supported_types" in data
        assert "photo" in data["supported_types"]
        print("✓ Minting config API working correctly")
    
    def test_photo_game_config(self):
        """Test /api/photo-game/config returns correct configuration"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields
        assert "max_stamina" in data
        assert data["max_stamina"] == 100
        
        assert "stamina_per_battle" in data
        assert data["stamina_per_battle"] == 4
        
        assert "stamina_regen_hours" in data
        assert data["stamina_regen_hours"] == 24
        
        assert "win_streak_multipliers" in data
        assert "strength_multiplier" in data
        assert data["strength_multiplier"] == 1.25
        print("✓ Photo game config API working correctly")
    
    def test_marketplace_config(self):
        """Test /api/marketplace/config returns correct configuration"""
        response = requests.get(f"{BASE_URL}/api/marketplace/config")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields
        assert "platform_fee_percent" in data
        assert data["platform_fee_percent"] == 8
        
        assert "supported_content_types" in data
        assert "minted_photo" in data["supported_content_types"]
        
        assert "listing_types" in data
        assert "fixed_price" in data["listing_types"]
        assert "auction" in data["listing_types"]
        
        assert "min_price_usd" in data
        assert data["min_price_usd"] == 1.0
        print("✓ Marketplace config API working correctly")
    
    def test_pvp_queue_status(self):
        """Test /api/photo-game/pvp/queue-status returns queue info"""
        response = requests.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields
        assert "players_waiting" in data
        assert isinstance(data["players_waiting"], int)
        
        assert "active_matches" in data
        assert isinstance(data["active_matches"], int)
        print(f"✓ PvP queue status: {data['players_waiting']} waiting, {data['active_matches']} active matches")


class TestAuthenticatedAPIs:
    """Test authenticated endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_minting_status(self, auth_headers):
        """Test /api/minting/status returns user's minting status"""
        response = requests.get(
            f"{BASE_URL}/api/minting/status",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields
        assert "can_mint" in data
        assert isinstance(data["can_mint"], bool)
        
        assert "bl_coins" in data
        assert isinstance(data["bl_coins"], (int, float))
        
        assert "mints_today" in data
        assert isinstance(data["mints_today"], int)
        
        assert "daily_limit" in data
        assert isinstance(data["daily_limit"], int)
        
        assert "remaining_mints" in data
        assert isinstance(data["remaining_mints"], int)
        
        print(f"✓ Minting status: can_mint={data['can_mint']}, BL={data['bl_coins']}, mints_today={data['mints_today']}/{data['daily_limit']}")
    
    def test_photo_game_stats(self, auth_headers):
        """Test /api/photo-game/stats returns user's game stats"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields
        assert "user_id" in data
        assert "stamina" in data
        assert isinstance(data["stamina"], (int, float))
        assert data["stamina"] >= 0 and data["stamina"] <= 100
        
        assert "current_win_streak" in data
        assert isinstance(data["current_win_streak"], int)
        
        assert "best_win_streak" in data
        assert isinstance(data["best_win_streak"], int)
        
        assert "total_battles" in data
        assert "battles_won" in data
        assert "battles_lost" in data
        
        assert "total_bl_won" in data
        assert "total_bl_lost" in data
        
        print(f"✓ Game stats: stamina={data['stamina']}, streak={data['current_win_streak']}, battles={data['total_battles']}")
    
    def test_minting_status_without_auth(self):
        """Test /api/minting/status returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/minting/status")
        assert response.status_code == 401
        print("✓ Minting status correctly requires authentication")
    
    def test_photo_game_stats_without_auth(self):
        """Test /api/photo-game/stats returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/photo-game/stats")
        assert response.status_code == 401
        print("✓ Photo game stats correctly requires authentication")


class TestLeaderboards:
    """Test leaderboard endpoints"""
    
    def test_wins_leaderboard(self):
        """Test /api/photo-game/leaderboard/wins returns leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        print(f"✓ Wins leaderboard: {len(data['leaderboard'])} entries")
    
    def test_photos_leaderboard(self):
        """Test /api/photo-game/leaderboard/photos returns leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/photos")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        print(f"✓ Photos leaderboard: {len(data['leaderboard'])} entries")


class TestMintingFeed:
    """Test minting feed endpoints"""
    
    def test_minted_photos_feed(self):
        """Test /api/minting/feed returns public photos"""
        response = requests.get(f"{BASE_URL}/api/minting/feed")
        assert response.status_code == 200
        
        data = response.json()
        assert "photos" in data
        assert isinstance(data["photos"], list)
        assert "count" in data
        print(f"✓ Minted photos feed: {data['count']} photos")


class TestMarketplaceListings:
    """Test marketplace listing endpoints"""
    
    def test_marketplace_listings(self):
        """Test /api/marketplace/listings returns listings"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Marketplace listings: {len(data)} listings")


class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health(self):
        """Test /api/health returns ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "ok"
        print("✓ Health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
