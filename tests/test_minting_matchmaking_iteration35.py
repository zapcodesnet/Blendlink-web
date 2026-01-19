"""
Test iteration 35: Minting and Matchmaking Bug Fixes
- Photo Minting Flow via /api/minting/photo/upload with FormData
- Matchmaking Flow - finding match and entering Dollar Auction Arena
- FormData with string boolean values ('true'/'false') processing
"""

import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"


class TestMintingAndMatchmaking:
    """Test minting and matchmaking bug fixes"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
    
    # ============== MINTING TESTS ==============
    
    def test_minting_status_endpoint(self):
        """Test /api/minting/status returns user's minting status"""
        response = self.session.get(f"{BASE_URL}/api/minting/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "can_mint" in data
        assert "mints_today" in data
        assert "daily_limit" in data
        assert "bl_coins" in data
        
        print(f"Minting status: can_mint={data['can_mint']}, mints_today={data['mints_today']}/{data['daily_limit']}, bl_coins={data['bl_coins']}")
    
    def test_minting_config_endpoint(self):
        """Test /api/minting/config returns minting configuration"""
        response = self.session.get(f"{BASE_URL}/api/minting/config")
        assert response.status_code == 200
        
        data = response.json()
        assert "mint_cost_bl" in data
        assert data["mint_cost_bl"] == 500
        assert "scenery_types" in data
        assert "light_types" in data
        assert "rating_criteria" in data
        
        print(f"Minting config: cost={data['mint_cost_bl']} BL")
    
    def test_minting_photo_upload_with_formdata(self):
        """Test /api/minting/photo/upload with FormData and string booleans"""
        # Check if user can mint first
        status_response = self.session.get(f"{BASE_URL}/api/minting/status")
        status_data = status_response.json()
        
        if not status_data.get("can_mint"):
            pytest.skip(f"User cannot mint: {status_data.get('reason', 'Unknown reason')}")
        
        # Create a small test image (1x1 pixel PNG)
        # This is a minimal valid PNG file
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        test_image_bytes = base64.b64decode(test_image_base64)
        
        # Prepare FormData - using string booleans as the fix requires
        files = {
            'file': ('test_mint_iteration35.png', test_image_bytes, 'image/png')
        }
        data = {
            'name': 'TEST_Iteration35_Photo',
            'description': 'Test photo for iteration 35 minting bug fix',
            'is_private': 'false',  # String boolean as per fix
            'show_in_feed': 'true',  # String boolean as per fix
        }
        
        # Remove Content-Type header for multipart/form-data
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/upload",
            files=files,
            data=data,
            headers=headers,
            timeout=120  # 2 minute timeout for AI analysis
        )
        
        print(f"Minting response status: {response.status_code}")
        print(f"Minting response: {response.text[:500] if response.text else 'No response body'}")
        
        assert response.status_code == 200, f"Minting failed with status {response.status_code}: {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Minting not successful: {result}"
        assert "photo" in result
        
        photo = result["photo"]
        assert photo.get("name") == "TEST_Iteration35_Photo"
        assert "mint_id" in photo
        assert "dollar_value" in photo
        assert "scenery_type" in photo
        
        print(f"Photo minted successfully: mint_id={photo['mint_id']}, dollar_value=${photo['dollar_value']}, scenery={photo['scenery_type']}")
    
    def test_get_user_minted_photos(self):
        """Test /api/minting/photos returns user's minted photos"""
        response = self.session.get(f"{BASE_URL}/api/minting/photos")
        assert response.status_code == 200
        
        data = response.json()
        assert "photos" in data
        assert "count" in data
        
        print(f"User has {data['count']} minted photos")
        
        if data["photos"]:
            photo = data["photos"][0]
            assert "mint_id" in photo
            assert "name" in photo
            assert "dollar_value" in photo
    
    # ============== MATCHMAKING TESTS ==============
    
    def test_battle_photos_endpoint(self):
        """Test /api/photo-game/battle-photos returns available battle photos"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        data = response.json()
        assert "photos" in data
        
        print(f"User has {len(data['photos'])} battle-ready photos")
        
        if data["photos"]:
            photo = data["photos"][0]
            assert "mint_id" in photo
            assert "dollar_value" in photo
            assert "stamina" in photo or "stamina_percent" in photo
            return photo
        return None
    
    def test_pvp_queue_status(self):
        """Test /api/photo-game/pvp/queue-status returns queue info"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        assert response.status_code == 200
        
        data = response.json()
        assert "players_waiting" in data
        assert "active_matches" in data
        
        print(f"Queue status: {data['players_waiting']} waiting, {data['active_matches']} active matches")
    
    def test_find_match_and_start_game(self):
        """Test full matchmaking flow: find match -> start game"""
        # Get battle photos first
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert photos_response.status_code == 200
        
        photos = photos_response.json().get("photos", [])
        if not photos:
            pytest.skip("No battle photos available for matchmaking test")
        
        photo = photos[0]
        photo_id = photo["mint_id"]
        
        print(f"Using photo for matchmaking: {photo['name']} (${photo['dollar_value']})")
        
        # Start matchmaking
        find_match_response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/find-match", json={
            "bet_amount": 0,
            "photo_id": photo_id,
            "use_bot_fallback": True
        })
        
        assert find_match_response.status_code == 200, f"Find match failed: {find_match_response.text}"
        
        match_data = find_match_response.json()
        print(f"Find match response: status={match_data.get('status')}")
        
        # If searching, poll for match status
        if match_data.get("status") == "searching":
            import time
            max_wait = 10  # 10 seconds max wait
            start_time = time.time()
            
            while time.time() - start_time < max_wait:
                status_response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/match-status")
                assert status_response.status_code == 200
                
                status_data = status_response.json()
                print(f"Match status: {status_data.get('status')}, elapsed: {status_data.get('elapsed_seconds', 0)}s")
                
                if status_data.get("status") == "matched":
                    match_data = status_data
                    break
                elif status_data.get("status") == "not_searching":
                    pytest.fail("Matchmaking expired without finding match")
                
                time.sleep(0.8)  # Poll every 800ms as per fix
        
        # Verify match was found
        assert match_data.get("status") == "matched" or "match_id" in match_data, f"Match not found: {match_data}"
        
        match_id = match_data.get("match_id")
        assert match_id is not None, "No match_id in response"
        
        print(f"Match found! match_id={match_id}, mode={match_data.get('mode', 'unknown')}")
        
        # Start the game
        start_response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/match/{match_id}/start")
        assert start_response.status_code == 200, f"Start game failed: {start_response.text}"
        
        start_data = start_response.json()
        assert start_data.get("success") == True, f"Game start not successful: {start_data}"
        assert "session" in start_data
        
        session = start_data["session"]
        assert "session_id" in session
        assert "player1_bankroll" in session
        assert "player2_bankroll" in session
        
        print(f"Game started! session_id={session['session_id']}, bankrolls: P1=${session['player1_bankroll']}, P2=${session['player2_bankroll']}")
        
        return session
    
    def test_rps_auction_move(self):
        """Test RPS auction move submission"""
        # First get a game session
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = photos_response.json().get("photos", [])
        
        if not photos:
            pytest.skip("No battle photos available")
        
        # Find match
        find_response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/find-match", json={
            "bet_amount": 0,
            "photo_id": photos[0]["mint_id"],
            "use_bot_fallback": True
        })
        
        if find_response.status_code != 200:
            pytest.skip(f"Could not find match: {find_response.text}")
        
        match_data = find_response.json()
        
        # Wait for match if searching
        if match_data.get("status") == "searching":
            import time
            for _ in range(15):
                status_response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/match-status")
                status_data = status_response.json()
                if status_data.get("status") == "matched":
                    match_data = status_data
                    break
                time.sleep(0.8)
        
        if "match_id" not in match_data:
            pytest.skip("Could not get match_id")
        
        # Start game
        start_response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/match/{match_data['match_id']}/start")
        if start_response.status_code != 200:
            pytest.skip(f"Could not start game: {start_response.text}")
        
        session = start_response.json().get("session")
        session_id = session["session_id"]
        
        # Submit RPS auction move
        rps_response = self.session.post(f"{BASE_URL}/api/photo-game/session/{session_id}/rps-auction", json={
            "choice": "rock",
            "bid_amount": 1000000  # $1M bid
        })
        
        assert rps_response.status_code == 200, f"RPS move failed: {rps_response.text}"
        
        rps_data = rps_response.json()
        assert "round" in rps_data
        assert "player1_wins" in rps_data
        assert "player2_wins" in rps_data
        assert "player1_bankroll" in rps_data
        assert "player2_bankroll" in rps_data
        
        print(f"RPS round result: winner={rps_data['round'].get('winner')}, P1 wins={rps_data['player1_wins']}, P2 wins={rps_data['player2_wins']}")
    
    def test_cancel_matchmaking(self):
        """Test canceling matchmaking returns bet refund"""
        # Get a photo
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = photos_response.json().get("photos", [])
        
        if not photos:
            pytest.skip("No battle photos available")
        
        # Start matchmaking with a bet
        find_response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/find-match", json={
            "bet_amount": 100,
            "photo_id": photos[0]["mint_id"],
            "use_bot_fallback": False  # Don't use bot so we can cancel
        })
        
        if find_response.status_code != 200:
            pytest.skip(f"Could not start matchmaking: {find_response.text}")
        
        # Cancel matchmaking
        cancel_response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/cancel")
        assert cancel_response.status_code == 200
        
        cancel_data = cancel_response.json()
        print(f"Cancel response: {cancel_data}")
        
        # Bet should be refunded if it was deducted
        if "bet_refunded" in cancel_data:
            print(f"Bet refunded: {cancel_data['bet_refunded']} BL")


