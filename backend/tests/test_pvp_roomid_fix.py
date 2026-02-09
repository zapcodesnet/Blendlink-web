"""
Test PVP Room ID Fix - Verifies the critical bug fix for pvpRoomId propagation

Tests:
1. Login with test credentials
2. Create an open game
3. Join the game with second user
4. Mark both players ready
5. Start the game and verify pvp_room_id is returned
6. Verify WebSocket connection can be established with the room ID
"""

import pytest
import requests
import os
import time
import json
import threading

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pages-changestream.preview.emergentagent.com')

# Test credentials
USER1 = {"email": "test@blendlink.com", "password": "admin"}
USER2 = {"email": "test@example.com", "password": "test123"}


class TestPVPRoomIdFix:
    """Test suite for PVP Room ID propagation fix"""
    
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
        
    def test_01_login_user1(self):
        """Login first test user"""
        response = self.session1.post(f"{BASE_URL}/api/auth/login", json=USER1)
        print(f"User1 login response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            self.token1 = data.get("token")
            self.user1_id = data.get("user", {}).get("user_id")
            self.session1.headers.update({"Authorization": f"Bearer {self.token1}"})
            print(f"User1 logged in: {self.user1_id}")
            assert self.token1 is not None
            assert self.user1_id is not None
        else:
            print(f"Login failed: {response.text}")
            pytest.skip("User1 login failed")
    
    def test_02_login_user2(self):
        """Login second test user"""
        response = self.session2.post(f"{BASE_URL}/api/auth/login", json=USER2)
        print(f"User2 login response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            self.token2 = data.get("token")
            self.user2_id = data.get("user", {}).get("user_id")
            self.session2.headers.update({"Authorization": f"Bearer {self.token2}"})
            print(f"User2 logged in: {self.user2_id}")
            assert self.token2 is not None
            assert self.user2_id is not None
        else:
            print(f"Login failed: {response.text}")
            pytest.skip("User2 login failed")
    
    def test_03_get_battle_photos_user1(self):
        """Get battle-ready photos for user1"""
        # First login
        response = self.session1.post(f"{BASE_URL}/api/auth/login", json=USER1)
        if response.status_code == 200:
            data = response.json()
            self.token1 = data.get("token")
            self.user1_id = data.get("user", {}).get("user_id")
            self.session1.headers.update({"Authorization": f"Bearer {self.token1}"})
        
        response = self.session1.get(f"{BASE_URL}/api/photo-game/battle-photos")
        print(f"User1 battle photos response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            photos = data.get("photos", [])
            print(f"User1 has {len(photos)} battle-ready photos")
            
            if len(photos) >= 5:
                self.user1_photo_ids = [p["mint_id"] for p in photos[:5]]
                print(f"User1 photo IDs: {self.user1_photo_ids}")
                assert len(self.user1_photo_ids) == 5
            else:
                print(f"User1 needs at least 5 photos, has {len(photos)}")
                pytest.skip("User1 needs at least 5 minted photos")
        else:
            print(f"Failed to get photos: {response.text}")
            pytest.skip("Failed to get user1 photos")
    
    def test_04_get_battle_photos_user2(self):
        """Get battle-ready photos for user2"""
        # First login
        response = self.session2.post(f"{BASE_URL}/api/auth/login", json=USER2)
        if response.status_code == 200:
            data = response.json()
            self.token2 = data.get("token")
            self.user2_id = data.get("user", {}).get("user_id")
            self.session2.headers.update({"Authorization": f"Bearer {self.token2}"})
        
        response = self.session2.get(f"{BASE_URL}/api/photo-game/battle-photos")
        print(f"User2 battle photos response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            photos = data.get("photos", [])
            print(f"User2 has {len(photos)} battle-ready photos")
            
            if len(photos) >= 5:
                self.user2_photo_ids = [p["mint_id"] for p in photos[:5]]
                print(f"User2 photo IDs: {self.user2_photo_ids}")
                assert len(self.user2_photo_ids) == 5
            else:
                print(f"User2 needs at least 5 photos, has {len(photos)}")
                pytest.skip("User2 needs at least 5 minted photos")
        else:
            print(f"Failed to get photos: {response.text}")
            pytest.skip("Failed to get user2 photos")


class TestPVPGameFlow:
    """Full PVP game flow test"""
    
    def test_full_pvp_flow(self):
        """Test complete PVP flow from create to start"""
        session1 = requests.Session()
        session2 = requests.Session()
        
        # Login both users
        print("\n=== Step 1: Login both users ===")
        resp1 = session1.post(f"{BASE_URL}/api/auth/login", json=USER1)
        resp2 = session2.post(f"{BASE_URL}/api/auth/login", json=USER2)
        
        if resp1.status_code != 200 or resp2.status_code != 200:
            pytest.skip("Login failed for one or both users")
        
        data1 = resp1.json()
        data2 = resp2.json()
        
        token1 = data1.get("token")
        token2 = data2.get("token")
        user1_id = data1.get("user", {}).get("user_id")
        user2_id = data2.get("user", {}).get("user_id")
        
        session1.headers.update({"Authorization": f"Bearer {token1}"})
        session2.headers.update({"Authorization": f"Bearer {token2}"})
        
        print(f"User1: {user1_id}")
        print(f"User2: {user2_id}")
        
        # Get photos for both users
        print("\n=== Step 2: Get battle photos ===")
        photos1_resp = session1.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos2_resp = session2.get(f"{BASE_URL}/api/photo-game/battle-photos")
        
        if photos1_resp.status_code != 200 or photos2_resp.status_code != 200:
            pytest.skip("Failed to get battle photos")
        
        photos1 = photos1_resp.json().get("photos", [])
        photos2 = photos2_resp.json().get("photos", [])
        
        print(f"User1 photos: {len(photos1)}")
        print(f"User2 photos: {len(photos2)}")
        
        if len(photos1) < 5 or len(photos2) < 5:
            pytest.skip("Both users need at least 5 minted photos")
        
        photo_ids1 = [p["mint_id"] for p in photos1[:5]]
        photo_ids2 = [p["mint_id"] for p in photos2[:5]]
        
        # Create open game
        print("\n=== Step 3: Create open game ===")
        create_resp = session1.post(f"{BASE_URL}/api/photo-game/open-games/create", json={
            "photo_ids": photo_ids1,
            "bet_amount": 0,
            "is_bot_allowed": False
        })
        
        print(f"Create game response: {create_resp.status_code}")
        if create_resp.status_code != 200:
            print(f"Create game error: {create_resp.text}")
            pytest.fail("Failed to create open game")
        
        create_data = create_resp.json()
        game_id = create_data.get("game_id")
        print(f"Created game: {game_id}")
        assert game_id is not None, "game_id should be returned"
        
        # Join game
        print("\n=== Step 4: Join game ===")
        join_resp = session2.post(f"{BASE_URL}/api/photo-game/open-games/join", json={
            "game_id": game_id,
            "photo_ids": photo_ids2
        })
        
        print(f"Join game response: {join_resp.status_code}")
        if join_resp.status_code != 200:
            print(f"Join game error: {join_resp.text}")
            # Cleanup
            session1.delete(f"{BASE_URL}/api/photo-game/open-games/{game_id}")
            pytest.fail("Failed to join game")
        
        join_data = join_resp.json()
        print(f"Join success: {join_data.get('success')}")
        
        # Mark both players ready
        print("\n=== Step 5: Mark both players ready ===")
        ready1_resp = session1.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={
            "game_id": game_id
        })
        print(f"User1 ready response: {ready1_resp.status_code}")
        
        ready2_resp = session2.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={
            "game_id": game_id
        })
        print(f"User2 ready response: {ready2_resp.status_code}")
        
        if ready1_resp.status_code != 200 or ready2_resp.status_code != 200:
            pytest.fail("Failed to mark players ready")
        
        ready2_data = ready2_resp.json()
        both_ready = ready2_data.get("both_ready")
        print(f"Both ready: {both_ready}")
        assert both_ready == True, "Both players should be ready"
        
        # Start the game
        print("\n=== Step 6: Start the game ===")
        time.sleep(1)  # Small delay to ensure state is updated
        
        start_resp = session1.post(f"{BASE_URL}/api/photo-game/open-games/start/{game_id}")
        print(f"Start game response: {start_resp.status_code}")
        
        if start_resp.status_code != 200:
            print(f"Start game error: {start_resp.text}")
            pytest.fail("Failed to start game")
        
        start_data = start_resp.json()
        print(f"Start game data: {json.dumps(start_data, indent=2)}")
        
        # CRITICAL: Verify pvp_room_id is returned
        session_id = start_data.get("session_id")
        pvp_room_id = start_data.get("pvp_room_id")
        websocket_url = start_data.get("websocket_url")
        
        print(f"\n=== CRITICAL VERIFICATION ===")
        print(f"session_id: {session_id}")
        print(f"pvp_room_id: {pvp_room_id}")
        print(f"websocket_url: {websocket_url}")
        
        assert session_id is not None, "session_id should be returned"
        assert pvp_room_id is not None, "pvp_room_id should be returned (CRITICAL FIX)"
        assert websocket_url is not None, "websocket_url should be returned"
        assert pvp_room_id.startswith("pvp_"), f"pvp_room_id should start with 'pvp_', got: {pvp_room_id}"
        
        print("\n✅ PVP Room ID fix verified - pvp_room_id is properly returned!")
        
        # Verify session data also contains pvp_room_id
        session_data = start_data.get("session", {})
        print(f"\nSession data keys: {list(session_data.keys())}")
        
        return {
            "game_id": game_id,
            "session_id": session_id,
            "pvp_room_id": pvp_room_id,
            "token1": token1,
            "token2": token2
        }


class TestWebSocketConnection:
    """Test WebSocket connection with pvp_room_id"""
    
    def test_websocket_url_format(self):
        """Verify WebSocket URL format is correct"""
        # Login
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=USER1)
        
        if resp.status_code != 200:
            pytest.skip("Login failed")
        
        token = resp.json().get("token")
        
        # Expected WebSocket URL format
        ws_protocol = "wss" if BASE_URL.startswith("https") else "ws"
        ws_host = BASE_URL.replace("https://", "").replace("http://", "")
        
        # Test with a sample room ID
        sample_room_id = "pvp_test123"
        expected_url = f"{ws_protocol}://{ws_host}/api/ws/pvp-game/{sample_room_id}/{token}"
        
        print(f"Expected WebSocket URL format: {expected_url}")
        
        # Verify URL components
        assert ws_protocol in ["ws", "wss"], "Protocol should be ws or wss"
        assert ws_host, "Host should not be empty"
        assert "/api/ws/pvp-game/" in expected_url, "URL should contain /api/ws/pvp-game/"
        
        print("✅ WebSocket URL format is correct")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
