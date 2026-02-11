"""
Slug Validation API Tests - Iteration 127
Tests for the comprehensive slug validation system in Member Pages
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://pages-enhance.preview.emergentagent.com')

class TestSlugValidationAPI:
    """Test slug validation endpoint /api/member-pages/check-slug/{slug}"""
    
    def test_valid_slug_available(self):
        """Test a valid slug format that should be available"""
        # Use unique slug to avoid conflicts
        import time
        unique_slug = f"test-store-{int(time.time())}"
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/{unique_slug}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "slug" in data
        assert "is_available" in data
        assert "is_valid" in data
        assert "error" in data
        assert "suggestions" in data
        assert "validation_rules" in data
        
        # Valid and available
        assert data["is_valid"] is True
        assert data["is_available"] is True
        assert data["error"] is None
        assert data["suggestions"] == []
        print(f"✓ Valid slug '{unique_slug}' check passed")
    
    def test_reserved_slug_admin(self):
        """Test that 'admin' is blocked as reserved"""
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/admin")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_valid"] is False
        assert data["is_available"] is False
        assert "'admin' is a reserved name" in data["error"]
        assert len(data["suggestions"]) > 0
        print(f"✓ Reserved slug 'admin' correctly blocked")
    
    def test_reserved_slug_marketplace(self):
        """Test that 'marketplace' is blocked as reserved"""
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/marketplace")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_valid"] is False
        assert data["is_available"] is False
        assert "'marketplace' is a reserved name" in data["error"]
        print(f"✓ Reserved slug 'marketplace' correctly blocked")
    
    def test_reserved_slug_login(self):
        """Test that 'login' is blocked as reserved"""
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/login")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_valid"] is False
        assert data["is_available"] is False
        assert "'login' is a reserved name" in data["error"]
        print(f"✓ Reserved slug 'login' correctly blocked")

    def test_reserved_slug_dashboard(self):
        """Test that 'dashboard' is blocked as reserved"""
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/dashboard")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_valid"] is False
        assert data["is_available"] is False
        assert "'dashboard' is a reserved name" in data["error"]
        print(f"✓ Reserved slug 'dashboard' correctly blocked")


class TestSlugFormatValidation:
    """Test slug format validation rules"""
    
    def test_slug_starts_with_number_rejected(self):
        """Test that slugs starting with numbers are rejected"""
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/123store")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_valid"] is False
        assert "must start with a letter" in data["error"].lower()
        assert len(data["suggestions"]) > 0
        print(f"✓ Slug starting with number correctly rejected")
    
    def test_consecutive_hyphens_rejected(self):
        """Test that consecutive hyphens are rejected"""
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/my--store")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_valid"] is False
        assert "consecutive hyphens" in data["error"].lower()
        print(f"✓ Consecutive hyphens correctly rejected")
    
    def test_trailing_hyphen_rejected(self):
        """Test that trailing hyphens are rejected"""
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/store-")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_valid"] is False
        assert "cannot end with a hyphen" in data["error"].lower()
        print(f"✓ Trailing hyphen correctly rejected")
    
    def test_too_short_slug_rejected(self):
        """Test that slugs under 3 characters are rejected"""
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/ab")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_valid"] is False
        assert "at least 3 characters" in data["error"].lower()
        print(f"✓ Too short slug correctly rejected")
    
    def test_valid_3_char_slug(self):
        """Test that 3-character slugs are valid"""
        import time
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/abc")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be valid format (may or may not be available)
        assert data["is_valid"] is True
        print(f"✓ 3-character slug format accepted")
    
    def test_valid_slug_with_numbers(self):
        """Test that slugs with numbers (after letter) are valid"""
        import time
        unique_slug = f"store123test{int(time.time()) % 10000}"
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/{unique_slug}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_valid"] is True
        print(f"✓ Slug with numbers after letter accepted")
    
    def test_valid_slug_with_hyphens(self):
        """Test that slugs with properly placed hyphens are valid"""
        import time
        unique_slug = f"my-test-store-{int(time.time()) % 10000}"
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/{unique_slug}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_valid"] is True
        print(f"✓ Slug with proper hyphens accepted")


class TestSlugValidationRules:
    """Test that validation rules are returned correctly"""
    
    def test_validation_rules_structure(self):
        """Test that validation rules object is returned with correct structure"""
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/test-slug")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "validation_rules" in data
        rules = data["validation_rules"]
        
        assert rules["min_length"] == 3
        assert rules["max_length"] == 50
        assert "pattern" in rules
        assert "rules" in rules
        assert len(rules["rules"]) >= 5
        print(f"✓ Validation rules structure correct")
    
    def test_suggestions_provided_for_invalid_slug(self):
        """Test that suggestions are provided when slug is invalid"""
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/admin")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_available"] is False
        assert len(data["suggestions"]) > 0
        
        # Verify suggestions are valid alternatives
        for suggestion in data["suggestions"][:3]:
            assert suggestion.startswith("admin-")
        print(f"✓ Suggestions provided for reserved slug")


class TestMoreReservedSlugs:
    """Test additional reserved slugs"""
    
    @pytest.mark.parametrize("slug", [
        "api", "auth", "settings", "profile", "wallet",
        "help", "support", "about", "contact", "terms",
        "privacy", "store", "shop", "pages", "create"
    ])
    def test_reserved_slugs_blocked(self, slug):
        """Test that various reserved slugs are blocked"""
        response = requests.get(f"{BASE_URL}/api/member-pages/check-slug/{slug}")
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_valid"] is False
        assert data["is_available"] is False
        assert "reserved name" in data["error"].lower()
        print(f"✓ Reserved slug '{slug}' correctly blocked")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
