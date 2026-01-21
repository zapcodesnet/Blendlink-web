"""
Test Suite for Seller Name Privacy Toggle Feature (Iteration 49)
Tests:
- PUT /api/users/privacy-settings - toggle is_real_name_private field
- GET /api/users/{user_id} - should return display_name and name_hidden based on privacy + friendship
- GET /api/marketplace/listings - seller info should respect privacy setting
- GET /api/marketplace/listings/{listing_id} - seller info should respect privacy setting
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPrivacyToggleFeature:
    """Test the Seller Name Privacy Toggle feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with test user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "Test123!"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.user = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
        
        yield
        
        # Cleanup: Reset privacy setting to false after tests
        try:
            self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
                "is_real_name_private": False
            })
        except:
            pass

    # ============== Privacy Settings Endpoint Tests ==============
    
    def test_privacy_settings_endpoint_exists(self):
        """Test that PUT /api/users/privacy-settings endpoint exists"""
        response = self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": False
        })
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        print("✓ Privacy settings endpoint exists and responds")
    
    def test_enable_privacy_setting(self):
        """Test enabling real name privacy"""
        response = self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": True
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert data.get("is_real_name_private") == True, "Expected is_real_name_private=True"
        print("✓ Privacy setting enabled successfully")
    
    def test_disable_privacy_setting(self):
        """Test disabling real name privacy"""
        # First enable it
        self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": True
        })
        
        # Then disable it
        response = self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": False
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success=True"
        assert data.get("is_real_name_private") == False, "Expected is_real_name_private=False"
        print("✓ Privacy setting disabled successfully")
    
    def test_privacy_setting_requires_auth(self):
        """Test that privacy settings endpoint requires authentication"""
        # Create a new session without auth
        unauth_session = requests.Session()
        unauth_session.headers.update({"Content-Type": "application/json"})
        
        response = unauth_session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": True
        })
        assert response.status_code == 401, f"Expected 401 for unauthenticated request, got {response.status_code}"
        print("✓ Privacy settings endpoint requires authentication")
    
    def test_privacy_setting_persists(self):
        """Test that privacy setting persists after being set"""
        # Enable privacy
        self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": True
        })
        
        # Verify via GET /api/auth/me
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        
        me_data = me_response.json()
        assert me_data.get("is_real_name_private") == True, "Privacy setting should persist"
        print("✓ Privacy setting persists correctly")

    # ============== User Profile Privacy Tests ==============
    
    def test_get_user_with_privacy_enabled_as_non_friend(self):
        """Test that non-friends see username when privacy is enabled"""
        # Enable privacy for test user
        self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": True
        })
        
        # Create a new session (anonymous viewer)
        anon_session = requests.Session()
        anon_session.headers.update({"Content-Type": "application/json"})
        
        # Get user profile as anonymous
        user_id = self.user.get("user_id")
        response = anon_session.get(f"{BASE_URL}/api/users/{user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "display_name" in data, "Response should include display_name"
        assert "name_hidden" in data, "Response should include name_hidden"
        assert data.get("name_hidden") == True, "name_hidden should be True for non-friends"
        
        # display_name should be username, not real name
        username = data.get("username")
        display_name = data.get("display_name")
        real_name = data.get("name")
        
        assert display_name == username or display_name.startswith("user_"), \
            f"display_name should be username or user_xxx, got {display_name}"
        print(f"✓ Non-friend sees display_name='{display_name}' (username) instead of real name")
    
    def test_get_user_with_privacy_disabled(self):
        """Test that everyone sees real name when privacy is disabled"""
        # Disable privacy
        self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": False
        })
        
        # Get user profile as anonymous
        anon_session = requests.Session()
        anon_session.headers.update({"Content-Type": "application/json"})
        
        user_id = self.user.get("user_id")
        response = anon_session.get(f"{BASE_URL}/api/users/{user_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("name_hidden") == False, "name_hidden should be False when privacy disabled"
        assert data.get("display_name") == data.get("name"), "display_name should equal real name"
        print("✓ Everyone sees real name when privacy is disabled")
    
    def test_user_can_see_own_name(self):
        """Test that user can always see their own real name"""
        # Enable privacy
        self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": True
        })
        
        # Get own profile
        user_id = self.user.get("user_id")
        response = self.session.get(f"{BASE_URL}/api/users/{user_id}")
        assert response.status_code == 200
        
        data = response.json()
        # User should see their own real name
        assert data.get("name_hidden") == False, "User should see their own real name"
        assert data.get("display_name") == data.get("name"), "display_name should be real name for self"
        print("✓ User can always see their own real name")

    # ============== Marketplace Listings Privacy Tests ==============
    
    def test_marketplace_listings_respect_privacy(self):
        """Test that GET /api/marketplace/listings respects seller privacy"""
        # Enable privacy
        self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": True
        })
        
        # Get listings as anonymous
        anon_session = requests.Session()
        anon_session.headers.update({"Content-Type": "application/json"})
        
        response = anon_session.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200
        
        listings = response.json()
        
        # Find listings from our test user
        user_id = self.user.get("user_id")
        user_listings = [l for l in listings if l.get("user_id") == user_id]
        
        for listing in user_listings:
            seller = listing.get("seller")
            if seller:
                assert "display_name" in seller, "Seller should have display_name"
                assert "name_hidden" in seller, "Seller should have name_hidden"
                assert seller.get("name_hidden") == True, "Seller name should be hidden for non-friends"
                print(f"✓ Listing '{listing.get('title', 'N/A')[:30]}' shows seller as '{seller.get('display_name')}'")
        
        print("✓ Marketplace listings respect seller privacy settings")
    
    def test_single_listing_respects_privacy(self):
        """Test that GET /api/marketplace/listings/{id} respects seller privacy"""
        # First, create a test listing
        listing_data = {
            "title": f"TEST_Privacy_Listing_{uuid.uuid4().hex[:8]}",
            "description": "Test listing for privacy feature",
            "price": 99.99,
            "category": "electronics",
            "condition": "new"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/marketplace/listings", json=listing_data)
        
        if create_response.status_code not in [200, 201]:
            pytest.skip("Could not create test listing")
        
        listing = create_response.json()
        listing_id = listing.get("listing_id")
        
        try:
            # Enable privacy
            self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
                "is_real_name_private": True
            })
            
            # Get listing as anonymous
            anon_session = requests.Session()
            anon_session.headers.update({"Content-Type": "application/json"})
            
            response = anon_session.get(f"{BASE_URL}/api/marketplace/listings/{listing_id}")
            assert response.status_code == 200
            
            data = response.json()
            seller = data.get("seller")
            
            assert seller is not None, "Listing should have seller info"
            assert "display_name" in seller, "Seller should have display_name"
            assert "name_hidden" in seller, "Seller should have name_hidden"
            assert seller.get("name_hidden") == True, "Seller name should be hidden"
            
            # Verify display_name is username, not real name
            assert seller.get("display_name") != seller.get("name") or seller.get("display_name") == seller.get("username"), \
                "display_name should be username when privacy enabled"
            
            print(f"✓ Single listing shows seller as '{seller.get('display_name')}' (privacy enabled)")
            
        finally:
            # Cleanup: Delete test listing
            self.session.delete(f"{BASE_URL}/api/marketplace/listings/{listing_id}")
    
    def test_listing_shows_real_name_when_privacy_disabled(self):
        """Test that listings show real name when privacy is disabled"""
        # Disable privacy
        self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": False
        })
        
        # Create a test listing
        listing_data = {
            "title": f"TEST_NoPrivacy_Listing_{uuid.uuid4().hex[:8]}",
            "description": "Test listing without privacy",
            "price": 49.99,
            "category": "electronics",
            "condition": "new"
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/marketplace/listings", json=listing_data)
        
        if create_response.status_code not in [200, 201]:
            pytest.skip("Could not create test listing")
        
        listing = create_response.json()
        listing_id = listing.get("listing_id")
        
        try:
            # Get listing as anonymous
            anon_session = requests.Session()
            anon_session.headers.update({"Content-Type": "application/json"})
            
            response = anon_session.get(f"{BASE_URL}/api/marketplace/listings/{listing_id}")
            assert response.status_code == 200
            
            data = response.json()
            seller = data.get("seller")
            
            assert seller is not None, "Listing should have seller info"
            assert seller.get("name_hidden") == False, "name_hidden should be False"
            assert seller.get("display_name") == seller.get("name"), "display_name should be real name"
            
            print(f"✓ Listing shows real name '{seller.get('display_name')}' when privacy disabled")
            
        finally:
            # Cleanup
            self.session.delete(f"{BASE_URL}/api/marketplace/listings/{listing_id}")

    # ============== Friends/Mutual Followers Tests ==============
    
    def test_friends_endpoint_exists(self):
        """Test that GET /api/users/{user_id}/friends endpoint exists"""
        user_id = self.user.get("user_id")
        response = self.session.get(f"{BASE_URL}/api/users/{user_id}/friends")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Friends endpoint should return a list"
        print(f"✓ Friends endpoint exists, returned {len(data)} friends")


class TestPrivacyToggleEdgeCases:
    """Edge case tests for privacy toggle"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "Test123!"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.user = data.get("user")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Authentication failed")
        
        yield
        
        # Reset privacy
        try:
            self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
                "is_real_name_private": False
            })
        except:
            pass
    
    def test_invalid_privacy_value(self):
        """Test that invalid values are handled"""
        response = self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
            "is_real_name_private": "invalid"
        })
        # Should either reject or coerce to boolean
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}"
        print("✓ Invalid privacy value handled appropriately")
    
    def test_missing_privacy_field(self):
        """Test that missing field is handled"""
        response = self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={})
        assert response.status_code in [400, 422], f"Expected 400/422 for missing field, got {response.status_code}"
        print("✓ Missing privacy field returns validation error")
    
    def test_privacy_toggle_multiple_times(self):
        """Test toggling privacy multiple times"""
        for i in range(3):
            # Enable
            response = self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
                "is_real_name_private": True
            })
            assert response.status_code == 200
            
            # Disable
            response = self.session.put(f"{BASE_URL}/api/users/privacy-settings", json={
                "is_real_name_private": False
            })
            assert response.status_code == 200
        
        print("✓ Privacy toggle works correctly after multiple toggles")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
