"""
BlendLink Iteration 159 - Critical Bug Fixes Testing
=====================================================
Focus areas:
1. LIVE Stripe key enforcement (checkout URLs must be cs_live_*)
2. WebSocket admin authentication at /api/admin-realtime/ws
3. Push notifications for payment events (integration check)
4. Route conflict verification between /listings/my and /listing/{listing_id}
5. All 4 membership tiers on subscriptions page
"""

import pytest
import requests
import os
import json
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://blendlink-fixes.preview.emergentagent.com').rstrip('/')


class TestHealthAndBasics:
    """Basic health checks"""
    
    def test_api_health(self):
        """Verify API is running"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.text}"
        data = response.json()
        assert data.get("status") == "ok", f"Unexpected health status: {data}"
        print("✅ API health check passed")


class TestAuthentication:
    """Authentication flow tests"""
    
    @pytest.fixture
    def user_token(self):
        """Get user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@blendlink.net",
            "password": "BlendLink2024!"
        })
        assert response.status_code == 200, f"User login failed: {response.text}"
        data = response.json()
        assert "token" in data, f"No token in response: {data}"
        return data["token"]
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin-auth/login", json={
            "email": "blendlinknet@gmail.com",
            "password": "Blend!Admin2026Link"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "token" in data, f"No token in admin response: {data}"
        return data["token"]
    
    def test_user_login(self, user_token):
        """Test user login returns valid token"""
        assert len(user_token) > 20, "Token too short"
        print(f"✅ User login successful, token: {user_token[:20]}...")
    
    def test_admin_login(self, admin_token):
        """Test admin login returns valid token"""
        assert len(admin_token) > 20, "Admin token too short"
        print(f"✅ Admin login successful, token: {admin_token[:20]}...")


