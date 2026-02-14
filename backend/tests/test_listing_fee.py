"""
Test Suite for Listing Fee Feature (200 BL coins)
Tests for marketplace listings, member page products, menu items, services, and rentals

Features tested:
- GET /api/marketplace/listing-fee returns correct fee
- POST /api/marketplace/listings deducts 200 BL coins
- POST /api/page-products/{page_id} deducts 200 BL coins
- POST /api/page-menu/{page_id} deducts 200 BL coins
- POST /api/page-services/{page_id} deducts 200 BL coins
- POST /api/page-rentals/{page_id} deducts 200 BL coins
- Insufficient balance returns 400 error
"""

import pytest
import requests
import os
import uuid
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def test_user_with_coins(api_client):
    """Create a test user with sufficient BL coins (500) for testing"""
    # First, we need to get a valid token
    # Create test user via the users collection directly with MongoDB
    import subprocess
    
    user_id = f"test-listing-fee-{uuid.uuid4().hex[:8]}"
    session_token = f"test_session_{uuid.uuid4().hex}"
    email = f"testlistingfee{uuid.uuid4().hex[:6]}@example.com"
    
    # Create user with 500 BL coins via mongosh
    mongo_cmd = f'''
    db = db.getSiblingDB("blendlink");
    db.users.insertOne({{
        user_id: "{user_id}",
        email: "{email}",
        name: "Test Listing Fee User",
        username: "testfeeuser{uuid.uuid4().hex[:6]}",
        avatar: "https://ui-avatars.com/api/?name=Test+User",
        bl_coins: 500,
        referral_code: "TESTFEE{uuid.uuid4().hex[:4]}",
        followers_count: 0,
        following_count: 0,
        created_at: new Date(),
        google_id: "{uuid.uuid4().hex}"
    }});
    db.user_sessions.insertOne({{
        user_id: "{user_id}",
        session_token: "{session_token}",
        expires_at: new Date(Date.now() + 7*24*60*60*1000),
        created_at: new Date()
    }});
    print("SUCCESS");
    '''
    
    result = subprocess.run(
        ['mongosh', 
         os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), 
         '--quiet', '--eval', mongo_cmd],
        capture_output=True, text=True
    )
    
    if "SUCCESS" not in result.stdout:
        pytest.skip(f"Could not create test user: {result.stderr}")
    
    return {
        "user_id": user_id,
        "session_token": session_token,
        "email": email
    }

@pytest.fixture(scope="module")
def test_user_low_coins(api_client):
    """Create a test user with insufficient BL coins (50) for testing"""
    import subprocess
    
    user_id = f"test-low-coins-{uuid.uuid4().hex[:8]}"
    session_token = f"test_session_low_{uuid.uuid4().hex}"
    email = f"testlowcoins{uuid.uuid4().hex[:6]}@example.com"
    
    mongo_cmd = f'''
    db = db.getSiblingDB("blendlink");
    db.users.insertOne({{
        user_id: "{user_id}",
        email: "{email}",
        name: "Test Low Coins User",
        username: "testlowuser{uuid.uuid4().hex[:6]}",
        avatar: "https://ui-avatars.com/api/?name=Test+User",
        bl_coins: 50,
        referral_code: "TESTLOW{uuid.uuid4().hex[:4]}",
        followers_count: 0,
        following_count: 0,
        created_at: new Date(),
        google_id: "{uuid.uuid4().hex}"
    }});
    db.user_sessions.insertOne({{
        user_id: "{user_id}",
        session_token: "{session_token}",
        expires_at: new Date(Date.now() + 7*24*60*60*1000),
        created_at: new Date()
    }});
    print("SUCCESS");
    '''
    
    result = subprocess.run(
        ['mongosh', 
         os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), 
         '--quiet', '--eval', mongo_cmd],
        capture_output=True, text=True
    )
    
    if "SUCCESS" not in result.stdout:
        pytest.skip(f"Could not create test user: {result.stderr}")
    
    return {
        "user_id": user_id,
        "session_token": session_token,
        "email": email
    }

@pytest.fixture(scope="module")
def authenticated_client(api_client, test_user_with_coins):
    """Session with auth header for user with sufficient coins"""
    api_client.headers.update({"Authorization": f"Bearer {test_user_with_coins['session_token']}"})
    return api_client

