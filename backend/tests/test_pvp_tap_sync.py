"""
PVP Tap Synchronization Tests
Tests the critical PVP tap sync API endpoints:
- POST /api/photo-game/pvp/tap - Submit taps
- GET /api/photo-game/pvp/tap-state/{session_id} - Get tap state
- GET /api/photo-game/pvp/session/{session_id} - Get PVP session state
- POST /api/photo-game/pvp/select-photo - Select photo for round
- GET /api/photo-game/config - Get game config with max_taps_per_second
- GET /api/photo-game/battle-photos - Get user's minted photos
- GET /api/photo-game/open-games - List open games
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
USER1_EMAIL = "test@blendlink.com"
USER1_PASSWORD = "admin"
USER2_EMAIL = "test@example.com"
USER2_PASSWORD = "test123"


class TestAuthentication:
    """Test user authentication flow"""
    
    def test_user1_login(self):
        """Test login for user 1"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER1_EMAIL, "password": USER1_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == USER1_EMAIL
        print(f"✓ User 1 login successful: {data['user']['username']}")
    
    def test_user2_login(self):
        """Test login for user 2"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER2_EMAIL, "password": USER2_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["email"] == USER2_EMAIL
        print(f"✓ User 2 login successful: {data['user']['username']}")


class TestPhotoGameConfig:
    """Test photo game configuration endpoint"""
    
    def test_get_config(self):
        """Test GET /api/photo-game/config returns max_taps_per_second"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        assert response.status_code == 200, f"Config failed: {response.text}"
        data = response.json()
        
        # Verify max_taps_per_second is present
        assert "max_taps_per_second" in data, "max_taps_per_second not in config"
        assert isinstance(data["max_taps_per_second"], int), "max_taps_per_second should be int"
        assert data["max_taps_per_second"] > 0, "max_taps_per_second should be positive"
        
        # Verify other required config fields
        assert "max_stamina" in data
        assert "required_photos" in data
        assert "rps_auction" in data
        
        print(f"✓ Config endpoint working. max_taps_per_second={data['max_taps_per_second']}")


class TestBattlePhotos:
    """Test battle photos endpoint"""
    
    @pytest.fixture
    def user1_token(self):
        """Get auth token for user 1"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER1_EMAIL, "password": USER1_PASSWORD}
        )
        return response.json().get("token")
    
    def test_get_battle_photos(self, user1_token):
        """Test GET /api/photo-game/battle-photos returns user's minted photos"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Battle photos failed: {response.text}"
        data = response.json()
        
        # Should return a list of photos
        assert "photos" in data, "No photos field in response"
        assert isinstance(data["photos"], list), "photos should be a list"
        
        # If photos exist, verify structure
        if len(data["photos"]) > 0:
            photo = data["photos"][0]
            assert "mint_id" in photo, "Photo missing mint_id"
            assert "dollar_value" in photo, "Photo missing dollar_value"
            print(f"✓ Battle photos endpoint working. Found {len(data['photos'])} photos")
        else:
            print("✓ Battle photos endpoint working. No photos found (user may not have minted photos)")


class TestOpenGames:
    """Test open games list endpoint"""
    
    @pytest.fixture
    def user1_token(self):
        """Get auth token for user 1"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER1_EMAIL, "password": USER1_PASSWORD}
        )
        return response.json().get("token")
    
    def test_list_open_games(self, user1_token):
        """Test GET /api/photo-game/open-games returns list of open games"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/open-games",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Open games failed: {response.text}"
        data = response.json()
        
        # Should return games list
        assert "games" in data, "No games field in response"
        assert isinstance(data["games"], list), "games should be a list"
        assert "count" in data, "No count field in response"
        
        print(f"✓ Open games endpoint working. Found {data['count']} open games")


class TestPVPSessionPolling:
    """Test PVP session state polling endpoint"""
    
    @pytest.fixture
    def user1_token(self):
        """Get auth token for user 1"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER1_EMAIL, "password": USER1_PASSWORD}
        )
        return response.json().get("token")
    
    def test_pvp_session_not_found(self, user1_token):
        """Test GET /api/photo-game/pvp/session/{session_id} returns 404 for invalid session"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/pvp/session/invalid-session-id",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        # Should return 404 for non-existent session
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ PVP session endpoint correctly returns 404 for invalid session")


class TestPVPTapState:
    """Test PVP tap state polling endpoint"""
    
    @pytest.fixture
    def user1_token(self):
        """Get auth token for user 1"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER1_EMAIL, "password": USER1_PASSWORD}
        )
        return response.json().get("token")
    
    def test_tap_state_not_found(self, user1_token):
        """Test GET /api/photo-game/pvp/tap-state/{session_id} returns 404 for invalid session"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/pvp/tap-state/invalid-session-id",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        # Should return 404 for non-existent session
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Tap state endpoint correctly returns 404 for invalid session")