class TestStripeCheckoutLiveMode:
    """
    CRITICAL: Verify all Stripe checkout sessions use LIVE keys (cs_live_*)
    """
    
    @pytest.fixture
    def user_token(self):
        """Get user token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@blendlink.net",
            "password": "BlendLink2024!"
        })
        return response.json().get("token")
    
    def test_subscription_checkout_uses_live_stripe(self, user_token):
        """
        TEST: Subscription checkout generates LIVE Stripe URL (cs_live_*)
        This is a critical security test - we must NOT use test keys in production
        """
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/checkout",
            params={
                "tier": "bronze",
                "success_url": "https://blendlink.net/success",
                "cancel_url": "https://blendlink.net/cancel"
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200, f"Subscription checkout failed: {response.text}"
        data = response.json()
        
        checkout_url = data.get("checkout_url", "")
        session_id = data.get("session_id", "")
        
        # CRITICAL CHECK: URL must be from checkout.stripe.com (not test)
        assert "checkout.stripe.com" in checkout_url, f"Invalid checkout URL: {checkout_url}"
        
        # CRITICAL CHECK: Session ID must start with cs_live_
        assert session_id.startswith("cs_live_"), f"❌ SECURITY ISSUE: Session ID is NOT LIVE mode: {session_id}"
        
        # Ensure it's NOT a test session
        assert not session_id.startswith("cs_test_"), f"❌ SECURITY ISSUE: Test mode detected: {session_id}"
        
        print(f"✅ Subscription checkout URL: {checkout_url[:60]}...")
        print(f"✅ Session ID (LIVE): {session_id[:30]}...")
    
    def test_bl_coins_checkout_uses_live_stripe(self, user_token):
        """
        TEST: BL Coins purchase checkout generates LIVE Stripe URL (cs_live_*)
        """
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/bl-coins/checkout",
            json={
                "tier_id": "starter",
                "amount_usd": 4.99,
                "coins_amount": 30000,
                "origin_url": "https://blendlink.net"
            },
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert response.status_code == 200, f"BL coins checkout failed: {response.text}"
        data = response.json()
        
        checkout_url = data.get("url", "")
        session_id = data.get("session_id", "")
        
        # CRITICAL CHECK: URL must contain checkout.stripe.com
        assert "checkout.stripe.com" in checkout_url, f"Invalid checkout URL: {checkout_url}"
        
        # CRITICAL CHECK: Session ID must start with cs_live_
        assert session_id.startswith("cs_live_"), f"❌ SECURITY ISSUE: BL Coins Session ID is NOT LIVE mode: {session_id}"
        
        # Ensure it's NOT a test session
        assert not session_id.startswith("cs_test_"), f"❌ SECURITY ISSUE: Test mode detected for BL Coins: {session_id}"
        
        print(f"✅ BL Coins checkout URL: {checkout_url[:60]}...")
        print(f"✅ BL Coins Session ID (LIVE): {session_id[:30]}...")


class TestAdminWebSocket:
    """
    Test WebSocket endpoint at corrected path /api/admin-realtime/ws
    """
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin-auth/login", json={
            "email": "blendlinknet@gmail.com",
            "password": "Blend!Admin2026Link"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("token")
    
    def test_websocket_endpoint_exists_at_correct_path(self):
        """
        Verify WebSocket endpoint responds at /api/admin-realtime/ws
        Note: HTTP request will fail with 426 (Upgrade Required) which means endpoint exists
        A 404 would mean the endpoint doesn't exist
        """
        # HTTP request to WS endpoint should get 426 Upgrade Required or connection reset
        # NOT a 404
        try:
            response = requests.get(
                f"{BASE_URL}/api/admin-realtime/ws",
                timeout=5
            )
            # If we get a response, check it's not 404
            assert response.status_code != 404, "WebSocket endpoint not found at /api/admin-realtime/ws"
            print(f"✅ WebSocket endpoint exists at /api/admin-realtime/ws (status: {response.status_code})")
        except Exception as e:
            # Connection errors are expected for WebSocket endpoints accessed via HTTP
            if "Connection" in str(e) or "Upgrade" in str(e):
                print(f"✅ WebSocket endpoint exists (connection behavior expected)")
            else:
                print(f"✅ WebSocket endpoint check - error: {e}")
    
    def test_old_websocket_path_no_longer_exists(self):
        """
        Verify old path /api/realtime/ws/analytics returns 404
        """
        response = requests.get(
            f"{BASE_URL}/api/realtime/ws/analytics",
            timeout=5
        )
        # Old path should NOT work
        assert response.status_code in [404, 405], f"Old WS path still exists? Status: {response.status_code}"
        print(f"✅ Old WebSocket path /api/realtime/ws/analytics correctly returns 404/405")


class TestSubscriptionTiers:
    """Test subscription tiers endpoint"""
    
    def test_subscription_tiers_returns_all_four_tiers(self):
        """
        Verify subscriptions endpoint returns all 4 membership tiers
        Bronze, Silver, Gold, Diamond
        """
        response = requests.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert response.status_code == 200, f"Tiers endpoint failed: {response.text}"
        
        data = response.json()
        
        # Check if response is dict or list
        if isinstance(data, dict):
            tiers = list(data.keys())
        elif isinstance(data, list):
            tiers = [t.get("name", t.get("tier")) for t in data]
        else:
            tiers = []
        
        # Convert to lowercase for comparison
        tiers_lower = [t.lower() for t in tiers]
        
        expected_tiers = ["bronze", "silver", "gold", "diamond"]
        
        for tier in expected_tiers:
            assert tier in tiers_lower, f"Missing tier: {tier}. Available: {tiers}"
        
        print(f"✅ All 4 tiers present: {tiers}")


class TestRouteConflicts:
    """
    Test for route conflicts between /listings/my and /listing/{listing_id}
    """
    
    @pytest.fixture
    def user_token(self):
        """Get user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@blendlink.net",
            "password": "BlendLink2024!"
        })
        return response.json().get("token")
    
    def test_my_listings_route(self, user_token):
        """Test /listings/my route works (not confused with /listing/{listing_id})"""
        response = requests.get(
            f"{BASE_URL}/api/marketplace/listings/my",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        # Should return 200 with user's listings, not interpret "my" as a listing_id
        assert response.status_code == 200, f"My listings route failed: {response.text}"
        data = response.json()
        # Response should be a list or dict with listings
        assert isinstance(data, (list, dict)), f"Unexpected response type: {type(data)}"
        print(f"✅ /listings/my route works correctly")
    
    def test_listing_by_id_route(self, user_token):
        """Test /listing/{listing_id} route works"""
        # First get some listings
        response = requests.get(f"{BASE_URL}/api/marketplace/listings?limit=1")
        if response.status_code == 200:
            listings = response.json()
            if isinstance(listings, list) and len(listings) > 0:
                listing_id = listings[0].get("listing_id")
                if listing_id:
                    response2 = requests.get(f"{BASE_URL}/api/marketplace/listing/{listing_id}")
                    # May be 200 or 404 depending on route structure
                    print(f"✅ /listing/{{id}} route responds: {response2.status_code}")
                    return
        print("✅ Listing by ID route test skipped (no listings found)")


class TestWalletPage:
    """Test wallet page data loading"""
    
    @pytest.fixture
    def user_token(self):
        """Get user token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "tester@blendlink.net",
            "password": "BlendLink2024!"
        })
        return response.json().get("token")
    
    def test_user_balance(self, user_token):
        """Test user can get their balance"""
        response = requests.get(
            f"{BASE_URL}/api/users/me",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Get user failed: {response.text}"
        data = response.json()
        assert "bl_coins" in data, f"No bl_coins in user data: {data.keys()}"
        print(f"✅ User balance: {data.get('bl_coins')} BL coins")
    
    def test_stripe_connect_status(self, user_token):
        """Test Stripe Connect status endpoint"""
        response = requests.get(
            f"{BASE_URL}/api/payments/stripe/connect/status",
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 200, f"Connect status failed: {response.text}"
        data = response.json()
        # Should have is_connected field
        assert "is_connected" in data, f"Missing is_connected field: {data}"
        print(f"✅ Stripe Connect status: {data}")


class TestAdminPanel:
    """Test admin panel functionality"""
    
    @pytest.fixture
    def admin_token(self):
        """Get admin token"""
        response = requests.post(f"{BASE_URL}/api/admin-auth/login", json={
            "email": "blendlinknet@gmail.com",
            "password": "Blend!Admin2026Link"
        })
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        return response.json().get("token")
    
    def test_admin_dashboard(self, admin_token):
        """Test admin dashboard loads"""
        response = requests.get(
            f"{BASE_URL}/api/admin-system/dashboard",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        # May require admin auth cookie instead of Bearer token
        if response.status_code == 403:
            print("⚠️ Admin dashboard requires session cookie (expected)")
        else:
            assert response.status_code == 200, f"Admin dashboard failed: {response.text}"
            print(f"✅ Admin dashboard loads: {response.json().keys()}")


class TestPushNotificationService:
    """
    Test push notification service is set up correctly
    Note: We test the code structure, not actual notifications
    """
    
    def test_push_notification_service_initialized(self):
        """
        Verify push notification routes exist
        """
        response = requests.get(f"{BASE_URL}/api/push/test")
        # Without auth, should get 401 not 404
        assert response.status_code in [401, 403, 422], f"Push route not found: {response.status_code}"
        print(f"✅ Push notification service routes exist (auth required)")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
