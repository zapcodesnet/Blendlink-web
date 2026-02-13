"""
Blendlink Iteration 11 Tests - Album System & AI Listing Creator
Tests:
- Album CRUD operations (create, get, delete)
- Video thumbnail generation with FFmpeg
- File upload to albums
- Thumbnail file serving
- AI Listing Creator endpoints
"""

import pytest
import requests
import os
import base64
from io import BytesIO

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://priority-tier.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "Test123456"


class TestAlbumSystem:
    """Album CRUD and media management tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data["token"]
        self.user_id = data["user"]["user_id"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.created_album_ids = []
        yield
        # Cleanup: Delete created albums
        for album_id in self.created_album_ids:
            try:
                requests.delete(
                    f"{BASE_URL}/api/albums/{album_id}",
                    headers=self.headers
                )
            except:
                pass
    
    def test_album_create_requires_auth(self):
        """Test that album creation requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/albums/create",
            json={"name": "Test Album", "description": "Test"}
        )
        assert response.status_code == 401, "Should require authentication"
        print("✓ Album creation requires authentication (401)")
    
    def test_album_create_success(self):
        """Test successful album creation"""
        response = requests.post(
            f"{BASE_URL}/api/albums/create",
            headers=self.headers,
            json={
                "name": "TEST_Album_Iteration11",
                "description": "Test album for iteration 11",
                "media_type": "mixed",
                "privacy": "public",
                "auto_post_to_feed": True
            }
        )
        assert response.status_code == 200, f"Album creation failed: {response.text}"
        data = response.json()
        
        assert "album_id" in data, "Response should contain album_id"
        assert data["album"]["name"] == "TEST_Album_Iteration11"
        assert data["album"]["privacy"] == "public"
        assert data["album"]["media_type"] == "mixed"
        
        self.created_album_ids.append(data["album_id"])
        print(f"✓ Album created successfully: {data['album_id']}")
        return data["album_id"]
    
    def test_album_create_private(self):
        """Test creating a private album"""
        response = requests.post(
            f"{BASE_URL}/api/albums/create",
            headers=self.headers,
            json={
                "name": "TEST_Private_Album",
                "description": "Private test album",
                "media_type": "photo",
                "privacy": "private",
                "auto_post_to_feed": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["album"]["privacy"] == "private"
        self.created_album_ids.append(data["album_id"])
        print(f"✓ Private album created: {data['album_id']}")
    
    def test_get_my_albums(self):
        """Test getting user's albums"""
        # First create an album
        create_resp = requests.post(
            f"{BASE_URL}/api/albums/create",
            headers=self.headers,
            json={"name": "TEST_MyAlbums_Test", "description": "Test"}
        )
        assert create_resp.status_code == 200
        self.created_album_ids.append(create_resp.json()["album_id"])
        
        # Get albums
        response = requests.get(
            f"{BASE_URL}/api/albums/my",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get albums failed: {response.text}"
        data = response.json()
        
        assert "albums" in data, "Response should contain albums array"
        assert "count" in data, "Response should contain count"
        assert isinstance(data["albums"], list)
        assert len(data["albums"]) > 0, "Should have at least one album"
        print(f"✓ Got {data['count']} albums")
    
    def test_get_album_detail(self):
        """Test getting album details"""
        # Create album first
        create_resp = requests.post(
            f"{BASE_URL}/api/albums/create",
            headers=self.headers,
            json={"name": "TEST_Detail_Album", "description": "Detail test"}
        )
        assert create_resp.status_code == 200
        album_id = create_resp.json()["album_id"]
        self.created_album_ids.append(album_id)
        
        # Get album detail
        response = requests.get(
            f"{BASE_URL}/api/albums/{album_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Get album detail failed: {response.text}"
        data = response.json()
        
        assert data["album_id"] == album_id
        assert data["name"] == "TEST_Detail_Album"
        assert "owner" in data, "Should include owner info"
        print(f"✓ Got album detail for {album_id}")
    
    def test_get_album_not_found(self):
        """Test getting non-existent album"""
        response = requests.get(
            f"{BASE_URL}/api/albums/nonexistent_album_123",
            headers=self.headers
        )
        assert response.status_code == 404, "Should return 404 for non-existent album"
        print("✓ Non-existent album returns 404")
    
    def test_delete_album(self):
        """Test deleting an album"""
        # Create album first
        create_resp = requests.post(
            f"{BASE_URL}/api/albums/create",
            headers=self.headers,
            json={"name": "TEST_Delete_Album", "description": "To be deleted"}
        )
        assert create_resp.status_code == 200
        album_id = create_resp.json()["album_id"]
        
        # Delete album
        response = requests.delete(
            f"{BASE_URL}/api/albums/{album_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Delete failed: {response.text}"
        data = response.json()
        assert data["message"] == "Album deleted"
        
        # Verify deletion
        verify_resp = requests.get(
            f"{BASE_URL}/api/albums/{album_id}",
            headers=self.headers
        )
        assert verify_resp.status_code == 404, "Album should be deleted"
        print(f"✓ Album {album_id} deleted successfully")
    
    def test_delete_album_not_found(self):
        """Test deleting non-existent album"""
        response = requests.delete(
            f"{BASE_URL}/api/albums/nonexistent_album_456",
            headers=self.headers
        )
        assert response.status_code == 404
        print("✓ Delete non-existent album returns 404")


class TestAlbumMediaUpload:
    """Album media upload and thumbnail tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and create test album"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        self.headers_multipart = {
            "Authorization": f"Bearer {self.token}"
        }
        
        # Create test album
        album_resp = requests.post(
            f"{BASE_URL}/api/albums/create",
            headers=self.headers,
            json={"name": "TEST_Upload_Album", "description": "For upload tests"}
        )
        assert album_resp.status_code == 200
        self.album_id = album_resp.json()["album_id"]
        yield
        # Cleanup
        requests.delete(f"{BASE_URL}/api/albums/{self.album_id}", headers=self.headers)
    
    def test_upload_image_to_album(self):
        """Test uploading an image to album"""
        # Create a simple test image (1x1 red pixel PNG)
        import struct
        import zlib
        
        def create_png():
            # Minimal PNG: 1x1 red pixel
            signature = b'\x89PNG\r\n\x1a\n'
            
            # IHDR chunk
            ihdr_data = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
            ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
            ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
            
            # IDAT chunk (red pixel)
            raw_data = b'\x00\xff\x00\x00'  # filter byte + RGB
            compressed = zlib.compress(raw_data)
            idat_crc = zlib.crc32(b'IDAT' + compressed) & 0xffffffff
            idat = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
            
            # IEND chunk
            iend_crc = zlib.crc32(b'IEND') & 0xffffffff
            iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
            
            return signature + ihdr + idat + iend
        
        png_data = create_png()
        
        files = {
            'file': ('test_image.png', BytesIO(png_data), 'image/png')
        }
        data = {
            'title': 'Test Image Upload'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/albums/{self.album_id}/upload",
            headers=self.headers_multipart,
            files=files,
            data=data
        )
        assert response.status_code == 200, f"Upload failed: {response.text}"
        result = response.json()
        
        assert "media_id" in result
        assert "media_url" in result
        assert result["album_id"] == self.album_id
        print(f"✓ Image uploaded to album: {result['media_id']}")
    
    def test_upload_requires_auth(self):
        """Test that upload requires authentication"""
        files = {
            'file': ('test.png', BytesIO(b'fake image data'), 'image/png')
        }
        response = requests.post(
            f"{BASE_URL}/api/albums/{self.album_id}/upload",
            files=files
        )
        assert response.status_code == 401
        print("✓ Upload requires authentication (401)")


class TestVideoThumbnailGeneration:
    """Video thumbnail generation with FFmpeg tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_generate_thumbnail_requires_auth(self):
        """Test that thumbnail generation requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/albums/generate-thumbnail",
            json={"video_url": "test.mp4"}
        )
        assert response.status_code == 401
        print("✓ Thumbnail generation requires authentication (401)")
    
    def test_generate_thumbnail_video_not_found(self):
        """Test thumbnail generation with non-existent video"""
        response = requests.post(
            f"{BASE_URL}/api/albums/generate-thumbnail",
            headers=self.headers,
            json={"video_url": "/api/upload/files/nonexistent_video.mp4"}
        )
        # Should return 404, 422, or 500 for non-existent video
        assert response.status_code in [404, 422, 500]
        print(f"✓ Non-existent video returns error (status: {response.status_code})")


class TestThumbnailFileServing:
    """Thumbnail file serving tests"""
    
    def test_thumbnail_not_found(self):
        """Test serving non-existent thumbnail"""
        response = requests.get(
            f"{BASE_URL}/api/upload/files/thumbnails/nonexistent_thumb.jpg"
        )
        assert response.status_code == 404
        print("✓ Non-existent thumbnail returns 404")
    
    def test_thumbnail_endpoint_exists(self):
        """Test that thumbnail endpoint is accessible"""
        # Just verify the endpoint exists (returns 404 for missing file, not 500)
        response = requests.get(
            f"{BASE_URL}/api/upload/files/thumbnails/test.jpg"
        )
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        print("✓ Thumbnail endpoint is accessible")


class TestAIListingCreator:
    """AI Listing Creator endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_ai_analyze_listing_requires_auth(self):
        """Test that AI listing analysis requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-tools/analyze-listing",
            json={"images": [], "condition": "used"}
        )
        assert response.status_code == 401
        print("✓ AI analyze listing requires authentication (401)")
    
    def test_ai_price_suggestions_requires_auth(self):
        """Test that AI price suggestion requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/ai-tools/price-suggestions",
            json={"title": "Test", "category": "electronics"}
        )
        assert response.status_code == 401
        print("✓ AI price suggestions requires authentication (401)")
    
    def test_ai_analyze_listing_endpoint_exists(self):
        """Test that AI analyze listing endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/ai-tools/analyze-listing",
            headers=self.headers,
            json={
                "images": [],
                "condition": "used",
                "target_countries": ["US"]
            }
        )
        # Should return 400 (no images) or 200 (with fallback), not 404
        assert response.status_code in [200, 400, 422, 500], f"Unexpected status: {response.status_code}"
        print(f"✓ AI analyze listing endpoint exists (status: {response.status_code})")
    
    def test_ai_price_suggestions_endpoint_exists(self):
        """Test that AI price suggestion endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/ai-tools/price-suggestions",
            headers=self.headers,
            json={
                "title": "Test Product",
                "description": "A test product",
                "category": "electronics",
                "condition": "used",
                "target_countries": ["US"]
            }
        )
        # Should return 200 or error, not 404
        assert response.status_code in [200, 400, 422, 500], f"Unexpected status: {response.status_code}"
        print(f"✓ AI price suggestions endpoint exists (status: {response.status_code})")


class TestExistingAlbum:
    """Test with existing album mentioned in context"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_get_existing_album(self):
        """Test getting the existing test album"""
        # Try to get the album mentioned in context
        response = requests.get(
            f"{BASE_URL}/api/albums/album_50a500af1f42",
            headers=self.headers
        )
        # May or may not exist depending on test state
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Found existing album: {data['name']}")
        else:
            print(f"✓ Existing album not found (status: {response.status_code})")


class TestMarketplaceListingCreation:
    """Test marketplace listing creation (used by AI Listing Creator)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        self.token = data["token"]
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_create_listing_requires_auth(self):
        """Test that listing creation requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/marketplace/listings",
            json={"title": "Test", "price": 100, "category": "other"}
        )
        assert response.status_code == 401
        print("✓ Listing creation requires authentication (401)")
    
    def test_create_listing_success(self):
        """Test successful listing creation"""
        response = requests.post(
            f"{BASE_URL}/api/marketplace/listings",
            headers=self.headers,
            json={
                "title": "TEST_AI_Created_Listing",
                "description": "Created via AI Listing Creator test",
                "price": 99.99,
                "category": "electronics",
                "condition": "used",
                "images": [],
                "is_digital": False
            }
        )
        assert response.status_code == 200, f"Listing creation failed: {response.text}"
        data = response.json()
        
        assert "listing_id" in data
        assert data["title"] == "TEST_AI_Created_Listing"
        assert data["price"] == 99.99
        print(f"✓ Listing created: {data['listing_id']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
