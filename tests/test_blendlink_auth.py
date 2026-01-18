"""
Blendlink PWA - Auth and Core API Tests
Tests for login, registration, Google OAuth, wallet, and profile endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://blendlink-social-2.preview.emergentagent.com')

class TestHealthCheck:
    """Health check endpoint tests"""
    
    def test_health_endpoint(self):
        """Test health check returns OK"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health check passed")

    def test_root_endpoint(self):
        """Test root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "Blendlink" in data.get("message", "")
        print("✓ Root endpoint passed")


class TestEmailAuth:
    """Email login and registration tests"""
    
    def test_login_with_valid_credentials(self):
        """Test login with test@test.com / Test123456"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "Test123456"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@test.com"
        print(f"✓ Login successful - User ID: {data['user']['user_id']}")
        return data["token"]
    
    def test_login_with_invalid_credentials(self):
        """Test login with wrong password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "WrongPassword"}
        )
        assert response.status_code == 401
        print("✓ Invalid credentials rejected correctly")
    
    def test_login_with_nonexistent_user(self):
        """Test login with non-existent email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@test.com", "password": "Test123456"}
        )
        assert response.status_code == 401
        print("✓ Non-existent user rejected correctly")
    
    def test_register_new_user(self):
        """Test user registration"""
        timestamp = int(time.time())
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"TEST_newuser_{timestamp}@test.com",
                "password": "Test123456",
                "name": "Test New User",
                "username": f"TEST_newuser_{timestamp}"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        print(f"✓ Registration successful - User ID: {data['user_id']}")
    
    def test_register_duplicate_email(self):
        """Test registration with existing email"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": "test@test.com",
                "password": "Test123456",
                "name": "Duplicate User",
                "username": "duplicateuser"
            }
        )
        assert response.status_code == 400
        print("✓ Duplicate email rejected correctly")


class TestGoogleOAuth:
    """Google OAuth endpoint tests"""
    
    def test_google_auth_new_user(self):
        """Test Google OAuth creates new user"""
        timestamp = int(time.time())
        response = requests.post(
            f"{BASE_URL}/api/auth/google",
            json={
                "email": f"TEST_google_{timestamp}@example.com",
                "name": "Google Test User",
                "picture": "https://example.com/pic.jpg",
                "google_id": f"google_{timestamp}"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == f"TEST_google_{timestamp}@example.com"
        print(f"✓ Google OAuth new user created - User ID: {data['user']['user_id']}")
    
    def test_google_auth_existing_user(self):
        """Test Google OAuth with existing email logs in"""
        # First create a user via Google OAuth
        timestamp = int(time.time())
        email = f"TEST_google_existing_{timestamp}@example.com"
        
        # Create user
        response1 = requests.post(
            f"{BASE_URL}/api/auth/google",
            json={
                "email": email,
                "name": "Google Existing User",
                "picture": "https://example.com/pic1.jpg",
                "google_id": f"google_existing_{timestamp}"
            }
        )
        assert response1.status_code == 200
        user_id = response1.json()["user"]["user_id"]
        
        # Login again with same email
        response2 = requests.post(
            f"{BASE_URL}/api/auth/google",
            json={
                "email": email,
                "name": "Google Existing User Updated",
                "picture": "https://example.com/pic2.jpg",
                "google_id": f"google_existing_{timestamp}"
            }
        )
        assert response2.status_code == 200
        assert response2.json()["user"]["user_id"] == user_id
        print("✓ Google OAuth existing user login successful")


class TestAuthenticatedEndpoints:
    """Tests for authenticated endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "test@test.com", "password": "Test123456"}
        )
        return response.json()["token"]
    
    def test_get_profile(self, auth_token):
        """Test getting user profile"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@test.com"
        assert "bl_coins" in data
        assert "referral_code" in data
        print(f"✓ Profile fetched - BL Coins: {data['bl_coins']}")
    
    def test_get_wallet_balance(self, auth_token):
        """Test getting wallet balance"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/balance",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data
        assert "bl_coins" in data
        print(f"✓ Wallet balance: {data['balance']}")
    
    def test_get_wallet_transactions(self, auth_token):
        """Test getting wallet transactions"""
        response = requests.get(
            f"{BASE_URL}/api/wallet/transactions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        # Response is a list of transactions
        assert isinstance(response.json(), list)
        print(f"✓ Wallet transactions fetched - Count: {len(response.json())}")
    
    def test_get_posts_feed(self, auth_token):
        """Test getting posts feed"""
        response = requests.get(
            f"{BASE_URL}/api/posts/feed",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("✓ Posts feed fetched")
    
    def test_unauthorized_access(self):
        """Test accessing protected endpoint without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Unauthorized access rejected correctly")


class TestPublicEndpoints:
    """Tests for public endpoints"""
    
    def test_marketplace_listings(self):
        """Test getting marketplace listings"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ Marketplace listings fetched - Count: {len(response.json())}")
    
    def test_marketplace_categories(self):
        """Test getting marketplace categories"""
        response = requests.get(f"{BASE_URL}/api/marketplace/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Marketplace categories fetched - Count: {len(data)}")
    
    def test_services_list(self):
        """Test getting services list"""
        response = requests.get(f"{BASE_URL}/api/services")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ Services list fetched - Count: {len(response.json())}")
    
    def test_rentals_properties(self):
        """Test getting rental properties"""
        response = requests.get(f"{BASE_URL}/api/rentals/properties")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ Rental properties fetched - Count: {len(response.json())}")
    
    def test_raffles_list(self):
        """Test getting raffles list"""
        response = requests.get(f"{BASE_URL}/api/raffles")
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"✓ Raffles list fetched - Count: {len(response.json())}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
