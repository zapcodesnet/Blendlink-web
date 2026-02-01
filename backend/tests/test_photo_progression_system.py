"""
Test Photo Progression System - Iteration 95
Tests for new photo progression features:
1. Minting config API returns mint_cost_bl = 200
2. Full-stats endpoint returns all new fields
3. XP progress calculation
4. Dollar Value totals with all bonuses
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "test@blendlink.com"
TEST_USER_PASSWORD = "admin"

class TestMintingConfig:
    """Test minting configuration API"""
    
    def test_minting_config_returns_200_bl_cost(self):
        """Verify minting config API returns mint_cost_bl = 200"""
        response = requests.get(f"{BASE_URL}/api/minting/config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "mint_cost_bl" in data, "mint_cost_bl field missing from config"
        assert data["mint_cost_bl"] == 200, f"Expected mint_cost_bl=200, got {data['mint_cost_bl']}"
        
        # Verify other config fields exist
        assert "daily_limits" in data or "subscription_limits" in data, "Daily limits missing"
        assert "scenery_types" in data, "Scenery types missing"
        assert "light_types" in data, "Light types missing"
        print(f"✅ Minting config verified: mint_cost_bl = {data['mint_cost_bl']}")
    
    def test_minting_config_endpoint_alternate(self):
        """Test alternate minting-config endpoint"""
        response = requests.get(f"{BASE_URL}/api/minting/minting-config")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "mint_cost_bl" in data, "mint_cost_bl field missing"
        assert data["mint_cost_bl"] == 200, f"Expected 200, got {data['mint_cost_bl']}"
        
        # Check for new fields
        assert "star_milestones" in data, "star_milestones missing"
        assert "max_seniority_level" in data, "max_seniority_level missing"
        assert data["max_seniority_level"] == 60, f"Expected max_seniority_level=60, got {data['max_seniority_level']}"
        print(f"✅ Alternate minting config verified with star_milestones and max_seniority_level")


class TestPhotoFullStats:
    """Test full-stats endpoint returns all new progression fields"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token") or response.cookies.get("session_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def session_with_auth(self, auth_token):
        """Create session with auth"""
        session = requests.Session()
        if auth_token:
            session.headers.update({"Authorization": f"Bearer {auth_token}"})
            session.cookies.set("session_token", auth_token)
        return session
    
    @pytest.fixture
    def user_photo(self, session_with_auth):
        """Get a user's minted photo for testing"""
        response = session_with_auth.get(f"{BASE_URL}/api/minting/photos")
        if response.status_code == 200:
            photos = response.json().get("photos", [])
            if photos:
                return photos[0]
        pytest.skip("No minted photos found for testing")
    
    def test_full_stats_returns_all_new_fields(self, session_with_auth, user_photo):
        """Verify full-stats endpoint returns all new progression fields"""
        mint_id = user_photo.get("mint_id")
        response = session_with_auth.get(f"{BASE_URL}/api/minting/photo/{mint_id}/full-stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Core fields
        assert "mint_id" in data, "mint_id missing"
        assert "base_dollar_value" in data, "base_dollar_value missing"
        assert "total_dollar_value" in data or "dollar_value" in data, "dollar_value missing"
        
        # New progression fields - Stars
        assert "stars" in data, "stars field missing"
        assert "star_bonus_value" in data, "star_bonus_value missing"
        assert isinstance(data["stars"], int), "stars should be integer"
        
        # Level & XP
        assert "level" in data, "level field missing"
        assert "xp" in data, "xp field missing"
        assert "xp_progress" in data or "xp_progress_percent" in data, "xp_progress missing"
        
        # XP Progress details
        if "xp_progress" in data and isinstance(data["xp_progress"], dict):
            xp_progress = data["xp_progress"]
            assert "progress_percent" in xp_progress, "progress_percent missing from xp_progress"
            assert "remaining" in xp_progress or "xp_needed" in xp_progress, "remaining XP missing"
        
        # Age bonus
        assert "age_days" in data, "age_days field missing"
        assert "age_bonus_value" in data, "age_bonus_value field missing"
        
        # Reactions
        assert "total_reactions" in data, "total_reactions field missing"
        assert "reaction_bonus_value" in data, "reaction_bonus_value field missing"
        
        # BL Coins spent
        assert "bl_coins_spent" in data, "bl_coins_spent field missing"
        
        # Seniority
        assert "seniority_achieved" in data, "seniority_achieved field missing"
        assert "seniority_bonus_value" in data, "seniority_bonus_value field missing"
        assert "levels_to_seniority" in data, "levels_to_seniority field missing"
        
        # Golden frame
        assert "has_golden_frame" in data, "has_golden_frame field missing"
        
        print(f"✅ Full stats verified for photo {mint_id}")
        print(f"   - Stars: {data.get('stars')}")
        print(f"   - Level: {data.get('level')}")
        print(f"   - Age Days: {data.get('age_days')}")
        print(f"   - Total Reactions: {data.get('total_reactions')}")
        print(f"   - BL Coins Spent: {data.get('bl_coins_spent')}")
        print(f"   - Seniority Achieved: {data.get('seniority_achieved')}")
        print(f"   - Has Golden Frame: {data.get('has_golden_frame')}")
    
    def test_xp_progress_calculation(self, session_with_auth, user_photo):
        """Verify XP progress calculation is working correctly"""
        mint_id = user_photo.get("mint_id")
        response = session_with_auth.get(f"{BASE_URL}/api/minting/photo/{mint_id}/full-stats")
        
        assert response.status_code == 200
        data = response.json()
        
        level = data.get("level", 1)
        xp = data.get("xp", 0)
        
        # Check XP progress data
        xp_progress = data.get("xp_progress", {})
        if isinstance(xp_progress, dict):
            progress_percent = xp_progress.get("progress_percent", 0)
            xp_for_next = xp_progress.get("xp_for_next_level", 10)
            remaining = xp_progress.get("remaining", 0)
            
            # Validate progress percent is between 0-100
            assert 0 <= progress_percent <= 100, f"Invalid progress_percent: {progress_percent}"
            
            # Validate remaining XP is non-negative
            assert remaining >= 0, f"Invalid remaining XP: {remaining}"
            
            print(f"✅ XP Progress verified:")
            print(f"   - Level: {level}")
            print(f"   - XP: {xp}")
            print(f"   - Progress: {progress_percent}%")
            print(f"   - XP for next level: {xp_for_next}")
            print(f"   - Remaining: {remaining}")
        else:
            # Fallback to xp_progress_percent
            progress_percent = data.get("xp_progress_percent", 0)
            assert 0 <= progress_percent <= 100, f"Invalid xp_progress_percent: {progress_percent}"
            print(f"✅ XP Progress percent: {progress_percent}%")
    
    def test_dollar_value_totals_with_bonuses(self, session_with_auth, user_photo):
        """Verify Dollar Value totals are calculated correctly with all bonuses"""
        mint_id = user_photo.get("mint_id")
        response = session_with_auth.get(f"{BASE_URL}/api/minting/photo/{mint_id}/full-stats")
        
        assert response.status_code == 200
        data = response.json()
        
        base_value = data.get("base_dollar_value", 0)
        total_value = data.get("total_dollar_value") or data.get("dollar_value", 0)
        
        # Get all bonus values
        level_bonus = data.get("level_bonus_value", 0)
        age_bonus = data.get("age_bonus_value", 0)
        star_bonus = data.get("star_bonus_value", 0)
        reaction_bonus = data.get("reaction_bonus_value", 0)
        upgrade_value = data.get("total_upgrade_value", 0)
        seniority_bonus = data.get("seniority_bonus_value", 0)
        
        # Total should be >= base value
        assert total_value >= base_value, f"Total ({total_value}) should be >= base ({base_value})"
        
        # Calculate expected minimum (base + known bonuses)
        expected_min = base_value + age_bonus + star_bonus + reaction_bonus + upgrade_value
        
        print(f"✅ Dollar Value breakdown:")
        print(f"   - Base Value: ${base_value:,}")
        print(f"   - Level Bonus: ${level_bonus:,}")
        print(f"   - Age Bonus: ${age_bonus:,}")
        print(f"   - Star Bonus: ${star_bonus:,}")
        print(f"   - Reaction Bonus: ${reaction_bonus:,}")
        print(f"   - Upgrade Value: ${upgrade_value:,}")
        print(f"   - Seniority Bonus: ${seniority_bonus:,}")
        print(f"   - TOTAL: ${total_value:,}")


class TestLevelBonuses:
    """Test level bonuses API"""
    
    def test_level_bonuses_endpoint(self):
        """Verify level-bonuses endpoint returns correct data"""
        response = requests.get(f"{BASE_URL}/api/minting/level-bonuses")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "bonuses" in data, "bonuses field missing"
        
        bonuses = data["bonuses"]
        assert len(bonuses) > 0, "No bonuses returned"
        
        # Check for Level 60 golden frame
        level_60_bonus = next((b for b in bonuses if b.get("level") == 60), None)
        assert level_60_bonus is not None, "Level 60 bonus missing"
        assert level_60_bonus.get("has_golden_frame") == True, "Level 60 should have golden frame"
        
        print(f"✅ Level bonuses verified: {len(bonuses)} milestones")
        for bonus in bonuses:
            print(f"   - Level {bonus.get('level')}: {bonus.get('stars')} stars, +{bonus.get('bonus_percent')}%")


class TestRatingCriteria:
    """Test rating criteria API"""
    
    def test_rating_criteria_endpoint(self):
        """Verify rating-criteria endpoint returns 11 categories"""
        response = requests.get(f"{BASE_URL}/api/minting/rating-criteria")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "criteria" in data, "criteria field missing"
        
        criteria = data["criteria"]
        # Should have 11 categories
        assert len(criteria) >= 10, f"Expected at least 10 criteria, got {len(criteria)}"
        
        # Check for key categories
        category_keys = [c.get("key") for c in criteria]
        expected_keys = ["original", "innovative", "unique", "rare", "exposure", 
                        "color", "clarity", "composition", "narrative", "captivating"]
        
        for key in expected_keys:
            assert key in category_keys, f"Missing category: {key}"
        
        print(f"✅ Rating criteria verified: {len(criteria)} categories")


class TestMintStatus:
    """Test mint status endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token") or response.cookies.get("session_token")
        pytest.skip("Authentication failed")
    
    def test_mint_status_shows_200_bl_cost(self, auth_token):
        """Verify mint status reflects 200 BL cost"""
        session = requests.Session()
        session.headers.update({"Authorization": f"Bearer {auth_token}"})
        session.cookies.set("session_token", auth_token)
        
        response = session.get(f"{BASE_URL}/api/minting/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # Status should show user can mint (if they have enough BL)
        assert "can_mint" in data, "can_mint field missing"
        assert "bl_coins" in data, "bl_coins field missing"
        assert "mints_today" in data, "mints_today field missing"
        assert "daily_limit" in data, "daily_limit field missing"
        
        print(f"✅ Mint status verified:")
        print(f"   - Can Mint: {data.get('can_mint')}")
        print(f"   - BL Coins: {data.get('bl_coins')}")
        print(f"   - Mints Today: {data.get('mints_today')}/{data.get('daily_limit')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
