"""
Test suite for Blendlink Referral System
- 2-Level Unilevel Compensation Plan (3% L1, 1% L2, 4% platform)
- Diamond Leader Status program
- Orphan Assignment System
- Withdrawal with ID Verification
- Admin Dashboard
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://referral-system-22.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "Test123456"


class TestReferralSystemAuth:
    """Test authentication for referral system"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        return data["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestReferralNetwork(TestReferralSystemAuth):
    """Test referral network endpoints"""
    
    def test_get_my_network(self, auth_headers):
        """GET /api/referral-system/my-network - Get user's referral network"""
        response = requests.get(
            f"{BASE_URL}/api/referral-system/my-network",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "user_id" in data
        assert "referral_code" in data
        assert "level_1_count" in data
        assert "level_2_count" in data
        assert "total_network_size" in data
        assert "total_commissions_earned" in data
        assert isinstance(data["level_1_count"], int)
        assert isinstance(data["level_2_count"], int)
        print(f"✓ Network: L1={data['level_1_count']}, L2={data['level_2_count']}, Total={data['total_network_size']}")
    
    def test_get_referral_stats(self, auth_headers):
        """GET /api/referral-system/stats - Get detailed referral statistics"""
        response = requests.get(
            f"{BASE_URL}/api/referral-system/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "level_1" in data
        assert "level_2" in data
        assert "total_earned" in data["level_1"]
        assert "transaction_count" in data["level_1"]
        assert "rate" in data["level_1"]
        print(f"✓ Stats: L1 earned=${data['level_1']['total_earned']}, L2 earned=${data['level_2']['total_earned']}")
    
    def test_network_unauthorized(self):
        """Test unauthorized access to network endpoint"""
        response = requests.get(f"{BASE_URL}/api/referral-system/my-network")
        assert response.status_code == 401, "Should require authentication"
        print("✓ Unauthorized access correctly rejected")


class TestCommissions(TestReferralSystemAuth):
    """Test commission endpoints"""
    
    def test_get_my_commissions(self, auth_headers):
        """GET /api/commissions/my-commissions - Get commission history"""
        response = requests.get(
            f"{BASE_URL}/api/commissions/my-commissions",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "commissions" in data
        assert "totals" in data
        assert isinstance(data["commissions"], list)
        assert "pending" in data["totals"]
        assert "paid" in data["totals"]
        assert "total" in data["totals"]
        print(f"✓ Commissions: pending=${data['totals']['pending']}, paid=${data['totals']['paid']}, total=${data['totals']['total']}")
    
    def test_get_pending_commissions(self, auth_headers):
        """GET /api/commissions/pending - Get pending commissions"""
        response = requests.get(
            f"{BASE_URL}/api/commissions/pending",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "commissions" in data
        assert "total_pending" in data
        assert "count" in data
        print(f"✓ Pending commissions: count={data['count']}, total=${data['total_pending']}")


class TestDiamondLeader(TestReferralSystemAuth):
    """Test Diamond Leader status endpoints"""
    
    def test_get_diamond_status(self, auth_headers):
        """GET /api/diamond/status - Get Diamond Leader status and progress"""
        response = requests.get(
            f"{BASE_URL}/api/diamond/status",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "user_id" in data
        assert "direct_recruits_count" in data
        assert "direct_recruits_required" in data
        assert "downline_commissions" in data
        assert "downline_commissions_required" in data
        assert "personal_sales" in data
        assert "personal_sales_required" in data
        assert "is_qualified" in data
        assert "progress" in data
        assert "overall_progress" in data
        assert "benefits" in data
        
        # Validate requirements
        assert data["direct_recruits_required"] == 100
        assert data["downline_commissions_required"] == 1000.0
        assert data["personal_sales_required"] == 1000.0
        
        # Validate benefits
        assert data["benefits"]["bonus"] == 100
        assert "4" in data["benefits"]["level_1_rate"]  # 4% or 4.0%
        assert "2" in data["benefits"]["level_2_rate"]  # 2% or 2.0%
        
        print(f"✓ Diamond status: qualified={data['is_qualified']}, progress={data['overall_progress']:.1f}%")
    
    def test_check_diamond_qualification(self, auth_headers):
        """POST /api/diamond/check-qualification - Check qualification"""
        response = requests.post(
            f"{BASE_URL}/api/diamond/check-qualification",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "qualified" in data
        assert "message" in data
        print(f"✓ Diamond qualification check: qualified={data['qualified']}")


class TestWithdrawals(TestReferralSystemAuth):
    """Test withdrawal endpoints"""
    
    def test_check_withdrawal_eligibility(self, auth_headers):
        """GET /api/withdrawals/eligibility - Check withdrawal eligibility"""
        response = requests.get(
            f"{BASE_URL}/api/withdrawals/eligibility",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "is_eligible" in data
        assert "id_verified" in data
        assert "verification_status" in data
        assert "available_balance" in data
        assert "pending_earnings" in data
        assert "withdrawal_fee" in data
        assert "min_withdrawal" in data
        
        # Validate values
        assert "1" in data["withdrawal_fee"]  # 1% or 1.0%
        assert data["min_withdrawal"] == 10.0
        
        print(f"✓ Withdrawal eligibility: eligible={data['is_eligible']}, balance=${data['available_balance']}")
    
    def test_get_withdrawal_history(self, auth_headers):
        """GET /api/withdrawals/history - Get withdrawal history"""
        response = requests.get(
            f"{BASE_URL}/api/withdrawals/history",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list)
        print(f"✓ Withdrawal history: {len(data)} records")
    
    def test_get_id_verification_status(self, auth_headers):
        """GET /api/withdrawals/verify-id/status - Get ID verification status"""
        response = requests.get(
            f"{BASE_URL}/api/withdrawals/verify-id/status",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "status" in data
        assert "verified" in data
        print(f"✓ ID verification status: {data['status']}, verified={data['verified']}")


class TestOrphanQueue(TestReferralSystemAuth):
    """Test orphan assignment queue endpoints"""
    
    def test_get_orphan_queue_status(self, auth_headers):
        """GET /api/orphans/queue-status - Check queue status"""
        response = requests.get(
            f"{BASE_URL}/api/orphans/queue-status",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "in_queue" in data
        assert "is_eligible" in data
        print(f"✓ Orphan queue status: in_queue={data['in_queue']}, eligible={data['is_eligible']}")


class TestAdminEndpoints(TestReferralSystemAuth):
    """Test admin endpoints (may fail if user is not admin)"""
    
    def test_admin_dashboard_requires_admin(self, auth_headers):
        """GET /api/admin/dashboard - Should require admin access"""
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers=auth_headers
        )
        # Either 200 (if admin) or 403 (if not admin)
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "total_users" in data
            assert "total_commissions_paid" in data
            assert "platform_earnings" in data
            assert "pending_withdrawals" in data
            assert "diamond_leaders" in data
            print(f"✓ Admin dashboard: users={data['total_users']}, diamond_leaders={data['diamond_leaders']}")
        else:
            print("✓ Admin dashboard correctly requires admin access (403)")
    
    def test_admin_pending_withdrawals(self, auth_headers):
        """GET /api/admin/withdrawals/pending - Get pending withdrawals"""
        response = requests.get(
            f"{BASE_URL}/api/admin/withdrawals/pending",
            headers=auth_headers
        )
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            print(f"✓ Admin pending withdrawals: {len(data)} pending")
        else:
            print("✓ Admin pending withdrawals correctly requires admin access (403)")
    
    def test_admin_analytics(self, auth_headers):
        """GET /api/admin/analytics - Get platform analytics"""
        response = requests.get(
            f"{BASE_URL}/api/admin/analytics",
            headers=auth_headers
        )
        assert response.status_code in [200, 403], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            assert "users" in data
            assert "commissions" in data
            assert "sales" in data
            print(f"✓ Admin analytics: new_users_30d={data['users']['new_30d']}")
        else:
            print("✓ Admin analytics correctly requires admin access (403)")


class TestHealthAndBasicEndpoints:
    """Test basic health and API endpoints"""
    
    def test_health_check(self):
        """GET /api/health - Health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✓ Health check passed")
    
    def test_root_endpoint(self):
        """GET /api/ - Root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print(f"✓ Root endpoint: {data['message']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
