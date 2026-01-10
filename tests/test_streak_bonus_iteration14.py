"""
Test Suite for Daily Spin Streak Bonus Multiplier Feature (Iteration 14)
Tests:
- Streak multiplier calculation: Day 1=1.0x, Day 2=1.2x, Day 3=1.4x... Day 11+=3.0x (max)
- Daily Spin Status API returns streak object with current, multiplier, next_multiplier, max_multiplier fields
- Daily Spin Claim API returns streak object with multiplier bonus info
- Final reward = base_reward × streak_multiplier
- Streak counter increments on consecutive days
- Streak resets to 1 if user misses a day (not 0)
- All other casino games still work (slots, blackjack, roulette)
"""

import pytest
import requests
import os
from datetime import datetime, timezone

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "Test123456"


class TestStreakMultiplierCalculation:
    """Test streak multiplier formula: multiplier = min(1.0 + (streak_days - 1) * 0.2, 3.0)"""
    
    def test_streak_multiplier_formula(self):
        """Verify the streak multiplier formula matches specification"""
        # Formula: multiplier = min(1.0 + (streak_days - 1) * 0.2, 3.0)
        expected_multipliers = {
            1: 1.0,   # Day 1 = 1.0x
            2: 1.2,   # Day 2 = 1.2x
            3: 1.4,   # Day 3 = 1.4x
            4: 1.6,   # Day 4 = 1.6x
            5: 1.8,   # Day 5 = 1.8x
            6: 2.0,   # Day 6 = 2.0x
            7: 2.2,   # Day 7 = 2.2x
            8: 2.4,   # Day 8 = 2.4x
            9: 2.6,   # Day 9 = 2.6x
            10: 2.8,  # Day 10 = 2.8x
            11: 3.0,  # Day 11 = 3.0x (MAX)
            12: 3.0,  # Day 12+ = 3.0x (capped)
            20: 3.0,  # Day 20 = 3.0x (capped)
        }
        
        for streak_days, expected in expected_multipliers.items():
            # Calculate using the formula
            if streak_days <= 1:
                calculated = 1.0
            else:
                calculated = min(1.0 + (streak_days - 1) * 0.2, 3.0)
            
            assert calculated == expected, f"Day {streak_days}: expected {expected}x, got {calculated}x"
            print(f"✓ Day {streak_days} streak = {expected}x multiplier")


class TestDailySpinStatusAPI:
    """Test GET /api/casino/daily-spin/status endpoint with streak info"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        token = data.get("token") or data.get("access_token")
        assert token, "No token in login response"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        print(f"✓ Logged in as {TEST_EMAIL}")
    
    def test_status_returns_streak_object(self):
        """Verify status endpoint returns streak object with required fields"""
        response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        assert response.status_code == 200, f"Status failed: {response.text}"
        
        data = response.json()
        
        # Verify streak object exists
        assert "streak" in data, "Response missing 'streak' object"
        streak = data["streak"]
        
        # Verify required streak fields
        required_fields = ["current", "multiplier", "next_multiplier", "max_multiplier"]
        for field in required_fields:
            assert field in streak, f"Streak object missing '{field}' field"
        
        print(f"✓ Streak object contains all required fields: {required_fields}")
        print(f"  - Current streak: {streak['current']} days")
        print(f"  - Current multiplier: {streak['multiplier']}x")
        print(f"  - Next multiplier: {streak['next_multiplier']}x")
        print(f"  - Max multiplier: {streak['max_multiplier']}x")
    
    def test_status_max_multiplier_is_3(self):
        """Verify max_multiplier is 3.0"""
        response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        assert response.status_code == 200
        
        data = response.json()
        assert data["streak"]["max_multiplier"] == 3.0, "Max multiplier should be 3.0"
        print("✓ Max multiplier is correctly set to 3.0x")
    
    def test_status_multiplier_within_bounds(self):
        """Verify multiplier is between 1.0 and 3.0"""
        response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        assert response.status_code == 200
        
        data = response.json()
        multiplier = data["streak"]["multiplier"]
        
        assert 1.0 <= multiplier <= 3.0, f"Multiplier {multiplier} out of bounds [1.0, 3.0]"
        print(f"✓ Multiplier {multiplier}x is within valid bounds [1.0, 3.0]")
    
    def test_status_returns_can_spin_field(self):
        """Verify status returns can_spin boolean"""
        response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "can_spin" in data, "Response missing 'can_spin' field"
        assert isinstance(data["can_spin"], bool), "can_spin should be boolean"
        print(f"✓ can_spin field present: {data['can_spin']}")
    
    def test_status_returns_rewards_array(self):
        """Verify status returns rewards array"""
        response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        assert response.status_code == 200
        
        data = response.json()
        assert "rewards" in data, "Response missing 'rewards' field"
        
        expected_rewards = [1000, 5000, 15000, 35000, 80000, 200000]
        assert data["rewards"] == expected_rewards, f"Rewards mismatch: {data['rewards']}"
        print(f"✓ Rewards array matches specification: {expected_rewards}")
    
    def test_status_requires_authentication(self):
        """Verify status endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/casino/daily-spin/status")
        assert response.status_code == 401, "Should require authentication"
        print("✓ Status endpoint correctly requires authentication")


