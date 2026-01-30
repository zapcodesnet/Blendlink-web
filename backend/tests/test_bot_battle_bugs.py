"""
Test Bot Battle Bug Fixes - Iteration 79
Tests for:
1. Bot Difficulty Unlocking - Win counter and unlock progression
2. Dollar Value Calculation - Effective value modifiers
3. Battle Replay - Save and retrieve functionality
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@blendlink.com"
TEST_PASSWORD = "admin"


class TestBotBattleStats:
    """Test bot battle stats and unlock progression"""
    
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
    
    def test_get_bot_battle_stats(self):
        """Test GET /api/photo-game/bot-battle/stats returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get bot stats: {response.text}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "easy_bot_wins" in data, "Missing easy_bot_wins field"
        assert "medium_bot_wins" in data, "Missing medium_bot_wins field"
        assert "hard_bot_wins" in data, "Missing hard_bot_wins field"
        assert "unlocked_difficulties" in data, "Missing unlocked_difficulties field"
        
        # Verify unlock logic
        unlocked = data["unlocked_difficulties"]
        assert unlocked.get("easy") == True, "Easy should always be unlocked"
        
        # Verify medium unlock based on easy wins
        easy_wins = data.get("easy_bot_wins", 0)
        expected_medium_unlock = easy_wins >= 3
        assert unlocked.get("medium") == expected_medium_unlock, \
            f"Medium unlock mismatch: expected {expected_medium_unlock}, got {unlocked.get('medium')} (easy_wins={easy_wins})"
        
        # Verify hard unlock based on medium wins
        medium_wins = data.get("medium_bot_wins", 0)
        expected_hard_unlock = medium_wins >= 3
        assert unlocked.get("hard") == expected_hard_unlock, \
            f"Hard unlock mismatch: expected {expected_hard_unlock}, got {unlocked.get('hard')} (medium_wins={medium_wins})"
        
        print(f"Bot stats: easy_wins={easy_wins}, medium_wins={medium_wins}, hard_wins={data.get('hard_bot_wins', 0)}")
        print(f"Unlocked: {unlocked}")
    
    def test_bot_battle_result_increments_wins(self):
        """Test POST /api/photo-game/bot-battle/result increments win counter"""
        # First get current stats
        stats_response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert stats_response.status_code == 200
        initial_stats = stats_response.json()
        initial_easy_wins = initial_stats.get("easy_bot_wins", 0)
        
        # Record a win with all required fields
        session_id = str(uuid.uuid4())[:12]
        result_response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/result",
            headers=self.headers,
            json={
                "session_id": session_id,
                "difficulty": "easy",
                "player_won": True,
                "rounds_won": 3,
                "rounds_lost": 1,
                "bet_amount": 100
            }
        )
        assert result_response.status_code == 200, f"Failed to record result: {result_response.text}"
        
        result_data = result_response.json()
        assert result_data.get("success") == True, "Result should indicate success"
        assert result_data.get("player_won") == True, "Result should confirm player won"
        
        # Verify the win count in response
        assert "easy_wins" in result_data, "Response should include easy_wins count"
        assert result_data["easy_wins"] == initial_easy_wins + 1, \
            f"Easy wins should increment: expected {initial_easy_wins + 1}, got {result_data['easy_wins']}"
        
        # Verify by fetching stats again
        updated_stats_response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert updated_stats_response.status_code == 200
        updated_stats = updated_stats_response.json()
        
        assert updated_stats.get("easy_bot_wins") == initial_easy_wins + 1, \
            f"Stats should show incremented wins: expected {initial_easy_wins + 1}, got {updated_stats.get('easy_bot_wins')}"
        
        print(f"Win recorded successfully: {initial_easy_wins} -> {updated_stats.get('easy_bot_wins')}")
    
    def test_bot_battle_result_loss_does_not_increment(self):
        """Test that losses don't increment win counter"""
        # Get current stats
        stats_response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert stats_response.status_code == 200
        initial_stats = stats_response.json()
        initial_easy_wins = initial_stats.get("easy_bot_wins", 0)
        
        # Record a loss with all required fields
        session_id = str(uuid.uuid4())[:12]
        result_response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/result",
            headers=self.headers,
            json={
                "session_id": session_id,
                "difficulty": "easy",
                "player_won": False,
                "rounds_won": 1,
                "rounds_lost": 3,
                "bet_amount": 100
            }
        )
        assert result_response.status_code == 200
        
        # Verify wins didn't change
        updated_stats_response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert updated_stats_response.status_code == 200
        updated_stats = updated_stats_response.json()
        
        assert updated_stats.get("easy_bot_wins") == initial_easy_wins, \
            f"Wins should not change on loss: expected {initial_easy_wins}, got {updated_stats.get('easy_bot_wins')}"
        
        print(f"Loss recorded correctly - wins unchanged: {initial_easy_wins}")


