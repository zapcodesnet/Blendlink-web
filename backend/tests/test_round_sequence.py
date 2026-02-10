"""
Test Round Sequence Fix - Iteration 130

Verifies that the PVP game round sequence is correctly configured:
Round 1: RPS Bidding
Round 2: Photo Auction (Tapping)
Round 3: RPS Bidding (can be final if score reaches 3-0)
Round 4: Photo Auction (only if score is 2-1)
Round 5: RPS Bidding (tie-breaker only if score is 2-2)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRoundSequenceConfiguration:
    """Test that the round sequence configuration is correct"""

    def test_photo_game_config_endpoint(self):
        """Test /api/photo-game/config endpoint returns expected values"""
        response = requests.get(f"{BASE_URL}/api/photo-game/config")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        
        # Verify RPS auction config exists
        assert "rps_auction" in data, "Missing rps_auction config"
        
        rps_config = data["rps_auction"]
        
        # Verify expected fields
        assert "starting_bankroll" in rps_config
        assert "starting_bankroll_with_advantage" in rps_config
        assert "advantage_bonus" in rps_config
        assert "choice_timeout_seconds" in rps_config
        
        print(f"RPS Auction Config: {rps_config}")
        
        # Verify the values from previous iteration
        assert rps_config["advantage_bonus"] == 2000000, "Advantage bonus should be 2M"
        assert rps_config["starting_bankroll_with_advantage"] == 7000000, "Starting bankroll with advantage should be 7M"
        assert rps_config["choice_timeout_seconds"] == 10, "Choice timeout should be 10 seconds"

    def test_health_endpoint(self):
        """Test /api/health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data["status"] == "ok", "Health check should return ok status"
        print(f"Health check: {data}")


class TestRoundSequenceInCode:
    """Test that round sequence is correctly defined in code"""

    def test_backend_round_types_array(self):
        """Verify backend pvp_game_websocket.py has correct round_types"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        # Read the file and check for the correct round_types
        with open('/app/backend/pvp_game_websocket.py', 'r') as f:
            content = f.read()
        
        # Check that the correct round_types array is present
        assert 'round_types = ["rps", "auction", "rps", "auction", "rps"]' in content or \
               "round_types = ['rps', 'auction', 'rps', 'auction', 'rps']" in content, \
               "Backend should have correct round_types array: rps, auction, rps, auction, rps"
        
        # Check that default round_type is 'rps'
        assert 'round_type: str = "rps"' in content or "round_type: str = 'rps'" in content, \
               "Default round_type should be 'rps'"
        
        print("Backend round_types verified: ['rps', 'auction', 'rps', 'auction', 'rps']")

    def test_frontend_round_types_array(self):
        """Verify frontend PVPBattleArena.jsx has correct ROUND_TYPES"""
        with open('/app/frontend/src/components/game/PVPBattleArena.jsx', 'r') as f:
            content = f.read()
        
        # Check that the correct ROUND_TYPES array is present
        assert "ROUND_TYPES = ['rps', 'auction', 'rps', 'auction', 'rps']" in content or \
               'ROUND_TYPES = ["rps", "auction", "rps", "auction", "rps"]' in content, \
               "Frontend should have correct ROUND_TYPES array: rps, auction, rps, auction, rps"
        
        # Check that default roundType state is 'rps'
        assert "useState('rps')" in content or 'useState("rps")' in content, \
               "Default roundType state should be 'rps'"
        
        print("Frontend ROUND_TYPES verified: ['rps', 'auction', 'rps', 'auction', 'rps']")

    def test_mobile_round_type_default(self):
        """Verify mobile usePVPWebSocket.js has correct default roundType"""
        with open('/app/mobile/src/hooks/usePVPWebSocket.js', 'r') as f:
            content = f.read()
        
        # Check that default roundType is 'rps'
        assert "roundType: 'rps'" in content or 'roundType: "rps"' in content, \
               "Mobile should have default roundType: 'rps'"
        
        print("Mobile default roundType verified: 'rps'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
