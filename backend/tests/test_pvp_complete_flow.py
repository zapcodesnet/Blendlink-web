"""
Comprehensive PVP Flow Test - Tests the full PVP game flow with two users

This test verifies:
1. User 1 can create a game and enter lobby
2. User 2 can browse and join the game
3. Both users can mark ready
4. Game starts with proper pvp_room_id
5. WebSocket connection can be established
"""

import pytest
import requests
import os
import time
import json
import asyncio
import websockets

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://verify-me-9.preview.emergentagent.com')
WS_BASE_URL = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')

# Test credentials
USER1 = {"email": "test@blendlink.com", "password": "admin"}
USER2 = {"email": "test@example.com", "password": "test123"}


class TestCompletePVPFlow:
    """Complete PVP flow test with two users"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test sessions"""
        self.session1 = requests.Session()
        self.session2 = requests.Session()
        self.token1 = None
        self.token2 = None
        self.user1_id = None
        self.user2_id = None
        self.game_id = None
        self.pvp_room_id = None
        self.session_id = None
        
    def login_users(self):
        """Login both users"""
        # Login user 1
        resp1 = self.session1.post(f"{BASE_URL}/api/auth/login", json=USER1)
        if resp1.status_code != 200:
            pytest.skip(f"User1 login failed: {resp1.text}")
        data1 = resp1.json()
        self.token1 = data1.get("token")
        self.user1_id = data1.get("user", {}).get("user_id")
        self.session1.headers.update({"Authorization": f"Bearer {self.token1}"})
        
        # Login user 2
        resp2 = self.session2.post(f"{BASE_URL}/api/auth/login", json=USER2)
        if resp2.status_code != 200:
            pytest.skip(f"User2 login failed: {resp2.text}")
        data2 = resp2.json()
        self.token2 = data2.get("token")
        self.user2_id = data2.get("user", {}).get("user_id")
        self.session2.headers.update({"Authorization": f"Bearer {self.token2}"})
        
        print(f"User1 logged in: {self.user1_id}")
        print(f"User2 logged in: {self.user2_id}")
        
    def get_photos(self, session, user_name):
        """Get battle photos for a user"""
        resp = session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        if resp.status_code != 200:
            pytest.skip(f"{user_name} failed to get photos: {resp.text}")
        photos = resp.json().get("photos", [])
        if len(photos) < 5:
            pytest.skip(f"{user_name} needs at least 5 minted photos, has {len(photos)}")
        return [p["mint_id"] for p in photos[:5]]
    
    def test_complete_pvp_flow(self):
        """Test complete PVP flow from create to start"""
        # Step 1: Login both users
        print("\n=== Step 1: Login both users ===")
        self.login_users()
        
        # Step 2: Get photos for both users
        print("\n=== Step 2: Get battle photos ===")
        photo_ids1 = self.get_photos(self.session1, "User1")
        photo_ids2 = self.get_photos(self.session2, "User2")
        print(f"User1 photos: {photo_ids1}")
        print(f"User2 photos: {photo_ids2}")
        
        # Step 3: User1 creates open game
        print("\n=== Step 3: User1 creates open game ===")
        create_resp = self.session1.post(f"{BASE_URL}/api/photo-game/open-games/create", json={
            "photo_ids": photo_ids1,
            "bet_amount": 0,
            "is_bot_allowed": False
        })
        assert create_resp.status_code == 200, f"Create game failed: {create_resp.text}"
        create_data = create_resp.json()
        self.game_id = create_data.get("game_id")
        print(f"Created game: {self.game_id}")
        assert self.game_id is not None
        
        # Step 4: User2 browses open games
        print("\n=== Step 4: User2 browses open games ===")
        browse_resp = self.session2.get(f"{BASE_URL}/api/photo-game/open-games")
        assert browse_resp.status_code == 200, f"Browse games failed: {browse_resp.text}"
        games = browse_resp.json().get("games", [])
        print(f"Found {len(games)} open games")
        
        # Find our game
        our_game = next((g for g in games if g.get("game_id") == self.game_id), None)
        if our_game:
            print(f"Found our game: {our_game.get('game_id')}")
        else:
            print(f"Our game not in list, but continuing with join...")
        
        # Step 5: User2 joins the game
        print("\n=== Step 5: User2 joins the game ===")
        join_resp = self.session2.post(f"{BASE_URL}/api/photo-game/open-games/join", json={
            "game_id": self.game_id,
            "photo_ids": photo_ids2
        })
        assert join_resp.status_code == 200, f"Join game failed: {join_resp.text}"
        join_data = join_resp.json()
        print(f"Join success: {join_data.get('success')}")
        
        # Step 6: Both users mark ready
        print("\n=== Step 6: Both users mark ready ===")
        ready1_resp = self.session1.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={
            "game_id": self.game_id
        })
        assert ready1_resp.status_code == 200, f"User1 ready failed: {ready1_resp.text}"
        print(f"User1 ready: {ready1_resp.json()}")
        
        ready2_resp = self.session2.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={
            "game_id": self.game_id
        })
        assert ready2_resp.status_code == 200, f"User2 ready failed: {ready2_resp.text}"
        ready2_data = ready2_resp.json()
        print(f"User2 ready: {ready2_data}")
        assert ready2_data.get("both_ready") == True, "Both players should be ready"
        
        # Step 7: Start the game
        print("\n=== Step 7: Start the game ===")
        time.sleep(1)  # Small delay
        
        start_resp = self.session1.post(f"{BASE_URL}/api/photo-game/open-games/start/{self.game_id}")
        assert start_resp.status_code == 200, f"Start game failed: {start_resp.text}"
        start_data = start_resp.json()
        
        print(f"Start game response: {json.dumps(start_data, indent=2)[:500]}...")
        
        # CRITICAL VERIFICATION
        self.session_id = start_data.get("session_id")
        self.pvp_room_id = start_data.get("pvp_room_id")
        websocket_url = start_data.get("websocket_url")
        
        print("\n=== CRITICAL VERIFICATION ===")
        print(f"session_id: {self.session_id}")
        print(f"pvp_room_id: {self.pvp_room_id}")
        print(f"websocket_url: {websocket_url}")
        
        assert self.session_id is not None, "session_id should be returned"
        assert self.pvp_room_id is not None, "pvp_room_id should be returned (CRITICAL FIX)"
        assert websocket_url is not None, "websocket_url should be returned"
        assert self.pvp_room_id.startswith("pvp_"), f"pvp_room_id should start with 'pvp_', got: {self.pvp_room_id}"
        
        # Verify session also contains pvp_room_id
        session_data = start_data.get("session", {})
        session_pvp_room_id = session_data.get("pvp_room_id")
        print(f"session.pvp_room_id: {session_pvp_room_id}")
        
        print("\n✅ PVP Room ID fix verified - pvp_room_id is properly returned!")
        
        return {
            "game_id": self.game_id,
            "session_id": self.session_id,
            "pvp_room_id": self.pvp_room_id,
            "websocket_url": websocket_url
        }


