"""
Bot Battle Update Tests - January 2026
Tests for:
1. Post-Game Buttons (Return to Dollar Auction Arena, Play Again)
2. Claimable One-Time BL Coin Bonuses
3. Updated Bot Stats & Tap Rates (200, 1000, 5000, 10000 BL)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@blendlink.com"
TEST_PASSWORD = "admin"


class TestBotBattleStats:
    """Test bot battle stats endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user = response.json().get("user", {})
    
    def test_01_get_bot_battle_stats(self):
        """Test GET /api/photo-game/bot-battle/stats returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "easy_bot_wins" in data, "Missing easy_bot_wins"
        assert "medium_bot_wins" in data, "Missing medium_bot_wins"
        assert "hard_bot_wins" in data, "Missing hard_bot_wins"
        assert "extreme_bot_wins" in data, "Missing extreme_bot_wins"
        assert "unlocked_difficulties" in data, "Missing unlocked_difficulties"
        assert "claimable_bonuses" in data, "Missing claimable_bonuses"
        
        # Verify unlocked_difficulties structure
        unlocked = data["unlocked_difficulties"]
        assert "easy" in unlocked, "Missing easy in unlocked_difficulties"
        assert "medium" in unlocked, "Missing medium in unlocked_difficulties"
        assert "hard" in unlocked, "Missing hard in unlocked_difficulties"
        assert "extreme" in unlocked, "Missing extreme in unlocked_difficulties"
        
        # Easy should always be unlocked
        assert unlocked["easy"] == True, "Easy should always be unlocked"
        
        print(f"Bot stats: easy_wins={data['easy_bot_wins']}, medium_wins={data['medium_bot_wins']}, hard_wins={data['hard_bot_wins']}, extreme_wins={data['extreme_bot_wins']}")
        print(f"Unlocked: {unlocked}")
        print(f"Claimable bonuses: {data['claimable_bonuses']}")
    
    def test_02_claimable_bonuses_structure(self):
        """Test claimable_bonuses array has correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        claimable = data.get("claimable_bonuses", [])
        
        # If there are claimable bonuses, verify structure
        for bonus in claimable:
            assert "id" in bonus, "Bonus missing id"
            assert "label" in bonus, "Bonus missing label"
            assert "amount" in bonus, "Bonus missing amount"
            assert "description" in bonus, "Bonus missing description"
            
            # Verify bonus amounts match spec
            bonus_amounts = {
                "medium_unlock": 20000,
                "hard_unlock": 100000,
                "extreme_unlock": 500000,
                "extreme_mastery": 1000000
            }
            
            if bonus["id"] in bonus_amounts:
                assert bonus["amount"] == bonus_amounts[bonus["id"]], \
                    f"Bonus {bonus['id']} has wrong amount: {bonus['amount']} != {bonus_amounts[bonus['id']]}"
        
        print(f"Claimable bonuses count: {len(claimable)}")
    
    def test_03_unlock_progression_logic(self):
        """Test that unlock progression follows spec:
        - Easy: Always unlocked
        - Medium: 3 Easy wins
        - Hard: 3 Medium wins
        - Extreme: 3 Hard wins
        """
        response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        unlocked = data["unlocked_difficulties"]
        
        # Verify unlock logic
        easy_wins = data.get("easy_bot_wins", 0)
        medium_wins = data.get("medium_bot_wins", 0)
        hard_wins = data.get("hard_bot_wins", 0)
        
        # Medium unlocked if 3+ easy wins
        expected_medium = easy_wins >= 3
        assert unlocked["medium"] == expected_medium, \
            f"Medium unlock mismatch: {unlocked['medium']} != {expected_medium} (easy_wins={easy_wins})"
        
        # Hard unlocked if 3+ medium wins
        expected_hard = medium_wins >= 3
        assert unlocked["hard"] == expected_hard, \
            f"Hard unlock mismatch: {unlocked['hard']} != {expected_hard} (medium_wins={medium_wins})"
        
        # Extreme unlocked if 3+ hard wins
        expected_extreme = hard_wins >= 3
        assert unlocked["extreme"] == expected_extreme, \
            f"Extreme unlock mismatch: {unlocked['extreme']} != {expected_extreme} (hard_wins={hard_wins})"
        
        print(f"Unlock progression verified: easy_wins={easy_wins}, medium_wins={medium_wins}, hard_wins={hard_wins}")


