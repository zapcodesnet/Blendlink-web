"""
PVP Matchmaking API Tests
Tests for the new PVP open games system:
- POST /api/photo-game/open-games/create - Create open game
- GET /api/photo-game/open-games - List open games
- GET /api/photo-game/open-games/{game_id} - Get game details
- POST /api/photo-game/open-games/join - Join open game
- POST /api/photo-game/open-games/ready - Mark player ready
- DELETE /api/photo-game/open-games/{game_id} - Cancel game
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test session token (created via mongosh)
TEST_SESSION_TOKEN = None
TEST_USER_ID = None

class TestPVPMatchmakingSetup:
    """Setup tests - verify auth and create test data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        global TEST_SESSION_TOKEN, TEST_USER_ID
        
        # Create test user and session via API or use existing
        # For now, we'll test with the session created earlier
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            var session = db.user_sessions.findOne({}, {}, {sort: {created_at: -1}});
            if (session) {
                print(JSON.stringify({token: session.session_token, user_id: session.user_id}));
            }
            '''
        ], capture_output=True, text=True)
        
        try:
            import json
            data = json.loads(result.stdout.strip())
            TEST_SESSION_TOKEN = data.get('token')
            TEST_USER_ID = data.get('user_id')
        except:
            pass
    
    def test_base_url_configured(self):
        """Verify BASE_URL is configured"""
        assert BASE_URL, "REACT_APP_BACKEND_URL must be set"
        print(f"Testing against: {BASE_URL}")


class TestGameConfig:
    """Test game configuration endpoint"""
    
    def test_get_game_config(self):
        """GET /api/photo-game/config - Get game configuration"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "max_stamina" in data
        assert "required_photos" in data
        assert data["required_photos"] == 5, "Should require exactly 5 photos"
        print(f"Game config: max_stamina={data['max_stamina']}, required_photos={data['required_photos']}")


class TestOpenGamesAPI:
    """Test Open Games CRUD operations"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers with session token"""
        # Get latest session token
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            var session = db.user_sessions.findOne({}, {}, {sort: {created_at: -1}});
            if (session) print(session.session_token);
            '''
        ], capture_output=True, text=True)
        token = result.stdout.strip()
        
        if not token:
            pytest.skip("No session token available")
        
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def test_list_open_games_requires_auth(self):
        """GET /api/photo-game/open-games - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/photo-game/open-games")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Open games list correctly requires authentication")
    
    def test_list_open_games_with_auth(self, auth_headers):
        """GET /api/photo-game/open-games - List open games with auth"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/open-games",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "games" in data
        assert "count" in data
        assert isinstance(data["games"], list)
        print(f"Found {data['count']} open games")
    
    def test_create_open_game_requires_5_photos(self, auth_headers):
        """POST /api/photo-game/open-games/create - Should require exactly 5 photos"""
        # Try with less than 5 photos
        response = requests.post(
            f"{BASE_URL}/api/photo-game/open-games/create",
            headers=auth_headers,
            json={
                "photo_ids": ["photo1", "photo2"],  # Only 2 photos
                "bet_amount": 0,
                "is_bot_allowed": False
            }
        )
        
        # Should fail validation
        assert response.status_code in [400, 422], f"Expected 400/422 for invalid photo count, got {response.status_code}"
        print("Create game correctly validates photo count")
    
    def test_create_open_game_validates_photo_ownership(self, auth_headers):
        """POST /api/photo-game/open-games/create - Should validate photo ownership"""
        # Try with fake photo IDs
        response = requests.post(
            f"{BASE_URL}/api/photo-game/open-games/create",
            headers=auth_headers,
            json={
                "photo_ids": ["fake1", "fake2", "fake3", "fake4", "fake5"],
                "bet_amount": 0,
                "is_bot_allowed": False
            }
        )
        
        # Should fail because photos don't exist
        assert response.status_code in [400, 404], f"Expected 400/404 for non-existent photos, got {response.status_code}"
        print("Create game correctly validates photo ownership")
    
    def test_join_game_requires_auth(self):
        """POST /api/photo-game/open-games/join - Should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/open-games/join",
            json={
                "game_id": "test_game",
                "photo_ids": ["p1", "p2", "p3", "p4", "p5"]
            }
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Join game correctly requires authentication")
    
    def test_join_nonexistent_game(self, auth_headers):
        """POST /api/photo-game/open-games/join - Should fail for non-existent game"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/open-games/join",
            headers=auth_headers,
            json={
                "game_id": "nonexistent_game_12345",
                "photo_ids": ["p1", "p2", "p3", "p4", "p5"]
            }
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent game, got {response.status_code}"
        print("Join game correctly returns 404 for non-existent game")
    
    def test_ready_requires_auth(self):
        """POST /api/photo-game/open-games/ready - Should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/open-games/ready",
            json={"game_id": "test_game"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Ready endpoint correctly requires authentication")
    
    def test_get_game_details_requires_auth(self):
        """GET /api/photo-game/open-games/{game_id} - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/photo-game/open-games/test_game_id")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Get game details correctly requires authentication")
    
    def test_get_nonexistent_game_details(self, auth_headers):
        """GET /api/photo-game/open-games/{game_id} - Should return 404 for non-existent game"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/open-games/nonexistent_game_xyz",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent game, got {response.status_code}"
        print("Get game details correctly returns 404 for non-existent game")
    
    def test_cancel_game_requires_auth(self):
        """DELETE /api/photo-game/open-games/{game_id} - Should require authentication"""
        response = requests.delete(f"{BASE_URL}/api/photo-game/open-games/test_game_id")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Cancel game correctly requires authentication")


class TestBattlePhotosAPI:
    """Test battle photos endpoint"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers with session token"""
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            var session = db.user_sessions.findOne({}, {}, {sort: {created_at: -1}});
            if (session) print(session.session_token);
            '''
        ], capture_output=True, text=True)
        token = result.stdout.strip()
        
        if not token:
            pytest.skip("No session token available")
        
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def test_get_battle_photos_requires_auth(self):
        """GET /api/photo-game/battle-photos - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Battle photos correctly requires authentication")
    
    def test_get_battle_photos_with_auth(self, auth_headers):
        """GET /api/photo-game/battle-photos - Get user's battle-ready photos"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "photos" in data
        assert "count" in data
        assert "available_count" in data
        print(f"User has {data['count']} photos, {data['available_count']} available for battle")


class TestPhotoStaminaAPI:
    """Test photo stamina endpoint"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers with session token"""
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            var session = db.user_sessions.findOne({}, {}, {sort: {created_at: -1}});
            if (session) print(session.session_token);
            '''
        ], capture_output=True, text=True)
        token = result.stdout.strip()
        
        if not token:
            pytest.skip("No session token available")
        
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def test_get_photo_stamina_requires_auth(self):
        """GET /api/photo-game/photo-stamina/{mint_id} - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/photo-game/photo-stamina/test_mint_id")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Photo stamina correctly requires authentication")
    
    def test_get_nonexistent_photo_stamina(self, auth_headers):
        """GET /api/photo-game/photo-stamina/{mint_id} - Should return 404 for non-existent photo"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/photo-stamina/nonexistent_photo_xyz",
            headers=auth_headers
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent photo, got {response.status_code}"
        print("Photo stamina correctly returns 404 for non-existent photo")


