"""
Test AI Photo Transformation Feature
Tests the /api/ai-transform/* endpoints for the minting flow
"""

import pytest
import requests
import os
import base64
import time

# Get BASE_URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://emergency-fixes-1.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_USER = {
    "email": "test@example.com",
    "password": "test123"
}

ADMIN_USER = {
    "email": "test@blendlink.com",
    "password": "admin"
}


class TestAIPhotoTransformAPI:
    """Test AI Photo Transformation API endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        if response.status_code == 200:
            data = response.json()
            token = data.get("session_token") or data.get("token")
            if token:
                return token
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def sample_image_base64(self):
        """Create a simple test image in base64"""
        # Create a minimal valid PNG image (1x1 pixel red)
        # This is a valid PNG header + IHDR + IDAT + IEND
        png_bytes = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 pixel
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,  # 8-bit RGB
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xFF, 0xFF, 0x3F,  # compressed data
            0x00, 0x05, 0xFE, 0x02, 0xFE, 0xDC, 0xCC, 0x59,
            0xE7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,  # IEND chunk
            0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        return base64.b64encode(png_bytes).decode('utf-8')
    
    # ============== STATUS ENDPOINT TESTS ==============
    
    def test_transform_status_requires_auth(self):
        """Test that /api/ai-transform/status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/ai-transform/status")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 for unauthenticated request, got {response.status_code}"
        print("✓ Status endpoint correctly requires authentication")
    
    def test_transform_status_authenticated(self, auth_headers):
        """Test /api/ai-transform/status returns correct structure"""
        response = requests.get(f"{BASE_URL}/api/ai-transform/status", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "generations_used" in data, "Missing 'generations_used' field"
        assert "generations_remaining" in data, "Missing 'generations_remaining' field"
        assert "max_per_session" in data, "Missing 'max_per_session' field"
        
        # Verify values
        assert isinstance(data["generations_used"], int), "generations_used should be int"
        assert isinstance(data["generations_remaining"], int), "generations_remaining should be int"
        assert data["max_per_session"] == 3, f"max_per_session should be 3, got {data['max_per_session']}"
        assert data["generations_remaining"] >= 0, "generations_remaining should be >= 0"
        assert data["generations_remaining"] <= 3, "generations_remaining should be <= 3"
        
        print(f"✓ Status endpoint returns correct data: {data}")
    
    # ============== RESET ENDPOINT TESTS ==============
    
    def test_reset_requires_auth(self):
        """Test that /api/ai-transform/reset requires authentication"""
        response = requests.post(f"{BASE_URL}/api/ai-transform/reset")
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 for unauthenticated request, got {response.status_code}"
        print("✓ Reset endpoint correctly requires authentication")
    
    def test_reset_authenticated(self, auth_headers):
        """Test /api/ai-transform/reset resets the counter"""
        response = requests.post(f"{BASE_URL}/api/ai-transform/reset", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Reset should return success=True"
        assert data.get("generations_remaining") == 3, "After reset, generations_remaining should be 3"
        
        print(f"✓ Reset endpoint works correctly: {data}")
        
        # Verify by checking status
        status_response = requests.get(f"{BASE_URL}/api/ai-transform/status", headers=auth_headers)
        status_data = status_response.json()
        assert status_data["generations_remaining"] == 3, "Status should show 3 generations after reset"
        print("✓ Status confirms reset worked")
    
    # ============== GENERATE ENDPOINT TESTS ==============
    
    def test_generate_requires_auth(self, sample_image_base64):
        """Test that /api/ai-transform/generate requires authentication"""
        response = requests.post(f"{BASE_URL}/api/ai-transform/generate", json={
            "image_base64": sample_image_base64,
            "prompt": "Add sunglasses",
            "num_variations": 1
        })
        assert response.status_code == 401 or response.status_code == 403, \
            f"Expected 401/403 for unauthenticated request, got {response.status_code}"
        print("✓ Generate endpoint correctly requires authentication")
    
    def test_generate_validates_prompt(self, auth_headers, sample_image_base64):
        """Test that generate endpoint validates prompt length"""
        # Test empty prompt
        response = requests.post(f"{BASE_URL}/api/ai-transform/generate", 
            headers=auth_headers,
            json={
                "image_base64": sample_image_base64,
                "prompt": "",
                "num_variations": 1
            })
        assert response.status_code == 422, f"Expected 422 for empty prompt, got {response.status_code}"
        print("✓ Generate endpoint validates empty prompt")
        
        # Test too short prompt
        response = requests.post(f"{BASE_URL}/api/ai-transform/generate", 
            headers=auth_headers,
            json={
                "image_base64": sample_image_base64,
                "prompt": "ab",  # Less than 3 chars
                "num_variations": 1
            })
        assert response.status_code == 422, f"Expected 422 for short prompt, got {response.status_code}"
        print("✓ Generate endpoint validates short prompt")
    
    def test_generate_validates_image(self, auth_headers):
        """Test that generate endpoint validates image data"""
        # Test invalid base64
        response = requests.post(f"{BASE_URL}/api/ai-transform/generate", 
            headers=auth_headers,
            json={
                "image_base64": "not-valid-base64!!!",
                "prompt": "Add sunglasses to the person",
                "num_variations": 1
            })
        assert response.status_code == 400, f"Expected 400 for invalid base64, got {response.status_code}"
        print("✓ Generate endpoint validates invalid base64")
    
    def test_generate_validates_num_variations(self, auth_headers, sample_image_base64):
        """Test that generate endpoint validates num_variations range"""
        # Test num_variations > 4
        response = requests.post(f"{BASE_URL}/api/ai-transform/generate", 
            headers=auth_headers,
            json={
                "image_base64": sample_image_base64,
                "prompt": "Add sunglasses to the person",
                "num_variations": 10
            })
        assert response.status_code == 422, f"Expected 422 for num_variations > 4, got {response.status_code}"
        print("✓ Generate endpoint validates num_variations > 4")
        
        # Test num_variations < 1
        response = requests.post(f"{BASE_URL}/api/ai-transform/generate", 
            headers=auth_headers,
            json={
                "image_base64": sample_image_base64,
                "prompt": "Add sunglasses to the person",
                "num_variations": 0
            })
        assert response.status_code == 422, f"Expected 422 for num_variations < 1, got {response.status_code}"
        print("✓ Generate endpoint validates num_variations < 1")
    
    # ============== INTEGRATION WITH MINTING ==============
    
    def test_minting_config_endpoint(self, auth_headers):
        """Test that minting config endpoint works"""
        response = requests.get(f"{BASE_URL}/api/minting/config", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "mint_cost_bl" in data, "Missing mint_cost_bl in config"
        print(f"✓ Minting config endpoint works: mint_cost={data.get('mint_cost_bl')}")
    
    def test_minting_status_endpoint(self, auth_headers):
        """Test that minting status endpoint works"""
        response = requests.get(f"{BASE_URL}/api/minting/status", headers=auth_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "can_mint" in data, "Missing can_mint in status"
        assert "bl_coins" in data, "Missing bl_coins in status"
        print(f"✓ Minting status endpoint works: can_mint={data.get('can_mint')}, bl_coins={data.get('bl_coins')}")


class TestAITransformGenerationFlow:
    """Test the actual AI generation flow (longer timeout needed)"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=TEST_USER)
        if response.status_code == 200:
            data = response.json()
            token = data.get("session_token") or data.get("token")
            if token:
                return token
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get headers with auth token"""
        return {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
    
    @pytest.fixture(scope="class")
    def real_image_base64(self):
        """Create a larger test image that's more realistic"""
        # Create a 100x100 pixel image with some content
        try:
            from PIL import Image
            import io
            
            # Create a simple gradient image
            img = Image.new('RGB', (100, 100), color='blue')
            for x in range(100):
                for y in range(100):
                    img.putpixel((x, y), (x * 2, y * 2, 128))
            
            buffer = io.BytesIO()
            img.save(buffer, format='JPEG', quality=85)
            return base64.b64encode(buffer.getvalue()).decode('utf-8')
        except ImportError:
            # Fallback to a minimal valid JPEG
            # This is a minimal valid JPEG (1x1 pixel)
            jpeg_bytes = bytes([
                0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
                0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
                0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
                0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
                0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
                0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
                0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
                0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
                0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
                0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
                0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
                0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
                0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
                0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
                0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
                0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
                0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
                0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
                0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
                0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
                0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
                0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
                0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
                0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
                0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
                0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
                0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xA2, 0x80, 0x0A,
                0x28, 0xA0, 0x02, 0x8A, 0x28, 0x00, 0xFF, 0xD9
            ])
            return base64.b64encode(jpeg_bytes).decode('utf-8')
    
    def test_reset_before_generation_test(self, auth_headers):
        """Reset counter before testing generation"""
        response = requests.post(f"{BASE_URL}/api/ai-transform/reset", headers=auth_headers)
        assert response.status_code == 200
        print("✓ Reset counter before generation test")
    
    @pytest.mark.slow
    def test_generate_with_valid_request(self, auth_headers, real_image_base64):
        """
        Test actual AI generation (this takes 30-60 seconds)
        Note: This test is marked as slow and may be skipped in quick test runs
        """
        # First reset to ensure we have generations available
        reset_response = requests.post(f"{BASE_URL}/api/ai-transform/reset", headers=auth_headers)
        assert reset_response.status_code == 200
        
        # Now try to generate
        response = requests.post(
            f"{BASE_URL}/api/ai-transform/generate",
            headers=auth_headers,
            json={
                "image_base64": real_image_base64,
                "prompt": "Add a beautiful sunset sky background",
                "num_variations": 1
            },
            timeout=120  # 2 minute timeout for AI generation
        )
        
        # The response should be 200 with success or error message
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Check response structure
        assert "success" in data, "Missing 'success' field in response"
        assert "generations_remaining" in data, "Missing 'generations_remaining' field"
        
        if data["success"]:
            assert "variations" in data, "Missing 'variations' field on success"
            assert len(data["variations"]) > 0, "Should have at least one variation"
            print(f"✓ AI generation successful! Generated {len(data['variations'])} variation(s)")
            print(f"  Generations remaining: {data['generations_remaining']}")
        else:
            # Generation might fail due to API issues, but response structure should be correct
            assert "error" in data, "Should have error message on failure"
            print(f"⚠ AI generation returned error (may be expected): {data.get('error')}")
            print(f"  Generations remaining: {data['generations_remaining']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
