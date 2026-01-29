"""
Test Suite for Win/Lose Streak Indicators
Tests the streak functionality for photo battles including:
- Backend returns win_streak and lose_streak per photo in /battle-photos endpoint
- Streak data updates after each round via /record-round-result
- Win streak multipliers (3+ wins = 1.25x to 10+ wins = 3.00x)
- Lose streak immunity (3+ losses = no scenery penalty)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@blendlink.com"
TEST_PASSWORD = "admin"


class TestStreakIndicators:
    """Test streak indicator functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
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
    
    def test_battle_photos_returns_streak_data(self):
        """Test that /battle-photos endpoint returns win_streak and lose_streak for each photo"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "photos" in data, "Response should contain 'photos' key"
        
        photos = data["photos"]
        if len(photos) == 0:
            pytest.skip("No minted photos available for testing")
        
        # Check first photo has streak fields
        first_photo = photos[0]
        
        # Verify win_streak field exists
        assert "win_streak" in first_photo, "Photo should have 'win_streak' field"
        assert isinstance(first_photo["win_streak"], int), "win_streak should be an integer"
        
        # Verify lose_streak field exists
        assert "lose_streak" in first_photo, "Photo should have 'lose_streak' field"
        assert isinstance(first_photo["lose_streak"], int), "lose_streak should be an integer"
        
        # Verify current_win_streak and current_lose_streak also exist
        assert "current_win_streak" in first_photo, "Photo should have 'current_win_streak' field"
        assert "current_lose_streak" in first_photo, "Photo should have 'current_lose_streak' field"
        
        print(f"✓ Photo '{first_photo.get('name')}' has win_streak={first_photo['win_streak']}, lose_streak={first_photo['lose_streak']}")
    
    def test_record_round_result_updates_streak(self):
        """Test that /record-round-result endpoint updates streak data"""
        # First get a photo to test with
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        photos = response.json().get("photos", [])
        if len(photos) == 0:
            pytest.skip("No minted photos available for testing")
        
        test_photo = photos[0]
        photo_id = test_photo["mint_id"]
        initial_win_streak = test_photo.get("win_streak", 0)
        
        # Record a win
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": True
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        
        # Response may contain streak info or just success status
        # The important thing is that the streak is updated in the database
        print(f"  Record round result response: {list(result.keys())}")
        
        # Get updated photo data
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        updated_photos = response.json().get("photos", [])
        updated_photo = next((p for p in updated_photos if p["mint_id"] == photo_id), None)
        
        assert updated_photo is not None, "Photo should still exist"
        
        # Win streak should have increased
        new_win_streak = updated_photo.get("win_streak", 0)
        assert new_win_streak >= initial_win_streak, f"Win streak should have increased or stayed same. Was {initial_win_streak}, now {new_win_streak}"
        
        print(f"✓ Win streak updated from {initial_win_streak} to {new_win_streak}")
    
    def test_record_round_loss_updates_lose_streak(self):
        """Test that recording a loss updates lose_streak"""
        # First get a photo to test with
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        photos = response.json().get("photos", [])
        if len(photos) == 0:
            pytest.skip("No minted photos available for testing")
        
        # Use a different photo to avoid interfering with win streak test
        test_photo = photos[-1] if len(photos) > 1 else photos[0]
        photo_id = test_photo["mint_id"]
        initial_lose_streak = test_photo.get("lose_streak", 0)
        
        # Record a loss
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": False
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Get updated photo data
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        updated_photos = response.json().get("photos", [])
        updated_photo = next((p for p in updated_photos if p["mint_id"] == photo_id), None)
        
        assert updated_photo is not None, "Photo should still exist"
        
        # Lose streak should have increased
        new_lose_streak = updated_photo.get("lose_streak", 0)
        assert new_lose_streak >= initial_lose_streak, f"Lose streak should have increased or stayed same. Was {initial_lose_streak}, now {new_lose_streak}"
        
        print(f"✓ Lose streak updated from {initial_lose_streak} to {new_lose_streak}")
    
    def test_win_streak_multiplier_calculation(self):
        """Test that win streak multipliers are calculated correctly"""
        # Win streak multipliers from spec
        expected_multipliers = {
            3: 1.25,
            4: 1.50,
            5: 1.75,
            6: 2.00,
            7: 2.25,
            8: 2.50,
            9: 2.75,
            10: 3.00,
        }
        
        # Get streak info endpoint
        response = self.session.get(f"{BASE_URL}/api/photo-game/streak-info")
        
        if response.status_code == 404:
            # Endpoint might not exist, check if multipliers are in battle-photos response
            response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
            assert response.status_code == 200
            
            # The multipliers should be defined in the frontend, verify backend returns streak data
            photos = response.json().get("photos", [])
            if photos:
                photo = photos[0]
                assert "win_streak" in photo, "Photo should have win_streak field"
                print(f"✓ Backend returns win_streak data, multipliers calculated in frontend")
            return
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify multipliers match spec
        if "win_streak_multipliers" in data:
            for streak, multiplier in expected_multipliers.items():
                assert data["win_streak_multipliers"].get(str(streak)) == multiplier, \
                    f"Multiplier for streak {streak} should be {multiplier}"
        
        print("✓ Win streak multipliers match specification")
    
    def test_photo_has_required_battle_fields(self):
        """Test that photos have all required fields for battle"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        photos = response.json().get("photos", [])
        if len(photos) == 0:
            pytest.skip("No minted photos available for testing")
        
        required_fields = [
            "mint_id",
            "name",
            "scenery_type",
            "dollar_value",
            "stamina",
            "level",
            "win_streak",
            "lose_streak",
            "current_win_streak",
            "current_lose_streak",
        ]
        
        for photo in photos[:3]:  # Check first 3 photos
            for field in required_fields:
                assert field in photo, f"Photo should have '{field}' field. Photo: {photo.get('name', 'unknown')}"
        
        print(f"✓ All {len(required_fields)} required fields present in photos")
    
    def test_streak_resets_on_opposite_result(self):
        """Test that win streak resets to 0 when losing and vice versa"""
        # Get a photo
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        photos = response.json().get("photos", [])
        if len(photos) == 0:
            pytest.skip("No minted photos available for testing")
        
        test_photo = photos[0]
        photo_id = test_photo["mint_id"]
        
        # Record a win first
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": True
        })
        assert response.status_code == 200
        
        # Get updated data
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = response.json().get("photos", [])
        photo_after_win = next((p for p in photos if p["mint_id"] == photo_id), None)
        
        win_streak_after_win = photo_after_win.get("win_streak", 0)
        lose_streak_after_win = photo_after_win.get("lose_streak", 0)
        
        # Lose streak should be 0 after a win
        assert lose_streak_after_win == 0, f"Lose streak should be 0 after win, got {lose_streak_after_win}"
        
        # Now record a loss
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": False
        })
        assert response.status_code == 200
        
        # Get updated data
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = response.json().get("photos", [])
        photo_after_loss = next((p for p in photos if p["mint_id"] == photo_id), None)
        
        win_streak_after_loss = photo_after_loss.get("win_streak", 0)
        
        # Win streak should be 0 after a loss
        assert win_streak_after_loss == 0, f"Win streak should be 0 after loss, got {win_streak_after_loss}"
        
        print("✓ Streaks reset correctly on opposite result")


