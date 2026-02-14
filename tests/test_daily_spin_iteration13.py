"""
Test Daily Spin Feature - Iteration 13
Tests for the new daily spin bonus wheel feature:
- GET /api/casino/daily-spin/status
- POST /api/casino/daily-spin/claim
- Rewards array validation
- Once per day restriction
"""
import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://wallet-coins.preview.emergentagent.com')

# Expected rewards as per user specification
EXPECTED_REWARDS = [1000, 5000, 15000, 35000, 80000, 200000]

class TestDailySpinAPI:
    """Daily Spin API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "Test123456"}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        data = login_response.json()
        self.token = data.get("token") or data.get("access_token")
        self.user = data.get("user", {})
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
    def test_daily_spin_status_returns_correct_structure(self):
        """Test GET /api/casino/daily-spin/status returns correct response structure"""
        response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        
        assert response.status_code == 200, f"Status check failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "can_spin" in data, "Missing 'can_spin' field"
        assert "rewards" in data, "Missing 'rewards' field"
        assert "current_balance" in data, "Missing 'current_balance' field"
        
        # Verify data types
        assert isinstance(data["can_spin"], bool), "can_spin should be boolean"
        assert isinstance(data["rewards"], list), "rewards should be a list"
        assert isinstance(data["current_balance"], (int, float)), "current_balance should be numeric"
        
    def test_daily_spin_rewards_match_specification(self):
        """Test that rewards array matches user specification: [1000, 5000, 15000, 35000, 80000, 200000]"""
        response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify rewards match exactly
        assert data["rewards"] == EXPECTED_REWARDS, \
            f"Rewards mismatch. Expected {EXPECTED_REWARDS}, got {data['rewards']}"
        
        # Verify 6 reward segments
        assert len(data["rewards"]) == 6, f"Expected 6 reward segments, got {len(data['rewards'])}"
        
    def test_daily_spin_claim_already_claimed_today(self):
        """Test POST /api/casino/daily-spin/claim returns error when already claimed today"""
        # First check status
        status_response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        status_data = status_response.json()
        
        # Try to claim
        claim_response = self.session.post(f"{BASE_URL}/api/casino/daily-spin/claim")
        
        if status_data.get("can_spin") == False:
            # Should return 400 error
            assert claim_response.status_code == 400, \
                f"Expected 400 for already claimed, got {claim_response.status_code}"
            
            error_data = claim_response.json()
            assert "detail" in error_data, "Missing error detail"
            assert "already claimed" in error_data["detail"].lower() or "come back tomorrow" in error_data["detail"].lower(), \
                f"Unexpected error message: {error_data['detail']}"
        else:
            # If can_spin is True, claim should succeed
            assert claim_response.status_code == 200, \
                f"Claim failed when can_spin was True: {claim_response.text}"
                
    def test_daily_spin_status_requires_auth(self):
        """Test that daily spin status requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        
    def test_daily_spin_claim_requires_auth(self):
        """Test that daily spin claim requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.post(f"{BASE_URL}/api/casino/daily-spin/claim")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        
    def test_daily_spin_status_shows_next_spin_time_when_claimed(self):
        """Test that status shows next_spin_time when already claimed"""
        response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        
        assert response.status_code == 200
        data = response.json()
        
        if data["can_spin"] == False:
            assert "next_spin_time" in data, "Missing next_spin_time when can_spin is False"
            # Verify it's a valid ISO timestamp
            try:
                datetime.fromisoformat(data["next_spin_time"].replace("Z", "+00:00"))
            except ValueError:
                pytest.fail(f"Invalid next_spin_time format: {data['next_spin_time']}")


class TestCasinoGamesStillWork:
    """Verify existing casino games still work after daily spin addition"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "Test123456"}
        )
        assert login_response.status_code == 200
        
        data = login_response.json()
        self.token = data.get("token") or data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
    def test_slots_still_works(self):
        """Test slots endpoint still works"""
        response = self.session.post(
            f"{BASE_URL}/api/casino/slots/spin",
            json={"amount": 10, "lines": 1}
        )
        assert response.status_code == 200, f"Slots failed: {response.text}"
        data = response.json()
        assert "reels" in data
        assert "balance" in data
        
    def test_blackjack_still_works(self):
        """Test blackjack endpoint still works"""
        response = self.session.post(
            f"{BASE_URL}/api/casino/blackjack/start",
            json={"amount": 10, "game_type": "blackjack"}
        )
        assert response.status_code == 200, f"Blackjack failed: {response.text}"
        data = response.json()
        assert "player_hand" in data or "game_id" in data
        
    def test_roulette_still_works(self):
        """Test roulette endpoint still works"""
        response = self.session.post(
            f"{BASE_URL}/api/casino/roulette/spin",
            json=[{"amount": 10, "bet_type": "red", "bet_value": None}]
        )
        assert response.status_code == 200, f"Roulette failed: {response.text}"
        data = response.json()
        assert "result_number" in data
        assert "balance" in data
        
    def test_wheel_still_works(self):
        """Test wheel of fortune endpoint still works"""
        response = self.session.post(
            f"{BASE_URL}/api/casino/wheel/spin",
            json={"amount": 10}
        )
        assert response.status_code == 200, f"Wheel failed: {response.text}"
        data = response.json()
        assert "multiplier" in data
        assert "balance" in data
        
    def test_casino_stats_still_works(self):
        """Test casino stats endpoint still works"""
        response = self.session.get(f"{BASE_URL}/api/casino/stats")
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        assert "totals" in data
        
    def test_casino_history_still_works(self):
        """Test casino history endpoint still works"""
        response = self.session.get(f"{BASE_URL}/api/casino/history?limit=10")
        assert response.status_code == 200, f"History failed: {response.text}"
        data = response.json()
        assert "history" in data


class TestDailySpinInHistory:
    """Test that daily spin appears in casino history"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "Test123456"}
        )
        assert login_response.status_code == 200
        
        data = login_response.json()
        self.token = data.get("token") or data.get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
    def test_daily_spin_recorded_in_history(self):
        """Test that daily spin claims are recorded in casino history"""
        response = self.session.get(f"{BASE_URL}/api/casino/history?limit=50")
        assert response.status_code == 200
        
        data = response.json()
        history = data.get("history", [])
        
        # Check if any daily_spin entries exist
        daily_spin_entries = [h for h in history if h.get("game_type") == "daily_spin"]
        
        # If user has claimed daily spin, it should be in history
        status_response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        status_data = status_response.json()
        
        if status_data.get("can_spin") == False:
            # User has claimed today, should have at least one daily_spin entry
            assert len(daily_spin_entries) >= 1, \
                "Daily spin was claimed but not found in history"
            
            # Verify daily spin entry structure
            if daily_spin_entries:
                entry = daily_spin_entries[0]
                assert entry.get("bet_amount") == 0, "Daily spin should have 0 bet amount"
                assert entry.get("won_amount") in EXPECTED_REWARDS, \
                    f"Daily spin reward {entry.get('won_amount')} not in expected rewards"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
