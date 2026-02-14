"""
Monetization and Membership Features Tests

Tests for:
1. Subscription scheduler status endpoint
2. Admin Membership Tiers API
3. Admin Promo Codes API
4. Admin Transaction Monitor API
5. Stripe Connect status API
6. BL Coins purchase endpoints
7. Membership subscription endpoints
"""

import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestSubscriptionScheduler:
    """Test subscription scheduler endpoints"""
    
    def test_scheduler_status_endpoint_returns_running(self):
        """GET /api/admin/subscription-scheduler/status - Should return running scheduler with both jobs"""
        response = requests.get(f"{BASE_URL}/api/admin/subscription-scheduler/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "running" in data, "Response should have 'running' field"
        assert "jobs" in data, "Response should have 'jobs' field"
        assert data["running"] == True, "Scheduler should be running"
        
        # Verify both jobs are configured
        job_ids = [job["id"] for job in data["jobs"]]
        assert "subscription_renewals" in job_ids, "subscription_renewals job should be configured"
        assert "payment_retries" in job_ids, "payment_retries job should be configured"
        
        # Verify job details
        for job in data["jobs"]:
            assert "id" in job, "Job should have 'id'"
            assert "name" in job, "Job should have 'name'"
            assert "next_run" in job, "Job should have 'next_run'"
            assert "trigger" in job, "Job should have 'trigger'"
        
        print(f"✓ Scheduler is running with {len(data['jobs'])} jobs configured")


class TestAdminMembershipTiers:
    """Test admin membership tier management endpoints"""
    
    def test_membership_tiers_requires_auth(self):
        """GET /api/admin/membership/tiers - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/membership/tiers")
        
        # Should return 401 Unauthorized without token
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Membership tiers endpoint requires authentication")
    
    def test_membership_tiers_with_invalid_token(self):
        """GET /api/admin/membership/tiers - Should reject invalid token"""
        headers = {"Authorization": "Bearer invalid_token_123"}
        response = requests.get(f"{BASE_URL}/api/admin/membership/tiers", headers=headers)
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Membership tiers endpoint rejects invalid token")


class TestAdminPromoCodes:
    """Test admin promo code management endpoints"""
    
    def test_promo_codes_requires_auth(self):
        """GET /api/admin/membership/promo-codes - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/membership/promo-codes")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Promo codes endpoint requires authentication")
    
    def test_promo_codes_create_requires_auth(self):
        """POST /api/admin/membership/promo-codes - Should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/admin/membership/promo-codes",
            json={"code": "TEST123", "discount_type": "percentage", "discount_value": 10}
        )
        
        assert response.status_code in [401, 403, 422], f"Expected 401/403/422, got {response.status_code}"
        print("✓ Promo code creation requires authentication")


class TestAdminTransactionMonitor:
    """Test admin transaction monitoring endpoints"""
    
    def test_transactions_requires_auth(self):
        """GET /api/admin/membership/transactions - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/membership/transactions")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Transactions endpoint requires authentication")
    
    def test_flagged_transactions_requires_auth(self):
        """GET /api/admin/membership/transactions/flagged - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/admin/membership/transactions/flagged")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Flagged transactions endpoint requires authentication")


class TestStripeConnectStatus:
    """Test Stripe connect status endpoints"""
    
    def test_stripe_connect_status_requires_auth(self):
        """GET /api/payments/stripe/connect/status - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/connect/status")
        
        # Should require auth
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Stripe connect status requires authentication")


class TestBLCoinsPurchase:
    """Test BL coins purchase endpoints"""
    
    def test_bl_coins_purchase_from_balance_requires_auth(self):
        """POST /api/payments/stripe/bl-coins/purchase-from-balance - Should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/bl-coins/purchase-from-balance",
            json={"package_id": "starter", "quantity": 1}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ BL coins purchase from balance requires authentication")


class TestMembershipSubscription:
    """Test membership subscription endpoints"""
    
    def test_subscribe_from_balance_requires_auth(self):
        """POST /api/payments/stripe/subscriptions/subscribe-from-balance - Should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/subscriptions/subscribe-from-balance",
            json={"tier": "bronze"}
        )
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Subscribe from balance requires authentication")
    
    def test_subscribe_validates_tier(self):
        """POST /api/payments/stripe/subscriptions/subscribe-from-balance - Should validate tier"""
        response = requests.post(
            f"{BASE_URL}/api/payments/stripe/subscriptions/subscribe-from-balance",
            json={"tier": "invalid_tier_xyz"}
        )
        
        # Should return 401 (auth) or 400/422 (validation)
        assert response.status_code in [400, 401, 403, 422], f"Expected 400/401/403/422, got {response.status_code}"
        print("✓ Subscribe endpoint validates tier or requires auth first")
    
    def test_current_subscription_requires_auth(self):
        """GET /api/payments/stripe/subscriptions/current - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/payments/stripe/subscriptions/current")
        
        assert response.status_code in [401, 403, 404], f"Expected 401/403/404, got {response.status_code}"
        print("✓ Current subscription endpoint requires authentication")


class TestMarketplaceListingEndpoints:
    """Test marketplace listing related endpoints"""
    
    def test_my_listings_requires_auth(self):
        """GET /api/marketplace/listings/my - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/marketplace/listings/my")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ My listings endpoint requires authentication")


class TestWalletEndpoints:
    """Test wallet related endpoints"""
    
    def test_wallet_balance_requires_auth(self):
        """GET /api/wallet/balance - Should require authentication"""
        response = requests.get(f"{BASE_URL}/api/wallet/balance")
        
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Wallet balance endpoint requires authentication")


# Test summary
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
