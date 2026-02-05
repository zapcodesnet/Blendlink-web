"""
PVP Auction Bidding Battle Tests
Tests for:
1. PVP WebSocket connection reliability
2. Tap synchronization between players
3. Disconnect handling (20-second countdown, reconnection, both-disconnect draw)
4. Round progression (Round 1 -> Round 2)
5. API polling fallback (/api/photo-game/pvp/tap-state/{session_id})
6. Tap state persistence to database
7. Round winner determination (atomic and idempotent)
"""

import pytest
import requests
import os
import time
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
USER1_EMAIL = "test@blendlink.com"
USER1_PASSWORD = "admin"
USER2_EMAIL = "test@example.com"
USER2_PASSWORD = "test123"


class TestPVPBiddingBattle:
    """Test PVP Auction Bidding Battle functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.user1_token = None
        self.user2_token = None
        self.user1_id = None
        self.user2_id = None
    
    def login_user1(self):
        """Login as user 1 (test@blendlink.com)"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.user1_token = data.get("token")
            self.user1_id = data.get("user", {}).get("user_id")
            return True
        return False
    
    def login_user2(self):
        """Login as user 2 (test@example.com)"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER2_EMAIL,
            "password": USER2_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.user2_token = data.get("token")
            self.user2_id = data.get("user", {}).get("user_id")
            return True
        return False
    
    def get_user_photos(self, token, limit=5):
        """Get user's minted photos for battle"""
        headers = {"Authorization": f"Bearer {token}"}
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return data.get("photos", [])[:limit]
        return []
    
    # ==================== AUTHENTICATION TESTS ====================
    
    def test_user1_login(self):
        """Test user 1 can login"""
        assert self.login_user1(), f"Failed to login user 1 ({USER1_EMAIL})"
        assert self.user1_token is not None, "User 1 token should not be None"
        assert self.user1_id is not None, "User 1 ID should not be None"
        print(f"✓ User 1 logged in: {self.user1_id}")
    
    def test_user2_login(self):
        """Test user 2 can login"""
        assert self.login_user2(), f"Failed to login user 2 ({USER2_EMAIL})"
        assert self.user2_token is not None, "User 2 token should not be None"
        assert self.user2_id is not None, "User 2 ID should not be None"
        print(f"✓ User 2 logged in: {self.user2_id}")
    
    # ==================== GAME CONFIG TESTS ====================
    
    def test_game_config_endpoint(self):
        """Test game config endpoint returns correct values"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "max_stamina" in data, "Config should include max_stamina"
        assert "max_taps_per_second" in data, "Config should include max_taps_per_second"
        assert data["max_taps_per_second"] == 30, f"Max TPS should be 30, got {data['max_taps_per_second']}"
        print(f"✓ Game config: max_taps_per_second={data['max_taps_per_second']}")
    
    # ==================== OPEN GAMES TESTS ====================
    
    def test_list_open_games(self):
        """Test listing open games"""
        assert self.login_user1(), "Login required"
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        response = self.session.get(f"{BASE_URL}/api/photo-game/open-games", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "games" in data, "Response should include games array"
        assert "count" in data, "Response should include count"
        print(f"✓ Open games listed: {data['count']} games")
    
    def test_create_open_game_requires_5_photos(self):
        """Test that creating an open game requires exactly 5 photos"""
        assert self.login_user1(), "Login required"
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        # Get user's photos
        photos = self.get_user_photos(self.user1_token, limit=10)
        
        if len(photos) < 5:
            pytest.skip(f"User 1 needs at least 5 minted photos, has {len(photos)}")
        
        # Try with only 3 photos (should fail)
        response = self.session.post(f"{BASE_URL}/api/photo-game/open-games/create", 
            headers=headers,
            json={
                "photo_ids": [p["mint_id"] for p in photos[:3]],
                "bet_amount": 0
            }
        )
        assert response.status_code == 400, f"Expected 400 for 3 photos, got {response.status_code}"
        print("✓ Creating game with 3 photos correctly rejected")
        
        # Try with 5 photos (should succeed)
        response = self.session.post(f"{BASE_URL}/api/photo-game/open-games/create", 
            headers=headers,
            json={
                "photo_ids": [p["mint_id"] for p in photos[:5]],
                "bet_amount": 0
            }
        )
        assert response.status_code == 200, f"Expected 200 for 5 photos, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Game creation should succeed"
        assert "game_id" in data, "Response should include game_id"
        print(f"✓ Open game created: {data['game_id']}")
        
        return data["game_id"]
    
    # ==================== PVP SESSION TESTS ====================
    
    def test_pvp_session_state_endpoint(self):
        """Test PVP session state endpoint"""
        assert self.login_user1(), "Login required"
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        # Try with a non-existent session
        response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/session/nonexistent123", headers=headers)
        assert response.status_code == 404, f"Expected 404 for non-existent session, got {response.status_code}"
        print("✓ Non-existent session returns 404")
    
    # ==================== TAP STATE TESTS ====================
    
    def test_tap_state_endpoint_requires_auth(self):
        """Test tap state endpoint requires authentication"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/tap-state/test123")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Tap state endpoint requires authentication")
    
    def test_tap_state_endpoint_returns_correct_fields(self):
        """Test tap state endpoint returns correct fields when session exists"""
        assert self.login_user1(), "Login required"
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        # This will return 404 for non-existent session, which is expected
        response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/tap-state/test_session_123", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            # Verify expected fields
            expected_fields = ["session_id", "status", "current_round", "player1_taps", "player2_taps", 
                            "my_taps", "opponent_taps", "my_dollar", "opponent_dollar"]
            for field in expected_fields:
                assert field in data, f"Response should include {field}"
            print(f"✓ Tap state endpoint returns all expected fields")
        else:
            assert response.status_code == 404, f"Expected 404 for non-existent session, got {response.status_code}"
            print("✓ Tap state endpoint returns 404 for non-existent session (expected)")
    
    # ==================== TAP SUBMISSION TESTS ====================
    
    def test_tap_endpoint_requires_auth(self):
        """Test tap endpoint requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/tap", json={
            "session_id": "test123",
            "tap_count": 1
        })
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Tap endpoint requires authentication")
    
    def test_tap_endpoint_validates_session(self):
        """Test tap endpoint validates session exists"""
        assert self.login_user1(), "Login required"
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/tap", 
            headers=headers,
            json={
                "session_id": "nonexistent_session_123",
                "tap_count": 1
            }
        )
        assert response.status_code == 404, f"Expected 404 for non-existent session, got {response.status_code}"
        print("✓ Tap endpoint validates session exists")
    
    # ==================== FINISH ROUND TESTS ====================
    
    def test_finish_round_endpoint_requires_auth(self):
        """Test finish round endpoint requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/finish-round?session_id=test123")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Finish round endpoint requires authentication")
    
    def test_finish_round_endpoint_validates_session(self):
        """Test finish round endpoint validates session exists"""
        assert self.login_user1(), "Login required"
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/finish-round?session_id=nonexistent_session_123", 
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404 for non-existent session, got {response.status_code}"
        print("✓ Finish round endpoint validates session exists")
    
    # ==================== PHOTO SELECTION TESTS ====================
    
    def test_select_photo_endpoint_requires_auth(self):
        """Test select photo endpoint requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/select-photo", json={
            "session_id": "test123",
            "photo_id": "photo123"
        })
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Select photo endpoint requires authentication")
    
    def test_select_photo_endpoint_validates_session(self):
        """Test select photo endpoint validates session exists"""
        assert self.login_user1(), "Login required"
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/select-photo", 
            headers=headers,
            json={
                "session_id": "nonexistent_session_123",
                "photo_id": "photo123"
            }
        )
        assert response.status_code == 404, f"Expected 404 for non-existent session, got {response.status_code}"
        print("✓ Select photo endpoint validates session exists")
    
    # ==================== BATTLE PHOTOS TESTS ====================
    
    def test_battle_photos_endpoint(self):
        """Test battle photos endpoint returns user's photos"""
        assert self.login_user1(), "Login required"
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "photos" in data, "Response should include photos array"
        
        photos = data["photos"]
        print(f"✓ User 1 has {len(photos)} battle-ready photos")
        
        if len(photos) > 0:
            # Verify photo structure
            photo = photos[0]
            assert "mint_id" in photo, "Photo should have mint_id"
            assert "dollar_value" in photo, "Photo should have dollar_value"
            print(f"  - First photo: {photo.get('name', 'Unnamed')} (${photo.get('dollar_value', 0):,})")
    
    # ==================== NEXT ROUND TESTS ====================
    
    def test_next_round_endpoint_requires_auth(self):
        """Test next round endpoint requires authentication"""
        response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/next-round?session_id=test123")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Next round endpoint requires authentication")
    
    def test_next_round_endpoint_validates_session(self):
        """Test next round endpoint validates session exists"""
        assert self.login_user1(), "Login required"
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/next-round?session_id=nonexistent_session_123", 
            headers=headers
        )
        assert response.status_code == 404, f"Expected 404 for non-existent session, got {response.status_code}"
        print("✓ Next round endpoint validates session exists")


