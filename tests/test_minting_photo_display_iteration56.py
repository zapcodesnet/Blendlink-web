"""
Test Minting Photo Display - Iteration 56
Tests for P0 bug fixes:
1. Photo minting flow via API - POST /api/minting/photo/upload should succeed
2. Photo minting deducts 500 BL coins from user balance
3. Minted photos have proper image_url field (not truncated)
4. Minting status API returns correct data
5. Photo details API returns photos with image_url field
"""

import pytest
import requests
import os
import base64
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "Test123!"


class TestMintingPhotoDisplay:
    """Test minting flow and photo display"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session with authentication"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip(f"Authentication failed: {response.status_code}")
        
        data = response.json()
        self.token = data.get("token")
        self.user = data.get("user", {})
        self.user_id = self.user.get("user_id")
        self.initial_bl_coins = self.user.get("bl_coins", 0)
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    def test_01_minting_config_endpoint(self):
        """Test minting config endpoint returns correct data"""
        response = self.session.get(f"{BASE_URL}/api/minting/config")
        assert response.status_code == 200, f"Config endpoint failed: {response.text}"
        
        data = response.json()
        assert data.get("mint_cost_bl") == 500, "Mint cost should be 500 BL"
        assert "scenery_types" in data, "Should have scenery_types"
        assert "light_types" in data, "Should have light_types"
        assert "rating_criteria" in data, "Should have rating_criteria"
        print(f"✓ Minting config: cost={data['mint_cost_bl']} BL")
    
    def test_02_minting_status_endpoint(self):
        """Test minting status endpoint returns correct data"""
        response = self.session.get(f"{BASE_URL}/api/minting/status")
        assert response.status_code == 200, f"Status endpoint failed: {response.text}"
        
        data = response.json()
        assert "can_mint" in data, "Should have can_mint field"
        assert "bl_coins" in data, "Should have bl_coins field"
        assert "mints_today" in data, "Should have mints_today field"
        assert "daily_limit" in data, "Should have daily_limit field"
        
        print(f"✓ Minting status: can_mint={data['can_mint']}, bl_coins={data['bl_coins']}, mints_today={data['mints_today']}/{data['daily_limit']}")
    
    def test_03_get_user_photos_endpoint(self):
        """Test getting user's minted photos"""
        response = self.session.get(f"{BASE_URL}/api/minting/photos")
        assert response.status_code == 200, f"Photos endpoint failed: {response.text}"
        
        data = response.json()
        assert "photos" in data, "Should have photos array"
        assert "count" in data, "Should have count field"
        
        photos = data.get("photos", [])
        print(f"✓ User has {len(photos)} minted photos")
        
        # Check that photos have image_url field
        for photo in photos[:3]:  # Check first 3
            assert "image_url" in photo, f"Photo {photo.get('mint_id')} missing image_url"
            image_url = photo.get("image_url", "")
            # Verify image_url is a proper data URL (not truncated)
            assert image_url.startswith("data:image/"), f"image_url should be a data URL, got: {image_url[:50]}"
            # Check it's a valid base64 image (can be small for test images)
            # Minimum valid PNG is ~70 bytes = ~100 chars in base64
            assert len(image_url) > 100, f"image_url too short: {len(image_url)} chars"
            print(f"  - {photo.get('mint_id')}: image_url length={len(image_url)} chars ✓")
    
    def test_04_photo_minting_upload_flow(self):
        """Test complete photo minting flow via file upload"""
        # Get initial balance
        status_before = self.session.get(f"{BASE_URL}/api/minting/status").json()
        initial_coins = status_before.get("bl_coins", 0)
        
        if not status_before.get("can_mint"):
            pytest.skip(f"Cannot mint: {status_before.get('reason', 'Unknown')}")
        
        # Create a simple test image (1x1 red pixel PNG)
        # This is a valid PNG file
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        test_image_bytes = base64.b64decode(test_image_base64)
        
        # Prepare multipart form data
        timestamp = int(time.time())
        files = {
            'file': (f'test_image_{timestamp}.png', test_image_bytes, 'image/png')
        }
        data = {
            'name': f'Test_Mint_Iteration56_{timestamp}',
            'description': 'Test photo for iteration 56 testing',
            'is_private': 'false',
            'show_in_feed': 'true'
        }
        
        # Remove Content-Type header for multipart
        headers = {"Authorization": f"Bearer {self.token}"}
        
        print(f"Minting photo with {len(test_image_bytes)} bytes...")
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/upload",
            files=files,
            data=data,
            headers=headers,
            timeout=120  # 2 minute timeout for AI analysis
        )
        
        assert response.status_code == 200, f"Minting failed: {response.status_code} - {response.text}"
        
        result = response.json()
        assert result.get("success") == True, f"Minting not successful: {result}"
        assert "photo" in result, "Response should contain photo data"
        assert "transaction_hash" in result, "Response should contain transaction_hash"
        assert result.get("bl_spent") == 500, "Should spend 500 BL coins"
        
        photo = result.get("photo", {})
        mint_id = photo.get("mint_id")
        assert mint_id, "Photo should have mint_id"
        
        # Verify image_url is stored correctly (full base64 data URL)
        image_url = photo.get("image_url", "")
        assert image_url.startswith("data:image/"), f"image_url should be data URL: {image_url[:50]}"
        assert len(image_url) > 100, f"image_url should not be truncated: {len(image_url)} chars"
        
        print(f"✓ Photo minted: {mint_id}")
        print(f"  - image_url length: {len(image_url)} chars")
        print(f"  - transaction_hash: {result.get('transaction_hash')[:20]}...")
        
        # Verify BL coins were deducted
        status_after = self.session.get(f"{BASE_URL}/api/minting/status").json()
        final_coins = status_after.get("bl_coins", 0)
        
        assert final_coins == initial_coins - 500, f"BL coins not deducted correctly: {initial_coins} -> {final_coins}"
        print(f"✓ BL coins deducted: {initial_coins} -> {final_coins} (-500)")
        
        # Store mint_id for later tests
        self.__class__.minted_photo_id = mint_id
    
    def test_05_verify_minted_photo_in_list(self):
        """Verify the newly minted photo appears in user's photos list"""
        if not hasattr(self.__class__, 'minted_photo_id'):
            pytest.skip("No photo minted in previous test")
        
        mint_id = self.__class__.minted_photo_id
        
        response = self.session.get(f"{BASE_URL}/api/minting/photos")
        assert response.status_code == 200
        
        photos = response.json().get("photos", [])
        photo_ids = [p.get("mint_id") for p in photos]
        
        assert mint_id in photo_ids, f"Minted photo {mint_id} not found in user's photos"
        
        # Find the photo and verify image_url
        minted_photo = next((p for p in photos if p.get("mint_id") == mint_id), None)
        assert minted_photo, f"Could not find photo {mint_id}"
        
        image_url = minted_photo.get("image_url", "")
        assert image_url.startswith("data:image/"), "image_url should be a data URL"
        assert len(image_url) > 100, "image_url should not be truncated"
        
        print(f"✓ Photo {mint_id} found in user's photos with valid image_url")
    
    def test_06_get_single_photo_details(self):
        """Test getting single photo details"""
        if not hasattr(self.__class__, 'minted_photo_id'):
            pytest.skip("No photo minted in previous test")
        
        mint_id = self.__class__.minted_photo_id
        
        response = self.session.get(f"{BASE_URL}/api/minting/photo/{mint_id}")
        assert response.status_code == 200, f"Get photo failed: {response.text}"
        
        photo = response.json()
        assert photo.get("mint_id") == mint_id
        assert "image_url" in photo, "Photo should have image_url"
        assert "scenery_type" in photo, "Photo should have scenery_type"
        assert "dollar_value" in photo, "Photo should have dollar_value"
        assert "ratings" in photo, "Photo should have ratings"
        
        image_url = photo.get("image_url", "")
        assert image_url.startswith("data:image/"), "image_url should be a data URL"
        
        print(f"✓ Photo details retrieved:")
        print(f"  - scenery_type: {photo.get('scenery_type')}")
        print(f"  - dollar_value: ${photo.get('dollar_value'):,}")
        print(f"  - image_url length: {len(image_url)} chars")
    
    def test_07_minting_feed_endpoint(self):
        """Test public minting feed endpoint"""
        response = self.session.get(f"{BASE_URL}/api/minting/feed")
        assert response.status_code == 200, f"Feed endpoint failed: {response.text}"
        
        data = response.json()
        assert "photos" in data, "Should have photos array"
        
        photos = data.get("photos", [])
        print(f"✓ Feed has {len(photos)} public photos")
        
        # Check that feed photos have image_url
        for photo in photos[:3]:
            if "image_url" in photo:
                image_url = photo.get("image_url", "")
                assert image_url.startswith("data:image/") or image_url == "", f"Invalid image_url format"
                if image_url:
                    print(f"  - {photo.get('mint_id')}: image_url present ✓")


