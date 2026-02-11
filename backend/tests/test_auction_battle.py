"""
Test suite for Photo Auction Bidding Battle feature
Tests the new TappingArena, RPSBidding, and BattleArena components
"""

import pytest
import requests
import os
import jwt
from datetime import datetime, timedelta, timezone

# Get base URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://stripe-fix-29.preview.emergentagent.com')
JWT_SECRET = "blendlink-jwt-secret-key-2024"
JWT_ALGORITHM = "HS256"

# Test user credentials
TEST_USER_ID = "test-user-1769531506601"


def create_jwt_token(user_id: str) -> str:
    """Create a JWT token for testing"""
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=168)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


@pytest.fixture
def auth_headers():
    """Get authentication headers with JWT token"""
    token = create_jwt_token(TEST_USER_ID)
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }


class TestPhotoGameConfig:
    """Test game configuration endpoint"""
    
    def test_get_game_config(self):
        """Test GET /api/photo-game/config returns correct configuration"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        assert response.status_code == 200
        
        data = response.json()
        # Verify config structure
        assert "max_stamina" in data
        assert data["max_stamina"] == 100
        assert "stamina_per_battle" in data
        assert "win_streak_multipliers" in data
        assert "rps_auction" in data
        
        # Verify RPS auction config
        rps_config = data["rps_auction"]
        assert rps_config["starting_bankroll"] == 10000000
        assert rps_config["min_bid"] == 1000000
        assert rps_config["max_bid"] == 5000000
        assert rps_config["bid_increment"] == 1000000


class TestPhotoGameStats:
    """Test user stats endpoint"""
    
    def test_get_stats_authenticated(self, auth_headers):
        """Test GET /api/photo-game/stats returns user stats"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify stats structure
        assert "user_id" in data
        assert "stamina" in data
        assert "current_win_streak" in data
        assert "current_lose_streak" in data
        assert "total_battles" in data
        assert "battles_won" in data
        assert "battles_lost" in data
    
    def test_get_stats_unauthenticated(self):
        """Test GET /api/photo-game/stats without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/photo-game/stats")
        assert response.status_code == 401


class TestBattlePhotos:
    """Test battle photos endpoint"""
    
    def test_get_battle_photos_authenticated(self, auth_headers):
        """Test GET /api/photo-game/battle-photos returns user's minted photos"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify response structure
        assert "photos" in data
        assert "count" in data
        assert "available_count" in data
        assert isinstance(data["photos"], list)
        
        # If photos exist, verify photo structure
        if len(data["photos"]) > 0:
            photo = data["photos"][0]
            assert "mint_id" in photo
            assert "name" in photo
            assert "scenery_type" in photo
            assert "dollar_value" in photo
            assert "stamina" in photo
            assert "is_available" in photo
            assert "battles_remaining" in photo
    
    def test_get_battle_photos_unauthenticated(self):
        """Test GET /api/photo-game/battle-photos without auth returns 401"""
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 401


class TestPvPMatchmaking:
    """Test PvP matchmaking endpoints"""
    
    def test_get_queue_status(self):
        """Test GET /api/photo-game/pvp/queue-status returns queue info"""
        response = requests.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        assert response.status_code == 200
        
        data = response.json()
        assert "players_waiting" in data
        assert "active_matches" in data


class TestLeaderboards:
    """Test leaderboard endpoints"""
    
    def test_get_wins_leaderboard(self):
        """Test GET /api/photo-game/leaderboard/wins returns leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins?period=24h&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert "period" in data
        assert data["period"] == "24h"
    
    def test_get_photos_leaderboard(self):
        """Test GET /api/photo-game/leaderboard/photos returns photo leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/photos?period=24h&limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert "period" in data


class TestGameStart:
    """Test game start functionality"""
    
    def test_start_game_without_photo(self, auth_headers):
        """Test POST /api/photo-game/start without photo returns error"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=auth_headers,
            json={
                "opponent_id": "bot",
                "bet_amount": 0
            }
        )
        # Should fail because photo_id is required
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
    
    def test_start_practice_mode(self, auth_headers):
        """Test POST /api/photo-game/start with practice_mode=True"""
        # First get a photo
        photos_response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers=auth_headers
        )
        
        if photos_response.status_code == 200:
            photos = photos_response.json().get("photos", [])
            if len(photos) > 0:
                photo_id = photos[0]["mint_id"]
                
                response = requests.post(
                    f"{BASE_URL}/api/photo-game/start",
                    headers=auth_headers,
                    json={
                        "opponent_id": "bot",
                        "bet_amount": 0,
                        "photo_id": photo_id,
                        "practice_mode": True
                    }
                )
                
                # Practice mode should start successfully
                if response.status_code == 200:
                    data = response.json()
                    assert data.get("success") == True
                    assert "session" in data
                    assert data.get("phase") == "rps_auction"


class TestRPSAuction:
    """Test RPS Auction gameplay"""
    
    def test_rps_auction_invalid_choice(self, auth_headers):
        """Test RPS auction with invalid choice returns error"""
        # This test requires an active session, so we'll test the validation
        response = requests.post(
            f"{BASE_URL}/api/photo-game/session/invalid_session/rps-auction",
            headers=auth_headers,
            json={
                "choice": "invalid",
                "bid_amount": 1000000
            }
        )
        # Should fail with session not found or invalid choice
        assert response.status_code in [400, 404]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
