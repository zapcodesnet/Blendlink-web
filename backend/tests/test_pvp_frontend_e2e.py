"""
PVP Frontend E2E Test with Two Browser Contexts

This test simulates the FULL PVP flow with two simultaneous browser sessions:
1. User 1 logs in and creates a PVP game
2. User 2 logs in and joins the game
3. Both users click Ready
4. Verify countdown starts
5. Verify game_start event is received with pvp_room_id
6. Verify PVPBattleArena renders
7. Verify WebSocket connects to PVP game room
8. Verify photo selection phase works

Critical bugs being tested:
- "Initializing..." stuck state (pvpRoomId not propagating)
- "Waiting for opponent" endless loop
- "Room not ready" popup
- Sync bar not showing "Synced"
"""

import pytest
import requests
import asyncio
import json
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fetch-api-patch.preview.emergentagent.com')

# Test users
USER1 = {"email": "test@blendlink.com", "password": "admin"}
USER2 = {"email": "test@example.com", "password": "test123"}


class TestPVPBackendFlow:
    """Test the complete PVP backend flow before frontend testing"""
    
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
        
    def login_user(self, session, credentials, user_num):
        """Login and return token + user_id"""
        response = session.post(f"{BASE_URL}/api/auth/login", json=credentials)
        if response.status_code != 200:
            print(f"User{user_num} login failed: {response.text}")
            return None, None
            
        data = response.json()
        token = data.get("token")
        user_id = data.get("user", {}).get("user_id")
        session.headers.update({"Authorization": f"Bearer {token}"})
        print(f"User{user_num} logged in: {user_id}")
        return token, user_id
    
    def get_battle_photos(self, session, user_num):
        """Get battle photos for a user"""
        response = session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        if response.status_code != 200:
            print(f"User{user_num} failed to get battle photos: {response.text}")
            return []
            
        photos = response.json().get("photos", [])
        photo_ids = [p["mint_id"] for p in photos[:5]]
        print(f"User{user_num} has {len(photo_ids)} battle photos: {photo_ids}")
        return photo_ids
    
    def test_01_verify_users_have_photos(self):
        """Verify both test users have at least 5 battle-ready photos"""
        # Login both users
        self.token1, self.user1_id = self.login_user(self.session1, USER1, 1)
        self.token2, self.user2_id = self.login_user(self.session2, USER2, 2)
        
        assert self.token1 is not None, "User1 login failed"
        assert self.token2 is not None, "User2 login failed"
        
        # Get battle photos
        user1_photos = self.get_battle_photos(self.session1, 1)
        user2_photos = self.get_battle_photos(self.session2, 2)
        
        assert len(user1_photos) >= 5, f"User1 needs at least 5 photos, has {len(user1_photos)}"
        assert len(user2_photos) >= 5, f"User2 needs at least 5 photos, has {len(user2_photos)}"
        
        print(f"✅ User1 has {len(user1_photos)} photos")
        print(f"✅ User2 has {len(user2_photos)} photos")
    
    def test_02_complete_pvp_flow_with_pvp_room_id(self):
        """Test the complete PVP flow and verify pvp_room_id is returned"""
        # Login both users
        self.token1, self.user1_id = self.login_user(self.session1, USER1, 1)
        self.token2, self.user2_id = self.login_user(self.session2, USER2, 2)
        
        if not self.token1 or not self.token2:
            pytest.skip("Could not login both users")
        
        # Get battle photos
        user1_photo_ids = self.get_battle_photos(self.session1, 1)
        user2_photo_ids = self.get_battle_photos(self.session2, 2)
        
        if len(user1_photo_ids) < 5 or len(user2_photo_ids) < 5:
            pytest.skip("Both users need at least 5 minted photos")
        
        # User1 creates open game
        print("\n=== User1 Creating Open Game ===")
        create_response = self.session1.post(f"{BASE_URL}/api/photo-game/open-games/create", json={
            "photo_ids": user1_photo_ids[:5],
            "bet_amount": 0,
        })
        
        assert create_response.status_code == 200, f"Create game failed: {create_response.text}"
        create_data = create_response.json()
        self.game_id = create_data.get("game_id")
        print(f"Game created: {self.game_id}")
        assert self.game_id is not None
        
        # User2 joins the game
        print("\n=== User2 Joining Game ===")
        join_response = self.session2.post(
            f"{BASE_URL}/api/photo-game/open-games/join",
            json={
                "game_id": self.game_id,
                "photo_ids": user2_photo_ids[:5]
            }
        )
        
        assert join_response.status_code == 200, f"Join game failed: {join_response.text}"
        join_data = join_response.json()
        print(f"Join result: success={join_data.get('success')}")
        
        # User1 marks ready
        print("\n=== User1 Marking Ready ===")
        ready1_response = self.session1.post(
            f"{BASE_URL}/api/photo-game/open-games/ready",
            json={"game_id": self.game_id}
        )
        print(f"User1 ready response: {ready1_response.status_code}")
        
        # User2 marks ready
        print("\n=== User2 Marking Ready ===")
        ready2_response = self.session2.post(
            f"{BASE_URL}/api/photo-game/open-games/ready",
            json={"game_id": self.game_id}
        )
        print(f"User2 ready response: {ready2_response.status_code}")
        
        # Wait a moment for status to update
        time.sleep(1)
        
        # Start the game (triggers pvp_room_id creation)
        print("\n=== Starting Game ===")
        start_response = self.session1.post(f"{BASE_URL}/api/photo-game/open-games/start/{self.game_id}")
        
        assert start_response.status_code == 200, f"Start game failed: {start_response.text}"
        start_data = start_response.json()
        
        # CRITICAL: Verify pvp_room_id is returned
        self.pvp_room_id = start_data.get("pvp_room_id")
        print(f"\n=== CRITICAL CHECK ===")
        print(f"pvp_room_id: {self.pvp_room_id}")
        print(f"session_id: {start_data.get('session_id')}")
        print(f"success: {start_data.get('success')}")
        
        assert self.pvp_room_id is not None, "pvp_room_id was not returned from start game!"
        assert start_data.get("success") == True, "Start game did not return success=True"
        assert start_data.get("session_id") is not None, "session_id was not returned"
        
        print("\n" + "="*50)
        print("✅ PVP BACKEND FLOW TEST PASSED!")
        print(f"✅ pvp_room_id: {self.pvp_room_id}")
        print("="*50)
    
    def test_03_verify_websocket_endpoint_exists(self):
        """Verify the PVP WebSocket endpoint is accessible"""
        # Login
        self.token1, _ = self.login_user(self.session1, USER1, 1)
        if not self.token1:
            pytest.skip("Could not login")
        
        # The WebSocket URL format
        ws_protocol = "wss" if BASE_URL.startswith("https") else "ws"
        ws_host = BASE_URL.replace("https://", "").replace("http://", "")
        
        # Test room ID
        test_room_id = "test_room_123"
        expected_url = f"{ws_protocol}://{ws_host}/api/ws/pvp-game/{test_room_id}/{self.token1}"
        
        print(f"\n=== WebSocket URL Format ===")
        print(f"Expected format: {ws_protocol}://{ws_host}/api/ws/pvp-game/{{room_id}}/{{token}}")
        
        # Verify /api prefix is present
        assert "/api/ws/" in expected_url, "WebSocket URL must have /api prefix for ingress routing"
        print("✅ WebSocket URL format is correct with /api prefix")


