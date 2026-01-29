"""
Bot Battle Unlock System Tests
Tests for bot difficulty unlock progression and bonus rewards
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBotBattleUnlockSystem:
    """Test bot battle unlock progression system"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        # Login to get token
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_bot_battle_stats(self):
        """Test GET /api/photo-game/bot-battle/stats returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify required fields exist
        assert "easy_bot_wins" in data
        assert "medium_bot_wins" in data
        assert "hard_bot_wins" in data
        assert "extreme_bot_wins" in data
        assert "unlocked_difficulties" in data
        
        # Verify unlocked_difficulties structure
        unlocked = data["unlocked_difficulties"]
        assert "easy" in unlocked
        assert "medium" in unlocked
        assert "hard" in unlocked
        assert "extreme" in unlocked
        
        # Easy should always be unlocked
        assert unlocked["easy"] == True
        
        print(f"Bot stats: easy_wins={data['easy_bot_wins']}, medium_wins={data['medium_bot_wins']}")
        print(f"Unlocked: {unlocked}")
    
    def test_record_easy_bot_win(self):
        """Test POST /api/photo-game/bot-battle/result records easy bot win"""
        # Get initial stats
        initial_response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        initial_easy_wins = initial_response.json().get("easy_bot_wins", 0)
        
        # Record a win
        response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/result",
            headers=self.headers,
            json={
                "session_id": f"test_easy_{int(time.time())}",
                "difficulty": "easy",
                "player_won": True,
                "rounds_won": 3,
                "rounds_lost": 1,
                "bet_amount": 100
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["player_won"] == True
        assert data["winnings"] == 200  # 100 * 2 (pot)
        assert data["difficulty"] == "easy"
        
        # Verify stats updated
        updated_response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        updated_easy_wins = updated_response.json().get("easy_bot_wins", 0)
        assert updated_easy_wins == initial_easy_wins + 1
        
        print(f"Easy wins: {initial_easy_wins} -> {updated_easy_wins}")
    
    def test_record_bot_loss(self):
        """Test POST /api/photo-game/bot-battle/result records loss correctly"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/result",
            headers=self.headers,
            json={
                "session_id": f"test_loss_{int(time.time())}",
                "difficulty": "easy",
                "player_won": False,
                "rounds_won": 1,
                "rounds_lost": 3,
                "bet_amount": 100
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["player_won"] == False
        assert data["winnings"] == 0
        assert data["bet_lost"] == 100
        
        print(f"Loss recorded: bet_lost={data['bet_lost']}")
    
    def test_medium_bot_unlock_check(self):
        """Test that medium bot is unlocked when easy_bot_wins >= 3"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        easy_wins = data.get("easy_bot_wins", 0)
        medium_unlocked = data["unlocked_difficulties"]["medium"]
        
        # Medium should be unlocked if easy_wins >= 3
        if easy_wins >= 3:
            assert medium_unlocked == True, f"Medium should be unlocked with {easy_wins} easy wins"
        else:
            assert medium_unlocked == False, f"Medium should be locked with {easy_wins} easy wins"
        
        print(f"Easy wins: {easy_wins}, Medium unlocked: {medium_unlocked}")
    
    def test_record_medium_bot_win(self):
        """Test POST /api/photo-game/bot-battle/result records medium bot win"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/result",
            headers=self.headers,
            json={
                "session_id": f"test_medium_{int(time.time())}",
                "difficulty": "medium",
                "player_won": True,
                "rounds_won": 3,
                "rounds_lost": 2,
                "bet_amount": 500
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["player_won"] == True
        assert data["winnings"] == 1000  # 500 * 2 (pot)
        assert data["difficulty"] == "medium"
        assert "medium_wins" in data
        
        print(f"Medium win recorded: medium_wins={data['medium_wins']}")
    
    def test_unlock_bonus_structure(self):
        """Test that unlock bonus fields are present in response"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/result",
            headers=self.headers,
            json={
                "session_id": f"test_bonus_{int(time.time())}",
                "difficulty": "easy",
                "player_won": True,
                "rounds_won": 3,
                "rounds_lost": 0,
                "bet_amount": 100
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        # Verify unlock bonus fields exist
        assert "newly_unlocked_difficulty" in data
        assert "unlock_bonus" in data
        assert "extreme_mastery_bonus" in data
        assert "message" in data
        
        print(f"Unlock fields: newly_unlocked={data['newly_unlocked_difficulty']}, bonus={data['unlock_bonus']}")
    
    def test_invalid_difficulty_rejected(self):
        """Test that invalid difficulty is rejected"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/result",
            headers=self.headers,
            json={
                "session_id": f"test_invalid_{int(time.time())}",
                "difficulty": "invalid_difficulty",
                "player_won": True,
                "rounds_won": 3,
                "rounds_lost": 0,
                "bet_amount": 100
            }
        )
        assert response.status_code == 400
        print("Invalid difficulty correctly rejected")
    
    def test_unauthenticated_request_rejected(self):
        """Test that unauthenticated requests are rejected"""
        response = requests.get(f"{BASE_URL}/api/photo-game/bot-battle/stats")
        assert response.status_code == 401
        print("Unauthenticated request correctly rejected")


class TestBotBattleStart:
    """Test bot battle start endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_start_easy_bot_battle(self):
        """Test starting an easy bot battle"""
        # First get user's minted photos
        photos_response = requests.get(
            f"{BASE_URL}/api/photo-game/minted-photos",
            headers=self.headers
        )
        
        if photos_response.status_code != 200:
            pytest.skip("No minted photos available for testing")
        
        photos = photos_response.json()
        if len(photos) < 5:
            pytest.skip(f"Need at least 5 photos, only have {len(photos)}")
        
        photo_ids = [p["mint_id"] for p in photos[:5]]
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/bot-battle/start",
            headers=self.headers,
            json={
                "difficulty": "easy",
                "photo_ids": photo_ids
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "session_id" in data
        assert "bot_photos" in data
        assert len(data["bot_photos"]) == 5
        assert "bet_amount" in data
        
        print(f"Bot battle started: session={data['session_id']}, bet={data['bet_amount']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
