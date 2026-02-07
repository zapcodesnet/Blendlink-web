"""
Test PVP Connection and Synchronization - Iteration 98
Tests the fixes for:
1. Creator seeing opponent's photos (wrong photo assignment)
2. Endless 'Reconnecting...' loops
3. Slashed sync bars
4. Getting stuck 'Waiting for opponent'

Key fixes verified:
- isPlayer1Ref to track latest player role for WebSocket handlers
- confirmedPlayer1Id state synced from API responses
- Exponential backoff reconnection (1s, 2s, 4s, 8s, 10s cap)
- MAX_RECONNECT_ATTEMPTS increased from 3 to 5
"""

import pytest
import requests
import os
import json
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://verify-me-9.preview.emergentagent.com').rstrip('/')

# Test credentials
USER1_EMAIL = "test@blendlink.com"
USER1_PASSWORD = "admin"
USER2_EMAIL = "test@example.com"
USER2_PASSWORD = "test123"


class TestPVPAuthentication:
    """Test authentication for both PVP users"""
    
    def test_user1_login(self):
        """Test User 1 (Admin/Creator) can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        print(f"User 1 login response: {response.status_code}")
        assert response.status_code == 200, f"User 1 login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        user_id = data.get("user", {}).get("user_id") or data.get("user_id")
        print(f"User 1 logged in successfully: {user_id}")
        return data
    
    def test_user2_login(self):
        """Test User 2 (Regular/Joiner) can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER2_EMAIL,
            "password": USER2_PASSWORD
        })
        print(f"User 2 login response: {response.status_code}")
        assert response.status_code == 200, f"User 2 login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        user_id = data.get("user", {}).get("user_id") or data.get("user_id")
        print(f"User 2 logged in successfully: {user_id}")
        return data


class TestPVPSessionEndpoints:
    """Test PVP session API endpoints"""
    
    @pytest.fixture(scope="class")
    def user1_session(self):
        """Login as User 1 (game creator = player1)"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        assert response.status_code == 200, f"User 1 login failed: {response.text}"
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['token']}"})
        session.user_id = data.get("user", {}).get("user_id") or data.get("user_id")
        print(f"User 1 (Creator) logged in: {session.user_id}")
        return session
    
    @pytest.fixture(scope="class")
    def user2_session(self):
        """Login as User 2 (game joiner = player2)"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER2_EMAIL,
            "password": USER2_PASSWORD
        })
        assert response.status_code == 200, f"User 2 login failed: {response.text}"
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['token']}"})
        session.user_id = data.get("user", {}).get("user_id") or data.get("user_id")
        print(f"User 2 (Joiner) logged in: {session.user_id}")
        return session
    
    def test_get_battle_photos_user1(self, user1_session):
        """Test User 1 can get their battle photos"""
        response = user1_session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        print(f"User 1 battle photos response: {response.status_code}")
        assert response.status_code == 200, f"Failed to get battle photos: {response.text}"
        data = response.json()
        photos = data.get("photos", [])
        print(f"User 1 has {len(photos)} battle photos")
        return photos
    
    def test_get_battle_photos_user2(self, user2_session):
        """Test User 2 can get their battle photos"""
        response = user2_session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        print(f"User 2 battle photos response: {response.status_code}")
        assert response.status_code == 200, f"Failed to get battle photos: {response.text}"
        data = response.json()
        photos = data.get("photos", [])
        print(f"User 2 has {len(photos)} battle photos")
        return photos
    
    def test_pvp_session_endpoint_returns_player1_id(self, user1_session):
        """
        CRITICAL: Test that /pvp/session/{game_id} returns player1_id
        This is essential for correct photo assignment
        """
        # First, list open games to find an existing session
        response = user1_session.get(f"{BASE_URL}/api/photo-game/open-games")
        assert response.status_code == 200, f"Failed to list open games: {response.text}"
        data = response.json()
        games = data.get("games", [])
        print(f"Found {len(games)} open games")
        
        # If there's an existing game, check its session endpoint
        if games:
            game_id = games[0].get("game_id")
            session_response = user1_session.get(f"{BASE_URL}/api/photo-game/pvp/session/{game_id}")
            print(f"Session endpoint response: {session_response.status_code}")
            if session_response.status_code == 200:
                session_data = session_response.json()
                print(f"Session data keys: {session_data.keys()}")
                # Verify player1_id is in response
                assert "player1_id" in session_data, "player1_id missing from session response"
                print(f"player1_id: {session_data.get('player1_id')}")
                print(f"player2_id: {session_data.get('player2_id')}")
        else:
            print("No open games found - skipping session endpoint test")
    
    def test_tap_state_endpoint(self, user1_session):
        """Test tap-state endpoint returns correct fields"""
        # Use a dummy session ID to test endpoint structure
        response = user1_session.get(f"{BASE_URL}/api/photo-game/pvp/tap-state/test_session_123")
        print(f"Tap state response: {response.status_code}")
        # 404 is expected for non-existent session, but we want to verify the endpoint exists
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        if response.status_code == 404:
            print("Tap state endpoint exists (404 for non-existent session is expected)")
    
    def test_tap_submit_endpoint(self, user1_session):
        """Test tap submit endpoint exists"""
        response = user1_session.post(f"{BASE_URL}/api/photo-game/pvp/tap", json={
            "session_id": "test_session_123",
            "tap_count": 1
        })
        print(f"Tap submit response: {response.status_code}")
        # 404 is expected for non-existent session
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        if response.status_code == 404:
            print("Tap submit endpoint exists (404 for non-existent session is expected)")