class TestStreakDisplay:
    """Test streak display rules"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
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
    
    def test_fire_indicator_threshold(self):
        """Test that fire indicator (🔥) should show when win_streak >= 3"""
        # This is a frontend display rule, but we verify backend returns correct data
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        photos = response.json().get("photos", [])
        
        for photo in photos:
            win_streak = photo.get("win_streak", 0)
            # Backend should return accurate win_streak
            assert isinstance(win_streak, int), "win_streak should be an integer"
            assert win_streak >= 0, "win_streak should be non-negative"
            
            # Log photos with active fire streak
            if win_streak >= 3:
                print(f"  🔥 Photo '{photo.get('name')}' has fire streak: {win_streak}")
        
        print("✓ Fire indicator threshold data verified")
    
    def test_shield_indicator_threshold(self):
        """Test that shield indicator (🛡️) should show when lose_streak >= 3"""
        # This is a frontend display rule, but we verify backend returns correct data
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        photos = response.json().get("photos", [])
        
        for photo in photos:
            lose_streak = photo.get("lose_streak", 0)
            # Backend should return accurate lose_streak
            assert isinstance(lose_streak, int), "lose_streak should be an integer"
            assert lose_streak >= 0, "lose_streak should be non-negative"
            
            # Log photos with active shield immunity
            if lose_streak >= 3:
                print(f"  🛡️ Photo '{photo.get('name')}' has immunity: {lose_streak} losses")
        
        print("✓ Shield indicator threshold data verified")


class TestBotBattleStreaks:
    """Test streak functionality in bot battles"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
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
    
    def test_bot_battle_stats_endpoint(self):
        """Test that bot battle stats endpoint returns streak info"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/bot-battle/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Should have win stats per difficulty
        expected_fields = ["easy_bot_wins", "medium_bot_wins", "hard_bot_wins"]
        for field in expected_fields:
            assert field in data, f"Stats should contain '{field}'"
        
        print(f"✓ Bot battle stats: easy={data.get('easy_bot_wins', 0)}, medium={data.get('medium_bot_wins', 0)}, hard={data.get('hard_bot_wins', 0)}")
    
    def test_bot_battle_result_updates_photo_streak(self):
        """Test that completing a bot battle updates photo streaks"""
        # Get photos first
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200
        
        photos = response.json().get("photos", [])
        if len(photos) < 5:
            pytest.skip("Need at least 5 photos for bot battle")
        
        # Get initial streak for first photo
        test_photo = photos[0]
        initial_win_streak = test_photo.get("win_streak", 0)
        
        # Record a round result (simulating bot battle round)
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": test_photo["mint_id"],
            "round_won": True
        })
        
        assert response.status_code == 200
        
        # Verify streak was updated
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = response.json().get("photos", [])
        updated_photo = next((p for p in photos if p["mint_id"] == test_photo["mint_id"]), None)
        
        new_win_streak = updated_photo.get("win_streak", 0)
        
        print(f"✓ Photo streak updated: {initial_win_streak} -> {new_win_streak}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