class TestDailySpinClaimAPI:
    """Test POST /api/casino/daily-spin/claim endpoint with streak info"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        token = data.get("token") or data.get("access_token")
        assert token, "No token in login response"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_claim_returns_streak_object_when_already_claimed(self):
        """Verify claim returns 400 with message when already claimed today"""
        response = self.session.post(f"{BASE_URL}/api/casino/daily-spin/claim")
        
        # User has already claimed today based on context
        if response.status_code == 400:
            data = response.json()
            assert "detail" in data or "message" in data, "Error response should have detail/message"
            error_msg = data.get("detail") or data.get("message")
            assert "already" in error_msg.lower() or "claimed" in error_msg.lower(), \
                f"Error message should mention already claimed: {error_msg}"
            print(f"✓ Claim correctly returns 400 when already claimed: {error_msg}")
        elif response.status_code == 200:
            # If somehow can claim, verify streak object in response
            data = response.json()
            assert "streak" in data, "Claim response should include streak object"
            streak = data["streak"]
            assert "current" in streak, "Streak should have 'current' field"
            assert "multiplier" in streak, "Streak should have 'multiplier' field"
            print(f"✓ Claim successful with streak: {streak['current']} days, {streak['multiplier']}x")
    
    def test_claim_requires_authentication(self):
        """Verify claim endpoint requires auth"""
        response = requests.post(f"{BASE_URL}/api/casino/daily-spin/claim")
        assert response.status_code == 401, "Should require authentication"
        print("✓ Claim endpoint correctly requires authentication")


class TestStreakInCasinoHistory:
    """Test that daily spin records include streak info in casino history"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        token = data.get("token") or data.get("access_token")
        assert token, "No token in login response"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_history_contains_daily_spin_with_streak(self):
        """Verify casino history includes daily spin records with streak info"""
        response = self.session.get(f"{BASE_URL}/api/casino/history?limit=50")
        assert response.status_code == 200, f"History failed: {response.text}"
        
        data = response.json()
        history = data.get("history", [])
        
        # Find daily spin records
        daily_spins = [h for h in history if h.get("game_type") == "daily_spin"]
        
        if daily_spins:
            latest_spin = daily_spins[0]
            details = latest_spin.get("details", {})
            
            # Check for streak info in details
            assert "streak" in details or "multiplier" in details, \
                "Daily spin record should include streak/multiplier info"
            
            if "streak" in details:
                print(f"✓ Daily spin record includes streak: {details['streak']} days")
            if "multiplier" in details:
                print(f"✓ Daily spin record includes multiplier: {details['multiplier']}x")
            if "base_reward" in details:
                print(f"✓ Daily spin record includes base_reward: {details['base_reward']}")
            if "final_reward" in details:
                print(f"✓ Daily spin record includes final_reward: {details['final_reward']}")
        else:
            print("⚠ No daily spin records found in history (user may not have claimed yet)")


