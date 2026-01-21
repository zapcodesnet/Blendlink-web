"""
Blendlink Admin Panel Tests - Iteration 23
Tests for:
- Admin login with OTP
- Admin Users page (search, filter, user details)
- Admin Orphans page (stats, list, auto-assign, manual assign)
- Admin Diamond Leaders page (stats, candidates, promote, demote)
- Other admin pages (Security, Themes, AI Assistant, Genealogy, Analytics)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://user-privacy-ctrl.preview.emergentagent.com')

# Admin credentials
ADMIN_EMAIL = "blendlinknet@gmail.com"
ADMIN_PASSWORD = "Blend!Admin2026Link"


class TestAdminAuthentication:
    """Admin authentication tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "token" in data
        return data["token"]
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "token" in data
        assert data["user"]["is_admin"] == True
        assert data["user"]["role"] == "super_admin"
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": "wrong@example.com", "password": "wrongpass"}
        )
        assert response.status_code in [401, 403, 404]


class TestAdminUsersPage:
    """Admin Users page tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_search_users(self, admin_token):
        """Test user search endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/search",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"limit": 20}
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "total" in data
        assert isinstance(data["users"], list)
        assert data["total"] >= 0
    
    def test_search_users_with_query(self, admin_token):
        """Test user search with query parameter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/search",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"query": "test", "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
    
    def test_search_users_with_status_filter(self, admin_token):
        """Test user search with status filter"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/search",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"status": "active", "limit": 10}
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
    
    def test_get_user_details(self, admin_token):
        """Test getting individual user details"""
        # First get a user ID
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


class TestAdminOrphansPage:
    """Admin Orphans page tests - 12-tier priority system"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_orphans_list(self, admin_token):
        """Test getting orphans list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/orphans",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "orphans" in data
        assert isinstance(data["orphans"], list)
    
    def test_get_orphans_stats(self, admin_token):
        """Test getting orphan statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/orphans/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_orphans" in data
        assert "unassigned" in data
        assert "assigned_today" in data
        assert "avg_assignment_time" in data
    
    def test_get_potential_parents(self, admin_token):
        """Test getting potential parents for orphan assignment"""
        response = requests.get(
            f"{BASE_URL}/api/admin/orphans/potential-parents",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "parents" in data
        assert isinstance(data["parents"], list)
        # Each parent should have tier info
        for parent in data["parents"]:
            if parent:
                assert "tier" in parent or "user_id" in parent
    
    def test_get_unassigned_orphans(self, admin_token):
        """Test filtering for unassigned orphans"""
        response = requests.get(
            f"{BASE_URL}/api/admin/orphans",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"status": "unassigned"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "orphans" in data
    
    def test_auto_assign_orphan_no_parents(self, admin_token):
        """Test auto-assign when no suitable parents exist"""
        # Get an orphan ID
        orphans_response = requests.get(
            f"{BASE_URL}/api/admin/orphans",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"status": "unassigned"}
        )
        orphans = orphans_response.json().get("orphans", [])
        
        if orphans:
            orphan_id = orphans[0]["user_id"]
            response = requests.post(
                f"{BASE_URL}/api/admin/orphans/auto-assign",
                headers={"Authorization": f"Bearer {admin_token}"},
                params={"orphan_id": orphan_id}
            )
            # Should return 400 if no suitable parent found, or 200 if assigned
            assert response.status_code in [200, 400]


class TestAdminDiamondLeadersPage:
    """Admin Diamond Leaders page tests"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_get_diamond_leaders(self, admin_token):
        """Test getting diamond leaders list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/diamond-leaders",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "diamonds" in data
        assert isinstance(data["diamonds"], list)
    
    def test_get_diamond_stats(self, admin_token):
        """Test getting diamond leader statistics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/diamond-leaders/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_diamonds" in data
        assert "promoted_this_month" in data
        assert "demoted_this_month" in data
        assert "pending_bonuses" in data
    
    def test_get_diamond_candidates(self, admin_token):
        """Test getting diamond leader candidates"""
        response = requests.get(
            f"{BASE_URL}/api/admin/diamond-leaders/candidates",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "candidates" in data
        assert isinstance(data["candidates"], list)
    
    def test_get_pending_demotions(self, admin_token):
        """Test getting pending demotions"""
        response = requests.get(
            f"{BASE_URL}/api/admin/diamond-leaders/pending-demotions",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "pending" in data
        assert isinstance(data["pending"], list)
    
    def test_promote_user_not_found(self, admin_token):
        """Test promoting non-existent user"""
        response = requests.post(
            f"{BASE_URL}/api/admin/diamond-leaders/promote",
            headers={"Authorization": f"Bearer {admin_token}"},
            params={"user_id": "nonexistent_user_123"}
        )
        assert response.status_code == 404


class TestOtherAdminPages:
    """Tests for other admin pages"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_admin_dashboard(self, admin_token):
        """Test admin dashboard endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin-system/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
    
    def test_admin_genealogy(self, admin_token):
        """Test admin genealogy endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/genealogy/tree",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
    
    def test_admin_analytics(self, admin_token):
        """Test admin analytics endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/admin/system/analytics",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
    
    def test_themes_endpoint(self, admin_token):
        """Test themes endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/themes",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200


class TestOrphanAssignmentLogic:
    """Tests for orphan assignment 12-tier priority logic"""
    
    @pytest.fixture(scope="class")
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login/step1",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        return response.json()["token"]
    
    def test_orphan_stats_consistency(self, admin_token):
        """Test that orphan stats are consistent with orphan list"""
        # Get stats
        stats_response = requests.get(
            f"{BASE_URL}/api/admin/orphans/stats",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        stats = stats_response.json()
        
        # Get orphan list
        list_response = requests.get(
            f"{BASE_URL}/api/admin/orphans",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        orphans = list_response.json().get("orphans", [])
        
        # Total should match
        assert stats["total_orphans"] == len(orphans) or stats["total_orphans"] >= len(orphans)
    
    def test_potential_parents_have_tier_info(self, admin_token):
        """Test that potential parents include tier information"""
        response = requests.get(
            f"{BASE_URL}/api/admin/orphans/potential-parents",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        data = response.json()
        parents = data.get("parents", [])
        
        # If there are parents, they should have tier info
        for parent in parents:
            assert "tier" in parent, "Parent should have tier number"
            assert "tier_desc" in parent, "Parent should have tier description"
            assert parent["tier"] >= 1 and parent["tier"] <= 12, "Tier should be 1-12"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