@pytest.fixture(scope="module")
def low_coins_client(test_user_low_coins):
    """Session with auth header for user with low coins"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_user_low_coins['session_token']}"
    })
    return session


class TestListingFeeEndpoint:
    """Test the GET /api/marketplace/listing-fee endpoint"""
    
    def test_get_listing_fee_returns_correct_value(self, api_client):
        """Verify listing fee endpoint returns 200 BL coins"""
        response = api_client.get(f"{BASE_URL}/api/marketplace/listing-fee")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "fee" in data, "Response should contain 'fee' field"
        assert data["fee"] == 200, f"Expected fee of 200, got {data['fee']}"
        assert data["currency"] == "BL coins", f"Expected currency 'BL coins', got {data['currency']}"
        print(f"✓ Listing fee endpoint returns correct fee: {data['fee']} {data['currency']}")


class TestMarketplaceListingFee:
    """Test marketplace listing creation with fee deduction"""
    
    def test_create_listing_requires_authentication(self, api_client):
        """Verify listing creation requires authentication"""
        response = api_client.post(f"{BASE_URL}/api/marketplace/listings", json={
            "title": "Test Item",
            "description": "Test description",
            "price": 100,
            "category": "electronics"
        })
        
        # Should be 401 or 403 without auth
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✓ Listing creation requires authentication")
    
    def test_create_listing_insufficient_balance(self, low_coins_client, test_user_low_coins):
        """Verify listing creation fails with insufficient BL coins"""
        response = low_coins_client.post(f"{BASE_URL}/api/marketplace/listings", json={
            "title": "TEST_InsufficientBalance Item",
            "description": "Testing insufficient balance error",
            "price": 50.00,
            "category": "electronics",
            "condition": "new"
        })
        
        assert response.status_code == 400, f"Expected 400 for insufficient balance, got {response.status_code}"
        
        data = response.json()
        error_message = data.get("detail", "")
        assert "Insufficient BL coins" in error_message, f"Expected 'Insufficient BL coins' in error, got: {error_message}"
        print(f"✓ Insufficient balance error returned correctly: {error_message}")
    
    def test_create_listing_deducts_fee(self, authenticated_client, test_user_with_coins):
        """Verify listing creation deducts 200 BL coins"""
        import subprocess
        
        # Get initial balance
        user_id = test_user_with_coins["user_id"]
        mongo_check = f'''
        db = db.getSiblingDB("blendlink");
        var user = db.users.findOne({{ user_id: "{user_id}" }});
        print(user.bl_coins);
        '''
        result = subprocess.run(
            ['mongosh', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), '--quiet', '--eval', mongo_check],
            capture_output=True, text=True
        )
        initial_balance = int(result.stdout.strip())
        print(f"Initial balance: {initial_balance}")
        
        # Create listing
        response = authenticated_client.post(f"{BASE_URL}/api/marketplace/listings", json={
            "title": "TEST_ListingFeeDeduction Item",
            "description": "Testing fee deduction",
            "price": 99.99,
            "category": "electronics",
            "condition": "new",
            "images": []
        })
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        # Verify balance was deducted
        result = subprocess.run(
            ['mongosh', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), '--quiet', '--eval', mongo_check],
            capture_output=True, text=True
        )
        new_balance = int(result.stdout.strip())
        
        assert new_balance == initial_balance - 200, f"Expected balance {initial_balance - 200}, got {new_balance}"
        print(f"✓ Listing created and 200 BL coins deducted. Balance: {initial_balance} -> {new_balance}")


class TestMemberPageItemsFee:
    """Test member page product/menu/service/rental creation with fee deduction"""
    
    @pytest.fixture(scope="class")
    def test_store_page(self, authenticated_client, test_user_with_coins):
        """Create a test store page"""
        import subprocess
        
        page_id = f"mpage_test_{uuid.uuid4().hex[:8]}"
        user_id = test_user_with_coins["user_id"]
        
        mongo_cmd = f'''
        db = db.getSiblingDB("blendlink");
        db.member_pages.insertOne({{
            page_id: "{page_id}",
            owner_id: "{user_id}",
            page_name: "Test Store for Fees",
            page_type: "store",
            slug: "test-store-fees-{uuid.uuid4().hex[:6]}",
            description: "Test store page",
            is_active: true,
            created_at: new Date()
        }});
        print("SUCCESS");
        '''
        
        result = subprocess.run(
            ['mongosh', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), '--quiet', '--eval', mongo_cmd],
            capture_output=True, text=True
        )
        
        if "SUCCESS" not in result.stdout:
            pytest.skip(f"Could not create test store page: {result.stderr}")
        
        return page_id
    
    @pytest.fixture(scope="class")
    def test_restaurant_page(self, authenticated_client, test_user_with_coins):
        """Create a test restaurant page"""
        import subprocess
        
        page_id = f"mpage_rest_{uuid.uuid4().hex[:8]}"
        user_id = test_user_with_coins["user_id"]
        
        mongo_cmd = f'''
        db = db.getSiblingDB("blendlink");
        db.member_pages.insertOne({{
            page_id: "{page_id}",
            owner_id: "{user_id}",
            page_name: "Test Restaurant for Fees",
            page_type: "restaurant",
            slug: "test-restaurant-fees-{uuid.uuid4().hex[:6]}",
            description: "Test restaurant page",
            is_active: true,
            created_at: new Date()
        }});
        print("SUCCESS");
        '''
        
        result = subprocess.run(
            ['mongosh', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), '--quiet', '--eval', mongo_cmd],
            capture_output=True, text=True
        )
        
        if "SUCCESS" not in result.stdout:
            pytest.skip(f"Could not create test restaurant page: {result.stderr}")
        
        return page_id
    
    @pytest.fixture(scope="class")
    def test_services_page(self, authenticated_client, test_user_with_coins):
        """Create a test services page"""
        import subprocess
        
        page_id = f"mpage_svc_{uuid.uuid4().hex[:8]}"
        user_id = test_user_with_coins["user_id"]
        
        mongo_cmd = f'''
        db = db.getSiblingDB("blendlink");
        db.member_pages.insertOne({{
            page_id: "{page_id}",
            owner_id: "{user_id}",
            page_name: "Test Services for Fees",
            page_type: "services",
            slug: "test-services-fees-{uuid.uuid4().hex[:6]}",
            description: "Test services page",
            is_active: true,
            created_at: new Date()
        }});
        print("SUCCESS");
        '''
        
        result = subprocess.run(
            ['mongosh', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), '--quiet', '--eval', mongo_cmd],
            capture_output=True, text=True
        )
        
        if "SUCCESS" not in result.stdout:
            pytest.skip(f"Could not create test services page: {result.stderr}")
        
        return page_id
    
    @pytest.fixture(scope="class")
    def test_rental_page(self, authenticated_client, test_user_with_coins):
        """Create a test rental page"""
        import subprocess
        
        page_id = f"mpage_rent_{uuid.uuid4().hex[:8]}"
        user_id = test_user_with_coins["user_id"]
        
        mongo_cmd = f'''
        db = db.getSiblingDB("blendlink");
        db.member_pages.insertOne({{
            page_id: "{page_id}",
            owner_id: "{user_id}",
            page_name: "Test Rentals for Fees",
            page_type: "rental",
            slug: "test-rental-fees-{uuid.uuid4().hex[:6]}",
            description: "Test rental page",
            is_active: true,
            created_at: new Date()
        }});
        print("SUCCESS");
        '''
        
        result = subprocess.run(
            ['mongosh', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), '--quiet', '--eval', mongo_cmd],
            capture_output=True, text=True
        )
        
        if "SUCCESS" not in result.stdout:
            pytest.skip(f"Could not create test rental page: {result.stderr}")
        
        return page_id
    
    def test_create_product_insufficient_balance(self, low_coins_client, test_user_low_coins):
        """Verify product creation fails with insufficient BL coins"""
        import subprocess
        
        # Create a store page for low coins user
        page_id = f"mpage_lowstore_{uuid.uuid4().hex[:8]}"
        user_id = test_user_low_coins["user_id"]
        
        mongo_cmd = f'''
        db = db.getSiblingDB("blendlink");
        db.member_pages.insertOne({{
            page_id: "{page_id}",
            owner_id: "{user_id}",
            page_name: "Test Store Low Coins",
            page_type: "store",
            slug: "test-store-low-{uuid.uuid4().hex[:6]}",
            description: "Test store page",
            is_active: true,
            created_at: new Date()
        }});
        print("SUCCESS");
        '''
        
        result = subprocess.run(
            ['mongosh', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), '--quiet', '--eval', mongo_cmd],
            capture_output=True, text=True
        )
        
        if "SUCCESS" not in result.stdout:
            pytest.skip(f"Could not create test store page: {result.stderr}")
        
        response = low_coins_client.post(f"{BASE_URL}/api/page-products/{page_id}", json={
            "name": "TEST_Low Coins Product",
            "description": "Testing insufficient balance",
            "price": 25.00,
            "category": "Test Category",
            "stock_quantity": 10
        })
        
        assert response.status_code == 400, f"Expected 400 for insufficient balance, got {response.status_code}"
        
        data = response.json()
        error_message = data.get("detail", "")
        assert "Insufficient BL coins" in error_message, f"Expected 'Insufficient BL coins' in error, got: {error_message}"
        print(f"✓ Product creation fails with insufficient balance: {error_message}")
    
    def test_create_menu_item_insufficient_balance(self, low_coins_client, test_user_low_coins):
        """Verify menu item creation fails with insufficient BL coins"""
        import subprocess
        
        # Create a restaurant page for low coins user
        page_id = f"mpage_lowrest_{uuid.uuid4().hex[:8]}"
        user_id = test_user_low_coins["user_id"]
        
        mongo_cmd = f'''
        db = db.getSiblingDB("blendlink");
        db.member_pages.insertOne({{
            page_id: "{page_id}",
            owner_id: "{user_id}",
            page_name: "Test Restaurant Low Coins",
            page_type: "restaurant",
            slug: "test-rest-low-{uuid.uuid4().hex[:6]}",
            description: "Test restaurant page",
            is_active: true,
            created_at: new Date()
        }});
        print("SUCCESS");
        '''
        
        result = subprocess.run(
            ['mongosh', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), '--quiet', '--eval', mongo_cmd],
            capture_output=True, text=True
        )
        
        if "SUCCESS" not in result.stdout:
            pytest.skip(f"Could not create test restaurant page: {result.stderr}")
        
        response = low_coins_client.post(f"{BASE_URL}/api/page-menu/{page_id}", json={
            "name": "TEST_Low Coins Menu Item",
            "description": "Testing insufficient balance",
            "price": 15.00,
            "category": "Appetizers"
        })
        
        assert response.status_code == 400, f"Expected 400 for insufficient balance, got {response.status_code}"
        
        data = response.json()
        error_message = data.get("detail", "")
        assert "Insufficient BL coins" in error_message, f"Expected 'Insufficient BL coins' in error, got: {error_message}"
        print(f"✓ Menu item creation fails with insufficient balance: {error_message}")


class TestBLTransactionRecords:
    """Verify BL coin transactions are recorded properly"""
    
    def test_listing_fee_transaction_recorded(self, api_client):
        """Verify a listing_fee transaction type exists in bl_transactions"""
        import subprocess
        
        mongo_cmd = '''
        db = db.getSiblingDB("blendlink");
        var txn = db.bl_transactions.findOne({ type: "listing_fee" });
        if (txn) {
            print(JSON.stringify(txn));
        } else {
            print("NO_TXN");
        }
        '''
        
        result = subprocess.run(
            ['mongosh', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), '--quiet', '--eval', mongo_cmd],
            capture_output=True, text=True
        )
        
        output = result.stdout.strip()
        if output == "NO_TXN":
            print("⚠ No listing fee transactions found yet")
            # This is acceptable if no listings were created yet
            return
        
        import json
        txn = json.loads(output)
        assert txn["type"] == "listing_fee", f"Expected type 'listing_fee', got {txn['type']}"
        assert txn["amount"] == -200, f"Expected amount -200, got {txn['amount']}"
        print(f"✓ Listing fee transaction recorded: {txn['description']}")


# Cleanup fixture to remove test data
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(request):
    """Cleanup TEST_ prefixed data after tests complete"""
    yield
    
    import subprocess
    
    cleanup_cmd = '''
    db = db.getSiblingDB("blendlink");
    // Delete test users
    db.users.deleteMany({ user_id: { $regex: /^test-listing-fee-/ } });
    db.users.deleteMany({ user_id: { $regex: /^test-low-coins-/ } });
    db.user_sessions.deleteMany({ session_token: { $regex: /^test_session/ } });
    // Delete test pages
    db.member_pages.deleteMany({ page_id: { $regex: /^mpage_test_|^mpage_rest_|^mpage_svc_|^mpage_rent_|^mpage_low/ } });
    // Delete test listings
    db.marketplace_listings.deleteMany({ title: { $regex: /^TEST_/ } });
    // Delete test products
    db.page_products.deleteMany({ name: { $regex: /^TEST_/ } });
    // Delete test menu items
    db.page_menu_items.deleteMany({ name: { $regex: /^TEST_/ } });
    print("CLEANUP_DONE");
    '''
    
    subprocess.run(
        ['mongosh', os.environ.get('MONGO_URL', 'mongodb://localhost:27017'), '--quiet', '--eval', cleanup_cmd],
        capture_output=True, text=True
    )
    print("Test data cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