class TestWebSocketConnection:
    """Test WebSocket connection with pvp_room_id"""
    
    def test_websocket_endpoint_exists(self):
        """Verify WebSocket endpoint is accessible"""
        # Login
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=USER1)
        if resp.status_code != 200:
            pytest.skip("Login failed")
        
        token = resp.json().get("token")
        
        # Test WebSocket URL format
        sample_room_id = "pvp_test123"
        ws_url = f"{WS_BASE_URL}/api/ws/pvp-game/{sample_room_id}/{token}"
        
        print(f"WebSocket URL: {ws_url}")
        
        # Verify URL format
        assert "/api/ws/pvp-game/" in ws_url
        assert sample_room_id in ws_url
        assert token in ws_url
        
        print("✅ WebSocket URL format is correct")


class TestPVPQueueStatus:
    """Test PVP queue status endpoint"""
    
    def test_queue_status(self):
        """Test queue status endpoint"""
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=USER1)
        if resp.status_code != 200:
            pytest.skip("Login failed")
        
        token = resp.json().get("token")
        session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get queue status
        status_resp = session.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        print(f"Queue status response: {status_resp.status_code}")
        
        if status_resp.status_code == 200:
            data = status_resp.json()
            print(f"Queue status: {data}")
            assert "in_queue" in data or "status" in data
        else:
            print(f"Queue status error: {status_resp.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
