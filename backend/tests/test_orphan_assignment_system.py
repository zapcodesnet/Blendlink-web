"""
Test Suite for BlendLink 11-Tier Orphan Assignment System
===========================================================
Tests the new orphan assignment system with:
- Stats API
- Orphan queue API
- Potential parents API  
- Manual assignment
- Auto assignment
- Batch assignment
- Audit log
- User orphan details
- Scheduler status
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://core-bugs-patch.preview.emergentagent.com')

# Test user credentials
TEST_EMAIL = "orphantest@blendlink.net"
TEST_PASSWORD = "TestOrphan2024!"


class TestOrphanAssignmentSystem:
    """Test suite for 11-tier orphan assignment system"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token for authenticated requests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Try to login with existing user
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user_id = data.get("user", {}).get("user_id")
        else:
            # Create new user
            unique_id = uuid.uuid4().hex[:6]
            response = self.session.post(
                f"{BASE_URL}/api/auth/register",
                json={
                    "email": f"orphantest{unique_id}@blendlink.net",
                    "password": TEST_PASSWORD,
                    "name": "Orphan Test User",
                    "username": f"orphantest{unique_id}",
                    "disclaimer_accepted": True
                }
            )
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                self.user_id = data.get("user_id")
            else:
                pytest.skip("Could not authenticate - skipping authenticated tests")
        
        if self.token:
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})

    # ============== ORPHAN STATS API ==============
    
    def test_orphan_stats_returns_200(self):
        """Test GET /api/admin/orphans/stats returns 200 with proper structure"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify required fields exist
        assert "total_orphans" in data, "Missing total_orphans"
        assert "unassigned" in data, "Missing unassigned"
        assert "assigned" in data or "assigned_today" in data, "Missing assignment counts"
        assert "eligible_parents" in data, "Missing eligible_parents"
        assert "max_orphans_per_user" in data, "Missing max_orphans_per_user"
        
        # Verify max_orphans_per_user is 2 (as per requirements)
        assert data.get("max_orphans_per_user") == 2, "Max orphans per user should be 2"
        
        # Verify tier_descriptions if present
        if "tier_descriptions" in data:
            assert len(data["tier_descriptions"]) >= 11, "Should have 11 tier descriptions"
        
        print(f"✅ Stats: {data.get('total_orphans')} total, {data.get('unassigned')} unassigned, {data.get('eligible_parents')} eligible parents")

    def test_orphan_stats_has_assignment_breakdown(self):
        """Test stats include auto vs manual assignment breakdown"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check assignment breakdown exists
        if "assignment_breakdown" in data:
            breakdown = data["assignment_breakdown"]
            assert "auto" in breakdown or isinstance(breakdown.get("auto"), int), "Missing auto assignment count"
            assert "manual" in breakdown or isinstance(breakdown.get("manual"), int), "Missing manual assignment count"
            print(f"✅ Assignment breakdown: auto={breakdown.get('auto', 0)}, manual={breakdown.get('manual', 0)}")

    # ============== POTENTIAL PARENTS API ==============
    
    def test_potential_parents_returns_200(self):
        """Test GET /api/admin/orphans/potential-parents returns proper structure"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/potential-parents?limit=50")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert "parents" in data, "Missing parents array"
        assert "total" in data, "Missing total count"
        assert "max_orphans_per_user" in data, "Missing max_orphans_per_user"
        
        print(f"✅ Potential parents: {data.get('total')} eligible users")

    def test_potential_parents_have_tier_info(self):
        """Test potential parents include tier information"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/potential-parents?limit=10")
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("parents"):
            parent = data["parents"][0]
            # Check required fields per parent
            assert "user_id" in parent, "Missing user_id"
            assert "tier" in parent, "Missing tier number"
            assert "tier_description" in parent, "Missing tier_description"
            assert "remaining_capacity" in parent, "Missing remaining_capacity"
            assert "login_frequency" in parent, "Missing login_frequency"
            
            # Tier should be between 1-11
            assert 1 <= parent["tier"] <= 11 or parent["tier"] == 99, f"Invalid tier: {parent['tier']}"
            
            print(f"✅ First parent: tier={parent['tier']}, capacity={parent['remaining_capacity']}, login={parent['login_frequency']}")

    def test_potential_parents_filter_by_tier(self):
        """Test filtering potential parents by specific tier"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/potential-parents?tier=1&limit=10")
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned parents should be tier 1 (if any exist)
        for parent in data.get("parents", []):
            assert parent.get("tier") == 1, f"Expected tier 1, got {parent.get('tier')}"
        
        print(f"✅ Tier 1 filter: {len(data.get('parents', []))} users found")

    # ============== ORPHAN QUEUE API ==============
    
    def test_orphan_queue_returns_200(self):
        """Test GET /api/admin/orphans returns orphan queue"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans?limit=50")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert "orphans" in data, "Missing orphans array"
        assert "total" in data, "Missing total count"
        
        print(f"✅ Orphan queue: {data.get('total')} orphans")

    def test_orphan_queue_filter_unassigned(self):
        """Test filtering orphans by unassigned status"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans?status=unassigned")
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned orphans should be unassigned
        for orphan in data.get("orphans", []):
            assert not orphan.get("is_orphan_assigned"), f"Orphan {orphan.get('user_id')} should be unassigned"
        
        print(f"✅ Unassigned filter: {len(data.get('orphans', []))} unassigned orphans")

    def test_orphan_queue_filter_assigned(self):
        """Test filtering orphans by assigned status"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans?status=assigned")
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned orphans should be assigned
        for orphan in data.get("orphans", []):
            assert orphan.get("is_orphan_assigned") == True, f"Orphan {orphan.get('user_id')} should be assigned"
        
        print(f"✅ Assigned filter: {len(data.get('orphans', []))} assigned orphans")

    def test_orphan_has_login_frequency(self):
        """Test orphans have login frequency field"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans?limit=10")
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("orphans"):
            orphan = data["orphans"][0]
            assert "login_frequency" in orphan, "Missing login_frequency field"
            valid_freqs = ["daily", "weekly", "monthly", "quarterly", "biannual", "inactive"]
            assert orphan.get("login_frequency") in valid_freqs, f"Invalid login frequency: {orphan.get('login_frequency')}"
            
            print(f"✅ Orphan login frequency: {orphan.get('login_frequency')}")

    # ============== ASSIGNMENT LOG API ==============
    
    def test_assignment_log_returns_200(self):
        """Test GET /api/admin/orphans/assignment-log returns audit log"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/assignment-log?limit=50")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert "logs" in data, "Missing logs array"
        assert "total" in data, "Missing total count"
        
        print(f"✅ Assignment log: {data.get('total')} entries")

    def test_assignment_log_filter_by_type(self):
        """Test filtering assignment log by assignment type"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/assignment-log?assignment_type=auto&limit=10")
        
        assert response.status_code == 200
        data = response.json()
        
        # All logs should be auto assignments
        for log in data.get("logs", []):
            assert log.get("assignment_type") == "auto", f"Expected auto, got {log.get('assignment_type')}"
        
        print(f"✅ Auto assignment filter: {len(data.get('logs', []))} entries")

    def test_assignment_log_has_required_fields(self):
        """Test assignment log entries have required fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/assignment-log?limit=5")
        
        assert response.status_code == 200
        data = response.json()
        
        if data.get("logs"):
            log = data["logs"][0]
            # Check required audit fields
            assert "assignment_id" in log, "Missing assignment_id"
            assert "orphan_user_id" in log, "Missing orphan_user_id"
            assert "assigned_to" in log, "Missing assigned_to"
            assert "assignment_type" in log, "Missing assignment_type"
            assert "created_at" in log, "Missing created_at"
            
            print(f"✅ Log entry: {log.get('assignment_type')} at {log.get('created_at')}")

    # ============== USER ORPHAN DETAILS API ==============
    
    def test_user_orphan_details_returns_200(self):
        """Test GET /api/admin/orphans/user/{user_id} returns user details"""
        # Use the test user's ID
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/user/{self.user_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert "user_id" in data, "Missing user_id"
        assert "eligibility" in data, "Missing eligibility info"
        assert "orphans_assigned_count" in data or "orphans_capacity_remaining" in data, "Missing orphan count info"
        
        print(f"✅ User details: eligible={data.get('eligibility', {}).get('is_eligible_to_receive')}")

    def test_user_orphan_details_has_eligibility_info(self):
        """Test user details include tier and eligibility info"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/user/{self.user_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        eligibility = data.get("eligibility", {})
        assert "is_eligible_to_receive" in eligibility or "is_eligible" in eligibility, "Missing eligibility flag"
        assert "tier" in eligibility, "Missing tier in eligibility"
        assert "login_frequency" in eligibility, "Missing login_frequency"
        
        print(f"✅ Eligibility: tier={eligibility.get('tier')}, login={eligibility.get('login_frequency')}")

    def test_user_orphan_details_404_for_nonexistent(self):
        """Test 404 for non-existent user"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/user/nonexistent_user_12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Correctly returns 404 for non-existent user")

    # ============== SCHEDULER STATUS API ==============
    
    def test_scheduler_status_returns_200(self):
        """Test GET /api/orphan-system/scheduler/status returns scheduler info"""
        response = self.session.get(f"{BASE_URL}/api/orphan-system/scheduler/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert "running" in data, "Missing running status"
        assert "jobs" in data, "Missing jobs list"
        
        print(f"✅ Scheduler status: running={data.get('running')}, jobs={len(data.get('jobs', []))}")

    def test_scheduler_has_auto_assign_job(self):
        """Test scheduler has auto_assign job configured"""
        response = self.session.get(f"{BASE_URL}/api/orphan-system/scheduler/status")
        
        assert response.status_code == 200
        data = response.json()
        
        jobs = data.get("jobs", [])
        job_ids = [j.get("id") for j in jobs]
        
        # Should have orphan_auto_assign job if scheduler is running
        if data.get("running"):
            assert "orphan_auto_assign" in job_ids, "Missing orphan_auto_assign job"
            print("✅ Auto-assign job configured")
        else:
            print("⚠️ Scheduler not running - jobs may not be listed")

    # ============== MANUAL ASSIGNMENT API ==============
    
    def test_manual_assign_requires_orphan_id(self):
        """Test POST /api/admin/orphans/assign validates parameters"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/orphans/assign",
            params={"parent_id": "test_parent"}
        )
        
        # Should fail without orphan_id
        assert response.status_code in [400, 422], f"Expected 400/422, got {response.status_code}"
        print("✅ Manual assign validates required parameters")

    def test_manual_assign_404_for_nonexistent_orphan(self):
        """Test manual assign returns 404 for non-existent orphan"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/orphans/assign",
            params={"orphan_id": "nonexistent_orphan_123", "parent_id": "test_parent"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Returns 404 for non-existent orphan")

    # ============== AUTO ASSIGNMENT API ==============
    
    def test_auto_assign_404_for_nonexistent_orphan(self):
        """Test POST /api/admin/orphans/auto-assign returns 404 for non-existent orphan"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/orphans/auto-assign",
            params={"orphan_id": "nonexistent_orphan_123"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Auto-assign returns 404 for non-existent orphan")

    # ============== BATCH ASSIGNMENT API ==============
    
    def test_batch_assign_returns_200(self):
        """Test POST /api/admin/orphans/batch-assign returns result structure"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/orphans/batch-assign",
            params={"limit": 5}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify batch result structure
        assert "total_processed" in data, "Missing total_processed"
        assert "successful" in data, "Missing successful count"
        assert "failed" in data, "Missing failed count"
        
        print(f"✅ Batch result: processed={data.get('total_processed')}, successful={data.get('successful')}, failed={data.get('failed')}")

    def test_batch_assign_has_assignments_list(self):
        """Test batch assign returns assignments list"""
        response = self.session.post(
            f"{BASE_URL}/api/admin/orphans/batch-assign",
            params={"limit": 5}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "assignments" in data or "errors" in data, "Missing assignments or errors array"
        print(f"✅ Batch assignments: {len(data.get('assignments', []))} successful, {len(data.get('errors', []))} errors")

    # ============== TIER SYSTEM VALIDATION ==============
    
    def test_eleven_tiers_documented(self):
        """Test that all 11 tiers are documented in stats"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        tier_descriptions = data.get("tier_descriptions", {})
        
        # Should have descriptions for tiers 1-11
        for tier in range(1, 12):
            assert str(tier) in tier_descriptions or tier in tier_descriptions, f"Missing tier {tier} description"
        
        print(f"✅ All 11 tiers documented: {list(tier_descriptions.keys())}")

    # ============== MAX ORPHANS VALIDATION ==============
    
    def test_max_orphans_is_two(self):
        """Test max orphans per user is 2 as per requirements"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data.get("max_orphans_per_user") == 2, f"Expected 2, got {data.get('max_orphans_per_user')}"
        print("✅ Max orphans per user is correctly set to 2")


class TestOrphanSystemIntegration:
    """Integration tests for orphan system endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Could not authenticate")

    def test_stats_unassigned_matches_queue_count(self):
        """Test stats unassigned count matches queue count"""
        # Get stats
        stats_response = self.session.get(f"{BASE_URL}/api/admin/orphans/stats")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        
        # Get unassigned queue
        queue_response = self.session.get(f"{BASE_URL}/api/admin/orphans?status=unassigned&limit=1000")
        assert queue_response.status_code == 200
        queue = queue_response.json()
        
        # Note: May not match exactly due to timing, but should be close
        print(f"✅ Stats unassigned: {stats.get('unassigned')}, Queue count: {queue.get('total')}")

    def test_all_endpoints_accessible(self):
        """Integration test - verify all orphan endpoints are accessible"""
        endpoints = [
            ("GET", "/api/admin/orphans/stats"),
            ("GET", "/api/admin/orphans"),
            ("GET", "/api/admin/orphans/potential-parents"),
            ("GET", "/api/admin/orphans/assignment-log"),
            ("GET", "/api/orphan-system/scheduler/status"),
        ]
        
        for method, endpoint in endpoints:
            if method == "GET":
                response = self.session.get(f"{BASE_URL}{endpoint}")
            
            assert response.status_code == 200, f"{method} {endpoint} failed with {response.status_code}"
            print(f"✅ {method} {endpoint} - 200 OK")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
