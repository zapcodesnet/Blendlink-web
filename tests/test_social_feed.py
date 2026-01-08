"""
Blendlink Social Feed Tests
Tests for: Posts, Reactions (golden/silver thumbs), Comments, Stories, Friends, Groups, Pages, Events, AI Media
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "Test123456"


class TestSocialFeedAuth:
    """Authentication and setup tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
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
        """Get headers with auth token"""
        return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def user_info(self, auth_headers):
        """Get current user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        return response.json()
    
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


class TestSocialPosts:
    """Social posts CRUD tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def user_info(self, auth_headers):
        """Get current user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        return response.json()
    
    def test_get_social_feed(self, auth_headers):
        """Test GET /api/social/feed returns posts"""
        response = requests.get(f"{BASE_URL}/api/social/feed?skip=0&limit=10", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Feed should return a list"
        print(f"Feed returned {len(data)} posts")
    
    def test_create_text_post_public(self, auth_headers):
        """Test creating a public text post (no BL coins for text)"""
        unique_content = f"TEST_post_text_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": unique_content,
            "media_type": "text",
            "media_urls": [],
            "privacy": "public"
        })
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        assert "post" in data
        assert data["post"]["content"] == unique_content
        assert data["bl_coins_earned"] == 0, "Text posts should not earn BL coins"
        print(f"Created text post: {data['post']['post_id']}")
        return data["post"]["post_id"]
    
    def test_create_image_post_public_earns_coins(self, auth_headers):
        """Test creating a public image post earns 20 BL coins"""
        unique_content = f"TEST_post_image_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": unique_content,
            "media_type": "image",
            "media_urls": ["https://example.com/test.jpg"],
            "privacy": "public"
        })
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        assert data["bl_coins_earned"] == 20, f"Image post should earn 20 BL coins, got {data['bl_coins_earned']}"
        print(f"Created image post, earned {data['bl_coins_earned']} BL coins")
    
    def test_create_video_post_public_earns_coins(self, auth_headers):
        """Test creating a public video post earns 50 BL coins"""
        unique_content = f"TEST_post_video_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": unique_content,
            "media_type": "video",
            "media_urls": ["https://example.com/test.mp4"],
            "privacy": "public"
        })
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        assert data["bl_coins_earned"] == 50, f"Video post should earn 50 BL coins, got {data['bl_coins_earned']}"
        print(f"Created video post, earned {data['bl_coins_earned']} BL coins")
    
    def test_create_audio_post_public_earns_coins(self, auth_headers):
        """Test creating a public audio post earns 30 BL coins"""
        unique_content = f"TEST_post_audio_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": unique_content,
            "media_type": "audio",
            "media_urls": ["https://example.com/test.mp3"],
            "privacy": "public"
        })
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        assert data["bl_coins_earned"] == 30, f"Audio post should earn 30 BL coins, got {data['bl_coins_earned']}"
        print(f"Created audio post, earned {data['bl_coins_earned']} BL coins")
    
    def test_create_private_post_no_coins(self, auth_headers):
        """Test creating a private post does NOT earn BL coins"""
        unique_content = f"TEST_post_private_{uuid.uuid4().hex[:8]}"
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": unique_content,
            "media_type": "video",
            "media_urls": ["https://example.com/test.mp4"],
            "privacy": "private"
        })
        assert response.status_code == 200, f"Create post failed: {response.text}"
        data = response.json()
        assert data["bl_coins_earned"] == 0, "Private posts should not earn BL coins"
        print(f"Created private post, earned {data['bl_coins_earned']} BL coins (expected 0)")
    
    def test_get_single_post(self, auth_headers):
        """Test getting a single post by ID"""
        # First create a post
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": f"TEST_get_single_{uuid.uuid4().hex[:8]}",
            "media_type": "text",
            "privacy": "public"
        })
        post_id = response.json()["post"]["post_id"]
        
        # Get the post
        response = requests.get(f"{BASE_URL}/api/social/posts/{post_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["post_id"] == post_id
        print(f"Retrieved post: {post_id}")


class TestReactions:
    """Reaction system tests - golden thumbs up / silver thumbs down"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers for main test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def user_info(self, auth_headers):
        """Get current user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        return response.json()
    
    @pytest.fixture(scope="class")
    def second_user_headers(self):
        """Create and login as a second user for reaction tests"""
        # Create a unique second user
        unique_email = f"test_reactor_{uuid.uuid4().hex[:8]}@test.com"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "Test Reactor"
        })
        
        if register_response.status_code != 200:
            # User might already exist, try login
            login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": unique_email,
                "password": "Test123456"
            })
            if login_response.status_code == 200:
                token = login_response.json()["token"]
                return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            pytest.skip("Could not create second user for reaction tests")
        
        token = register_response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_cannot_react_to_own_post(self, auth_headers):
        """Test that users cannot react to their own posts"""
        # Create a post
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": f"TEST_own_react_{uuid.uuid4().hex[:8]}",
            "media_type": "text",
            "privacy": "public"
        })
        post_id = response.json()["post"]["post_id"]
        
        # Try to react to own post
        response = requests.post(f"{BASE_URL}/api/social/posts/{post_id}/react", headers=auth_headers, json={
            "reaction_type": "golden_thumbs_up"
        })
        assert response.status_code == 400, f"Should not be able to react to own post: {response.text}"
        assert "cannot react to your own post" in response.json().get("detail", "").lower()
        print("Correctly prevented self-reaction")
    
    def test_golden_thumbs_up_awards_both_users(self, auth_headers, second_user_headers):
        """Test golden thumbs up awards 10 BL coins to both reactor and post owner"""
        # Create a post as main user
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": f"TEST_golden_react_{uuid.uuid4().hex[:8]}",
            "media_type": "text",
            "privacy": "public"
        })
        post_id = response.json()["post"]["post_id"]
        
        # React as second user with golden thumbs up
        response = requests.post(f"{BASE_URL}/api/social/posts/{post_id}/react", headers=second_user_headers, json={
            "reaction_type": "golden_thumbs_up"
        })
        assert response.status_code == 200, f"Reaction failed: {response.text}"
        data = response.json()
        
        assert data["reaction_type"] == "golden_thumbs_up"
        assert data["reactor_bl_coins_earned"] == 10, f"Reactor should earn 10 BL, got {data['reactor_bl_coins_earned']}"
        assert data["owner_bl_coins_earned"] == 10, f"Owner should earn 10 BL for golden thumbs up, got {data['owner_bl_coins_earned']}"
        assert data["golden_thumbs_up_count"] == 1
        print(f"Golden thumbs up: reactor earned {data['reactor_bl_coins_earned']}, owner earned {data['owner_bl_coins_earned']}")
    
    def test_silver_thumbs_down_awards_only_reactor(self, auth_headers, second_user_headers):
        """Test silver thumbs down awards 10 BL coins only to reactor"""
        # Create a post as main user
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": f"TEST_silver_react_{uuid.uuid4().hex[:8]}",
            "media_type": "text",
            "privacy": "public"
        })
        post_id = response.json()["post"]["post_id"]
        
        # React as second user with silver thumbs down
        response = requests.post(f"{BASE_URL}/api/social/posts/{post_id}/react", headers=second_user_headers, json={
            "reaction_type": "silver_thumbs_down"
        })
        assert response.status_code == 200, f"Reaction failed: {response.text}"
        data = response.json()
        
        assert data["reaction_type"] == "silver_thumbs_down"
        assert data["reactor_bl_coins_earned"] == 10, f"Reactor should earn 10 BL, got {data['reactor_bl_coins_earned']}"
        assert data["owner_bl_coins_earned"] == 0, f"Owner should NOT earn BL for silver thumbs down, got {data['owner_bl_coins_earned']}"
        assert data["silver_thumbs_down_count"] == 1
        print(f"Silver thumbs down: reactor earned {data['reactor_bl_coins_earned']}, owner earned {data['owner_bl_coins_earned']}")
    
    def test_reactions_are_permanent(self, auth_headers, second_user_headers):
        """Test that reactions cannot be changed once made"""
        # Create a post
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": f"TEST_permanent_react_{uuid.uuid4().hex[:8]}",
            "media_type": "text",
            "privacy": "public"
        })
        post_id = response.json()["post"]["post_id"]
        
        # First reaction
        response = requests.post(f"{BASE_URL}/api/social/posts/{post_id}/react", headers=second_user_headers, json={
            "reaction_type": "golden_thumbs_up"
        })
        assert response.status_code == 200
        
        # Try to react again
        response = requests.post(f"{BASE_URL}/api/social/posts/{post_id}/react", headers=second_user_headers, json={
            "reaction_type": "silver_thumbs_down"
        })
        assert response.status_code == 400, "Should not be able to change reaction"
        assert "already reacted" in response.json().get("detail", "").lower()
        print("Correctly prevented changing reaction (reactions are permanent)")


class TestComments:
    """Comment system tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    @pytest.fixture(scope="class")
    def second_user_headers(self):
        """Create second user for comment tests"""
        unique_email = f"test_commenter_{uuid.uuid4().hex[:8]}@test.com"
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123456",
            "name": "Test Commenter"
        })
        
        if register_response.status_code != 200:
            pytest.skip("Could not create second user for comment tests")
        
        token = register_response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_first_comment_earns_coins(self, auth_headers, second_user_headers):
        """Test first comment on a public post earns 10 BL coins"""
        # Create a post as main user
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": f"TEST_comment_post_{uuid.uuid4().hex[:8]}",
            "media_type": "text",
            "privacy": "public"
        })
        post_id = response.json()["post"]["post_id"]
        
        # Comment as second user (first comment)
        response = requests.post(f"{BASE_URL}/api/social/posts/{post_id}/comments", headers=second_user_headers, json={
            "content": "This is my first comment!"
        })
        assert response.status_code == 200, f"Comment failed: {response.text}"
        data = response.json()
        
        assert "comment" in data
        assert data["bl_coins_earned"] == 10, f"First comment should earn 10 BL, got {data['bl_coins_earned']}"
        print(f"First comment earned {data['bl_coins_earned']} BL coins")
    
    def test_second_comment_no_coins(self, auth_headers, second_user_headers):
        """Test second comment on same post does NOT earn BL coins"""
        # Create a post
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": f"TEST_multi_comment_{uuid.uuid4().hex[:8]}",
            "media_type": "text",
            "privacy": "public"
        })
        post_id = response.json()["post"]["post_id"]
        
        # First comment
        response = requests.post(f"{BASE_URL}/api/social/posts/{post_id}/comments", headers=second_user_headers, json={
            "content": "First comment"
        })
        assert response.json()["bl_coins_earned"] == 10
        
        # Second comment
        response = requests.post(f"{BASE_URL}/api/social/posts/{post_id}/comments", headers=second_user_headers, json={
            "content": "Second comment"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["bl_coins_earned"] == 0, f"Second comment should not earn BL, got {data['bl_coins_earned']}"
        print("Second comment correctly earned 0 BL coins")
    
    def test_owner_comment_no_coins(self, auth_headers):
        """Test post owner commenting on own post does NOT earn BL coins"""
        # Create a post
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": f"TEST_owner_comment_{uuid.uuid4().hex[:8]}",
            "media_type": "text",
            "privacy": "public"
        })
        post_id = response.json()["post"]["post_id"]
        
        # Owner comments
        response = requests.post(f"{BASE_URL}/api/social/posts/{post_id}/comments", headers=auth_headers, json={
            "content": "Owner's comment"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["bl_coins_earned"] == 0, f"Owner should not earn BL for commenting on own post, got {data['bl_coins_earned']}"
        print("Owner comment correctly earned 0 BL coins")
    
    def test_get_comments(self, auth_headers):
        """Test getting comments for a post"""
        # Create a post with comments
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": f"TEST_get_comments_{uuid.uuid4().hex[:8]}",
            "media_type": "text",
            "privacy": "public"
        })
        post_id = response.json()["post"]["post_id"]
        
        # Add a comment
        requests.post(f"{BASE_URL}/api/social/posts/{post_id}/comments", headers=auth_headers, json={
            "content": "Test comment"
        })
        
        # Get comments
        response = requests.get(f"{BASE_URL}/api/social/posts/{post_id}/comments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        print(f"Retrieved {len(data)} comments")


class TestSharePost:
    """Share post tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_share_post_earns_coins(self, auth_headers):
        """Test sharing a public post earns 10 BL coins"""
        # Create a post
        response = requests.post(f"{BASE_URL}/api/social/posts", headers=auth_headers, json={
            "content": f"TEST_share_post_{uuid.uuid4().hex[:8]}",
            "media_type": "text",
            "privacy": "public"
        })
        post_id = response.json()["post"]["post_id"]
        
        # Share the post
        response = requests.post(f"{BASE_URL}/api/social/posts/{post_id}/share", headers=auth_headers, json={
            "content": "Sharing this!",
            "privacy": "public"
        })
        assert response.status_code == 200, f"Share failed: {response.text}"
        data = response.json()
        
        assert "post" in data
        assert data["bl_coins_earned"] == 10, f"Sharing should earn 10 BL, got {data['bl_coins_earned']}"
        assert data["post"]["original_post_id"] == post_id
        print(f"Shared post, earned {data['bl_coins_earned']} BL coins")


class TestStories:
    """Stories endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_stories(self, auth_headers):
        """Test GET /api/stories/ returns story groups"""
        response = requests.get(f"{BASE_URL}/api/stories/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Stories should return a list"
        print(f"Retrieved {len(data)} story groups")
    
    def test_create_story(self, auth_headers):
        """Test creating a story"""
        response = requests.post(f"{BASE_URL}/api/stories/", headers=auth_headers, json={
            "media_type": "image",
            "media_url": "https://example.com/story.jpg",
            "privacy": "public"
        })
        assert response.status_code == 200, f"Create story failed: {response.text}"
        data = response.json()
        assert "story" in data
        assert data["bl_coins_earned"] == 50, f"Public story should earn 50 BL, got {data['bl_coins_earned']}"
        print(f"Created story, earned {data['bl_coins_earned']} BL coins")


class TestFriends:
    """Friends system tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_friends_list(self, auth_headers):
        """Test GET /api/friends/ returns friends list"""
        response = requests.get(f"{BASE_URL}/api/friends/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Friends should return a list"
        print(f"Retrieved {len(data)} friends")
    
    def test_get_friend_requests(self, auth_headers):
        """Test GET /api/friends/requests returns pending requests"""
        response = requests.get(f"{BASE_URL}/api/friends/requests", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "incoming" in data
        assert "outgoing" in data
        print(f"Friend requests: {len(data['incoming'])} incoming, {len(data['outgoing'])} outgoing")


class TestGroups:
    """Groups endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_groups(self, auth_headers):
        """Test GET /api/groups/ returns groups"""
        response = requests.get(f"{BASE_URL}/api/groups/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Groups should return a list"
        print(f"Retrieved {len(data)} groups")
    
    def test_create_group(self, auth_headers):
        """Test POST /api/groups/ creates a group and earns 40 BL coins"""
        response = requests.post(f"{BASE_URL}/api/groups/", headers=auth_headers, json={
            "name": f"TEST_Group_{uuid.uuid4().hex[:8]}",
            "description": "Test group description",
            "privacy": "public"
        })
        assert response.status_code == 200, f"Create group failed: {response.text}"
        data = response.json()
        assert "group" in data
        assert data["bl_coins_earned"] == 40, f"Creating group should earn 40 BL, got {data['bl_coins_earned']}"
        print(f"Created group, earned {data['bl_coins_earned']} BL coins")


class TestPages:
    """Pages endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_pages(self, auth_headers):
        """Test GET /api/pages/ returns pages"""
        response = requests.get(f"{BASE_URL}/api/pages/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Pages should return a list"
        print(f"Retrieved {len(data)} pages")
    
    def test_create_page(self, auth_headers):
        """Test POST /api/pages/ creates a page and earns 40 BL coins"""
        response = requests.post(f"{BASE_URL}/api/pages/", headers=auth_headers, json={
            "name": f"TEST_Page_{uuid.uuid4().hex[:8]}",
            "description": "Test page description",
            "category": "Entertainment"
        })
        assert response.status_code == 200, f"Create page failed: {response.text}"
        data = response.json()
        assert "page" in data
        assert data["bl_coins_earned"] == 40, f"Creating page should earn 40 BL, got {data['bl_coins_earned']}"
        print(f"Created page, earned {data['bl_coins_earned']} BL coins")


class TestEvents:
    """Events endpoint tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_get_events(self, auth_headers):
        """Test GET /api/events/ returns events"""
        response = requests.get(f"{BASE_URL}/api/events/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list), "Events should return a list"
        print(f"Retrieved {len(data)} events")
    
    def test_create_event(self, auth_headers):
        """Test POST /api/events/ creates an event and earns 20 BL coins"""
        response = requests.post(f"{BASE_URL}/api/events/", headers=auth_headers, json={
            "name": f"TEST_Event_{uuid.uuid4().hex[:8]}",
            "description": "Test event description",
            "location": "Test Location",
            "start_time": "2025-12-31T18:00:00Z",
            "privacy": "public"
        })
        assert response.status_code == 200, f"Create event failed: {response.text}"
        data = response.json()
        assert "event" in data
        assert data["bl_coins_earned"] == 20, f"Creating event should earn 20 BL, got {data['bl_coins_earned']}"
        print(f"Created event, earned {data['bl_coins_earned']} BL coins")


class TestAIMedia:
    """AI Media generation tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    def test_estimate_cost_image(self, auth_headers):
        """Test POST /api/ai-media/estimate-cost for image"""
        response = requests.post(f"{BASE_URL}/api/ai-media/estimate-cost", headers=auth_headers, json={
            "prompt": "A beautiful sunset over mountains",
            "media_type": "image"
        })
        assert response.status_code == 200, f"Estimate cost failed: {response.text}"
        data = response.json()
        assert "estimated_cost" in data
        assert "current_balance" in data
        assert "can_afford" in data
        assert data["estimated_cost"] == 200, f"Image cost should be 200 BL, got {data['estimated_cost']}"
        print(f"Image cost estimate: {data['estimated_cost']} BL, balance: {data['current_balance']}, can afford: {data['can_afford']}")
    
    def test_estimate_cost_video(self, auth_headers):
        """Test POST /api/ai-media/estimate-cost for video"""
        response = requests.post(f"{BASE_URL}/api/ai-media/estimate-cost", headers=auth_headers, json={
            "prompt": "A cat playing with a ball",
            "media_type": "video",
            "duration": 6
        })
        assert response.status_code == 200, f"Estimate cost failed: {response.text}"
        data = response.json()
        assert data["estimated_cost"] == 400, f"Video cost should be 400 BL, got {data['estimated_cost']}"
        print(f"Video cost estimate: {data['estimated_cost']} BL")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