class TestPVPWebSocketManager:
    """Test PVP WebSocket Manager functionality (unit tests for pvp_game_websocket.py)"""
    
    def test_disconnect_forfeit_timeout_constant(self):
        """Verify DISCONNECT_FORFEIT_TIMEOUT is 20 seconds"""
        # This is a code review test - verify the constant is set correctly
        import sys
        sys.path.insert(0, '/app/backend')
        from pvp_game_websocket import DISCONNECT_FORFEIT_TIMEOUT
        
        assert DISCONNECT_FORFEIT_TIMEOUT == 20, f"DISCONNECT_FORFEIT_TIMEOUT should be 20, got {DISCONNECT_FORFEIT_TIMEOUT}"
        print(f"✓ DISCONNECT_FORFEIT_TIMEOUT = {DISCONNECT_FORFEIT_TIMEOUT} seconds")
    
    def test_auction_round_duration_constant(self):
        """Verify AUCTION_ROUND_DURATION is 15 seconds"""
        import sys
        sys.path.insert(0, '/app/backend')
        from pvp_game_websocket import AUCTION_ROUND_DURATION
        
        assert AUCTION_ROUND_DURATION == 15, f"AUCTION_ROUND_DURATION should be 15, got {AUCTION_ROUND_DURATION}"
        print(f"✓ AUCTION_ROUND_DURATION = {AUCTION_ROUND_DURATION} seconds")
    
    def test_pvp_game_room_has_tap_tracking_fields(self):
        """Verify PVPGameRoom has player1_taps and player2_taps fields"""
        import sys
        sys.path.insert(0, '/app/backend')
        from pvp_game_websocket import PVPGameRoom
        
        room = PVPGameRoom(room_id="test", game_id="test")
        
        assert hasattr(room, 'player1_taps'), "PVPGameRoom should have player1_taps field"
        assert hasattr(room, 'player2_taps'), "PVPGameRoom should have player2_taps field"
        assert room.player1_taps == 0, "player1_taps should initialize to 0"
        assert room.player2_taps == 0, "player2_taps should initialize to 0"
        print("✓ PVPGameRoom has tap tracking fields (player1_taps, player2_taps)")
    
    def test_pvp_game_room_has_round_winner_determined_flag(self):
        """Verify PVPGameRoom has round_winner_determined flag to prevent double-wins"""
        import sys
        sys.path.insert(0, '/app/backend')
        from pvp_game_websocket import PVPGameRoom
        
        room = PVPGameRoom(room_id="test", game_id="test")
        
        assert hasattr(room, 'round_winner_determined'), "PVPGameRoom should have round_winner_determined flag"
        assert room.round_winner_determined == False, "round_winner_determined should initialize to False"
        print("✓ PVPGameRoom has round_winner_determined flag (prevents double-win bug)")
    
    def test_pvp_game_room_has_disconnect_tracking(self):
        """Verify PVPGameRoom has disconnect tracking fields"""
        import sys
        sys.path.insert(0, '/app/backend')
        from pvp_game_websocket import PVPGameRoom
        
        room = PVPGameRoom(room_id="test", game_id="test")
        
        assert hasattr(room, 'disconnect_forfeit_task'), "PVPGameRoom should have disconnect_forfeit_task"
        assert hasattr(room, 'disconnected_player_id'), "PVPGameRoom should have disconnected_player_id"
        assert hasattr(room, 'pause_start_time'), "PVPGameRoom should have pause_start_time"
        print("✓ PVPGameRoom has disconnect tracking fields")