class TestMintingEdgeCases:
    """Test edge cases and error handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code != 200:
            pytest.skip("Authentication failed")
        
        data = response.json()
        self.token = data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    def test_mint_without_file(self):
        """Test minting without file should fail"""
        data = {
            'name': 'Test No File',
            'description': 'Should fail'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/upload",
            data=data,
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        # Should fail with 422 (validation error) or 400
        assert response.status_code in [400, 422], f"Should fail without file: {response.status_code}"
        print("✓ Minting without file correctly rejected")
    
    def test_mint_without_name(self):
        """Test minting without name should fail"""
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        test_image_bytes = base64.b64decode(test_image_base64)
        
        files = {
            'file': ('test.png', test_image_bytes, 'image/png')
        }
        data = {
            'description': 'No name provided'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/upload",
            files=files,
            data=data,
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        # Should fail with 422 (validation error)
        assert response.status_code == 422, f"Should fail without name: {response.status_code}"
        print("✓ Minting without name correctly rejected")
    
    def test_mint_unauthenticated(self):
        """Test minting without auth should fail"""
        test_image_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
        test_image_bytes = base64.b64decode(test_image_base64)
        
        files = {
            'file': ('test.png', test_image_bytes, 'image/png')
        }
        data = {
            'name': 'Unauth Test'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/minting/photo/upload",
            files=files,
            data=data
            # No auth header
        )
        
        assert response.status_code in [401, 403], f"Should fail without auth: {response.status_code}"
        print("✓ Unauthenticated minting correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
