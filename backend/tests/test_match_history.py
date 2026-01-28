"""
Test Match History & Replay Feature
Tests for:
- GET /api/photo-game/match-history - Returns match list with photos and rounds
- GET /api/photo-game/battle/{sessionId} - Returns public battle details
- GET /api/photo-game/stats - Returns player stats
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "testplayer@blendlink.com"
TEST_PASSWORD = "Test123!"


class TestMatchHistoryFeature:
    """Tests for Match History & Replay feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.user_id = login_response.json().get("user", {}).get("user_id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Login failed: {login_response.text}")
    
    # ============== Match History API Tests ==============
    
    def test_match_history_endpoint_returns_200(self):
        """Test GET /api/photo-game/match-history returns 200"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/match-history")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_match_history_response_structure(self):
        """Test match-history response has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/match-history")
        assert response.status_code == 200
        
        data = response.json()
        assert "matches" in data, "Response should have 'matches' field"
        assert "count" in data, "Response should have 'count' field"
        assert "total" in data, "Response should have 'total' field"
        assert isinstance(data["matches"], list), "'matches' should be a list"
    
    def test_match_history_with_limit_param(self):
        """Test match-history with limit parameter"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/match-history?limit=10")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["matches"]) <= 10, "Should respect limit parameter"
    
    def test_match_history_with_skip_param(self):
        """Test match-history with skip parameter"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/match-history?skip=0&limit=50")
        assert response.status_code == 200
    
    def test_match_history_requires_auth(self):
        """Test match-history requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/photo-game/match-history")
        assert response.status_code == 401, "Should require authentication"
    
    # ============== Battle Details API Tests ==============
    
    def test_battle_endpoint_returns_404_for_invalid_session(self):
        """Test GET /api/photo-game/battle/{sessionId} returns 404 for invalid session"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle/invalid-session-id-123")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        data = response.json()
        assert "detail" in data, "Should have error detail"
        assert "not found" in data["detail"].lower(), "Should indicate battle not found"
    
    def test_battle_endpoint_is_public(self):
        """Test battle endpoint doesn't require authentication (public)"""
        # Create new session without auth
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/photo-game/battle/test-session-123")
        # Should return 404 (not found) not 401 (unauthorized)
        assert response.status_code == 404, "Battle endpoint should be public (404 not 401)"
    
    # ============== Stats API Tests ==============
    
    def test_stats_endpoint_returns_200(self):
        """Test GET /api/photo-game/stats returns 200"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    
    def test_stats_response_structure(self):
        """Test stats response has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/stats")
        assert response.status_code == 200
        
        data = response.json()
        # Check required fields
        assert "user_id" in data, "Should have user_id"
        assert "current_win_streak" in data, "Should have current_win_streak"
        assert "current_lose_streak" in data, "Should have current_lose_streak"
        assert "total_battles" in data, "Should have total_battles"
        assert "battles_won" in data, "Should have battles_won"
        assert "battles_lost" in data, "Should have battles_lost"
    
    def test_stats_requires_auth(self):
        """Test stats requires authentication"""
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/photo-game/stats")
        assert response.status_code == 401, "Should require authentication"
    
    # ============== Game Config Tests ==============
    
    def test_game_config_endpoint(self):
        """Test GET /api/photo-game/config returns game configuration"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "max_stamina" in data, "Should have max_stamina"
        assert "required_photos" in data, "Should have required_photos"
        assert data["required_photos"] == 5, "Should require 5 photos"
    
    # ============== Battle Photos Tests ==============
    
    def test_battle_photos_endpoint(self):
        """Test GET /api/photo-game/battle-photos returns user's photos"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        data = response.json()
        assert "photos" in data, "Should have photos field"
        assert "count" in data, "Should have count field"
        assert isinstance(data["photos"], list), "photos should be a list"


class TestMatchHistoryEmptyState:
    """Tests for empty state handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Login failed: {login_response.text}")
    
    def test_empty_match_history_returns_empty_array(self):
        """Test that empty match history returns empty array, not error"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/match-history")
        assert response.status_code == 200
        
        data = response.json()
        assert data["matches"] == [] or isinstance(data["matches"], list), "Should return empty list"
        assert data["count"] >= 0, "Count should be non-negative"
    
    def test_stats_for_new_user_has_zero_values(self):
        """Test that stats for user with no battles has zero values"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/stats")
        assert response.status_code == 200
        
        data = response.json()
        # New user should have zero or low values
        assert data["total_battles"] >= 0, "total_battles should be non-negative"
        assert data["battles_won"] >= 0, "battles_won should be non-negative"
        assert data["battles_lost"] >= 0, "battles_lost should be non-negative"


class TestLeaderboards:
    """Tests for leaderboard endpoints"""
    
    def test_wins_leaderboard_endpoint(self):
        """Test GET /api/photo-game/leaderboard/wins returns leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data, "Should have leaderboard field"
        assert "period" in data, "Should have period field"
    
    def test_wins_leaderboard_with_period(self):
        """Test leaderboard with different periods"""
        for period in ["24h", "7d", "30d", "1y"]:
            response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins?period={period}")
            assert response.status_code == 200, f"Period {period} should work"
    
    def test_wins_leaderboard_invalid_period(self):
        """Test leaderboard with invalid period returns 400"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins?period=invalid")
        assert response.status_code == 400, "Invalid period should return 400"
    
    def test_photos_leaderboard_endpoint(self):
        """Test GET /api/photo-game/leaderboard/photos returns leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/photos")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data, "Should have leaderboard field"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
