"""
Test script for verifying 10 free daily mints feature
Tests:
1. Verify minting is free (no BL coin deduction)
2. Verify daily limit is 10 for free users
3. Verify 11th mint attempt is blocked
"""

import asyncio
import os
import sys
import uuid
import base64
from datetime import datetime, timezone
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Test constants
TEST_USER_EMAIL = "test@blendlink.com"
EXPECTED_DAILY_LIMIT = 10
EXPECTED_MINT_COST = 0

# Create a minimal test image (1x1 red PNG)
TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="


async def get_test_user():
    """Get or create test user"""
    user = await db.users.find_one({"email": TEST_USER_EMAIL}, {"_id": 0})
    if not user:
        print(f"❌ Test user {TEST_USER_EMAIL} not found!")
        return None
    return user


async def get_user_bl_balance(user_id: str) -> float:
    """Get user's current BL coin balance"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "bl_coins": 1})
    return user.get("bl_coins", 0) if user else 0


async def clear_today_mints(user_id: str):
    """Clear today's mints for clean testing"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_str = today_start.isoformat()
    
    # Delete today's mint transactions for this user
    result = await db.mint_transactions.delete_many({
        "user_id": user_id,
        "created_at": {"$gte": today_start_str}
    })
    print(f"Cleared {result.deleted_count} mint transactions from today")
    
    # Also delete the test photos created today
    result = await db.minted_photos.delete_many({
        "user_id": user_id,
        "name": {"$regex": "^Test Photo #"}
    })
    print(f"Cleared {result.deleted_count} test photos")


