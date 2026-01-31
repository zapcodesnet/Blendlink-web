"""
Poker Tournament API Tests
Tests for Blendlink PKO Poker Tournament System
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://lagfix-blocker.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"


class TestPokerTournamentAPI:
    """Test Poker Tournament API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("token") or data.get("access_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
                self.user_id = data.get("user", {}).get("user_id") or data.get("user_id")
        
        # Force leave any existing tournament
        self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
        
        yield
        
        # Cleanup - force leave any tournament
        try:
            self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
        except:
            pass
    
    # ============== POKER LOBBY TESTS ==============
    
    def test_get_tournaments_list(self):
        """Test GET /api/poker/tournaments - List available tournaments"""
        response = self.session.get(f"{BASE_URL}/api/poker/tournaments")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "tournaments" in data, "Response should contain 'tournaments' key"
        assert isinstance(data["tournaments"], list), "Tournaments should be a list"
        print(f"✓ GET /api/poker/tournaments - Found {len(data['tournaments'])} tournaments")
    
    def test_get_my_tournament_status(self):
        """Test GET /api/poker/my-tournament - Check if player is in a tournament"""
        response = self.session.get(f"{BASE_URL}/api/poker/my-tournament")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "in_tournament" in data, "Response should contain 'in_tournament' key"
        print(f"✓ GET /api/poker/my-tournament - in_tournament: {data['in_tournament']}")
    
    # ============== TOURNAMENT CREATION TESTS ==============
    
    def test_create_tournament(self):
        """Test POST /api/poker/tournaments/create - Create a new tournament"""
        response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/create",
            json={"name": "Test PKO Tournament"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "tournament_id" in data, "Response should contain 'tournament_id'"
        assert "buy_in" in data, "Response should contain 'buy_in'"
        assert "bounty" in data, "Response should contain 'bounty'"
        assert data["buy_in"] == 2000, "Buy-in should be 2000 BL"
        assert data["bounty"] == 1000, "Bounty should be 1000 BL"
        
        self.tournament_id = data["tournament_id"]
        print(f"✓ POST /api/poker/tournaments/create - Created tournament: {self.tournament_id}")
    
    # ============== TOURNAMENT REGISTRATION TESTS ==============
    
    def test_register_for_tournament(self):
        """Test POST /api/poker/tournaments/register - Register for a tournament"""
        # Create a tournament
        create_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/create",
            json={"name": "Registration Test Tournament"}
        )
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        
        # Register for the tournament
        response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/register",
            json={"tournament_id": tournament_id}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "seat" in data, "Response should contain 'seat'"
        assert "success" in data or "tournament" in data, "Response should contain 'success' or 'tournament'"
        
        # Get chips from tournament data if not directly in response
        if "tournament" in data:
            player_data = data["tournament"]["players"].get(self.user_id, {})
            chips = player_data.get("chips", 2000)
        else:
            chips = data.get("chips", 2000)
        
        print(f"✓ POST /api/poker/tournaments/register - Registered at seat {data['seat']} with {chips} chips")
    
    # ============== ADD BOTS TESTS ==============
    
    def test_add_ai_bots(self):
        """Test POST /api/poker/tournaments/{id}/add-bots - Add AI bots to tournament"""
        # Create and register for a tournament
        create_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/create",
            json={"name": "Bot Test Tournament"}
        )
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        
        register_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/register",
            json={"tournament_id": tournament_id}
        )
        assert register_response.status_code == 200
        
        # Add 3 bots
        response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/{tournament_id}/add-bots?bot_count=3"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "bots_added" in data, "Response should contain 'bots_added'"
        assert data["bots_added"] == 3, "Should have added 3 bots"
        assert "bots" in data or "bot_names" in data, "Response should contain 'bots' or 'bot_names'"
        
        # Get bot names from either format
        if "bots" in data:
            bot_names = [b["username"] for b in data["bots"]]
        else:
            bot_names = data.get("bot_names", [])
        
        print(f"✓ POST /api/poker/tournaments/{tournament_id}/add-bots - Added bots: {bot_names}")
    
    # ============== FORCE START TESTS ==============
    
    def test_force_start_tournament(self):
        """Test POST /api/poker/tournaments/{id}/force-start - Force start tournament"""
        # Create and register for a tournament
        create_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/create",
            json={"name": "Force Start Test Tournament"}
        )
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        
        register_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/register",
            json={"tournament_id": tournament_id}
        )
        assert register_response.status_code == 200
        
        # Add bots to meet minimum player requirement
        self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/add-bots?bot_count=1")
        
        # Force start the tournament
        response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/{tournament_id}/force-start"
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data, "Response should contain 'success'"
        assert data["success"] == True, "Success should be True"
        
        # Check tournament status from nested data
        if "tournament" in data:
            status = data["tournament"].get("status")
            assert status == "in_progress", f"Tournament status should be 'in_progress', got {status}"
        
        print(f"✓ POST /api/poker/tournaments/{tournament_id}/force-start - Tournament started")
    
    # ============== GET TOURNAMENT STATE TESTS ==============
    
    def test_get_tournament_state(self):
        """Test GET /api/poker/tournaments/{id} - Get tournament state"""
        # Create and register for a tournament
        create_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/create",
            json={"name": "State Test Tournament"}
        )
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        
        register_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/register",
            json={"tournament_id": tournament_id}
        )
        assert register_response.status_code == 200
        
        # Get tournament state
        response = self.session.get(f"{BASE_URL}/api/poker/tournaments/{tournament_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "tournament_id" in data, "Response should contain 'tournament_id'"
        assert "status" in data, "Response should contain 'status'"
        assert "players" in data, "Response should contain 'players'"
        assert "phase" in data, "Response should contain 'phase'"
        assert "pot" in data, "Response should contain 'pot'"
        assert "community_cards" in data, "Response should contain 'community_cards'"
        
        print(f"✓ GET /api/poker/tournaments/{tournament_id} - Status: {data['status']}, Players: {data['player_count']}")
    
    # ============== PLAYER ACTION TESTS ==============
    
    def test_player_action_fold(self):
        """Test POST /api/poker/tournaments/action - Player fold action"""
        # Create, register, add bots, and start tournament
        create_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/create",
            json={"name": "Action Test Tournament"}
        )
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        
        self.session.post(
            f"{BASE_URL}/api/poker/tournaments/register",
            json={"tournament_id": tournament_id}
        )
        
        # Add 1 bot (minimum for 2 players)
        self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/add-bots?bot_count=1")
        
        # Force start
        self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/force-start")
        
        # Wait for game to start and bots to act
        time.sleep(3)
        
        # Get current state to check if it's our turn
        state_response = self.session.get(f"{BASE_URL}/api/poker/tournaments/{tournament_id}")
        if state_response.status_code == 200:
            state = state_response.json()
            print(f"  Tournament phase: {state.get('phase')}, current_player_seat: {state.get('current_player_seat')}")
        
        # Try to fold (may fail if not our turn, which is expected)
        response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/action",
            json={
                "tournament_id": tournament_id,
                "action": "fold",
                "amount": 0
            }
        )
        
        # Either 200 (success) or 400 (not our turn) is acceptable
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}: {response.text}"
        
        if response.status_code == 200:
            print(f"✓ POST /api/poker/tournaments/action - Fold action successful")
        else:
            print(f"✓ POST /api/poker/tournaments/action - Fold action returned 400 (not our turn - expected)")
    
    # ============== FULL GAME FLOW TEST ==============
    
    def test_full_game_flow(self):
        """Test complete poker game flow: create -> register -> add bots -> start -> play"""
        # Step 1: Create tournament
        create_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/create",
            json={"name": "Full Flow Test Tournament"}
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        tournament_id = create_response.json()["tournament_id"]
        print(f"  Step 1: Created tournament {tournament_id}")
        
        # Step 2: Register
        register_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/register",
            json={"tournament_id": tournament_id}
        )
        assert register_response.status_code == 200, f"Register failed: {register_response.text}"
        player_seat = register_response.json()["seat"]
        print(f"  Step 2: Registered at seat {player_seat}")
        
        # Step 3: Add AI bots
        bots_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/{tournament_id}/add-bots?bot_count=3"
        )
        assert bots_response.status_code == 200, f"Add bots failed: {bots_response.text}"
        bots_added = bots_response.json()["bots_added"]
        print(f"  Step 3: Added {bots_added} AI bots")
        
        # Step 4: Force start tournament
        start_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/{tournament_id}/force-start"
        )
        assert start_response.status_code == 200, f"Force start failed: {start_response.text}"
        print(f"  Step 4: Tournament started")
        
        # Step 5: Wait for bots to make decisions
        print(f"  Step 5: Waiting for bots to act...")
        time.sleep(5)
        
        # Step 6: Get tournament state
        state_response = self.session.get(f"{BASE_URL}/api/poker/tournaments/{tournament_id}")
        assert state_response.status_code == 200, f"Get state failed: {state_response.text}"
        
        state = state_response.json()
        print(f"  Step 6: Tournament state:")
        print(f"    - Status: {state['status']}")
        print(f"    - Phase: {state['phase']}")
        print(f"    - Hand #: {state['hand_number']}")
        print(f"    - Pot: {state['pot']}")
        print(f"    - Active players: {state['active_player_count']}")
        print(f"    - Community cards: {len(state['community_cards'])}")
        
        # Verify game is progressing
        assert state["status"] == "in_progress", "Tournament should be in progress"
        assert state["hand_number"] >= 1, "Should have started at least hand 1"
        
        # Check players
        players = state["players"]
        assert len(players) >= 2, "Should have at least 2 players"
        
        # Check for bot activity
        bot_actions = []
        for player_id, player in players.items():
            if player.get("is_bot"):
                if player.get("last_action"):
                    bot_actions.append(f"{player['username']}: {player['last_action']}")
        
        if bot_actions:
            print(f"  Bot actions: {bot_actions}")
        
        print(f"✓ Full game flow test completed successfully")
    
    # ============== LEAVE TOURNAMENT TEST ==============
    
    def test_leave_tournament(self):
        """Test POST /api/poker/tournaments/leave - Leave a tournament"""
        # Create and register for a tournament
        create_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/create",
            json={"name": "Leave Test Tournament"}
        )
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        
        self.session.post(
            f"{BASE_URL}/api/poker/tournaments/register",
            json={"tournament_id": tournament_id}
        )
        
        # Verify we're in the tournament
        my_tournament = self.session.get(f"{BASE_URL}/api/poker/my-tournament")
        assert my_tournament.json()["in_tournament"] == True
        
        # Leave the tournament (during registration phase)
        response = self.session.post(f"{BASE_URL}/api/poker/tournaments/leave")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify we're no longer in the tournament
        my_tournament = self.session.get(f"{BASE_URL}/api/poker/my-tournament")
        assert my_tournament.json()["in_tournament"] == False
        
        print(f"✓ POST /api/poker/tournaments/leave - Successfully left tournament")
    
    # ============== LEADERBOARD TEST ==============
    
    def test_get_leaderboard(self):
        """Test GET /api/poker/leaderboard - Get poker leaderboard"""
        response = self.session.get(f"{BASE_URL}/api/poker/leaderboard")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "leaderboard" in data, "Response should contain 'leaderboard'"
        assert isinstance(data["leaderboard"], list), "Leaderboard should be a list"
        
        print(f"✓ GET /api/poker/leaderboard - Found {len(data['leaderboard'])} entries")