class TestLeaderboardAPI:
    """Test leaderboard endpoints"""
    
    def test_get_wins_leaderboard(self):
        """GET /api/photo-game/leaderboard/wins - Get wins leaderboard (public)"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "leaderboard" in data
        assert "period" in data
        print(f"Leaderboard period: {data['period']}, entries: {len(data['leaderboard'])}")
    
    def test_get_wins_leaderboard_with_period(self):
        """GET /api/photo-game/leaderboard/wins?period=7d - Get weekly leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins?period=7d")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["period"] == "7d"
        print(f"Weekly leaderboard entries: {len(data['leaderboard'])}")
    
    def test_get_wins_leaderboard_invalid_period(self):
        """GET /api/photo-game/leaderboard/wins?period=invalid - Should reject invalid period"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins?period=invalid")
        
        assert response.status_code == 400, f"Expected 400 for invalid period, got {response.status_code}"
        print("Leaderboard correctly rejects invalid period")
    
    def test_get_photos_leaderboard(self):
        """GET /api/photo-game/leaderboard/photos - Get photos leaderboard (public)"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/photos")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "leaderboard" in data
        print(f"Photos leaderboard entries: {len(data['leaderboard'])}")


class TestPVPMatchmakingAPI:
    """Test PVP matchmaking endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers with session token"""
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            var session = db.user_sessions.findOne({}, {}, {sort: {created_at: -1}});
            if (session) print(session.session_token);
            '''
        ], capture_output=True, text=True)
        token = result.stdout.strip()
        
        if not token:
            pytest.skip("No session token available")
        
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def test_find_match_requires_auth(self):
        """POST /api/photo-game/pvp/find-match - Should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/find-match",
            json={"bet_amount": 0}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Find match correctly requires authentication")
    
    def test_match_status_requires_auth(self):
        """GET /api/photo-game/pvp/match-status - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/photo-game/pvp/match-status")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Match status correctly requires authentication")
    
    def test_cancel_matchmaking_requires_auth(self):
        """POST /api/photo-game/pvp/cancel - Should require authentication"""
        response = requests.post(f"{BASE_URL}/api/photo-game/pvp/cancel")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Cancel matchmaking correctly requires authentication")
    
    def test_queue_status_public(self):
        """GET /api/photo-game/pvp/queue-status - Get queue status (public)"""
        response = requests.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "players_waiting" in data or "active_matches" in data
        print(f"Queue status: {data}")


class TestGameStatsAPI:
    """Test game stats endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get auth headers with session token"""
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            var session = db.user_sessions.findOne({}, {}, {sort: {created_at: -1}});
            if (session) print(session.session_token);
            '''
        ], capture_output=True, text=True)
        token = result.stdout.strip()
        
        if not token:
            pytest.skip("No session token available")
        
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def test_get_my_stats_requires_auth(self):
        """GET /api/photo-game/stats - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/photo-game/stats")
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("Get my stats correctly requires authentication")
    
    def test_get_my_stats_with_auth(self, auth_headers):
        """GET /api/photo-game/stats - Get current user's stats"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Stats should have some basic fields
        print(f"User stats: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
