"""
Test Medal System for Battle Achievements & Badges
- 10-Win Streak Medal (🏅)
- Cumulative across games
- Resets to 0 on ANY loss
- Medals are permanent (don't decrease after loss)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "testplayer@blendlink.com"
TEST_PASSWORD = "Test123!"

# Medal threshold
MEDAL_WIN_STREAK_THRESHOLD = 10


class TestMedalSystem:
    """Test medal system for battle achievements"""
    
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
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        self.token = data.get("token")
        self.user_id = data.get("user", {}).get("user_id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        self.session.close()
    
    # ============== API Endpoint Tests ==============
    
    def test_record_round_result_endpoint_exists(self):
        """Test POST /api/photo-game/record-round-result endpoint exists"""
        # Get a photo to test with
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert photos_response.status_code == 200
        
        photos = photos_response.json().get("photos", [])
        assert len(photos) > 0, "User has no photos"
        
        photo_id = photos[0]["mint_id"]
        
        # Test the endpoint
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": True
        })
        
        assert response.status_code == 200, f"Endpoint failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "success" in data
        assert "photo_id" in data
        assert "round_won" in data
        assert "new_win_streak" in data
        assert "medal_earned" in data
        assert "total_medals" in data
    
    def test_photo_medals_endpoint_exists(self):
        """Test GET /api/photo-game/photo-medals/{mint_id} endpoint exists"""
        # Get a photo to test with
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert photos_response.status_code == 200
        
        photos = photos_response.json().get("photos", [])
        assert len(photos) > 0, "User has no photos"
        
        photo_id = photos[0]["mint_id"]
        
        # Test the endpoint (public - no auth required)
        response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/{photo_id}")
        
        assert response.status_code == 200, f"Endpoint failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "mint_id" in data
        assert "medals" in data
        assert "current_win_streak" in data
        assert "next_medal_at" in data
    
    def test_battle_photos_includes_medals(self):
        """Test GET /api/photo-game/battle-photos includes medals in response"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        
        assert response.status_code == 200, f"Endpoint failed: {response.text}"
        data = response.json()
        
        assert "photos" in data
        photos = data["photos"]
        
        # Check that photos have medals field
        for photo in photos:
            assert "medals" in photo, f"Photo {photo.get('mint_id')} missing medals field"
            assert "win_streak" in photo, f"Photo {photo.get('mint_id')} missing win_streak field"
    
    # ============== Win Streak Logic Tests ==============
    
    def test_win_increments_streak(self):
        """Test that winning a round increments win streak"""
        # Get a photo
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = photos_response.json().get("photos", [])
        photo_id = photos[0]["mint_id"]
        
        # Get initial streak
        medals_response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/{photo_id}")
        initial_streak = medals_response.json().get("current_win_streak", 0)
        
        # Record a win
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": True
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify streak incremented
        assert data["new_win_streak"] == initial_streak + 1, \
            f"Expected streak {initial_streak + 1}, got {data['new_win_streak']}"
    
    def test_loss_resets_streak_to_zero(self):
        """Test that losing ANY round resets win streak to 0"""
        # Get a photo
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = photos_response.json().get("photos", [])
        photo_id = photos[0]["mint_id"]
        
        # First record a win to ensure streak > 0
        self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": True
        })
        
        # Now record a loss
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": False
        })
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify streak reset to 0
        assert data["new_win_streak"] == 0, \
            f"Expected streak 0 after loss, got {data['new_win_streak']}"
    
    # ============== Medal Award Tests ==============
    
    def test_medal_earned_at_10_wins(self):
        """Test that medal is earned at exactly 10 consecutive wins"""
        # Get a photo that doesn't have many wins yet
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = photos_response.json().get("photos", [])
        
        # Find a photo with low win streak
        test_photo = None
        for photo in photos:
            if photo.get("win_streak", 0) < 5:
                test_photo = photo
                break
        
        if not test_photo:
            pytest.skip("No suitable photo found for medal test")
        
        photo_id = test_photo["mint_id"]
        
        # Reset streak by recording a loss first
        self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": False
        })
        
        # Get initial medal count
        medals_response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/{photo_id}")
        initial_medals = medals_response.json().get("medals", {}).get("ten_win_streak", 0)
        
        # Record 10 consecutive wins
        medal_earned = False
        for i in range(10):
            response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
                "photo_id": photo_id,
                "round_won": True
            })
            
            assert response.status_code == 200
            data = response.json()
            
            if data.get("medal_earned"):
                medal_earned = True
                assert data["new_win_streak"] == 10, \
                    f"Medal earned at wrong streak: {data['new_win_streak']}"
        
        # Verify medal was earned
        assert medal_earned, "Medal should have been earned at 10 wins"
        
        # Verify medal count increased
        medals_response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/{photo_id}")
        final_medals = medals_response.json().get("medals", {}).get("ten_win_streak", 0)
        
        assert final_medals == initial_medals + 1, \
            f"Expected {initial_medals + 1} medals, got {final_medals}"
    
    def test_medals_permanent_after_loss(self):
        """Test that medals don't decrease after a loss"""
        # Get a photo with medals (Golden Hour)
        medals_response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/mint_845ab7ad28e7")
        
        if medals_response.status_code != 200:
            pytest.skip("Golden Hour photo not found")
        
        initial_data = medals_response.json()
        initial_medals = initial_data.get("medals", {}).get("ten_win_streak", 0)
        
        if initial_medals == 0:
            pytest.skip("Photo has no medals to test permanence")
        
        # Record a loss
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": "mint_845ab7ad28e7",
            "round_won": False
        })
        
        assert response.status_code == 200
        
        # Verify medals unchanged
        medals_response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/mint_845ab7ad28e7")
        final_medals = medals_response.json().get("medals", {}).get("ten_win_streak", 0)
        
        assert final_medals == initial_medals, \
            f"Medals should be permanent! Expected {initial_medals}, got {final_medals}"
    
    def test_multiple_medals_can_be_earned(self):
        """Test that multiple medals can be earned (at 10, 20, 30 wins etc)"""
        # Get a photo
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = photos_response.json().get("photos", [])
        
        # Find a photo with low win streak
        test_photo = None
        for photo in photos:
            if photo.get("win_streak", 0) < 5:
                test_photo = photo
                break
        
        if not test_photo:
            pytest.skip("No suitable photo found for multiple medal test")
        
        photo_id = test_photo["mint_id"]
        
        # Reset streak
        self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": False
        })
        
        # Get initial medal count
        medals_response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/{photo_id}")
        initial_medals = medals_response.json().get("medals", {}).get("ten_win_streak", 0)
        
        # Record 20 consecutive wins (should earn 2 medals)
        medals_earned = 0
        for i in range(20):
            response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
                "photo_id": photo_id,
                "round_won": True
            })
            
            assert response.status_code == 200
            data = response.json()
            
            if data.get("medal_earned"):
                medals_earned += 1
        
        # Verify 2 medals were earned
        assert medals_earned == 2, f"Expected 2 medals earned, got {medals_earned}"
        
        # Verify final medal count
        medals_response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/{photo_id}")
        final_medals = medals_response.json().get("medals", {}).get("ten_win_streak", 0)
        
        assert final_medals == initial_medals + 2, \
            f"Expected {initial_medals + 2} medals, got {final_medals}"
    
    # ============== Photo Stamina Integration Tests ==============
    
    def test_photo_stamina_includes_medals(self):
        """Test GET /api/photo-game/photo-stamina/{mint_id} includes medals"""
        # Get a photo
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = photos_response.json().get("photos", [])
        photo_id = photos[0]["mint_id"]
        
        # Get stamina info
        response = self.session.get(f"{BASE_URL}/api/photo-game/photo-stamina/{photo_id}")
        
        assert response.status_code == 200, f"Endpoint failed: {response.text}"
        data = response.json()
        
        # Verify medals field exists
        assert "medals" in data, "Stamina response missing medals field"
        assert "ten_win_streak" in data["medals"], "Medals missing ten_win_streak field"
    
    def test_next_medal_at_calculation(self):
        """Test that next_medal_at is calculated correctly"""
        # Get a photo
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = photos_response.json().get("photos", [])
        photo_id = photos[0]["mint_id"]
        
        # Get medals info
        response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/{photo_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        current_streak = data.get("current_win_streak", 0)
        next_medal_at = data.get("next_medal_at")
        
        # Calculate expected next_medal_at
        if current_streak == 0:
            expected = 10
        else:
            expected = 10 - (current_streak % 10)
        
        assert next_medal_at == expected, \
            f"Expected next_medal_at={expected}, got {next_medal_at}"
    
    # ============== Error Handling Tests ==============
    
    def test_record_result_invalid_photo(self):
        """Test recording result for non-existent photo returns 404"""
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": "invalid_photo_id",
            "round_won": True
        })
        
        assert response.status_code == 404
    
    def test_record_result_not_owned_photo(self):
        """Test recording result for photo not owned by user returns 404"""
        # Try to record result for a photo that doesn't belong to user
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": "mint_other_user_photo",
            "round_won": True
        })
        
        assert response.status_code == 404
    
    def test_photo_medals_invalid_photo(self):
        """Test getting medals for non-existent photo returns 404"""
        response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/invalid_photo_id")
        
        assert response.status_code == 404
    
    # ============== Golden Hour Photo Specific Tests ==============
    
    def test_golden_hour_has_medal(self):
        """Test that Golden Hour photo has 1 medal as per context"""
        response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/mint_845ab7ad28e7")
        
        assert response.status_code == 200, f"Golden Hour photo not found: {response.text}"
        data = response.json()
        
        assert data.get("name") == "Golden Hour", f"Expected Golden Hour, got {data.get('name')}"
        
        medals = data.get("medals", {})
        assert medals.get("ten_win_streak", 0) >= 1, \
            f"Golden Hour should have at least 1 medal, got {medals}"
    
    def test_golden_hour_medal_in_battle_photos(self):
        """Test that Golden Hour medal appears in battle-photos response"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        
        assert response.status_code == 200
        photos = response.json().get("photos", [])
        
        # Find Golden Hour
        golden_hour = None
        for photo in photos:
            if photo.get("mint_id") == "mint_845ab7ad28e7":
                golden_hour = photo
                break
        
        if golden_hour:
            assert golden_hour.get("medals", {}).get("ten_win_streak", 0) >= 1, \
                "Golden Hour should show medal in battle-photos"


class TestMedalFullFlow:
    """Test complete medal flow: 10 wins -> medal -> loss -> streak reset but medal remains"""
    
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
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        self.token = data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        self.session.close()
    
    def test_full_medal_flow(self):
        """
        Test complete flow:
        1. Reset streak with a loss
        2. Win 10 times -> earn medal
        3. Lose once -> streak resets to 0
        4. Verify medal still exists
        """
        # Get a photo
        photos_response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        photos = photos_response.json().get("photos", [])
        
        # Find a photo with low win streak
        test_photo = None
        for photo in photos:
            if photo.get("win_streak", 0) < 5:
                test_photo = photo
                break
        
        if not test_photo:
            pytest.skip("No suitable photo found")
        
        photo_id = test_photo["mint_id"]
        
        # Step 1: Reset streak with a loss
        self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": False
        })
        
        # Get initial medal count
        medals_response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/{photo_id}")
        initial_medals = medals_response.json().get("medals", {}).get("ten_win_streak", 0)
        
        # Step 2: Win 10 times
        for i in range(10):
            response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
                "photo_id": photo_id,
                "round_won": True
            })
            assert response.status_code == 200
        
        # Verify medal earned
        medals_response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/{photo_id}")
        after_wins_medals = medals_response.json().get("medals", {}).get("ten_win_streak", 0)
        assert after_wins_medals == initial_medals + 1, \
            f"Medal should be earned after 10 wins. Expected {initial_medals + 1}, got {after_wins_medals}"
        
        # Step 3: Lose once
        response = self.session.post(f"{BASE_URL}/api/photo-game/record-round-result", json={
            "photo_id": photo_id,
            "round_won": False
        })
        assert response.status_code == 200
        data = response.json()
        
        # Verify streak reset to 0
        assert data["new_win_streak"] == 0, \
            f"Streak should reset to 0 after loss, got {data['new_win_streak']}"
        
        # Step 4: Verify medal still exists
        medals_response = requests.get(f"{BASE_URL}/api/photo-game/photo-medals/{photo_id}")
        final_medals = medals_response.json().get("medals", {}).get("ten_win_streak", 0)
        
        assert final_medals == after_wins_medals, \
            f"Medal should be permanent! Expected {after_wins_medals}, got {final_medals}"
        
        print(f"✅ Full flow passed: {initial_medals} -> {after_wins_medals} medals (permanent after loss)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
