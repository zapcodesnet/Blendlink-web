"""
Phase 4: Stripe Subscription Setup, Dollar Value Upgrades, Daily BL Claim Tests
- Subscription tiers: Free, Bronze ($4.99), Silver ($9.99), Gold ($14.99), Platinum ($24.99)
- XP multipliers and daily BL bonuses
- Dollar value upgrades ($1M to $1B)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test2@blendlink.com"
TEST_PASSWORD = "test123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code}")


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session without auth"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def authenticated_client(auth_token):
    """Separate session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    })
    return session


class TestSubscriptionTiersEndpoint:
    """Test GET /api/subscriptions/tiers - returns all 5 tiers"""
    
    def test_get_subscription_tiers_returns_200(self, api_client):
        """Verify endpoint returns 200 OK"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200
    
    def test_get_subscription_tiers_has_all_five_tiers(self, api_client):
        """Verify all 5 tiers are returned: free, bronze, silver, gold, platinum"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/tiers")
        data = response.json()
        
        assert "tiers" in data
        tiers = data["tiers"]
        
        expected_tiers = ["free", "bronze", "silver", "gold", "platinum"]
        for tier in expected_tiers:
            assert tier in tiers, f"Missing tier: {tier}"
    
    def test_free_tier_correct_values(self, api_client):
        """Free tier: $0/mo, 0 BL/day, 1x XP, 3 mints/day"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/tiers")
        free_tier = response.json()["tiers"]["free"]
        
        assert free_tier["price_monthly"] == 0
        assert free_tier["daily_bl_bonus"] == 0
        assert free_tier["xp_multiplier"] == 1
        assert free_tier["daily_mint_limit"] == 3
    
    def test_bronze_tier_correct_values(self, api_client):
        """Bronze tier: $4.99/mo, 15K BL/day, 2x XP, 20 mints/day"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/tiers")
        bronze_tier = response.json()["tiers"]["bronze"]
        
        assert bronze_tier["price_monthly"] == 4.99
        assert bronze_tier["daily_bl_bonus"] == 15000
        assert bronze_tier["xp_multiplier"] == 2
        assert bronze_tier["daily_mint_limit"] == 20
    
    def test_silver_tier_correct_values(self, api_client):
        """Silver tier: $9.99/mo, 35K BL/day, 3x XP, 50 mints/day"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/tiers")
        silver_tier = response.json()["tiers"]["silver"]
        
        assert silver_tier["price_monthly"] == 9.99
        assert silver_tier["daily_bl_bonus"] == 35000
        assert silver_tier["xp_multiplier"] == 3
        assert silver_tier["daily_mint_limit"] == 50
    
    def test_gold_tier_correct_values(self, api_client):
        """Gold tier: $14.99/mo, 80K BL/day, 4x XP, 100 mints/day"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/tiers")
        gold_tier = response.json()["tiers"]["gold"]
        
        assert gold_tier["price_monthly"] == 14.99
        assert gold_tier["daily_bl_bonus"] == 80000
        assert gold_tier["xp_multiplier"] == 4
        assert gold_tier["daily_mint_limit"] == 100
    
    def test_platinum_tier_correct_values(self, api_client):
        """Platinum tier: $24.99/mo, 200K BL/day, 5x XP, unlimited mints"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/tiers")
        platinum_tier = response.json()["tiers"]["platinum"]
        
        assert platinum_tier["price_monthly"] == 24.99
        assert platinum_tier["daily_bl_bonus"] == 200000
        assert platinum_tier["xp_multiplier"] == 5
        assert platinum_tier["daily_mint_limit"] == 999999  # Unlimited
    
    def test_tiers_have_stripe_price_ids(self, api_client):
        """Verify paid tiers have stripe_price_id (can be placeholder)"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/tiers")
        tiers = response.json()["tiers"]
        
        # Free tier should have no stripe_price_id
        assert tiers["free"]["stripe_price_id"] is None
        
        # Paid tiers should have stripe_price_id (even if placeholder)
        assert tiers["bronze"]["stripe_price_id"] is not None
        assert tiers["silver"]["stripe_price_id"] is not None
        # Gold and Platinum may have placeholder IDs
        assert "stripe_price_id" in tiers["gold"]
        assert "stripe_price_id" in tiers["platinum"]


