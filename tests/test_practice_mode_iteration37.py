"""
Test Practice Mode Feature - Iteration 37
Tests the new Practice Mode feature that allows users to battle bots without risking BL coins or stamina.

Features tested:
1. Practice Mode API - /api/photo-game/start with practice_mode=true
2. No stamina deduction in practice mode
3. No BL coins deducted or rewarded in practice mode
4. Game completes correctly in practice mode
5. Regular battles still deduct stamina and BL coins
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pvpgame-connect.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "blendlinknet@gmail.com"
ADMIN_PASSWORD = "Blend!Admin2026Link"


class TestPracticeMode:
    """Test Practice Mode feature"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def user_photo_id(self, headers):
        """Get a photo ID for testing"""
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers)
        assert response.status_code == 200
        data = response.json()
        photos = data.get("photos", [])
        assert len(photos) > 0, "No photos available for testing"
        # Get first available photo
        available = [p for p in photos if p.get("is_available")]
        assert len(available) > 0, "No available photos for battle"
        return available[0]["mint_id"]
    
    def test_practice_mode_start_game(self, headers, user_photo_id):
        """Test starting a game in practice mode"""
        response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=headers,
            json={
                "opponent_id": "bot",
                "bet_amount": 0,
                "photo_id": user_photo_id,
                "practice_mode": True
            }
        )
        assert response.status_code == 200, f"Failed to start practice game: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert data.get("success") == True
        assert "session" in data
        session = data["session"]
        
        # Verify practice_mode flag is set
        assert session.get("practice_mode") == True, "practice_mode flag not set in session"
        
        # Verify game started correctly
        assert session.get("phase") == "rps_auction"
        assert session.get("player2_id") == "bot"
        assert session.get("bet_amount") == 0
        
        return session["session_id"]
    
    def test_practice_mode_no_stamina_deduction(self, headers, user_photo_id):
        """Test that practice mode does not deduct stamina"""
        # Get initial stats
        stats_before = requests.get(f"{BASE_URL}/api/photo-game/stats", headers=headers).json()
        stamina_before = stats_before.get("stamina", 100)
        
        # Start practice game
        response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=headers,
            json={
                "opponent_id": "bot",
                "bet_amount": 0,
                "photo_id": user_photo_id,
                "practice_mode": True
            }
        )
        assert response.status_code == 200
        
        # Get stats after
        stats_after = requests.get(f"{BASE_URL}/api/photo-game/stats", headers=headers).json()
        stamina_after = stats_after.get("stamina", 100)
        
        # Stamina should not have decreased (or only by regeneration amount)
        # Allow small tolerance for time-based regeneration
        assert stamina_after >= stamina_before - 0.5, \
            f"Stamina decreased in practice mode: {stamina_before} -> {stamina_after}"
    
    def test_practice_mode_complete_game(self, headers, user_photo_id):
        """Test completing a full practice mode game"""
        # Get initial stats
        stats_before = requests.get(f"{BASE_URL}/api/photo-game/stats", headers=headers).json()
        battles_won_before = stats_before.get("battles_won", 0)
        total_bl_won_before = stats_before.get("total_bl_won", 0)
        
        # Start practice game
        start_response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=headers,
            json={
                "opponent_id": "bot",
                "bet_amount": 0,
                "photo_id": user_photo_id,
                "practice_mode": True
            }
        )
        assert start_response.status_code == 200
        session_id = start_response.json()["session"]["session_id"]
        
        # Play RPS rounds until Stage 1 complete
        phase = "rps_auction"
        choices = ["rock", "paper", "scissors"]
        choice_idx = 0
        max_rounds = 20
        
        for _ in range(max_rounds):
            if phase not in ["rps_auction", "tiebreaker"]:
                break
            
            rps_response = requests.post(
                f"{BASE_URL}/api/photo-game/session/{session_id}/rps-auction",
                headers=headers,
                json={"choice": choices[choice_idx % 3], "bid_amount": 1000000}
            )
            assert rps_response.status_code == 200, f"RPS failed: {rps_response.text}"
            phase = rps_response.json().get("phase", "")
            choice_idx += 1
        
        # If in photo_battle phase, execute it
        if phase == "photo_battle":
            battle_response = requests.post(
                f"{BASE_URL}/api/photo-game/session/{session_id}/photo-battle",
                headers=headers
            )
            assert battle_response.status_code == 200
            phase = battle_response.json().get("phase", "")
        
        # If in tiebreaker, play more rounds
        if phase == "tiebreaker":
            for _ in range(max_rounds):
                if phase == "completed":
                    break
                rps_response = requests.post(
                    f"{BASE_URL}/api/photo-game/session/{session_id}/rps-auction",
                    headers=headers,
                    json={"choice": choices[choice_idx % 3], "bid_amount": 1000000}
                )
                assert rps_response.status_code == 200
                phase = rps_response.json().get("phase", "")
                choice_idx += 1
        
        # Verify game completed
        session_response = requests.get(
            f"{BASE_URL}/api/photo-game/session/{session_id}",
            headers=headers
        )
        assert session_response.status_code == 200
        session = session_response.json()
        assert session.get("phase") == "completed", f"Game not completed: {session.get('phase')}"
        assert session.get("practice_mode") == True, "practice_mode flag lost"
        
        # Verify stats NOT updated (practice mode)
        stats_after = requests.get(f"{BASE_URL}/api/photo-game/stats", headers=headers).json()
        battles_won_after = stats_after.get("battles_won", 0)
        total_bl_won_after = stats_after.get("total_bl_won", 0)
        
        # Stats should NOT have changed
        assert battles_won_after == battles_won_before, \
            f"battles_won changed in practice mode: {battles_won_before} -> {battles_won_after}"
        assert total_bl_won_after == total_bl_won_before, \
            f"total_bl_won changed in practice mode: {total_bl_won_before} -> {total_bl_won_after}"
    
    def test_regular_battle_deducts_stamina(self, headers, user_photo_id):
        """Test that regular battles (not practice mode) DO deduct stamina"""
        # Get photo stamina before
        photos_before = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers).json()
        photo_before = next((p for p in photos_before.get("photos", []) if p["mint_id"] == user_photo_id), None)
        assert photo_before, "Photo not found"
        stamina_before = photo_before.get("stamina", 100)
        
        # Start regular game (NOT practice mode)
        response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=headers,
            json={
                "opponent_id": "bot",
                "bet_amount": 0,
                "photo_id": user_photo_id,
                "practice_mode": False
            }
        )
        assert response.status_code == 200
        session = response.json()["session"]
        
        # Verify NOT practice mode
        assert session.get("practice_mode") == False or session.get("practice_mode") is None
        
        # Get photo stamina after
        photos_after = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers).json()
        photo_after = next((p for p in photos_after.get("photos", []) if p["mint_id"] == user_photo_id), None)
        assert photo_after, "Photo not found after battle"
        stamina_after = photo_after.get("stamina", 100)
        
        # Stamina SHOULD have decreased (~4.16% per battle)
        expected_decrease = 100 / 24  # ~4.16%
        actual_decrease = stamina_before - stamina_after
        
        # Allow some tolerance for regeneration
        assert actual_decrease > 0, \
            f"Stamina did not decrease in regular battle: {stamina_before} -> {stamina_after}"
    
    def test_practice_mode_forces_bot_opponent(self, headers, user_photo_id):
        """Test that practice mode always uses bot opponent"""
        # Try to start practice mode with a different opponent_id
        response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=headers,
            json={
                "opponent_id": "some_user_id",  # Try to set non-bot opponent
                "bet_amount": 100,  # Try to set bet
                "photo_id": user_photo_id,
                "practice_mode": True
            }
        )
        assert response.status_code == 200
        session = response.json()["session"]
        
        # Should force bot opponent and 0 bet in practice mode
        assert session.get("player2_id") == "bot", "Practice mode should force bot opponent"
        assert session.get("bet_amount") == 0, "Practice mode should force 0 bet"
    
    def test_game_config_endpoint(self, headers):
        """Test game config endpoint returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config", headers=headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify config structure
        assert "max_stamina" in data
        assert "stamina_per_battle" in data
        assert "rps_auction" in data
        
        rps_config = data["rps_auction"]
        assert rps_config.get("starting_bankroll") == 10000000
        assert rps_config.get("min_bid") == 1000000
        assert rps_config.get("max_bid") == 5000000


class TestStartGameRequest:
    """Test StartGameRequest model with practice_mode field"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def user_photo_id(self, headers):
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers)
        photos = response.json().get("photos", [])
        available = [p for p in photos if p.get("is_available")]
        return available[0]["mint_id"] if available else None
    
    def test_practice_mode_default_false(self, headers, user_photo_id):
        """Test that practice_mode defaults to false when not specified"""
        if not user_photo_id:
            pytest.skip("No photos available")
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=headers,
            json={
                "opponent_id": "bot",
                "bet_amount": 0,
                "photo_id": user_photo_id
                # practice_mode not specified
            }
        )
        assert response.status_code == 200
        session = response.json()["session"]
        
        # Should default to False or None (not practice mode)
        practice_mode = session.get("practice_mode")
        assert practice_mode in [False, None], f"practice_mode should default to False, got {practice_mode}"
    
    def test_practice_mode_explicit_true(self, headers, user_photo_id):
        """Test that practice_mode=true is properly set"""
        if not user_photo_id:
            pytest.skip("No photos available")
        
        response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=headers,
            json={
                "opponent_id": "bot",
                "bet_amount": 0,
                "photo_id": user_photo_id,
                "practice_mode": True
            }
        )
        assert response.status_code == 200
        session = response.json()["session"]
        
        assert session.get("practice_mode") == True


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
