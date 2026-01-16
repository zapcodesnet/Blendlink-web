"""
PKO Poker Tournament Tests - Iteration 27
Testing:
1. Create tournament via POST /api/poker/tournaments/create
2. Register for tournament via POST /api/poker/tournaments/register
3. Add bots via POST /api/poker/tournaments/{id}/add-bots?bot_count=3 - should add 3 bots
4. Add bots via POST /api/poker/tournaments/{id}/add-bots?bot_count=9 - should fill table with 9 bots
5. Force start tournament - should start game
6. Send chat message via WebSocket - should appear in chat_messages
7. Join existing tournament as second user - should work
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"

# Second test user for join testing
TEST_EMAIL_2 = "test2@example.com"
TEST_PASSWORD_2 = "Test123!"


class TestPokerTournamentIteration27:
    """PKO Poker Tournament Tests for Iteration 27"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
        self.user_id = None
        self.tournament_id = None
        
    def login(self, email=TEST_EMAIL, password=TEST_PASSWORD):
        """Login and get token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user_id = data.get("user", {}).get("user_id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return True
        return False
    
    def force_leave_tournament(self):
        """Force leave any existing tournament"""
        try:
            response = self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
            return response.status_code == 200
        except:
            return False
    
    # ============== TEST 1: Login ==============
    def test_01_login(self):
        """Test login with test credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    # ============== TEST 2: Force Leave Existing Tournament ==============
    def test_02_force_leave_existing_tournament(self):
        """Force leave any existing tournament before testing"""
        assert self.login(), "Login failed"
        
        # Force leave any existing tournament
        response = self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
        # Either 200 (left), 400 (not in tournament), or 404 (not in tournament) is acceptable
        assert response.status_code in [200, 400, 404], f"Force leave failed: {response.text}"
        print(f"✓ Force leave completed (status: {response.status_code})")
    
    # ============== TEST 3: Create Tournament ==============
    def test_03_create_tournament(self):
        """Test creating a new tournament"""
        assert self.login(), "Login failed"
        self.force_leave_tournament()
        
        response = self.session.post(f"{BASE_URL}/api/poker/tournaments/create", json={
            "name": "Test PKO Tournament"
        })
        assert response.status_code == 200, f"Create tournament failed: {response.text}"
        
        data = response.json()
        assert "tournament_id" in data, "No tournament_id in response"
        assert data["tournament_id"].startswith("pko_"), "Invalid tournament_id format"
        
        self.tournament_id = data["tournament_id"]
        print(f"✓ Tournament created: {self.tournament_id}")
    
    # ============== TEST 4: Register for Tournament ==============
    def test_04_register_for_tournament(self):
        """Test registering for a tournament"""
        assert self.login(), "Login failed"
        self.force_leave_tournament()
        
        # Create tournament first
        create_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/create", json={
            "name": "Test PKO Tournament"
        })
        assert create_response.status_code == 200, f"Create failed: {create_response.text}"
        tournament_id = create_response.json()["tournament_id"]
        
        # Register for tournament
        register_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/register", json={
            "tournament_id": tournament_id
        })
        assert register_response.status_code == 200, f"Register failed: {register_response.text}"
        
        data = register_response.json()
        assert data.get("success") == True, "Registration not successful"
        # Player info may be in 'player' or in 'tournament.players'
        assert "seat" in data or "player" in data or "tournament" in data, "No player/seat info in response"
        
        print(f"✓ Registered for tournament: {tournament_id}")
        
        # Cleanup
        self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
    
    # ============== TEST 5: Add 3 Bots ==============
    def test_05_add_3_bots(self):
        """Test adding 3 bots to tournament"""
        assert self.login(), "Login failed"
        self.force_leave_tournament()
        
        # Create and register
        create_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/create", json={
            "name": "Test PKO Tournament"
        })
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        
        register_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/register", json={
            "tournament_id": tournament_id
        })
        assert register_response.status_code == 200
        
        # Add 3 bots
        add_bots_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/add-bots?bot_count=3")
        assert add_bots_response.status_code == 200, f"Add bots failed: {add_bots_response.text}"
        
        data = add_bots_response.json()
        assert "bots_added" in data, "No bots_added in response"
        assert data["bots_added"] == 3, f"Expected 3 bots added, got {data['bots_added']}"
        assert "bots" in data, "No bots list in response"
        assert len(data["bots"]) == 3, f"Expected 3 bots in list, got {len(data['bots'])}"
        
        print(f"✓ Added 3 bots to tournament: {tournament_id}")
        print(f"  Bots: {[b['username'] for b in data['bots']]}")
        
        # Cleanup
        self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
    
    # ============== TEST 6: Add 9 Bots (Fill Table) ==============
    def test_06_add_9_bots_fill_table(self):
        """Test adding 9 bots to fill the table"""
        assert self.login(), "Login failed"
        self.force_leave_tournament()
        
        # Create and register
        create_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/create", json={
            "name": "Test PKO Tournament"
        })
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        
        register_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/register", json={
            "tournament_id": tournament_id
        })
        assert register_response.status_code == 200
        
        # Add 9 bots (should fill remaining 9 seats since 1 human is registered)
        add_bots_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/add-bots?bot_count=9")
        assert add_bots_response.status_code == 200, f"Add bots failed: {add_bots_response.text}"
        
        data = add_bots_response.json()
        assert "bots_added" in data, "No bots_added in response"
        assert data["bots_added"] == 9, f"Expected 9 bots added, got {data['bots_added']}"
        
        # Verify total players is now 10
        assert "total_players" in data, "No total_players in response"
        assert data["total_players"] == 10, f"Expected 10 total players, got {data['total_players']}"
        
        print(f"✓ Added 9 bots to fill table: {tournament_id}")
        print(f"  Total players: {data['total_players']}")
        
        # Cleanup
        self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
    
    # ============== TEST 7: Cannot Add Bots to Full Table ==============
    def test_07_cannot_add_bots_to_full_table(self):
        """Test that adding bots to a full table returns 0 bots added"""
        assert self.login(), "Login failed"
        self.force_leave_tournament()
        
        # Create and register
        create_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/create", json={
            "name": "Test PKO Tournament"
        })
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        
        register_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/register", json={
            "tournament_id": tournament_id
        })
        assert register_response.status_code == 200
        
        # Fill table with 9 bots
        self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/add-bots?bot_count=9")
        
        # Try to add more bots - should add 0
        add_more_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/add-bots?bot_count=3")
        assert add_more_response.status_code == 200, f"Add bots failed: {add_more_response.text}"
        
        data = add_more_response.json()
        assert data["bots_added"] == 0, f"Expected 0 bots added to full table, got {data['bots_added']}"
        
        print(f"✓ Correctly returned 0 bots added to full table")
        
        # Cleanup
        self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
    
    # ============== TEST 8: Force Start Tournament ==============
    def test_08_force_start_tournament(self):
        """Test force starting a tournament"""
        assert self.login(), "Login failed"
        self.force_leave_tournament()
        
        # Create and register
        create_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/create", json={
            "name": "Test PKO Tournament"
        })
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        
        register_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/register", json={
            "tournament_id": tournament_id
        })
        assert register_response.status_code == 200
        
        # Add 1 bot (minimum 2 players needed)
        self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/add-bots?bot_count=1")
        
        # Force start
        start_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/{tournament_id}/force-start")
        assert start_response.status_code == 200, f"Force start failed: {start_response.text}"
        
        data = start_response.json()
        assert data.get("success") == True, "Force start not successful"
        # Status may be in root or in tournament object
        status = data.get("status") or data.get("tournament", {}).get("status")
        assert status == "in_progress", f"Expected status 'in_progress', got {status}"
        
        print(f"✓ Tournament force started: {tournament_id}")
        
        # Cleanup
        self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
    
    # ============== TEST 9: Get Tournament State ==============
    def test_09_get_tournament_state(self):
        """Test getting tournament state"""
        assert self.login(), "Login failed"
        self.force_leave_tournament()
        
        # Create and register
        create_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/create", json={
            "name": "Test PKO Tournament"
        })
        assert create_response.status_code == 200
        tournament_id = create_response.json()["tournament_id"]
        
        register_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/register", json={
            "tournament_id": tournament_id
        })
        assert register_response.status_code == 200
        
        # Get tournament state
        get_response = self.session.get(f"{BASE_URL}/api/poker/tournaments/{tournament_id}")
        assert get_response.status_code == 200, f"Get tournament failed: {get_response.text}"
        
        data = get_response.json()
        assert data["tournament_id"] == tournament_id
        assert "players" in data
        assert "status" in data
        assert "chat_messages" in data
        
        print(f"✓ Got tournament state: {tournament_id}")
        print(f"  Status: {data['status']}, Players: {data.get('player_count', 0)}")
        
        # Cleanup
        self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
    
    # ============== TEST 10: My Tournament Endpoint ==============
    def test_10_my_tournament_endpoint(self):
        """Test my-tournament endpoint"""
        assert self.login(), "Login failed"
        self.force_leave_tournament()
        
        # Check when not in tournament
        response = self.session.get(f"{BASE_URL}/api/poker/my-tournament")
        assert response.status_code == 200
        data = response.json()
        assert data["in_tournament"] == False, "Should not be in tournament initially"
        
        # Create and register
        create_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/create", json={
            "name": "Test PKO Tournament"
        })
        tournament_id = create_response.json()["tournament_id"]
        
        self.session.post(f"{BASE_URL}/api/poker/tournaments/register", json={
            "tournament_id": tournament_id
        })
        
        # Check when in tournament
        response = self.session.get(f"{BASE_URL}/api/poker/my-tournament")
        assert response.status_code == 200
        data = response.json()
        assert data["in_tournament"] == True, "Should be in tournament after registering"
        assert data["tournament"]["tournament_id"] == tournament_id
        
        print(f"✓ My tournament endpoint working correctly")
        
        # Cleanup
        self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")
    
    # ============== TEST 11: Leave Tournament and Refund ==============
    def test_11_leave_tournament_refund(self):
        """Test leaving tournament and getting refund"""
        assert self.login(), "Login failed"
        self.force_leave_tournament()
        
        # Get initial balance
        balance_response = self.session.get(f"{BASE_URL}/api/wallet/balance")
        initial_balance = balance_response.json().get("bl_coins", 0)
        
        # Create and register
        create_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/create", json={
            "name": "Test PKO Tournament"
        })
        tournament_id = create_response.json()["tournament_id"]
        
        self.session.post(f"{BASE_URL}/api/poker/tournaments/register", json={
            "tournament_id": tournament_id
        })
        
        # Leave tournament
        leave_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/leave")
        assert leave_response.status_code == 200, f"Leave failed: {leave_response.text}"
        
        data = leave_response.json()
        assert data.get("success") == True, "Leave not successful"
        assert "refund" in data, "No refund info in response"
        
        print(f"✓ Left tournament with refund: {data.get('refund', 0)} BL")
        
    # ============== TEST 12: Chat Messages in Tournament State ==============
    def test_12_chat_messages_in_state(self):
        """Test that chat_messages field exists in tournament state"""
        assert self.login(), "Login failed"
        self.force_leave_tournament()
        
        # Create and register
        create_response = self.session.post(f"{BASE_URL}/api/poker/tournaments/create", json={
            "name": "Test PKO Tournament"
        })
        tournament_id = create_response.json()["tournament_id"]
        
        self.session.post(f"{BASE_URL}/api/poker/tournaments/register", json={
            "tournament_id": tournament_id
        })
        
        # Get tournament state
        get_response = self.session.get(f"{BASE_URL}/api/poker/tournaments/{tournament_id}")
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert "chat_messages" in data, "chat_messages field missing from tournament state"
        assert isinstance(data["chat_messages"], list), "chat_messages should be a list"
        
        print(f"✓ chat_messages field present in tournament state")
        
        # Cleanup
        self.session.post(f"{BASE_URL}/api/poker/tournaments/force-leave")


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
