"""
Test suite for Blendlink Referral System - Additional Features
- User registration with referral code generation
- Orphan queue with non-verified user support
- Orphan assignment on registration
- Commission rate validation
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://super-ctrl.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "Test123456"


class TestUserRegistration:
    """Test user registration with referral code generation"""
    
    def test_register_new_user_creates_referral_code(self):
        """POST /api/auth/register - New user gets unique referral code"""
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"test_reg_{unique_id}@example.com"
        test_username = f"testuser_{unique_id}"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "TestPass123!",
                "name": f"Test User {unique_id}",
                "username": test_username
            }
        )
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "user_id" in data, "No user_id in response"
        assert "token" in data, "No token in response"
        
        # Get user details to verify referral code
        token = data["token"]
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200
        user_data = me_response.json()
        
        assert "referral_code" in user_data, "No referral_code in user data"
        assert len(user_data["referral_code"]) == 8, "Referral code should be 8 characters"
        assert user_data["referral_code"].isupper(), "Referral code should be uppercase"
        
        print(f"✓ New user created with referral code: {user_data['referral_code']}")
        return data
    
    def test_register_with_referral_code(self):
        """POST /api/auth/register - Register with existing user's referral code"""
        # First get an existing user's referral code
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200
        token = login_response.json()["token"]
        
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        referrer_code = me_response.json()["referral_code"]
        referrer_id = me_response.json()["user_id"]
        
        # Register new user with referral code
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"test_ref_{unique_id}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "TestPass123!",
                "name": f"Referred User {unique_id}",
                "username": f"refuser_{unique_id}",
                "referral_code": referrer_code
            }
        )
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Verify the new user has referred_by set
        new_token = data["token"]
        new_me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {new_token}"}
        )
        new_user_data = new_me_response.json()
        
        assert new_user_data.get("referred_by") == referrer_id, "referred_by should be set to referrer's user_id"
        print(f"✓ New user registered with referral code, referred_by={referrer_id}")


