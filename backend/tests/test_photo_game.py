"""
Photo Game API Tests - Iteration 129
Tests for the PVP photo game functionality including config, open games, and WebSocket endpoints.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPhotoGameConfig:
    """Test game configuration endpoint"""
    
    def test_config_returns_correct_values(self):
        """Verify /api/photo-game/config returns updated game constants"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        
        assert response.status_code == 200, f"Config endpoint failed: {response.text}"
        
        data = response.json()
        
        # Verify max stamina
        assert data["max_stamina"] == 24, f"Expected max_stamina=24, got {data['max_stamina']}"
        
        # Verify RPS auction config - UPDATED values per user spec
        rps_config = data["rps_auction"]
        
        # $7M starting with advantage
        assert rps_config["starting_bankroll_with_advantage"] == 7_000_000, \
            f"Expected starting_bankroll_with_advantage=7000000, got {rps_config['starting_bankroll_with_advantage']}"
        
        # $2M advantage bonus
        assert rps_config["advantage_bonus"] == 2_000_000, \
            f"Expected advantage_bonus=2000000, got {rps_config['advantage_bonus']}"
        
        # $7M max bid
        assert rps_config["max_bid"] == 7_000_000, \
            f"Expected max_bid=7000000, got {rps_config['max_bid']}"
        
        # 10 second choice timeout
        assert rps_config["choice_timeout_seconds"] == 10, \
            f"Expected choice_timeout_seconds=10, got {rps_config['choice_timeout_seconds']}"
        
        # $1M min bid
        assert rps_config["min_bid"] == 1_000_000, \
            f"Expected min_bid=1000000, got {rps_config['min_bid']}"
        
        print("✅ Game config returns all correct values")


class TestAuthenticatedEndpoints:
    """Tests requiring authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture
    def auth_headers(self, auth_token):
        """Get headers with authentication"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_open_games_list(self, auth_headers):
        """Test /api/photo-game/open-games returns list of games"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/open-games",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Open games endpoint failed: {response.text}"
        
        data = response.json()
        assert "games" in data, "Response should contain 'games' key"
        assert "count" in data, "Response should contain 'count' key"
        assert isinstance(data["games"], list), "'games' should be a list"
        
        print(f"✅ Open games endpoint working, {data['count']} games found")
    
    def test_player_stats(self, auth_headers):
        """Test /api/photo-game/stats returns player stats"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Stats endpoint failed: {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Stats should contain user_id"
        
        print(f"✅ Player stats endpoint working")
    
    def test_leaderboard_wins(self):
        """Test /api/photo-game/leaderboard/wins works without auth"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins?period=24h")
        
        assert response.status_code == 200, f"Leaderboard endpoint failed: {response.text}"
        
        data = response.json()
        assert "leaderboard" in data, "Response should contain 'leaderboard'"
        assert "period" in data, "Response should contain 'period'"
        
        print("✅ Leaderboard endpoint working")
    
    def test_xp_level_info(self):
        """Test /api/photo-game/xp-level-info returns level progression info"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        
        assert response.status_code == 200, f"XP level info endpoint failed: {response.text}"
        
        data = response.json()
        assert "xp_per_round" in data, "Should contain xp_per_round"
        assert "level_thresholds" in data, "Should contain level_thresholds"
        assert "stamina" in data, "Should contain stamina info"
        
        # Verify stamina config
        assert data["stamina"]["max"] == 24, "Max stamina should be 24"
        assert data["stamina"]["cost_win"] == 1, "Win cost should be 1"
        assert data["stamina"]["cost_loss"] == 2, "Loss cost should be 2"
        
        print("✅ XP level info endpoint working")
    
    def test_match_history(self, auth_headers):
        """Test /api/photo-game/match-history returns match history"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/match-history?limit=10",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Match history endpoint failed: {response.text}"
        
        data = response.json()
        assert "matches" in data, "Response should contain 'matches'"
        assert "count" in data, "Response should contain 'count'"
        
        print(f"✅ Match history endpoint working, {data['count']} matches found")


class TestPhotoGameConstants:
    """Test that photo_game.py has correct constants"""
    
    def test_config_constants_match(self):
        """Verify config endpoint values match backend constants"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        assert response.status_code == 200
        
        data = response.json()
        rps = data["rps_auction"]
        
        # These are the UPDATED values per user spec
        expected = {
            "starting_bankroll": 5_000_000,  # $5M base
            "starting_bankroll_with_advantage": 7_000_000,  # $7M with advantage
            "advantage_bonus": 2_000_000,  # $2M bonus (was $1M)
            "max_bid": 7_000_000,  # $7M max bid
            "choice_timeout_seconds": 10,  # 10 second timeout
        }
        
        for key, expected_val in expected.items():
            assert rps.get(key) == expected_val, \
                f"Expected {key}={expected_val}, got {rps.get(key)}"
        
        print("✅ All game constants verified correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
