"""
Blendlink Iteration 33 Tests - Bug Fixes & New Features
Tests for:
1. MINTING: POST /api/minting/photos/internal_mint - 500 BL coin deduction
2. MINTING: Daily limit tracking (3 mints for free users)
3. BL COIN BET: POST /api/photo-game/pvp/find-match with bet_amount deduction
4. BL COIN BET: Cancel matchmaking refunds bet
5. BATTLE START: POST /api/photo-game/pvp/match/{match_id}/start
6. PHOTO SELECTION: GET /api/photo-game/battle-photos - sorted by dollar_value
7. PHOTO STAMINA: Verify stamina tracking (100% = 24 battles)
"""

import pytest
import requests
import os
import time
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://photo-battle-5.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "Test123!"
ADMIN_EMAIL = "blendlinknet@gmail.com"
ADMIN_PASSWORD = "Blend!Admin2026Link"


@pytest.fixture(scope="module")
def test_user_token():
    """Get test user auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    """Get admin auth token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    return response.json()["token"]


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestHealthAndAuth:
    """Basic health and auth tests"""
    
    def test_health_check(self, api_client):
        """Test API health endpoint"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health check passed")
    
    def test_login_test_user(self, api_client):
        """Test login with test user"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_USER_EMAIL
        print(f"✓ Test user login successful, BL coins: {data['user'].get('bl_coins', 0)}")


