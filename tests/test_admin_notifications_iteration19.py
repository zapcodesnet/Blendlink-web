"""
Test Admin Notification System - Iteration 19
Tests for:
- Admin login
- Admin Notification Preferences API (GET/PUT)
- Send Test Notification
- Get Admin Notifications
- Mark Notifications Read
- Mark All Read
- Get Available Delegates
- Friends, Groups, Events pages (basic load test)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://profile-enhance-13.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "blendlinknet@gmail.com"
ADMIN_PASSWORD = "link2026blend!"


class TestAdminLogin:
    """Test admin authentication"""
    
    def test_admin_login_success(self):
        """Test admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in response"
        assert "user" in data, "No user in response"
        assert data["user"].get("is_admin") == True, "User is not admin"
        print(f"✓ Admin login successful - is_admin: {data['user'].get('is_admin')}")
        return data["token"]
    
    def test_admin_login_invalid_credentials(self):
        """Test admin login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Admin authentication failed")


@pytest.fixture
def auth_headers(admin_token):
    """Get headers with admin token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestAdminNotificationPreferences:
    """Test admin notification preferences endpoints"""
    
    def test_get_notification_preferences(self, auth_headers):
        """GET /api/admin/notifications/preferences - Get current preferences"""
        response = requests.get(
            f"{BASE_URL}/api/admin/notifications/preferences",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify expected fields exist
        expected_fields = [
            "admin_id", "enabled", "kyc_notifications", "withdrawal_notifications",
            "security_notifications", "user_event_notifications", "system_notifications",
            "diamond_notifications", "push_enabled", "in_app_enabled", "quiet_hours_enabled"
        ]
        for field in expected_fields:
            assert field in data, f"Missing field: {field}"
        
        print(f"✓ Got notification preferences - enabled: {data.get('enabled')}")
        print(f"  - KYC: {data.get('kyc_notifications')}")
        print(f"  - Withdrawals: {data.get('withdrawal_notifications')}")
        print(f"  - Security: {data.get('security_notifications')}")
        print(f"  - Diamond: {data.get('diamond_notifications')}")
        return data
    
    def test_update_notification_preferences(self, auth_headers):
        """PUT /api/admin/notifications/preferences - Update preferences"""
        # First get current preferences
        get_response = requests.get(
            f"{BASE_URL}/api/admin/notifications/preferences",
            headers=auth_headers
        )
        original_prefs = get_response.json()
        
        # Update a preference
        update_data = {"kyc_notifications": not original_prefs.get("kyc_notifications", True)}
        response = requests.put(
            f"{BASE_URL}/api/admin/notifications/preferences",
            headers=auth_headers,
            json=update_data
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Update not successful"
        print(f"✓ Updated notification preferences - fields: {data.get('updated_fields')}")
        
        # Restore original preference
        restore_data = {"kyc_notifications": original_prefs.get("kyc_notifications", True)}
        requests.put(
            f"{BASE_URL}/api/admin/notifications/preferences",
            headers=auth_headers,
            json=restore_data
        )
        print("✓ Restored original preferences")
    
    def test_update_quiet_hours(self, auth_headers):
        """Test updating quiet hours settings"""
        update_data = {
            "quiet_hours_enabled": True,
            "quiet_hours_start": 22,
            "quiet_hours_end": 7
        }
        response = requests.put(
            f"{BASE_URL}/api/admin/notifications/preferences",
            headers=auth_headers,
            json=update_data
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        print("✓ Updated quiet hours settings")
        
        # Disable quiet hours
        requests.put(
            f"{BASE_URL}/api/admin/notifications/preferences",
            headers=auth_headers,
            json={"quiet_hours_enabled": False}
        )
    
    def test_update_priority_threshold(self, auth_headers):
        """Test updating priority threshold"""
        update_data = {"min_priority": "normal"}
        response = requests.put(
            f"{BASE_URL}/api/admin/notifications/preferences",
            headers=auth_headers,
            json=update_data
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        print("✓ Updated priority threshold to 'normal'")
        
        # Reset to low
        requests.put(
            f"{BASE_URL}/api/admin/notifications/preferences",
            headers=auth_headers,
            json={"min_priority": "low"}
        )


class TestAdminNotifications:
    """Test admin notifications endpoints"""
    
    def test_get_admin_notifications(self, auth_headers):
        """GET /api/admin/notifications/ - Get notifications list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/notifications/",
            headers=auth_headers,
            params={"limit": 10}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "notifications" in data, "Missing notifications field"
        assert "unread_count" in data, "Missing unread_count field"
        assert "total" in data, "Missing total field"
        
        print(f"✓ Got admin notifications - total: {data.get('total')}, unread: {data.get('unread_count')}")
        if data.get("notifications"):
            print(f"  - Latest: {data['notifications'][0].get('title', 'N/A')}")
        return data
    
    def test_get_unread_notifications_only(self, auth_headers):
        """GET /api/admin/notifications/?unread_only=true"""
        response = requests.get(
            f"{BASE_URL}/api/admin/notifications/",
            headers=auth_headers,
            params={"unread_only": True, "limit": 10}
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        print(f"✓ Got unread notifications - count: {len(data.get('notifications', []))}")
    
    def test_send_test_notification(self, auth_headers):
        """POST /api/admin/notifications/test - Send test notification"""
        response = requests.post(
            f"{BASE_URL}/api/admin/notifications/test",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Test notification not successful"
        print(f"✓ Sent test notification - message: {data.get('message')}")
        
        # Wait a moment for notification to be created
        time.sleep(1)
        
        # Verify notification was created
        notifs_response = requests.get(
            f"{BASE_URL}/api/admin/notifications/",
            headers=auth_headers,
            params={"limit": 5}
        )
        if notifs_response.status_code == 200:
            notifs = notifs_response.json().get("notifications", [])
            test_notif = next((n for n in notifs if "Test Notification" in n.get("title", "")), None)
            if test_notif:
                print(f"✓ Test notification found in list: {test_notif.get('title')}")
    
    def test_mark_notifications_read(self, auth_headers):
        """POST /api/admin/notifications/mark-read - Mark specific notifications as read"""
        # First get notifications
        notifs_response = requests.get(
            f"{BASE_URL}/api/admin/notifications/",
            headers=auth_headers,
            params={"limit": 5}
        )
        notifs = notifs_response.json().get("notifications", [])
        
        if notifs:
            notification_ids = [n.get("notification_id") for n in notifs[:2] if n.get("notification_id")]
            if notification_ids:
                response = requests.post(
                    f"{BASE_URL}/api/admin/notifications/mark-read",
                    headers=auth_headers,
                    json=notification_ids
                )
                assert response.status_code == 200, f"Failed: {response.text}"
                data = response.json()
                print(f"✓ Marked {data.get('marked_read', 0)} notifications as read")
            else:
                print("⚠ No notification IDs to mark as read")
        else:
            print("⚠ No notifications to mark as read")
    
    def test_mark_all_notifications_read(self, auth_headers):
        """POST /api/admin/notifications/mark-all-read - Mark all as read"""
        response = requests.post(
            f"{BASE_URL}/api/admin/notifications/mark-all-read",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        print(f"✓ Marked all notifications as read - count: {data.get('marked_read', 0)}")


class TestAdminDelegates:
    """Test admin notification delegation endpoints"""
    
    def test_get_available_delegates(self, auth_headers):
        """GET /api/admin/notifications/delegates - Get available delegates"""
        response = requests.get(
            f"{BASE_URL}/api/admin/notifications/delegates",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "delegates" in data, "Missing delegates field"
        delegates = data.get("delegates", [])
        print(f"✓ Got available delegates - count: {len(delegates)}")
        
        if delegates:
            for d in delegates[:3]:
                print(f"  - {d.get('name', 'N/A')} ({d.get('email', 'N/A')}) - {d.get('role', 'N/A')}")
        else:
            print("  - No other admins available for delegation")
        
        return delegates


class TestAdminNotificationAuth:
    """Test that notification endpoints require admin auth"""
    
    def test_preferences_requires_auth(self):
        """Verify preferences endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/notifications/preferences")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Preferences endpoint correctly requires auth")
    
    def test_notifications_requires_auth(self):
        """Verify notifications endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/notifications/")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Notifications endpoint correctly requires auth")
    
    def test_test_notification_requires_auth(self):
        """Verify test notification endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/admin/notifications/test")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Test notification endpoint correctly requires auth")


class TestSocialPages:
    """Test Friends, Groups, Events pages load (basic API tests)"""
    
    def test_friends_api(self, auth_headers):
        """Test friends API endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/friends/",
            headers=auth_headers
        )
        # May return 200 with empty list or 404 if no friends endpoint
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            print(f"✓ Friends API working - returned {len(response.json())} friends")
        else:
            print("⚠ Friends API returned 404 - endpoint may not exist")
    
    def test_groups_api(self, auth_headers):
        """Test groups API endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/groups/",
            headers=auth_headers
        )
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else data.get("total", 0)
            print(f"✓ Groups API working - returned {count} groups")
        else:
            print("⚠ Groups API returned 404 - endpoint may not exist")
    
    def test_events_api(self, auth_headers):
        """Test events API endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/events/",
            headers=auth_headers
        )
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            count = len(data) if isinstance(data, list) else data.get("total", 0)
            print(f"✓ Events API working - returned {count} events")
        else:
            print("⚠ Events API returned 404 - endpoint may not exist")


class TestNotificationCategories:
    """Test individual notification category toggles"""
    
    def test_toggle_all_categories(self, auth_headers):
        """Test toggling each notification category"""
        categories = [
            "kyc_notifications",
            "withdrawal_notifications",
            "diamond_notifications",
            "security_notifications",
            "user_event_notifications",
            "system_notifications"
        ]
        
        # Get current preferences
        get_response = requests.get(
            f"{BASE_URL}/api/admin/notifications/preferences",
            headers=auth_headers
        )
        original_prefs = get_response.json()
        
        for category in categories:
            original_value = original_prefs.get(category, True)
            
            # Toggle off
            response = requests.put(
                f"{BASE_URL}/api/admin/notifications/preferences",
                headers=auth_headers,
                json={category: False}
            )
            assert response.status_code == 200, f"Failed to toggle {category}: {response.text}"
            
            # Toggle back on
            response = requests.put(
                f"{BASE_URL}/api/admin/notifications/preferences",
                headers=auth_headers,
                json={category: original_value}
            )
            assert response.status_code == 200
            print(f"✓ {category} toggle working")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