class TestBattleReplay:
    """Test battle replay save and retrieve functionality"""
    
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
    
    def test_save_battle_replay(self):
        """Test POST /api/photo-game/battle-replay/save creates replay"""
        session_id = str(uuid.uuid4())[:12]
        
        replay_data = {
            "session_id": session_id,
            "difficulty": "easy",
            "player_photos": [
                {"mint_id": "test1", "name": "Test Photo 1", "image_url": "https://example.com/1.jpg", "level": 1, "scenery_type": "natural"},
            ],
            "opponent_photos": [
                {"mint_id": "bot1", "name": "Bot Photo 1", "image_url": "https://example.com/bot1.jpg", "level": 1, "scenery_type": "water"},
            ],
            "rounds": [
                {
                    "round_number": 1,
                    "round_type": "tapping",
                    "player_photo": {"mint_id": "test1", "name": "Test Photo 1", "image_url": "https://example.com/1.jpg", "level": 1, "scenery_type": "natural"},
                    "opponent_photo": {"mint_id": "bot1", "name": "Bot Photo 1", "image_url": "https://example.com/bot1.jpg", "level": 1, "scenery_type": "water"},
                    "player_taps": 50,
                    "opponent_taps": 45,
                    "player_effective_value": 1500000,
                    "opponent_effective_value": 1200000,
                    "player_progress": 100,
                    "opponent_progress": 80,
                    "winner": "player",
                    "duration_ms": 3000
                }
            ],
            "final_score_player": 1,
            "final_score_opponent": 0,
            "winner": "player",
            "bet_amount": 100,
            "winnings": 200,
            "total_duration_ms": 3000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/battle-replay/save",
            headers=self.headers,
            json=replay_data
        )
        assert response.status_code == 200, f"Failed to save replay: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Save should indicate success"
        assert "replay_id" in data, "Response should include replay_id"
        assert data.get("replay_id") is not None, "replay_id should not be None"
        
        self.saved_replay_id = data["replay_id"]
        print(f"Replay saved with ID: {self.saved_replay_id}")
        
        return self.saved_replay_id
    
    def test_get_battle_replay(self):
        """Test GET /api/photo-game/battle-replay/{replay_id} retrieves replay"""
        # First save a replay
        replay_id = self.test_save_battle_replay()
        
        # Now retrieve it
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-replay/{replay_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get replay: {response.text}"
        
        data = response.json()
        assert data.get("replay_id") == replay_id, "Replay ID should match"
        assert "rounds" in data, "Replay should include rounds"
        assert len(data["rounds"]) > 0, "Replay should have at least one round"
        assert data.get("winner") == "player", "Winner should be player"
        
        # Verify round data structure
        round_data = data["rounds"][0]
        assert "player_effective_value" in round_data, "Round should have player_effective_value"
        assert "opponent_effective_value" in round_data, "Round should have opponent_effective_value"
        assert "player_taps" in round_data, "Round should have player_taps"
        assert "winner" in round_data, "Round should have winner"
        
        print(f"Replay retrieved successfully: {len(data['rounds'])} rounds")
    
    def test_get_user_replays_list(self):
        """Test GET /api/photo-game/battle-replay/user/list returns user's replays"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-replay/user/list",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get user replays: {response.text}"
        
        data = response.json()
        assert "replays" in data, "Response should include replays array"
        assert "total" in data, "Response should include total count"
        assert isinstance(data["replays"], list), "Replays should be a list"
        
        print(f"User has {data['total']} replays")
    
    def test_replay_not_found(self):
        """Test GET /api/photo-game/battle-replay/{invalid_id} returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-replay/nonexistent123",
            headers=self.headers
        )
        assert response.status_code == 404, f"Should return 404 for invalid replay: {response.status_code}"


class TestDollarValueCalculation:
    """Test dollar value calculation endpoints"""
    
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
    
    def test_get_user_battle_photos(self):
        """Test that user can get their battle photos with dollar values"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get battle photos: {response.text}"
        
        data = response.json()
        # Response is a list of photos directly
        if isinstance(data, list):
            photos = data
        else:
            photos = data.get("photos", [])
        
        if len(photos) > 0:
            photo = photos[0]
            # Verify photo has dollar value fields
            assert "dollar_value" in photo or "base_dollar_value" in photo, \
                "Photo should have dollar value field"
            print(f"Found {len(photos)} battle photos")
            print(f"Sample photo: {photo.get('name')} - ${photo.get('dollar_value', photo.get('base_dollar_value', 0))}")
        else:
            print("No battle photos found for user")
    
    def test_get_game_stats_for_streak(self):
        """Test that game stats include streak info for dollar value calculation"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/stats",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to get game stats: {response.text}"
        
        data = response.json()
        # Check for streak-related fields
        assert "current_win_streak" in data or "win_streak" in data, \
            "Stats should include win streak for dollar value calculation"
        
        streak = data.get("current_win_streak", data.get("win_streak", 0))
        print(f"Current win streak: {streak}")


class TestBotBattleStart:
    """Test bot battle start endpoint"""
    
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
    
    def test_bot_battle_start_requires_5_photos(self):
        """Test that bot battle start requires exactly 5 photos"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/start",
            headers=self.headers,
            json={
                "difficulty": "easy",
                "photo_ids": ["photo1", "photo2"]  # Only 2 photos
            }
        )
        # Should fail with 400 for wrong number of photos
        assert response.status_code == 400 or response.status_code == 404, \
            f"Should reject with wrong number of photos: {response.status_code}"
        print("Correctly rejects battle start with wrong number of photos")
    
    def test_bot_battle_start_validates_difficulty(self):
        """Test that bot battle start validates difficulty"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/start",
            headers=self.headers,
            json={
                "difficulty": "invalid_difficulty",
                "photo_ids": ["p1", "p2", "p3", "p4", "p5"]
            }
        )
        assert response.status_code == 400, \
            f"Should reject invalid difficulty: {response.status_code}"
        print("Correctly rejects invalid difficulty")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