class TestUpgradePricesEndpoint:
    """Test GET /api/minting/upgrade-prices - returns 10 upgrade options"""
    
    def test_get_upgrade_prices_returns_200(self, api_client):
        """Verify endpoint returns 200 OK"""
        response = api_client.get(f"{BASE_URL}/api/minting/upgrade-prices")
        assert response.status_code == 200
    
    def test_get_upgrade_prices_has_10_options(self, api_client):
        """Verify 10 upgrade options are returned ($1M to $1B)"""
        response = api_client.get(f"{BASE_URL}/api/minting/upgrade-prices")
        data = response.json()
        
        assert "upgrades" in data
        upgrades = data["upgrades"]
        assert len(upgrades) == 10
    
    def test_upgrade_prices_correct_amounts(self, api_client):
        """Verify upgrade amounts: $1M, $2M, $3M, $5M, $10M, $20M, $50M, $100M, $500M, $1B"""
        response = api_client.get(f"{BASE_URL}/api/minting/upgrade-prices")
        upgrades = response.json()["upgrades"]
        
        expected_amounts = [
            1_000_000, 2_000_000, 3_000_000, 5_000_000, 10_000_000,
            20_000_000, 50_000_000, 100_000_000, 500_000_000, 1_000_000_000
        ]
        
        actual_amounts = [u["dollar_amount"] for u in upgrades]
        assert actual_amounts == expected_amounts
    
    def test_upgrade_costs_1_to_1_ratio(self, api_client):
        """Verify BL cost equals dollar amount (1:1 ratio)"""
        response = api_client.get(f"{BASE_URL}/api/minting/upgrade-prices")
        upgrades = response.json()["upgrades"]
        
        for upgrade in upgrades:
            assert upgrade["bl_cost"] == upgrade["dollar_amount"], \
                f"BL cost {upgrade['bl_cost']} != dollar amount {upgrade['dollar_amount']}"
    
    def test_upgrade_has_formatted_values(self, api_client):
        """Verify upgrades have formatted_dollar and formatted_cost"""
        response = api_client.get(f"{BASE_URL}/api/minting/upgrade-prices")
        upgrades = response.json()["upgrades"]
        
        for upgrade in upgrades:
            assert "formatted_dollar" in upgrade
            assert "formatted_cost" in upgrade
            assert upgrade["formatted_dollar"].startswith("$")
            assert "BL" in upgrade["formatted_cost"]


class TestSubscriptionInfoEndpoint:
    """Test GET /api/minting/subscription/info - returns current tier and benefits"""
    
    def test_get_subscription_info_returns_200(self, authenticated_client):
        """Verify endpoint returns 200 OK for authenticated user"""
        response = authenticated_client.get(f"{BASE_URL}/api/minting/subscription/info")
        assert response.status_code == 200
    
    def test_get_subscription_info_has_current_tier(self, authenticated_client):
        """Verify response includes current_tier"""
        response = authenticated_client.get(f"{BASE_URL}/api/minting/subscription/info")
        data = response.json()
        
        assert "current_tier" in data
        assert data["current_tier"] in ["free", "bronze", "silver", "gold", "platinum"]
    
    def test_get_subscription_info_has_benefits(self, authenticated_client):
        """Verify response includes benefits object"""
        response = authenticated_client.get(f"{BASE_URL}/api/minting/subscription/info")
        data = response.json()
        
        assert "benefits" in data
        benefits = data["benefits"]
        assert "daily_mint_limit" in benefits
        assert "xp_multiplier" in benefits
        assert "daily_bl_claim" in benefits
        assert "price" in benefits
    
    def test_get_subscription_info_has_all_tiers(self, authenticated_client):
        """Verify response includes all_tiers for comparison"""
        response = authenticated_client.get(f"{BASE_URL}/api/minting/subscription/info")
        data = response.json()
        
        assert "all_tiers" in data
        all_tiers = data["all_tiers"]
        assert "free" in all_tiers
        assert "bronze" in all_tiers
        assert "silver" in all_tiers
        assert "gold" in all_tiers
        assert "platinum" in all_tiers
    
    def test_get_subscription_info_has_can_claim_flag(self, authenticated_client):
        """Verify response includes can_claim_daily_bl flag"""
        response = authenticated_client.get(f"{BASE_URL}/api/minting/subscription/info")
        data = response.json()
        
        assert "can_claim_daily_bl" in data
        assert isinstance(data["can_claim_daily_bl"], bool)
    
    def test_get_subscription_info_requires_auth(self, api_client):
        """Verify endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/minting/subscription/info")
        assert response.status_code == 401


class TestDailyBLClaimEndpoint:
    """Test POST /api/minting/subscription/claim-daily-bl"""
    
    def test_claim_daily_bl_requires_auth(self, api_client):
        """Verify endpoint requires authentication"""
        response = api_client.post(f"{BASE_URL}/api/minting/subscription/claim-daily-bl")
        assert response.status_code == 401
    
    def test_claim_daily_bl_fails_for_free_tier(self, authenticated_client):
        """Free tier users should get error when claiming daily BL"""
        response = authenticated_client.post(f"{BASE_URL}/api/minting/subscription/claim-daily-bl")
        
        # Should return 400 error for free tier
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "free" in data["detail"].lower() or "subscribe" in data["detail"].lower()


class TestPhotoUpgradeEndpoint:
    """Test POST /api/minting/photos/{id}/upgrade"""
    
    def test_upgrade_requires_auth(self, api_client):
        """Verify endpoint requires authentication"""
        response = api_client.post(
            f"{BASE_URL}/api/minting/photos/test_mint_id/upgrade",
            json={"amount": 1000000}
        )
        assert response.status_code == 401
    
    def test_upgrade_returns_404_for_nonexistent_photo(self, authenticated_client):
        """Verify 404 for non-existent photo"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/minting/photos/nonexistent_mint_id/upgrade",
            json={"amount": 1000000}
        )
        assert response.status_code == 404
    
    def test_upgrade_returns_400_for_invalid_amount(self, authenticated_client):
        """Verify 400 for invalid upgrade amount"""
        response = authenticated_client.post(
            f"{BASE_URL}/api/minting/photos/test_mint_id/upgrade",
            json={"amount": 999}  # Invalid amount
        )
        # Should return 400 or 404 (404 if photo not found first)
        assert response.status_code in [400, 404]


