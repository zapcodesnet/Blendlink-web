"""
Backend tests for Orphan Admin Features - Iteration 172
Tests for:
1. Re-run Auto-Assign toggle status endpoint
2. Re-run Auto-Assign toggle (enable/disable) endpoint
3. Re-run execute endpoint (blocked when toggle is off)
4. Unassign user endpoint
5. Self-assignment blocking in code (validated via API)
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

# Get BASE_URL from environment variable
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "tester@blendlink.net"
TEST_PASSWORD = "BlendLink2024!"


class TestOrphanAdminFeatures:
    """Tests for Orphan Admin Features - Toggle, Execute, Unassign"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup: Login and get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token") or data.get("access_token")
            self.user_id = data.get("user", {}).get("user_id") or data.get("user_id")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    # ============== RERUN TOGGLE STATUS TESTS ==============
    
    def test_rerun_toggle_status_endpoint_returns_state(self):
        """GET /api/admin/orphans/rerun-toggle-status returns enabled/disabled state"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/rerun-toggle-status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "enabled" in data, "Response must contain 'enabled' field"
        assert isinstance(data["enabled"], bool), "enabled must be boolean"
        
        # Optional fields that may be present
        if "last_changed_by" in data:
            assert data["last_changed_by"] is None or isinstance(data["last_changed_by"], str)
        if "last_changed_at" in data:
            assert data["last_changed_at"] is None or isinstance(data["last_changed_at"], str)
        
        print(f"[PASS] Rerun toggle status: enabled={data['enabled']}")
    
    # ============== RERUN TOGGLE ON/OFF TESTS ==============
    
    def test_rerun_toggle_enable(self):
        """POST /api/admin/orphans/rerun-toggle with enabled:true turns on"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/orphans/rerun-toggle",
            json={"enabled": True}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Toggle should succeed"
        assert data.get("enabled") == True, "Toggle should be enabled"
        assert "message" in data, "Response should contain message"
        
        # Verify by getting status
        status_response = self.session.get(f"{BASE_URL}/api/admin/orphans/rerun-toggle-status")
        status_data = status_response.json()
        assert status_data["enabled"] == True, "Status should confirm enabled"
        
        print(f"[PASS] Rerun toggle enabled successfully")
    
    def test_rerun_toggle_disable(self):
        """POST /api/admin/orphans/rerun-toggle with enabled:false turns off"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/orphans/rerun-toggle",
            json={"enabled": False}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Toggle should succeed"
        assert data.get("enabled") == False, "Toggle should be disabled"
        
        # Verify by getting status
        status_response = self.session.get(f"{BASE_URL}/api/admin/orphans/rerun-toggle-status")
        status_data = status_response.json()
        assert status_data["enabled"] == False, "Status should confirm disabled"
        
        print(f"[PASS] Rerun toggle disabled successfully")
    
    # ============== RERUN EXECUTE BLOCKED WHEN OFF TESTS ==============
    
    def test_rerun_execute_blocked_when_toggle_off(self):
        """POST /api/admin/orphans/rerun-execute blocked when toggle is off (403)"""
        # First, ensure toggle is OFF
        self.session.post(
            f"{BASE_URL}/api/admin/orphans/rerun-toggle",
            json={"enabled": False}
        )
        
        # Now try to execute rerun - should be blocked
        response = self.session.post(f"{BASE_URL}/api/admin/orphans/rerun-execute")
        
        assert response.status_code == 403, f"Expected 403 when toggle is off, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data or "message" in data, "Response should contain error message"
        error_msg = data.get("detail") or data.get("message", "")
        assert "disabled" in error_msg.lower() or "toggle" in error_msg.lower(), \
            f"Error should mention toggle is disabled: {error_msg}"
        
        print(f"[PASS] Rerun execute correctly blocked when toggle is off")
    
    def test_rerun_execute_allowed_when_toggle_on(self):
        """POST /api/admin/orphans/rerun-execute works when toggle is on"""
        # First, enable toggle
        self.session.post(
            f"{BASE_URL}/api/admin/orphans/rerun-toggle",
            json={"enabled": True}
        )
        
        # Now execute rerun - should work
        response = self.session.post(f"{BASE_URL}/api/admin/orphans/rerun-execute")
        
        assert response.status_code == 200, f"Expected 200 when toggle is on, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Execute should succeed"
        
        # Result should contain batch info
        result = data.get("result", data)
        assert "total_processed" in result or "successful" in result, "Should contain processing stats"
        
        print(f"[PASS] Rerun execute worked when toggle is on, processed: {result.get('total_processed', 'N/A')}")
        
        # Clean up - disable toggle
        self.session.post(
            f"{BASE_URL}/api/admin/orphans/rerun-toggle",
            json={"enabled": False}
        )
    
    # ============== UNASSIGN USER TESTS ==============
    
    def test_unassign_nonexistent_user_returns_404(self):
        """POST /api/admin/orphans/unassign/{nonexistent} returns 404"""
        fake_user_id = f"nonexistent_{uuid.uuid4().hex[:12]}"
        
        response = self.session.post(f"{BASE_URL}/api/admin/orphans/unassign/{fake_user_id}")
        
        assert response.status_code == 404, f"Expected 404 for nonexistent user, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data or "message" in data, "Response should contain error message"
        
        print(f"[PASS] Unassign nonexistent user returns 404")
    
    def test_unassign_user_no_upline_returns_400(self):
        """POST /api/admin/orphans/unassign/{user_without_upline} returns 400"""
        # Get a list of orphans to find one that has NO upline assigned
        orphans_response = self.session.get(f"{BASE_URL}/api/admin/orphans?status=unassigned")
        
        if orphans_response.status_code != 200:
            pytest.skip("Could not get orphans list")
        
        orphans = orphans_response.json().get("orphans", [])
        if not orphans:
            pytest.skip("No unassigned orphans to test with")
        
        # Find one that is truly unassigned (no referred_by)
        unassigned_orphan = None
        for o in orphans:
            if not o.get("is_orphan_assigned") and not o.get("referred_by"):
                unassigned_orphan = o
                break
        
        if not unassigned_orphan:
            pytest.skip("No orphan without upline found")
        
        response = self.session.post(f"{BASE_URL}/api/admin/orphans/unassign/{unassigned_orphan['user_id']}")
        
        assert response.status_code == 400, f"Expected 400 for user with no upline, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "detail" in data or "message" in data, "Response should contain error message"
        
        print(f"[PASS] Unassign user with no upline returns 400")
    
    def test_unassign_user_success(self):
        """POST /api/admin/orphans/unassign/{user_id} disconnects user from upline"""
        # Get assigned orphans
        orphans_response = self.session.get(f"{BASE_URL}/api/admin/orphans?status=assigned")
        
        if orphans_response.status_code != 200:
            pytest.skip("Could not get orphans list")
        
        orphans = orphans_response.json().get("orphans", [])
        assigned_orphan = None
        for o in orphans:
            if o.get("is_orphan_assigned") and o.get("referred_by"):
                assigned_orphan = o
                break
        
        if not assigned_orphan:
            pytest.skip("No assigned orphan found to test unassignment")
        
        user_id = assigned_orphan["user_id"]
        previous_upline = assigned_orphan.get("referred_by")
        
        # Unassign the user
        response = self.session.post(f"{BASE_URL}/api/admin/orphans/unassign/{user_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Unassignment should succeed"
        assert "previous_l1_parent" in data, "Should return previous L1 parent"
        assert data.get("downline_preserved") == True, "Downline should be preserved"
        
        print(f"[PASS] Unassigned user {user_id} from upline {previous_upline}")
        
        # Verify user is now unassigned
        verify_response = self.session.get(f"{BASE_URL}/api/admin/orphans/user/{user_id}")
        if verify_response.status_code == 200:
            verify_data = verify_response.json()
            assert verify_data.get("assigned_upline") is None or verify_data.get("referred_by") is None, \
                "User should now have no upline"
            print(f"[PASS] Verified user {user_id} is now unassigned")
    
    # ============== SELF-ASSIGNMENT BLOCKING TESTS ==============
    
    def test_self_assignment_blocked_in_manual_assign(self):
        """Self-assignment is blocked - cannot assign orphan to themselves"""
        # Get an unassigned orphan
        orphans_response = self.session.get(f"{BASE_URL}/api/admin/orphans?status=unassigned")
        
        if orphans_response.status_code != 200:
            pytest.skip("Could not get orphans list")
        
        orphans = orphans_response.json().get("orphans", [])
        if not orphans:
            pytest.skip("No unassigned orphans to test with")
        
        orphan = orphans[0]
        orphan_id = orphan["user_id"]
        
        # Try to assign orphan to themselves (should fail)
        response = self.session.post(
            f"{BASE_URL}/api/admin/orphans/assign",
            params={"orphan_id": orphan_id, "parent_id": orphan_id}
        )
        
        # Should return error (400 or similar)
        assert response.status_code in [400, 403, 422], \
            f"Self-assignment should be blocked, got {response.status_code}: {response.text}"
        
        data = response.json()
        error_msg = data.get("detail") or data.get("message", "")
        assert "self" in error_msg.lower() or "prohibited" in error_msg.lower() or "cannot" in error_msg.lower(), \
            f"Error should indicate self-assignment is blocked: {error_msg}"
        
        print(f"[PASS] Self-assignment blocked in manual assign endpoint")
    
    # ============== STATS AND BASIC ENDPOINTS ==============
    
    def test_orphan_stats_endpoint(self):
        """GET /api/admin/orphans/stats returns comprehensive stats"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Check required fields
        required_fields = [
            "total_orphans", "unassigned", "assigned",
            "assigned_today", "assigned_this_week",
            "eligible_parents", "parents_at_capacity", "max_orphans_per_user"
        ]
        
        for field in required_fields:
            assert field in data, f"Stats should contain {field}"
        
        assert data["max_orphans_per_user"] == 2, "Max orphans per user should be 2"
        
        print(f"[PASS] Orphan stats: {data['total_orphans']} total, {data['unassigned']} unassigned")
    
    def test_orphan_list_endpoint(self):
        """GET /api/admin/orphans returns list of orphans"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "orphans" in data, "Response should contain orphans list"
        assert "total" in data, "Response should contain total count"
        
        print(f"[PASS] Orphan list endpoint: {len(data['orphans'])} orphans returned, total: {data['total']}")
    
    def test_potential_parents_endpoint(self):
        """GET /api/admin/orphans/potential-parents returns eligible parents"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/potential-parents")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "parents" in data, "Response should contain parents list"
        assert "total" in data, "Response should contain total count"
        assert "max_orphans_per_user" in data, "Response should contain max orphans per user"
        
        # If we have parents, verify structure
        if data["parents"]:
            parent = data["parents"][0]
            expected_fields = ["user_id", "username", "tier", "remaining_capacity", "login_frequency"]
            for field in expected_fields:
                assert field in parent, f"Parent should have {field}"
            
            # Verify tier is between 1-11
            assert 1 <= parent["tier"] <= 11, f"Tier should be 1-11, got {parent['tier']}"
        
        print(f"[PASS] Potential parents endpoint: {len(data['parents'])} parents returned")
    
    def test_assignment_log_endpoint(self):
        """GET /api/admin/orphans/assignment-log returns audit log"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/assignment-log")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "logs" in data, "Response should contain logs list"
        assert "total" in data, "Response should contain total count"
        
        print(f"[PASS] Assignment log endpoint: {len(data['logs'])} logs returned, total: {data['total']}")


class TestCodeReviewSelfAssignmentBlock:
    """Code review tests for self-assignment blocking in orphan_assignment_system.py"""
    
    def test_assign_orphan_to_recipient_has_self_block(self):
        """Code review: assign_orphan_to_recipient function has self-assignment block at top"""
        import sys
        sys.path.insert(0, '/app/backend')
        
        # Read the file and check for self-assignment block
        with open('/app/backend/orphan_assignment_system.py', 'r') as f:
            content = f.read()
        
        # Check for the self-assignment block in assign_orphan_to_recipient
        assert "orphan_user_id == recipient_id" in content, \
            "assign_orphan_to_recipient should check for orphan_user_id == recipient_id"
        
        assert "Self-assignment" in content or "self-assignment" in content, \
            "Code should contain comment about self-assignment"
        
        print("[PASS] Code review: assign_orphan_to_recipient has self-assignment block")
    
    def test_auto_assign_single_orphan_has_self_block(self):
        """Code review: auto_assign_single_orphan function checks for self and retries"""
        with open('/app/backend/orphan_assignment_system.py', 'r') as f:
            content = f.read()
        
        # Check that auto_assign_single_orphan has self-assignment handling
        # It should check if recipient["user_id"] == orphan_user_id and retry
        assert 'recipient["user_id"] == orphan_user_id' in content or \
               'recipient.get("user_id") == orphan_user_id' in content, \
            "auto_assign_single_orphan should check for self-assignment"
        
        # Should have retry logic
        assert "Self-assignment blocked" in content or "self-assignment blocked" in content, \
            "Should log self-assignment block"
        
        print("[PASS] Code review: auto_assign_single_orphan has self-assignment check and retry")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