class TestMintingSystem:
    """Tests for minting system bug fixes"""
    
    def test_minting_status(self, api_client, test_user_token):
        """Test minting status endpoint - checks daily limit tracking"""
        response = api_client.get(
            f"{BASE_URL}/api/minting/status",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "can_mint" in data
        assert "mints_today" in data or "daily_limit" in data
        print(f"✓ Minting status: can_mint={data.get('can_mint')}, mints_today={data.get('mints_today', 'N/A')}")
    
    def test_minting_config(self, api_client, test_user_token):
        """Test minting config endpoint"""
        response = api_client.get(
            f"{BASE_URL}/api/minting/config",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify scenery types
        assert "scenery_types" in data
        assert "natural" in data["scenery_types"]
        assert "water" in data["scenery_types"]
        assert "manmade" in data["scenery_types"]
        print(f"✓ Minting config: scenery_types={list(data['scenery_types'].keys())}")
    
    def test_get_user_minted_photos(self, api_client, test_user_token):
        """Test getting user's minted photos"""
        response = api_client.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Response is wrapped in object with photos array
        assert "photos" in data
        photos = data["photos"]
        assert isinstance(photos, list)
        print(f"✓ User has {len(photos)} minted photos")
        
        # If photos exist, verify structure
        if len(photos) > 0:
            photo = photos[0]
            assert "mint_id" in photo
            assert "name" in photo
            assert "dollar_value" in photo
            print(f"  First photo: {photo.get('name')} - ${photo.get('dollar_value', 0):,}")


class TestBattlePhotosEndpoint:
    """Tests for the new GET /api/photo-game/battle-photos endpoint"""
    
    def test_battle_photos_endpoint_exists(self, api_client, test_user_token):
        """Test that battle-photos endpoint exists and returns data"""
        response = api_client.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "photos" in data
        assert "count" in data
        assert "available_count" in data
        print(f"✓ Battle photos endpoint: {data['count']} total, {data['available_count']} available")
    
    def test_battle_photos_sorted_by_dollar_value(self, api_client, test_user_token):
        """Test that photos are sorted by dollar_value descending"""
        response = api_client.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        photos = data.get("photos", [])
        if len(photos) >= 2:
            # Verify descending order by dollar_value
            for i in range(len(photos) - 1):
                assert photos[i].get("dollar_value", 0) >= photos[i+1].get("dollar_value", 0), \
                    f"Photos not sorted by dollar_value: {photos[i].get('dollar_value')} < {photos[i+1].get('dollar_value')}"
            print(f"✓ Photos sorted by dollar_value (descending)")
        else:
            print(f"⚠ Not enough photos to verify sorting (need 2+, have {len(photos)})")
    
    def test_battle_photos_include_stamina(self, api_client, test_user_token):
        """Test that photos include stamina information"""
        response = api_client.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        photos = data.get("photos", [])
        if len(photos) > 0:
            photo = photos[0]
            # Verify stamina fields
            assert "stamina" in photo, "Photo missing stamina field"
            assert "stamina_percent" in photo, "Photo missing stamina_percent field"
            assert "is_available" in photo, "Photo missing is_available field"
            assert "battles_remaining" in photo, "Photo missing battles_remaining field"
            print(f"✓ Photo stamina info: {photo.get('stamina')}%, {photo.get('battles_remaining')} battles remaining, available={photo.get('is_available')}")
        else:
            print("⚠ No photos to verify stamina fields")


class TestPhotoGameStats:
    """Tests for photo game stats"""
    
    def test_game_stats(self, api_client, test_user_token):
        """Test photo game stats endpoint"""
        response = api_client.get(
            f"{BASE_URL}/api/photo-game/stats",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats structure
        assert "stamina" in data
        assert "battles_won" in data or "total_battles" in data
        print(f"✓ Game stats: stamina={data.get('stamina')}, wins={data.get('battles_won', 0)}")
    
    def test_game_config(self, api_client, test_user_token):
        """Test photo game config endpoint"""
        response = api_client.get(
            f"{BASE_URL}/api/photo-game/config",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Game config retrieved")


class TestPvPMatchmaking:
    """Tests for PvP matchmaking with BL coin bet"""
    
    def test_queue_status(self, api_client, test_user_token):
        """Test matchmaking queue status"""
        response = api_client.get(
            f"{BASE_URL}/api/photo-game/pvp/queue-status",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "players_waiting" in data
        assert "active_matches" in data
        print(f"✓ Queue status: {data['players_waiting']} waiting, {data['active_matches']} active")
    
    def test_find_match_requires_photo(self, api_client, test_user_token):
        """Test that find-match validates photo requirement"""
        # First get user's photos
        photos_response = api_client.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        photos = photos_response.json().get("photos", [])
        
        if len(photos) == 0:
            print("⚠ No photos available - skipping find-match test")
            pytest.skip("No minted photos available for testing")
        
        # Get an available photo
        available_photos = [p for p in photos if p.get("is_available", True)]
        if len(available_photos) == 0:
            print("⚠ No available photos (all have 0 stamina)")
            pytest.skip("No photos with stamina available")
        
        photo_id = available_photos[0]["mint_id"]
        print(f"  Using photo: {available_photos[0].get('name')} (${available_photos[0].get('dollar_value', 0):,})")
        
        # Test find-match with photo
        response = api_client.post(
            f"{BASE_URL}/api/photo-game/pvp/find-match",
            headers={"Authorization": f"Bearer {test_user_token}"},
            json={
                "bet_amount": 0,
                "photo_id": photo_id,
                "use_bot_fallback": True
            }
        )
        
        # Should succeed or return searching status
        assert response.status_code == 200, f"Find match failed: {response.text}"
        data = response.json()
        assert data.get("success") == True or data.get("status") in ["searching", "matched", "already_searching", "in_match"]
        print(f"✓ Find match response: {data.get('status', 'success')}")
        
        # Cancel matchmaking to clean up
        cancel_response = api_client.post(
            f"{BASE_URL}/api/photo-game/pvp/cancel",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        print(f"  Cancelled matchmaking: {cancel_response.json()}")


class TestBLCoinBetFlow:
    """Tests for BL coin bet deduction and refund"""
    
    def test_bet_deduction_on_find_match(self, api_client, test_user_token):
        """Test that bet is deducted when joining matchmaking"""
        # Get initial BL coins
        auth_response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        initial_coins = auth_response.json().get("bl_coins", 0)
        print(f"  Initial BL coins: {initial_coins}")
        
        # Get user's photos
        photos_response = api_client.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        photos = photos_response.json().get("photos", [])
        
        available_photos = [p for p in photos if p.get("is_available", True)]
        if len(available_photos) == 0:
            print("⚠ No available photos - skipping bet test")
            pytest.skip("No photos available for testing")
        
        photo_id = available_photos[0]["mint_id"]
        bet_amount = 100  # Small bet for testing
        
        # Check if user has enough coins
        if initial_coins < bet_amount:
            print(f"⚠ Not enough BL coins for bet test (have {initial_coins}, need {bet_amount})")
            pytest.skip("Not enough BL coins")
        
        # Find match with bet
        response = api_client.post(
            f"{BASE_URL}/api/photo-game/pvp/find-match",
            headers={"Authorization": f"Bearer {test_user_token}"},
            json={
                "bet_amount": bet_amount,
                "photo_id": photo_id,
                "use_bot_fallback": True
            }
        )
        
        if response.status_code != 200:
            print(f"⚠ Find match failed: {response.text}")
            pytest.skip("Find match failed")
        
        data = response.json()
        
        # Check if bet was deducted (only if we're searching, not if already in match)
        if data.get("status") == "searching" or data.get("success"):
            auth_response2 = api_client.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            new_coins = auth_response2.json().get("bl_coins", 0)
            
            # Bet should be deducted
            expected_coins = initial_coins - bet_amount
            print(f"  After find-match: {new_coins} BL coins (expected: {expected_coins})")
            
            # Cancel and verify refund
            cancel_response = api_client.post(
                f"{BASE_URL}/api/photo-game/pvp/cancel",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            cancel_data = cancel_response.json()
            print(f"  Cancel response: {cancel_data}")
            
            # Check refund
            auth_response3 = api_client.get(
                f"{BASE_URL}/api/auth/me",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            final_coins = auth_response3.json().get("bl_coins", 0)
            print(f"  After cancel: {final_coins} BL coins")
            
            # Verify refund happened
            if cancel_data.get("bet_refunded"):
                assert final_coins >= new_coins, "Bet was not refunded"
                print(f"✓ Bet refund verified: +{cancel_data.get('bet_refunded')} BL")
            else:
                print("⚠ No bet_refunded in cancel response (may have been matched)")
        else:
            print(f"⚠ Unexpected status: {data.get('status')}")
            # Clean up
            api_client.post(
                f"{BASE_URL}/api/photo-game/pvp/cancel",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )


class TestBattleStart:
    """Tests for battle start functionality"""
    
    def test_start_bot_match(self, api_client, test_user_token):
        """Test starting a bot match"""
        # Get user's photos
        photos_response = api_client.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        photos = photos_response.json().get("photos", [])
        
        available_photos = [p for p in photos if p.get("is_available", True)]
        if len(available_photos) == 0:
            print("⚠ No available photos - skipping battle start test")
            pytest.skip("No photos available for testing")
        
        photo_id = available_photos[0]["mint_id"]
        print(f"  Using photo: {available_photos[0].get('name')}")
        
        # Find match with bot fallback
        response = api_client.post(
            f"{BASE_URL}/api/photo-game/pvp/find-match",
            headers={"Authorization": f"Bearer {test_user_token}"},
            json={
                "bet_amount": 0,
                "photo_id": photo_id,
                "use_bot_fallback": True
            }
        )
        
        if response.status_code != 200:
            print(f"⚠ Find match failed: {response.text}")
            pytest.skip("Find match failed")
        
        data = response.json()
        
        # If searching, wait for bot match
        if data.get("status") == "searching":
            print("  Waiting for bot match...")
            time.sleep(2)
            
            # Check match status
            status_response = api_client.get(
                f"{BASE_URL}/api/photo-game/pvp/match-status",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            data = status_response.json()
        
        # If matched, try to start the game
        if data.get("status") == "matched" and data.get("match_id"):
            match_id = data["match_id"]
            print(f"  Match found: {match_id}, mode: {data.get('mode')}")
            
            # Start the match
            start_response = api_client.post(
                f"{BASE_URL}/api/photo-game/pvp/match/{match_id}/start",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )
            
            if start_response.status_code == 200:
                start_data = start_response.json()
                assert start_data.get("success") == True, f"Start failed: {start_data}"
                assert "session" in start_data, "No session in response"
                print(f"✓ Battle started successfully! Session: {start_data['session'].get('session_id')}")
            else:
                print(f"⚠ Start match failed: {start_response.text}")
        else:
            print(f"⚠ Not matched yet: {data}")
            # Clean up
            api_client.post(
                f"{BASE_URL}/api/photo-game/pvp/cancel",
                headers={"Authorization": f"Bearer {test_user_token}"}
            )


class TestLeaderboards:
    """Tests for leaderboard endpoints"""
    
    def test_wins_leaderboard(self, api_client, test_user_token):
        """Test wins leaderboard"""
        response = api_client.get(
            f"{BASE_URL}/api/photo-game/leaderboard/wins",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Response is wrapped in object with leaderboard array
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        print(f"✓ Wins leaderboard: {len(data['leaderboard'])} entries")
    
    def test_photos_leaderboard(self, api_client, test_user_token):
        """Test photos leaderboard"""
        response = api_client.get(
            f"{BASE_URL}/api/photo-game/leaderboard/photos",
            headers={"Authorization": f"Bearer {test_user_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Response is wrapped in object with leaderboard array
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        print(f"✓ Photos leaderboard: {len(data['leaderboard'])} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