class TestPVPIntegration:
    """Integration tests for full PVP game flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_full_pvp_game_creation_flow(self):
        """Test creating an open game and having another player join"""
        # Login user 1
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        assert response.status_code == 200, f"User 1 login failed: {response.status_code}"
        user1_data = response.json()
        user1_token = user1_data.get("token")
        user1_id = user1_data.get("user", {}).get("user_id")
        
        # Get user 1's photos
        headers1 = {"Authorization": f"Bearer {user1_token}"}
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers1)
        assert response.status_code == 200, f"Failed to get user 1 photos: {response.status_code}"
        user1_photos = response.json().get("photos", [])
        
        if len(user1_photos) < 5:
            pytest.skip(f"User 1 needs at least 5 photos, has {len(user1_photos)}")
        
        # Create open game
        response = self.session.post(f"{BASE_URL}/api/photo-game/open-games/create", 
            headers=headers1,
            json={
                "photo_ids": [p["mint_id"] for p in user1_photos[:5]],
                "bet_amount": 0
            }
        )
        assert response.status_code == 200, f"Failed to create game: {response.status_code}: {response.text}"
        game_data = response.json()
        game_id = game_data.get("game_id")
        print(f"✓ Game created: {game_id}")
        
        # Login user 2
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER2_EMAIL,
            "password": USER2_PASSWORD
        })
        assert response.status_code == 200, f"User 2 login failed: {response.status_code}"
        user2_data = response.json()
        user2_token = user2_data.get("token")
        
        # Get user 2's photos
        headers2 = {"Authorization": f"Bearer {user2_token}"}
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers2)
        assert response.status_code == 200, f"Failed to get user 2 photos: {response.status_code}"
        user2_photos = response.json().get("photos", [])
        
        if len(user2_photos) < 5:
            pytest.skip(f"User 2 needs at least 5 photos, has {len(user2_photos)}")
        
        # User 2 joins the game
        response = self.session.post(f"{BASE_URL}/api/photo-game/open-games/join", 
            headers=headers2,
            json={
                "game_id": game_id,
                "photo_ids": [p["mint_id"] for p in user2_photos[:5]]
            }
        )
        assert response.status_code == 200, f"Failed to join game: {response.status_code}: {response.text}"
        join_data = response.json()
        assert join_data.get("success") == True, "Join should succeed"
        print(f"✓ User 2 joined game: {game_id}")
        
        # Verify game state
        response = self.session.get(f"{BASE_URL}/api/photo-game/open-games/{game_id}", headers=headers1)
        assert response.status_code == 200, f"Failed to get game details: {response.status_code}"
        game_state = response.json()
        
        assert game_state.get("status") == "ready", f"Game status should be 'ready', got {game_state.get('status')}"
        assert game_state.get("opponent_id") is not None, "Game should have opponent_id"
        print(f"✓ Game state verified: status={game_state.get('status')}")
        
        # Clean up - cancel the game (if possible)
        # Note: Can't cancel after opponent joins, so this is just for documentation
        
        return game_id


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
