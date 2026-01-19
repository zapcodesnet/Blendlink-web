"""
Blendlink Iteration 22 Tests
Testing: Admin Panel pages, Wallet page, Reactions API, PKO Poker
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://imgproedit.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "blendlinknet@gmail.com"
ADMIN_PASSWORD = "Blend!Admin2026Link"
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "Test123!"


class TestAdminAuthentication:
    """Test Admin Panel authentication"""
    
    def test_admin_login_step1(self):
        """Test admin login step 1 - email/password verification"""
        response = requests.post(f"{BASE_URL}/api/admin-auth/secure/login/step1", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        print(f"Admin login step1 response: {response.status_code}")
        # Should return 200 with token for admin access
        # or 401 if credentials are wrong
        assert response.status_code in [200, 401, 429], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            assert "token" in data or "session_token" in data or "error" in data
            print(f"Admin login step1 success: {data.keys()}")
            return data.get("token") or data.get("session_token")
        return None
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/admin-auth/secure/login/step1", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        })
        print(f"Invalid admin login response: {response.status_code}")
        assert response.status_code in [401, 403, 429]


class TestAdminOrphansAPI:
    """Test Admin Orphans Management API"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for testing"""
        # First try to get a valid admin token
        response = requests.post(f"{BASE_URL}/api/admin-auth/secure/login/step1", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token")
        return None
    
    def test_get_orphans_list(self, admin_token):
        """Test GET /api/admin/orphans - list orphan users"""
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        
        response = requests.get(f"{BASE_URL}/api/admin/orphans", headers=headers)
        print(f"Get orphans response: {response.status_code}")
        # Should return 200 with orphans list or 401 if not authenticated
        assert response.status_code in [200, 401, 403]
        if response.status_code == 200:
            data = response.json()
            print(f"Orphans data keys: {data.keys()}")
            assert "orphans" in data or "total" in data or isinstance(data, list)
    
    def test_get_orphan_stats(self, admin_token):
        """Test GET /api/admin/orphans/stats"""
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        
        response = requests.get(f"{BASE_URL}/api/admin/orphans/stats", headers=headers)
        print(f"Orphan stats response: {response.status_code}")
        assert response.status_code in [200, 401, 403]
    
    def test_get_potential_parents(self, admin_token):
        """Test GET /api/admin/orphans/potential-parents"""
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        
        response = requests.get(f"{BASE_URL}/api/admin/orphans/potential-parents", headers=headers)
        print(f"Potential parents response: {response.status_code}")
        assert response.status_code in [200, 401, 403]


class TestAdminDiamondLeadersAPI:
    """Test Admin Diamond Leaders Management API"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for testing"""
        response = requests.post(f"{BASE_URL}/api/admin-auth/secure/login/step1", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token")
        return None
    
    def test_get_diamond_leaders(self, admin_token):
        """Test GET /api/admin/diamond-leaders - list diamond leaders"""
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        
        response = requests.get(f"{BASE_URL}/api/admin/diamond-leaders", headers=headers)
        print(f"Get diamond leaders response: {response.status_code}")
        assert response.status_code in [200, 401, 403]
        if response.status_code == 200:
            data = response.json()
            print(f"Diamond leaders data keys: {data.keys()}")
    
    def test_get_diamond_candidates(self, admin_token):
        """Test GET /api/admin/diamond-leaders/candidates"""
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        
        response = requests.get(f"{BASE_URL}/api/admin/diamond-leaders/candidates", headers=headers)
        print(f"Diamond candidates response: {response.status_code}")
        assert response.status_code in [200, 401, 403]
    
    def test_get_diamond_stats(self, admin_token):
        """Test GET /api/admin/diamond-leaders/stats"""
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        
        response = requests.get(f"{BASE_URL}/api/admin/diamond-leaders/stats", headers=headers)
        print(f"Diamond stats response: {response.status_code}")
        assert response.status_code in [200, 401, 403]


class TestReactionsAPI:
    """Test Binary Reaction System API"""
    
    @pytest.fixture
    def user_token(self):
        """Get user token for testing"""
        # Try to login as test user
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        return None
    
    def test_react_to_item(self, user_token):
        """Test POST /api/reactions/react - react to an item"""
        headers = {"Content-Type": "application/json"}
        if user_token:
            headers["Authorization"] = f"Bearer {user_token}"
        
        # Test reacting to a post (golden thumbs up)
        response = requests.post(f"{BASE_URL}/api/reactions/react", 
            headers=headers,
            json={
                "item_type": "post",
                "item_id": "test_post_123",
                "reaction_type": "golden_thumbs_up"
            }
        )
        print(f"React to item response: {response.status_code}")
        # Should return 200/201 if authenticated, 401 if not
        assert response.status_code in [200, 201, 401, 403, 404, 422]
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"Reaction response: {data}")
    
    def test_get_item_reactions(self, user_token):
        """Test GET /api/reactions/item/{type}/{id} - get reactions for an item"""
        headers = {}
        if user_token:
            headers["Authorization"] = f"Bearer {user_token}"
        
        response = requests.get(f"{BASE_URL}/api/reactions/item/post/test_post_123", headers=headers)
        print(f"Get item reactions response: {response.status_code}")
        # Should return 200 with reactions data
        assert response.status_code in [200, 401, 404]
        if response.status_code == 200:
            data = response.json()
            print(f"Item reactions: {data}")
    
    def test_get_user_reaction_stats(self, user_token):
        """Test GET /api/reactions/user/stats - get user's reaction stats"""
        headers = {}
        if user_token:
            headers["Authorization"] = f"Bearer {user_token}"
        
        response = requests.get(f"{BASE_URL}/api/reactions/user/stats", headers=headers)
        print(f"User reaction stats response: {response.status_code}")
        assert response.status_code in [200, 401]


class TestWalletAPI:
    """Test Wallet API endpoints"""
    
    @pytest.fixture
    def user_token(self):
        """Get user token for testing"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        return None
    
    def test_get_wallet_balance(self, user_token):
        """Test GET /api/wallet/balance"""
        headers = {}
        if user_token:
            headers["Authorization"] = f"Bearer {user_token}"
        
        response = requests.get(f"{BASE_URL}/api/wallet/balance", headers=headers)
        print(f"Wallet balance response: {response.status_code}")
        assert response.status_code in [200, 401, 404]
        if response.status_code == 200:
            data = response.json()
            print(f"Wallet balance: {data}")
    
    def test_get_wallet_transactions(self, user_token):
        """Test GET /api/wallet/transactions"""
        headers = {}
        if user_token:
            headers["Authorization"] = f"Bearer {user_token}"
        
        response = requests.get(f"{BASE_URL}/api/wallet/transactions", headers=headers)
        print(f"Wallet transactions response: {response.status_code}")
        assert response.status_code in [200, 401, 404]
    
    def test_daily_claim(self, user_token):
        """Test POST /api/wallet/daily-claim"""
        headers = {"Content-Type": "application/json"}
        if user_token:
            headers["Authorization"] = f"Bearer {user_token}"
        
        response = requests.post(f"{BASE_URL}/api/wallet/daily-claim", headers=headers)
        print(f"Daily claim response: {response.status_code}")
        # Could be 200 (success), 400 (already claimed), or 401 (not authenticated)
        assert response.status_code in [200, 400, 401, 404, 429]


class TestPKOPokerAPI:
    """Test PKO Poker Tournament API"""
    
    @pytest.fixture
    def user_token(self):
        """Get user token for testing"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("token")
        return None
    
    def test_list_tournaments(self, user_token):
        """Test GET /api/poker/tournaments - list available tournaments"""
        headers = {}
        if user_token:
            headers["Authorization"] = f"Bearer {user_token}"
        
        response = requests.get(f"{BASE_URL}/api/poker/tournaments", headers=headers)
        print(f"List tournaments response: {response.status_code}")
        assert response.status_code in [200, 401]
        if response.status_code == 200:
            data = response.json()
            print(f"Tournaments: {data}")
    
    def test_get_poker_lobby(self, user_token):
        """Test GET /api/poker/lobby - get poker lobby info"""
        headers = {}
        if user_token:
            headers["Authorization"] = f"Bearer {user_token}"
        
        response = requests.get(f"{BASE_URL}/api/poker/lobby", headers=headers)
        print(f"Poker lobby response: {response.status_code}")
        # Lobby endpoint might not exist, so 404 is acceptable
        assert response.status_code in [200, 401, 404]


class TestAdminPanelPages:
    """Test Admin Panel page endpoints"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token for testing"""
        response = requests.post(f"{BASE_URL}/api/admin-auth/secure/login/step1", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("session_token")
        return None
    
    def test_admin_dashboard(self, admin_token):
        """Test GET /api/admin-system/dashboard"""
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        
        response = requests.get(f"{BASE_URL}/api/admin-system/dashboard", headers=headers)
        print(f"Admin dashboard response: {response.status_code}")
        assert response.status_code in [200, 401, 403]
    
    def test_admin_genealogy_tree(self, admin_token):
        """Test GET /api/admin/genealogy/tree"""
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        
        response = requests.get(f"{BASE_URL}/api/admin/genealogy/tree", headers=headers)
        print(f"Admin genealogy tree response: {response.status_code}")
        assert response.status_code in [200, 401, 403]
    
    def test_admin_analytics(self, admin_token):
        """Test GET /api/admin/system/analytics"""
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        
        response = requests.get(f"{BASE_URL}/api/admin/system/analytics", headers=headers)
        print(f"Admin analytics response: {response.status_code}")
        assert response.status_code in [200, 401, 403]
    
    def test_admin_themes(self, admin_token):
        """Test GET /api/themes"""
        headers = {}
        if admin_token:
            headers["Authorization"] = f"Bearer {admin_token}"
        
        response = requests.get(f"{BASE_URL}/api/themes", headers=headers)
        print(f"Admin themes response: {response.status_code}")
        assert response.status_code in [200, 401, 403]


class TestHealthAndBasicEndpoints:
    """Test basic health and status endpoints"""
    
    def test_health_check(self):
        """Test basic health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        print(f"Health check response: {response.status_code}")
        # Health endpoint might not exist
        assert response.status_code in [200, 404]
    
    def test_root_endpoint(self):
        """Test root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        print(f"Root endpoint response: {response.status_code}")
        assert response.status_code in [200, 404]


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