class TestMySubscriptionEndpoint:
    """Test GET /api/subscriptions/my-subscription"""
    
    def test_my_subscription_requires_auth(self, api_client):
        """Verify endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/my-subscription")
        assert response.status_code == 401
    
    def test_my_subscription_returns_200(self, authenticated_client):
        """Verify endpoint returns 200 for authenticated user"""
        response = authenticated_client.get(f"{BASE_URL}/api/subscriptions/my-subscription")
        assert response.status_code == 200
    
    def test_my_subscription_has_tier(self, authenticated_client):
        """Verify response includes tier"""
        response = authenticated_client.get(f"{BASE_URL}/api/subscriptions/my-subscription")
        data = response.json()
        
        assert "tier" in data
        assert data["tier"] in ["free", "bronze", "silver", "gold", "platinum"]
    
    def test_my_subscription_has_tier_details(self, authenticated_client):
        """Verify response includes tier_details"""
        response = authenticated_client.get(f"{BASE_URL}/api/subscriptions/my-subscription")
        data = response.json()
        
        assert "tier_details" in data
        tier_details = data["tier_details"]
        assert "daily_mint_limit" in tier_details
        assert "xp_multiplier" in tier_details


class TestRankedLeaderboard:
    """Test GET /api/subscriptions/ranked/leaderboard"""
    
    def test_leaderboard_returns_200(self, api_client):
        """Verify endpoint returns 200 OK"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/ranked/leaderboard")
        assert response.status_code == 200
    
    def test_leaderboard_returns_list(self, api_client):
        """Verify endpoint returns a list"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/ranked/leaderboard")
        data = response.json()
        assert isinstance(data, list)


class TestRankedProfile:
    """Test GET /api/subscriptions/ranked/profile"""
    
    def test_ranked_profile_requires_auth(self, api_client):
        """Verify endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/subscriptions/ranked/profile")
        assert response.status_code == 401
    
    def test_ranked_profile_returns_200(self, authenticated_client):
        """Verify endpoint returns 200 for authenticated user"""
        response = authenticated_client.get(f"{BASE_URL}/api/subscriptions/ranked/profile")
        assert response.status_code == 200
    
    def test_ranked_profile_has_rating(self, authenticated_client):
        """Verify response includes rating"""
        response = authenticated_client.get(f"{BASE_URL}/api/subscriptions/ranked/profile")
        data = response.json()
        
        assert "rating" in data
        assert isinstance(data["rating"], int)


class TestAvailableUpgradesEndpoint:
    """Test GET /api/minting/photos/{mint_id}/available-upgrades"""
    
    def test_available_upgrades_requires_auth(self, api_client):
        """Verify endpoint requires authentication"""
        response = api_client.get(f"{BASE_URL}/api/minting/photos/test_mint_id/available-upgrades")
        assert response.status_code == 401
    
    def test_available_upgrades_returns_404_for_nonexistent(self, authenticated_client):
        """Verify 404 for non-existent photo"""
        response = authenticated_client.get(f"{BASE_URL}/api/minting/photos/nonexistent_id/available-upgrades")
        assert response.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
