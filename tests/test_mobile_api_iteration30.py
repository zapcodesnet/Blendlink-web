"""
Blendlink Mobile API Tests - Iteration 30
Tests for mobile app integration with:
- Photo Game API (config, stats, PvP queue, sessions, leaderboards)
- Minting API (config, status, photos, feed)
- Marketplace API (config, listings, stats)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://blendlinksocial.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for authenticated tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


# ============== PHOTO GAME API TESTS ==============

class TestPhotoGameConfig:
    """Test Photo Game configuration endpoints"""
    
    def test_get_config(self):
        """Test /api/photo-game/config returns correct configuration"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        assert response.status_code == 200
        
        data = response.json()
        # Verify all required fields for mobile app
        assert "max_stamina" in data
        assert data["max_stamina"] == 100
        
        assert "stamina_per_battle" in data
        assert data["stamina_per_battle"] == 4
        
        assert "stamina_regen_hours" in data
        assert data["stamina_regen_hours"] == 24
        
        assert "win_streak_multipliers" in data
        assert isinstance(data["win_streak_multipliers"], dict)
        
        assert "strength_multiplier" in data
        assert data["strength_multiplier"] == 1.25
        
        print(f"✓ Photo Game config: max_stamina={data['max_stamina']}, stamina_per_battle={data['stamina_per_battle']}")


class TestPhotoGameStats:
    """Test Photo Game stats endpoints"""
    
    def test_get_my_stats_authenticated(self, auth_headers):
        """Test /api/photo-game/stats returns user's game stats"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify all required fields for mobile app
        assert "user_id" in data
        assert "stamina" in data
        assert isinstance(data["stamina"], (int, float))
        assert 0 <= data["stamina"] <= 100
        
        assert "current_win_streak" in data
        assert "best_win_streak" in data
        assert "total_battles" in data
        assert "battles_won" in data
        assert "battles_lost" in data
        assert "total_bl_won" in data
        assert "total_bl_lost" in data
        
        print(f"✓ Game stats: stamina={data['stamina']}, wins={data['battles_won']}, losses={data['battles_lost']}")
    
    def test_get_my_stats_unauthenticated(self):
        """Test /api/photo-game/stats returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/photo-game/stats")
        assert response.status_code == 401
        print("✓ Stats endpoint correctly requires authentication")


class TestPhotoGamePvP:
    """Test Photo Game PvP matchmaking endpoints"""
    
    def test_get_queue_status(self):
        """Test /api/photo-game/pvp/queue-status returns queue info"""
        response = requests.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        assert response.status_code == 200
        
        data = response.json()
        assert "players_waiting" in data
        assert isinstance(data["players_waiting"], int)
        assert data["players_waiting"] >= 0
        
        assert "active_matches" in data
        assert isinstance(data["active_matches"], int)
        assert data["active_matches"] >= 0
        
        print(f"✓ PvP queue: {data['players_waiting']} waiting, {data['active_matches']} active")
    
    def test_check_match_status_authenticated(self, auth_headers):
        """Test /api/photo-game/pvp/match-status returns match status"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/pvp/match-status",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Should return match status info
        assert "in_queue" in data or "match_found" in data or "status" in data
        print(f"✓ Match status check working: {data}")
    
    def test_cancel_matchmaking_authenticated(self, auth_headers):
        """Test /api/photo-game/pvp/cancel works"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/cancel",
            headers=auth_headers
        )
        # Should succeed even if not in queue
        assert response.status_code in [200, 400]
        print("✓ Cancel matchmaking endpoint working")


class TestPhotoGameLeaderboards:
    """Test Photo Game leaderboard endpoints"""
    
    def test_wins_leaderboard_default(self):
        """Test /api/photo-game/leaderboard/wins with default params"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        assert "period" in data
        print(f"✓ Wins leaderboard: {len(data['leaderboard'])} entries, period={data['period']}")
    
    def test_wins_leaderboard_periods(self):
        """Test /api/photo-game/leaderboard/wins with different periods"""
        for period in ["24h", "7d", "30d", "1y"]:
            response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins?period={period}")
            assert response.status_code == 200
            data = response.json()
            assert data["period"] == period
        print("✓ Wins leaderboard works for all periods (24h, 7d, 30d, 1y)")
    
    def test_photos_leaderboard(self):
        """Test /api/photo-game/leaderboard/photos returns leaderboard"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/photos")
        assert response.status_code == 200
        
        data = response.json()
        assert "leaderboard" in data
        assert isinstance(data["leaderboard"], list)
        print(f"✓ Photos leaderboard: {len(data['leaderboard'])} entries")


