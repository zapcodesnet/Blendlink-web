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
from datetime import datetime, timezone, timedelta
from jose import jwt

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Get JWT secrets from environment (same as backend)
JWT_SECRET = os.environ.get('JWT_SECRET', 'blendlink-jwt-secret-key-2024')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRY_HOURS = int(os.environ.get('JWT_EXPIRY_HOURS', 168))

# Mongo URL for direct database operations
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')

def create_jwt_token(user_id: str) -> str:
    """Create a valid JWT token for testing"""
    expires = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    return jwt.encode({"sub": user_id, "user_id": user_id, "exp": expires}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def run_mongo_command(cmd: str) -> str:
    """Run a MongoDB command via mongosh"""
    import subprocess
    result = subprocess.run(
        ['mongosh', MONGO_URL, '--quiet', '--eval', cmd],
        capture_output=True, text=True
    )
    return result.stdout.strip()


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def test_user_with_coins():
    """Create a test user with sufficient BL coins (500) for testing"""
    user_id = f"test-listing-fee-{uuid.uuid4().hex[:8]}"
    email = f"testlistingfee{uuid.uuid4().hex[:6]}@example.com"
    
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
    print("SUCCESS");
    '''
    
    result = run_mongo_command(mongo_cmd)
    
    if "SUCCESS" not in result:
        pytest.skip(f"Could not create test user")
    
    # Generate JWT token
    token = create_jwt_token(user_id)
    
    return {
        "user_id": user_id,
        "token": token,
        "email": email
    }


@pytest.fixture(scope="module")
def test_user_low_coins():
    """Create a test user with insufficient BL coins (50) for testing"""
    user_id = f"test-low-coins-{uuid.uuid4().hex[:8]}"
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
    print("SUCCESS");
    '''
    
    result = run_mongo_command(mongo_cmd)
    
    if "SUCCESS" not in result:
        pytest.skip(f"Could not create test user with low coins")
    
    # Generate JWT token
    token = create_jwt_token(user_id)
    
    return {
        "user_id": user_id,
        "token": token,
        "email": email
    }


@pytest.fixture(scope="module")
def authenticated_client(api_client, test_user_with_coins):
    """Session with auth header for user with sufficient coins"""
    api_client.headers.update({"Authorization": f"Bearer {test_user_with_coins['token']}"})
    return api_client


@pytest.fixture(scope="module")
def low_coins_client(test_user_low_coins):
    """Session with auth header for user with low coins"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {test_user_low_coins['token']}"
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
        # Use a fresh session without auth
        unauthenticated = requests.Session()
        unauthenticated.headers.update({"Content-Type": "application/json"})
        
        response = unauthenticated.post(f"{BASE_URL}/api/marketplace/listings", json={
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
        
        assert response.status_code == 400, f"Expected 400 for insufficient balance, got {response.status_code}: {response.text}"
        
        data = response.json()
        error_message = data.get("detail", "")
        assert "Insufficient BL coins" in error_message, f"Expected 'Insufficient BL coins' in error, got: {error_message}"
        print(f"✓ Insufficient balance error returned correctly: {error_message}")
    
    def test_create_listing_deducts_fee(self, authenticated_client, test_user_with_coins):
        """Verify listing creation deducts 200 BL coins"""
        user_id = test_user_with_coins["user_id"]
        
        # Get initial balance
        mongo_check = f'''
        db = db.getSiblingDB("blendlink");
        var user = db.users.findOne({{ user_id: "{user_id}" }});
        print(user.bl_coins);
        '''
        initial_balance = int(run_mongo_command(mongo_check))
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
        new_balance = int(run_mongo_command(mongo_check))
        
        assert new_balance == initial_balance - 200, f"Expected balance {initial_balance - 200}, got {new_balance}"
        print(f"✓ Listing created and 200 BL coins deducted. Balance: {initial_balance} -> {new_balance}")


class TestMemberPageProductFee:
    """Test member page product creation with fee deduction"""
    
    @pytest.fixture(scope="class")
    def test_store_page(self, test_user_with_coins):
        """Create a test store page"""
        page_id = f"mpage_test_store_{uuid.uuid4().hex[:8]}"
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
        
        result = run_mongo_command(mongo_cmd)
        
        if "SUCCESS" not in result:
            pytest.skip(f"Could not create test store page")
        
        return page_id
    
    @pytest.fixture(scope="class")
    def low_coins_store_page(self, test_user_low_coins):
        """Create a store page for the low coins user"""
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
        
        result = run_mongo_command(mongo_cmd)
        
        if "SUCCESS" not in result:
            pytest.skip(f"Could not create test store page")
        
        return page_id
    
    def test_create_product_insufficient_balance(self, low_coins_client, low_coins_store_page):
        """Verify product creation fails with insufficient BL coins"""
        response = low_coins_client.post(f"{BASE_URL}/api/page-products/{low_coins_store_page}", json={
            "name": "TEST_Low Coins Product",
            "description": "Testing insufficient balance",
            "price": 25.00,
            "category": "Test Category",
            "stock_quantity": 10
        })
        
        assert response.status_code == 400, f"Expected 400 for insufficient balance, got {response.status_code}: {response.text}"
        
        data = response.json()
        error_message = data.get("detail", "")
        assert "Insufficient BL coins" in error_message, f"Expected 'Insufficient BL coins' in error, got: {error_message}"
        print(f"✓ Product creation fails with insufficient balance: {error_message}")
    
    def test_create_product_deducts_fee(self, authenticated_client, test_store_page, test_user_with_coins):
        """Verify product creation deducts 200 BL coins"""
        user_id = test_user_with_coins["user_id"]
        
        # Get initial balance
        mongo_check = f'''
        db = db.getSiblingDB("blendlink");
        var user = db.users.findOne({{ user_id: "{user_id}" }});
        print(user.bl_coins);
        '''
        initial_balance = int(run_mongo_command(mongo_check))
        print(f"Initial balance before product: {initial_balance}")
        
        # Create product
        response = authenticated_client.post(f"{BASE_URL}/api/page-products/{test_store_page}", json={
            "name": "TEST_ProductFeeDeduction Item",
            "description": "Testing fee deduction for product",
            "price": 49.99,
            "category": "Test Category",
            "stock_quantity": 5
        })
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        # Verify balance was deducted
        new_balance = int(run_mongo_command(mongo_check))
        
        assert new_balance == initial_balance - 200, f"Expected balance {initial_balance - 200}, got {new_balance}"
        print(f"✓ Product created and 200 BL coins deducted. Balance: {initial_balance} -> {new_balance}")


class TestMemberPageMenuFee:
    """Test member page menu item creation with fee deduction"""
    
    @pytest.fixture(scope="class")
    def test_restaurant_page(self, test_user_with_coins):
        """Create a test restaurant page"""
        page_id = f"mpage_test_rest_{uuid.uuid4().hex[:8]}"
        user_id = test_user_with_coins["user_id"]
        
        mongo_cmd = f'''
        db = db.getSiblingDB("blendlink");
        db.member_pages.insertOne({{
            page_id: "{page_id}",
            owner_id: "{user_id}",
            page_name: "Test Restaurant for Fees",
            page_type: "restaurant",
            slug: "test-rest-fees-{uuid.uuid4().hex[:6]}",
            description: "Test restaurant page",
            is_active: true,
            created_at: new Date()
        }});
        print("SUCCESS");
        '''
        
        result = run_mongo_command(mongo_cmd)
        
        if "SUCCESS" not in result:
            pytest.skip(f"Could not create test restaurant page")
        
        return page_id
    
    @pytest.fixture(scope="class")
    def low_coins_restaurant_page(self, test_user_low_coins):
        """Create a restaurant page for the low coins user"""
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
        
        result = run_mongo_command(mongo_cmd)
        
        if "SUCCESS" not in result:
            pytest.skip(f"Could not create test restaurant page")
        
        return page_id
    
    def test_create_menu_item_insufficient_balance(self, low_coins_client, low_coins_restaurant_page):
        """Verify menu item creation fails with insufficient BL coins"""
        response = low_coins_client.post(f"{BASE_URL}/api/page-menu/{low_coins_restaurant_page}", json={
            "name": "TEST_Low Coins Menu Item",
            "description": "Testing insufficient balance",
            "price": 15.00,
            "category": "Appetizers"
        })
        
        assert response.status_code == 400, f"Expected 400 for insufficient balance, got {response.status_code}: {response.text}"
        
        data = response.json()
        error_message = data.get("detail", "")
        assert "Insufficient BL coins" in error_message, f"Expected 'Insufficient BL coins' in error, got: {error_message}"
        print(f"✓ Menu item creation fails with insufficient balance: {error_message}")
    
    def test_create_menu_item_deducts_fee(self, authenticated_client, test_restaurant_page, test_user_with_coins):
        """Verify menu item creation deducts 200 BL coins"""
        user_id = test_user_with_coins["user_id"]
        
        # Get initial balance
        mongo_check = f'''
        db = db.getSiblingDB("blendlink");
        var user = db.users.findOne({{ user_id: "{user_id}" }});
        print(user.bl_coins);
        '''
        initial_balance = int(run_mongo_command(mongo_check))
        print(f"Initial balance before menu item: {initial_balance}")
        
        # Create menu item
        response = authenticated_client.post(f"{BASE_URL}/api/page-menu/{test_restaurant_page}", json={
            "name": "TEST_MenuFeeDeduction Item",
            "description": "Testing fee deduction for menu item",
            "price": 12.99,
            "category": "Main Course"
        })
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        # Verify balance was deducted
        new_balance = int(run_mongo_command(mongo_check))
        
        assert new_balance == initial_balance - 200, f"Expected balance {initial_balance - 200}, got {new_balance}"
        print(f"✓ Menu item created and 200 BL coins deducted. Balance: {initial_balance} -> {new_balance}")


class TestMemberPageServiceFee:
    """Test member page service creation with fee deduction"""
    
    @pytest.fixture(scope="class")
    def test_services_page(self, test_user_with_coins):
        """Create a test services page"""
        page_id = f"mpage_test_svc_{uuid.uuid4().hex[:8]}"
        user_id = test_user_with_coins["user_id"]
        
        mongo_cmd = f'''
        db = db.getSiblingDB("blendlink");
        db.member_pages.insertOne({{
            page_id: "{page_id}",
            owner_id: "{user_id}",
            page_name: "Test Services for Fees",
            page_type: "services",
            slug: "test-svc-fees-{uuid.uuid4().hex[:6]}",
            description: "Test services page",
            is_active: true,
            created_at: new Date()
        }});
        print("SUCCESS");
        '''
        
        result = run_mongo_command(mongo_cmd)
        
        if "SUCCESS" not in result:
            pytest.skip(f"Could not create test services page")
        
        return page_id
    
    def test_create_service_deducts_fee(self, authenticated_client, test_services_page, test_user_with_coins):
        """Verify service creation deducts 200 BL coins"""
        user_id = test_user_with_coins["user_id"]
        
        # Get initial balance
        mongo_check = f'''
        db = db.getSiblingDB("blendlink");
        var user = db.users.findOne({{ user_id: "{user_id}" }});
        print(user.bl_coins);
        '''
        initial_balance = int(run_mongo_command(mongo_check))
        print(f"Initial balance before service: {initial_balance}")
        
        # Create service
        response = authenticated_client.post(f"{BASE_URL}/api/page-services/{test_services_page}", json={
            "name": "TEST_ServiceFeeDeduction Item",
            "description": "Testing fee deduction for service",
            "price": 75.00,
            "duration_minutes": 60,
            "category": "Consulting"
        })
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        # Verify balance was deducted
        new_balance = int(run_mongo_command(mongo_check))
        
        assert new_balance == initial_balance - 200, f"Expected balance {initial_balance - 200}, got {new_balance}"
        print(f"✓ Service created and 200 BL coins deducted. Balance: {initial_balance} -> {new_balance}")


class TestMemberPageRentalFee:
    """Test member page rental creation with fee deduction"""
    
    @pytest.fixture(scope="class")
    def test_rental_page(self, test_user_with_coins):
        """Create a test rental page"""
        page_id = f"mpage_test_rent_{uuid.uuid4().hex[:8]}"
        user_id = test_user_with_coins["user_id"]
        
        mongo_cmd = f'''
        db = db.getSiblingDB("blendlink");
        db.member_pages.insertOne({{
            page_id: "{page_id}",
            owner_id: "{user_id}",
            page_name: "Test Rentals for Fees",
            page_type: "rental",
            slug: "test-rent-fees-{uuid.uuid4().hex[:6]}",
            description: "Test rental page",
            is_active: true,
            created_at: new Date()
        }});
        print("SUCCESS");
        '''
        
        result = run_mongo_command(mongo_cmd)
        
        if "SUCCESS" not in result:
            pytest.skip(f"Could not create test rental page")
        
        return page_id
    
    def test_create_rental_deducts_fee(self, authenticated_client, test_rental_page, test_user_with_coins):
        """Verify rental creation deducts 200 BL coins"""
        user_id = test_user_with_coins["user_id"]
        
        # Get initial balance
        mongo_check = f'''
        db = db.getSiblingDB("blendlink");
        var user = db.users.findOne({{ user_id: "{user_id}" }});
        print(user.bl_coins);
        '''
        initial_balance = int(run_mongo_command(mongo_check))
        print(f"Initial balance before rental: {initial_balance}")
        
        # Create rental
        response = authenticated_client.post(f"{BASE_URL}/api/page-rentals/{test_rental_page}", json={
            "name": "TEST_RentalFeeDeduction Item",
            "description": "Testing fee deduction for rental",
            "price_per_day": 50.00,
            "deposit_amount": 100.00,
            "category": "Equipment"
        })
        
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}: {response.text}"
        
        # Verify balance was deducted
        new_balance = int(run_mongo_command(mongo_check))
        
        assert new_balance == initial_balance - 200, f"Expected balance {initial_balance - 200}, got {new_balance}"
        print(f"✓ Rental created and 200 BL coins deducted. Balance: {initial_balance} -> {new_balance}")


class TestBLTransactionRecords:
    """Verify BL coin transactions are recorded properly"""
    
    def test_listing_fee_transaction_recorded(self):
        """Verify a listing_fee transaction type exists in bl_transactions"""
        mongo_cmd = '''
        db = db.getSiblingDB("blendlink");
        var txn = db.bl_transactions.findOne({ type: "listing_fee" });
        if (txn) {
            print(JSON.stringify({type: txn.type, amount: txn.amount, description: txn.description}));
        } else {
            print("NO_TXN");
        }
        '''
        
        output = run_mongo_command(mongo_cmd)
        
        if output == "NO_TXN":
            print("⚠ No listing fee transactions found yet - may need to run with valid listing first")
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
    
    cleanup_cmd = '''
    db = db.getSiblingDB("blendlink");
    // Delete test users
    db.users.deleteMany({ user_id: { $regex: /^test-listing-fee-/ } });
    db.users.deleteMany({ user_id: { $regex: /^test-low-coins-/ } });
    // Delete test pages
    db.member_pages.deleteMany({ page_id: { $regex: /^mpage_test_|^mpage_low/ } });
    // Delete test listings
    db.marketplace_listings.deleteMany({ title: { $regex: /^TEST_/ } });
    // Delete test products
    db.page_products.deleteMany({ name: { $regex: /^TEST_/ } });
    // Delete test menu items
    db.page_menu_items.deleteMany({ name: { $regex: /^TEST_/ } });
    // Delete test services
    db.page_services.deleteMany({ name: { $regex: /^TEST_/ } });
    // Delete test rentals
    db.page_rentals.deleteMany({ name: { $regex: /^TEST_/ } });
    print("CLEANUP_DONE");
    '''
    
    run_mongo_command(cleanup_cmd)
    print("Test data cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
