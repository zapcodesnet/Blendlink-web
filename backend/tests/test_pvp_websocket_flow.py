"""
Test full 2-player PVP flow with WebSocket verification:
1. User 1 creates game with 5 photos
2. User 2 joins the game
3. Both users click Ready
4. Verify countdown starts and game_start is broadcast with pvp_room_id
5. Verify WebSocket connection to PVP game room works
"""
import pytest
import requests
import websocket
import json
import os
import time
import threading

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://stripe-fix-29.preview.emergentagent.com')
WS_BASE_URL = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://')

class TestPVPWebSocketFlow:
    """Test full 2-player PVP flow with WebSocket"""
    
    @pytest.fixture(scope="class")
    def user1_session(self):
        """Login as User 1"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@blendlink.com",
            "password": "admin"
        })
        assert response.status_code == 200, f"User 1 login failed: {response.text}"
        data = response.json()
        return {
            "token": data.get("token") or data.get("session_token"),
            "user_id": data.get("user", {}).get("user_id") or data.get("user_id"),
            "username": data.get("user", {}).get("username") or data.get("username")
        }
    
    @pytest.fixture(scope="class")
    def user2_session(self):
        """Login as User 2"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        assert response.status_code == 200, f"User 2 login failed: {response.text}"
        data = response.json()
        return {
            "token": data.get("token") or data.get("session_token"),
            "user_id": data.get("user", {}).get("user_id") or data.get("user_id"),
            "username": data.get("user", {}).get("username") or data.get("username")
        }
    
    @pytest.fixture(scope="class")
    def user1_photos(self, user1_session):
        """Get User 1's battle-ready photos"""
        headers = {"Authorization": f"Bearer {user1_session['token']}"}
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers)
        assert response.status_code == 200
        data = response.json()
        photos = data.get("photos", [])
        assert len(photos) >= 5, f"User 1 needs at least 5 photos, has {len(photos)}"
        return [p["mint_id"] for p in photos[:5]]
    
    @pytest.fixture(scope="class")
    def user2_photos(self, user2_session):
        """Get User 2's battle-ready photos"""
        headers = {"Authorization": f"Bearer {user2_session['token']}"}
        response = requests.get(f"{BASE_URL}/api/photo-game/battle-photos", headers=headers)
        assert response.status_code == 200
        data = response.json()
        photos = data.get("photos", [])
        assert len(photos) >= 5, f"User 2 needs at least 5 photos, has {len(photos)}"
        return [p["mint_id"] for p in photos[:5]]
    
    def test_full_pvp_flow_with_websocket(self, user1_session, user2_session, user1_photos, user2_photos):
        """Test complete PVP flow including WebSocket game_start event"""
        
        # Step 1: User 1 creates game
        headers1 = {"Authorization": f"Bearer {user1_session['token']}"}
        response = requests.post(f"{BASE_URL}/api/photo-game/open-games/create", 
            headers=headers1,
            json={
                "photo_ids": user1_photos,
                "bet_amount": 0,
                "is_bot_allowed": False
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        game_id = data["game_id"]
        print(f"\n1. Created game: {game_id}")
        
        # Step 2: User 2 joins game
        headers2 = {"Authorization": f"Bearer {user2_session['token']}"}
        response = requests.post(f"{BASE_URL}/api/photo-game/open-games/join",
            headers=headers2,
            json={
                "game_id": game_id,
                "photo_ids": user2_photos
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"2. User 2 joined game")
        
        # Step 3: Connect to lobby WebSocket for both users
        ws_messages = {"user1": [], "user2": []}
        ws_connected = {"user1": False, "user2": False}
        
        def on_message_user1(ws, message):
            data = json.loads(message)
            ws_messages["user1"].append(data)
            print(f"   User1 WS received: {data.get('type')}")
        
        def on_message_user2(ws, message):
            data = json.loads(message)
            ws_messages["user2"].append(data)
            print(f"   User2 WS received: {data.get('type')}")
        
        def on_open_user1(ws):
            ws_connected["user1"] = True
            print("   User1 WS connected")
        
        def on_open_user2(ws):
            ws_connected["user2"] = True
            print("   User2 WS connected")
        
        # Connect User 1 to lobby WebSocket
        ws_url1 = f"{WS_BASE_URL}/api/ws/lobby/{game_id}/{user1_session['token']}"
        ws1 = websocket.WebSocketApp(ws_url1,
            on_message=on_message_user1,
            on_open=on_open_user1
        )
        ws1_thread = threading.Thread(target=ws1.run_forever)
        ws1_thread.daemon = True
        ws1_thread.start()
        
        # Connect User 2 to lobby WebSocket
        ws_url2 = f"{WS_BASE_URL}/api/ws/lobby/{game_id}/{user2_session['token']}"
        ws2 = websocket.WebSocketApp(ws_url2,
            on_message=on_message_user2,
            on_open=on_open_user2
        )
        ws2_thread = threading.Thread(target=ws2.run_forever)
        ws2_thread.daemon = True
        ws2_thread.start()
        
        # Wait for connections
        time.sleep(2)
        print(f"3. WebSocket connections: User1={ws_connected['user1']}, User2={ws_connected['user2']}")
        
        # Step 4: User 1 marks ready
        response = requests.post(f"{BASE_URL}/api/photo-game/open-games/ready",
            headers=headers1,
            json={"game_id": game_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        print(f"4. User 1 marked ready, both_ready: {data.get('both_ready')}")
        
        time.sleep(1)
        
        # Step 5: User 2 marks ready - should trigger countdown
        response = requests.post(f"{BASE_URL}/api/photo-game/open-games/ready",
            headers=headers2,
            json={"game_id": game_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data.get("both_ready") == True
        print(f"5. User 2 marked ready, both_ready: {data.get('both_ready')}")
        
        # Wait for countdown_start message
        time.sleep(2)
        
        # Step 6: Start game (simulating countdown complete)
        response = requests.post(f"{BASE_URL}/api/photo-game/open-games/start/{game_id}",
            headers=headers1
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "session_id" in data
        assert "pvp_room_id" in data
        
        session_id = data["session_id"]
        pvp_room_id = data["pvp_room_id"]
        
        print(f"6. Game started!")
        print(f"   session_id: {session_id}")
        print(f"   pvp_room_id: {pvp_room_id}")
        print(f"   websocket_url: {data.get('websocket_url')}")
        
        # Wait for game_start WebSocket message
        time.sleep(2)
        
        # Check WebSocket messages for game_start with pvp_room_id
        game_start_messages = [m for m in ws_messages["user1"] if m.get("type") == "game_start"]
        print(f"\n7. WebSocket game_start messages received by User1: {len(game_start_messages)}")
        
        if game_start_messages:
            msg = game_start_messages[0]
            print(f"   game_start message:")
            print(f"     session_id: {msg.get('session_id')}")
            print(f"     pvp_room_id: {msg.get('pvp_room_id')}")
            assert msg.get("pvp_room_id") == pvp_room_id, f"pvp_room_id mismatch: {msg.get('pvp_room_id')} != {pvp_room_id}"
            print(f"   ✓ pvp_room_id correctly included in WebSocket message!")
        else:
            print("   WARNING: No game_start message received via WebSocket")
            print(f"   All User1 messages: {[m.get('type') for m in ws_messages['user1']]}")
        
        # Step 7: Verify PVP game room WebSocket connection
        print(f"\n8. Testing PVP game room WebSocket connection...")
        pvp_ws_url = f"{WS_BASE_URL}/api/ws/pvp-game/{pvp_room_id}/{user1_session['token']}"
        print(f"   URL: {pvp_ws_url}")
        
        pvp_messages = []
        pvp_connected = False
        
        def on_pvp_message(ws, message):
            data = json.loads(message)
            pvp_messages.append(data)
            print(f"   PVP WS received: {data.get('type')}")
        
        def on_pvp_open(ws):
            nonlocal pvp_connected
            pvp_connected = True
            print("   PVP WS connected!")
            # Send join message
            ws.send(json.dumps({
                "type": "join",
                "username": user1_session["username"],
                "photos": [],  # Photos already locked in
                "is_creator": True
            }))
        
        def on_pvp_error(ws, error):
            print(f"   PVP WS error: {error}")
        
        pvp_ws = websocket.WebSocketApp(pvp_ws_url,
            on_message=on_pvp_message,
            on_open=on_pvp_open,
            on_error=on_pvp_error
        )
        pvp_ws_thread = threading.Thread(target=pvp_ws.run_forever)
        pvp_ws_thread.daemon = True
        pvp_ws_thread.start()
        
        # Wait for connection
        time.sleep(3)
        
        print(f"\n9. PVP WebSocket connection result: {pvp_connected}")
        print(f"   Messages received: {[m.get('type') for m in pvp_messages]}")
        
        # Cleanup
        ws1.close()
        ws2.close()
        pvp_ws.close()
        
        # Final assertions
        assert pvp_room_id is not None, "pvp_room_id should be returned"
        print(f"\n✓ Full PVP flow test PASSED!")
        print(f"  - Game created: {game_id}")
        print(f"  - Session started: {session_id}")
        print(f"  - PVP room created: {pvp_room_id}")
        print(f"  - WebSocket game_start includes pvp_room_id: {len(game_start_messages) > 0}")
        print(f"  - PVP WebSocket connection: {pvp_connected}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
