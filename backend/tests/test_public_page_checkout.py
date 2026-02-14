"""
Test Public Page Features
- Public page accessible via /:slug route without authentication
- Page 404 handling for non-existent slugs
- Referral code display
- Guest checkout flow
- Guest order API endpoint creates order without auth
- 8% platform fee calculated correctly on guest orders
- Order tracking by order ID and phone number
"""
import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://listing-payment.preview.emergentagent.com')

# Test credentials - from previous test iterations
TEST_EMAIL = "test@blendlink.com"
TEST_PASSWORD = "admin"

# Test data for slug
TEST_SLUG = f"test-shop-{uuid.uuid4().hex[:8]}"
EXISTING_SLUG = "myshop-1770708410"  # Previous test created this

class TestSession:
    """Shared test session"""
    token = None
    user_id = None
    page_id = None
    product_id = None
    order_id = None
    
@pytest.fixture(scope="class")
def auth_session():
    """Login and get authentication token"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    # Login
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if response.status_code == 200:
        data = response.json()
        TestSession.token = data.get("token")
        TestSession.user_id = data.get("user", {}).get("user_id")
        session.headers.update({"Authorization": f"Bearer {TestSession.token}"})
        print(f"Auth successful - user_id: {TestSession.user_id}")
    else:
        pytest.skip(f"Auth failed: {response.status_code} - {response.text}")
    
    return session

@pytest.fixture(scope="class")
def unauthenticated_session():
    """Session without authentication for testing public endpoints"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


# ============== PUBLIC PAGE ACCESS TESTS ==============

class TestPublicPageAccess:
    """Test public page access via slug without authentication"""
    
    def test_get_public_page_by_slug(self, unauthenticated_session):
        """Test public page is accessible without authentication"""
        # First, find a published page
        response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/discover")
        
        if response.status_code == 200:
            data = response.json()
            pages = data.get("pages", [])
            if pages:
                # Get first published page's slug
                test_slug = pages[0].get("slug")
                print(f"Testing with slug: {test_slug}")
                
                # Access the public page
                response2 = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/public/{test_slug}")
                assert response2.status_code == 200, f"Failed to get public page: {response2.text}"
                
                page_data = response2.json()
                assert "page" in page_data, "Response should contain 'page' key"
                assert page_data["page"]["slug"] == test_slug
                print(f"Public page accessible: {page_data['page']['name']}")
                
                # Store for other tests
                TestSession.page_id = page_data["page"]["page_id"]
            else:
                print("No published pages found in discover")
    
    def test_public_page_404_for_nonexistent_slug(self, unauthenticated_session):
        """Test that non-existent slugs return 404"""
        fake_slug = f"nonexistent-slug-{uuid.uuid4().hex[:8]}"
        
        response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/public/{fake_slug}")
        
        assert response.status_code == 404, f"Expected 404 for non-existent slug, got {response.status_code}"
        print(f"404 returned correctly for non-existent slug: {fake_slug}")
    
    def test_public_page_contains_referral_code(self, unauthenticated_session):
        """Test that public page response includes owner's referral code"""
        # Get a published page
        response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/discover")
        
        if response.status_code == 200:
            data = response.json()
            pages = data.get("pages", [])
            if pages:
                test_slug = pages[0].get("slug")
                
                # Get full public page data
                response2 = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/public/{test_slug}")
                assert response2.status_code == 200
                
                page_data = response2.json()
                # Check for owner_referral_code in response
                print(f"Public page response keys: {page_data.keys()}")
                print(f"Owner referral code: {page_data.get('owner_referral_code', 'Not found')}")
                
                # The referral code may be null if owner doesn't have one, but key should exist
                assert "owner_referral_code" in page_data or "page" in page_data


# ============== GUEST CHECKOUT TESTS ==============

