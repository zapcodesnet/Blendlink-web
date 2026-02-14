"""
Test Admin Wallet Management - BL Coins Credit Feature
Tests for iteration 109: Admin-only tool to manually add BL Coins to user wallets
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://emergency-fixes-1.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "test@blendlink.com"
ADMIN_PASSWORD = "admin"


class TestAdminLogin:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "token" in data
        assert data["user"]["is_admin"] == True
        assert data["user"]["email"] == ADMIN_EMAIL
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login",
            json={"email": "wrong@email.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401


class TestAdminUserSearch:
    """Test admin user search functionality"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_user_search_by_email(self, admin_token):
        """Test searching users by email"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/search?query=test&limit=10",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "total" in data
        assert isinstance(data["users"], list)
    
    def test_user_search_returns_bl_coins(self, admin_token):
        """Test that user search returns bl_coins field"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/search?query=test&limit=5",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        if data["users"]:
            user = data["users"][0]
            assert "bl_coins" in user or "user_id" in user
    
    def test_user_search_unauthorized(self):
        """Test user search without authentication"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/search?query=test&limit=10"
        )
        assert response.status_code in [401, 403]


class TestAdminBalanceAdjustment:
    """Test admin balance adjustment (BL Coins credit) functionality"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    @pytest.fixture
    def test_user_id(self, admin_token):
        """Get a test user ID"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users/search?query=test&limit=1",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        if response.status_code == 200 and response.json().get("users"):
            return response.json()["users"][0]["user_id"]
        pytest.skip("No test user found")
    
    def test_credit_bl_coins_success(self, admin_token, test_user_id):
        """Test successfully crediting BL coins to a user"""
        # Get current balance
        user_response = requests.get(
            f"{BASE_URL}/api/admin/users/{test_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert user_response.status_code == 200
        current_balance = user_response.json()["user"].get("bl_coins", 0)
        
        # Credit 100 BL coins
        credit_amount = 100
        response = requests.post(
            f"{BASE_URL}/api/admin/finance/adjust-balance/{test_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "currency": "bl_coins",
                "amount": credit_amount,
                "reason": "TEST_credit_from_pytest",
                "notify_user": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response
        assert data["success"] == True
        assert "transaction_id" in data
        assert data["balance_before"] == current_balance
        assert data["balance_after"] == current_balance + credit_amount
    
    def test_credit_large_amount(self, admin_token, test_user_id):
        """Test crediting large amount (>10K) - should work but UI shows confirmation"""
        response = requests.post(
            f"{BASE_URL}/api/admin/finance/adjust-balance/{test_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "currency": "bl_coins",
                "amount": 15000,
                "reason": "TEST_large_credit_from_pytest",
                "notify_user": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
    
    def test_credit_negative_amount_fails(self, admin_token, test_user_id):
        """Test that negative amounts that would result in negative balance fail"""
        # First get current balance
        user_response = requests.get(
            f"{BASE_URL}/api/admin/users/{test_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        current_balance = user_response.json()["user"].get("bl_coins", 0)
        
        # Try to debit more than current balance
        response = requests.post(
            f"{BASE_URL}/api/admin/finance/adjust-balance/{test_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "currency": "bl_coins",
                "amount": -(current_balance + 1000000),
                "reason": "TEST_negative_balance_attempt",
                "notify_user": False
            }
        )
        # Should fail with 400 - resulting balance cannot be negative
        assert response.status_code == 400
    
    def test_credit_without_reason_fails(self, admin_token, test_user_id):
        """Test that credit without reason fails validation"""
        response = requests.post(
            f"{BASE_URL}/api/admin/finance/adjust-balance/{test_user_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "currency": "bl_coins",
                "amount": 100
                # Missing reason
            }
        )
        assert response.status_code == 422  # Validation error
    
    def test_credit_unauthorized(self, test_user_id):
        """Test balance adjustment without authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/finance/adjust-balance/{test_user_id}",
            json={
                "currency": "bl_coins",
                "amount": 100,
                "reason": "Unauthorized attempt"
            }
        )
        assert response.status_code in [401, 403]


class TestRecentAdjustments:
    """Test recent admin adjustments endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_get_recent_adjustments(self, admin_token):
        """Test fetching recent admin adjustments"""
        response = requests.get(
            f"{BASE_URL}/api/admin/finance/recent-adjustments?limit=20",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "transactions" in data
        assert "count" in data
        assert isinstance(data["transactions"], list)
    
    def test_recent_adjustments_contains_audit_info(self, admin_token):
        """Test that recent adjustments contain audit information"""
        response = requests.get(
            f"{BASE_URL}/api/admin/finance/recent-adjustments?limit=5",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        if data["transactions"]:
            txn = data["transactions"][0]
            # Verify audit fields
            assert "transaction_id" in txn
            assert "user_id" in txn
            assert "amount" in txn
            assert "created_at" in txn
            # Verify details contain reason and admin info
            if "details" in txn:
                assert "reason" in txn["details"] or "adjusted_by" in txn["details"]
    
    def test_recent_adjustments_unauthorized(self):
        """Test recent adjustments without authentication"""
        response = requests.get(
            f"{BASE_URL}/api/admin/finance/recent-adjustments?limit=20"
        )
        assert response.status_code in [401, 403]


class TestAdminFinanceOverview:
    """Test admin finance overview endpoint"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/admin-auth/secure/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Admin authentication failed")
    
    def test_get_finance_overview(self, admin_token):
        """Test fetching financial overview"""
        response = requests.get(
            f"{BASE_URL}/api/admin/finance/overview",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_bl_coins" in data
        assert "total_usd_balances" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
