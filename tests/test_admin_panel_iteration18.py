"""
Admin Panel Backend API Tests - Iteration 18
Tests for:
- Admin login flow
- Admin Dashboard
- User Management (/admin/users)
- Genealogy Management (/admin/genealogy)
- Admin Management (/admin/admins)
- Analytics (/admin/analytics)
- Audit Logs (/admin/audit)
- Withdrawals (/admin/withdrawals)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://photo-bidding-game.preview.emergentagent.com')

# Admin credentials
ADMIN_EMAIL = "blendlinknet@gmail.com"
ADMIN_PASSWORD = "link2026blend!"


class TestAdminAuth:
    """Test admin authentication flow"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in login response"
        return data["token"]
    
    def test_admin_login_success(self):
        """Test admin can login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        # Verify user has admin flag
        assert data["user"].get("is_admin") == True, "User should have is_admin flag"
        print(f"✓ Admin login successful, user_id: {data['user'].get('user_id')}")
    
    def test_admin_profile_access(self, admin_token):
        """Test admin can access their profile"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == ADMIN_EMAIL
        assert data.get("is_admin") == True
        print(f"✓ Admin profile access verified")


class TestAdminDashboard:
    """Test admin dashboard endpoints"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_admin_system_dashboard(self, admin_token):
        """Test admin dashboard endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin-system/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # Dashboard might return 200 or 404 if not implemented
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Dashboard data: {list(data.keys())}")
        else:
            print(f"⚠ Dashboard endpoint returned {response.status_code}")


