#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Blendlink Super App
Tests all major API endpoints including auth, social features, marketplace, games, etc.
"""

import requests
import sys
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

class BlendlinkAPITester:
    def __init__(self, base_url: str = "https://tapbattle-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
        # Test data - using provided test credentials
        self.test_user_data = {
            "email": "test@test.com",
            "password": "Test123456",
            "name": "Test User",
            "username": "testuser"
        }
        self.token = None
        self.user_id = None
        self.test_results = {
            "total_tests": 0,
            "passed_tests": 0,
            "failed_tests": [],
            "critical_failures": [],
            "api_endpoints_tested": []
        }

    def log_test(self, test_name: str, success: bool, response_code: int = None, error: str = None):
        """Log test results"""
        self.test_results["total_tests"] += 1
        self.test_results["api_endpoints_tested"].append(test_name)
        
        if success:
            self.test_results["passed_tests"] += 1
            print(f"✅ {test_name} - PASSED (Status: {response_code})")
        else:
            failure_info = {
                "test": test_name,
                "status_code": response_code,
                "error": error
            }
            self.test_results["failed_tests"].append(failure_info)
            
            # Mark as critical if it's a core functionality
            if any(critical in test_name.lower() for critical in ['auth', 'login', 'register', 'health']):
                self.test_results["critical_failures"].append(failure_info)
            
            print(f"❌ {test_name} - FAILED (Status: {response_code}) - {error}")

    def test_health_check(self):
        """Test basic health endpoints"""
        try:
            # Test root endpoint
            response = self.session.get(f"{self.api_url}/")
            self.log_test("API Root Health", response.status_code == 200, response.status_code)
            
            # Test health endpoint
            response = self.session.get(f"{self.api_url}/health")
            self.log_test("Health Check", response.status_code == 200, response.status_code)
            
        except Exception as e:
            self.log_test("Health Check", False, None, str(e))

    def test_user_registration(self):
        """Test user registration"""
        try:
            response = self.session.post(f"{self.api_url}/auth/register", json=self.test_user_data)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                self.user_id = data.get("user_id")
                self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                self.log_test("User Registration", True, response.status_code)
                return True
            else:
                self.log_test("User Registration", False, response.status_code, response.text)
                return False
                
        except Exception as e:
            self.log_test("User Registration", False, None, str(e))
            return False

    def test_user_login(self):
        """Test user login"""
        try:
            login_data = {
                "email": self.test_user_data["email"],
                "password": self.test_user_data["password"]
            }
            response = self.session.post(f"{self.api_url}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                self.session.headers.update({'Authorization': f'Bearer {self.token}'})
                self.log_test("User Login", True, response.status_code)
                return True
            else:
                self.log_test("User Login", False, response.status_code, response.text)
                return False
                
        except Exception as e:
            self.log_test("User Login", False, None, str(e))
            return False

    def test_auth_me(self):
        """Test getting current user info"""
        try:
            response = self.session.get(f"{self.api_url}/auth/me")
            success = response.status_code == 200
            self.log_test("Auth Me", success, response.status_code, response.text if not success else None)
            return success
        except Exception as e:
            self.log_test("Auth Me", False, None, str(e))
            return False

    def test_posts_functionality(self):
        """Test posts and social features"""
        try:
            # Test create post
            post_data = {
                "content": "This is a test post from automated testing!",
                "images": [],
                "is_story": False
            }
            response = self.session.post(f"{self.api_url}/posts", json=post_data)
            post_created = response.status_code == 200
            self.log_test("Create Post", post_created, response.status_code, response.text if not post_created else None)
            
            post_id = None
            if post_created:
                post_id = response.json().get("post_id")
            
            # Test get feed
            response = self.session.get(f"{self.api_url}/posts/feed")
            self.log_test("Get Feed", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test explore posts
            response = self.session.get(f"{self.api_url}/posts/explore")
            self.log_test("Explore Posts", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test like post if we have a post_id
            if post_id:
                response = self.session.post(f"{self.api_url}/posts/{post_id}/like")
                self.log_test("Like Post", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test stories
            response = self.session.get(f"{self.api_url}/posts/stories")
            self.log_test("Get Stories", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("Posts Functionality", False, None, str(e))

    def test_marketplace_functionality(self):
        """Test marketplace features"""
        try:
            # Test get listings
            response = self.session.get(f"{self.api_url}/marketplace/listings")
            self.log_test("Get Marketplace Listings", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test get categories
            response = self.session.get(f"{self.api_url}/marketplace/categories")
            self.log_test("Get Marketplace Categories", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test create listing
            listing_data = {
                "title": "Test Item for Sale",
                "description": "This is a test listing created by automated testing",
                "price": 99.99,
                "category": "electronics",
                "images": [],
                "condition": "new",
                "is_digital": False
            }
            response = self.session.post(f"{self.api_url}/marketplace/listings", json=listing_data)
            self.log_test("Create Marketplace Listing", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("Marketplace Functionality", False, None, str(e))

    def test_games_functionality(self):
        """Test gaming features"""
        try:
            # Test spin wheel game
            response = self.session.post(f"{self.api_url}/games/spin-wheel")
            self.log_test("Spin Wheel Game", response.status_code in [200, 400], response.status_code, response.text if response.status_code not in [200, 400] else None)
            
            # Test scratch card game
            response = self.session.post(f"{self.api_url}/games/scratch-card")
            self.log_test("Scratch Card Game", response.status_code in [200, 400], response.status_code, response.text if response.status_code not in [200, 400] else None)
            
            # Test memory match game
            memory_data = {"moves": 15, "time_seconds": 45}
            response = self.session.post(f"{self.api_url}/games/memory-match", json=memory_data)
            self.log_test("Memory Match Game", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("Games Functionality", False, None, str(e))

    def test_wallet_functionality(self):
        """Test wallet and BL Coins features"""
        try:
            # Test get balance
            response = self.session.get(f"{self.api_url}/wallet/balance")
            self.log_test("Get Wallet Balance", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test get transactions
            response = self.session.get(f"{self.api_url}/wallet/transactions")
            self.log_test("Get Wallet Transactions", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test wallet stats
            response = self.session.get(f"{self.api_url}/wallet/stats")
            self.log_test("Get Wallet Stats", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("Wallet Functionality", False, None, str(e))

    def test_referrals_functionality(self):
        """Test referral system"""
        try:
            # Test get referral stats
            response = self.session.get(f"{self.api_url}/referrals/stats")
            self.log_test("Get Referral Stats", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("Referrals Functionality", False, None, str(e))

    def test_raffles_functionality(self):
        """Test raffle system"""
        try:
            # Test get raffles
            response = self.session.get(f"{self.api_url}/raffles")
            self.log_test("Get Raffles", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("Raffles Functionality", False, None, str(e))

    def test_rentals_functionality(self):
        """Test property rentals"""
        try:
            # Test get properties
            response = self.session.get(f"{self.api_url}/rentals/properties")
            self.log_test("Get Rental Properties", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test create property
            property_data = {
                "title": "Test Property Rental",
                "description": "This is a test property listing",
                "property_type": "apartment",
                "price": 1500.00,
                "bedrooms": 2,
                "bathrooms": 1,
                "location": "Test City",
                "images": [],
                "amenities": ["parking", "wifi"]
            }
            response = self.session.post(f"{self.api_url}/rentals/properties", json=property_data)
            self.log_test("Create Rental Property", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("Rentals Functionality", False, None, str(e))

    def test_services_functionality(self):
        """Test professional services"""
        try:
            # Test get services
            response = self.session.get(f"{self.api_url}/services")
            self.log_test("Get Services", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test get service categories
            response = self.session.get(f"{self.api_url}/services/categories/list")
            self.log_test("Get Service Categories", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test create service
            service_data = {
                "title": "Test Professional Service",
                "description": "This is a test service offering",
                "category": "tech",
                "hourly_rate": 50.00,
                "location": "Remote",
                "is_remote": True
            }
            response = self.session.post(f"{self.api_url}/services", json=service_data)
            self.log_test("Create Service", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("Services Functionality", False, None, str(e))

    def test_messages_functionality(self):
        """Test messaging system"""
        try:
            # Test get conversations
            response = self.session.get(f"{self.api_url}/messages/conversations")
            self.log_test("Get Message Conversations", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("Messages Functionality", False, None, str(e))

    def test_notifications_functionality(self):
        """Test notifications system"""
        try:
            # Test get notifications
            response = self.session.get(f"{self.api_url}/notifications/")
            success = response.status_code == 200
            self.log_test("Get Notifications", success, response.status_code, response.text if not success else None)
            
            if success:
                data = response.json()
                # Check response structure
                if "notifications" in data and "unread_count" in data:
                    self.log_test("Notifications Response Structure", True, response.status_code)
                else:
                    self.log_test("Notifications Response Structure", False, response.status_code, "Missing required fields")
            
            # Test mark all notifications as read
            response = self.session.post(f"{self.api_url}/notifications/mark-all-read")
            self.log_test("Mark All Notifications Read", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test mark specific notifications as read
            mark_read_data = {"notification_ids": []}
            response = self.session.post(f"{self.api_url}/notifications/mark-read", json=mark_read_data)
            self.log_test("Mark Specific Notifications Read", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("Notifications Functionality", False, None, str(e))

    def test_analytics_functionality(self):
        """Test analytics system"""
        try:
            # Test analytics summary
            response = self.session.get(f"{self.api_url}/analytics/summary")
            success = response.status_code == 200
            self.log_test("Analytics Summary", success, response.status_code, response.text if not success else None)
            
            if success:
                data = response.json()
                # Check for required fields
                required_fields = ["bl_coins_balance", "today_earned", "unread_notifications"]
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    self.log_test("Analytics Summary Structure", True, response.status_code)
                else:
                    self.log_test("Analytics Summary Structure", False, response.status_code, f"Missing fields: {missing_fields}")
            
            # Test my stats
            response = self.session.get(f"{self.api_url}/analytics/my-stats?days=30")
            self.log_test("Analytics My Stats", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test trends
            response = self.session.get(f"{self.api_url}/analytics/trends?days=30")
            self.log_test("Analytics Trends", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
            # Test leaderboard
            response = self.session.get(f"{self.api_url}/analytics/leaderboard?metric=bl_coins_earned&days=7&limit=10")
            self.log_test("Analytics Leaderboard", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("Analytics Functionality", False, None, str(e))

    def test_ai_media_functionality(self):
        """Test AI media generation"""
        try:
            # Test estimate cost
            estimate_data = {
                "prompt": "A beautiful sunset over mountains",
                "media_type": "image"
            }
            response = self.session.post(f"{self.api_url}/ai-media/estimate-cost", json=estimate_data)
            success = response.status_code == 200
            self.log_test("AI Media Estimate Cost", success, response.status_code, response.text if not success else None)
            
            if success:
                data = response.json()
                # Check response structure
                required_fields = ["estimated_cost", "current_balance", "can_afford", "media_type"]
                missing_fields = [field for field in required_fields if field not in data]
                if not missing_fields:
                    self.log_test("AI Media Estimate Structure", True, response.status_code)
                else:
                    self.log_test("AI Media Estimate Structure", False, response.status_code, f"Missing fields: {missing_fields}")
            
            # Test get my generations
            response = self.session.get(f"{self.api_url}/ai-media/my-generations")
            self.log_test("AI Media My Generations", response.status_code == 200, response.status_code, response.text if response.status_code != 200 else None)
            
        except Exception as e:
            self.log_test("AI Media Functionality", False, None, str(e))

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Blendlink Backend API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)
        
        # Test basic health
        self.test_health_check()
        
        # Test authentication flow
        if not self.test_user_login():
            # If login fails, try registration (user might not exist)
            if self.test_user_registration():
                self.test_auth_me()
            else:
                print("❌ Critical: Cannot authenticate user - stopping tests")
                return self.generate_report()
        
        # Test all features (only if authenticated)
        if self.token:
            self.test_posts_functionality()
            self.test_marketplace_functionality()
            self.test_games_functionality()
            self.test_wallet_functionality()
            self.test_referrals_functionality()
            self.test_raffles_functionality()
            self.test_rentals_functionality()
            self.test_services_functionality()
            self.test_messages_functionality()
            self.test_notifications_functionality()
            self.test_analytics_functionality()
            self.test_ai_media_functionality()
        
        return self.generate_report()

    def generate_report(self):
        """Generate final test report"""
        print("\n" + "=" * 60)
        print("📊 BACKEND API TEST RESULTS")
        print("=" * 60)
        
        success_rate = (self.test_results["passed_tests"] / self.test_results["total_tests"]) * 100 if self.test_results["total_tests"] > 0 else 0
        
        print(f"Total Tests: {self.test_results['total_tests']}")
        print(f"Passed: {self.test_results['passed_tests']}")
        print(f"Failed: {len(self.test_results['failed_tests'])}")
        print(f"Success Rate: {success_rate:.1f}%")
        
        if self.test_results["critical_failures"]:
            print(f"\n🚨 CRITICAL FAILURES ({len(self.test_results['critical_failures'])}):")
            for failure in self.test_results["critical_failures"]:
                print(f"  - {failure['test']}: {failure['error']}")
        
        if self.test_results["failed_tests"]:
            print(f"\n❌ ALL FAILURES ({len(self.test_results['failed_tests'])}):")
            for failure in self.test_results["failed_tests"]:
                print(f"  - {failure['test']} (Status: {failure['status_code']})")
        
        # Determine overall status
        if len(self.test_results["critical_failures"]) > 0:
            print("\n🔴 OVERALL STATUS: CRITICAL ISSUES FOUND")
            return False
        elif success_rate < 70:
            print("\n🟡 OVERALL STATUS: MULTIPLE ISSUES FOUND")
            return False
        else:
            print("\n🟢 OVERALL STATUS: BACKEND HEALTHY")
            return True

def main():
    """Main test execution"""
    tester = BlendlinkAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump(tester.test_results, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())