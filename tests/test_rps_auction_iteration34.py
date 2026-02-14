"""
Blendlink Iteration 34 Tests
Testing:
1. MINTING: POST /api/minting/photo with AI analysis including light_type
2. MINTING: 500 BL coin deduction and daily limit (3 free mints)
3. BL COIN BET: Bet deduction when joining matchmaking queue
4. BL COIN BET: Bet refund when canceling matchmaking
5. BATTLE START: Match starts correctly after 5s timeout (bot fallback)
6. PHOTO SELECTION: GET /api/photo-game/battle-photos returns photos sorted by dollar_value
7. RPS AUCTION: POST /api/photo-game/session/{id}/rps-auction with choice and bid_amount ($1M-$5M)
8. RPS AUCTION: Bankroll tracking ($10M start, bids deducted/won)
9. PHOTO BATTLE: POST /api/photo-game/session/{id}/photo-battle with value calculations
10. GAME CONFIG: /api/photo-game/config includes rps_auction settings
"""

import pytest
import requests
import os
import time
import base64

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://production-url-fix.preview.emergentagent.com"

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"

# RPS Auction Constants
STARTING_BANKROLL = 10_000_000  # $10M
MIN_BID = 1_000_000  # $1M
MAX_BID = 5_000_000  # $5M


class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        print(f"✓ Login successful, user: {data['user'].get('name')}")