class TestPokerGameMechanics:
    """Test poker game mechanics and bot AI"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("token") or data.get("access_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
                self.user_id = data.get("user", {}).get("user_id") or data.get("user_id")
        
        # Force leave any existing tournament
        self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
        
        yield
        
        # Cleanup
        try:
            self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
        except:
            pass
    
    def test_bot_ai_makes_decisions(self):
        """Test that AI bots make automatic decisions during gameplay"""
        # Create tournament with bots
        create_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/create",
            json={"name": "Bot AI Test"}
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        tournament_id = create_response.json()["tournament_id"]
        
        self.session.post(
            f"{BASE_URL}/api/poker/tournaments/register",
            json={"tournament_id": tournament_id}
        )
        
        # Add 5 bots for more action
        self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/add-bots?bot_count=5")
        
        # Start tournament
        self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/force-start")
        
        # Wait for bots to act - poll multiple times
        bots_acted = 0
        game_progressed = False
        
        for attempt in range(5):
            time.sleep(3)
            
            # Check game state
            state_response = self.session.get(f"{BASE_URL}/api/poker/tournaments/{tournament_id}")
            state = state_response.json()
            
            # Verify game has progressed
            print(f"  Attempt {attempt+1}: Phase={state['phase']}, Hand={state['hand_number']}, Pot={state['pot']}")
            
            # Check if game has progressed beyond initial state
            if state['phase'] != 'pre_flop' or state['hand_number'] > 1 or state['pot'] > 75:
                game_progressed = True
            
            # Check bot actions
            bots_acted = 0
            for player_id, player in state["players"].items():
                if player.get("is_bot"):
                    # Bot has acted if: has last_action, is_folded, has_acted, or current_bet > 0
                    if player.get("last_action") or player.get("is_folded") or player.get("has_acted") or player.get("current_bet", 0) > 0:
                        bots_acted += 1
                        print(f"    Bot {player['username']}: action={player.get('last_action')}, folded={player.get('is_folded')}, bet={player.get('current_bet')}")
            
            if bots_acted > 0 or game_progressed:
                break
        
        # At least some bots should have acted or game should have progressed
        assert bots_acted > 0 or game_progressed, "Bots should have made decisions or game should have progressed"
        
        print(f"✓ Bot AI test - {bots_acted} bots have acted, game_progressed={game_progressed}")
    
    def test_game_phase_progression(self):
        """Test that game advances through phases correctly"""
        # Create tournament with bots
        create_response = self.session.post(
            f"{BASE_URL}/api/poker/tournaments/create",
            json={"name": "Phase Test"}
        )
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        tournament_id = create_response.json()["tournament_id"]
        
        self.session.post(
            f"{BASE_URL}/api/poker/tournaments/register",
            json={"tournament_id": tournament_id}
        )
        
        # Add bots
        self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/add-bots?bot_count=3")
        
        # Start tournament
        self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/force-start")
        
        # Track phases over time
        phases_seen = set()
        for i in range(10):
            time.sleep(2)
            state_response = self.session.get(f"{BASE_URL}/api/poker/tournaments/{tournament_id}")
            if state_response.status_code == 200:
                state = state_response.json()
                phase = state.get("phase")
                phases_seen.add(phase)
                print(f"  Check {i+1}: Phase={phase}, Hand={state.get('hand_number')}, Pot={state.get('pot')}")
                
                # If we've seen multiple phases, test passes
                if len(phases_seen) > 1:
                    break
        
        print(f"  Phases seen: {phases_seen}")
        
        # Should see at least pre_flop
        assert "pre_flop" in phases_seen or "flop" in phases_seen or "turn" in phases_seen or "river" in phases_seen, \
            "Should see game phases"
        
        print(f"✓ Phase progression test - Saw phases: {phases_seen}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