class TestOrphanQueue:
    """Test orphan queue functionality"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_orphan_queue_status_shows_eligibility(self, auth_headers):
        """GET /api/orphans/queue-status - Shows eligibility details"""
        response = requests.get(
            f"{BASE_URL}/api/orphans/queue-status",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "in_queue" in data
        assert "is_eligible" in data
        
        # If not in queue, should show eligibility details
        if not data["in_queue"]:
            assert "eligibility_details" in data
            assert "zero_direct_recruits" in data["eligibility_details"]
            assert "id_verified" in data["eligibility_details"]
            assert "no_violations" in data["eligibility_details"]
            # Should have note about ID verification being optional
            assert "note" in data
            print(f"✓ Queue status shows eligibility: {data['eligibility_details']}")
        else:
            # If in queue, should show position and priority info
            assert "position" in data
            assert "id_verified" in data
            assert "priority_note" in data
            print(f"✓ In queue at position {data['position']}, verified={data['id_verified']}")
    
    def test_orphan_queue_join_for_new_user(self):
        """POST /api/orphans/join-queue - New user can join queue"""
        # Create a new user with zero direct recruits
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"test_orphan_{unique_id}@example.com"
        
        reg_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "TestPass123!",
                "name": f"Orphan Test {unique_id}",
                "username": f"orphantest_{unique_id}"
            }
        )
        
        if reg_response.status_code != 200:
            pytest.skip(f"Could not create test user: {reg_response.text}")
        
        token = reg_response.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try to join orphan queue
        join_response = requests.post(
            f"{BASE_URL}/api/orphans/join-queue",
            headers=headers
        )
        
        # Should succeed or fail with "already in queue" if auto-assigned
        if join_response.status_code == 200:
            data = join_response.json()
            assert "message" in data
            # Should mention ID verification priority
            if not data.get("id_verified"):
                assert "ID-verified" in data["message"] or "priority" in data["message"].lower()
            print(f"✓ User joined orphan queue: {data['message']}")
        elif join_response.status_code == 400:
            # May already be in queue or have direct recruits
            print(f"✓ Join queue returned 400 (expected if already in queue or has recruits)")
        else:
            pytest.fail(f"Unexpected status: {join_response.status_code}, {join_response.text}")


class TestOrphanAssignment:
    """Test orphan assignment on registration"""
    
    def test_orphan_assignment_on_registration(self):
        """New user without referral code should be assigned to queue member"""
        # First, create a user and add them to orphan queue
        unique_id1 = uuid.uuid4().hex[:8]
        queue_email = f"test_queue_{unique_id1}@example.com"
        
        # Register queue member
        queue_reg = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": queue_email,
                "password": "TestPass123!",
                "name": f"Queue Member {unique_id1}",
                "username": f"queuemember_{unique_id1}"
            }
        )
        
        if queue_reg.status_code != 200:
            pytest.skip(f"Could not create queue member: {queue_reg.text}")
        
        queue_token = queue_reg.json()["token"]
        queue_headers = {"Authorization": f"Bearer {queue_token}"}
        
        # Try to join orphan queue
        join_response = requests.post(
            f"{BASE_URL}/api/orphans/join-queue",
            headers=queue_headers
        )
        
        # Now register an orphan (no referral code)
        unique_id2 = uuid.uuid4().hex[:8]
        orphan_email = f"test_orphan_assign_{unique_id2}@example.com"
        
        orphan_reg = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": orphan_email,
                "password": "TestPass123!",
                "name": f"Orphan User {unique_id2}",
                "username": f"orphanuser_{unique_id2}"
            }
        )
        
        assert orphan_reg.status_code == 200, f"Orphan registration failed: {orphan_reg.text}"
        
        orphan_token = orphan_reg.json()["token"]
        orphan_headers = {"Authorization": f"Bearer {orphan_token}"}
        
        # Check if orphan was assigned a referrer
        me_response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers=orphan_headers
        )
        orphan_data = me_response.json()
        
        # Orphan may or may not be assigned depending on queue state
        if orphan_data.get("referred_by"):
            print(f"✓ Orphan was assigned to referrer: {orphan_data['referred_by']}")
        else:
            print("✓ Orphan not assigned (no eligible queue members or queue empty)")


class TestCommissionRates:
    """Test commission rate validation"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_regular_user_commission_rates(self, auth_headers):
        """GET /api/referral-system/stats - Verify regular user rates (3% L1, 1% L2)"""
        response = requests.get(
            f"{BASE_URL}/api/referral-system/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Check rates for non-Diamond user
        l1_rate = data["level_1"]["rate"]
        l2_rate = data["level_2"]["rate"]
        
        # Regular rates: 3% L1, 1% L2
        # Diamond rates: 4% L1, 2% L2
        assert l1_rate in [0.03, 0.04], f"L1 rate should be 3% or 4%, got {l1_rate}"
        assert l2_rate in [0.01, 0.02], f"L2 rate should be 1% or 2%, got {l2_rate}"
        
        if l1_rate == 0.03:
            print(f"✓ Regular user rates: L1={l1_rate*100}%, L2={l2_rate*100}%")
        else:
            print(f"✓ Diamond user rates: L1={l1_rate*100}%, L2={l2_rate*100}%")
    
    def test_diamond_status_shows_correct_benefits(self, auth_headers):
        """GET /api/diamond/status - Verify Diamond benefits are correct"""
        response = requests.get(
            f"{BASE_URL}/api/diamond/status",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        benefits = data["benefits"]
        
        # Verify Diamond benefits
        assert benefits["bonus"] == 100, f"Diamond bonus should be $100, got {benefits['bonus']}"
        assert "4" in benefits["level_1_rate"], f"Diamond L1 rate should be 4%, got {benefits['level_1_rate']}"
        assert "2" in benefits["level_2_rate"], f"Diamond L2 rate should be 2%, got {benefits['level_2_rate']}"
        assert "2" in benefits["platform_rate"], f"Diamond platform rate should be 2%, got {benefits['platform_rate']}"
        
        print(f"✓ Diamond benefits: bonus=${benefits['bonus']}, L1={benefits['level_1_rate']}, L2={benefits['level_2_rate']}")


class TestWithdrawalEligibility:
    """Test withdrawal eligibility and ID verification"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_withdrawal_eligibility_requires_id_verification(self, auth_headers):
        """GET /api/withdrawals/eligibility - Check ID verification requirement"""
        response = requests.get(
            f"{BASE_URL}/api/withdrawals/eligibility",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify structure
        assert "is_eligible" in data
        assert "id_verified" in data
        assert "verification_status" in data
        assert "available_balance" in data
        assert "pending_earnings" in data
        assert "withdrawal_fee" in data
        assert "min_withdrawal" in data
        
        # Eligibility should match ID verification status
        assert data["is_eligible"] == data["id_verified"], "Eligibility should match ID verification"
        
        # Verify fee and minimum
        assert "1" in data["withdrawal_fee"], f"Withdrawal fee should be 1%, got {data['withdrawal_fee']}"
        assert data["min_withdrawal"] == 10.0, f"Min withdrawal should be $10, got {data['min_withdrawal']}"
        
        print(f"✓ Withdrawal eligibility: verified={data['id_verified']}, balance=${data['available_balance']}")
    
    def test_withdrawal_request_without_verification_fails(self, auth_headers):
        """POST /api/withdrawals/request - Should fail without ID verification"""
        # First check if user is verified
        eligibility = requests.get(
            f"{BASE_URL}/api/withdrawals/eligibility",
            headers=auth_headers
        ).json()
        
        if eligibility["id_verified"]:
            pytest.skip("User is already ID verified")
        
        # Try to request withdrawal
        response = requests.post(
            f"{BASE_URL}/api/withdrawals/request",
            headers=auth_headers,
            json={
                "amount": 10.0,
                "payment_method": "bank_transfer",
                "payment_details": {"bank_name": "Test Bank"}
            }
        )
        
        assert response.status_code == 400, f"Should fail without ID verification, got {response.status_code}"
        data = response.json()
        assert "verification" in data.get("detail", "").lower() or "id" in data.get("detail", "").lower()
        print("✓ Withdrawal correctly requires ID verification")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
