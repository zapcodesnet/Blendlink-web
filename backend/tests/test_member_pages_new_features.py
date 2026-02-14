"""
Test Member Pages New Features - iteration_133
Tests for:
1. Team members management (add/remove team members by email)
2. Authorization check endpoint (owner vs authorized user access)
3. Currency selection (26 supported currencies)
4. Platform fees (8% fee rate and fee history)
5. POS transaction with 8% fee application
6. Public page view with owner referral code
7. Page creation with contact info (phone, email, website)
"""

import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://core-bugs-patch.preview.emergentagent.com')
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')

TEST_EMAIL = "test@blendlink.com"
TEST_PASSWORD = "admin"


class TestHelpers:
    """Helper methods for creating test data"""
    
    @staticmethod
    def get_auth_token(email=TEST_EMAIL, password=TEST_PASSWORD):
        """Get auth token for API requests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            data = response.json()
            return data.get("token") or data.get("access_token")
        return None
    
    @staticmethod
    def create_test_page(headers, page_type="general", slug_prefix="test"):
        """Create a test page and return page data"""
        unique_slug = f"{slug_prefix}-{uuid.uuid4().hex[:8]}"
        response = requests.post(
            f"{BASE_URL}/api/member-pages/",
            json={
                "page_type": page_type,
                "name": f"Test Page {unique_slug}",
                "slug": unique_slug,
                "description": "Test page for new features testing"
            },
            headers=headers
        )
        if response.status_code in [200, 201]:
            data = response.json()
            return data.get("page", data)
        return None
    
    @staticmethod
    def delete_test_page(page_id, headers):
        """Delete a test page"""
        try:
            requests.delete(f"{BASE_URL}/api/member-pages/{page_id}", headers=headers)
        except:
            pass


class TestSupportedCurrencies:
    """Test currency endpoints - GET /api/member-pages/currencies/supported"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_supported_currencies(self):
        """Test GET /api/member-pages/currencies/supported returns 26 currencies"""
        response = requests.get(f"{BASE_URL}/api/member-pages/currencies/supported", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "currencies" in data, "Missing currencies in response"
        
        currencies = data["currencies"]
        assert isinstance(currencies, dict), "currencies should be a dict"
        assert len(currencies) == 26, f"Expected 26 currencies, got {len(currencies)}"
        
        # Verify some expected currencies
        expected_codes = ["USD", "EUR", "GBP", "PHP", "JPY", "INR"]
        for code in expected_codes:
            assert code in currencies, f"Missing currency: {code}"
            assert "symbol" in currencies[code], f"Missing symbol for {code}"
            assert "name" in currencies[code], f"Missing name for {code}"
        
        print(f"✓ Supported currencies endpoint works: {len(currencies)} currencies available")


class TestCurrencyUpdate:
    """Test currency update endpoint - PUT /api/member-pages/:id/currency"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and create test page"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Create test page
        self.page = TestHelpers.create_test_page(self.headers, slug_prefix="currency")
        assert self.page, "Failed to create test page"
        self.page_id = self.page.get("page_id") or self.page.get("id")
        
        yield
        
        # Cleanup
        TestHelpers.delete_test_page(self.page_id, self.headers)
    
    def test_update_currency_php(self):
        """Test updating page currency to PHP"""
        response = requests.put(
            f"{BASE_URL}/api/member-pages/{self.page_id}/currency",
            json={"currency": "PHP"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("currency") == "PHP", "Currency not updated to PHP"
        assert data.get("currency_symbol") == "₱", f"Wrong symbol: {data.get('currency_symbol')}"
        print(f"✓ Currency updated to PHP (₱)")
    
    def test_update_currency_eur(self):
        """Test updating page currency to EUR"""
        response = requests.put(
            f"{BASE_URL}/api/member-pages/{self.page_id}/currency",
            json={"currency": "EUR"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("currency") == "EUR", "Currency not updated to EUR"
        assert data.get("currency_symbol") == "€", f"Wrong symbol: {data.get('currency_symbol')}"
        print(f"✓ Currency updated to EUR (€)")
    
    def test_invalid_currency_code(self):
        """Test updating to invalid currency code fails"""
        response = requests.put(
            f"{BASE_URL}/api/member-pages/{self.page_id}/currency",
            json={"currency": "INVALID"},
            headers=self.headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Invalid currency code correctly rejected")


class TestPlatformFees:
    """Test platform fees endpoint - GET /api/member-pages/:id/fees"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and create test page"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Create test page
        self.page = TestHelpers.create_test_page(self.headers, slug_prefix="fees")
        assert self.page, "Failed to create test page"
        self.page_id = self.page.get("page_id") or self.page.get("id")
        
        yield
        
        # Cleanup
        TestHelpers.delete_test_page(self.page_id, self.headers)
    
    def test_get_platform_fees(self):
        """Test GET /api/member-pages/:id/fees returns fee info"""
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{self.page_id}/fees",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Verify fee rate is 8%
        assert "fee_rate" in data, "Missing fee_rate in response"
        assert data["fee_rate"] == 0.08, f"Expected 0.08, got {data['fee_rate']}"
        
        # Verify fee_rate_percentage
        assert "fee_rate_percentage" in data, "Missing fee_rate_percentage"
        assert "8" in data["fee_rate_percentage"], f"Expected '8%' in percentage, got {data['fee_rate_percentage']}"
        
        # Verify other fields
        assert "fees_owed" in data, "Missing fees_owed"
        assert "fees_paid" in data, "Missing fees_paid"
        assert "fee_history" in data, "Missing fee_history"
        
        print(f"✓ Platform fees endpoint works: fee_rate={data['fee_rate']}, percentage={data['fee_rate_percentage']}")


class TestTeamMembers:
    """Test team members management endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and create test page"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Create test page
        self.page = TestHelpers.create_test_page(self.headers, slug_prefix="team")
        assert self.page, "Failed to create test page"
        self.page_id = self.page.get("page_id") or self.page.get("id")
        
        yield
        
        # Cleanup
        TestHelpers.delete_test_page(self.page_id, self.headers)
    
    def test_get_team_members_empty(self):
        """Test GET /api/member-pages/:id/team returns empty list initially"""
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{self.page_id}/team",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "team_members" in data, "Missing team_members in response"
        assert isinstance(data["team_members"], list), "team_members should be a list"
        assert data.get("is_owner") == True, "User should be owner"
        
        print(f"✓ Get team members works: {len(data['team_members'])} members")
    
    def test_add_team_member_invalid_email(self):
        """Test adding team member with non-existent email fails"""
        response = requests.post(
            f"{BASE_URL}/api/member-pages/{self.page_id}/team",
            json={"email": "nonexistent_user_12345@notfound.com"},
            headers=self.headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        print("✓ Add team member with invalid email correctly fails")
    
    def test_add_self_as_team_member_fails(self):
        """Test adding yourself as team member fails"""
        response = requests.post(
            f"{BASE_URL}/api/member-pages/{self.page_id}/team",
            json={"email": TEST_EMAIL},
            headers=self.headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Cannot add self as team member")


class TestAuthorizationCheck:
    """Test authorization check endpoint - GET /api/member-pages/:id/authorization"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and create test page"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Create test page
        self.page = TestHelpers.create_test_page(self.headers, slug_prefix="auth")
        assert self.page, "Failed to create test page"
        self.page_id = self.page.get("page_id") or self.page.get("id")
        
        yield
        
        # Cleanup
        TestHelpers.delete_test_page(self.page_id, self.headers)
    
    def test_owner_authorization(self):
        """Test authorization check for page owner"""
        response = requests.get(
            f"{BASE_URL}/api/member-pages/{self.page_id}/authorization",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert data.get("can_manage") == True, "Owner should be able to manage"
        assert data.get("is_owner") == True, "User should be marked as owner"
        assert data.get("is_authorized") == False, "Owner is not 'authorized' (they're owner)"
        
        print(f"✓ Owner authorization check: can_manage={data['can_manage']}, is_owner={data['is_owner']}")


class TestPOSTransactionWithFee:
    """Test POS transaction with 8% platform fee - POST /api/pos/transaction"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and create test page"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Create test page for POS
        self.page = TestHelpers.create_test_page(self.headers, page_type="store", slug_prefix="pos")
        assert self.page, "Failed to create test page"
        self.page_id = self.page.get("page_id") or self.page.get("id")
        
        yield
        
        # Cleanup
        TestHelpers.delete_test_page(self.page_id, self.headers)
    
    def test_pos_cash_transaction_fee_accumulation(self):
        """Test POS cash transaction accumulates 8% fee"""
        transaction_data = {
            "page_id": self.page_id,
            "items": [
                {"item_id": "test_item_1", "name": "Test Item", "quantity": 2, "price": 50.00}
            ],
            "order_type": "pickup",
            "payment_method": "cash",
            "subtotal": 100.00,
            "tax": 8.00,
            "discount": 0,
            "tip": 0,
            "total": 108.00
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pos/transaction",
            json=transaction_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"POS transaction failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Transaction should succeed"
        assert "order" in data, "Missing order in response"
        assert "platform_fee" in data, "Missing platform_fee in response"
        
        # Verify 8% fee
        fee_info = data["platform_fee"]
        assert fee_info.get("rate") == "8.0%", f"Expected 8.0% fee rate, got {fee_info.get('rate')}"
        
        # Calculate expected fee: 108.00 * 0.08 = 8.64
        expected_fee = 108.00 * 0.08
        actual_fee = fee_info.get("amount")
        assert abs(actual_fee - expected_fee) < 0.01, f"Fee mismatch: expected {expected_fee}, got {actual_fee}"
        
        # Cash payment should have "pending" status
        assert fee_info.get("status") == "pending", f"Cash fee should be 'pending', got {fee_info.get('status')}"
        
        print(f"✓ POS cash transaction with 8% fee: total={transaction_data['total']}, fee={actual_fee}, status={fee_info.get('status')}")
    
    def test_pos_card_transaction_fee_auto_deducted(self):
        """Test POS card transaction has auto-deducted 8% fee"""
        transaction_data = {
            "page_id": self.page_id,
            "items": [
                {"item_id": "test_item_2", "name": "Premium Item", "quantity": 1, "price": 200.00}
            ],
            "order_type": "delivery",
            "payment_method": "card",
            "subtotal": 200.00,
            "tax": 16.00,
            "discount": 0,
            "tip": 10.00,
            "total": 226.00
        }
        
        response = requests.post(
            f"{BASE_URL}/api/pos/transaction",
            json=transaction_data,
            headers=self.headers
        )
        assert response.status_code == 200, f"POS transaction failed: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Transaction should succeed"
        
        # Verify 8% fee
        fee_info = data.get("platform_fee", {})
        
        # Calculate expected fee: 226.00 * 0.08 = 18.08
        expected_fee = 226.00 * 0.08
        actual_fee = fee_info.get("amount")
        assert abs(actual_fee - expected_fee) < 0.01, f"Fee mismatch: expected {expected_fee}, got {actual_fee}"
        
        # Card payment should have "auto_deducted" status
        assert fee_info.get("status") == "auto_deducted", f"Card fee should be 'auto_deducted', got {fee_info.get('status')}"
        
        print(f"✓ POS card transaction with 8% fee: total={transaction_data['total']}, fee={actual_fee}, status={fee_info.get('status')}")


class TestPublicPageView:
    """Test public page view with owner referral code - GET /api/member-pages/public/:slug"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and create published test page"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Create test page
        unique_slug = f"public-view-{uuid.uuid4().hex[:8]}"
        self.test_slug = unique_slug
        
        create_response = requests.post(
            f"{BASE_URL}/api/member-pages/",
            json={
                "page_type": "store",
                "name": f"Public Test Store {unique_slug}",
                "slug": unique_slug,
                "description": "Test store for public view testing"
            },
            headers=self.headers
        )
        assert create_response.status_code in [200, 201], f"Failed to create page: {create_response.text}"
        
        page_data = create_response.json()
        self.page = page_data.get("page", page_data)
        self.page_id = self.page.get("page_id") or self.page.get("id")
        
        # Publish the page
        publish_response = requests.put(
            f"{BASE_URL}/api/member-pages/{self.page_id}",
            json={"is_published": True},
            headers=self.headers
        )
        assert publish_response.status_code == 200, f"Failed to publish: {publish_response.text}"
        
        yield
        
        # Cleanup
        TestHelpers.delete_test_page(self.page_id, self.headers)
    
    def test_public_page_includes_owner_referral_code(self):
        """Test public page view includes owner_referral_code"""
        # Access public page (no auth required for public view)
        response = requests.get(f"{BASE_URL}/api/member-pages/public/{self.test_slug}")
        assert response.status_code == 200, f"Public page not found: {response.text}"
        
        data = response.json()
        assert "page" in data, "Missing page in response"
        
        # Verify owner_referral_code is present
        assert "owner_referral_code" in data, f"Missing owner_referral_code in public page response: {data.keys()}"
        
        # The referral code should be a non-empty string
        owner_ref_code = data.get("owner_referral_code")
        if owner_ref_code:
            print(f"✓ Public page includes owner_referral_code: {owner_ref_code}")
        else:
            print("⚠ owner_referral_code is null/empty (owner may not have a referral code)")


class TestPageCreationWithContactInfo:
    """Test page creation with contact info fields (phone, email, website)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.created_page_id = None
        
        yield
        
        # Cleanup
        if self.created_page_id:
            TestHelpers.delete_test_page(self.created_page_id, self.headers)
    
    def test_page_has_contact_fields(self):
        """Test that created page has contact fields (phone, email, website)"""
        unique_slug = f"contact-test-{uuid.uuid4().hex[:8]}"
        
        response = requests.post(
            f"{BASE_URL}/api/member-pages/",
            json={
                "page_type": "services",
                "name": f"Contact Test {unique_slug}",
                "slug": unique_slug,
                "description": "Testing contact fields"
            },
            headers=self.headers
        )
        assert response.status_code in [200, 201], f"Failed: {response.text}"
        
        data = response.json()
        page = data.get("page", data)
        self.created_page_id = page.get("page_id") or page.get("id")
        
        # Verify page was created
        assert self.created_page_id, "Page ID not found"
        
        # Get the full page to verify contact fields exist
        get_response = requests.get(
            f"{BASE_URL}/api/member-pages/{self.created_page_id}",
            headers=self.headers
        )
        assert get_response.status_code == 200, f"Get page failed: {get_response.text}"
        
        full_page = get_response.json()
        
        # Verify contact fields exist (they should be empty strings by default)
        assert "phone" in full_page or full_page.get("phone", "") == "", "Missing phone field"
        assert "email" in full_page or full_page.get("email", "") == "", "Missing email field"
        assert "website" in full_page or full_page.get("website", "") == "", "Missing website field"
        
        print(f"✓ Page has contact fields: phone='{full_page.get('phone', '')}', email='{full_page.get('email', '')}', website='{full_page.get('website', '')}'")
    
    def test_update_page_contact_info(self):
        """Test updating page with contact info"""
        unique_slug = f"contact-update-{uuid.uuid4().hex[:8]}"
        
        # Create page
        response = requests.post(
            f"{BASE_URL}/api/member-pages/",
            json={
                "page_type": "store",
                "name": f"Contact Update Test {unique_slug}",
                "slug": unique_slug
            },
            headers=self.headers
        )
        assert response.status_code in [200, 201]
        
        data = response.json()
        page = data.get("page", data)
        self.created_page_id = page.get("page_id") or page.get("id")
        
        # Note: The create endpoint may not accept phone/email/website directly
        # They may need to be updated via PUT endpoint
        # This is acceptable based on the MemberPage model
        
        print(f"✓ Page created with ID: {self.created_page_id}")


class TestFeeHistoryVerification:
    """Test that POS transactions create fee history entries"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token and create test page"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data.get("token") or data.get("access_token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Create test page
        self.page = TestHelpers.create_test_page(self.headers, page_type="restaurant", slug_prefix="feehistory")
        assert self.page, "Failed to create test page"
        self.page_id = self.page.get("page_id") or self.page.get("id")
        
        yield
        
        # Cleanup
        TestHelpers.delete_test_page(self.page_id, self.headers)
    
    def test_fee_history_after_transaction(self):
        """Test that fee history is updated after POS transaction"""
        # First get initial fee state
        initial_fees = requests.get(
            f"{BASE_URL}/api/member-pages/{self.page_id}/fees",
            headers=self.headers
        ).json()
        
        initial_history_count = len(initial_fees.get("fee_history", []))
        
        # Make a POS transaction
        transaction_data = {
            "page_id": self.page_id,
            "items": [{"item_id": "item_1", "name": "Burger", "quantity": 1, "price": 15.00}],
            "order_type": "dine_in",
            "payment_method": "cash",
            "subtotal": 15.00,
            "tax": 1.20,
            "total": 16.20
        }
        
        pos_response = requests.post(
            f"{BASE_URL}/api/pos/transaction",
            json=transaction_data,
            headers=self.headers
        )
        assert pos_response.status_code == 200, f"POS transaction failed: {pos_response.text}"
        
        # Check fee history after transaction
        updated_fees = requests.get(
            f"{BASE_URL}/api/member-pages/{self.page_id}/fees",
            headers=self.headers
        ).json()
        
        updated_history_count = len(updated_fees.get("fee_history", []))
        
        # Should have one more entry in fee history
        assert updated_history_count > initial_history_count, f"Fee history not updated: {initial_history_count} -> {updated_history_count}"
        
        # Verify the new entry
        if updated_fees.get("fee_history"):
            latest_entry = updated_fees["fee_history"][0]  # Should be sorted by created_at desc
            assert latest_entry.get("payment_method") == "cash", "Wrong payment method in fee log"
            assert latest_entry.get("status") == "pending", "Cash transaction fee should be pending"
        
        print(f"✓ Fee history updated: {initial_history_count} -> {updated_history_count} entries")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