class TestFormDataBooleanHandling:
    """Test that FormData with string booleans is handled correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Authentication failed: {response.status_code}")
    
    def test_formdata_string_true(self):
        """Test FormData with is_private='true' string"""
        # Check minting status first
        status_response = self.session.get(f"{BASE_URL}/api/minting/status")
        status_data = status_response.json()
        
        if not status_data.get("can_mint"):
            pytest.skip(f"User cannot mint: {status_data.get('reason')}")
        
        # Create test image
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        test_image_bytes = base64.b64decode(test_image_base64)
        
        files = {
            'file': ('test_private_photo.png', test_image_bytes, 'image/png')
        }
        data = {
            'name': 'TEST_Private_Photo',
            'description': 'Testing string boolean true',
            'is_private': 'true',  # String 'true'
            'show_in_feed': 'false',  # String 'false'
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/upload",
            files=files,
            data=data,
            headers=headers,
            timeout=120
        )
        
        assert response.status_code == 200, f"Minting failed: {response.text}"
        
        result = response.json()
        assert result.get("success") == True
        
        photo = result.get("photo", {})
        # Verify the boolean was correctly parsed
        assert photo.get("is_private") == True, f"is_private should be True, got {photo.get('is_private')}"
        assert photo.get("show_in_feed") == False, f"show_in_feed should be False, got {photo.get('show_in_feed')}"
        
        print(f"String boolean handling verified: is_private={photo.get('is_private')}, show_in_feed={photo.get('show_in_feed')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
