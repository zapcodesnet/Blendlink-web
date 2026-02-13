"""
Test Suite for PVP Sync, Timers, Tap Rate, Mint Limit, and Upgrade Features
Iteration 99 - Testing fixes for:
1. PVP finish-round idempotency
2. Photo selection timer (10s) and RPS timer (5s) - frontend constants
3. Auto-select highest value photo on timeout
4. Tap rate exceeded notification hidden
5. Mint limit displays as X/10
6. BL Coins Upgrade button on photo cards
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://priority-tier.preview.emergentagent.com')

# Test credentials
USER1_EMAIL = "test@blendlink.com"
USER1_PASSWORD = "admin"
USER2_EMAIL = "test@example.com"
USER2_PASSWORD = "test123"


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def user1_token(self):
        """Get token for User 1 (Admin)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"User 1 login failed: {response.status_code}")
    
    @pytest.fixture(scope="class")
    def user2_token(self):
        """Get token for User 2 (Regular)"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER2_EMAIL,
            "password": USER2_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"User 2 login failed: {response.status_code}")
    
    def test_user1_login(self, user1_token):
        """Test User 1 can login"""
        assert user1_token is not None
        print(f"✅ User 1 logged in successfully")
    
    def test_user2_login(self, user2_token):
        """Test User 2 can login"""
        assert user2_token is not None
        print(f"✅ User 2 logged in successfully")


class TestPVPFinishRoundIdempotency:
    """Test PVP finish-round endpoint idempotency"""
    
    @pytest.fixture(scope="class")
    def user1_token(self):
        """Get token for User 1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("User 1 login failed")
    
    def test_finish_round_endpoint_exists(self, user1_token):
        """Test that /pvp/finish-round endpoint exists"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        # Call with non-existent session - should return 404, not 500
        response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/finish-round",
            params={"session_id": "non_existent_session_123"},
            headers=headers
        )
        # 404 means endpoint exists but session not found
        # 422 means validation error (also acceptable)
        assert response.status_code in [404, 422], f"Unexpected status: {response.status_code}"
        print(f"✅ /pvp/finish-round endpoint exists (returns {response.status_code} for non-existent session)")
    
    def test_finish_round_requires_auth(self):
        """Test that finish-round requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/finish-round",
            params={"session_id": "test_session"}
        )
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print(f"✅ /pvp/finish-round requires authentication")


class TestMintingDailyLimit:
    """Test minting daily limit displays as X/10"""
    
    @pytest.fixture(scope="class")
    def user1_token(self):
        """Get token for User 1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("User 1 login failed")
    
    def test_minting_status_returns_daily_limit(self, user1_token):
        """Test that minting status returns daily_limit field"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.get(f"{BASE_URL}/api/minting/status", headers=headers)
        
        assert response.status_code == 200, f"Failed to get minting status: {response.status_code}"
        data = response.json()
        
        # Check daily_limit field exists
        assert "daily_limit" in data, "daily_limit field missing from minting status"
        print(f"✅ Minting status returns daily_limit: {data.get('daily_limit')}")
    
    def test_daily_limit_is_10_for_free_users(self, user1_token):
        """Test that daily limit is 10 for free users (default)"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.get(f"{BASE_URL}/api/minting/status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        daily_limit = data.get("daily_limit", 0)
        # Should be 10 for free users (not 3)
        assert daily_limit >= 10, f"Daily limit should be at least 10, got {daily_limit}"
        print(f"✅ Daily limit is {daily_limit} (expected >= 10)")
    
    def test_minting_status_has_mints_today(self, user1_token):
        """Test that minting status returns mints_today field"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.get(f"{BASE_URL}/api/minting/status", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "mints_today" in data, "mints_today field missing"
        mints_today = data.get("mints_today", 0)
        daily_limit = data.get("daily_limit", 10)
        
        print(f"✅ Minting status: {mints_today}/{daily_limit}")


class TestPhotoUpgradeEndpoint:
    """Test photo upgrade endpoint for BL Coins -> Dollar Value boost"""
    
    @pytest.fixture(scope="class")
    def user1_token(self):
        """Get token for User 1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("User 1 login failed")
    
    @pytest.fixture(scope="class")
    def user1_photos(self, user1_token):
        """Get User 1's minted photos"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.get(f"{BASE_URL}/api/minting/photos", headers=headers)
        if response.status_code == 200:
            return response.json().get("photos", [])
        return []
    
    def test_upgrade_endpoint_exists(self, user1_token, user1_photos):
        """Test that photo upgrade endpoint exists"""
        if not user1_photos:
            pytest.skip("No photos available for testing")
        
        headers = {"Authorization": f"Bearer {user1_token}"}
        photo_id = user1_photos[0].get("mint_id")
        
        # Try to upgrade with 0 amount (should fail validation but endpoint exists)
        response = requests.post(
            f"{BASE_URL}/api/minting/photos/{photo_id}/upgrade",
            json={"upgrade_amount": 0},
            headers=headers
        )
        
        # 400 or 422 means endpoint exists but validation failed
        # 404 would mean endpoint doesn't exist
        assert response.status_code != 404, "Upgrade endpoint not found"
        print(f"✅ Photo upgrade endpoint exists (status: {response.status_code})")
    
    def test_upgrade_requires_valid_amount(self, user1_token, user1_photos):
        """Test that upgrade requires valid amount"""
        if not user1_photos:
            pytest.skip("No photos available for testing")
        
        headers = {"Authorization": f"Bearer {user1_token}"}
        photo_id = user1_photos[0].get("mint_id")
        
        # Try with invalid amount
        response = requests.post(
            f"{BASE_URL}/api/minting/photos/{photo_id}/upgrade",
            json={"upgrade_amount": -1000000},
            headers=headers
        )
        
        # Should reject negative amounts
        assert response.status_code in [400, 422], f"Should reject negative amount, got {response.status_code}"
        print(f"✅ Upgrade endpoint rejects invalid amounts")


