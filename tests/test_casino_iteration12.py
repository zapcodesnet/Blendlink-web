"""
Casino System Backend Tests - Iteration 12
Tests all 7 casino games: Slots, Blackjack, Roulette, Video Poker, Baccarat, Craps, Wheel of Fortune
Plus stats and history endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://production-url-fix.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "Test123456"


class TestCasinoAuth:
    """Test casino endpoints require authentication"""
    
    def test_slots_requires_auth(self):
        """Slots spin requires authentication"""
        response = requests.post(f"{BASE_URL}/api/casino/slots/spin", json={"amount": 100, "lines": 1})
        assert response.status_code == 401
        print("✓ Slots spin requires authentication (401)")
    
    def test_blackjack_requires_auth(self):
        """Blackjack start requires authentication"""
        response = requests.post(f"{BASE_URL}/api/casino/blackjack/start", json={"amount": 100, "game_type": "blackjack"})
        assert response.status_code == 401
        print("✓ Blackjack start requires authentication (401)")
    
    def test_roulette_requires_auth(self):
        """Roulette spin requires authentication"""
        response = requests.post(f"{BASE_URL}/api/casino/roulette/spin", json=[{"amount": 50, "bet_type": "red", "bet_value": None}])
        assert response.status_code == 401
        print("✓ Roulette spin requires authentication (401)")
    
    def test_poker_requires_auth(self):
        """Video poker deal requires authentication"""
        response = requests.post(f"{BASE_URL}/api/casino/poker/deal", json={"amount": 100})
        assert response.status_code == 401
        print("✓ Video poker deal requires authentication (401)")
    
    def test_baccarat_requires_auth(self):
        """Baccarat play requires authentication"""
        response = requests.post(f"{BASE_URL}/api/casino/baccarat/play", json={"amount": 100, "bet_on": "player"})
        assert response.status_code == 401
        print("✓ Baccarat play requires authentication (401)")
    
    def test_craps_requires_auth(self):
        """Craps roll requires authentication"""
        response = requests.post(f"{BASE_URL}/api/casino/craps/roll", json={"amount": 50, "bet_type": "pass"})
        assert response.status_code == 401
        print("✓ Craps roll requires authentication (401)")
    
    def test_wheel_requires_auth(self):
        """Wheel of Fortune spin requires authentication"""
        response = requests.post(f"{BASE_URL}/api/casino/wheel/spin", json={"amount": 50})
        assert response.status_code == 401
        print("✓ Wheel of Fortune spin requires authentication (401)")
    
    def test_stats_requires_auth(self):
        """Casino stats requires authentication"""
        response = requests.get(f"{BASE_URL}/api/casino/stats")
        assert response.status_code == 401
        print("✓ Casino stats requires authentication (401)")
    
    def test_history_requires_auth(self):
        """Casino history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/casino/history")
        assert response.status_code == 401
        print("✓ Casino history requires authentication (401)")