class TestPhotoGameSessions:
    """Test Photo Game session endpoints"""
    
    def test_get_active_sessions_authenticated(self, auth_headers):
        """Test /api/photo-game/sessions/active returns active sessions"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/sessions/active",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)
        print(f"✓ Active sessions: {len(data['sessions'])} sessions")
    
    def test_get_game_history_authenticated(self, auth_headers):
        """Test /api/photo-game/sessions/history returns game history"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/sessions/history",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)
        assert "count" in data
        print(f"✓ Game history: {data['count']} sessions")


# ============== MINTING API TESTS ==============

class TestMintingConfig:
    """Test Minting configuration endpoints"""
    
    def test_get_config(self):
        """Test /api/minting/config returns correct configuration"""
        response = requests.get(f"{BASE_URL}/api/minting/config")
        assert response.status_code == 200
        
        data = response.json()
        # Verify all required fields for mobile app
        assert "mint_cost_bl" in data
        assert data["mint_cost_bl"] == 500
        
        assert "daily_limits" in data
        assert data["daily_limits"]["free"] == 3
        assert data["daily_limits"]["basic"] == 20
        assert data["daily_limits"]["premium"] == 50
        
        assert "scenery_types" in data
        assert "natural" in data["scenery_types"]
        assert "water" in data["scenery_types"]
        assert "manmade" in data["scenery_types"]
        
        assert "supported_types" in data
        assert "photo" in data["supported_types"]
        
        print(f"✓ Minting config: cost={data['mint_cost_bl']} BL, limits={data['daily_limits']}")


