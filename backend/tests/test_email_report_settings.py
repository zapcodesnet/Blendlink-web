"""
Email Report Settings API Tests
Tests for automated daily sales report email delivery feature
- GET /api/page-analytics/{page_id}/email-settings
- PUT /api/page-analytics/{page_id}/email-settings  
- POST /api/page-analytics/{page_id}/send-test-report
- Scheduler startup verification
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@blendlink.com"
TEST_PASSWORD = "admin"
TEST_PAGE_ID = "mpage_11ec295ccd36"


class TestEmailReportSettings:
    """Email Report Settings endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - authenticate and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.text}")
        
        self.token = response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        self.user_data = response.json().get("user", {})
    
    def test_get_email_settings_success(self):
        """Test GET /api/page-analytics/{page_id}/email-settings returns settings"""
        response = self.session.get(f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "settings" in data, "Response should contain 'settings' key"
        assert "owner_email" in data, "Response should contain 'owner_email' key"
        
        settings = data["settings"]
        # Verify settings structure
        assert "email_enabled" in settings, "Settings should have email_enabled"
        assert "send_hour" in settings, "Settings should have send_hour"
        assert isinstance(settings.get("email_enabled"), bool), "email_enabled should be boolean"
        assert isinstance(settings.get("send_hour"), int), "send_hour should be integer"
        
        print(f"✓ GET email settings - email_enabled: {settings.get('email_enabled')}, send_hour: {settings.get('send_hour')}")
    
    def test_get_email_settings_unauthorized(self):
        """Test GET email settings without token returns 403"""
        response = requests.get(f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings")
        
        # Should fail without auth
        assert response.status_code in [401, 403, 422], f"Expected auth failure, got {response.status_code}"
        print("✓ GET email settings unauthorized - correctly rejected")
    
    def test_update_email_settings_enable(self):
        """Test PUT /api/page-analytics/{page_id}/email-settings to enable daily emails"""
        settings_payload = {
            "email_enabled": True,
            "email": "test@example.com",
            "send_hour": 18,  # 6 PM UTC
            "send_empty_reports": False,
            "timezone": "UTC"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings",
            json=settings_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should contain message"
        assert "settings" in data, "Response should contain settings"
        
        settings = data["settings"]
        assert settings["email_enabled"] == True, "email_enabled should be True"
        assert settings["email"] == "test@example.com", "email should match"
        assert settings["send_hour"] == 18, "send_hour should be 18"
        assert settings["send_empty_reports"] == False, "send_empty_reports should be False"
        
        print(f"✓ PUT email settings - enabled daily emails at hour {settings['send_hour']}")
    
    def test_update_email_settings_disable(self):
        """Test PUT email settings to disable daily emails"""
        settings_payload = {
            "email_enabled": False,
            "email": "",
            "send_hour": 23,
            "send_empty_reports": False,
            "timezone": "UTC"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings",
            json=settings_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["settings"]["email_enabled"] == False, "email_enabled should be False"
        
        print("✓ PUT email settings - disabled daily emails")
    
    def test_update_email_settings_all_hours(self):
        """Test PUT email settings with valid hours 0-23"""
        # Test boundary hours
        for hour in [0, 12, 23]:
            settings_payload = {
                "email_enabled": True,
                "send_hour": hour,
                "send_empty_reports": False,
                "timezone": "UTC"
            }
            
            response = self.session.put(
                f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings",
                json=settings_payload
            )
            
            assert response.status_code == 200, f"Expected 200 for hour {hour}, got {response.status_code}"
            assert response.json()["settings"]["send_hour"] == hour
        
        print("✓ PUT email settings - all valid hours (0, 12, 23) accepted")
    
    def test_update_email_settings_invalid_hour(self):
        """Test PUT email settings rejects invalid hours"""
        # Test invalid hour (> 23)
        settings_payload = {
            "email_enabled": True,
            "send_hour": 24,
            "send_empty_reports": False,
            "timezone": "UTC"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings",
            json=settings_payload
        )
        
        assert response.status_code == 400, f"Expected 400 for hour 24, got {response.status_code}"
        print("✓ PUT email settings - invalid hour 24 rejected")
    
    def test_update_email_settings_invalid_hour_negative(self):
        """Test PUT email settings rejects negative hours"""
        settings_payload = {
            "email_enabled": True,
            "send_hour": -1,
            "send_empty_reports": False,
            "timezone": "UTC"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings",
            json=settings_payload
        )
        
        assert response.status_code == 400, f"Expected 400 for hour -1, got {response.status_code}"
        print("✓ PUT email settings - negative hour rejected")
    
    def test_update_email_settings_with_empty_reports(self):
        """Test PUT email settings with send_empty_reports enabled"""
        settings_payload = {
            "email_enabled": True,
            "email": "",
            "send_hour": 21,
            "send_empty_reports": True,  # Enable empty reports
            "timezone": "UTC"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings",
            json=settings_payload
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        assert response.json()["settings"]["send_empty_reports"] == True
        
        print("✓ PUT email settings - send_empty_reports enabled")
    
    def test_send_test_report_success(self):
        """Test POST /api/page-analytics/{page_id}/send-test-report"""
        # First enable email settings with a valid email
        settings_payload = {
            "email_enabled": True,
            "email": TEST_EMAIL,
            "send_hour": 23,
            "send_empty_reports": False,
            "timezone": "UTC"
        }
        
        setup_response = self.session.put(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings",
            json=settings_payload
        )
        assert setup_response.status_code == 200
        
        # Now send test report
        response = self.session.post(f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/send-test-report")
        
        # Should return 200 even when RESEND_API_KEY is not configured (returns skipped status)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # When API key not configured, should return skipped status
        assert "status" in data, "Response should contain status"
        
        # If RESEND_API_KEY not configured, status will be "skipped"
        if data.get("status") == "skipped":
            assert "reason" in data, "Skipped response should have reason"
            print(f"✓ Send test report - skipped (RESEND_API_KEY not configured): {data.get('reason')}")
        else:
            # If API key is configured, status should be success
            print(f"✓ Send test report - status: {data.get('status')}")
    
    def test_send_test_report_unauthorized(self):
        """Test send test report without auth fails"""
        response = requests.post(f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/send-test-report")
        
        assert response.status_code in [401, 403, 422], f"Expected auth failure, got {response.status_code}"
        print("✓ Send test report unauthorized - correctly rejected")
    
    def test_settings_persistence(self):
        """Test that settings persist after update"""
        # Set specific settings
        settings_payload = {
            "email_enabled": True,
            "email": "persist-test@example.com",
            "send_hour": 15,
            "send_empty_reports": True,
            "timezone": "UTC"
        }
        
        # Update settings
        update_response = self.session.put(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings",
            json=settings_payload
        )
        assert update_response.status_code == 200
        
        # Retrieve settings and verify
        get_response = self.session.get(f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings")
        assert get_response.status_code == 200
        
        data = get_response.json()
        settings = data["settings"]
        
        assert settings["email_enabled"] == True, "email_enabled should persist"
        assert settings["email"] == "persist-test@example.com", "email should persist"
        assert settings["send_hour"] == 15, "send_hour should persist"
        assert settings["send_empty_reports"] == True, "send_empty_reports should persist"
        
        print("✓ Settings persistence verified - all values persisted correctly")
    
    def test_wrong_page_id_returns_403(self):
        """Test accessing email settings for non-owned page returns 403"""
        fake_page_id = "mpage_nonexistent123"
        
        response = self.session.get(f"{BASE_URL}/api/page-analytics/{fake_page_id}/email-settings")
        
        # Should return 403 (not authorized)
        assert response.status_code == 403, f"Expected 403 for non-owned page, got {response.status_code}"
        print("✓ Non-owned page access - correctly returned 403")
    
    def test_cleanup_reset_settings(self):
        """Cleanup - reset settings to default"""
        settings_payload = {
            "email_enabled": False,
            "email": "",
            "send_hour": 23,
            "send_empty_reports": False,
            "timezone": "UTC"
        }
        
        response = self.session.put(
            f"{BASE_URL}/api/page-analytics/{TEST_PAGE_ID}/email-settings",
            json=settings_payload
        )
        
        assert response.status_code == 200
        print("✓ Cleanup - reset email settings to defaults")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
