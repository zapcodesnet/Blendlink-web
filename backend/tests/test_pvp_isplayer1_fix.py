"""
Test PVP isPlayer1 Determination Fix - Iteration 92

CRITICAL BUG FIX VERIFICATION:
- Root cause: isPlayer1 was using stale session prop instead of API response
- Fix: Uses confirmedPlayer1Id from API response for correct photo assignment
- Creator (player1) must see THEIR photo on left, opponent's on right
- Joiner (player2) must see THEIR photo on left, creator's on right

Test Flow:
1. Create game with User1 (creator = player1)
2. Join game with User2 (joiner = player2)
3. Both select photos
4. Verify API returns correct player1_id and player2_id
5. Verify photo assignment is correct for BOTH perspectives
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


class TestPVPIsPlayer1Fix:
    """Test the critical isPlayer1 determination fix"""
    
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
    
    @pytest.fixture(scope="class")
    def user1_photos(self, user1_session):
        """Get User 1's battle photos"""
        response = user1_session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200, f"Failed to get User 1 photos: {response.text}"
        photos = response.json().get("photos", [])
        assert len(photos) >= 5, f"User 1 needs at least 5 photos, has {len(photos)}"
        return photos[:5]
    
    @pytest.fixture(scope="class")
    def user2_photos(self, user2_session):
        """Get User 2's battle photos"""
        response = user2_session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200, f"Failed to get User 2 photos: {response.text}"
        photos = response.json().get("photos", [])
        assert len(photos) >= 5, f"User 2 needs at least 5 photos, has {len(photos)}"
        return photos[:5]
    
    def test_isplayer1_determination_from_api(self, user1_session, user2_session, user1_photos, user2_photos):
        """
        CRITICAL TEST: Verify isPlayer1 is correctly determined from API response
        
        This tests the fix where:
        - Creator (User1) should be player1_id in API response
        - Joiner (User2) should be player2_id in API response
        - Both players can correctly determine their role from API
        """
        
        # Step 1: Create game with User 1 (creator)
        print("\n=== Step 1: Create Game (User1 = Creator = Player1) ===")
        user1_photo_ids = [p.get("mint_id") for p in user1_photos]
        create_response = user1_session.post(f"{BASE_URL}/api/photo-game/open-games/create", json={
            "photo_ids": user1_photo_ids,
            "bet_amount": 0,
            "is_bot_allowed": False
        })
        assert create_response.status_code == 200, f"Create game failed: {create_response.text}"
        game_data = create_response.json()
        game_id = game_data.get("game_id")
        print(f"Game created: {game_id}")
        
        # Step 2: Join game with User 2 (joiner)
        print("\n=== Step 2: Join Game (User2 = Joiner = Player2) ===")
        user2_photo_ids = [p.get("mint_id") for p in user2_photos]
        join_response = user2_session.post(f"{BASE_URL}/api/photo-game/open-games/join", json={
            "game_id": game_id,
            "photo_ids": user2_photo_ids
        })
        assert join_response.status_code == 200, f"Join game failed: {join_response.text}"
        
        # Step 3: Both ready
        print("\n=== Step 3: Both Players Ready ===")
        user1_session.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={"game_id": game_id})
        user2_session.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={"game_id": game_id})
        
        # Step 4: Start game
        print("\n=== Step 4: Start Game ===")
        time.sleep(0.3)
        start_response = user1_session.post(f"{BASE_URL}/api/photo-game/open-games/start/{game_id}")
        assert start_response.status_code == 200, f"Start game failed: {start_response.text}"
        session_id = start_response.json().get("session_id")
        print(f"Session started: {session_id}")
        
        # Step 5: CRITICAL - Verify API returns correct player IDs
        print("\n=== Step 5: CRITICAL - Verify player1_id and player2_id from API ===")
        
        # User 1 (creator) polls session
        session_resp1 = user1_session.get(f"{BASE_URL}/api/photo-game/pvp/session/{session_id}")
        assert session_resp1.status_code == 200, f"User 1 session poll failed: {session_resp1.text}"
        session_data1 = session_resp1.json()
        
        print(f"API Response for User 1:")
        print(f"  player1_id: {session_data1.get('player1_id')}")
        print(f"  player2_id: {session_data1.get('player2_id')}")
        print(f"  User 1 ID: {user1_session.user_id}")
        
        # CRITICAL ASSERTION: Creator should be player1
        assert session_data1.get("player1_id") == user1_session.user_id, \
            f"CRITICAL BUG: Creator should be player1! Got player1_id={session_data1.get('player1_id')}, expected {user1_session.user_id}"
        
        # User 2 (joiner) polls session
        session_resp2 = user2_session.get(f"{BASE_URL}/api/photo-game/pvp/session/{session_id}")
        assert session_resp2.status_code == 200, f"User 2 session poll failed: {session_resp2.text}"
        session_data2 = session_resp2.json()
        
        print(f"\nAPI Response for User 2:")
        print(f"  player1_id: {session_data2.get('player1_id')}")
        print(f"  player2_id: {session_data2.get('player2_id')}")
        print(f"  User 2 ID: {user2_session.user_id}")
        
        # CRITICAL ASSERTION: Joiner should be player2
        assert session_data2.get("player2_id") == user2_session.user_id, \
            f"CRITICAL BUG: Joiner should be player2! Got player2_id={session_data2.get('player2_id')}, expected {user2_session.user_id}"
        
        # Both should see the same player IDs
        assert session_data1.get("player1_id") == session_data2.get("player1_id"), \
            "player1_id mismatch between users!"
        assert session_data1.get("player2_id") == session_data2.get("player2_id"), \
            "player2_id mismatch between users!"
        
        print("\n✅ CRITICAL FIX VERIFIED: API correctly returns player1_id and player2_id")
        print(f"   Creator (User1) = player1_id = {session_data1.get('player1_id')}")
        print(f"   Joiner (User2) = player2_id = {session_data2.get('player2_id')}")
        
    def test_photo_assignment_both_perspectives(self, user1_session, user2_session, user1_photos, user2_photos):
        """
        CRITICAL TEST: Verify photo assignment is correct from BOTH perspectives
        
        - Creator (player1) sees: THEIR photo on left, opponent's on right
        - Joiner (player2) sees: THEIR photo on left, creator's on right
        """
        
        # Create and start a new game
        print("\n=== Creating new game for photo assignment test ===")
        user1_photo_ids = [p.get("mint_id") for p in user1_photos]
        user2_photo_ids = [p.get("mint_id") for p in user2_photos]
        
        create_resp = user1_session.post(f"{BASE_URL}/api/photo-game/open-games/create", json={
            "photo_ids": user1_photo_ids,
            "bet_amount": 0,
            "is_bot_allowed": False
        })
        game_id = create_resp.json().get("game_id")
        
        user2_session.post(f"{BASE_URL}/api/photo-game/open-games/join", json={
            "game_id": game_id,
            "photo_ids": user2_photo_ids
        })
        
        user1_session.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={"game_id": game_id})
        user2_session.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={"game_id": game_id})
        
        time.sleep(0.3)
        start_resp = user1_session.post(f"{BASE_URL}/api/photo-game/open-games/start/{game_id}")
        session_id = start_resp.json().get("session_id")
        
        # Both select their photos
        print("\n=== Both players select their photos ===")
        user1_selected = user1_photos[0]
        user2_selected = user2_photos[0]
        
        print(f"User 1 (Creator) selects: {user1_selected.get('mint_id')}")
        user1_session.post(f"{BASE_URL}/api/photo-game/pvp/select-photo", json={
            "session_id": session_id,
            "photo_id": user1_selected.get("mint_id")
        })
        
        print(f"User 2 (Joiner) selects: {user2_selected.get('mint_id')}")
        select2_resp = user2_session.post(f"{BASE_URL}/api/photo-game/pvp/select-photo", json={
            "session_id": session_id,
            "photo_id": user2_selected.get("mint_id")
        })
        select2_data = select2_resp.json()
        
        # Verify both selected
        assert select2_data.get("both_selected") == True, "Both should have selected"
        
        # Get session state from both perspectives
        print("\n=== CRITICAL: Verify photo assignment from BOTH perspectives ===")
        
        session1 = user1_session.get(f"{BASE_URL}/api/photo-game/pvp/session/{session_id}").json()
        session2 = user2_session.get(f"{BASE_URL}/api/photo-game/pvp/session/{session_id}").json()
        
        # Get the stored photos
        p1_photo = session1.get("player1_photo", {})
        p2_photo = session1.get("player2_photo", {})
        
        print(f"\nStored in DB:")
        print(f"  player1_photo (Creator's): {p1_photo.get('mint_id')}")
        print(f"  player2_photo (Joiner's): {p2_photo.get('mint_id')}")
        
        # CRITICAL: Verify photos are stored correctly
        assert p1_photo.get("mint_id") == user1_selected.get("mint_id"), \
            f"player1_photo should be Creator's photo! Got {p1_photo.get('mint_id')}, expected {user1_selected.get('mint_id')}"
        assert p2_photo.get("mint_id") == user2_selected.get("mint_id"), \
            f"player2_photo should be Joiner's photo! Got {p2_photo.get('mint_id')}, expected {user2_selected.get('mint_id')}"
        
        # Now verify the frontend logic would work correctly
        # Creator (isPlayer1=true): myPhoto = player1_photo, oppPhoto = player2_photo
        # Joiner (isPlayer1=false): myPhoto = player2_photo, oppPhoto = player1_photo
        
        print("\n=== Frontend Photo Assignment Logic ===")
        
        # Creator's perspective
        creator_is_player1 = session1.get("player1_id") == user1_session.user_id
        print(f"\nCreator (User1):")
        print(f"  isPlayer1 = {creator_is_player1}")
        if creator_is_player1:
            creator_my_photo = p1_photo
            creator_opp_photo = p2_photo
        else:
            creator_my_photo = p2_photo
            creator_opp_photo = p1_photo
        print(f"  myPhoto (left): {creator_my_photo.get('mint_id')}")
        print(f"  oppPhoto (right): {creator_opp_photo.get('mint_id')}")
        
        assert creator_my_photo.get("mint_id") == user1_selected.get("mint_id"), \
            f"CRITICAL BUG: Creator should see THEIR photo on left! Got {creator_my_photo.get('mint_id')}"
        assert creator_opp_photo.get("mint_id") == user2_selected.get("mint_id"), \
            f"CRITICAL BUG: Creator should see opponent's photo on right! Got {creator_opp_photo.get('mint_id')}"
        
        # Joiner's perspective
        joiner_is_player1 = session2.get("player1_id") == user2_session.user_id
        print(f"\nJoiner (User2):")
        print(f"  isPlayer1 = {joiner_is_player1}")
        if joiner_is_player1:
            joiner_my_photo = p1_photo
            joiner_opp_photo = p2_photo
        else:
            joiner_my_photo = p2_photo
            joiner_opp_photo = p1_photo
        print(f"  myPhoto (left): {joiner_my_photo.get('mint_id')}")
        print(f"  oppPhoto (right): {joiner_opp_photo.get('mint_id')}")
        
        assert joiner_my_photo.get("mint_id") == user2_selected.get("mint_id"), \
            f"CRITICAL BUG: Joiner should see THEIR photo on left! Got {joiner_my_photo.get('mint_id')}"
        assert joiner_opp_photo.get("mint_id") == user1_selected.get("mint_id"), \
            f"CRITICAL BUG: Joiner should see creator's photo on right! Got {joiner_opp_photo.get('mint_id')}"
        
        print("\n✅ PHOTO ASSIGNMENT FIX VERIFIED:")
        print("   Creator sees: THEIR photo (left) | Opponent's photo (right)")
        print("   Joiner sees: THEIR photo (left) | Creator's photo (right)")
        
    def test_tap_sync_both_players(self, user1_session, user2_session, user1_photos, user2_photos):
        """
        Test that both players' taps are visible to each other via polling
        """
        
        # Create and start a new game
        print("\n=== Creating new game for tap sync test ===")
        user1_photo_ids = [p.get("mint_id") for p in user1_photos]
        user2_photo_ids = [p.get("mint_id") for p in user2_photos]
        
        create_resp = user1_session.post(f"{BASE_URL}/api/photo-game/open-games/create", json={
            "photo_ids": user1_photo_ids,
            "bet_amount": 0,
            "is_bot_allowed": False
        })
        game_id = create_resp.json().get("game_id")
        
        user2_session.post(f"{BASE_URL}/api/photo-game/open-games/join", json={
            "game_id": game_id,
            "photo_ids": user2_photo_ids
        })
        
        user1_session.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={"game_id": game_id})
        user2_session.post(f"{BASE_URL}/api/photo-game/open-games/ready", json={"game_id": game_id})
        
        time.sleep(0.3)
        start_resp = user1_session.post(f"{BASE_URL}/api/photo-game/open-games/start/{game_id}")
        session_id = start_resp.json().get("session_id")
        
        # Both select photos
        user1_session.post(f"{BASE_URL}/api/photo-game/pvp/select-photo", json={
            "session_id": session_id,
            "photo_id": user1_photos[0].get("mint_id")
        })
        user2_session.post(f"{BASE_URL}/api/photo-game/pvp/select-photo", json={
            "session_id": session_id,
            "photo_id": user2_photos[0].get("mint_id")
        })
        
        # Both tap
        print("\n=== Both players tap ===")
        user1_session.post(f"{BASE_URL}/api/photo-game/pvp/tap", json={
            "session_id": session_id,
            "tap_count": 25
        })
        user2_session.post(f"{BASE_URL}/api/photo-game/pvp/tap", json={
            "session_id": session_id,
            "tap_count": 15
        })
        
        # Verify tap sync
        print("\n=== Verify tap sync via polling ===")
        
        tap_state1 = user1_session.get(f"{BASE_URL}/api/photo-game/pvp/tap-state/{session_id}").json()
        tap_state2 = user2_session.get(f"{BASE_URL}/api/photo-game/pvp/tap-state/{session_id}").json()
        
        print(f"User 1 (Creator) sees: my_taps={tap_state1.get('my_taps')}, opponent_taps={tap_state1.get('opponent_taps')}")
        print(f"User 2 (Joiner) sees: my_taps={tap_state2.get('my_taps')}, opponent_taps={tap_state2.get('opponent_taps')}")
        
        # User 1 should see their 25 taps and opponent's 15 taps
        assert tap_state1.get("my_taps") == 25, f"User 1 my_taps should be 25, got {tap_state1.get('my_taps')}"
        assert tap_state1.get("opponent_taps") == 15, f"User 1 opponent_taps should be 15, got {tap_state1.get('opponent_taps')}"
        
        # User 2 should see their 15 taps and opponent's 25 taps
        assert tap_state2.get("my_taps") == 15, f"User 2 my_taps should be 15, got {tap_state2.get('my_taps')}"
        assert tap_state2.get("opponent_taps") == 25, f"User 2 opponent_taps should be 25, got {tap_state2.get('opponent_taps')}"
        
        print("\n✅ TAP SYNC VERIFIED: Both players see each other's taps correctly")


class TestReconnectLimit:
    """Test the reconnect limit fix (max 3 attempts, then polling mode)"""
    
    def test_reconnect_limit_constant(self):
        """Verify MAX_RECONNECT_ATTEMPTS is set to 3 in frontend code"""
        import os
        
        # Read the frontend file
        frontend_file = "/app/frontend/src/components/game/PVPBattleArena.jsx"
        with open(frontend_file, 'r') as f:
            content = f.read()
        
        # Check for MAX_RECONNECT_ATTEMPTS = 3
        assert "MAX_RECONNECT_ATTEMPTS = 3" in content, \
            "MAX_RECONNECT_ATTEMPTS should be set to 3"
        
        # Check for pollingMode state
        assert "pollingMode" in content, \
            "pollingMode state should exist for fallback"
        
        # Check for the reconnect limit logic
        assert "reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS" in content, \
            "Reconnect limit check should exist"
        
        print("✅ RECONNECT LIMIT FIX VERIFIED:")
        print("   MAX_RECONNECT_ATTEMPTS = 3")
        print("   pollingMode fallback exists")
        print("   Reconnect limit check exists")
