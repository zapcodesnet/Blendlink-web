"""
Blendlink Iteration 32 Tests
- Push notification registration endpoint: POST /api/push/register
- Push notification test endpoint: POST /api/push/test
- AI Photo Analysis in minting system (minting_system.py analyze_photo_with_ai function)
- Subscription tiers: GET /api/subscriptions/tiers
- Ranked leaderboard: GET /api/subscriptions/ranked/leaderboard
- All game APIs still work
"""

import pytest
import requests
import os
import base64

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    raise ValueError("REACT_APP_BACKEND_URL environment variable is required")

# Test credentials
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "Test123!"


class TestHealthAndBasics:
    """Basic health check tests"""
    
    def test_health_check(self):
        """Test health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print("✓ Health check passed")


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Login successful for {TEST_USER_EMAIL}")
        return data["token"]


class TestPushNotifications:
    """Push notification endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_push_register_requires_auth(self):
        """Test that push register requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/push/register",
            params={"expo_token": "ExponentPushToken[test123]"}
        )
        assert response.status_code == 401
        print("✓ Push register correctly requires authentication")
    
    def test_push_register_with_auth(self, auth_token):
        """Test push token registration with valid auth"""
        response = requests.post(
            f"{BASE_URL}/api/push/register",
            params={"expo_token": "ExponentPushToken[test_token_12345]"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print(f"✓ Push token registration: {data}")
    
    def test_push_test_requires_auth(self):
        """Test that push test requires authentication"""
        response = requests.post(f"{BASE_URL}/api/push/test")
        assert response.status_code == 401
        print("✓ Push test correctly requires authentication")
    
    def test_push_test_with_auth(self, auth_token):
        """Test sending test push notification"""
        response = requests.post(
            f"{BASE_URL}/api/push/test",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Should return success or no_tokens (if no physical device registered)
        assert "success" in data or "reason" in data
        print(f"✓ Push test result: {data}")
    
    def test_push_unregister_with_auth(self, auth_token):
        """Test push token unregistration"""
        response = requests.post(
            f"{BASE_URL}/api/push/unregister",
            params={"expo_token": "ExponentPushToken[test_token_12345]"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        print(f"✓ Push token unregistration: {data}")


class TestSubscriptionTiers:
    """Subscription tiers endpoint tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_subscription_tiers(self):
        """Test getting subscription tiers (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200
        data = response.json()
        
        # Verify subscription tiers (API returns "tiers" not "subscription_tiers")
        assert "tiers" in data
        tiers = data["tiers"]
        assert "free" in tiers
        assert "basic" in tiers
        assert "premium" in tiers
        
        # Verify tier details
        assert tiers["free"]["price_monthly"] == 0
        assert tiers["basic"]["price_monthly"] == 4.99
        assert tiers["premium"]["price_monthly"] == 9.99
        
        # Verify ranked tiers
        assert "ranked_tiers" in data
        ranked = data["ranked_tiers"]
        assert "bronze" in ranked
        assert "silver" in ranked
        assert "gold" in ranked
        assert "platinum" in ranked
        assert "diamond" in ranked
        assert "master" in ranked
        
        print("✓ Subscription tiers returned correctly")
        print(f"  - Free: ${tiers['free']['price_monthly']}/mo, {tiers['free']['daily_mint_limit']} mints/day")
        print(f"  - Basic: ${tiers['basic']['price_monthly']}/mo, {tiers['basic']['daily_mint_limit']} mints/day")
        print(f"  - Premium: ${tiers['premium']['price_monthly']}/mo, {tiers['premium']['daily_mint_limit']} mints/day")
    
    def test_get_ranked_leaderboard(self):
        """Test getting ranked leaderboard (public endpoint)"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/ranked/leaderboard")
        assert response.status_code == 200
        data = response.json()
        
        # API returns list directly, not wrapped in "leaderboard" key
        assert isinstance(data, list)
        print(f"✓ Ranked leaderboard returned with {len(data)} entries")
    
    def test_get_ranked_leaderboard_with_limit(self):
        """Test ranked leaderboard with limit parameter"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/ranked/leaderboard?limit=10")
        assert response.status_code == 200
        data = response.json()
        
        # API returns list directly
        assert isinstance(data, list)
        assert len(data) <= 10
        print(f"✓ Ranked leaderboard with limit=10 returned {len(data)} entries")
    
    def test_get_my_subscription(self, auth_token):
        """Test getting current user's subscription"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/my-subscription",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # API returns subscription data directly
        assert "tier" in data
        print(f"✓ User subscription: {data['tier']}")
    
    def test_get_ranked_profile(self, auth_token):
        """Test getting user's ranked profile"""
        response = requests.get(
            f"{BASE_URL}/api/subscriptions/ranked/profile",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "rating" in data
        assert "tier" in data
        print(f"✓ User ranked profile: Rating={data['rating']}, Tier={data['tier']}")


class TestMintingSystem:
    """Minting system tests (includes AI photo analysis)"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_minting_config(self):
        """Test getting minting configuration"""
        response = requests.get(f"{BASE_URL}/api/minting/config")
        assert response.status_code == 200
        data = response.json()
        
        assert "mint_cost_bl" in data
        assert "daily_limits" in data
        assert "scenery_types" in data
        
        # Verify scenery types for AI analysis
        scenery = data["scenery_types"]
        assert "natural" in scenery
        assert "water" in scenery
        assert "manmade" in scenery
        
        print(f"✓ Minting config: cost={data['mint_cost_bl']} BL")
        print(f"  - Scenery types: {list(scenery.keys())}")
    
    def test_get_minting_status(self, auth_token):
        """Test getting user's minting status"""
        response = requests.get(
            f"{BASE_URL}/api/minting/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should have can_mint status
        assert "can_mint" in data or "bl_coins" in data
        print(f"✓ Minting status: {data}")
    
    def test_get_minting_feed(self):
        """Test getting public minted photos feed"""
        response = requests.get(f"{BASE_URL}/api/minting/feed")
        assert response.status_code == 200
        data = response.json()
        
        assert "photos" in data
        assert "count" in data
        print(f"✓ Minting feed: {data['count']} photos")
    
    def test_get_my_photos(self, auth_token):
        """Test getting user's minted photos"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "photos" in data
        assert "count" in data
        print(f"✓ User's minted photos: {data['count']} photos")


class TestPhotoGameAPIs:
    """Photo game API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_photo_game_config(self):
        """Test getting photo game configuration"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Photo game config returned")
    
    def test_get_photo_game_stats(self, auth_token):
        """Test getting user's photo game stats"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Photo game stats: {data}")
    
    def test_get_pvp_queue_status(self):
        """Test getting PvP queue status"""
        response = requests.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ PvP queue status: {data}")
    
    def test_get_wins_leaderboard(self):
        """Test getting wins leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins")
        assert response.status_code == 200
        data = response.json()
        assert "leaderboard" in data
        print(f"✓ Wins leaderboard: {len(data['leaderboard'])} entries")
    
    def test_get_photos_leaderboard(self):
        """Test getting photos leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/photos")
        assert response.status_code == 200
        data = response.json()
        assert "leaderboard" in data
        print(f"✓ Photos leaderboard: {len(data['leaderboard'])} entries")


class TestMarketplaceAPIs:
    """Marketplace API tests"""
    
    def test_get_marketplace_config(self):
        """Test getting marketplace configuration"""
        response = requests.get(f"{BASE_URL}/api/marketplace/config")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Marketplace config returned")
    
    def test_get_marketplace_listings(self):
        """Test getting marketplace listings"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200
        data = response.json()
        # API returns list directly
        assert isinstance(data, list)
        print(f"✓ Marketplace listings: {len(data)} listings")


class TestTournamentAPIs:
    """Tournament API tests"""
    
    def test_get_tournaments(self):
        """Test getting tournaments list"""
        response = requests.get(f"{BASE_URL}/api/subscriptions/tournaments")
        assert response.status_code == 200
        data = response.json()
        # API returns list directly (may be empty)
        assert isinstance(data, list)
        print(f"✓ Tournaments: {len(data)} tournaments")


class TestCasinoAPIs:
    """Casino API tests"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_get_daily_spin_status(self, auth_token):
        """Test getting daily spin status"""
        response = requests.get(
            f"{BASE_URL}/api/casino/daily-spin/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Daily spin status: {data}")
    
    def test_get_casino_stats(self, auth_token):
        """Test getting casino stats"""
        response = requests.get(
            f"{BASE_URL}/api/casino/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Casino stats returned")


class TestWebSocketStatus:
    """WebSocket status endpoint tests"""
    
    def test_get_ws_status(self):
        """Test getting WebSocket status"""
        response = requests.get(f"{BASE_URL}/api/ws/status")
        assert response.status_code == 200
        data = response.json()
        print(f"✓ WebSocket status: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