async def count_today_mints(user_id: str) -> int:
    """Count user's mints today"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_str = today_start.isoformat()
    
    count = await db.mint_transactions.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": today_start_str}
    })
    return count


async def test_minting_system():
    """Main test function"""
    from minting_system import MintingService, MINT_COST_BL, SUBSCRIPTION_LIMITS
    
    print("=" * 60)
    print("Testing 10 Free Daily Mints Feature")
    print("=" * 60)
    
    # Test 1: Verify configuration
    print("\n📋 Test 1: Verify Configuration")
    print(f"   MINT_COST_BL = {MINT_COST_BL}")
    print(f"   SUBSCRIPTION_LIMITS['free'] = {SUBSCRIPTION_LIMITS.get('free')}")
    
    assert MINT_COST_BL == EXPECTED_MINT_COST, f"MINT_COST_BL should be {EXPECTED_MINT_COST}, got {MINT_COST_BL}"
    assert SUBSCRIPTION_LIMITS.get('free') == EXPECTED_DAILY_LIMIT, f"Daily limit should be {EXPECTED_DAILY_LIMIT}"
    print("   ✅ Configuration correct")
    
    # Get test user
    user = await get_test_user()
    if not user:
        print("❌ Cannot proceed without test user")
        return False
    
    user_id = user["user_id"]
    print(f"\n👤 Test User: {user.get('name', 'Unknown')} ({user.get('email')})")
    print(f"   User ID: {user_id}")
    print(f"   Subscription: {user.get('subscription_tier', 'free')}")
    
    # Clear today's mints for clean test
    print("\n🧹 Clearing today's mints for clean test...")
    await clear_today_mints(user_id)
    
    # Get initial balance
    initial_balance = await get_user_bl_balance(user_id)
    print(f"\n💰 Initial BL Balance: {initial_balance:,.0f}")
    
    # Initialize minting service
    minting_service = MintingService(db)
    
    # Test 2: Check can_mint status
    print("\n📋 Test 2: Check can_mint status")
    check_result = await minting_service.check_can_mint(user_id)
    print(f"   can_mint: {check_result.get('can_mint')}")
    print(f"   mints_today: {check_result.get('mints_today')}")
    print(f"   daily_limit: {check_result.get('daily_limit')}")
    print(f"   remaining_mints: {check_result.get('remaining_mints')}")
    print(f"   is_free: {check_result.get('is_free')}")
    
    assert check_result.get('can_mint') == True, "Should be able to mint"
    assert check_result.get('daily_limit') == EXPECTED_DAILY_LIMIT, f"Daily limit should be {EXPECTED_DAILY_LIMIT}"
    assert check_result.get('is_free') == True, "Minting should be free"
    print("   ✅ can_mint check passed")
    
    # Test 3: Mint 10 photos and verify no BL deduction
    print(f"\n📸 Test 3: Minting {EXPECTED_DAILY_LIMIT} photos (should be FREE)")
    
    successful_mints = 0
    for i in range(1, EXPECTED_DAILY_LIMIT + 1):
        result = await minting_service.mint_photo(
            user_id=user_id,
            image_base64=TEST_IMAGE_BASE64,
            name=f"Test Photo #{i}",
            description=f"Test photo {i} for free minting verification",
            mime_type="image/png"
        )
        
        if result.get("success"):
            successful_mints += 1
            print(f"   ✅ Minted photo {i}/{EXPECTED_DAILY_LIMIT}: {result.get('photo', {}).get('mint_id', 'N/A')[:20]}...")
        else:
            print(f"   ❌ Failed to mint photo {i}: {result.get('error')}")
            break
    
    # Verify all 10 mints succeeded
    assert successful_mints == EXPECTED_DAILY_LIMIT, f"Should have minted {EXPECTED_DAILY_LIMIT} photos, got {successful_mints}"
    print(f"   ✅ Successfully minted {successful_mints} photos")
    
    # Verify BL balance unchanged (minting is free)
    current_balance = await get_user_bl_balance(user_id)
    print(f"\n💰 BL Balance after minting:")
    print(f"   Initial: {initial_balance:,.0f}")
    print(f"   Current: {current_balance:,.0f}")
    print(f"   Change:  {current_balance - initial_balance:,.0f}")
    
    # Since MINT_COST_BL = 0, balance should be unchanged
    # Note: There may be a -0 deduction happening, but net effect should be 0
    assert current_balance == initial_balance, f"BL balance should be unchanged (minting is free). Expected {initial_balance}, got {current_balance}"
    print("   ✅ BL balance unchanged (minting is FREE)")
    
    # Test 4: Verify 11th mint is blocked
    print(f"\n🚫 Test 4: Attempt 11th mint (should be BLOCKED)")
    
    # Check status first
    check_before_11th = await minting_service.check_can_mint(user_id)
    print(f"   can_mint before 11th: {check_before_11th.get('can_mint')}")
    print(f"   mints_today: {check_before_11th.get('mints_today')}")
    print(f"   remaining_mints: {check_before_11th.get('remaining_mints')}")
    
    assert check_before_11th.get('can_mint') == False, "Should NOT be able to mint after reaching limit"
    assert check_before_11th.get('mints_today') == EXPECTED_DAILY_LIMIT, f"Should have {EXPECTED_DAILY_LIMIT} mints today"
    assert check_before_11th.get('remaining_mints') == 0, "Should have 0 remaining mints"
    
    # Actually try to mint (should fail)
    result_11th = await minting_service.mint_photo(
        user_id=user_id,
        image_base64=TEST_IMAGE_BASE64,
        name="Test Photo #11 (Should Fail)",
        description="This mint should fail due to daily limit",
        mime_type="image/png"
    )
    
    print(f"   11th mint result: success={result_11th.get('success')}")
    print(f"   Error message: {result_11th.get('error', 'N/A')}")
    
    assert result_11th.get('success') == False, "11th mint should fail"
    assert "limit" in result_11th.get('error', '').lower(), "Error should mention limit"
    print("   ✅ 11th mint correctly blocked")
    
    # Final verification
    final_balance = await get_user_bl_balance(user_id)
    final_mints = await count_today_mints(user_id)
    
    print("\n" + "=" * 60)
    print("📊 FINAL TEST RESULTS")
    print("=" * 60)
    print(f"   Photos minted today: {final_mints}")
    print(f"   BL Balance:          {final_balance:,.0f} (unchanged)")
    print(f"   Daily limit enforced: {'YES' if final_mints == EXPECTED_DAILY_LIMIT else 'NO'}")
    print("=" * 60)
    
    # All tests passed
    print("\n🎉 ALL TESTS PASSED!")
    print("   ✅ Minting is FREE (0 BL cost)")
    print(f"   ✅ Daily limit is {EXPECTED_DAILY_LIMIT} for free users")
    print("   ✅ 11th mint is correctly blocked")
    print("   ✅ BL balance unchanged after minting")
    
    return True


async def cleanup():
    """Cleanup test data"""
    user = await get_test_user()
    if user:
        print("\n🧹 Cleaning up test data...")
        await clear_today_mints(user["user_id"])
        print("   ✅ Cleanup complete")


if __name__ == "__main__":
    try:
        result = asyncio.run(test_minting_system())
        if result:
            print("\n✅ Test completed successfully!")
            sys.exit(0)
        else:
            print("\n❌ Test failed!")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Test error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # Optional: cleanup
        # asyncio.run(cleanup())
        pass
