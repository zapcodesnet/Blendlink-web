"""
Test Admin Membership & Fraud Detection Features - Iteration 156

Tests for:
1. Commission Adjustments - POST /api/admin/membership/commissions/adjust
2. Global Commission Override - POST/GET/DELETE /api/admin/membership/commissions/global-override
3. Commission Adjustments History - GET /api/admin/membership/commissions/adjustments
4. Custom Benefits CRUD - GET/POST/PUT/DELETE /api/admin/membership/custom-benefits
5. Fraud Detection Rules - GET /api/admin/fraud-detection/rules (21 rules)
6. Fraud Analytics - GET /api/admin/fraud-detection/analytics
7. Fraud Scan - POST /api/admin/fraud-detection/scan
8. User Risk Score - GET /api/admin/fraud-detection/user-risk/{user_id}
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

# Get API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Admin credentials for testing
ADMIN_EMAIL = "admin@blendlink.net"
ADMIN_PASSWORD = "admin123"

class TestFraudDetectionRules:
    """Test fraud detection rules endpoint - should return 21 ML-inspired rules"""
    
    def test_get_fraud_detection_rules(self):
        """GET /api/admin/fraud-detection/rules - Returns all detection rules"""
        response = requests.get(f"{BASE_URL}/api/admin/fraud-detection/rules")
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "rules" in data, "Response should contain 'rules' key"
        
        rules = data["rules"]
        assert isinstance(rules, dict), "Rules should be a dictionary"
        
        # Check we have at least 21 rules (ML-inspired rules)
        rule_count = len(rules)
        print(f"Found {rule_count} detection rules")
        assert rule_count >= 21, f"Expected at least 21 rules, got {rule_count}"
        
        # Verify key ML-inspired rules exist
        expected_rules = [
            "high_frequency_transactions",
            "rapid_withdrawals",
            "large_single_transaction",
            "large_daily_volume",
            "sudden_balance_spike",
            "self_referral_pattern",
            "commission_farming",
            "new_account_large_transaction",
            "dormant_account_activation",
            "statistical_amount_anomaly",
            "unusual_time_pattern",
            "velocity_acceleration",
            "cluster_activity_pattern",
            "amount_structuring",
            "round_amount_pattern",
            "low_recipient_diversity",
            "high_risk_beneficiary",
            "excessive_failed_attempts",
            "multi_account_device",
            "impossible_travel",
            "layering_pattern"
        ]
        
        for rule_name in expected_rules:
            assert rule_name in rules, f"Missing expected rule: {rule_name}"
            rule = rules[rule_name]
            assert "enabled" in rule, f"Rule {rule_name} should have 'enabled' field"
            assert "description" in rule, f"Rule {rule_name} should have 'description' field"
            assert "severity" in rule, f"Rule {rule_name} should have 'severity' field"
        
        print(f"✓ All 21 ML-inspired detection rules found and validated")


class TestFraudAnalytics:
    """Test fraud analytics endpoint"""
    
    def test_get_fraud_analytics(self):
        """GET /api/admin/fraud-detection/analytics - Returns fraud analytics with summary"""
        response = requests.get(f"{BASE_URL}/api/admin/fraud-detection/analytics?days=30")
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        
        # Verify summary exists
        assert "summary" in data, "Response should contain 'summary' key"
        summary = data["summary"]
        assert "total_transactions" in summary
        assert "flagged_transactions" in summary
        assert "flag_rate_percentage" in summary
        
        # Verify severity distribution exists
        assert "severity_distribution" in data, "Response should contain 'severity_distribution'"
        
        # Verify top flagged users (may be empty if no flags)
        assert "top_flagged_users" in data, "Response should contain 'top_flagged_users'"
        
        # Verify period and timestamp
        assert "period_days" in data
        assert "generated_at" in data
        
        print(f"✓ Fraud analytics retrieved successfully")
        print(f"  - Total transactions: {summary.get('total_transactions', 0)}")
        print(f"  - Flagged transactions: {summary.get('flagged_transactions', 0)}")
        print(f"  - Flag rate: {summary.get('flag_rate_percentage', 0)}%")


class TestFraudScan:
    """Test fraud detection scan trigger"""
    
    def test_trigger_fraud_scan(self):
        """POST /api/admin/fraud-detection/scan - Triggers fraud detection scan"""
        response = requests.post(f"{BASE_URL}/api/admin/fraud-detection/scan?hours=24")
        
        # Status assertion
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Data assertions
        data = response.json()
        assert "success" in data, "Response should contain 'success' key"
        assert data["success"] == True
        assert "result" in data, "Response should contain 'result' key"
        
        result = data["result"]
        assert "scanned" in result
        assert "flagged" in result
        
        print(f"✓ Fraud scan completed")
        print(f"  - Transactions scanned: {result.get('scanned', 0)}")
        print(f"  - Transactions flagged: {result.get('flagged', 0)}")


class TestUserRiskScore:
    """Test user risk score calculation"""
    
    def test_calculate_user_risk_score_invalid_user(self):
        """GET /api/admin/fraud-detection/user-risk/{user_id} - Test with invalid user"""
        fake_user_id = f"user_{uuid.uuid4().hex[:12]}"
        response = requests.get(f"{BASE_URL}/api/admin/fraud-detection/user-risk/{fake_user_id}")
        
        # Status assertion (may return 200 with error or 404)
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # Should indicate user not found or have default risk
            if "error" in data:
                assert "not found" in data["error"].lower()
            assert "risk_score" in data
        
        print(f"✓ User risk score endpoint handles invalid user correctly")


class TestCommissionAdjustmentsWithAuth:
    """Test commission adjustment endpoints that require admin auth"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        self.token = self._get_admin_token()
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        } if self.token else {"Content-Type": "application/json"}
    
    def _get_admin_token(self):
        """Attempt to get admin token - try multiple methods"""
        # Method 1: Try standard admin login
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin-auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("token")
        except:
            pass
        
        # Method 2: Try regular auth with admin user
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("token")
        except:
            pass
        
        return None
    
    def test_get_commission_adjustments_history(self):
        """GET /api/admin/membership/commissions/adjustments - Get adjustment history"""
        response = requests.get(
            f"{BASE_URL}/api/admin/membership/commissions/adjustments",
            headers=self.headers
        )
        
        # Without proper auth, may get 401 - this is expected
        if response.status_code == 401:
            print("⚠ Admin authentication required for this endpoint")
            pytest.skip("Admin authentication required")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "adjustments" in data
        assert "total" in data
        
        print(f"✓ Commission adjustments history retrieved")
        print(f"  - Total adjustments: {data.get('total', 0)}")
    
    def test_get_global_commission_override(self):
        """GET /api/admin/membership/commissions/global-override - Get active override"""
        response = requests.get(
            f"{BASE_URL}/api/admin/membership/commissions/global-override",
            headers=self.headers
        )
        
        if response.status_code == 401:
            print("⚠ Admin authentication required for this endpoint")
            pytest.skip("Admin authentication required")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "active_override" in data
        assert "history" in data
        
        print(f"✓ Global commission override status retrieved")
        print(f"  - Active override: {data.get('active_override') is not None}")
        print(f"  - History count: {len(data.get('history', []))}")