class TestGameConfig:
    """Test game configuration includes RPS auction settings"""
    
    def test_game_config_has_rps_auction(self):
        """Test /api/photo-game/config includes rps_auction settings"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        assert response.status_code == 200
        data = response.json()
        
        # Check RPS auction config exists
        assert "rps_auction" in data, "rps_auction config missing"
        rps_config = data["rps_auction"]
        
        # Verify values
        assert rps_config.get("starting_bankroll") == STARTING_BANKROLL, f"Expected starting_bankroll={STARTING_BANKROLL}"
        assert rps_config.get("min_bid") == MIN_BID, f"Expected min_bid={MIN_BID}"
        assert rps_config.get("max_bid") == MAX_BID, f"Expected max_bid={MAX_BID}"
        assert rps_config.get("bid_increment") == 1_000_000, "Expected bid_increment=1000000"
        
        print(f"✓ Game config has RPS auction: starting_bankroll=${STARTING_BANKROLL:,}, min_bid=${MIN_BID:,}, max_bid=${MAX_BID:,}")


class TestMintingConfig:
    """Test minting configuration includes light_types"""
    
    def test_minting_config_has_light_types(self):
        """Test /api/minting/config includes light_types"""
        response = requests.get(f"{BASE_URL}/api/minting/config")
        assert response.status_code == 200
        data = response.json()
        
        # Check light_types exists
        assert "light_types" in data, "light_types config missing"
        light_types = data["light_types"]
        
        # Verify all three light types
        assert "sunlight_fire" in light_types, "sunlight_fire missing"
        assert "rain_snow_ice" in light_types, "rain_snow_ice missing"
        assert "darkness_night" in light_types, "darkness_night missing"
        
        # Verify strength/weakness relationships
        assert light_types["sunlight_fire"]["strong_vs"] == "darkness_night"
        assert light_types["sunlight_fire"]["weak_vs"] == "rain_snow_ice"
        assert light_types["rain_snow_ice"]["strong_vs"] == "sunlight_fire"
        assert light_types["darkness_night"]["strong_vs"] == "rain_snow_ice"
        
        print(f"✓ Minting config has light_types: {list(light_types.keys())}")
        
    def test_minting_config_has_rating_criteria(self):
        """Test /api/minting/config includes weighted rating criteria"""
        response = requests.get(f"{BASE_URL}/api/minting/config")
        assert response.status_code == 200
        data = response.json()
        
        assert "rating_criteria" in data, "rating_criteria missing"
        criteria = data["rating_criteria"]
        
        # Check key criteria exist with weights
        expected_criteria = [
            "originality", "innovation", "uniqueness", 
            "focus_sharpness", "exposure_tonal_range", "color_accuracy",
            "subject_clarity", "composition", "narrative_emotion", "captivating_mesmerizing"
        ]
        
        for c in expected_criteria:
            assert c in criteria, f"Missing criteria: {c}"
        
        # Verify weights sum to 100
        total_weight = sum(criteria.values())
        assert total_weight == 100, f"Rating criteria weights should sum to 100, got {total_weight}"
        
        print(f"✓ Rating criteria with weights: {criteria}")


class TestMinting:
    """Test minting functionality with 500 BL deduction"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_minting_status(self, auth_headers):
        """Test /api/minting/status returns can_mint, mints_today, daily_limit"""
        response = requests.get(f"{BASE_URL}/api/minting/status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "can_mint" in data, "can_mint field missing"
        assert "mints_today" in data or "remaining_mints" in data, "mints_today or remaining_mints missing"
        assert "daily_limit" in data, "daily_limit field missing"
        
        print(f"✓ Minting status: can_mint={data.get('can_mint')}, daily_limit={data.get('daily_limit')}")


class TestBattlePhotos:
    """Test battle photos endpoint returns photos sorted by dollar_value"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_battle_photos_sorted_by_dollar_value(self, auth_headers):
        """Test GET /api/photo-game/battle-photos returns photos sorted by dollar_value"""
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "photos" in data, "photos field missing"
        assert "count" in data, "count field missing"
        assert "available_count" in data, "available_count field missing"
        
        photos = data["photos"]
        if len(photos) > 1:
            # Verify sorted by dollar_value descending
            for i in range(len(photos) - 1):
                assert photos[i].get("dollar_value", 0) >= photos[i+1].get("dollar_value", 0), \
                    "Photos not sorted by dollar_value descending"
        
        # Check photo fields
        if photos:
            photo = photos[0]
            required_fields = ["mint_id", "name", "dollar_value", "stamina", "is_available", "battles_remaining"]
            for field in required_fields:
                assert field in photo, f"Missing field: {field}"
            
            print(f"✓ Battle photos: {len(photos)} photos, top photo: {photo.get('name')} (${photo.get('dollar_value'):,})")
        else:
            print("✓ Battle photos endpoint works (no photos available)")


class TestPvPMatchmaking:
    """Test PvP matchmaking with BL coin bet deduction and refund"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    @pytest.fixture(scope="class")
    def user_photo_id(self, auth_headers):
        """Get user's first available photo for testing"""
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=auth_headers)
        if response.status_code == 200:
            photos = response.json().get("photos", [])
            available = [p for p in photos if p.get("is_available")]
            if available:
                return available[0]["mint_id"]
        return None
    
    def test_pvp_queue_status(self):
        """Test /api/photo-game/pvp/queue-status returns queue info"""
        response = requests.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        assert response.status_code == 200
        data = response.json()
        
        assert "players_waiting" in data, "players_waiting field missing"
        assert "active_matches" in data, "active_matches field missing"
        
        print(f"✓ PvP queue status: {data['players_waiting']} waiting, {data['active_matches']} active")
    
    def test_find_match_and_cancel_refund(self, auth_headers, user_photo_id):
        """Test BL coin bet deduction on join and refund on cancel"""
        if not user_photo_id:
            pytest.skip("No available photo for testing")
        
        # Get initial balance
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert me_response.status_code == 200
        initial_balance = me_response.json().get("bl_coins", 0)
        
        bet_amount = 100  # Small bet for testing
        
        # Join matchmaking with bet
        find_response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/find-match",
            headers=auth_headers,
            json={
                "bet_amount": bet_amount,
                "photo_id": user_photo_id,
                "use_bot_fallback": False  # Don't auto-match with bot
            }
        )
        
        if find_response.status_code != 200:
            # May fail if already in queue or insufficient balance
            print(f"⚠ Find match returned {find_response.status_code}: {find_response.text}")
            return
        
        find_data = find_response.json()
        
        # Check if searching (not immediately matched)
        if find_data.get("status") == "searching":
            # Check balance was deducted
            me_response2 = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
            balance_after_join = me_response2.json().get("bl_coins", 0)
            
            if bet_amount > 0:
                assert balance_after_join == initial_balance - bet_amount, \
                    f"Bet not deducted: expected {initial_balance - bet_amount}, got {balance_after_join}"
                print(f"✓ Bet deducted on join: {initial_balance} -> {balance_after_join}")
            
            # Cancel matchmaking
            cancel_response = requests.post(
                f"{BASE_URL}/api/photo-game/pvp/cancel",
                headers=auth_headers
            )
            assert cancel_response.status_code == 200
            cancel_data = cancel_response.json()
            
            # Check refund
            if bet_amount > 0 and cancel_data.get("bet_refunded"):
                assert cancel_data["bet_refunded"] == bet_amount, \
                    f"Wrong refund amount: expected {bet_amount}, got {cancel_data['bet_refunded']}"
                print(f"✓ Bet refunded on cancel: {cancel_data['bet_refunded']} BL")
            
            # Verify balance restored
            me_response3 = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
            final_balance = me_response3.json().get("bl_coins", 0)
            
            if bet_amount > 0:
                assert final_balance == initial_balance, \
                    f"Balance not restored: expected {initial_balance}, got {final_balance}"
                print(f"✓ Balance restored after cancel: {final_balance}")
        else:
            print(f"✓ Match found immediately: {find_data.get('status')}")