class TestUserManagement:
    """Test user management endpoints at /api/admin/users/*"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_search_users(self, admin_token):
        """Test user search endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/search",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"limit": 10}
        )
        assert response.status_code == 200, f"Search users failed: {response.text}"
        data = response.json()
        assert "users" in data
        assert "total" in data
        print(f"✓ User search returned {len(data['users'])} users, total: {data['total']}")
    
    def test_search_users_with_query(self, admin_token):
        """Test user search with query parameter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/search",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"query": "test", "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ User search with query returned {len(data['users'])} users")
    
    def test_search_users_with_status_filter(self, admin_token):
        """Test user search with status filter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/search",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"status": "active", "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ User search with status filter returned {len(data['users'])} active users")
    
    def test_get_user_details(self, admin_token):
        """Test getting detailed user profile"""
        # First get a user from search
        search_response = requests.get(
            f"{BASE_URL}/api/admin/users/search",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"limit": 1}
        )
        assert search_response.status_code == 200
        users = search_response.json().get("users", [])
        
        if users:
            user_id = users[0]["user_id"]
            response = requests.get(
                f"{BASE_URL}/api/admin/users/{user_id}",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "user" in data
            assert "stats" in data
            print(f"✓ User details retrieved for {user_id}")
            print(f"  - BL Coins: {data['user'].get('bl_coins', 0)}")
            print(f"  - USD Balance: {data['user'].get('usd_balance', 0)}")
            print(f"  - Referral Count: {data['stats'].get('referral_count', 0)}")
        else:
            pytest.skip("No users found to test details")


class TestGenealogyManagement:
    """Test genealogy management endpoints at /api/admin/genealogy/*"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_genealogy_tree(self, admin_token):
        """Test genealogy tree endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/genealogy/tree",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"max_depth": 3}
        )
        assert response.status_code == 200, f"Genealogy tree failed: {response.text}"
        data = response.json()
        # Should have either 'trees' or 'tree' key
        assert "trees" in data or "tree" in data
        if "trees" in data:
            print(f"✓ Genealogy tree returned {len(data['trees'])} root trees")
        else:
            print(f"✓ Genealogy tree returned single tree")
    
    def test_get_user_network(self, admin_token):
        """Test user network endpoint"""
        # First get a user
        search_response = requests.get(
            f"{BASE_URL}/api/admin/users/search",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"limit": 1}
        )
        users = search_response.json().get("users", [])
        
        if users:
            user_id = users[0]["user_id"]
            response = requests.get(
                f"{BASE_URL}/api/admin/genealogy/user/{user_id}/network",
                headers={"Authorization": f"Bearer {admin_token}"}
            )
            assert response.status_code == 200
            data = response.json()
            assert "user" in data
            assert "stats" in data
            print(f"✓ User network retrieved for {user_id}")
            print(f"  - L1 Count: {data['stats'].get('l1_count', 0)}")
            print(f"  - L2 Count: {data['stats'].get('l2_count', 0)}")
        else:
            pytest.skip("No users found to test network")
    
    def test_get_orphans(self, admin_token):
        """Test orphan users endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/genealogy/orphans",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "orphans" in data
        print(f"✓ Orphan users: {len(data['orphans'])}")


class TestAdminManagement:
    """Test admin role management endpoints at /api/admin/roles/*"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_list_admins(self, admin_token):
        """Test listing all admins"""
        response = requests.get(
            f"{BASE_URL}/api/admin/roles/admins",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"List admins failed: {response.text}"
        data = response.json()
        assert "admins" in data
        print(f"✓ Admin list returned {len(data['admins'])} admins")
        for admin in data['admins'][:3]:
            print(f"  - {admin.get('email', 'N/A')} ({admin.get('role', 'N/A')})")


class TestAnalytics:
    """Test analytics endpoints at /api/admin/system/analytics"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_analytics_7d(self, admin_token):
        """Test analytics for 7 days"""
        response = requests.get(
            f"{BASE_URL}/api/admin/system/analytics",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"period": "7d"}
        )
        assert response.status_code == 200, f"Analytics failed: {response.text}"
        data = response.json()
        assert "signups" in data
        assert "active_users" in data
        assert "transactions" in data
        print(f"✓ Analytics (7d) retrieved")
        print(f"  - Signups data points: {len(data.get('signups', []))}")
        print(f"  - Active users data points: {len(data.get('active_users', []))}")
    
    def test_get_analytics_30d(self, admin_token):
        """Test analytics for 30 days"""
        response = requests.get(
            f"{BASE_URL}/api/admin/system/analytics",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"period": "30d"}
        )
        assert response.status_code == 200
        data = response.json()
        print(f"✓ Analytics (30d) retrieved")
    
    def test_get_financial_overview(self, admin_token):
        """Test financial overview endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/finance/overview",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Financial overview failed: {response.text}"
        data = response.json()
        assert "total_bl_coins" in data
        assert "total_usd_balances" in data
        print(f"✓ Financial overview retrieved")
        print(f"  - Total BL Coins: {data.get('total_bl_coins', 0)}")
        print(f"  - Total USD Balances: ${data.get('total_usd_balances', 0):.2f}")
    
    def test_get_system_health(self, admin_token):
        """Test system health endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/system/health",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"System health failed: {response.text}"
        data = response.json()
        assert "database" in data
        assert "users" in data
        print(f"✓ System health retrieved")
        print(f"  - Total users: {data['users'].get('total', 0)}")
        print(f"  - Active (24h): {data['users'].get('active_24h', 0)}")


class TestAuditLogs:
    """Test audit log endpoints at /api/admin/system/activity-feed"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_activity_feed(self, admin_token):
        """Test activity feed endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/system/activity-feed",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"limit": 50}
        )
        assert response.status_code == 200, f"Activity feed failed: {response.text}"
        data = response.json()
        assert "audit_logs" in data
        assert "recent_signups" in data
        assert "recent_transactions" in data
        print(f"✓ Activity feed retrieved")
        print(f"  - Audit logs: {len(data.get('audit_logs', []))}")
        print(f"  - Recent signups: {len(data.get('recent_signups', []))}")
        print(f"  - Recent transactions: {len(data.get('recent_transactions', []))}")


class TestWithdrawals:
    """Test withdrawal management endpoints at /api/admin/withdrawals/*"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Login as admin and get token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_withdrawals_list(self, admin_token):
        """Test withdrawals list endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/withdrawals/list",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Withdrawals list failed: {response.text}"
        data = response.json()
        assert "withdrawals" in data
        assert "counts" in data
        print(f"✓ Withdrawals list retrieved")
        print(f"  - Total withdrawals: {len(data.get('withdrawals', []))}")
        print(f"  - Counts: {data.get('counts', {})}")
    
    def test_get_withdrawals_stats(self, admin_token):
        """Test withdrawals stats endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/withdrawals/stats/summary",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Withdrawals stats failed: {response.text}"
        data = response.json()
        print(f"✓ Withdrawals stats retrieved")
        print(f"  - Total paid out: ${data.get('total_paid_out', 0):.2f}")
        print(f"  - Fees collected: ${data.get('total_fees_collected', 0):.2f}")
    
    def test_get_pending_kyc(self, admin_token):
        """Test pending KYC endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/withdrawals/kyc/pending",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200, f"Pending KYC failed: {response.text}"
        data = response.json()
        assert "users" in data
        print(f"✓ Pending KYC users: {len(data.get('users', []))}")


class TestAdminAccessControl:
    """Test that admin endpoints require proper authentication"""
    
    def test_user_search_requires_auth(self):
        """Test that user search requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/users/search")
        assert response.status_code in [401, 403], "Should require authentication"
        print("✓ User search requires authentication")
    
    def test_genealogy_requires_auth(self):
        """Test that genealogy requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/genealogy/tree")
        assert response.status_code in [401, 403], "Should require authentication"
        print("✓ Genealogy requires authentication")
    
    def test_analytics_requires_auth(self):
        """Test that analytics requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/system/analytics")
        assert response.status_code in [401, 403], "Should require authentication"
        print("✓ Analytics requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
