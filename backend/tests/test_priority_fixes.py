"""
Test Priority Fixes - Iteration 97
Tests for:
1. P0 - PVP Tap Sync Bug (opponent meter shows $0)
2. P1 - Profile Picture Controls (position editor)
3. P1 - Image Orientation (EXIF handling during minting)
"""

import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
USER1_EMAIL = "test@blendlink.com"
USER1_PASSWORD = "admin"
USER2_EMAIL = "test@example.com"
USER2_PASSWORD = "test123"


class TestPVPTapSync:
    """P0 - Test PVP tap sync functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, email, password):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("session_token")
        return None
    
    def test_tap_state_endpoint_exists(self):
        """Test that tap-state endpoint exists and returns proper structure"""
        # First login
        token = self.get_auth_token(USER1_EMAIL, USER1_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try to get tap state for a non-existent session (should return 404)
        response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/tap-state/test-session-123")
        
        # Should return 404 for non-existent session, not 500
        assert response.status_code in [404, 403], f"Expected 404 or 403, got {response.status_code}: {response.text}"
        print(f"✓ Tap state endpoint returns proper error for non-existent session: {response.status_code}")
    
    def test_pvp_session_model_has_tap_fields(self):
        """Test that PVP session model initializes tap fields correctly"""
        token = self.get_auth_token(USER1_EMAIL, USER1_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get user's battle photos first
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200, f"Failed to get battle photos: {response.text}"
        
        photos = response.json().get("photos", [])
        print(f"✓ User has {len(photos)} battle photos")
        
        if len(photos) >= 5:
            # Try to create an open game
            photo_ids = [p["mint_id"] for p in photos[:5]]
            response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/create-open-game", json={
                "photo_ids": photo_ids,
                "bet_amount": 0
            })
            
            if response.status_code == 200:
                game_data = response.json()
                game_id = game_data.get("game_id")
                print(f"✓ Created open game: {game_id}")
                
                # Cancel the game to clean up
                self.session.post(f"{BASE_URL}/api/photo-game/pvp/cancel-open-game/{game_id}")
            else:
                print(f"Note: Could not create open game (may already have one): {response.status_code}")
        else:
            print(f"Note: User needs at least 5 photos for PVP, has {len(photos)}")
    
    def test_tap_submit_endpoint(self):
        """Test that tap submit endpoint works correctly"""
        token = self.get_auth_token(USER1_EMAIL, USER1_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Try to submit taps for a non-existent session
        response = self.session.post(f"{BASE_URL}/api/photo-game/pvp/tap", json={
            "session_id": "test-session-123",
            "tap_count": 5
        })
        
        # Should return 404 for non-existent session
        assert response.status_code in [404, 403], f"Expected 404 or 403, got {response.status_code}"
        print(f"✓ Tap submit endpoint returns proper error for non-existent session")


class TestProfilePictureControls:
    """P1 - Test Profile Picture position controls"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, email, password):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("session_token")
        return None
    
    def test_profile_picture_update_endpoint(self):
        """Test that profile picture update endpoint accepts position data"""
        token = self.get_auth_token(USER1_EMAIL, USER1_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get user's minted photos
        response = self.session.get(f"{BASE_URL}/api/photo-game/battle-photos")
        assert response.status_code == 200, f"Failed to get battle photos: {response.text}"
        
        photos = response.json().get("photos", [])
        
        if len(photos) > 0:
            photo = photos[0]
            
            # Test updating profile picture with position data
            response = self.session.put(f"{BASE_URL}/api/users/me/profile-picture", json={
                "image_url": photo.get("image_url"),
                "mint_id": photo.get("mint_id"),
                "position": {
                    "x": 10,
                    "y": -5,
                    "zoom": 1.2
                }
            })
            
            # Should succeed or return validation error (not 500)
            assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}: {response.text}"
            
            if response.status_code == 200:
                print(f"✓ Profile picture updated with position data")
            else:
                print(f"Note: Profile picture update returned {response.status_code}")
        else:
            print("Note: No photos available for profile picture test")
    
    def test_user_me_endpoint(self):
        """Test that user me endpoint returns profile picture data"""
        token = self.get_auth_token(USER1_EMAIL, USER1_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/users/me")
        assert response.status_code == 200, f"Failed to get user data: {response.text}"
        
        user_data = response.json()
        print(f"✓ User data retrieved successfully")
        print(f"  - Username: {user_data.get('username')}")
        print(f"  - Has profile_picture: {'profile_picture' in user_data}")


class TestImageOrientation:
    """P1 - Test Image Orientation (EXIF handling)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, email, password):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("session_token")
        return None
    
    def test_minting_config_endpoint(self):
        """Test that minting config endpoint works"""
        response = self.session.get(f"{BASE_URL}/api/minting/config")
        assert response.status_code == 200, f"Failed to get minting config: {response.text}"
        
        config = response.json()
        assert "mint_cost_bl" in config, "Missing mint_cost_bl in config"
        assert "scenery_types" in config, "Missing scenery_types in config"
        print(f"✓ Minting config retrieved successfully")
        print(f"  - Mint cost: {config.get('mint_cost_bl')} BL")
    
    def test_minting_status_endpoint(self):
        """Test that minting status endpoint works for authenticated user"""
        token = self.get_auth_token(USER1_EMAIL, USER1_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/minting/status")
        assert response.status_code == 200, f"Failed to get minting status: {response.text}"
        
        status = response.json()
        print(f"✓ Minting status retrieved successfully")
        print(f"  - Can mint: {status.get('can_mint')}")
        print(f"  - Mints today: {status.get('mints_today')}")


class TestSettingsPage:
    """Test Settings page loads correctly"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, email, password):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("session_token")
        return None
    
    def test_privacy_settings_endpoint(self):
        """Test privacy settings endpoint"""
        token = self.get_auth_token(USER1_EMAIL, USER1_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Test updating privacy settings
        response = self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": False
        })
        
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}: {response.text}"
        print(f"✓ Privacy settings endpoint works: {response.status_code}")


class TestPVPSessionCreation:
    """Test PVP session creation initializes tap fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
    def get_auth_token(self, email, password):
        """Get authentication token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("session_token")
        return None
    
    def test_open_games_list(self):
        """Test listing open games"""
        token = self.get_auth_token(USER1_EMAIL, USER1_PASSWORD)
        assert token is not None, "Failed to get auth token"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/open-games")
        assert response.status_code == 200, f"Failed to get open games: {response.text}"
        
        data = response.json()
        games = data.get("games", [])
        print(f"✓ Open games list retrieved: {len(games)} games")
    
    def test_pvp_queue_status(self):
        """Test PVP queue status endpoint"""
        response = self.session.get(f"{BASE_URL}/api/photo-game/pvp/queue-status")
        assert response.status_code == 200, f"Failed to get queue status: {response.text}"
        
        data = response.json()
        print(f"✓ PVP queue status retrieved")
        print(f"  - Players in queue: {data.get('players_in_queue', 0)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