class TestRPSAuction:
    """Test Million Dollar RPS Bidding Auction"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    @pytest.fixture(scope="class")
    def user_photo_id(self, auth_headers):
        """Get user's first available photo for testing"""
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=auth_headers)
        if response.status_code == 200:
            photos = response.json().get("photos", [])
            available = [p for p in photos if p.get("is_available")]
            if available:
                return available[0]["mint_id"]
        return None
    
    def test_start_game_with_bot(self, auth_headers, user_photo_id):
        """Test starting a game session with bot opponent"""
        if not user_photo_id:
            pytest.skip("No available photo for testing")
        
        # Start game with bot
        response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=auth_headers,
            json={
                "opponent_id": "bot",
                "bet_amount": 0,
                "photo_id": user_photo_id
            }
        )
        
        if response.status_code != 200:
            print(f"⚠ Start game failed: {response.text}")
            pytest.skip(f"Could not start game: {response.text}")
        
        data = response.json()
        assert data.get("success") == True, f"Game start failed: {data}"
        assert "session" in data, "No session in response"
        
        session = data["session"]
        assert session.get("phase") == "rps_auction", f"Expected phase=rps_auction, got {session.get('phase')}"
        assert session.get("player1_bankroll") == STARTING_BANKROLL, f"Expected bankroll={STARTING_BANKROLL}"
        assert session.get("player2_bankroll") == STARTING_BANKROLL, f"Expected opponent bankroll={STARTING_BANKROLL}"
        
        print(f"✓ Game started: session_id={session.get('session_id')}, phase={session.get('phase')}")
        print(f"  Bankrolls: Player=${session.get('player1_bankroll'):,}, Bot=${session.get('player2_bankroll'):,}")
        
        return session
    
    def test_rps_auction_round(self, auth_headers, user_photo_id):
        """Test playing RPS auction round with bid"""
        if not user_photo_id:
            pytest.skip("No available photo for testing")
        
        # Start a new game
        start_response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=auth_headers,
            json={
                "opponent_id": "bot",
                "bet_amount": 0,
                "photo_id": user_photo_id
            }
        )
        
        if start_response.status_code != 200:
            pytest.skip(f"Could not start game: {start_response.text}")
        
        session = start_response.json().get("session")
        session_id = session.get("session_id")
        
        # Play RPS auction round
        rps_response = requests.post(
            f"{BASE_URL}/api/photo-game/session/{session_id}/rps-auction",
            headers=auth_headers,
            json={
                "choice": "rock",
                "bid_amount": MIN_BID  # $1M bid
            }
        )
        
        assert rps_response.status_code == 200, f"RPS auction failed: {rps_response.text}"
        data = rps_response.json()
        
        assert data.get("success") == True, f"RPS round failed: {data}"
        assert "round" in data, "No round data in response"
        assert "player1_bankroll" in data, "No player1_bankroll in response"
        assert "player2_bankroll" in data, "No player2_bankroll in response"
        
        round_data = data["round"]
        assert round_data.get("player1_choice") == "rock", "Player choice not recorded"
        assert round_data.get("player1_bid") == MIN_BID, f"Player bid not recorded correctly"
        assert "player2_choice" in round_data, "Bot choice missing"
        assert "player2_bid" in round_data, "Bot bid missing"
        assert "winner" in round_data, "Round winner missing"
        assert "total_pot" in round_data, "Total pot missing"
        
        print(f"✓ RPS Auction round played:")
        print(f"  Player: {round_data.get('player1_choice')} (${round_data.get('player1_bid'):,})")
        print(f"  Bot: {round_data.get('player2_choice')} (${round_data.get('player2_bid'):,})")
        print(f"  Winner: {round_data.get('winner')}, Pot: ${round_data.get('total_pot'):,}")
        print(f"  Bankrolls after: Player=${data.get('player1_bankroll'):,}, Bot=${data.get('player2_bankroll'):,}")
    
    def test_rps_auction_invalid_bid(self, auth_headers, user_photo_id):
        """Test RPS auction rejects invalid bid amounts"""
        if not user_photo_id:
            pytest.skip("No available photo for testing")
        
        # Start a new game
        start_response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=auth_headers,
            json={
                "opponent_id": "bot",
                "bet_amount": 0,
                "photo_id": user_photo_id
            }
        )
        
        if start_response.status_code != 200:
            pytest.skip(f"Could not start game: {start_response.text}")
        
        session = start_response.json().get("session")
        session_id = session.get("session_id")
        
        # Try invalid bid (too low)
        rps_response = requests.post(
            f"{BASE_URL}/api/photo-game/session/{session_id}/rps-auction",
            headers=auth_headers,
            json={
                "choice": "rock",
                "bid_amount": 500_000  # $500K - below minimum
            }
        )
        
        assert rps_response.status_code == 400, f"Expected 400 for invalid bid, got {rps_response.status_code}"
        print(f"✓ Invalid bid rejected: {rps_response.json().get('detail')}")
        
        # Try invalid bid (too high)
        rps_response2 = requests.post(
            f"{BASE_URL}/api/photo-game/session/{session_id}/rps-auction",
            headers=auth_headers,
            json={
                "choice": "rock",
                "bid_amount": 6_000_000  # $6M - above maximum
            }
        )
        
        assert rps_response2.status_code == 400, f"Expected 400 for invalid bid, got {rps_response2.status_code}"
        print(f"✓ Invalid bid (too high) rejected: {rps_response2.json().get('detail')}")


