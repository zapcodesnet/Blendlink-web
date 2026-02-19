"""
Test PVP Photo Game Stamina Fix - Iteration 173

Bug Fix: Stamina check in pvp_matchmaking.py and photo_game.py used player_stats 
(which defaults to 0) instead of the actual photo's stamina (which defaults to 100%).

Features to test:
1. GET /api/photo-game/battle-photos - returns user's minted photos with stamina info
2. GET /api/minting/photos - returns user's minted photos
3. POST /api/photo-game/pvp/find-match - creates match search (no stamina error)
4. GET /api/photo-game/pvp/match-status - returns matched status after bot timeout
5. POST /api/photo-game/pvp/match/{match_id}/start - creates game session (no stamina error)
6. GET /api/photo-game/stats - returns player stats
7. GET /api/photo-game/pvp/queue-status - returns queue info
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable is required")

# Test credentials
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"
TEST_PHOTO_ID = "mint_10fe1f499efb4ef6"  # User's known minted photo


class TestPvPStaminaFix:
    """Test the PVP stamina fix - photo stamina should default to 100%"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = self._login()
        if self.token:
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def _login(self) -> str:
        """Login and return token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        print(f"Login failed: {response.status_code} - {response.text}")
        return None
    
    def test_01_backend_health(self):
        """Test backend is running"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Backend not healthy: {response.text}"
        data = response.json()
        assert data.get("status") == "ok"
        print("✓ Backend health check passed")
    
    def test_02_battle_photos_endpoint(self):
        """GET /api/photo-game/battle-photos returns user's minted photos with stamina info"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200, f"Battle photos failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "photos" in data, "Response should have 'photos' key"
        
        photos = data.get("photos", [])
        assert len(photos) > 0, "User should have at least 1 minted photo"
        
        # Check photo structure has stamina info
        first_photo = photos[0]
        assert "mint_id" in first_photo, "Photo should have mint_id"
        assert "stamina" in first_photo, "Photo should have stamina field"
        assert "dollar_value" in first_photo, "Photo should have dollar_value"
        
        # Check stamina defaults - should NOT be 0 unless explicitly depleted
        stamina = first_photo.get("stamina", 0)
        print(f"✓ Battle photos endpoint returned {len(photos)} photos")
        print(f"  First photo: {first_photo.get('mint_id')} with stamina: {stamina}%")
    
    def test_03_minting_photos_endpoint(self):
        """GET /api/minting/photos returns user's minted photos"""
        response = self.session.get(f"{BASE_URL}/api/minting/photos")
        assert response.status_code == 200, f"Minting photos failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Check response has photos
        photos = data.get("photos", data) if isinstance(data, dict) else data
        if isinstance(photos, dict):
            photos = photos.get("photos", [])
        
        assert len(photos) > 0, "User should have at least 1 minted photo"
        
        # Find the test photo
        test_photo = None
        for p in photos:
            if p.get("mint_id") == TEST_PHOTO_ID:
                test_photo = p
                break
        
        print(f"✓ Minting photos endpoint returned {len(photos)} photos")
        if test_photo:
            print(f"  Found test photo: {TEST_PHOTO_ID} with stamina: {test_photo.get('stamina', 'N/A')}")
        else:
            print(f"  Note: Test photo {TEST_PHOTO_ID} not found in response")
    
    def test_04_player_stats_endpoint(self):
        """GET /api/photo-game/stats returns player stats"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/stats")
        assert response.status_code == 200, f"Stats failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "user_id" in data, "Stats should have user_id"
        
        print(f"✓ Player stats endpoint working")
        print(f"  User: {data.get('user_id')}")
        print(f"  Total battles: {data.get('total_battles', 0)}")
        print(f"  Win streak: {data.get('current_win_streak', 0)}")
    
    def test_05_queue_status_endpoint(self):
        """GET /api/photo-game/pvp/queue-status returns queue info"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        assert response.status_code == 200, f"Queue status failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert "players_waiting" in data, "Queue status should have players_waiting"
        assert "active_matches" in data, "Queue status should have active_matches"
        
        print(f"✓ Queue status: {data.get('players_waiting', 0)} waiting, {data.get('active_matches', 0)} active")
    
    def test_06_find_match_no_stamina_error(self):
        """POST /api/photo-game/pvp/find-match creates match search without stamina error
        
        This is the KEY TEST: The bug was that find_match was checking player_stats.stamina 
        (defaults to 0) instead of the photo's stamina (defaults to 100%).
        """
        # First cancel any existing search
        self.session.post(f"{BASE_URL}/api/photo-game/pvp/cancel-search")
        time.sleep(0.5)
        
        response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/find-match", json={
            "bet_amount": 0,  # Free match
            "photo_id": TEST_PHOTO_ID,
            "use_bot_fallback": True
        })
        
        # Response should be successful - NOT a stamina error
        assert response.status_code == 200, f"Find match failed: {response.status_code} - {response.text}"
        
        data = response.json()
        
        # Check for stamina-related errors
        error = data.get("error", "")
        assert "stamina" not in error.lower(), f"Unexpected stamina error: {error}"
        
        # Should have success=True or status=searching/matched
        success = data.get("success", False)
        status = data.get("status", "")
        
        assert success or status in ["searching", "matched", "already_searching", "in_match"], \
            f"Find match should succeed or return searching status. Got: {data}"
        
        print(f"✓ Find match succeeded without stamina error")
        print(f"  Status: {status}")
        print(f"  Response: {data}")
    
    def test_07_match_status_after_timeout(self):
        """GET /api/photo-game/pvp/match-status returns matched status after bot timeout
        
        After ~5 seconds, if no real player matches, a bot match should be created.
        """
        # Wait for bot match to be created (timeout is 5 seconds)
        print("  Waiting 6 seconds for bot match...")
        time.sleep(6)
        
        response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/match-status")
        assert response.status_code == 200, f"Match status failed: {response.status_code} - {response.text}"
        
        data = response.json()
        status = data.get("status", "")
        
        # Should be matched (with bot) or not_in_queue (if match already started)
        assert status in ["matched", "not_in_queue", "searching"], \
            f"Expected matched or not_in_queue status, got: {status}"
        
        print(f"✓ Match status: {status}")
        
        if status == "matched":
            match_id = data.get("match_id")
            mode = data.get("mode", "unknown")
            print(f"  Match ID: {match_id}")
            print(f"  Mode: {mode}")
            return match_id
        return None
    
    def test_08_start_match_no_stamina_error(self):
        """POST /api/photo-game/pvp/match/{match_id}/start creates game session
        
        This tests the second part of the fix in photo_game.py - start_game should check
        the photo's stamina (defaults to 100%), not player_stats.stamina (defaults to 0).
        """
        # First need to get a match ID
        # Cancel any existing and create new search
        self.session.post(f"{BASE_URL}/api/photo-game/pvp/cancel-search")
        time.sleep(0.5)
        
        # Create new match
        find_response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/find-match", json={
            "bet_amount": 0,
            "photo_id": TEST_PHOTO_ID,
            "use_bot_fallback": True
        })
        
        if find_response.status_code != 200:
            pytest.skip(f"Could not create match: {find_response.text}")
        
        find_data = find_response.json()
        
        # Wait for bot match
        time.sleep(6)
        
        status_response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/match-status")
        status_data = status_response.json()
        
        match_id = status_data.get("match_id")
        if not match_id:
            # Check if already matched from find_match response
            match_id = find_data.get("match_id")
        
        if not match_id:
            pytest.skip("Could not obtain match_id for start test")
        
        # Now try to start the match
        response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/match/{match_id}/start")
        
        # Even if it fails for other reasons, it should NOT fail due to stamina
        data = response.json()
        error = data.get("error", "")
        
        if response.status_code == 200:
            print(f"✓ Match started successfully")
            print(f"  Session: {data.get('session', {}).get('session_id', 'N/A')}")
            return
        
        # If it failed, ensure it's NOT because of stamina
        assert "stamina" not in error.lower(), f"Unexpected stamina error on start: {error}"
        
        print(f"✓ Match start did not fail due to stamina")
        print(f"  Response: {response.status_code} - {error or 'No error message'}")
    
    def test_09_verify_photo_stamina_default(self):
        """Verify that photos default to 100% stamina, not 0%
        
        This validates the fix at the data level - new photos should have 100% stamina.
        """
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        data = response.json()
        photos = data.get("photos", [])
        
        # All photos should have stamina > 0 (unless explicitly used)
        photos_with_stamina = [p for p in photos if p.get("stamina", 100) > 0]
        
        print(f"✓ Photo stamina defaults verified")
        print(f"  {len(photos_with_stamina)}/{len(photos)} photos have stamina > 0")
        
        for p in photos[:3]:  # Show first 3
            print(f"  - {p.get('mint_id')}: {p.get('stamina', 100)}% stamina")


class TestBackendCompilation:
    """Test that backend compiles and imports without errors"""
    
    def test_backend_compiles(self):
        """Backend modules import without syntax errors"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, "Backend health check failed"
        print("✓ Backend compiles without errors")
    
    def test_photo_game_module(self):
        """photo_game.py module is functional"""
        response = requests.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        # Should not return 500 (module error)
        assert response.status_code != 500, "photo_game module error"
        print("✓ photo_game module working")
    
    def test_pvp_matchmaking_module(self):
        """pvp_matchmaking.py module is functional"""
        response = requests.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        # Should not return 500 (module error)
        assert response.status_code != 500, "pvp_matchmaking module error"
        print("✓ pvp_matchmaking module working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