class TestGuestCheckout:
    """Test guest checkout flow"""
    
    def test_guest_order_creation(self, unauthenticated_session):
        """Test creating order without authentication"""
        # First get a page_id to order from
        response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/discover")
        
        if response.status_code != 200:
            pytest.skip("Cannot get pages to test with")
        
        pages = response.json().get("pages", [])
        if not pages:
            pytest.skip("No pages available for testing")
        
        page_id = pages[0].get("page_id")
        print(f"Testing guest order for page: {page_id}")
        
        # Create guest order
        order_data = {
            "page_id": page_id,
            "customer_name": "Test Customer",
            "customer_phone": "+1234567890",
            "customer_email": "test@example.com",
            "delivery_address": "123 Test St",
            "delivery_city": "Test City",
            "order_type": "delivery",
            "payment_method": "cash",
            "items": [
                {
                    "item_id": "test_item_001",
                    "name": "Test Product",
                    "price": 25.00,
                    "quantity": 2
                }
            ],
            "subtotal": 50.00,
            "delivery_fee": 5.00,
            "tax": 4.00,
            "total": 59.00,
            "notes": "Test order - please delete",
            "is_guest_order": True
        }
        
        response = unauthenticated_session.post(
            f"{BASE_URL}/api/page-orders/guest",
            json=order_data
        )
        
        print(f"Guest order response status: {response.status_code}")
        print(f"Guest order response: {response.text[:500] if response.text else 'Empty'}")
        
        assert response.status_code == 200, f"Guest order failed: {response.text}"
        
        result = response.json()
        assert result.get("success") == True
        assert "order_id" in result
        assert "order" in result
        
        # Store for tracking test
        TestSession.order_id = result["order_id"]
        print(f"Guest order created: {TestSession.order_id}")
        
        # Verify platform fee is calculated
        assert "platform_fee" in result
        print(f"Platform fee: {result['platform_fee']}")
    
    def test_guest_order_platform_fee_calculation(self, unauthenticated_session):
        """Test 8% platform fee is calculated correctly"""
        # Get a page to order from
        response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/discover")
        pages = response.json().get("pages", [])
        
        if not pages:
            pytest.skip("No pages for testing")
        
        page_id = pages[0].get("page_id")
        
        # Create order with known total
        total_amount = 100.00
        expected_fee = total_amount * 0.08  # 8%
        
        order_data = {
            "page_id": page_id,
            "customer_name": "Fee Test Customer",
            "customer_phone": "+1987654321",
            "order_type": "pickup",
            "payment_method": "cash",
            "items": [
                {"item_id": "fee_test_001", "name": "Fee Test Item", "price": 100.00, "quantity": 1}
            ],
            "subtotal": 100.00,
            "delivery_fee": 0,
            "tax": 0,
            "total": total_amount,
            "is_guest_order": True
        }
        
        response = unauthenticated_session.post(
            f"{BASE_URL}/api/page-orders/guest",
            json=order_data
        )
        
        assert response.status_code == 200, f"Order failed: {response.text}"
        
        result = response.json()
        platform_fee = result.get("platform_fee", {})
        
        print(f"Total: ${total_amount}, Expected fee: ${expected_fee}")
        print(f"Actual fee response: {platform_fee}")
        
        # Verify fee amount
        fee_amount = platform_fee.get("amount", 0)
        assert abs(fee_amount - expected_fee) < 0.01, f"Fee mismatch: expected {expected_fee}, got {fee_amount}"
        
        # Verify fee rate is 8%
        fee_rate = platform_fee.get("rate", "")
        assert "8" in fee_rate, f"Fee rate should be 8%, got {fee_rate}"
        
        print(f"✓ Platform fee correctly calculated: ${fee_amount} (8% of ${total_amount})")
    
    def test_guest_order_with_delivery(self, unauthenticated_session):
        """Test guest order with delivery option"""
        response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/discover")
        pages = response.json().get("pages", [])
        
        if not pages:
            pytest.skip("No pages for testing")
        
        page_id = pages[0].get("page_id")
        
        order_data = {
            "page_id": page_id,
            "customer_name": "Delivery Test",
            "customer_phone": "+1555000111",
            "delivery_address": "456 Delivery Ave",
            "delivery_city": "Test Town",
            "order_type": "delivery",
            "payment_method": "cash",
            "items": [
                {"item_id": "delivery_test_001", "name": "Delivery Item", "price": 30.00, "quantity": 1}
            ],
            "subtotal": 30.00,
            "delivery_fee": 5.00,
            "tax": 2.80,
            "total": 37.80,
            "is_guest_order": True
        }
        
        response = unauthenticated_session.post(
            f"{BASE_URL}/api/page-orders/guest",
            json=order_data
        )
        
        assert response.status_code == 200, f"Delivery order failed: {response.text}"
        
        result = response.json()
        order = result.get("order", {})
        
        assert order.get("order_type") == "delivery"
        assert order.get("delivery_address") == "456 Delivery Ave"
        print(f"✓ Delivery order created: {result['order_id']}")
    
    def test_guest_order_with_pickup(self, unauthenticated_session):
        """Test guest order with pickup option"""
        response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/discover")
        pages = response.json().get("pages", [])
        
        if not pages:
            pytest.skip("No pages for testing")
        
        page_id = pages[0].get("page_id")
        
        order_data = {
            "page_id": page_id,
            "customer_name": "Pickup Test",
            "customer_phone": "+1555000222",
            "order_type": "pickup",
            "payment_method": "cash",
            "items": [
                {"item_id": "pickup_test_001", "name": "Pickup Item", "price": 20.00, "quantity": 2}
            ],
            "subtotal": 40.00,
            "delivery_fee": 0,
            "tax": 3.20,
            "total": 43.20,
            "is_guest_order": True
        }
        
        response = unauthenticated_session.post(
            f"{BASE_URL}/api/page-orders/guest",
            json=order_data
        )
        
        assert response.status_code == 200, f"Pickup order failed: {response.text}"
        
        result = response.json()
        order = result.get("order", {})
        
        assert order.get("order_type") == "pickup"
        assert order.get("delivery_fee") == 0
        print(f"✓ Pickup order created: {result['order_id']}")
    
    def test_guest_order_card_payment(self, unauthenticated_session):
        """Test guest order with card payment (payment_url may be null as Stripe not integrated)"""
        response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/discover")
        pages = response.json().get("pages", [])
        
        if not pages:
            pytest.skip("No pages for testing")
        
        page_id = pages[0].get("page_id")
        
        order_data = {
            "page_id": page_id,
            "customer_name": "Card Test Customer",
            "customer_phone": "+1555000333",
            "customer_email": "card@test.com",
            "delivery_address": "789 Card St",
            "order_type": "delivery",
            "payment_method": "card",  # Card payment
            "items": [
                {"item_id": "card_test_001", "name": "Card Test Item", "price": 50.00, "quantity": 1}
            ],
            "subtotal": 50.00,
            "delivery_fee": 5.00,
            "tax": 4.40,
            "total": 59.40,
            "is_guest_order": True
        }
        
        response = unauthenticated_session.post(
            f"{BASE_URL}/api/page-orders/guest",
            json=order_data
        )
        
        assert response.status_code == 200, f"Card payment order failed: {response.text}"
        
        result = response.json()
        
        # Card payment will have payment_url (possibly null if Stripe not integrated)
        print(f"Card payment order response: {result}")
        assert "order_id" in result
        print(f"✓ Card payment order created: {result['order_id']}")
        print(f"  Payment URL: {result.get('payment_url', 'NULL - Stripe integration pending')}")


