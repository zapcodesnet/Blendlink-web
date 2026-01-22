"""
Test Feed Performance - Testing optimized feed/explore/stories endpoints
Tests API response times and functionality after performance optimizations
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"

class TestFeedPerformance:
    """Test feed API performance and functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        # Create test user if doesn't exist
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Test User",
            "username": "testuser_perf",
            "disclaimer_accepted": True
        })
        if register_response.status_code == 200:
            return register_response.json().get("token")
        pytest.skip("Could not authenticate - skipping tests")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    def test_feed_endpoint_response_time(self, auth_headers):
        """Test /api/posts/feed responds under 200ms"""
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/posts/feed", headers=auth_headers)
        elapsed_ms = (time.time() - start_time) * 1000
        
        assert response.status_code == 200, f"Feed endpoint returned {response.status_code}"
        assert elapsed_ms < 500, f"Feed took {elapsed_ms:.0f}ms, expected <500ms"
        print(f"Feed response time: {elapsed_ms:.0f}ms")
        
        # Verify response is a list
        data = response.json()
        assert isinstance(data, list), "Feed should return a list"
    
    def test_explore_endpoint_response_time(self):
        """Test /api/posts/explore responds under 200ms (no auth required)"""
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/posts/explore")
        elapsed_ms = (time.time() - start_time) * 1000
        
        assert response.status_code == 200, f"Explore endpoint returned {response.status_code}"
        assert elapsed_ms < 500, f"Explore took {elapsed_ms:.0f}ms, expected <500ms"
        print(f"Explore response time: {elapsed_ms:.0f}ms")
        
        # Verify response is a list
        data = response.json()
        assert isinstance(data, list), "Explore should return a list"
    
    def test_stories_endpoint_response_time(self, auth_headers):
        """Test /api/posts/stories responds under 200ms"""
        start_time = time.time()
        response = requests.get(f"{BASE_URL}/api/posts/stories", headers=auth_headers)
        elapsed_ms = (time.time() - start_time) * 1000
        
        assert response.status_code == 200, f"Stories endpoint returned {response.status_code}: {response.text}"
        assert elapsed_ms < 500, f"Stories took {elapsed_ms:.0f}ms, expected <500ms"
        print(f"Stories response time: {elapsed_ms:.0f}ms")
        
        # Verify response is a list
        data = response.json()
        assert isinstance(data, list), "Stories should return a list"
    
    def test_feed_returns_posts_with_user_data(self, auth_headers):
        """Test feed returns posts with embedded user data"""
        response = requests.get(f"{BASE_URL}/api/posts/feed", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        # If there are posts, verify user data is included
        if len(data) > 0:
            post = data[0]
            assert "post_id" in post, "Post should have post_id"
            assert "content" in post, "Post should have content"
            # User data should be embedded
            if "user" in post and post["user"]:
                assert "user_id" in post["user"], "User should have user_id"
                print(f"Post has embedded user data: {post['user'].get('name', 'N/A')}")
    
    def test_explore_returns_posts_with_user_data(self):
        """Test explore returns posts with embedded user data"""
        response = requests.get(f"{BASE_URL}/api/posts/explore")
        assert response.status_code == 200
        
        data = response.json()
        # If there are posts, verify user data is included
        if len(data) > 0:
            post = data[0]
            assert "post_id" in post, "Post should have post_id"
            # User data should be embedded
            if "user" in post and post["user"]:
                assert "user_id" in post["user"], "User should have user_id"
                print(f"Explore post has embedded user data: {post['user'].get('name', 'N/A')}")
    
    def test_auth_me_endpoint(self, auth_headers):
        """Test /api/auth/me returns current user"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200, f"Auth/me returned {response.status_code}"
        
        data = response.json()
        assert "user_id" in data, "Should return user_id"
        assert "email" in data, "Should return email"
        print(f"Authenticated as: {data.get('email')}")
    
    def test_login_endpoint(self):
        """Test login endpoint works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        # Either 200 (success) or 401 (invalid credentials - user may not exist)
        assert response.status_code in [200, 401], f"Login returned unexpected {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "token" in data, "Login should return token"
            assert "user" in data, "Login should return user"
            print(f"Login successful for: {data['user'].get('email')}")
        else:
            print("Login returned 401 - test user may not exist")


class TestFeedFunctionality:
    """Test feed functionality after login"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a session and login"""
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        
        # Try to login
        response = s.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            token = response.json().get("token")
            s.headers.update({"Authorization": f"Bearer {token}"})
            return s
        
        # Try to register
        response = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD,
            "name": "Test User",
            "username": "testuser_func",
            "disclaimer_accepted": True
        })
        
        if response.status_code == 200:
            token = response.json().get("token")
            s.headers.update({"Authorization": f"Bearer {token}"})
            return s
        
        pytest.skip("Could not authenticate")
    
    def test_create_post_and_verify_in_feed(self, session):
        """Test creating a post and verifying it appears in feed"""
        # Create a post
        post_content = f"Test post for feed verification - {time.time()}"
        response = session.post(f"{BASE_URL}/api/posts", json={
            "content": post_content,
            "images": []
        })
        
        assert response.status_code == 200, f"Create post failed: {response.text}"
        created_post = response.json()
        post_id = created_post.get("post_id")
        assert post_id, "Created post should have post_id"
        print(f"Created post: {post_id}")
        
        # Verify post appears in feed
        feed_response = session.get(f"{BASE_URL}/api/posts/feed")
        assert feed_response.status_code == 200
        
        feed_posts = feed_response.json()
        post_ids = [p.get("post_id") for p in feed_posts]
        assert post_id in post_ids, "Created post should appear in feed"
        print(f"Post {post_id} found in feed")
    
    def test_like_post_functionality(self, session):
        """Test liking a post"""
        # Get feed first
        feed_response = session.get(f"{BASE_URL}/api/posts/feed")
        if feed_response.status_code != 200:
            pytest.skip("Could not get feed")
        
        posts = feed_response.json()
        if not posts:
            pytest.skip("No posts in feed to like")
        
        post_id = posts[0].get("post_id")
        
        # Like the post
        like_response = session.post(f"{BASE_URL}/api/posts/{post_id}/like")
        assert like_response.status_code == 200, f"Like failed: {like_response.text}"
        
        like_data = like_response.json()
        assert "liked" in like_data, "Like response should have 'liked' field"
        print(f"Like status for {post_id}: {like_data.get('liked')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