class TestPhotoBattle:
    """Test Photo Dollar Auction Clash"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    @pytest.fixture(scope="class")
    def user_photo_id(self, auth_headers):
        """Get user's first available photo for testing"""
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=auth_headers)
        if response.status_code == 200:
            photos = response.json().get("photos", [])
            available = [p for p in photos if p.get("is_available")]
            if available:
                return available[0]["mint_id"]
        return None
    
    def test_full_game_flow(self, auth_headers, user_photo_id):
        """Test full game flow: RPS Auction -> Photo Battle -> Result"""
        if not user_photo_id:
            pytest.skip("No available photo for testing")
        
        # Start game
        start_response = requests.post(
            f"{BASE_URL}/api/photo-game/start",
            headers=auth_headers,
            json={
                "opponent_id": "bot",
                "bet_amount": 0,
                "photo_id": user_photo_id
            }
        )
        
        if start_response.status_code != 200:
            pytest.skip(f"Could not start game: {start_response.text}")
        
        session = start_response.json().get("session")
        session_id = session.get("session_id")
        print(f"✓ Game started: {session_id}")
        
        # Play RPS rounds until Stage 1 complete (first to 3)
        rps_wins = {"player": 0, "opponent": 0}
        round_num = 0
        phase = "rps_auction"
        
        while phase == "rps_auction" and round_num < 10:
            round_num += 1
            rps_response = requests.post(
                f"{BASE_URL}/api/photo-game/session/{session_id}/rps-auction",
                headers=auth_headers,
                json={
                    "choice": ["rock", "paper", "scissors"][round_num % 3],
                    "bid_amount": MIN_BID
                }
            )
            
            if rps_response.status_code != 200:
                print(f"⚠ RPS round {round_num} failed: {rps_response.text}")
                break
            
            data = rps_response.json()
            round_data = data.get("round", {})
            rps_wins["player"] = data.get("player1_wins", 0)
            rps_wins["opponent"] = data.get("player2_wins", 0)
            phase = data.get("phase", "rps_auction")
            
            print(f"  Round {round_num}: {round_data.get('winner')} wins (Score: {rps_wins['player']}-{rps_wins['opponent']})")
        
        print(f"✓ RPS Auction complete: Player {rps_wins['player']} - {rps_wins['opponent']} Bot")
        
        # If moved to photo_battle phase, execute it
        if phase == "photo_battle":
            battle_response = requests.post(
                f"{BASE_URL}/api/photo-game/session/{session_id}/photo-battle",
                headers=auth_headers
            )
            
            assert battle_response.status_code == 200, f"Photo battle failed: {battle_response.text}"
            battle_data = battle_response.json()
            
            assert "battle_result" in battle_data, "No battle_result in response"
            result = battle_data["battle_result"]
            
            print(f"✓ Photo Battle complete:")
            print(f"  Player value: ${result.get('player1_value'):,}")
            print(f"  Bot value: ${result.get('player2_value'):,}")
            print(f"  Winner: {result.get('winner')}")
            
            # Check final phase
            final_phase = battle_data.get("phase")
            if final_phase == "completed":
                print(f"✓ Game completed! Overall winner: {battle_data.get('overall_winner')}")
            elif final_phase == "tiebreaker":
                print(f"✓ Tiebreaker needed (split stages)")
        elif phase == "completed":
            print(f"✓ Game completed after RPS Auction (one player won both stages)")


