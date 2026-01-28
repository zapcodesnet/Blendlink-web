"""
Test Suite for Phase 2: Streaks + XP System
Tests:
- GET /api/photo-game/xp-level-info endpoint
- Level thresholds (+50% marginal XP formula)
- Subscription XP multipliers
- Streak multipliers
- Stamina system
- Level bonuses
- POST /api/photo-game/record-round-result endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test2@blendlink.com"
TEST_PASSWORD = "test123"


class TestXPLevelInfoEndpoint:
    """Tests for GET /api/photo-game/xp-level-info endpoint"""
    
    def test_xp_level_info_returns_200(self):
        """Test that xp-level-info endpoint returns 200"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ xp-level-info endpoint returns 200")
    
    def test_xp_per_round_is_one(self):
        """Test that XP per round is 1"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        assert data.get("xp_per_round") == 1, f"Expected xp_per_round=1, got {data.get('xp_per_round')}"
        print("✓ XP per round is 1")
    
    def test_subscription_xp_multipliers_correct(self):
        """Test subscription XP multipliers: free=1, bronze=2, silver=3, gold=4, platinum=5"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        
        expected_multipliers = {
            "free": 1,
            "bronze": 2,
            "silver": 3,
            "gold": 4,
            "platinum": 5
        }
        
        actual_multipliers = data.get("subscription_multipliers", {})
        
        for tier, expected_mult in expected_multipliers.items():
            actual_mult = actual_multipliers.get(tier)
            assert actual_mult == expected_mult, f"Expected {tier}={expected_mult}, got {actual_mult}"
        
        print("✓ Subscription XP multipliers are correct (free=1, bronze=2, silver=3, gold=4, platinum=5)")
    
    def test_level_thresholds_follow_50_percent_formula(self):
        """Test level thresholds follow +50% marginal XP formula (L1=0, L2=10, L3=25, etc.)"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        
        thresholds = data.get("level_thresholds", {})
        
        # Verify first few levels explicitly
        expected_first_levels = {
            "1": 0,
            "2": 10,
            "3": 25,  # 10 + 15 (10 * 1.5)
            "4": 47,  # 25 + 22 (15 * 1.5 rounded)
            "5": 80,  # 47 + 33 (22 * 1.5 rounded)
        }
        
        for level, expected_xp in expected_first_levels.items():
            actual_xp = thresholds.get(level)
            assert actual_xp == expected_xp, f"Level {level}: expected {expected_xp}, got {actual_xp}"
        
        # Verify the formula holds for subsequent levels (marginal increases by ~50%)
        # L2 marginal = 10, L3 marginal = 15, L4 marginal = 22, L5 marginal = 33
        prev_marginal = 10
        for level in range(3, 11):
            current_threshold = thresholds.get(str(level))
            prev_threshold = thresholds.get(str(level - 1))
            
            if current_threshold is not None and prev_threshold is not None:
                actual_marginal = current_threshold - prev_threshold
                expected_marginal = int(prev_marginal * 1.5)
                
                # Allow small rounding differences
                assert abs(actual_marginal - expected_marginal) <= 1, \
                    f"Level {level}: marginal XP expected ~{expected_marginal}, got {actual_marginal}"
                
                prev_marginal = actual_marginal
        
        print("✓ Level thresholds follow +50% marginal XP formula")
    
    def test_streak_multipliers_correct(self):
        """Test streak multipliers: 3=×1.25, 4=×1.50, 5=×1.75, 6=×2.00, 7=×2.25, 8=×2.50, 9=×2.75, 10=×3.00"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        
        expected_streaks = {
            "3": 1.25,
            "4": 1.50,
            "5": 1.75,
            "6": 2.00,
            "7": 2.25,
            "8": 2.50,
            "9": 2.75,
            "10": 3.00
        }
        
        actual_streaks = data.get("streak_multipliers", {})
        
        for streak, expected_mult in expected_streaks.items():
            actual_mult = actual_streaks.get(streak)
            assert actual_mult == expected_mult, f"Streak {streak}: expected {expected_mult}, got {actual_mult}"
        
        print("✓ Streak multipliers are correct (3=×1.25 to 10=×3.00)")
    
    def test_lose_streak_immunity_threshold_is_3(self):
        """Test lose streak immunity threshold is 3"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        
        threshold = data.get("lose_streak_immunity_threshold")
        assert threshold == 3, f"Expected lose_streak_immunity_threshold=3, got {threshold}"
        print("✓ Lose streak immunity threshold is 3")
    
    def test_stamina_info_correct(self):
        """Test stamina info: max=24, cost_win=1, cost_loss=2, regen_per_hour=1"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        
        stamina = data.get("stamina", {})
        
        assert stamina.get("max") == 24, f"Expected max=24, got {stamina.get('max')}"
        assert stamina.get("cost_win") == 1, f"Expected cost_win=1, got {stamina.get('cost_win')}"
        assert stamina.get("cost_loss") == 2, f"Expected cost_loss=2, got {stamina.get('cost_loss')}"
        assert stamina.get("regen_per_hour") == 1, f"Expected regen_per_hour=1, got {stamina.get('regen_per_hour')}"
        
        print("✓ Stamina info is correct (max=24, cost_win=1, cost_loss=2, regen_per_hour=1)")
    
    def test_level_bonuses_correct(self):
        """Test level bonuses: L10=1★+10%+10000BL, L20=2★+20%, L30=3★+30%, L40=4★+40%, L50=5★+50%, L60=5★+70%+100000BL+golden_frame"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        
        level_bonuses = data.get("level_bonuses", {})
        
        expected_bonuses = {
            "10": {"stars": 1, "bonus_percent": 10, "bl_coins_reward": 10000, "golden_frame": False},
            "20": {"stars": 2, "bonus_percent": 20, "bl_coins_reward": 0, "golden_frame": False},
            "30": {"stars": 3, "bonus_percent": 30, "bl_coins_reward": 0, "golden_frame": False},
            "40": {"stars": 4, "bonus_percent": 40, "bl_coins_reward": 0, "golden_frame": False},
            "50": {"stars": 5, "bonus_percent": 50, "bl_coins_reward": 0, "golden_frame": False},
            "60": {"stars": 5, "bonus_percent": 70, "bl_coins_reward": 100000, "golden_frame": True},
        }
        
        for level, expected in expected_bonuses.items():
            actual = level_bonuses.get(level, {})
            
            assert actual.get("stars") == expected["stars"], \
                f"Level {level}: expected stars={expected['stars']}, got {actual.get('stars')}"
            assert actual.get("bonus_percent") == expected["bonus_percent"], \
                f"Level {level}: expected bonus_percent={expected['bonus_percent']}, got {actual.get('bonus_percent')}"
            assert actual.get("bl_coins_reward") == expected["bl_coins_reward"], \
                f"Level {level}: expected bl_coins_reward={expected['bl_coins_reward']}, got {actual.get('bl_coins_reward')}"
            assert actual.get("golden_frame") == expected["golden_frame"], \
                f"Level {level}: expected golden_frame={expected['golden_frame']}, got {actual.get('golden_frame')}"
        
        print("✓ Level bonuses are correct (L10-L60 with stars, bonus_percent, bl_coins_reward, golden_frame)")


class TestRecordRoundResultEndpoint:
    """Tests for POST /api/photo-game/record-round-result endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    @pytest.fixture
    def user_photo(self, auth_token):
        """Get a user's minted photo for testing"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            photos = data.get("photos", [])
            if photos:
                return photos[0]
        
        pytest.skip("No minted photos available for testing record-round-result")
    
    def test_record_round_result_requires_auth(self):
        """Test that record-round-result requires authentication"""
        response = requests.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": "test_photo_id",
            "round_won": True
        })
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ record-round-result requires authentication")
    
    def test_record_round_result_returns_xp_gained(self, auth_token, user_photo):
        """Test that record-round-result returns xp_gained with subscription multiplier"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=headers,
            json={
                "photo_id": user_photo["mint_id"],
                "round_won": True
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify xp_gained is present
        assert "xp_gained" in data, "Response should include xp_gained"
        assert data["xp_gained"] >= 1, f"xp_gained should be >= 1, got {data['xp_gained']}"
        
        # Verify xp_multiplier is present
        assert "xp_multiplier" in data, "Response should include xp_multiplier"
        assert data["xp_multiplier"] >= 1, f"xp_multiplier should be >= 1, got {data['xp_multiplier']}"
        
        # Verify subscription_tier is present
        assert "subscription_tier" in data, "Response should include subscription_tier"
        
        print(f"✓ record-round-result returns xp_gained={data['xp_gained']} with multiplier={data['xp_multiplier']}")
    
    def test_record_round_result_returns_stamina_info(self, auth_token, user_photo):
        """Test that record-round-result returns stamina_cost and new_stamina"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=headers,
            json={
                "photo_id": user_photo["mint_id"],
                "round_won": True
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify stamina_cost is present
        assert "stamina_cost" in data, "Response should include stamina_cost"
        
        # Verify new_stamina is present
        assert "new_stamina" in data, "Response should include new_stamina"
        
        # Verify max_stamina is present
        assert "max_stamina" in data, "Response should include max_stamina"
        assert data["max_stamina"] == 24, f"max_stamina should be 24, got {data['max_stamina']}"
        
        print(f"✓ record-round-result returns stamina_cost={data['stamina_cost']}, new_stamina={data['new_stamina']}")
    
    def test_record_round_result_win_stamina_cost_is_1(self, auth_token, user_photo):
        """Test that winning a round costs 1 stamina"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=headers,
            json={
                "photo_id": user_photo["mint_id"],
                "round_won": True
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("stamina_cost") == 1, f"Win stamina_cost should be 1, got {data.get('stamina_cost')}"
        
        print("✓ Winning a round costs 1 stamina")
    
    def test_record_round_result_loss_stamina_cost_is_2(self, auth_token, user_photo):
        """Test that losing a round costs 2 stamina"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=headers,
            json={
                "photo_id": user_photo["mint_id"],
                "round_won": False
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("stamina_cost") == 2, f"Loss stamina_cost should be 2, got {data.get('stamina_cost')}"
        
        print("✓ Losing a round costs 2 stamina")
    
    def test_record_round_result_returns_level_info(self, auth_token, user_photo):
        """Test that record-round-result returns level_up flag and level info"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=headers,
            json={
                "photo_id": user_photo["mint_id"],
                "round_won": True
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify level_up flag is present
        assert "level_up" in data, "Response should include level_up flag"
        assert isinstance(data["level_up"], bool), "level_up should be a boolean"
        
        # Verify new_level is present
        assert "new_level" in data, "Response should include new_level"
        assert data["new_level"] >= 1, f"new_level should be >= 1, got {data['new_level']}"
        
        # Verify new_xp is present
        assert "new_xp" in data, "Response should include new_xp"
        
        print(f"✓ record-round-result returns level_up={data['level_up']}, new_level={data['new_level']}, new_xp={data['new_xp']}")
    
    def test_record_round_result_returns_streak_info(self, auth_token, user_photo):
        """Test that record-round-result returns streak information"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=headers,
            json={
                "photo_id": user_photo["mint_id"],
                "round_won": True
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify win streak info
        assert "new_win_streak" in data, "Response should include new_win_streak"
        
        # Verify immunity info
        assert "has_immunity" in data, "Response should include has_immunity"
        
        print(f"✓ record-round-result returns new_win_streak={data['new_win_streak']}, has_immunity={data['has_immunity']}")


class TestSubscriptionTiersInfo:
    """Tests for subscription tiers information in xp-level-info"""
    
    def test_subscription_tiers_have_xp_multiplier(self):
        """Test that subscription tiers include xp_multiplier"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        
        subscription_tiers = data.get("subscription_tiers", {})
        
        expected_xp_multipliers = {
            "free": 1,
            "bronze": 2,
            "silver": 3,
            "gold": 4,
            "platinum": 5
        }
        
        for tier, expected_mult in expected_xp_multipliers.items():
            tier_info = subscription_tiers.get(tier, {})
            actual_mult = tier_info.get("xp_multiplier")
            assert actual_mult == expected_mult, f"{tier} xp_multiplier: expected {expected_mult}, got {actual_mult}"
        
        print("✓ Subscription tiers have correct xp_multiplier values")
    
    def test_subscription_tiers_have_daily_mint_limit(self):
        """Test that subscription tiers include daily_mint_limit"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        
        subscription_tiers = data.get("subscription_tiers", {})
        
        expected_limits = {
            "free": 3,
            "bronze": 20,
            "silver": 50,
            "gold": 100,
            "platinum": 999999  # Unlimited
        }
        
        for tier, expected_limit in expected_limits.items():
            tier_info = subscription_tiers.get(tier, {})
            actual_limit = tier_info.get("daily_mint_limit")
            assert actual_limit == expected_limit, f"{tier} daily_mint_limit: expected {expected_limit}, got {actual_limit}"
        
        print("✓ Subscription tiers have correct daily_mint_limit values")
    
    def test_subscription_tiers_have_daily_bl_claim(self):
        """Test that subscription tiers include daily_bl_claim"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        
        subscription_tiers = data.get("subscription_tiers", {})
        
        expected_claims = {
            "free": 0,
            "bronze": 15000,
            "silver": 35000,
            "gold": 80000,
            "platinum": 200000
        }
        
        for tier, expected_claim in expected_claims.items():
            tier_info = subscription_tiers.get(tier, {})
            actual_claim = tier_info.get("daily_bl_claim")
            assert actual_claim == expected_claim, f"{tier} daily_bl_claim: expected {expected_claim}, got {actual_claim}"
        
        print("✓ Subscription tiers have correct daily_bl_claim values")


class TestLevelThresholdsFormula:
    """Detailed tests for level threshold formula verification"""
    
    def test_level_1_is_0_xp(self):
        """Test that Level 1 requires 0 XP"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        thresholds = data.get("level_thresholds", {})
        
        assert thresholds.get("1") == 0, f"Level 1 should require 0 XP, got {thresholds.get('1')}"
        print("✓ Level 1 requires 0 XP")
    
    def test_level_2_is_10_xp(self):
        """Test that Level 2 requires 10 XP"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        thresholds = data.get("level_thresholds", {})
        
        assert thresholds.get("2") == 10, f"Level 2 should require 10 XP, got {thresholds.get('2')}"
        print("✓ Level 2 requires 10 XP")
    
    def test_level_3_is_25_xp(self):
        """Test that Level 3 requires 25 XP (10 + 15)"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        thresholds = data.get("level_thresholds", {})
        
        assert thresholds.get("3") == 25, f"Level 3 should require 25 XP, got {thresholds.get('3')}"
        print("✓ Level 3 requires 25 XP")
    
    def test_level_4_is_47_xp(self):
        """Test that Level 4 requires 47 XP (25 + 22)"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        thresholds = data.get("level_thresholds", {})
        
        assert thresholds.get("4") == 47, f"Level 4 should require 47 XP, got {thresholds.get('4')}"
        print("✓ Level 4 requires 47 XP")
    
    def test_level_5_is_80_xp(self):
        """Test that Level 5 requires 80 XP (47 + 33)"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        thresholds = data.get("level_thresholds", {})
        
        assert thresholds.get("5") == 80, f"Level 5 should require 80 XP, got {thresholds.get('5')}"
        print("✓ Level 5 requires 80 XP")
    
    def test_all_60_levels_present(self):
        """Test that all 60 levels are present in thresholds"""
        response = requests.get(f"{BASE_URL}/api/photo-game/xp-level-info")
        data = response.json()
        thresholds = data.get("level_thresholds", {})
        
        for level in range(1, 61):
            assert str(level) in thresholds, f"Level {level} missing from thresholds"
        
        print("✓ All 60 levels are present in thresholds")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