class TestMintingStatus:
    """Test Minting status endpoints"""
    
    def test_get_status_authenticated(self, auth_headers):
        """Test /api/minting/status returns user's minting status"""
        response = requests.get(
            f"{BASE_URL}/api/minting/status",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify all required fields for mobile app
        assert "can_mint" in data
        assert isinstance(data["can_mint"], bool)
        
        assert "bl_coins" in data
        assert isinstance(data["bl_coins"], (int, float))
        
        assert "mints_today" in data
        assert isinstance(data["mints_today"], int)
        
        assert "daily_limit" in data
        assert isinstance(data["daily_limit"], int)
        
        assert "remaining_mints" in data
        assert isinstance(data["remaining_mints"], int)
        
        print(f"✓ Minting status: can_mint={data['can_mint']}, BL={data['bl_coins']}, mints={data['mints_today']}/{data['daily_limit']}")
    
    def test_get_status_unauthenticated(self):
        """Test /api/minting/status returns 401 without auth"""
        response = requests.get(f"{BASE_URL}/api/minting/status")
        assert response.status_code == 401
        print("✓ Minting status correctly requires authentication")


class TestMintingPhotos:
    """Test Minting photos endpoints"""
    
    def test_get_my_photos_authenticated(self, auth_headers):
        """Test /api/minting/photos returns user's minted photos"""
        response = requests.get(
            f"{BASE_URL}/api/minting/photos",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "photos" in data
        assert isinstance(data["photos"], list)
        assert "count" in data
        print(f"✓ User photos: {data['count']} minted photos")
    
    def test_get_feed(self):
        """Test /api/minting/feed returns public photos feed"""
        response = requests.get(f"{BASE_URL}/api/minting/feed")
        assert response.status_code == 200
        
        data = response.json()
        assert "photos" in data
        assert isinstance(data["photos"], list)
        assert "count" in data
        print(f"✓ Public feed: {data['count']} photos")


# ============== MARKETPLACE API TESTS ==============

class TestMarketplaceConfig:
    """Test Marketplace configuration endpoints"""
    
    def test_get_config(self):
        """Test /api/marketplace/config returns correct configuration"""
        response = requests.get(f"{BASE_URL}/api/marketplace/config")
        assert response.status_code == 200
        
        data = response.json()
        # Verify all required fields for mobile app
        assert "platform_fee_percent" in data
        assert data["platform_fee_percent"] == 8
        
        assert "supported_content_types" in data
        assert "minted_photo" in data["supported_content_types"]
        
        assert "listing_types" in data
        assert "fixed_price" in data["listing_types"]
        assert "auction" in data["listing_types"]
        assert "offer_only" in data["listing_types"]
        
        assert "min_price_usd" in data
        assert data["min_price_usd"] == 1.0
        
        assert "max_auction_duration_hours" in data
        assert data["max_auction_duration_hours"] == 168
        
        print(f"✓ Marketplace config: fee={data['platform_fee_percent']}%, min_price=${data['min_price_usd']}")


class TestMarketplaceListings:
    """Test Marketplace listings endpoints
    
    Note: There are two marketplace systems:
    1. General marketplace (server.py) - returns list directly
    2. Photo marketplace (marketplace_routes.py) - returns {"listings": [], "count": n}
    
    The general marketplace endpoint takes precedence due to route registration order.
    """
    
    def test_get_listings(self):
        """Test /api/marketplace/listings returns listings (general marketplace)"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200
        
        data = response.json()
        # General marketplace returns a list directly
        assert isinstance(data, list)
        print(f"✓ Marketplace listings: {len(data)} active listings")
    
    def test_get_listings_with_category_filter(self):
        """Test /api/marketplace/listings with category filter"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings?category=electronics")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Filtered listings: {len(data)} electronics listings")
    
    def test_get_listing_by_id(self):
        """Test /api/marketplace/listings/{listing_id} returns specific listing"""
        # First get a listing ID from the list
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200
        listings = response.json()
        
        if len(listings) > 0:
            listing_id = listings[0]["listing_id"]
            response = requests.get(f"{BASE_URL}/api/marketplace/listings/{listing_id}")
            assert response.status_code == 200
            
            data = response.json()
            assert "listing_id" in data
            assert data["listing_id"] == listing_id
            print(f"✓ Get listing by ID working: {listing_id}")
        else:
            print("✓ No listings to test get by ID (skipped)")


class TestMarketplaceStats:
    """Test Marketplace stats endpoints"""
    
    def test_get_stats_authenticated(self, auth_headers):
        """Test /api/marketplace/stats returns user's marketplace stats"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace/stats",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify all required fields for mobile app
        assert "active_listings" in data
        assert isinstance(data["active_listings"], int)
        
        assert "total_sales" in data
        assert isinstance(data["total_sales"], int)
        
        assert "total_earnings_usd" in data
        assert isinstance(data["total_earnings_usd"], (int, float))
        
        assert "pending_offers" in data
        assert isinstance(data["pending_offers"], int)
        
        assert "total_purchases" in data
        assert isinstance(data["total_purchases"], int)
        
        print(f"✓ Marketplace stats: listings={data['active_listings']}, sales={data['total_sales']}, earnings=${data['total_earnings_usd']}")


class TestMarketplaceOffers:
    """Test Marketplace offers endpoints"""
    
    def test_get_received_offers_authenticated(self, auth_headers):
        """Test /api/marketplace/offers/received returns received offers"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace/offers/received",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "offers" in data
        assert isinstance(data["offers"], list)
        print(f"✓ Received offers: {data['count']} offers")
    
    def test_get_sent_offers_authenticated(self, auth_headers):
        """Test /api/marketplace/offers/sent returns sent offers"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace/offers/sent",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "offers" in data
        assert isinstance(data["offers"], list)
        print(f"✓ Sent offers: {data['count']} offers")


class TestMarketplaceSalesHistory:
    """Test Marketplace sales history endpoints"""
    
    def test_get_sales_history_as_seller(self, auth_headers):
        """Test /api/marketplace/sales/history as seller"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace/sales/history?role=seller",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "sales" in data
        assert isinstance(data["sales"], list)
        print(f"✓ Sales history (seller): {data['count']} sales")
    
    def test_get_sales_history_as_buyer(self, auth_headers):
        """Test /api/marketplace/sales/history as buyer"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace/sales/history?role=buyer",
            headers=auth_headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "sales" in data
        assert isinstance(data["sales"], list)
        print(f"✓ Sales history (buyer): {data['count']} purchases")


# ============== HEALTH CHECK ==============

class TestHealthCheck:
    """Test health check endpoint"""
    
    def test_health(self):
        """Test /api/health returns ok"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("status") == "ok"
        print("✓ Health check passed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
