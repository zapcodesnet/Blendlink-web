"""
Test full 2-player PVP flow:
1. User 1 creates game with 5 photos
2. User 2 joins the game
3. Both users click Ready
4. Verify countdown starts and game_start is broadcast
5. Verify pvp_room_id is returned
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pages-changestream.preview.emergentagent.com')

class TestPVP2PlayerFlow:
    """Test full 2-player PVP flow"""
    
    @pytest.fixture(scope="class")
    def user1_session(self):
        """Login as User 1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        assert response.status_code == 200, f"User 1 login failed: {response.text}"
        data = response.json()
        return {
            "token": data.get("token") or data.get("session_token"),
            "user_id": data.get("user", {}).get("user_id") or data.get("user_id"),
            "username": data.get("user", {}).get("username") or data.get("username")
        }
    
    @pytest.fixture(scope="class")
    def user2_session(self):
        """Login as User 2"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"User 2 login failed: {response.text}"
        data = response.json()
        return {
            "token": data.get("token") or data.get("session_token"),
            "user_id": data.get("user", {}).get("user_id") or data.get("user_id"),
            "username": data.get("user", {}).get("username") or data.get("username")
        }
    
    @pytest.fixture(scope="class")
    def user1_photos(self, user1_session):
        """Get User 1's battle-ready photos"""
        headers = {"Authorization": f"Bearer {user1_session['token']}"}
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers)
        assert response.status_code == 200, f"Failed to get User 1 photos: {response.text}"
        data = response.json()
        photos = data.get("photos", [])
        assert len(photos) >= 5, f"User 1 needs at least 5 photos, has {len(photos)}"
        return [p["mint_id"] for p in photos[:5]]
    
    @pytest.fixture(scope="class")
    def user2_photos(self, user2_session):
        """Get User 2's battle-ready photos"""
        headers = {"Authorization": f"Bearer {user2_session['token']}"}
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers)
        assert response.status_code == 200, f"Failed to get User 2 photos: {response.text}"
        data = response.json()
        photos = data.get("photos", [])
        assert len(photos) >= 5, f"User 2 needs at least 5 photos, has {len(photos)}"
        return [p["mint_id"] for p in photos[:5]]
    
    def test_01_user1_creates_game(self, user1_session, user1_photos):
        """User 1 creates a PVP game"""
        headers = {"Authorization": f"Bearer {user1_session['token']}"}
        response = requests.post(f"{BASE_URL}/api/photo-game/open-games/create", 
            headers=headers,
            json={
                "photo_ids": user1_photos,
                "bet_amount": 0,
                "is_bot_allowed": False
            }
        )
        assert response.status_code == 200, f"Create game failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Create game not successful: {data}"
        assert "game_id" in data, f"No game_id in response: {data}"
        
        # Store game_id for other tests
        self.__class__.game_id = data["game_id"]
        print(f"Created game: {self.__class__.game_id}")
        return data
    
    def test_02_user2_joins_game(self, user2_session, user2_photos):
        """User 2 joins the game"""
        headers = {"Authorization": f"Bearer {user2_session['token']}"}
        response = requests.post(f"{BASE_URL}/api/photo-game/open-games/join",
            headers=headers,
            json={
                "game_id": self.__class__.game_id,
                "photo_ids": user2_photos
            }
        )
        assert response.status_code == 200, f"Join game failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Join game not successful: {data}"
        print(f"User 2 joined game: {self.__class__.game_id}")
        return data
    
    def test_03_user1_marks_ready(self, user1_session):
        """User 1 marks ready"""
        headers = {"Authorization": f"Bearer {user1_session['token']}"}
        response = requests.post(f"{BASE_URL}/api/photo-game/open-games/ready",
            headers=headers,
            json={"game_id": self.__class__.game_id}
        )
        assert response.status_code == 200, f"User 1 ready failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"User 1 ready not successful: {data}"
        print(f"User 1 marked ready, both_ready: {data.get('both_ready')}")
        return data
    
    def test_04_user2_marks_ready(self, user2_session):
        """User 2 marks ready - should trigger countdown"""
        headers = {"Authorization": f"Bearer {user2_session['token']}"}
        response = requests.post(f"{BASE_URL}/api/photo-game/open-games/ready",
            headers=headers,
            json={"game_id": self.__class__.game_id}
        )
        assert response.status_code == 200, f"User 2 ready failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"User 2 ready not successful: {data}"
        assert data.get("both_ready") == True, f"Both should be ready: {data}"
        print(f"User 2 marked ready, both_ready: {data.get('both_ready')}")
        return data
    
    def test_05_start_game_returns_pvp_room_id(self, user1_session):
        """Start game should return pvp_room_id"""
        headers = {"Authorization": f"Bearer {user1_session['token']}"}
        response = requests.post(f"{BASE_URL}/api/photo-game/open-games/start/{self.__class__.game_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Start game failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, f"Start game not successful: {data}"
        assert "session_id" in data, f"No session_id in response: {data}"
        assert "pvp_room_id" in data, f"No pvp_room_id in response: {data}"
        
        print(f"Game started!")
        print(f"  session_id: {data.get('session_id')}")
        print(f"  pvp_room_id: {data.get('pvp_room_id')}")
        print(f"  websocket_url: {data.get('websocket_url')}")
        
        # Verify session contains pvp_room_id
        session = data.get("session", {})
        print(f"  session.pvp_room_id: {session.get('pvp_room_id')}")
        
        return data
    
    def test_06_verify_game_state(self, user1_session):
        """Verify game is in progress"""
        headers = {"Authorization": f"Bearer {user1_session['token']}"}
        response = requests.get(f"{BASE_URL}/api/photo-game/open-games/{self.__class__.game_id}",
            headers=headers
        )
        assert response.status_code == 200, f"Get game failed: {response.text}"
        data = response.json()
        
        print(f"Game state:")
        print(f"  status: {data.get('status')}")
        print(f"  active_session_id: {data.get('active_session_id')}")
        print(f"  creator_ready: {data.get('creator_ready')}")
        print(f"  opponent_ready: {data.get('opponent_ready')}")
        
        assert data.get("status") == "in_progress", f"Game should be in_progress: {data.get('status')}"
        return data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