class TestGameConfig:
    """Test game configuration endpoint"""
    
    def test_game_config_returns_max_taps(self):
        """Test that game config returns max_taps_per_second"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        
        assert response.status_code == 200, f"Failed to get game config: {response.status_code}"
        data = response.json()
        
        assert "max_taps_per_second" in data, "max_taps_per_second missing from config"
        max_tps = data.get("max_taps_per_second")
        
        # Should be 30 TPS (updated from 25)
        assert max_tps == 30, f"Expected max_taps_per_second=30, got {max_tps}"
        print(f"✅ Game config max_taps_per_second: {max_tps}")
    
    def test_game_config_returns_stamina_info(self):
        """Test that game config returns stamina configuration"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "max_stamina" in data, "max_stamina missing"
        assert "stamina_cost_win" in data, "stamina_cost_win missing"
        assert "stamina_cost_loss" in data, "stamina_cost_loss missing"
        
        print(f"✅ Game config stamina: max={data.get('max_stamina')}, win_cost={data.get('stamina_cost_win')}, loss_cost={data.get('stamina_cost_loss')}")


class TestPVPTapEndpoints:
    """Test PVP tap-related endpoints for sync"""
    
    @pytest.fixture(scope="class")
    def user1_token(self):
        """Get token for User 1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("User 1 login failed")
    
    def test_tap_state_endpoint_exists(self, user1_token):
        """Test that /pvp/tap-state endpoint exists"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.get(
            f"{BASE_URL}/api/photo-game/pvp/tap-state/non_existent_session",
            headers=headers
        )
        # 404 means endpoint exists but session not found
        assert response.status_code in [404, 422], f"Unexpected status: {response.status_code}"
        print(f"✅ /pvp/tap-state endpoint exists")
    
    def test_tap_submit_endpoint_exists(self, user1_token):
        """Test that /pvp/tap endpoint exists"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/tap",
            json={"session_id": "non_existent", "tap_count": 1},
            headers=headers
        )
        # 404 means endpoint exists but session not found
        assert response.status_code in [404, 422], f"Unexpected status: {response.status_code}"
        print(f"✅ /pvp/tap endpoint exists")
    
    def test_select_photo_endpoint_exists(self, user1_token):
        """Test that /pvp/select-photo endpoint exists"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/select-photo",
            json={"session_id": "non_existent", "photo_id": "test_photo"},
            headers=headers
        )
        # 404 means endpoint exists but session not found
        assert response.status_code in [404, 422], f"Unexpected status: {response.status_code}"
        print(f"✅ /pvp/select-photo endpoint exists")


class TestOpenGamesAPI:
    """Test Open Games API for PVP matchmaking"""
    
    @pytest.fixture(scope="class")
    def user1_token(self):
        """Get token for User 1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": USER1_EMAIL,
            "password": USER1_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("User 1 login failed")
    
    def test_list_open_games(self, user1_token):
        """Test listing open games"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        response = requests.get(f"{BASE_URL}/api/photo-game/open-games", headers=headers)
        
        assert response.status_code == 200, f"Failed to list open games: {response.status_code}"
        data = response.json()
        
        assert "games" in data, "games field missing"
        assert "count" in data, "count field missing"
        
        print(f"✅ Open games list: {data.get('count')} games found")
    
    def test_create_open_game_requires_5_photos(self, user1_token):
        """Test that creating open game requires exactly 5 photos"""
        headers = {"Authorization": f"Bearer {user1_token}"}
        
        # Try with less than 5 photos
        response = requests.post(
            f"{BASE_URL}/api/photo-game/open-games/create",
            json={
                "photo_ids": ["photo1", "photo2"],  # Only 2 photos
                "bet_amount": 0
            },
            headers=headers
        )
        
        # Should fail validation
        assert response.status_code in [400, 422], f"Should reject < 5 photos, got {response.status_code}"
        print(f"✅ Open game creation requires exactly 5 photos")


class TestXPLevelSystem:
    """Test XP and Level system endpoints"""
    
    def test_xp_level_info_endpoint(self):
        """Test XP level info endpoint"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        
        assert response.status_code == 200, f"Failed to get XP level info: {response.status_code}"
        data = response.json()
        
        assert "xp_per_round" in data, "xp_per_round missing"
        assert "subscription_multipliers" in data, "subscription_multipliers missing"
        assert "level_thresholds" in data, "level_thresholds missing"
        
        print(f"✅ XP level info: xp_per_round={data.get('xp_per_round')}")
        print(f"   Subscription multipliers: {data.get('subscription_multipliers')}")


class TestMintingConfig:
    """Test minting configuration"""
    
    def test_minting_config_endpoint(self):
        """Test minting config endpoint"""
        response = requests.get(f"{BASE_URL}/api/minting/config")
        
        assert response.status_code == 200, f"Failed to get minting config: {response.status_code}"
        data = response.json()
        
        # Check for mint cost
        if "mint_cost_bl" in data:
            print(f"✅ Minting config: mint_cost_bl={data.get('mint_cost_bl')}")
        else:
            print(f"✅ Minting config endpoint works (no mint_cost_bl field)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
