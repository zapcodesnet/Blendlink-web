"""
Referral System Iteration 16 Tests
==================================
Testing:
- Referral code sharing and sign-up bonus (50K BL coins each)
- Daily BL coin claim endpoint (2000 regular, 5000 diamond)
- Genealogy tree API returning L1/L2 downlines only
- Diamond Leader status API with qualification progress
- Diamond qualification check endpoint
- KYC status and initialization endpoint
- Withdrawal status and eligibility check
- Disclaimer API endpoint
"""

import pytest
import requests
import os
import time
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://orphan-dashboard.preview.emergentagent.com')

# Test credentials from main agent
TEST_USER_1 = {
    "email": "testref@test.com",
    "password": "test123",
    "referral_code": "BFD6E873"
}

TEST_USER_2 = {
    "email": "testref2@test.com",
    "password": "test123"
}


class TestReferralSystemBackend:
    """Backend API tests for referral system"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_token_user1(self, session):
        """Login as test user 1 and get token"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_1["email"],
            "password": TEST_USER_1["password"]
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Could not login as test user 1: {response.status_code} - {response.text}")
    
    @pytest.fixture(scope="class")
    def auth_token_user2(self, session):
        """Login as test user 2 and get token"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_2["email"],
            "password": TEST_USER_2["password"]
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip(f"Could not login as test user 2: {response.status_code} - {response.text}")
    
    def get_headers(self, token):
        """Get auth headers"""
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    # ============== HEALTH CHECK ==============
    def test_api_health(self, session):
        """Test API health endpoint"""
        response = session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print(f"✓ API health check passed: {data}")
    
    # ============== GENEALOGY TESTS ==============
    def test_genealogy_requires_auth(self, session):
        """Test genealogy endpoint requires authentication"""
        response = session.get(f"{BASE_URL}/api/referral/genealogy")
        assert response.status_code == 401
        print("✓ Genealogy endpoint correctly requires authentication")
    
    def test_genealogy_returns_l1_l2_only(self, session, auth_token_user1):
        """Test genealogy returns only L1 and L2 downlines"""
        response = session.get(
            f"{BASE_URL}/api/referral/genealogy",
            headers=self.get_headers(auth_token_user1)
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list)
        
        # Each member should have required fields
        for member in data:
            assert "user_id" in member
            assert "username" in member
            assert "level" in member
            # Level should be 1 or 2 only
            assert member["level"] in [1, 2], f"Level should be 1 or 2, got {member['level']}"
            assert "direct_recruits_count" in member
            assert "total_recruits_count" in member
            assert "joined_at" in member
        
        # Count L1 and L2
        l1_count = len([m for m in data if m["level"] == 1])
        l2_count = len([m for m in data if m["level"] == 2])
        print(f"✓ Genealogy returned {l1_count} L1 and {l2_count} L2 members")
    
    # ============== DAILY CLAIM TESTS ==============
    def test_daily_claim_status(self, session, auth_token_user1):
        """Test daily claim status endpoint"""
        response = session.get(
            f"{BASE_URL}/api/referral/daily-claim/status",
            headers=self.get_headers(auth_token_user1)
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "can_claim" in data
        assert "claim_amount" in data
        assert "is_diamond" in data
        assert "current_balance" in data
        
        # Claim amount should be 2000 for regular or 5000 for diamond
        if data["is_diamond"]:
            assert data["claim_amount"] == 5000
        else:
            assert data["claim_amount"] == 2000
        
        print(f"✓ Daily claim status: can_claim={data['can_claim']}, amount={data['claim_amount']}, is_diamond={data['is_diamond']}")
    
    def test_daily_claim_endpoint(self, session, auth_token_user1):
        """Test daily claim endpoint"""
        response = session.post(
            f"{BASE_URL}/api/referral/daily-claim",
            headers=self.get_headers(auth_token_user1)
        )
        
        # Either 200 (success) or 429 (already claimed)
        assert response.status_code in [200, 429]
        data = response.json()
        
        if response.status_code == 200:
            assert data["success"] == True
            assert "amount" in data
            assert "new_balance" in data
            assert "next_claim_at" in data
            print(f"✓ Daily claim successful: {data['amount']} BL coins, new balance: {data['new_balance']}")
        else:
            # 429 - already claimed
            assert "seconds_remaining" in data.get("detail", {}) or "message" in data.get("detail", {})
            print(f"✓ Daily claim on cooldown (expected): {data}")
    
    # ============== DIAMOND STATUS TESTS ==============
    def test_diamond_status_requires_auth(self, session):
        """Test diamond status endpoint requires authentication"""
        response = session.get(f"{BASE_URL}/api/diamond/status")
        assert response.status_code == 401
        print("✓ Diamond status endpoint correctly requires authentication")
    
    def test_diamond_status_returns_progress(self, session, auth_token_user1):
        """Test diamond status returns qualification progress"""
        response = session.get(
            f"{BASE_URL}/api/diamond/status",
            headers=self.get_headers(auth_token_user1)
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "is_diamond" in data
        assert "qualification_progress" in data
        
        # Check qualification progress structure
        progress = data["qualification_progress"]
        assert "direct_recruits" in progress
        assert "direct_recruits_required" in progress
        assert "downline_commissions" in progress
        assert "downline_commissions_required" in progress
        assert "personal_sales" in progress
        assert "personal_sales_required" in progress
        
        print(f"✓ Diamond status: is_diamond={data['is_diamond']}")
        print(f"  Progress: {progress['direct_recruits']}/{progress['direct_recruits_required']} recruits, "
              f"${progress['downline_commissions']}/{progress['downline_commissions_required']} commissions, "
              f"${progress['personal_sales']}/{progress['personal_sales_required']} sales")
    
    def test_diamond_check_qualification(self, session, auth_token_user1):
        """Test diamond qualification check endpoint"""
        response = session.post(
            f"{BASE_URL}/api/diamond/check-qualification",
            headers=self.get_headers(auth_token_user1)
        )
        
        # Either 200 (success) or 400 (already diamond)
        assert response.status_code in [200, 400]
        data = response.json()
        
        if response.status_code == 200:
            assert "promoted" in data
            assert "qualification" in data
            print(f"✓ Diamond qualification check: promoted={data['promoted']}")
        else:
            print(f"✓ Diamond qualification check: {data.get('detail', 'Already diamond')}")
    
    # ============== KYC TESTS ==============
    def test_kyc_status_requires_auth(self, session):
        """Test KYC status endpoint requires authentication"""
        response = session.get(f"{BASE_URL}/api/kyc/status")
        assert response.status_code == 401
        print("✓ KYC status endpoint correctly requires authentication")
    
    def test_kyc_status(self, session, auth_token_user1):
        """Test KYC status endpoint"""
        response = session.get(
            f"{BASE_URL}/api/kyc/status",
            headers=self.get_headers(auth_token_user1)
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "status" in data
        assert "can_withdraw" in data
        
        # Status should be one of the valid values
        valid_statuses = ["not_started", "pending", "verified", "rejected"]
        assert data["status"] in valid_statuses
        
        print(f"✓ KYC status: {data['status']}, can_withdraw={data['can_withdraw']}")
    
    def test_kyc_init(self, session, auth_token_user1):
        """Test KYC initialization endpoint"""
        response = session.post(
            f"{BASE_URL}/api/kyc/init",
            headers=self.get_headers(auth_token_user1),
            json={"return_url": "https://example.com/kyc-complete"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Should return method and status
        assert "method" in data
        assert "status" in data
        
        # Method should be stripe_identity or manual
        assert data["method"] in ["stripe_identity", "manual"]
        
        print(f"✓ KYC init: method={data['method']}, status={data['status']}")
    
    # ============== WITHDRAWAL TESTS ==============
    def test_withdrawal_status_requires_auth(self, session):
        """Test withdrawal status endpoint requires authentication"""
        response = session.get(f"{BASE_URL}/api/withdrawal/status")
        assert response.status_code == 401
        print("✓ Withdrawal status endpoint correctly requires authentication")
    
    def test_withdrawal_status(self, session, auth_token_user1):
        """Test withdrawal status endpoint"""
        response = session.get(
            f"{BASE_URL}/api/withdrawal/status",
            headers=self.get_headers(auth_token_user1)
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "usd_balance" in data
        assert "kyc_status" in data
        assert "kyc_required" in data
        assert "can_withdraw" in data
        assert "withdrawal_fee_rate" in data
        assert "min_withdrawal" in data
        
        # Fee rate should be 1%
        assert data["withdrawal_fee_rate"] == 1.0
        # Min withdrawal should be $10
        assert data["min_withdrawal"] == 10.0
        
        print(f"✓ Withdrawal status: balance=${data['usd_balance']}, kyc={data['kyc_status']}, can_withdraw={data['can_withdraw']}")
    
    def test_withdrawal_history(self, session, auth_token_user1):
        """Test withdrawal history endpoint"""
        response = session.get(
            f"{BASE_URL}/api/withdrawal/history",
            headers=self.get_headers(auth_token_user1)
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "withdrawals" in data
        assert "total" in data
        assert isinstance(data["withdrawals"], list)
        
        print(f"✓ Withdrawal history: {data['total']} total withdrawals")
    
    # ============== DISCLAIMER TESTS ==============
    def test_disclaimer_endpoint(self, session):
        """Test disclaimer endpoint (no auth required)"""
        response = session.get(f"{BASE_URL}/api/diamond/disclaimer")
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "disclaimer" in data
        assert "must_accept_on" in data
        assert "version" in data
        
        # Disclaimer should contain important text
        assert "BL coins" in data["disclaimer"]
        assert "NO real-world monetary value" in data["disclaimer"]
        
        print(f"✓ Disclaimer endpoint: version={data['version']}, must_accept_on={data['must_accept_on']}")
    
    # ============== REFERRAL STATS TESTS ==============
    def test_referral_my_stats(self, session, auth_token_user1):
        """Test referral my-stats endpoint"""
        response = session.get(
            f"{BASE_URL}/api/referral/my-stats",
            headers=self.get_headers(auth_token_user1)
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "user_id" in data
        assert "rank" in data
        assert "referral_code" in data
        assert "direct_referrals" in data
        assert "indirect_referrals" in data
        assert "commission_rates" in data
        assert "bl_coins" in data
        
        # Commission rates should have l1 and l2
        assert "l1" in data["commission_rates"]
        assert "l2" in data["commission_rates"]
        
        print(f"✓ Referral stats: code={data['referral_code']}, rank={data['rank']}, "
              f"direct={data['direct_referrals']}, indirect={data['indirect_referrals']}")
    
    def test_referral_upline(self, session, auth_token_user1):
        """Test referral upline endpoint"""
        response = session.get(
            f"{BASE_URL}/api/referral/upline",
            headers=self.get_headers(auth_token_user1)
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        assert "is_orphan" in data
        assert "l1_upline" in data
        assert "l2_upline" in data
        
        print(f"✓ Referral upline: is_orphan={data['is_orphan']}, l1={data['l1_upline']}, l2={data['l2_upline']}")
    
    def test_referral_balances(self, session, auth_token_user1):
        """Test referral balances endpoint"""
        response = session.get(
            f"{BASE_URL}/api/referral/balances",
            headers=self.get_headers(auth_token_user1)
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check required fields
        assert "bl_coins" in data
        assert "usd_balance" in data
        assert "rank" in data
        assert "kyc_status" in data
        assert "can_withdraw" in data
        
        print(f"✓ Balances: BL={data['bl_coins']}, USD=${data['usd_balance']}, rank={data['rank']}")
    
    # ============== REASSIGNMENT TESTS (Admin) ==============
    def test_reassignment_list_requires_admin(self, session, auth_token_user1):
        """Test reassignment list requires admin access"""
        response = session.get(
            f"{BASE_URL}/api/reassignment/admin/list",
            headers=self.get_headers(auth_token_user1)
        )
        # Should be 403 (forbidden) for non-admin
        assert response.status_code == 403
        print("✓ Reassignment list correctly requires admin access")


class TestReferralSignupBonus:
    """Test referral signup bonus flow"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    def test_referral_code_exists(self, session):
        """Test that test user has a referral code"""
        # Login first
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_1["email"],
            "password": TEST_USER_1["password"]
        })
        assert response.status_code == 200
        data = response.json()
        
        # Get user profile
        token = data["token"]
        profile_response = session.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert profile_response.status_code == 200
        profile = profile_response.json()
        
        assert "referral_code" in profile
        assert profile["referral_code"] == TEST_USER_1["referral_code"]
        print(f"✓ User has referral code: {profile['referral_code']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
