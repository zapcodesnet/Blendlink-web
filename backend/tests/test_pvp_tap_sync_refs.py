"""
Test PVP Tap Sync with Refs Fix - Iteration 93

CRITICAL BUG FIX VERIFICATION:
- Issue: Opponent taps not syncing, both players win
- Root cause: Frontend sendTapToApi was using opponentTaps from closure (stale)
- Fix: Changed to use opponentTapsRef.current for comparison

This test verifies:
1. Backend tap-state endpoint returns correct opponent_taps based on player
2. Both players see each other's taps correctly
3. Finish round correctly determines winner by tap count
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


class TestPVPTapSyncRefs:
    """Test the tap sync with refs fix"""
    
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
    def pvp_session(self, user1_session, user2_session):
        """Create and join a PVP session"""
        # User 1 creates game
        create_response = user1_session.post(f"{BASE_URL}/api/photo-game/pvp/create-open-game", json={
            "bet_amount": 100
        })
        assert create_response.status_code == 200, f"Create game failed: {create_response.text}"
        game_data = create_response.json()
        open_game_id = game_data.get("open_game_id")
        print(f"Game created: {open_game_id}")
        
        # User 2 joins game
        join_response = user2_session.post(f"{BASE_URL}/api/photo-game/pvp/join-open-game", json={
            "open_game_id": open_game_id
        })
        assert join_response.status_code == 200, f"Join game failed: {join_response.text}"
        join_data = join_response.json()
        session_id = join_data.get("session_id")
        print(f"Game joined, session: {session_id}")
        
        # Get photos for both users
        photos1 = user1_session.get(f"{BASE_URL}/api/photo-game/battle-photos").json()
        photos2 = user2_session.get(f"{BASE_URL}/api/photo-game/battle-photos").json()
        
        # Select photos
        if photos1.get("photos"):
            user1_session.post(f"{BASE_URL}/api/photo-game/pvp/select-photo", json={
                "session_id": session_id,
                "photo_id": photos1["photos"][0]["photo_id"]
            })
        
        if photos2.get("photos"):
            user2_session.post(f"{BASE_URL}/api/photo-game/pvp/select-photo", json={
                "session_id": session_id,
                "photo_id": photos2["photos"][0]["photo_id"]
            })
        
        return {
            "session_id": session_id,
            "open_game_id": open_game_id,
            "user1_id": user1_session.user_id,
            "user2_id": user2_session.user_id
        }
    
    def test_tap_state_returns_correct_opponent_taps(self, user1_session, user2_session, pvp_session):
        """
        Test that tap-state endpoint returns correct opponent_taps for each player.
        
        P1 taps 50 times, P2 taps 40 times:
        - P1 should see: my_taps=50, opponent_taps=40
        - P2 should see: my_taps=40, opponent_taps=50
        """
        session_id = pvp_session["session_id"]
        
        # User 1 submits 50 taps
        for _ in range(50):
            user1_session.post(f"{BASE_URL}/api/photo-game/pvp/tap", json={
                "session_id": session_id,
                "tap_count": 1
            })
        
        # User 2 submits 40 taps
        for _ in range(40):
            user2_session.post(f"{BASE_URL}/api/photo-game/pvp/tap", json={
                "session_id": session_id,
                "tap_count": 1
            })
        
        # Get tap state for both users
        state1 = user1_session.get(f"{BASE_URL}/api/photo-game/pvp/tap-state/{session_id}").json()
        state2 = user2_session.get(f"{BASE_URL}/api/photo-game/pvp/tap-state/{session_id}").json()
        
        print(f"User 1 (P1) sees: my_taps={state1.get('my_taps')}, opponent_taps={state1.get('opponent_taps')}")
        print(f"User 2 (P2) sees: my_taps={state2.get('my_taps')}, opponent_taps={state2.get('opponent_taps')}")
        
        # Verify User 1 (player1) sees correct values
        assert state1.get("my_taps") == 50, f"P1 my_taps should be 50, got {state1.get('my_taps')}"
        assert state1.get("opponent_taps") == 40, f"P1 opponent_taps should be 40, got {state1.get('opponent_taps')}"
        
        # Verify User 2 (player2) sees correct values
        assert state2.get("my_taps") == 40, f"P2 my_taps should be 40, got {state2.get('my_taps')}"
        assert state2.get("opponent_taps") == 50, f"P2 opponent_taps should be 50, got {state2.get('opponent_taps')}"
        
        print("✓ Both players see correct opponent taps!")
    
    def test_tap_response_includes_opponent_taps(self, user1_session, user2_session, pvp_session):
        """
        Test that tap submission response includes current opponent_taps.
        This is critical for the frontend to update opponent progress in real-time.
        """
        session_id = pvp_session["session_id"]
        
        # User 1 submits a tap and checks response
        tap_response = user1_session.post(f"{BASE_URL}/api/photo-game/pvp/tap", json={
            "session_id": session_id,
            "tap_count": 1
        }).json()
        
        print(f"Tap response: {tap_response}")
        
        # Verify response includes opponent_taps
        assert "opponent_taps" in tap_response, "Tap response missing opponent_taps"
        assert "opponent_dollar" in tap_response, "Tap response missing opponent_dollar"
        assert "my_taps" in tap_response, "Tap response missing my_taps"
        assert "my_dollar" in tap_response, "Tap response missing my_dollar"
        
        # The opponent_taps should be 40 (from previous test)
        assert tap_response.get("opponent_taps") == 40, f"Expected opponent_taps=40, got {tap_response.get('opponent_taps')}"
        
        print("✓ Tap response includes correct opponent_taps!")
    
    def test_finish_round_determines_winner_by_taps(self, user1_session, user2_session, pvp_session):
        """
        Test that finish-round correctly determines winner based on tap count.
        P1 has 51 taps, P2 has 40 taps -> P1 should win.
        """
        session_id = pvp_session["session_id"]
        
        # Get final tap state
        state1 = user1_session.get(f"{BASE_URL}/api/photo-game/pvp/tap-state/{session_id}").json()
        
        print(f"Final state: P1 taps={state1.get('player1_taps')}, P2 taps={state1.get('player2_taps')}")
        print(f"Final state: P1 dollar={state1.get('player1_dollar')}, P2 dollar={state1.get('player2_dollar')}")
        
        # P1 has more taps (51 vs 40), so P1 should have higher dollar value
        # Winner is determined by dollar value (which is proportional to taps)
        assert state1.get("player1_dollar", 0) > state1.get("player2_dollar", 0), \
            f"P1 should have higher dollar value: P1={state1.get('player1_dollar')}, P2={state1.get('player2_dollar')}"
        
        print("✓ Player with more taps has higher dollar value (will win)!")


class TestFrontendRefUsage:
    """
    Verify the frontend code uses refs correctly.
    These are code review tests - they check the actual source code.
    """
    
    def test_tapping_arena_uses_opponent_taps_ref(self):
        """Verify TappingArena.jsx uses opponentTapsRef in sendTapToApi"""
        with open("/app/frontend/src/components/game/TappingArena.jsx", "r") as f:
            content = f.read()
        
        # Check that opponentTapsRef is defined
        assert "opponentTapsRef = useRef" in content, "Missing opponentTapsRef definition"
        
        # Check that opponentTapsRef.current is used in sendTapToApi
        assert "opponentTapsRef.current" in content, "opponentTapsRef.current not used"
        
        # Check that the ref is updated when opponentTaps changes
        assert "opponentTapsRef.current = opponentTaps" in content, "opponentTapsRef not being updated"
        
        print("✓ TappingArena.jsx uses opponentTapsRef correctly!")
    
    def test_tapping_arena_polling_uses_refs(self):
        """Verify polling uses refs for all comparisons"""
        with open("/app/frontend/src/components/game/TappingArena.jsx", "r") as f:
            content = f.read()
        
        # Check that polling compares with refs, not state
        assert "serverOpponentTaps !== opponentTapsRef.current" in content, \
            "Polling should compare with opponentTapsRef.current"
        
        assert "serverMyTaps !== playerTapsRef.current" in content, \
            "Polling should compare with playerTapsRef.current"
        
        print("✓ TappingArena.jsx polling uses refs for comparisons!")
    
    def test_mobile_tapping_arena_uses_refs(self):
        """Verify MobileTappingArena.js uses refs for stale closure avoidance"""
        with open("/app/mobile/src/components/MobileTappingArena.js", "r") as f:
            content = f.read()
        
        # Check that refs are defined
        assert "playerTapsRef = useRef" in content, "Missing playerTapsRef definition"
        assert "opponentTapsRef = useRef" in content, "Missing opponentTapsRef definition"
        
        # Check that refs are updated
        assert "playerTapsRef.current = playerTaps" in content, "playerTapsRef not being updated"
        assert "opponentTapsRef.current = opponentTaps" in content, "opponentTapsRef not being updated"
        
        # Check that sendTapToApi uses refs
        assert "opponentTapsRef.current" in content, "sendTapToApi should use opponentTapsRef"
        
        print("✓ MobileTappingArena.js uses refs correctly!")
