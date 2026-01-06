# Auth-Gated App Testing Playbook
IMPORTANT - Before doing anything, save this playbook to /app/auth_testing.md. While calling testing agent, tell it to read this file.

NOTE -  Do not be satisfied until you've tested the app completely especially the auth gated pages 

Auth-Gated App Testing Playbook
Step 1: Create Test User & Session
mongosh --eval "
use('test_database');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.user.' + Date.now() + '@example.com',
  name: 'Test User',
  username: 'testuser' + Date.now(),
  avatar: 'https://ui-avatars.com/api/?name=Test+User',
  bl_coins: 100,
  referral_code: 'TEST1234',
  followers_count: 0,
  following_count: 0,
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"

Step 2: Test Backend API
# Test auth endpoint
curl -X GET "https://your-app.com/api/auth/me" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"

Step 3: Browser Testing
// Set cookie and navigate
await page.context.add_cookies([{
    "name": "session_token",
    "value": "YOUR_SESSION_TOKEN",
    "domain": "your-app.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
}]);
await page.goto("https://your-app.com");