class TestCasinoGames:
    """Test casino game functionality with authenticated user"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get initial balance
        profile = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        self.initial_balance = profile.json().get("bl_coins", 0)
        print(f"Initial balance: {self.initial_balance} BL")
    
    # ============== SLOTS TESTS ==============
    def test_slots_spin_success(self):
        """Test slots spin with valid bet"""
        response = requests.post(
            f"{BASE_URL}/api/casino/slots/spin",
            headers=self.headers,
            json={"amount": 10, "lines": 1}
        )
        assert response.status_code == 200, f"Slots spin failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "reels" in data, "Missing reels in response"
        assert "middle_row" in data, "Missing middle_row in response"
        assert "bet" in data, "Missing bet in response"
        assert "winnings" in data, "Missing winnings in response"
        assert "balance" in data, "Missing balance in response"
        assert "multiplier" in data, "Missing multiplier in response"
        
        # Verify reels structure (3x3 grid)
        assert len(data["reels"]) == 3, "Should have 3 reels"
        for reel in data["reels"]:
            assert len(reel) == 3, "Each reel should have 3 symbols"
        
        print(f"✓ Slots spin successful - Bet: {data['bet']}, Winnings: {data['winnings']}, Balance: {data['balance']}")
    
    def test_slots_bet_limits(self):
        """Test slots bet limits (min 10, max 10000)"""
        # Test below minimum
        response = requests.post(
            f"{BASE_URL}/api/casino/slots/spin",
            headers=self.headers,
            json={"amount": 5, "lines": 1}
        )
        assert response.status_code == 422, "Should reject bet below minimum"
        print("✓ Slots rejects bet below minimum (10 BL)")
        
        # Test above maximum
        response = requests.post(
            f"{BASE_URL}/api/casino/slots/spin",
            headers=self.headers,
            json={"amount": 15000, "lines": 1}
        )
        assert response.status_code == 422, "Should reject bet above maximum"
        print("✓ Slots rejects bet above maximum (10000 BL)")
    
    # ============== BLACKJACK TESTS ==============
    def test_blackjack_start_success(self):
        """Test starting a blackjack game"""
        response = requests.post(
            f"{BASE_URL}/api/casino/blackjack/start",
            headers=self.headers,
            json={"amount": 50, "game_type": "blackjack"}
        )
        assert response.status_code == 200, f"Blackjack start failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "game_id" in data, "Missing game_id"
        assert "player_hand" in data, "Missing player_hand"
        assert "player_value" in data, "Missing player_value"
        
        # If game not immediately resolved (natural blackjack)
        if "result" not in data:
            assert "dealer_showing" in data, "Missing dealer_showing"
            assert "actions" in data, "Missing actions"
            assert len(data["player_hand"]) >= 2, "Player should have at least 2 cards"
            print(f"✓ Blackjack started - Game ID: {data['game_id']}, Player: {data['player_hand']} ({data['player_value']})")
            return data["game_id"]
        else:
            print(f"✓ Blackjack natural - Result: {data['result']}, Winnings: {data.get('winnings', 0)}")
            return None
    
    def test_blackjack_hit_action(self):
        """Test blackjack hit action"""
        # Start a game first
        start_response = requests.post(
            f"{BASE_URL}/api/casino/blackjack/start",
            headers=self.headers,
            json={"amount": 50, "game_type": "blackjack"}
        )
        assert start_response.status_code == 200
        start_data = start_response.json()
        
        if "result" in start_data:
            print("✓ Blackjack hit test skipped (natural blackjack)")
            return
        
        game_id = start_data["game_id"]
        
        # Perform hit action
        hit_response = requests.post(
            f"{BASE_URL}/api/casino/blackjack/action",
            headers=self.headers,
            json={"game_id": game_id, "action": "hit"}
        )
        assert hit_response.status_code == 200, f"Hit action failed: {hit_response.text}"
        hit_data = hit_response.json()
        
        assert "player_hand" in hit_data, "Missing player_hand after hit"
        assert "player_value" in hit_data, "Missing player_value after hit"
        print(f"✓ Blackjack hit successful - Hand: {hit_data['player_hand']} ({hit_data['player_value']})")
    
    def test_blackjack_stand_action(self):
        """Test blackjack stand action"""
        # Start a game first
        start_response = requests.post(
            f"{BASE_URL}/api/casino/blackjack/start",
            headers=self.headers,
            json={"amount": 50, "game_type": "blackjack"}
        )
        assert start_response.status_code == 200
        start_data = start_response.json()
        
        if "result" in start_data:
            print("✓ Blackjack stand test skipped (natural blackjack)")
            return
        
        game_id = start_data["game_id"]
        
        # Perform stand action
        stand_response = requests.post(
            f"{BASE_URL}/api/casino/blackjack/action",
            headers=self.headers,
            json={"game_id": game_id, "action": "stand"}
        )
        assert stand_response.status_code == 200, f"Stand action failed: {stand_response.text}"
        stand_data = stand_response.json()
        
        # Stand should resolve the game
        assert "result" in stand_data, "Stand should resolve the game"
        assert "dealer_hand" in stand_data, "Missing dealer_hand after stand"
        assert "dealer_value" in stand_data, "Missing dealer_value after stand"
        assert "winnings" in stand_data, "Missing winnings after stand"
        assert "balance" in stand_data, "Missing balance after stand"
        
        print(f"✓ Blackjack stand successful - Result: {stand_data['result']}, Winnings: {stand_data['winnings']}")
    
    # ============== ROULETTE TESTS ==============
    def test_roulette_red_bet(self):
        """Test roulette with red bet"""
        response = requests.post(
            f"{BASE_URL}/api/casino/roulette/spin",
            headers=self.headers,
            json=[{"amount": 50, "bet_type": "red", "bet_value": None}]
        )
        assert response.status_code == 200, f"Roulette spin failed: {response.text}"
        data = response.json()
        
        assert "result_number" in data, "Missing result_number"
        assert "result_color" in data, "Missing result_color"
        assert "total_bet" in data, "Missing total_bet"
        assert "total_winnings" in data, "Missing total_winnings"
        assert "balance" in data, "Missing balance"
        assert "bet_results" in data, "Missing bet_results"
        
        print(f"✓ Roulette red bet - Number: {data['result_number']} ({data['result_color']}), Winnings: {data['total_winnings']}")
    
    def test_roulette_black_bet(self):
        """Test roulette with black bet"""
        response = requests.post(
            f"{BASE_URL}/api/casino/roulette/spin",
            headers=self.headers,
            json=[{"amount": 50, "bet_type": "black", "bet_value": None}]
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Roulette black bet - Number: {data['result_number']} ({data['result_color']}), Winnings: {data['total_winnings']}")
    
    def test_roulette_odd_even_bet(self):
        """Test roulette with odd/even bets"""
        response = requests.post(
            f"{BASE_URL}/api/casino/roulette/spin",
            headers=self.headers,
            json=[{"amount": 25, "bet_type": "odd", "bet_value": None}]
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Roulette odd bet - Number: {data['result_number']}, Winnings: {data['total_winnings']}")
    
    # ============== WHEEL OF FORTUNE TESTS ==============
    def test_wheel_spin_success(self):
        """Test wheel of fortune spin"""
        response = requests.post(
            f"{BASE_URL}/api/casino/wheel/spin",
            headers=self.headers,
            json={"amount": 50}
        )
        assert response.status_code == 200, f"Wheel spin failed: {response.text}"
        data = response.json()
        
        assert "segment" in data, "Missing segment"
        assert "multiplier" in data, "Missing multiplier"
        assert "bet" in data, "Missing bet"
        assert "winnings" in data, "Missing winnings"
        assert "balance" in data, "Missing balance"
        
        print(f"✓ Wheel spin successful - Segment: {data['segment']['label']}, Multiplier: {data['multiplier']}x, Winnings: {data['winnings']}")
    
    # ============== VIDEO POKER TESTS ==============
    def test_poker_deal_success(self):
        """Test video poker deal"""
        response = requests.post(
            f"{BASE_URL}/api/casino/poker/deal",
            headers=self.headers,
            json={"amount": 100}
        )
        assert response.status_code == 200, f"Poker deal failed: {response.text}"
        data = response.json()
        
        assert "game_id" in data, "Missing game_id"
        assert "hand" in data, "Missing hand"
        assert "bet" in data, "Missing bet"
        assert len(data["hand"]) == 5, "Should have 5 cards"
        
        print(f"✓ Poker deal successful - Game ID: {data['game_id']}, Hand: {data['hand']}")
        return data["game_id"]
    
    def test_poker_draw_success(self):
        """Test video poker draw"""
        # Deal first
        deal_response = requests.post(
            f"{BASE_URL}/api/casino/poker/deal",
            headers=self.headers,
            json={"amount": 100}
        )
        assert deal_response.status_code == 200
        deal_data = deal_response.json()
        game_id = deal_data["game_id"]
        
        # Draw with holding first 2 cards
        draw_response = requests.post(
            f"{BASE_URL}/api/casino/poker/draw?game_id={game_id}&hold=0&hold=1",
            headers=self.headers
        )
        assert draw_response.status_code == 200, f"Poker draw failed: {draw_response.text}"
        draw_data = draw_response.json()
        
        assert "hand" in draw_data, "Missing hand after draw"
        assert "hand_name" in draw_data, "Missing hand_name"
        assert "winnings" in draw_data, "Missing winnings"
        assert "balance" in draw_data, "Missing balance"
        
        print(f"✓ Poker draw successful - Hand: {draw_data['hand']}, Result: {draw_data['hand_name']}, Winnings: {draw_data['winnings']}")
    
    # ============== BACCARAT TESTS ==============
    def test_baccarat_player_bet(self):
        """Test baccarat with player bet"""
        response = requests.post(
            f"{BASE_URL}/api/casino/baccarat/play",
            headers=self.headers,
            json={"amount": 100, "bet_on": "player"}
        )
        assert response.status_code == 200, f"Baccarat play failed: {response.text}"
        data = response.json()
        
        assert "player_hand" in data, "Missing player_hand"
        assert "player_value" in data, "Missing player_value"
        assert "banker_hand" in data, "Missing banker_hand"
        assert "banker_value" in data, "Missing banker_value"
        assert "winner" in data, "Missing winner"
        assert "winnings" in data, "Missing winnings"
        assert "balance" in data, "Missing balance"
        
        print(f"✓ Baccarat player bet - Player: {data['player_value']}, Banker: {data['banker_value']}, Winner: {data['winner']}, Winnings: {data['winnings']}")
    
    def test_baccarat_banker_bet(self):
        """Test baccarat with banker bet"""
        response = requests.post(
            f"{BASE_URL}/api/casino/baccarat/play",
            headers=self.headers,
            json={"amount": 100, "bet_on": "banker"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Baccarat banker bet - Winner: {data['winner']}, Winnings: {data['winnings']}")
    
    def test_baccarat_tie_bet(self):
        """Test baccarat with tie bet"""
        response = requests.post(
            f"{BASE_URL}/api/casino/baccarat/play",
            headers=self.headers,
            json={"amount": 50, "bet_on": "tie"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Baccarat tie bet - Winner: {data['winner']}, Winnings: {data['winnings']}")
    
    # ============== CRAPS TESTS ==============
    def test_craps_pass_bet(self):
        """Test craps with pass line bet"""
        response = requests.post(
            f"{BASE_URL}/api/casino/craps/roll",
            headers=self.headers,
            json={"amount": 50, "bet_type": "pass"}
        )
        assert response.status_code == 200, f"Craps roll failed: {response.text}"
        data = response.json()
        
        assert "dice" in data, "Missing dice"
        assert "total" in data, "Missing total"
        assert "bet_type" in data, "Missing bet_type"
        assert "result" in data, "Missing result"
        assert "winnings" in data, "Missing winnings"
        assert "balance" in data, "Missing balance"
        assert len(data["dice"]) == 2, "Should have 2 dice"
        
        print(f"✓ Craps pass bet - Dice: {data['dice']}, Total: {data['total']}, Result: {data['result']}, Winnings: {data['winnings']}")
    
    def test_craps_dont_pass_bet(self):
        """Test craps with don't pass bet"""
        response = requests.post(
            f"{BASE_URL}/api/casino/craps/roll",
            headers=self.headers,
            json={"amount": 50, "bet_type": "dont_pass"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Craps don't pass bet - Total: {data['total']}, Result: {data['result']}, Winnings: {data['winnings']}")
    
    def test_craps_field_bet(self):
        """Test craps with field bet"""
        response = requests.post(
            f"{BASE_URL}/api/casino/craps/roll",
            headers=self.headers,
            json={"amount": 50, "bet_type": "field"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Craps field bet - Total: {data['total']}, Result: {data['result']}, Winnings: {data['winnings']}")
    
    def test_craps_any_seven_bet(self):
        """Test craps with any seven bet"""
        response = requests.post(
            f"{BASE_URL}/api/casino/craps/roll",
            headers=self.headers,
            json={"amount": 50, "bet_type": "any_seven"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Craps any seven bet - Total: {data['total']}, Result: {data['result']}, Winnings: {data['winnings']}")
    
    # ============== STATS & HISTORY TESTS ==============
    def test_casino_stats(self):
        """Test casino stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/casino/stats",
            headers=self.headers
        )
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        assert "totals" in data, "Missing totals"
        assert "current_balance" in data, "Missing current_balance"
        assert "total_bets" in data["totals"], "Missing total_bets in totals"
        assert "total_won" in data["totals"], "Missing total_won in totals"
        assert "games_played" in data["totals"], "Missing games_played in totals"
        
        print(f"✓ Casino stats - Games: {data['totals']['games_played']}, Wagered: {data['totals']['total_bets']}, Won: {data['totals']['total_won']}")
    
    def test_casino_history(self):
        """Test casino history endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/casino/history?limit=10",
            headers=self.headers
        )
        assert response.status_code == 200, f"History failed: {response.text}"
        data = response.json()
        
        assert "history" in data, "Missing history"
        assert "count" in data, "Missing count"
        
        if data["count"] > 0:
            game = data["history"][0]
            assert "game_type" in game, "Missing game_type in history"
            assert "bet_amount" in game, "Missing bet_amount in history"
            assert "won_amount" in game, "Missing won_amount in history"
            assert "timestamp" in game, "Missing timestamp in history"
        
        print(f"✓ Casino history - {data['count']} games found")
    
    def test_casino_leaderboard(self):
        """Test casino leaderboard endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/casino/leaderboard",
            headers=self.headers
        )
        assert response.status_code == 200, f"Leaderboard failed: {response.text}"
        data = response.json()
        
        assert "leaderboard" in data, "Missing leaderboard"
        print(f"✓ Casino leaderboard - {len(data['leaderboard'])} players")


class TestCasinoBalanceUpdates:
    """Test that balance updates correctly after games"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_balance_decreases_on_loss(self):
        """Test that balance decreases when losing"""
        # Get initial balance
        profile = requests.get(f"{BASE_URL}/api/auth/me", headers=self.headers)
        initial_balance = profile.json().get("bl_coins", 0)
        
        # Play a game (slots with minimum bet)
        response = requests.post(
            f"{BASE_URL}/api/casino/slots/spin",
            headers=self.headers,
            json={"amount": 10, "lines": 1}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify balance changed appropriately
        expected_balance = initial_balance - 10 + data["winnings"]
        assert data["balance"] == expected_balance, f"Balance mismatch: expected {expected_balance}, got {data['balance']}"
        
        print(f"✓ Balance update correct - Initial: {initial_balance}, Bet: 10, Winnings: {data['winnings']}, Final: {data['balance']}")
    
    def test_insufficient_balance_error(self):
        """Test error when bet exceeds balance"""
        # Try to bet more than balance
        response = requests.post(
            f"{BASE_URL}/api/casino/slots/spin",
            headers=self.headers,
            json={"amount": 999999999, "lines": 1}
        )
        # Should fail due to validation or insufficient funds
        assert response.status_code in [400, 422], f"Should reject bet exceeding balance, got {response.status_code}"
        print("✓ Insufficient balance error handled correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
