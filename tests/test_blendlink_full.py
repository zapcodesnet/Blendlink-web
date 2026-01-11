"""
Blendlink PWA Full Test Suite
Tests all main features: Auth, Marketplace, Rentals, Services, Wallet, Referrals, Admin
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://super-ctrl.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "Test123456"

class TestHealthAndRoot:
    """Health check and root endpoint tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health endpoint working")
    
    def test_root_endpoint(self):
        """Test /api/ returns API info"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "Blendlink" in data["message"]
        print("✓ Root endpoint working")


class TestAuthentication:
    """Authentication flow tests"""
    
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
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected")
    
    def test_get_profile_with_token(self):
        """Test /api/auth/me with valid token"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_response.json()["token"]
        
        # Get profile
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_EMAIL
        print("✓ Profile retrieval with token working")
    
    def test_get_profile_without_token(self):
        """Test /api/auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401
        print("✓ Unauthorized access correctly rejected")


class TestMarketplace:
    """Marketplace feature tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_listings(self, auth_token):
        """Test getting marketplace listings"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Marketplace listings retrieved: {len(data)} items")
    
    def test_get_categories(self, auth_token):
        """Test getting marketplace categories"""
        response = requests.get(f"{BASE_URL}/api/marketplace/categories", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check for expected categories
        category_ids = [c["id"] for c in data]
        assert "electronics" in category_ids
        print(f"✓ Marketplace categories retrieved: {len(data)} categories")


class TestRentals:
    """Rentals feature tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_properties(self, auth_token):
        """Test getting rental properties"""
        response = requests.get(f"{BASE_URL}/api/rentals/properties", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Rental properties retrieved: {len(data)} properties")


class TestServices:
    """Services feature tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_services(self, auth_token):
        """Test getting services"""
        response = requests.get(f"{BASE_URL}/api/services", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Services retrieved: {len(data)} services")
    
    def test_get_service_categories(self, auth_token):
        """Test getting service categories"""
        response = requests.get(f"{BASE_URL}/api/services/categories/list", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        print(f"✓ Service categories retrieved: {len(data)} categories")


class TestWallet:
    """Wallet feature tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_balance(self, auth_token):
        """Test getting wallet balance"""
        response = requests.get(f"{BASE_URL}/api/wallet/balance", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data
        assert "bl_coins" in data
        print(f"✓ Wallet balance retrieved: {data['balance']} BL Coins")
    
    def test_get_transactions(self, auth_token):
        """Test getting transaction history"""
        response = requests.get(f"{BASE_URL}/api/wallet/transactions", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Transactions retrieved: {len(data)} transactions")


class TestReferrals:
    """Referral system tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_referral_stats(self, auth_token):
        """Test getting referral statistics"""
        response = requests.get(f"{BASE_URL}/api/referrals/stats", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "referral_code" in data
        assert "level1_count" in data
        print(f"✓ Referral stats retrieved: Code={data['referral_code']}, L1={data['level1_count']}")
    
    def test_get_referral_network(self, auth_token):
        """Test getting referral network"""
        response = requests.get(f"{BASE_URL}/api/referral-system/my-network", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "level_1_count" in data
        assert "level_2_count" in data
        print(f"✓ Referral network retrieved: L1={data['level_1_count']}, L2={data['level_2_count']}")


class TestEarningsAndWithdrawals:
    """Earnings and withdrawal tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_commissions(self, auth_token):
        """Test getting commission history"""
        response = requests.get(f"{BASE_URL}/api/commissions/my-commissions", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "commissions" in data
        assert "totals" in data
        print(f"✓ Commissions retrieved: {len(data['commissions'])} records")
    
    def test_get_diamond_status(self, auth_token):
        """Test getting Diamond Leader status"""
        response = requests.get(f"{BASE_URL}/api/diamond/status", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "direct_recruits_count" in data
        assert "is_qualified" in data
        print(f"✓ Diamond status retrieved: Qualified={data['is_qualified']}")
    
    def test_get_withdrawal_eligibility(self, auth_token):
        """Test getting withdrawal eligibility"""
        response = requests.get(f"{BASE_URL}/api/withdrawals/eligibility", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "is_eligible" in data
        assert "id_verified" in data
        print(f"✓ Withdrawal eligibility: Eligible={data['is_eligible']}, ID Verified={data['id_verified']}")


class TestAdminDashboard:
    """Admin dashboard tests (requires admin user)"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_admin_dashboard(self, auth_token):
        """Test admin dashboard access"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        # Test user is admin, so should return 200
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "diamond_leaders" in data
        print(f"✓ Admin dashboard: {data['total_users']} total users")
    
    def test_admin_analytics(self, auth_token):
        """Test admin analytics"""
        response = requests.get(f"{BASE_URL}/api/admin/analytics", headers={
            "Authorization": f"Bearer {auth_token}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"✓ Admin analytics: {data['users']['new_30d']} new users in 30 days")


class TestUserRegistration:
    """User registration tests"""
    
    def test_register_new_user(self):
        """Test registering a new user"""
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"test_reg_{unique_id}@example.com",
            "password": "TestPass123",
            "name": f"Test User {unique_id}",
            "username": f"testuser_{unique_id}"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        print(f"✓ New user registered: {data['user_id']}")
    
    def test_register_with_referral_code(self):
        """Test registering with a referral code"""
        # First get the test user's referral code
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_response.json()["token"]
        profile_response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        referral_code = profile_response.json()["referral_code"]
        
        # Register new user with referral code
        unique_id = uuid.uuid4().hex[:8]
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"test_ref_{unique_id}@example.com",
            "password": "TestPass123",
            "name": f"Referred User {unique_id}",
            "username": f"refuser_{unique_id}",
            "referral_code": referral_code
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        print(f"✓ User registered with referral code: {referral_code}")
    
    def test_register_duplicate_email(self):
        """Test registering with duplicate email fails"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": "TestPass123",
            "name": "Duplicate User",
            "username": "duplicateuser"
        })
        assert response.status_code == 400
        print("✓ Duplicate email registration correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
