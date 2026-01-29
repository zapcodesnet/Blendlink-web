"""
Test Bot Battle Tracking and Round Result Recording
Tests for:
1. Bot battle wins tracking (POST /api/photo-game/bot-battle/result)
2. Bot battle stats (GET /api/photo-game/bot-battle/stats)
3. Round result recording with stamina/XP/streak updates (POST /api/photo-game/record-round-result)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestBotBattleTracking:
    """Test bot battle win tracking and difficulty unlocking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user_id = response.json()["user"]["user_id"]
    
    def test_get_bot_battle_stats(self):
        """Test getting bot battle stats"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/bot-battle/stats",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "easy_bot_wins" in data
        assert "medium_bot_wins" in data
        assert "hard_bot_wins" in data
        assert "extreme_bot_wins" in data
        assert "total_bot_battles" in data
        assert "total_bot_wins" in data
        assert "unlocked_difficulties" in data
        
        # Easy should always be unlocked
        assert data["unlocked_difficulties"]["easy"] == True
        print(f"Bot battle stats: easy_wins={data['easy_bot_wins']}, medium_wins={data['medium_bot_wins']}")
    
    def test_start_bot_battle(self):
        """Test starting a bot battle"""
        # First get battle photos
        photos_response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers=self.headers
        )
        assert photos_response.status_code == 200
        photos = photos_response.json()["photos"]
        assert len(photos) >= 5, "Need at least 5 photos for bot battle"
        
        photo_ids = [p["mint_id"] for p in photos[:5]]
        
        # Start bot battle
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
        assert data["difficulty"] == "easy"
        assert data["bet_amount"] == 100  # Easy bot fixed bet
        assert len(data["player_photos"]) == 5
        assert len(data["bot_photos"]) == 5
        
        print(f"Bot battle started: session_id={data['session_id']}")
        return data["session_id"]
    
    def test_record_bot_battle_result_win(self):
        """Test recording a bot battle win"""
        session_id = f"test_session_{int(time.time())}"
        
        response = requests.post(
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
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["player_won"] == True
        assert data["winnings"] == 200  # 100 * 2 (player bet + bot bet)
        assert "easy_wins" in data
        
        print(f"Bot battle win recorded: easy_wins={data['easy_wins']}, winnings={data['winnings']}")
    
    def test_record_bot_battle_result_loss(self):
        """Test recording a bot battle loss"""
        session_id = f"test_session_loss_{int(time.time())}"
        
        response = requests.post(
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
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["player_won"] == False
        assert data["winnings"] == 0
        assert data["bet_lost"] == 100
        
        print(f"Bot battle loss recorded: bet_lost={data['bet_lost']}")


class TestRoundResultRecording:
    """Test round result recording with stamina, XP, and streak updates"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_record_round_win(self):
        """Test recording a round win - should update stamina, XP, and streak"""
        # Get a photo to use
        photos_response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers=self.headers
        )
        assert photos_response.status_code == 200
        photos = photos_response.json()["photos"]
        assert len(photos) > 0
        
        photo_id = photos[0]["mint_id"]
        initial_stamina = photos[0]["stamina"]
        
        # Record a win
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=self.headers,
            json={
                "photo_id": photo_id,
                "round_won": True
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["round_won"] == True
        assert data["stamina_cost"] == 1  # Win costs 1 stamina
        assert data["xp_gained"] >= 1  # At least 1 XP per round
        assert "new_win_streak" in data
        assert "new_stamina" in data
        
        print(f"Round win recorded: stamina_cost={data['stamina_cost']}, xp_gained={data['xp_gained']}, win_streak={data['new_win_streak']}")
    
    def test_record_round_loss(self):
        """Test recording a round loss - should cost more stamina and reset streak"""
        # Get a photo to use
        photos_response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers=self.headers
        )
        assert photos_response.status_code == 200
        photos = photos_response.json()["photos"]
        assert len(photos) > 0
        
        photo_id = photos[0]["mint_id"]
        
        # Record a loss
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=self.headers,
            json={
                "photo_id": photo_id,
                "round_won": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert data["round_won"] == False
        assert data["stamina_cost"] == 2  # Loss costs 2 stamina
        assert data["new_win_streak"] == 0  # Streak resets on loss
        assert "new_lose_streak" in data
        
        print(f"Round loss recorded: stamina_cost={data['stamina_cost']}, lose_streak={data['new_lose_streak']}")
    
    def test_xp_multiplier_with_subscription(self):
        """Test that XP is multiplied based on subscription tier"""
        photos_response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers=self.headers
        )
        assert photos_response.status_code == 200
        photos = photos_response.json()["photos"]
        photo_id = photos[0]["mint_id"]
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/record-round-result",
            headers=self.headers,
            json={
                "photo_id": photo_id,
                "round_won": True
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify XP multiplier is returned
        assert "xp_multiplier" in data
        assert "subscription_tier" in data
        
        # Free tier should have 1x multiplier
        if data["subscription_tier"] == "free":
            assert data["xp_multiplier"] == 1
        
        print(f"XP multiplier: {data['xp_multiplier']}x for {data['subscription_tier']} tier")


class TestBattlePhotos:
    """Test battle photos endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        assert response.status_code == 200
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_battle_photos(self):
        """Test getting battle-ready photos with stamina info"""
        response = requests.get(
            f"{BASE_URL}/api/photo-game/battle-photos",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "photos" in data
        assert "count" in data
        assert "available_count" in data
        
        if data["count"] > 0:
            photo = data["photos"][0]
            # Verify photo has required fields
            assert "mint_id" in photo
            assert "name" in photo
            assert "dollar_value" in photo
            assert "stamina" in photo
            assert "is_available" in photo
            assert "win_streak" in photo
            assert "medals" in photo
            
            print(f"Battle photos: {data['count']} total, {data['available_count']} available")
            print(f"First photo: {photo['name']}, stamina={photo['stamina']}%, win_streak={photo['win_streak']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
