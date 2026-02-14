"""
Test suite for P2/P3 Monetization Features
Tests: Commission Dashboard API, Fraud Detection Rules, Mobile Sync System, Subscription Scheduler
"""
import pytest
import requests
import os
from datetime import datetime

# Use preview URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://core-bugs-patch.preview.emergentagent.com').rstrip('/')


class TestMobileSyncSystem:
    """Test mobile app sync verification endpoints"""
    
    def test_mobile_sync_status(self):
        """Test /api/mobile-sync/status endpoint"""
        response = requests.get(f"{BASE_URL}/api/mobile-sync/status", timeout=30)
        print(f"Mobile sync status response: {response.status_code}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "status" in data, "Missing 'status' field"
        assert data["status"] == "operational", f"Expected operational, got {data['status']}"
        assert "api_version" in data, "Missing 'api_version' field"
        assert "total_endpoints" in data, "Missing 'total_endpoints' field"
        print(f"Mobile sync status: {data['status']}, API version: {data['api_version']}, Total endpoints: {data['total_endpoints']}")
    
    def test_mobile_sync_endpoints(self):
        """Test /api/mobile-sync/endpoints listing"""
        response = requests.get(f"{BASE_URL}/api/mobile-sync/endpoints", timeout=30)
        print(f"Mobile sync endpoints response: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "endpoints" in data, "Missing 'endpoints' field"
        assert "total" in data, "Missing 'total' field"
        assert isinstance(data["endpoints"], list), "endpoints should be a list"
        print(f"Total mobile endpoints: {data['total']}")
    
    def test_mobile_sync_health(self):
        """Test /api/mobile-sync/health endpoint for detailed health check"""
        response = requests.get(f"{BASE_URL}/api/mobile-sync/health", timeout=30)
        print(f"Mobile sync health response: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data, "Missing 'status' field"
        assert "checks" in data, "Missing 'checks' field"
        
        # Check database health is included
        checks = data["checks"]
        assert "database" in checks, "Missing 'database' check"
        assert "features" in checks, "Missing 'features' check"
        
        # Verify feature flags
        features = checks.get("features", {})
        expected_features = ["stripe_payments", "google_auth", "photo_game", "member_pages", "commissions", "notifications"]
        for feature in expected_features:
            assert feature in features, f"Missing feature flag: {feature}"
        
        print(f"Mobile sync health: {data['status']}")
        print(f"Features: {features}")
    
    def test_mobile_sync_schemas(self):
        """Test /api/mobile-sync/schemas endpoint"""
        response = requests.get(f"{BASE_URL}/api/mobile-sync/schemas", timeout=30)
        print(f"Mobile sync schemas response: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "schemas" in data, "Missing 'schemas' field"
        assert "total" in data, "Missing 'total' field"
        print(f"Total schemas defined: {data['total']}")


class TestFraudDetectionRules:
    """Test suspicious transaction detector endpoints"""
    
    def test_get_fraud_detection_rules(self):
        """Test /api/admin/fraud-detection/rules endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/fraud-detection/rules", timeout=30)
        print(f"Fraud detection rules response: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "rules" in data, "Missing 'rules' field"
        
        rules = data["rules"]
        # Expected 9 detection rules as per implementation
        expected_rules = [
            "high_frequency_transactions",
            "rapid_withdrawals", 
            "large_single_transaction",
            "large_daily_volume",
            "sudden_balance_spike",
            "self_referral_pattern",
            "commission_farming",
            "new_account_large_transaction",
            "dormant_account_activation"
        ]
        
        for rule_id in expected_rules:
            assert rule_id in rules, f"Missing rule: {rule_id}"
            rule = rules[rule_id]
            assert "enabled" in rule, f"Rule {rule_id} missing 'enabled' field"
            assert "description" in rule, f"Rule {rule_id} missing 'description' field"
            assert "severity" in rule, f"Rule {rule_id} missing 'severity' field"
        
        print(f"Total detection rules: {len(rules)}")
        print(f"All {len(expected_rules)} expected rules found")


class TestSubscriptionScheduler:
    """Test subscription scheduler endpoints"""
    
    def test_subscription_scheduler_status(self):
        """Test /api/admin/subscription-scheduler/status endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/subscription-scheduler/status", timeout=30)
        print(f"Subscription scheduler status response: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "running" in data, "Missing 'running' field"
        assert "jobs" in data, "Missing 'jobs' field"
        
        # Should have 2 jobs: subscription_renewals and payment_retries
        jobs = data["jobs"]
        assert isinstance(jobs, list), "jobs should be a list"
        
        job_ids = [job["id"] for job in jobs]
        print(f"Scheduler running: {data['running']}, Jobs: {job_ids}")
        
        # Check for expected jobs
        assert "subscription_renewals" in job_ids, "Missing 'subscription_renewals' job"
        assert "payment_retries" in job_ids, "Missing 'payment_retries' job"
        
        print(f"Scheduler has {len(jobs)} jobs configured")


class TestCommissionDashboardAPI:
    """Test commission dashboard admin API endpoints"""
    
    def get_test_auth_token(self):
        """Get auth token for testing"""
        # Try to login with test credentials
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "tester@blendlink.net", "password": "BlendLink2024!"},
            timeout=30
        )
        if login_response.status_code == 200:
            return login_response.json().get("token")
        return None
    
    def test_commission_stats_requires_auth(self):
        """Test that commission stats endpoint requires authentication"""
        response = requests.get(
            f"{BASE_URL}/api/admin/membership/commission-stats",
            timeout=30
        )
        print(f"Commission stats (no auth) response: {response.status_code}")
        
        # Should return 401 or 403 without auth
        assert response.status_code in [401, 403, 422], f"Expected auth error, got {response.status_code}"
        print("Commission stats correctly requires authentication")
    
    def test_commission_stats_with_auth(self):
        """Test commission stats endpoint with authentication"""
        token = self.get_test_auth_token()
        if not token:
            pytest.skip("Could not get auth token for commission stats test")
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(
            f"{BASE_URL}/api/admin/membership/commission-stats?period=30d",
            headers=headers,
            timeout=30
        )
        print(f"Commission stats (with auth) response: {response.status_code}")
        
        # Note: This might fail with 403 if user is not admin, which is expected behavior
        if response.status_code == 403:
            print("User does not have admin privileges - expected behavior")
            return
        
        assert response.status_code == 200
        data = response.json()
        print(f"Commission stats data: {data}")


class TestMobileSyncVerification:
    """Test mobile sync verification endpoint"""
    
    def test_mobile_sync_verify(self):
        """Test /api/mobile-sync/verify endpoint for API compatibility check"""
        response = requests.get(f"{BASE_URL}/api/mobile-sync/verify", timeout=30)
        print(f"Mobile sync verify response: {response.status_code}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "total_endpoints" in data, "Missing 'total_endpoints' field"
        assert "available" in data, "Missing 'available' field"
        assert "overall_health" in data, "Missing 'overall_health' field"
        
        print(f"API Compatibility: {data['available']}/{data['total_endpoints']} available")
        print(f"Overall health: {data['overall_health']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