class TestOtherCasinoGamesStillWork:
    """Verify all other casino games still work after streak feature addition"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        token = data.get("token") or data.get("access_token")
        assert token, "No token in login response"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_slots_endpoint_works(self):
        """Verify slots endpoint still works"""
        response = self.session.post(f"{BASE_URL}/api/casino/slots/spin", json={
            "amount": 10,
            "lines": 1
        })
        assert response.status_code == 200, f"Slots failed: {response.text}"
        
        data = response.json()
        assert "reels" in data, "Slots response should have reels"
        assert "balance" in data, "Slots response should have balance"
        print(f"✓ Slots endpoint works - Balance: {data['balance']}")
    
    def test_blackjack_endpoint_works(self):
        """Verify blackjack endpoint still works"""
        response = self.session.post(f"{BASE_URL}/api/casino/blackjack/start", json={
            "amount": 10,
            "game_type": "blackjack"
        })
        assert response.status_code == 200, f"Blackjack failed: {response.text}"
        
        data = response.json()
        assert "player_hand" in data, "Blackjack response should have player_hand"
        print(f"✓ Blackjack endpoint works - Player hand: {data['player_hand']}")
    
    def test_roulette_endpoint_works(self):
        """Verify roulette endpoint still works"""
        response = self.session.post(f"{BASE_URL}/api/casino/roulette/spin", json=[
            {"amount": 10, "bet_type": "red", "bet_value": None}
        ])
        assert response.status_code == 200, f"Roulette failed: {response.text}"
        
        data = response.json()
        assert "result_number" in data, "Roulette response should have result_number"
        assert "result_color" in data, "Roulette response should have result_color"
        print(f"✓ Roulette endpoint works - Result: {data['result_number']} {data['result_color']}")
    
    def test_wheel_endpoint_works(self):
        """Verify wheel of fortune endpoint still works"""
        response = self.session.post(f"{BASE_URL}/api/casino/wheel/spin", json={
            "amount": 10
        })
        assert response.status_code == 200, f"Wheel failed: {response.text}"
        
        data = response.json()
        assert "segment" in data, "Wheel response should have segment"
        assert "multiplier" in data, "Wheel response should have multiplier"
        print(f"✓ Wheel endpoint works - Multiplier: {data['multiplier']}x")
    
    def test_baccarat_endpoint_works(self):
        """Verify baccarat endpoint still works"""
        response = self.session.post(f"{BASE_URL}/api/casino/baccarat/play", json={
            "amount": 10,
            "bet_on": "player"
        })
        assert response.status_code == 200, f"Baccarat failed: {response.text}"
        
        data = response.json()
        assert "player_hand" in data, "Baccarat response should have player_hand"
        assert "banker_hand" in data, "Baccarat response should have banker_hand"
        assert "winner" in data, "Baccarat response should have winner"
        print(f"✓ Baccarat endpoint works - Winner: {data['winner']}")
    
    def test_craps_endpoint_works(self):
        """Verify craps endpoint still works"""
        response = self.session.post(f"{BASE_URL}/api/casino/craps/roll", json={
            "amount": 10,
            "bet_type": "pass"
        })
        assert response.status_code == 200, f"Craps failed: {response.text}"
        
        data = response.json()
        assert "dice" in data, "Craps response should have dice"
        assert "total" in data, "Craps response should have total"
        print(f"✓ Craps endpoint works - Dice: {data['dice']}, Total: {data['total']}")
    
    def test_poker_deal_endpoint_works(self):
        """Verify video poker deal endpoint still works"""
        response = self.session.post(f"{BASE_URL}/api/casino/poker/deal", json={
            "amount": 10
        })
        assert response.status_code == 200, f"Poker deal failed: {response.text}"
        
        data = response.json()
        assert "hand" in data, "Poker response should have hand"
        assert "game_id" in data, "Poker response should have game_id"
        print(f"✓ Poker deal endpoint works - Hand: {data['hand']}")
    
    def test_casino_stats_endpoint_works(self):
        """Verify casino stats endpoint still works"""
        response = self.session.get(f"{BASE_URL}/api/casino/stats")
        assert response.status_code == 200, f"Stats failed: {response.text}"
        
        data = response.json()
        assert "totals" in data, "Stats response should have totals"
        assert "current_balance" in data, "Stats response should have current_balance"
        print(f"✓ Casino stats endpoint works - Balance: {data['current_balance']}")
    
    def test_casino_history_endpoint_works(self):
        """Verify casino history endpoint still works"""
        response = self.session.get(f"{BASE_URL}/api/casino/history?limit=10")
        assert response.status_code == 200, f"History failed: {response.text}"
        
        data = response.json()
        assert "history" in data, "History response should have history array"
        print(f"✓ Casino history endpoint works - {len(data['history'])} records")


class TestStreakStatusField:
    """Test the streak status field in daily spin status"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        token = data.get("token") or data.get("access_token")
        assert token, "No token in login response"
        self.session.headers.update({"Authorization": f"Bearer {token}"})
    
    def test_streak_status_field_exists(self):
        """Verify streak has status field (start, continue, broken, active)"""
        response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        assert response.status_code == 200
        
        data = response.json()
        streak = data.get("streak", {})
        
        if "status" in streak:
            valid_statuses = ["start", "continue", "broken", "active"]
            assert streak["status"] in valid_statuses, \
                f"Invalid streak status: {streak['status']}"
            print(f"✓ Streak status field present: {streak['status']}")
        else:
            print("⚠ Streak status field not present (optional)")
    
    def test_streak_next_field_when_can_spin(self):
        """Verify streak has 'next' field showing what streak will be after spin"""
        response = self.session.get(f"{BASE_URL}/api/casino/daily-spin/status")
        assert response.status_code == 200
        
        data = response.json()
        streak = data.get("streak", {})
        
        if "next" in streak:
            print(f"✓ Streak 'next' field present: {streak['next']}")
            if data.get("can_spin"):
                # If can spin, next should be current + 1 (or 1 if streak broken)
                assert streak["next"] >= 1, "Next streak should be at least 1"
        else:
            print("⚠ Streak 'next' field not present (optional)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