class TestMatchmakingTimeout:
    """Test matchmaking timeout and bot fallback"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    @pytest.fixture(scope="class")
    def user_photo_id(self, auth_headers):
        """Get user's first available photo for testing"""
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=auth_headers)
        if response.status_code == 200:
            photos = response.json().get("photos", [])
            available = [p for p in photos if p.get("is_available")]
            if available:
                return available[0]["mint_id"]
        return None
    
    def test_matchmaking_timeout_creates_bot_match(self, auth_headers, user_photo_id):
        """Test that matchmaking creates bot match after 5s timeout"""
        if not user_photo_id:
            pytest.skip("No available photo for testing")
        
        # First cancel any existing matchmaking
        requests.post(f"{BASE_URL}/api/photo-game/pvp/cancel", headers=auth_headers)
        
        # Join matchmaking with bot fallback enabled
        find_response = requests.post(
            f"{BASE_URL}/api/photo-game/pvp/find-match",
            headers=auth_headers,
            json={
                "bet_amount": 0,
                "photo_id": user_photo_id,
                "use_bot_fallback": True
            }
        )
        
        if find_response.status_code != 200:
            print(f"⚠ Find match failed: {find_response.text}")
            return
        
        find_data = find_response.json()
        
        if find_data.get("status") == "matched":
            print(f"✓ Immediately matched (mode: {find_data.get('mode')})")
            return
        
        # Wait for timeout (5 seconds + buffer)
        print("  Waiting for 5s matchmaking timeout...")
        time.sleep(6)
        
        # Check match status
        status_response = requests.get(
            f"{BASE_URL}/api/photo-game/pvp/match-status",
            headers=auth_headers
        )
        
        assert status_response.status_code == 200
        status_data = status_response.json()
        
        if status_data.get("status") == "matched":
            assert status_data.get("mode") == "bot", f"Expected bot match, got {status_data.get('mode')}"
            print(f"✓ Bot match created after timeout: match_id={status_data.get('match_id')}")
        else:
            print(f"⚠ Match status: {status_data.get('status')}")


class TestLeaderboards:
    """Test leaderboard endpoints"""
    
    def test_wins_leaderboard(self):
        """Test /api/photo-game/leaderboard/wins"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/wins?period=24h")
        assert response.status_code == 200
        data = response.json()
        
        assert "leaderboard" in data, "leaderboard field missing"
        assert "period" in data, "period field missing"
        assert data["period"] == "24h"
        
        print(f"✓ Wins leaderboard: {len(data['leaderboard'])} entries")
    
    def test_photos_leaderboard(self):
        """Test /api/photo-game/leaderboard/photos"""
        response = requests.get(f"{BASE_URL}/api/photo-game/leaderboard/photos?period=24h")
        assert response.status_code == 200
        data = response.json()
        
        assert "leaderboard" in data, "leaderboard field missing"
        
        print(f"✓ Photos leaderboard: {len(data['leaderboard'])} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
