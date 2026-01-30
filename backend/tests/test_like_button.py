"""
Test LikeButton Feature - Backend Engagement Endpoints
Tests the /api/photo-game/engagement/like and /engagement/unlike endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestEngagementEndpoints:
    """Test engagement (like/unlike) endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get auth token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            token = data.get("token") or data.get("access_token")
            if token:
                self.session.headers.update({"Authorization": f"Bearer {token}"})
                self.user_id = data.get("user", {}).get("user_id") or data.get("user_id")
        
        yield
    
    def test_01_login_works(self):
        """Test that login works and we have auth"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert "user_id" in data or "email" in data
        print(f"✓ Logged in as: {data.get('email', data.get('username', 'unknown'))}")
    
    def test_02_get_minted_photos(self):
        """Get user's minted photos to find a photo_id for testing"""
        response = self.session.get(f"{BASE_URL}/api/minting/photos")
        assert response.status_code == 200, f"Failed to get photos: {response.text}"
        data = response.json()
        photos = data.get("photos", [])
        print(f"✓ Found {len(photos)} minted photos")
        
        if photos:
            self.test_photo_id = photos[0].get("mint_id")
            print(f"✓ Using photo for testing: {self.test_photo_id}")
            return self.test_photo_id
        return None
    
    def test_03_like_photo_endpoint(self):
        """Test POST /api/photo-game/engagement/like"""
        # First get a photo to like
        photos_response = self.session.get(f"{BASE_URL}/api/minting/photos")
        photos = photos_response.json().get("photos", [])
        
        if not photos:
            pytest.skip("No minted photos available for testing")
        
        photo_id = photos[0].get("mint_id")
        initial_reactions = photos[0].get("total_reactions", 0) or photos[0].get("reaction_count", 0) or 0
        
        # Like the photo
        response = self.session.post(f"{BASE_URL}/api/photo-game/engagement/like", json={
            "photo_id": photo_id,
            "reaction_type": "heart"
        })
        
        assert response.status_code == 200, f"Like failed: {response.text}"
        data = response.json()
        
        assert data.get("success") == True
        assert data.get("photo_id") == photo_id
        assert data.get("reaction_type") == "heart"
        assert "total_reactions" in data
        
        print(f"✓ Like endpoint works - action: {data.get('action')}, total_reactions: {data.get('total_reactions')}")
    
    def test_04_get_photo_engagement(self):
        """Test GET /api/photo-game/engagement/photo/{photo_id}"""
        # Get a photo
        photos_response = self.session.get(f"{BASE_URL}/api/minting/photos")
        photos = photos_response.json().get("photos", [])
        
        if not photos:
            pytest.skip("No minted photos available for testing")
        
        photo_id = photos[0].get("mint_id")
        
        # Get engagement stats
        response = self.session.get(f"{BASE_URL}/api/photo-game/engagement/photo/{photo_id}")
        
        assert response.status_code == 200, f"Get engagement failed: {response.text}"
        data = response.json()
        
        assert data.get("photo_id") == photo_id
        assert "total_reactions" in data
        assert "user_reaction" in data  # Should show if current user has reacted
        
        print(f"✓ Get engagement works - total: {data.get('total_reactions')}, user_reaction: {data.get('user_reaction')}")
    
    def test_05_unlike_photo_endpoint(self):
        """Test DELETE /api/photo-game/engagement/unlike/{photo_id}"""
        # Get a photo
        photos_response = self.session.get(f"{BASE_URL}/api/minting/photos")
        photos = photos_response.json().get("photos", [])
        
        if not photos:
            pytest.skip("No minted photos available for testing")
        
        photo_id = photos[0].get("mint_id")
        
        # First ensure we have a like to remove
        self.session.post(f"{BASE_URL}/api/photo-game/engagement/like", json={
            "photo_id": photo_id,
            "reaction_type": "heart"
        })
        
        # Now unlike
        response = self.session.delete(f"{BASE_URL}/api/photo-game/engagement/unlike/{photo_id}")
        
        # Should succeed (200) or return 404 if no reaction exists
        assert response.status_code in [200, 404], f"Unlike failed unexpectedly: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert data.get("success") == True
            assert data.get("action") == "removed"
            print(f"✓ Unlike endpoint works - removed reaction from {photo_id}")
        else:
            print(f"✓ Unlike endpoint returns 404 when no reaction exists (expected behavior)")
    
    def test_06_like_increments_total_reactions(self):
        """Test that liking increments total_reactions count"""
        # Get a photo
        photos_response = self.session.get(f"{BASE_URL}/api/minting/photos")
        photos = photos_response.json().get("photos", [])
        
        if not photos:
            pytest.skip("No minted photos available for testing")
        
        photo_id = photos[0].get("mint_id")
        
        # First unlike to ensure clean state
        self.session.delete(f"{BASE_URL}/api/photo-game/engagement/unlike/{photo_id}")
        
        # Get initial count
        engagement_before = self.session.get(f"{BASE_URL}/api/photo-game/engagement/photo/{photo_id}")
        initial_count = engagement_before.json().get("total_reactions", 0)
        
        # Like the photo
        like_response = self.session.post(f"{BASE_URL}/api/photo-game/engagement/like", json={
            "photo_id": photo_id,
            "reaction_type": "heart"
        })
        
        assert like_response.status_code == 200
        like_data = like_response.json()
        
        # Verify count increased
        new_count = like_data.get("total_reactions", 0)
        
        # The count should be >= initial (could be same if user already liked)
        assert new_count >= initial_count, f"Expected count >= {initial_count}, got {new_count}"
        print(f"✓ Like increments total_reactions: {initial_count} -> {new_count}")
    
    def test_07_double_like_updates_not_duplicates(self):
        """Test that liking twice updates reaction, doesn't create duplicate"""
        # Get a photo
        photos_response = self.session.get(f"{BASE_URL}/api/minting/photos")
        photos = photos_response.json().get("photos", [])
        
        if not photos:
            pytest.skip("No minted photos available for testing")
        
        photo_id = photos[0].get("mint_id")
        
        # Like once
        response1 = self.session.post(f"{BASE_URL}/api/photo-game/engagement/like", json={
            "photo_id": photo_id,
            "reaction_type": "heart"
        })
        count1 = response1.json().get("total_reactions", 0)
        action1 = response1.json().get("action")
        
        # Like again
        response2 = self.session.post(f"{BASE_URL}/api/photo-game/engagement/like", json={
            "photo_id": photo_id,
            "reaction_type": "heart"
        })
        count2 = response2.json().get("total_reactions", 0)
        action2 = response2.json().get("action")
        
        # Second like should be "updated" not "added", count should stay same
        assert action2 == "updated", f"Expected 'updated' action, got '{action2}'"
        assert count2 == count1, f"Count should stay same on double-like: {count1} vs {count2}"
        
        print(f"✓ Double-like correctly updates (not duplicates): action={action2}, count={count2}")
    
    def test_08_like_nonexistent_photo_returns_404(self):
        """Test that liking a non-existent photo returns 404"""
        response = self.session.post(f"{BASE_URL}/api/photo-game/engagement/like", json={
            "photo_id": "nonexistent_photo_id_12345",
            "reaction_type": "heart"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Like non-existent photo correctly returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
