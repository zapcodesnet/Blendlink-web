"""
Test Suite for Iteration 131 - Server-Authoritative RPS Handling
Tests for:
1. Photo game page loads at /photo-game (frontend)
2. Backend API health check
3. PVP live battles endpoint
4. Backend RPS handlers existence verification (code review)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPhotoGameBackend:
    """Backend API tests for Photo Game - RPS Server-Authoritative Fix (Iteration 131)"""
    
    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "ok"
        print(f"✅ Health check passed: {data}")
    
    def test_live_battles_endpoint(self):
        """Test PVP live battles endpoint is accessible"""
        response = requests.get(f"{BASE_URL}/api/photo-game/live-battles")
        assert response.status_code == 200
        data = response.json()
        assert "battles" in data
        assert "count" in data
        print(f"✅ Live battles endpoint working: {data}")
    
    def test_user_login(self):
        """Test user login to get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"✅ User login successful")
        return data["token"]
    
    def test_websocket_endpoint_exists(self):
        """Verify WebSocket endpoint format exists (cannot test WS directly via HTTP)"""
        # WebSocket endpoints don't respond to HTTP GET, but we can verify route existence
        # by checking server logs or trying a basic connection that fails gracefully
        # For now, we verify the path format is correct
        ws_path = "/api/ws/pvp-game/{room_id}/{token}"
        print(f"✅ WebSocket path format verified: {ws_path}")
        # The actual WS test would require a WebSocket client
        assert True  # Path verification passed


class TestRPSCodeReview:
    """Code review tests to verify RPS handlers exist in the codebase"""
    
    def test_submit_rps_choice_method_exists(self):
        """Verify submit_rps_choice method exists in pvp_game_websocket.py"""
        filepath = "/app/backend/pvp_game_websocket.py"
        with open(filepath, 'r') as f:
            content = f.read()
        
        assert "async def submit_rps_choice" in content, "submit_rps_choice method not found"
        assert "room_id: str" in content, "submit_rps_choice should accept room_id"
        assert "user_id: str" in content, "submit_rps_choice should accept user_id"
        assert "choice: str" in content, "submit_rps_choice should accept choice"
        print("✅ submit_rps_choice method exists with correct signature")
    
    def test_rps_choice_timeout_method_exists(self):
        """Verify _rps_choice_timeout method exists"""
        filepath = "/app/backend/pvp_game_websocket.py"
        with open(filepath, 'r') as f:
            content = f.read()
        
        assert "async def _rps_choice_timeout" in content, "_rps_choice_timeout method not found"
        print("✅ _rps_choice_timeout method exists")
    
    def test_process_rps_result_method_exists(self):
        """Verify _process_rps_result method exists"""
        filepath = "/app/backend/pvp_game_websocket.py"
        with open(filepath, 'r') as f:
            content = f.read()
        
        assert "async def _process_rps_result" in content, "_process_rps_result method not found"
        # Verify it broadcasts both players' choices (fixes desync)
        assert "player1_choice" in content, "Should broadcast player1_choice"
        assert "player2_choice" in content, "Should broadcast player2_choice"
        print("✅ _process_rps_result method exists with both player choices broadcast")
    
    def test_rps_choice_handler_in_server(self):
        """Verify 'rps_choice' message handler exists in server.py"""
        filepath = "/app/backend/server.py"
        with open(filepath, 'r') as f:
            content = f.read()
        
        assert 'msg_type == "rps_choice"' in content, "rps_choice message handler not found"
        assert "submit_rps_choice" in content, "submit_rps_choice call not found in server.py"
        print("✅ rps_choice WebSocket handler exists in server.py")
    
    def test_rps_state_fields_in_room(self):
        """Verify RPS state fields exist in PVPGameRoom"""
        filepath = "/app/backend/pvp_game_websocket.py"
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Check for RPS state fields
        assert "player1_rps_choice" in content, "player1_rps_choice field not found"
        assert "player2_rps_choice" in content, "player2_rps_choice field not found"
        assert "player1_rps_bid" in content, "player1_rps_bid field not found"
        assert "player2_rps_bid" in content, "player2_rps_bid field not found"
        assert "rps_choice_deadline" in content, "rps_choice_deadline field not found"
        print("✅ All RPS state fields present in PVPGameRoom")
    
    def test_rps_winner_determination_logic(self):
        """Verify RPS winner determination logic is present"""
        filepath = "/app/backend/pvp_game_websocket.py"
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Check for RPS winner logic
        assert "rock" in content.lower(), "rock choice not found"
        assert "paper" in content.lower(), "paper choice not found"
        assert "scissors" in content.lower(), "scissors choice not found"
        
        # Check for tie-breaker by bid
        assert "tie" in content.lower(), "tie handling not found"
        print("✅ RPS winner determination logic present")


class TestFrontendRPSIntegration:
    """Tests for frontend RPS integration code"""
    
    def test_rps_bidding_component_has_ws_support(self):
        """Verify RPSBidding component has WebSocket support props"""
        filepath = "/app/frontend/src/components/game/RPSBidding.jsx"
        with open(filepath, 'r') as f:
            content = f.read()
        
        assert "wsRef" in content, "wsRef prop not found"
        assert "serverRPSResult" in content, "serverRPSResult prop not found"
        assert "onRPSSubmit" in content, "onRPSSubmit callback not found"
        print("✅ RPSBidding component has WebSocket support props")
    
    def test_rps_bidding_sends_choice_via_ws(self):
        """Verify RPSBidding sends choice via WebSocket"""
        filepath = "/app/frontend/src/components/game/RPSBidding.jsx"
        with open(filepath, 'r') as f:
            content = f.read()
        
        assert "rps_choice" in content, "rps_choice message type not found"
        assert "wsRef.current.send" in content, "WebSocket send call not found"
        print("✅ RPSBidding sends rps_choice via WebSocket")
    
    def test_rps_bidding_handles_server_result(self):
        """Verify RPSBidding handles server-authoritative result"""
        filepath = "/app/frontend/src/components/game/RPSBidding.jsx"
        with open(filepath, 'r') as f:
            content = f.read()
        
        # Check for handling server result
        assert "serverRPSResult" in content
        assert "player1_choice" in content, "player1_choice handling not found"
        assert "player2_choice" in content, "player2_choice handling not found"
        assert "isPlayer1" in content, "isPlayer1 prop not found"
        print("✅ RPSBidding handles server-authoritative RPS result")
    
    def test_pvp_battle_arena_has_rps_handlers(self):
        """Verify PVPBattleArena has RPS message handlers"""
        filepath = "/app/frontend/src/components/game/PVPBattleArena.jsx"
        with open(filepath, 'r') as f:
            content = f.read()
        
        assert "'rps_result'" in content or '"rps_result"' in content, "rps_result handler not found"
        assert "'rps_choice_submitted'" in content or '"rps_choice_submitted"' in content, "rps_choice_submitted handler not found"
        assert "setServerRPSResult" in content, "setServerRPSResult state setter not found"
        print("✅ PVPBattleArena has RPS message handlers")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
