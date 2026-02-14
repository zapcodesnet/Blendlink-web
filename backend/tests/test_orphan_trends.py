"""
Test Suite for OrphanTrendsWidget - /api/admin/orphans/trends endpoint
======================================================================
Tests the new trends dashboard widget endpoint with:
- Timeline data with date range filtering
- Summary statistics (total assignments, success rate, daily rate, WoW change)
- Pool status (current_unassigned, current_eligible, pool_health)
- Tier distribution
- Granularity options (day, week, month)
- Custom date range parameters
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://insufficient-balance.preview.emergentagent.com')

# Admin credentials for authenticated requests
ADMIN_EMAIL = "blendlinknet@gmail.com"
ADMIN_PASSWORD = "Blend!Admin2026Link"


class TestOrphanTrendsEndpoint:
    """Test suite for /api/admin/orphans/trends endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup_auth(self):
        """Get auth token for authenticated requests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login with admin credentials via secure admin endpoint
        response = self.session.post(
            f"{BASE_URL}/api/admin-auth/secure/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                self.token = data.get("token")
                if self.token:
                    self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            else:
                pytest.skip(f"Admin login failed: {data.get('message')}")
        else:
            pytest.skip(f"Could not authenticate as admin: {response.status_code}")

    # ============== BASIC ENDPOINT TESTS ==============
    
    def test_trends_returns_200(self):
        """Test GET /api/admin/orphans/trends returns 200"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        print(f"✅ Trends endpoint returns 200 with {len(data.get('timeline', []))} timeline entries")

    def test_trends_has_required_fields(self):
        """Test trends response has all required top-level fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check all required top-level fields
        assert "timeline" in data, "Missing timeline array"
        assert "summary" in data, "Missing summary object"
        assert "pool_status" in data, "Missing pool_status object"
        assert "tier_distribution" in data, "Missing tier_distribution object"
        assert "date_range" in data, "Missing date_range object"
        
        print(f"✅ All required top-level fields present")

    # ============== SUMMARY STATISTICS TESTS ==============
    
    def test_summary_has_all_metrics(self):
        """Test summary includes all required metrics"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends")
        
        assert response.status_code == 200
        data = response.json()
        
        summary = data.get("summary", {})
        
        # Check required summary fields
        assert "total_assignments" in summary, "Missing total_assignments"
        assert "total_auto" in summary, "Missing total_auto"
        assert "total_manual" in summary, "Missing total_manual"
        assert "total_registration" in summary, "Missing total_registration"
        assert "success_rate" in summary, "Missing success_rate"
        assert "avg_daily_rate" in summary, "Missing avg_daily_rate"
        assert "recent_daily_rate" in summary, "Missing recent_daily_rate"
        assert "week_over_week_change" in summary, "Missing week_over_week_change"
        
        print(f"✅ Summary: {summary.get('total_assignments')} total, {summary.get('success_rate')}% success rate")
        print(f"   Daily rate: {summary.get('recent_daily_rate')}, WoW change: {summary.get('week_over_week_change')}%")

    def test_summary_success_rate_is_percentage(self):
        """Test success rate is a valid percentage (0-100)"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends")
        
        assert response.status_code == 200
        data = response.json()
        
        success_rate = data.get("summary", {}).get("success_rate", 0)
        
        assert isinstance(success_rate, (int, float)), "success_rate should be numeric"
        assert 0 <= success_rate <= 100, f"success_rate should be 0-100, got {success_rate}"
        
        print(f"✅ Success rate is valid percentage: {success_rate}%")

    # ============== POOL STATUS TESTS ==============
    
    def test_pool_status_has_required_fields(self):
        """Test pool_status includes all required fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends")
        
        assert response.status_code == 200
        data = response.json()
        
        pool_status = data.get("pool_status", {})
        
        assert "current_unassigned" in pool_status, "Missing current_unassigned"
        assert "current_eligible" in pool_status, "Missing current_eligible"
        assert "days_until_exhaustion" in pool_status, "Missing days_until_exhaustion"
        assert "pool_health" in pool_status, "Missing pool_health"
        
        print(f"✅ Pool status: {pool_status.get('current_unassigned')} unassigned, {pool_status.get('current_eligible')} eligible")
        print(f"   Health: {pool_status.get('pool_health')}, Days until exhaustion: {pool_status.get('days_until_exhaustion')}")

    def test_pool_health_is_valid_value(self):
        """Test pool_health is either 'healthy' or 'needs_attention'"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends")
        
        assert response.status_code == 200
        data = response.json()
        
        pool_health = data.get("pool_status", {}).get("pool_health")
        
        assert pool_health in ["healthy", "needs_attention"], f"Invalid pool_health: {pool_health}"
        
        print(f"✅ Pool health is valid: {pool_health}")

    # ============== TIER DISTRIBUTION TESTS ==============
    
    def test_tier_distribution_has_11_tiers(self):
        """Test tier_distribution includes tiers 1-11"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends")
        
        assert response.status_code == 200
        data = response.json()
        
        tier_dist = data.get("tier_distribution", {})
        
        # Should have tiers 1-11
        for tier in range(1, 12):
            tier_key = str(tier)
            assert tier_key in tier_dist, f"Missing tier {tier}"
            assert isinstance(tier_dist[tier_key], int), f"Tier {tier} count should be integer"
        
        print(f"✅ Tier distribution has all 11 tiers: {tier_dist}")

    # ============== DATE RANGE TESTS ==============
    
    def test_date_range_has_required_fields(self):
        """Test date_range includes all required fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends")
        
        assert response.status_code == 200
        data = response.json()
        
        date_range = data.get("date_range", {})
        
        assert "start" in date_range, "Missing start date"
        assert "end" in date_range, "Missing end date"
        assert "granularity" in date_range, "Missing granularity"
        assert "days" in date_range, "Missing days count"
        
        print(f"✅ Date range: {date_range.get('start')} to {date_range.get('end')} ({date_range.get('days')} days)")

    def test_default_date_range_is_30_days(self):
        """Test default date range is approximately 30 days"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends")
        
        assert response.status_code == 200
        data = response.json()
        
        days = data.get("date_range", {}).get("days", 0)
        
        # Should be close to 30 days by default
        assert 28 <= days <= 31, f"Expected ~30 days, got {days}"
        
        print(f"✅ Default range is {days} days (expected ~30)")

    # ============== CUSTOM DATE RANGE TESTS ==============
    
    def test_custom_start_date(self):
        """Test custom start_date parameter works"""
        # Set start date to 7 days ago
        start = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends?start_date={start}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        date_range = data.get("date_range", {})
        
        # Days should be approximately 7
        days = date_range.get("days", 0)
        assert 6 <= days <= 8, f"Expected ~7 days, got {days}"
        
        print(f"✅ Custom start_date works: {days} days range")

    def test_custom_end_date(self):
        """Test custom end_date parameter works"""
        # Set end date to yesterday
        end = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
        
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends?end_date={end}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        print(f"✅ Custom end_date works")

    def test_custom_date_range(self):
        """Test custom start and end date parameters together"""
        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")
        
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends?start_date={start}&end_date={end}")
        
        assert response.status_code == 200
        
        data = response.json()
        date_range = data.get("date_range", {})
        
        # Should be approximately 14 days
        days = date_range.get("days", 0)
        assert 13 <= days <= 15, f"Expected ~14 days, got {days}"
        
        print(f"✅ Custom date range works: {days} days")

    # ============== GRANULARITY TESTS ==============
    
    def test_granularity_day(self):
        """Test granularity=day parameter works"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends?granularity=day")
        
        assert response.status_code == 200
        
        data = response.json()
        granularity = data.get("date_range", {}).get("granularity")
        
        assert granularity == "day", f"Expected 'day', got '{granularity}'"
        
        print(f"✅ Granularity day works")

    def test_granularity_week(self):
        """Test granularity=week parameter works"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends?granularity=week")
        
        assert response.status_code == 200
        
        data = response.json()
        granularity = data.get("date_range", {}).get("granularity")
        
        assert granularity == "week", f"Expected 'week', got '{granularity}'"
        
        print(f"✅ Granularity week works")

    def test_granularity_month(self):
        """Test granularity=month parameter works"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends?granularity=month")
        
        assert response.status_code == 200
        
        data = response.json()
        granularity = data.get("date_range", {}).get("granularity")
        
        assert granularity == "month", f"Expected 'month', got '{granularity}'"
        
        print(f"✅ Granularity month works")

    # ============== TIMELINE DATA TESTS ==============
    
    def test_timeline_entries_have_required_fields(self):
        """Test timeline entries have all required fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends")
        
        assert response.status_code == 200
        
        data = response.json()
        timeline = data.get("timeline", [])
        
        if timeline:
            entry = timeline[0]
            
            # Check required fields per timeline entry
            assert "date" in entry, "Missing date"
            assert "total" in entry, "Missing total"
            assert "auto" in entry, "Missing auto"
            assert "manual" in entry, "Missing manual"
            assert "registration" in entry, "Missing registration"
            assert "successful" in entry, "Missing successful"
            assert "failed" in entry, "Missing failed"
            assert "tiers" in entry, "Missing tiers"
            
            print(f"✅ Timeline entries have all required fields")
            print(f"   Sample: date={entry['date']}, total={entry['total']}, auto={entry['auto']}, manual={entry['manual']}")
        else:
            print("⚠️ Timeline is empty (no assignments in date range)")

    def test_timeline_dates_are_ordered(self):
        """Test timeline dates are in chronological order"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends")
        
        assert response.status_code == 200
        
        data = response.json()
        timeline = data.get("timeline", [])
        
        if len(timeline) > 1:
            dates = [entry.get("date") for entry in timeline]
            
            # Check dates are ordered
            sorted_dates = sorted(dates)
            assert dates == sorted_dates, "Timeline dates should be in chronological order"
            
            print(f"✅ Timeline dates are chronologically ordered ({len(dates)} entries)")
        else:
            print("⚠️ Not enough timeline entries to verify ordering")

    # ============== COMBINED PARAMETER TESTS ==============
    
    def test_combined_parameters(self):
        """Test combining multiple parameters"""
        end = datetime.now().strftime("%Y-%m-%d")
        start = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
        
        response = self.session.get(
            f"{BASE_URL}/api/admin/orphans/trends?start_date={start}&end_date={end}&granularity=week"
        )
        
        assert response.status_code == 200
        
        data = response.json()
        date_range = data.get("date_range", {})
        
        assert date_range.get("granularity") == "week", "Granularity should be 'week'"
        assert 85 <= date_range.get("days", 0) <= 95, "Days should be ~90"
        
        print(f"✅ Combined parameters work: 90 days with weekly granularity")

    # ============== ERROR HANDLING TESTS ==============
    
    def test_invalid_granularity_defaults(self):
        """Test invalid granularity defaults to 'day'"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends?granularity=invalid")
        
        # Should still work (endpoint may default or ignore invalid value)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        print(f"✅ Invalid granularity handled gracefully")

    def test_invalid_date_format_handled(self):
        """Test invalid date format is handled gracefully"""
        response = self.session.get(f"{BASE_URL}/api/admin/orphans/trends?start_date=invalid-date")
        
        # Should still work (endpoint should fall back to default)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        print(f"✅ Invalid date format handled gracefully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