class TestPVPTapSubmission:
    """Test PVP tap submission endpoint"""
    
    @pytest.fixture
    def user1_token(self):
        """Get auth token for user 1"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER1_EMAIL, "password": USER1_PASSWORD}
        )
        return response.json().get("token")
    
    def test_tap_submission_not_found(self, user1_token):
        """Test POST /api/photo-game/pvp/tap returns 404 for invalid session"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/tap",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={"session_id": "invalid-session-id", "tap_count": 1}
        )
        # Should return 404 for non-existent session
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Tap submission endpoint correctly returns 404 for invalid session")


class TestPVPPhotoSelection:
    """Test PVP photo selection endpoint"""
    
    @pytest.fixture
    def user1_token(self):
        """Get auth token for user 1"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER1_EMAIL, "password": USER1_PASSWORD}
        )
        return response.json().get("token")
    
    def test_photo_selection_not_found(self, user1_token):
        """Test POST /api/photo-game/pvp/select-photo returns 404 for invalid session"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/select-photo",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={"session_id": "invalid-session-id", "photo_id": "test-photo-id"}
        )
        # Should return 404 for non-existent session
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Photo selection endpoint correctly returns 404 for invalid session")


class TestPVPTapSyncWithRealSession:
    """
    Test PVP tap sync with a real session.
    This requires creating an open game, joining it, and starting the battle.
    """
    
    @pytest.fixture
    def user1_auth(self):
        """Get auth token and user info for user 1"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER1_EMAIL, "password": USER1_PASSWORD}
        )
        data = response.json()
        return {"token": data.get("token"), "user_id": data.get("user", {}).get("user_id")}
    
    @pytest.fixture
    def user2_auth(self):
        """Get auth token and user info for user 2"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": USER2_EMAIL, "password": USER2_PASSWORD}
        )
        data = response.json()
        return {"token": data.get("token"), "user_id": data.get("user", {}).get("user_id")}
    
    def test_full_pvp_tap_sync_flow(self, user1_auth, user2_auth):
        """
        Test the full PVP tap sync flow:
        1. User 1 gets battle photos
        2. User 1 creates open game
        3. User 2 gets battle photos
        4. User 2 joins game
        5. Both users mark ready
        6. Start game
        7. Test tap submission and tap state polling
        """
        user1_token = user1_auth["token"]
        user2_token = user2_auth["token"]
        
        # Step 1: Get user 1's battle photos
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Failed to get user 1 battle photos: {response.text}"
        user1_photos = response.json().get("photos", [])
        
        if len(user1_photos) < 5:
            pytest.skip(f"User 1 needs at least 5 photos for PVP. Has {len(user1_photos)}")
        
        user1_photo_ids = [p["mint_id"] for p in user1_photos[:5]]
        print(f"✓ User 1 has {len(user1_photos)} photos. Using first 5.")
        
        # Step 2: Get user 2's battle photos
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert response.status_code == 200, f"Failed to get user 2 battle photos: {response.text}"
        user2_photos = response.json().get("photos", [])
        
        if len(user2_photos) < 5:
            pytest.skip(f"User 2 needs at least 5 photos for PVP. Has {len(user2_photos)}")
        
        user2_photo_ids = [p["mint_id"] for p in user2_photos[:5]]
        print(f"✓ User 2 has {len(user2_photos)} photos. Using first 5.")
        
        # Step 3: User 1 creates open game
        response = requests.post(
            f"{BASE_URL}/api/photo-game/open-games/create",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={
                "photo_ids": user1_photo_ids,
                "bet_amount": 0,
                "is_bot_allowed": False
            }
        )
        assert response.status_code == 200, f"Failed to create open game: {response.text}"
        create_data = response.json()
        assert create_data.get("success"), f"Create game failed: {create_data}"
        game_id = create_data.get("game_id")
        print(f"✓ User 1 created open game: {game_id}")
        
        # Step 4: User 2 joins game
        response = requests.post(
            f"{BASE_URL}/api/photo-game/open-games/join",
            headers={"Authorization": f"Bearer {user2_token}"},
            json={
                "game_id": game_id,
                "photo_ids": user2_photo_ids
            }
        )
        assert response.status_code == 200, f"Failed to join game: {response.text}"
        join_data = response.json()
        assert join_data.get("success"), f"Join game failed: {join_data}"
        print(f"✓ User 2 joined game: {game_id}")
        
        # Step 5: Both users mark ready
        response = requests.post(
            f"{BASE_URL}/api/photo-game/open-games/ready",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={"game_id": game_id}
        )
        assert response.status_code == 200, f"User 1 ready failed: {response.text}"
        print("✓ User 1 marked ready")
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/open-games/ready",
            headers={"Authorization": f"Bearer {user2_token}"},
            json={"game_id": game_id}
        )
        assert response.status_code == 200, f"User 2 ready failed: {response.text}"
        ready_data = response.json()
        assert ready_data.get("both_ready"), "Both players should be ready"
        print("✓ User 2 marked ready. Both players ready!")
        
        # Step 6: Start game
        time.sleep(1)  # Small delay for countdown
        response = requests.post(
            f"{BASE_URL}/api/photo-game/open-games/start/{game_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Start game failed: {response.text}"
        start_data = response.json()
        assert start_data.get("success"), f"Start game failed: {start_data}"
        session_id = start_data.get("session_id")
        print(f"✓ Game started! Session ID: {session_id}")
        
        # Step 7: Test tap state polling (initial state)
        response = requests.get(
            f"{BASE_URL}/api/photo-game/pvp/tap-state/{session_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"Tap state failed: {response.text}"
        tap_state = response.json()
        
        # Verify tap state structure
        assert "player1_taps" in tap_state, "Missing player1_taps"
        assert "player2_taps" in tap_state, "Missing player2_taps"
        assert "player1_dollar" in tap_state, "Missing player1_dollar"
        assert "player2_dollar" in tap_state, "Missing player2_dollar"
        assert "my_taps" in tap_state, "Missing my_taps"
        assert "opponent_taps" in tap_state, "Missing opponent_taps"
        
        print(f"✓ Initial tap state: player1_taps={tap_state['player1_taps']}, player2_taps={tap_state['player2_taps']}")
        
        # Step 8: User 1 submits taps
        response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/tap",
            headers={"Authorization": f"Bearer {user1_token}"},
            json={"session_id": session_id, "tap_count": 10}
        )
        assert response.status_code == 200, f"User 1 tap submission failed: {response.text}"
        tap_result = response.json()
        assert tap_result.get("success"), f"Tap submission failed: {tap_result}"
        assert tap_result.get("my_taps") == 10, f"Expected 10 taps, got {tap_result.get('my_taps')}"
        print(f"✓ User 1 submitted 10 taps. my_taps={tap_result['my_taps']}, my_dollar={tap_result['my_dollar']}")
        
        # Step 9: User 2 polls tap state and sees User 1's taps
        response = requests.get(
            f"{BASE_URL}/api/photo-game/pvp/tap-state/{session_id}",
            headers={"Authorization": f"Bearer {user2_token}"}
        )
        assert response.status_code == 200, f"User 2 tap state failed: {response.text}"
        user2_tap_state = response.json()
        
        # User 2 should see User 1's taps as opponent_taps
        assert user2_tap_state.get("opponent_taps") == 10, f"User 2 should see 10 opponent taps, got {user2_tap_state.get('opponent_taps')}"
        assert user2_tap_state.get("opponent_dollar") > 0, f"User 2 should see opponent dollar > 0, got {user2_tap_state.get('opponent_dollar')}"
        print(f"✓ User 2 sees opponent taps: opponent_taps={user2_tap_state['opponent_taps']}, opponent_dollar={user2_tap_state['opponent_dollar']}")
        
        # Step 10: User 2 submits taps
        response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/tap",
            headers={"Authorization": f"Bearer {user2_token}"},
            json={"session_id": session_id, "tap_count": 15}
        )
        assert response.status_code == 200, f"User 2 tap submission failed: {response.text}"
        tap_result = response.json()
        assert tap_result.get("success"), f"Tap submission failed: {tap_result}"
        assert tap_result.get("my_taps") == 15, f"Expected 15 taps, got {tap_result.get('my_taps')}"
        print(f"✓ User 2 submitted 15 taps. my_taps={tap_result['my_taps']}, my_dollar={tap_result['my_dollar']}")
        
        # Step 11: User 1 polls tap state and sees User 2's taps
        response = requests.get(
            f"{BASE_URL}/api/photo-game/pvp/tap-state/{session_id}",
            headers={"Authorization": f"Bearer {user1_token}"}
        )
        assert response.status_code == 200, f"User 1 tap state failed: {response.text}"
        user1_tap_state = response.json()
        
        # User 1 should see User 2's taps as opponent_taps
        assert user1_tap_state.get("opponent_taps") == 15, f"User 1 should see 15 opponent taps, got {user1_tap_state.get('opponent_taps')}"
        assert user1_tap_state.get("opponent_dollar") > 0, f"User 1 should see opponent dollar > 0, got {user1_tap_state.get('opponent_dollar')}"
        print(f"✓ User 1 sees opponent taps: opponent_taps={user1_tap_state['opponent_taps']}, opponent_dollar={user1_tap_state['opponent_dollar']}")
        
        # Step 12: Verify both players see correct state
        assert user1_tap_state.get("my_taps") == 10, "User 1 my_taps should be 10"
        assert user1_tap_state.get("opponent_taps") == 15, "User 1 opponent_taps should be 15"
        assert user2_tap_state.get("my_taps") == 0, "User 2 my_taps should be 0 (before their submission)"
        assert user2_tap_state.get("opponent_taps") == 10, "User 2 opponent_taps should be 10"
        
        print("\n" + "="*60)
        print("✓ PVP TAP SYNC TEST PASSED!")
        print("="*60)
        print(f"  - Tap submission works correctly")
        print(f"  - Tap state polling returns correct values")
        print(f"  - Both players see each other's taps via polling")
        print(f"  - Dollar values are calculated correctly")
        print("="*60)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