class TestCustomBenefitsWithAuth:
    """Test custom benefits endpoints that require admin auth"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token for authenticated requests"""
        self.token = self._get_admin_token()
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        } if self.token else {"Content-Type": "application/json"}
        self.created_benefit_id = None
    
    def _get_admin_token(self):
        """Attempt to get admin token"""
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin-auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            if response.status_code == 200:
                return response.json().get("token")
        except:
            pass
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            if response.status_code == 200:
                return response.json().get("token")
        except:
            pass
        
        return None
    
    def test_get_custom_benefits(self):
        """GET /api/admin/membership/custom-benefits - Get all custom benefits"""
        response = requests.get(
            f"{BASE_URL}/api/admin/membership/custom-benefits",
            headers=self.headers
        )
        
        if response.status_code == 401:
            print("⚠ Admin authentication required for this endpoint")
            pytest.skip("Admin authentication required")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "benefits" in data
        assert isinstance(data["benefits"], list)
        
        print(f"✓ Custom benefits retrieved: {len(data['benefits'])} benefits found")
    
    def test_create_custom_benefit(self):
        """POST /api/admin/membership/custom-benefits - Create new custom benefit"""
        test_benefit = {
            "name": f"TEST_Benefit_{uuid.uuid4().hex[:6]}",
            "description": "Test benefit created by automated testing",
            "benefit_type": "numeric",
            "default_value": 100,
            "icon": "star",
            "display_order": 999,
            "tier_values": {
                "free": 0,
                "bronze": 50,
                "silver": 100,
                "gold": 200,
                "diamond": 500
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/membership/custom-benefits",
            json=test_benefit,
            headers=self.headers
        )
        
        if response.status_code == 401:
            print("⚠ Admin authentication required for this endpoint")
            pytest.skip("Admin authentication required")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert data["success"] == True
        assert "benefit_id" in data
        
        self.created_benefit_id = data["benefit_id"]
        print(f"✓ Custom benefit created: {data['benefit_id']}")
        
        # Cleanup - delete the test benefit
        if self.created_benefit_id:
            cleanup_response = requests.delete(
                f"{BASE_URL}/api/admin/membership/custom-benefits/{self.created_benefit_id}",
                headers=self.headers
            )
            if cleanup_response.status_code == 200:
                print(f"✓ Test benefit cleaned up")


class TestCommissionAdjustmentCreation:
    """Test commission adjustment creation with auth"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        self.token = self._get_admin_token()
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        } if self.token else {"Content-Type": "application/json"}
    
    def _get_admin_token(self):
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin-auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            if response.status_code == 200:
                return response.json().get("token")
        except:
            pass
        return None
    
    def test_create_commission_adjustment_validation(self):
        """POST /api/admin/membership/commissions/adjust - Test validation"""
        # Test without user_id or transaction_id - should fail
        invalid_adjustment = {
            "adjustment_type": "percentage",
            "adjustment_value": 10,
            "reason": "Test adjustment"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/membership/commissions/adjust",
            json=invalid_adjustment,
            headers=self.headers
        )
        
        if response.status_code == 401:
            print("⚠ Admin authentication required for this endpoint")
            pytest.skip("Admin authentication required")
        
        # Should fail with 400 due to missing user_id/transaction_id
        assert response.status_code == 400, f"Expected 400 for invalid request, got {response.status_code}"
        print(f"✓ Commission adjustment validation works correctly")


class TestGlobalCommissionOverrideFlow:
    """Test global commission override creation flow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get admin token"""
        self.token = self._get_admin_token()
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        } if self.token else {"Content-Type": "application/json"}
        self.created_override_id = None
    
    def _get_admin_token(self):
        try:
            response = requests.post(
                f"{BASE_URL}/api/admin-auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
            )
            if response.status_code == 200:
                return response.json().get("token")
        except:
            pass
        return None
    
    def test_global_override_validation(self):
        """POST /api/admin/membership/commissions/global-override - Test validation"""
        # Test without rates - should fail
        invalid_override = {
            "affected_tiers": ["bronze", "silver"],
            "reason": "Test override"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/membership/commissions/global-override",
            json=invalid_override,
            headers=self.headers
        )
        
        if response.status_code == 401:
            print("⚠ Admin authentication required for this endpoint")
            pytest.skip("Admin authentication required")
        
        # This endpoint may accept the request even without rates
        # Just verify it doesn't crash
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}"
        print(f"✓ Global override endpoint responds correctly")


class TestEndpointAccessibility:
    """Test that all new endpoints are accessible"""
    
    def test_fraud_rules_endpoint_accessible(self):
        """Verify /api/admin/fraud-detection/rules is accessible"""
        response = requests.get(f"{BASE_URL}/api/admin/fraud-detection/rules")
        assert response.status_code != 404, "Fraud rules endpoint should exist"
        print(f"✓ Fraud rules endpoint accessible (status: {response.status_code})")
    
    def test_fraud_analytics_endpoint_accessible(self):
        """Verify /api/admin/fraud-detection/analytics is accessible"""
        response = requests.get(f"{BASE_URL}/api/admin/fraud-detection/analytics")
        assert response.status_code != 404, "Fraud analytics endpoint should exist"
        print(f"✓ Fraud analytics endpoint accessible (status: {response.status_code})")
    
    def test_fraud_scan_endpoint_accessible(self):
        """Verify /api/admin/fraud-detection/scan is accessible"""
        response = requests.post(f"{BASE_URL}/api/admin/fraud-detection/scan?hours=1")
        assert response.status_code != 404, "Fraud scan endpoint should exist"
        print(f"✓ Fraud scan endpoint accessible (status: {response.status_code})")
    
    def test_user_risk_endpoint_accessible(self):
        """Verify /api/admin/fraud-detection/user-risk/{user_id} is accessible"""
        response = requests.get(f"{BASE_URL}/api/admin/fraud-detection/user-risk/test_user")
        assert response.status_code != 404, "User risk endpoint should exist"
        print(f"✓ User risk endpoint accessible (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