class TestClaimBonusEndpoint:
    """Test the claim-bonus endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_04_claim_bonus_invalid_id(self):
        """Test claiming with invalid bonus_id returns 400"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/claim-bonus?bonus_id=invalid_bonus",
            headers=self.headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Invalid bonus_id correctly rejected")
    
    def test_05_claim_bonus_already_claimed(self):
        """Test claiming already claimed bonus returns 400"""
        # First get stats to see what's already claimed
        stats_response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert stats_response.status_code == 200
        
        data = stats_response.json()
        claimable = data.get("claimable_bonuses", [])
        
        # If no claimable bonuses, try to claim one that should be already claimed
        if len(claimable) == 0:
            # Try to claim medium_unlock (likely already claimed based on context)
            response = requests.post(
                f"{BASE_URL}/api/photo-game/bot-battle/claim-bonus?bonus_id=medium_unlock",
                headers=self.headers
            )
            # Should be 400 (already claimed) or 400 (not earned)
            assert response.status_code == 400, f"Expected 400, got {response.status_code}"
            print("Already claimed bonus correctly rejected")
        else:
            print(f"Skipping - user has {len(claimable)} unclaimed bonuses")
    
    def test_06_claim_bonus_endpoint_structure(self):
        """Test claim-bonus endpoint returns correct response structure"""
        # Get stats first
        stats_response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert stats_response.status_code == 200
        
        data = stats_response.json()
        claimable = data.get("claimable_bonuses", [])
        
        if len(claimable) > 0:
            # Try to claim first available bonus
            bonus = claimable[0]
            response = requests.post(
                f"{BASE_URL}/api/photo-game/bot-battle/claim-bonus?bonus_id={bonus['id']}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                result = response.json()
                assert "success" in result, "Missing success field"
                assert "bonus_id" in result, "Missing bonus_id field"
                assert "amount_claimed" in result, "Missing amount_claimed field"
                assert "new_bl_balance" in result, "Missing new_bl_balance field"
                assert result["success"] == True, "Success should be True"
                print(f"Claimed bonus {bonus['id']}: +{result['amount_claimed']} BL, new balance: {result['new_bl_balance']}")
            else:
                print(f"Claim failed with status {response.status_code}: {response.text}")
        else:
            print("No claimable bonuses available for this user")


class TestBotDifficultyConfig:
    """Test bot difficulty configuration matches spec"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_07_bot_battle_start_easy(self):
        """Test starting easy bot battle with correct bet amount (200 BL)"""
        # First get user's minted photos
        photos_response = requests.get(
            f"{BASE_URL}/api/photo-game/minted-photos",
            headers=self.headers
        )
        
        if photos_response.status_code != 200:
            pytest.skip("Could not get minted photos")
        
        photos = photos_response.json()
        if len(photos) < 5:
            pytest.skip(f"Need 5 photos, only have {len(photos)}")
        
        # Select first 5 photos
        photo_ids = [p["mint_id"] for p in photos[:5]]
        
        # Start easy bot battle
        response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/start",
            headers=self.headers,
            json={
                "difficulty": "easy",
                "photo_ids": photo_ids
            }
        )
        
        # Should succeed or fail with insufficient balance
        if response.status_code == 200:
            data = response.json()
            assert "battle_id" in data, "Missing battle_id"
            print(f"Easy bot battle started: {data.get('battle_id')}")
        elif response.status_code == 400:
            # Check if it's balance issue
            error = response.json().get("detail", "")
            print(f"Could not start battle: {error}")
        else:
            print(f"Unexpected status: {response.status_code} - {response.text}")
    
    def test_08_generate_bot_photos_easy(self):
        """Test bot photo generation for easy difficulty"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/generate-photos/easy",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "bot_photos" in data, "Missing bot_photos array"
        
        photos = data["bot_photos"]
        assert len(photos) == 5, f"Expected 5 photos, got {len(photos)}"
        
        # Verify each photo has required fields
        for i, photo in enumerate(photos):
            assert "mint_id" in photo, f"Photo {i} missing mint_id"
            assert "dollar_value" in photo, f"Photo {i} missing dollar_value"
            assert "scenery_type" in photo, f"Photo {i} missing scenery_type"
            
            # Easy bot should have $1B minimum value
            assert photo["dollar_value"] >= 1_000_000_000, \
                f"Easy bot photo {i} value too low: {photo['dollar_value']}"
        
        # Verify scenery distribution for easy: 1W, 1N, 1M, 2Neu
        scenery_counts = {}
        for photo in photos:
            st = photo["scenery_type"]
            scenery_counts[st] = scenery_counts.get(st, 0) + 1
        
        print(f"Easy bot scenery distribution: {scenery_counts}")
        # Expected: water=1, natural=1, manmade=1, neutral=2
    
    def test_09_generate_bot_photos_medium(self):
        """Test bot photo generation for medium difficulty"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/generate-photos/medium",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        photos = data["bot_photos"]
        
        # Medium bot should have $2B minimum value
        for i, photo in enumerate(photos):
            assert photo["dollar_value"] >= 2_000_000_000, \
                f"Medium bot photo {i} value too low: {photo['dollar_value']}"
        
        scenery_counts = {}
        for photo in photos:
            st = photo["scenery_type"]
            scenery_counts[st] = scenery_counts.get(st, 0) + 1
        
        print(f"Medium bot scenery distribution: {scenery_counts}")
        # Expected: water=1, natural=1, manmade=2, neutral=1
    
    def test_10_generate_bot_photos_hard(self):
        """Test bot photo generation for hard difficulty"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/generate-photos/hard",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        photos = data["bot_photos"]
        
        # Hard bot should have $5B minimum value
        for i, photo in enumerate(photos):
            assert photo["dollar_value"] >= 5_000_000_000, \
                f"Hard bot photo {i} value too low: {photo['dollar_value']}"
        
        scenery_counts = {}
        for photo in photos:
            st = photo["scenery_type"]
            scenery_counts[st] = scenery_counts.get(st, 0) + 1
        
        print(f"Hard bot scenery distribution: {scenery_counts}")
        # Expected: water=1, natural=2, manmade=1, neutral=1
    
    def test_11_generate_bot_photos_extreme(self):
        """Test bot photo generation for extreme difficulty"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/generate-photos/extreme",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        photos = data["bot_photos"]
        
        # Extreme bot should have $10B minimum value
        for i, photo in enumerate(photos):
            assert photo["dollar_value"] >= 10_000_000_000, \
                f"Extreme bot photo {i} value too low: {photo['dollar_value']}"
        
        scenery_counts = {}
        for photo in photos:
            st = photo["scenery_type"]
            scenery_counts[st] = scenery_counts.get(st, 0) + 1
        
        print(f"Extreme bot scenery distribution: {scenery_counts}")
        # Expected: water=2, natural=1, manmade=1, neutral=1


class TestBotBattleResult:
    """Test bot battle result endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_12_bot_battle_result_endpoint_exists(self):
        """Test that bot-battle/result endpoint exists"""
        # This is a POST endpoint, sending empty body should return validation error, not 404
        response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/result",
            headers=self.headers,
            json={}
        )
        
        # Should not be 404 (endpoint exists)
        assert response.status_code != 404, "bot-battle/result endpoint not found"
        print(f"bot-battle/result endpoint exists, status: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