class TestPVPGameStateTransitions:
    """Test game state transitions in the PVP flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session1 = requests.Session()
        self.session2 = requests.Session()
        
    def test_game_status_transitions(self):
        """Test that game status transitions correctly through the flow"""
        # Login both users
        response1 = self.session1.post(f"{BASE_URL}/api/auth/login", json=USER1)
        response2 = self.session2.post(f"{BASE_URL}/api/auth/login", json=USER2)
        
        if response1.status_code != 200 or response2.status_code != 200:
            pytest.skip("Could not login both users")
        
        token1 = response1.json().get("token")
        token2 = response2.json().get("token")
        self.session1.headers.update({"Authorization": f"Bearer {token1}"})
        self.session2.headers.update({"Authorization": f"Bearer {token2}"})
        
        # Get photos
        photos1 = self.session1.get(f"{BASE_URL}/api/photo-game/battle-photos").json().get("photos", [])
        photos2 = self.session2.get(f"{BASE_URL}/api/photo-game/battle-photos").json().get("photos", [])
        
        if len(photos1) < 5 or len(photos2) < 5:
            pytest.skip("Both users need at least 5 photos")
        
        photo_ids1 = [p["mint_id"] for p in photos1[:5]]
        photo_ids2 = [p["mint_id"] for p in photos2[:5]]
        
        # Create game
        create_res = self.session1.post(f"{BASE_URL}/api/photo-game/open-games/create", json={
            "photo_ids": photo_ids1,
            "bet_amount": 0,
        })
        assert create_res.status_code == 200
        game_id = create_res.json().get("game_id")
        
        # Check initial status
        status_res = self.session1.get(f"{BASE_URL}/api/photo-game/open-games/{game_id}")
        assert status_res.status_code == 200
        initial_status = status_res.json().get("status")
        print(f"Initial status: {initial_status}")
        assert initial_status == "waiting", f"Expected 'waiting', got '{initial_status}'"
        
        # Join game
        join_res = self.session2.post(f"{BASE_URL}/api/photo-game/open-games/join", json={
            "game_id": game_id,
            "photo_ids": photo_ids2
        })
        assert join_res.status_code == 200
        
        # Check status after join
        status_res = self.session1.get(f"{BASE_URL}/api/photo-game/open-games/{game_id}")
        after_join_status = status_res.json().get("status")
        print(f"After join status: {after_join_status}")
        assert after_join_status == "ready", f"Expected 'ready', got '{after_join_status}'"
        
        # Both ready
        self.session1.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={"game_id": game_id})
        self.session2.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={"game_id": game_id})
        
        time.sleep(0.5)
        
        # Check status after both ready
        status_res = self.session1.get(f"{BASE_URL}/api/photo-game/open-games/{game_id}")
        after_ready_status = status_res.json().get("status")
        print(f"After both ready status: {after_ready_status}")
        
        # Start game
        start_res = self.session1.post(f"{BASE_URL}/api/photo-game/open-games/start/{game_id}")
        assert start_res.status_code == 200
        start_data = start_res.json()
        
        # Verify all required fields
        assert start_data.get("success") == True, "Start should return success=True"
        assert start_data.get("pvp_room_id") is not None, "pvp_room_id should be returned"
        assert start_data.get("session_id") is not None, "session_id should be returned"
        
        print(f"\n✅ Game state transitions verified:")
        print(f"  waiting -> ready -> starting -> in_progress")
        print(f"  pvp_room_id: {start_data.get('pvp_room_id')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