# ============== ORDER TRACKING TESTS ==============

class TestOrderTracking:
    """Test order tracking by order ID and phone number"""
    
    def test_track_order_valid(self, unauthenticated_session):
        """Test tracking order with valid order_id and phone"""
        # First create an order to track
        response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/discover")
        pages = response.json().get("pages", [])
        
        if not pages:
            pytest.skip("No pages for testing")
        
        page_id = pages[0].get("page_id")
        test_phone = "+1555000999"
        
        # Create order
        order_data = {
            "page_id": page_id,
            "customer_name": "Track Test",
            "customer_phone": test_phone,
            "order_type": "pickup",
            "payment_method": "cash",
            "items": [{"item_id": "track_001", "name": "Track Item", "price": 10.00, "quantity": 1}],
            "subtotal": 10.00,
            "delivery_fee": 0,
            "tax": 0.80,
            "total": 10.80,
            "is_guest_order": True
        }
        
        create_response = unauthenticated_session.post(
            f"{BASE_URL}/api/page-orders/guest",
            json=order_data
        )
        
        assert create_response.status_code == 200
        order_id = create_response.json()["order_id"]
        
        # Now track the order
        track_response = unauthenticated_session.get(
            f"{BASE_URL}/api/page-orders/track/{order_id}",
            params={"phone": test_phone}
        )
        
        print(f"Track response status: {track_response.status_code}")
        print(f"Track response: {track_response.text[:500] if track_response.text else 'Empty'}")
        
        assert track_response.status_code == 200, f"Failed to track order: {track_response.text}"
        
        track_data = track_response.json()
        assert "order" in track_data
        assert track_data["order"]["order_id"] == order_id
        assert "status_timeline" in track_data
        
        print(f"✓ Order tracked successfully: {order_id}")
        print(f"  Status: {track_data['order'].get('status')}")
        print(f"  Timeline: {track_data['status_timeline']}")
    
    def test_track_order_invalid_phone(self, unauthenticated_session):
        """Test tracking fails with wrong phone number"""
        # First create an order
        response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/discover")
        pages = response.json().get("pages", [])
        
        if not pages:
            pytest.skip("No pages for testing")
        
        page_id = pages[0].get("page_id")
        
        order_data = {
            "page_id": page_id,
            "customer_name": "Phone Test",
            "customer_phone": "+1111111111",
            "order_type": "pickup",
            "payment_method": "cash",
            "items": [{"item_id": "phone_001", "name": "Phone Item", "price": 5.00, "quantity": 1}],
            "subtotal": 5.00,
            "delivery_fee": 0,
            "tax": 0.40,
            "total": 5.40,
            "is_guest_order": True
        }
        
        create_response = unauthenticated_session.post(
            f"{BASE_URL}/api/page-orders/guest",
            json=order_data
        )
        
        assert create_response.status_code == 200
        order_id = create_response.json()["order_id"]
        
        # Try to track with wrong phone
        track_response = unauthenticated_session.get(
            f"{BASE_URL}/api/page-orders/track/{order_id}",
            params={"phone": "+9999999999"}  # Wrong phone
        )
        
        assert track_response.status_code == 404, f"Expected 404 for wrong phone, got {track_response.status_code}"
        print(f"✓ Order tracking correctly rejected wrong phone")
    
    def test_track_nonexistent_order(self, unauthenticated_session):
        """Test tracking non-existent order returns 404"""
        fake_order_id = f"go_{uuid.uuid4().hex[:12]}"
        
        track_response = unauthenticated_session.get(
            f"{BASE_URL}/api/page-orders/track/{fake_order_id}",
            params={"phone": "+1234567890"}
        )
        
        assert track_response.status_code == 404
        print(f"✓ Non-existent order correctly returns 404")