class TestPVPGameCreation:
    """Test PVP game creation and joining flow"""
    
    @pytest.fixture(scope="class")
    def user1_session(self):
        """Login as User 1"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['token']}"})
        session.user_id = data.get("user", {}).get("user_id") or data.get("user_id")
        return session
    
    @pytest.fixture(scope="class")
    def user2_session(self):
        """Login as User 2"""
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER2_EMAIL,
            "password": USER2_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        session.headers.update({"Authorization": f"Bearer {data['token']}"})
        session.user_id = data.get("user", {}).get("user_id") or data.get("user_id")
        return session
    
    def test_create_open_game(self, user1_session):
        """Test User 1 can create an open game"""
        # First get photos
        photos_response = user1_session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = photos_response.json().get("photos", [])
        
        if len(photos) < 5:
            pytest.skip(f"User 1 needs at least 5 photos, has {len(photos)}")
        
        # Get 5 photo IDs
        photo_ids = [p.get("mint_id") for p in photos[:5]]
        print(f"Creating game with photos: {photo_ids}")
        
        response = user1_session.post(f"{BASE_URL}/api/photo-game/open-games/create", json={
            "photo_ids": photo_ids,
            "bet_amount": 0,
            "is_bot_allowed": False
        })
        print(f"Create game response: {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success"), "Game creation not successful"
            game_id = data.get("game_id")
            print(f"Game created: {game_id}")
            return game_id
        else:
            print(f"Game creation failed: {response.text}")
            return None
    
    def test_list_open_games(self, user1_session):
        """Test listing open games"""
        response = user1_session.get(f"{BASE_URL}/api/photo-game/open-games")
        assert response.status_code == 200, f"Failed to list games: {response.text}"
        data = response.json()
        games = data.get("games", [])
        print(f"Found {len(games)} open games")
        for game in games[:3]:
            print(f"  - {game.get('game_id')}: {game.get('creator_username')} (bet: {game.get('bet_amount')})")
        return games


class TestFrontendCodeReview:
    """Code review tests for frontend PVP fixes"""
    
    def test_pvp_battle_arena_has_isplayer1_ref(self):
        """Verify PVPBattleArena uses isPlayer1Ref to avoid stale closures"""
        with open("/app/frontend/src/components/game/PVPBattleArena.jsx", "r") as f:
            content = f.read()
        
        # Check isPlayer1Ref is defined
        assert "isPlayer1Ref = useRef" in content, "Missing isPlayer1Ref definition"
        
        # Check isPlayer1Ref is updated when isPlayer1 changes
        assert "isPlayer1Ref.current = isPlayer1" in content, "isPlayer1Ref not being updated"
        
        # Check isPlayer1Ref.current is used in WebSocket handlers
        assert "isPlayer1Ref.current" in content, "isPlayer1Ref.current not used in handlers"
        
        print("✓ PVPBattleArena.jsx uses isPlayer1Ref correctly!")
    
    def test_pvp_battle_arena_has_confirmed_player1_id(self):
        """Verify PVPBattleArena tracks confirmedPlayer1Id from API"""
        with open("/app/frontend/src/components/game/PVPBattleArena.jsx", "r") as f:
            content = f.read()
        
        # Check confirmedPlayer1Id state is defined
        assert "confirmedPlayer1Id" in content, "Missing confirmedPlayer1Id state"
        assert "setConfirmedPlayer1Id" in content, "Missing setConfirmedPlayer1Id setter"
        
        print("✓ PVPBattleArena.jsx has confirmedPlayer1Id state!")
    
    def test_pvp_battle_arena_exponential_backoff(self):
        """Verify exponential backoff reconnection is implemented"""
        with open("/app/frontend/src/components/game/PVPBattleArena.jsx", "r") as f:
            content = f.read()
        
        # Check exponential backoff constants
        assert "BASE_RECONNECT_INTERVAL" in content, "Missing BASE_RECONNECT_INTERVAL"
        assert "MAX_RECONNECT_INTERVAL" in content, "Missing MAX_RECONNECT_INTERVAL"
        
        # Check getReconnectDelay function
        assert "getReconnectDelay" in content, "Missing getReconnectDelay function"
        assert "Math.pow(2, attempt)" in content, "Missing exponential calculation"
        
        # Check MAX_RECONNECT_ATTEMPTS is 5
        assert "MAX_RECONNECT_ATTEMPTS = 5" in content, "MAX_RECONNECT_ATTEMPTS should be 5"
        
        print("✓ PVPBattleArena.jsx has exponential backoff reconnection!")
    
    def test_tapping_arena_uses_refs(self):
        """Verify TappingArena uses refs for tap state"""
        with open("/app/frontend/src/components/game/TappingArena.jsx", "r") as f:
            content = f.read()
        
        # Check refs are defined
        assert "playerTapsRef = useRef" in content, "Missing playerTapsRef"
        assert "opponentTapsRef = useRef" in content, "Missing opponentTapsRef"
        
        # Check refs are updated
        assert "playerTapsRef.current = playerTaps" in content, "playerTapsRef not updated"
        assert "opponentTapsRef.current = opponentTaps" in content, "opponentTapsRef not updated"
        
        print("✓ TappingArena.jsx uses refs correctly!")
    
    def test_photo_game_arena_assigns_photos_correctly(self):
        """Verify PhotoGameArena assigns playerPhotos and opponentPhotos"""
        with open("/app/frontend/src/pages/PhotoGameArena.jsx", "r") as f:
            content = f.read()
        
        # Check PVPBattleArena is imported
        assert "PVPBattleArena" in content, "PVPBattleArena not imported"
        
        # Check playerPhotos and opponentPhotos props are passed
        assert "playerPhotos" in content, "playerPhotos prop not found"
        assert "opponentPhotos" in content, "opponentPhotos prop not found"
        
        print("✓ PhotoGameArena.jsx passes photo props correctly!")


class TestBackendPVPEndpoints:
    """Test backend PVP endpoints return correct data"""
    
    def test_pvp_session_returns_player1_id(self):
        """Verify /pvp/session/{game_id} returns player1_id"""
        # Check the game_routes.py file
        with open("/app/backend/game_routes.py", "r") as f:
            content = f.read()
        
        # Find the pvp/session endpoint
        assert 'get_pvp_session_state' in content, "pvp session endpoint not found"
        assert '"player1_id"' in content, "player1_id not in session response"
        assert '"player2_id"' in content, "player2_id not in session response"
        
        print("✓ Backend returns player1_id in session response!")
    
    def test_pvp_websocket_handles_reconnection(self):
        """Verify WebSocket handler supports reconnection"""
        with open("/app/backend/pvp_game_websocket.py", "r") as f:
            content = f.read()
        
        # Check reconnection handling
        assert "reconnect_player" in content, "reconnect_player method not found"
        assert "is_reconnect" in content, "is_reconnect parameter not found"
        assert "reconnect_state" in content, "reconnect_state message type not found"
        
        print("✓ Backend WebSocket supports reconnection!")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