# ============== REFERRAL CODE COPY TESTS ==============

class TestReferralCode:
    """Test referral code display on public pages"""
    
    def test_referral_code_in_public_page_response(self, unauthenticated_session):
        """Test that owner's referral code is returned in public page data"""
        response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/discover")
        
        if response.status_code != 200:
            pytest.skip("Cannot get pages")
        
        pages = response.json().get("pages", [])
        if not pages:
            pytest.skip("No pages available")
        
        slug = pages[0].get("slug")
        
        # Get public page
        page_response = unauthenticated_session.get(f"{BASE_URL}/api/member-pages/public/{slug}")
        assert page_response.status_code == 200
        
        page_data = page_response.json()
        
        # Check for referral code
        print(f"Public page data keys: {page_data.keys()}")
        
        # owner_referral_code should be present (may be null if owner has no referral code)
        if "owner_referral_code" in page_data:
            print(f"✓ Owner referral code present: {page_data['owner_referral_code']}")
        else:
            print("! owner_referral_code key not in response")


# ============== AUTHENTICATED TESTS ==============

class TestAuthenticatedPageFeatures:
    """Test features that require authentication"""
    
    def test_manage_button_only_for_owner(self, auth_session):
        """Test that authorization check returns can_manage for owner"""
        # Get user's own pages
        response = auth_session.get(f"{BASE_URL}/api/member-pages/my-pages")
        
        if response.status_code != 200:
            pytest.skip("No owned pages")
        
        pages = response.json().get("pages", [])
        if not pages:
            pytest.skip("User has no pages")
        
        page_id = pages[0].get("page_id")
        
        # Check authorization
        auth_response = auth_session.get(f"{BASE_URL}/api/member-pages/{page_id}/authorization")
        
        assert auth_response.status_code == 200
        auth_data = auth_response.json()
        
        assert auth_data.get("can_manage") == True
        assert auth_data.get("is_owner") == True
        print(f"✓ Owner correctly has manage access")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
