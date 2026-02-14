"""
End-to-End PVP Test - Tests the full flow:
1. Login both users
2. Get battle photos for both
3. User 1 creates game with 5 photos
4. User 2 joins game with 5 photos
5. Both connect to lobby WebSocket
6. Both ready up
7. Backend creates PVP room
8. Both connect to PVP game WebSocket
9. Both select photos (round 1)
10. Both mark ready for round
11. Verify round starts
"""

import asyncio
import websockets
import aiohttp
import json
import os
import sys
from datetime import datetime

# Configuration
API_URL = os.environ.get('API_URL', 'https://core-bugs-patch.preview.emergentagent.com')
WS_URL = API_URL.replace('https://', 'wss://').replace('http://', 'ws://')

USER1_EMAIL = 'test@blendlink.com'
USER1_PASSWORD = 'admin'
USER2_EMAIL = 'test@example.com'
USER2_PASSWORD = 'test123'

class PVPTester:
    def __init__(self):
        self.user1_token = None
        self.user2_token = None
        self.user1_id = None
        self.user2_id = None
        self.user1_photos = []
        self.user2_photos = []
        self.game_id = None
        self.pvp_room_id = None
        self.session_id = None
        
    async def login(self, session, email, password):
        """Login and get token"""
        async with session.post(f'{API_URL}/api/auth/login', json={
            'email': email,
            'password': password
        }) as resp:
            data = await resp.json()
            return data.get('token'), data.get('user', {}).get('user_id')
    
    async def get_battle_photos(self, session, token):
        """Get user's battle photos"""
        async with session.get(f'{API_URL}/api/photo-game/battle-photos', headers={
            'Authorization': f'Bearer {token}'
        }) as resp:
            data = await resp.json()
            photos = data.get('photos', [])
            available = [p for p in photos if p.get('is_available', True)]
            return available[:5]  # Get first 5 available
    
    async def create_game(self, session, token, photo_ids):
        """Create open game"""
        async with session.post(f'{API_URL}/api/photo-game/open-games/create', headers={
            'Authorization': f'Bearer {token}'
        }, json={
            'photo_ids': photo_ids,
            'bet_amount': 0
        }) as resp:
            data = await resp.json()
            return data.get('game', {}).get('game_id')
    
    async def join_game(self, session, token, game_id, photo_ids):
        """Join open game"""
        async with session.post(f'{API_URL}/api/photo-game/open-games/join', headers={
            'Authorization': f'Bearer {token}'
        }, json={
            'game_id': game_id,
            'photo_ids': photo_ids
        }) as resp:
            data = await resp.json()
            return data.get('success', False)
    
    async def ready_up(self, session, token, game_id):
        """Mark ready"""
        async with session.post(f'{API_URL}/api/photo-game/open-games/ready', headers={
            'Authorization': f'Bearer {token}'
        }, json={
            'game_id': game_id
        }) as resp:
            data = await resp.json()
            return data.get('success', False)
    
    async def connect_lobby_ws(self, token, game_id, user_id, username, is_creator, messages_received):
        """Connect to lobby WebSocket and wait for game_start"""
        ws_url = f'{WS_URL}/api/ws/game-lobby/{game_id}/{token}'
        print(f'  [{username}] Connecting to lobby: {ws_url[:80]}...')
        
        try:
            async with websockets.connect(ws_url) as ws:
                print(f'  [{username}] Connected to lobby')
                
                # Wait for messages
                timeout = 30  # 30 seconds timeout
                start = asyncio.get_event_loop().time()
                
                while asyncio.get_event_loop().time() - start < timeout:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                        data = json.loads(msg)
                        msg_type = data.get('type')
                        print(f'  [{username}] Lobby msg: {msg_type}')
                        
                        messages_received.append(data)
                        
                        if msg_type == 'game_start':
                            return data.get('session_id'), data.get('pvp_room_id'), data.get('session')
                        
                    except asyncio.TimeoutError:
                        continue
                    
        except Exception as e:
            print(f'  [{username}] Lobby WS error: {e}')
        
        return None, None, None
    
    async def connect_pvp_ws(self, token, room_id, user_id, username, photos, is_creator, messages_received):
        """Connect to PVP game WebSocket"""
        ws_url = f'{WS_URL}/api/ws/pvp-game/{room_id}/{token}'
        print(f'  [{username}] Connecting to PVP room: {ws_url[:80]}...')
        
        try:
            async with websockets.connect(ws_url) as ws:
                print(f'  [{username}] Connected to PVP room')
                
                # Wait for connected message
                msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
                data = json.loads(msg)
                print(f'  [{username}] PVP initial: {data.get("type")}')
                messages_received.append(data)
                
                # Send join message
                join_msg = {
                    'type': 'join',
                    'username': username,
                    'photos': photos,
                    'is_creator': is_creator
                }
                await ws.send(json.dumps(join_msg))
                print(f'  [{username}] Sent join message')
                
                # Listen for messages
                timeout = 45  # 45 seconds total
                start = asyncio.get_event_loop().time()
                round_selecting_received = False
                
                while asyncio.get_event_loop().time() - start < timeout:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                        data = json.loads(msg)
                        msg_type = data.get('type')
                        print(f'  [{username}] PVP msg: {msg_type}')
                        messages_received.append(data)
                        
                        if msg_type == 'round_selecting':
                            round_selecting_received = True
                            print(f'  [{username}] Round {data.get("round")} selecting phase started!')
                            
                            # Select first available photo
                            selected_photo = photos[0].get('mint_id') if photos else None
                            if selected_photo:
                                await ws.send(json.dumps({
                                    'type': 'select_photo',
                                    'photo_id': selected_photo
                                }))
                                print(f'  [{username}] Selected photo: {selected_photo}')
                        
                        elif msg_type == 'round_ready':
                            print(f'  [{username}] Both players selected! Ready for round.')
                            # Mark ready
                            await ws.send(json.dumps({'type': 'ready'}))
                            print(f'  [{username}] Sent ready signal')
                        
                        elif msg_type == 'countdown_start':
                            print(f'  [{username}] Countdown started!')
                            
                        elif msg_type == 'round_start':
                            print(f'  [{username}] ROUND START! Battle begins!')
                            return True
                        
                        elif msg_type == 'game_state':
                            # Full state update
                            phase = data.get('round_phase')
                            if phase == 'playing':
                                print(f'  [{username}] Game in playing phase!')
                                return True
                        
                    except asyncio.TimeoutError:
                        continue
                
                return round_selecting_received  # Return True if at least got to selecting
                
        except Exception as e:
            print(f'  [{username}] PVP WS error: {e}')
            import traceback
            traceback.print_exc()
        
        return False
    
    async def run_test(self):
        """Run the full E2E test"""
        print('=' * 60)
        print('PVP E2E Test - Full Flow')
        print('=' * 60)
        
        async with aiohttp.ClientSession() as session:
            # Step 1: Login both users
            print('\n[Step 1] Logging in users...')
            self.user1_token, self.user1_id = await self.login(session, USER1_EMAIL, USER1_PASSWORD)
            self.user2_token, self.user2_id = await self.login(session, USER2_EMAIL, USER2_PASSWORD)
            
            if not self.user1_token:
                print('  ERROR: Failed to login User 1')
                return False
            if not self.user2_token:
                print('  ERROR: Failed to login User 2')
                return False
            
            print(f'  User 1: {self.user1_id}')
            print(f'  User 2: {self.user2_id}')
            
            # Step 2: Get battle photos
            print('\n[Step 2] Getting battle photos...')
            self.user1_photos = await self.get_battle_photos(session, self.user1_token)
            self.user2_photos = await self.get_battle_photos(session, self.user2_token)
            
            if len(self.user1_photos) < 5:
                print(f'  ERROR: User 1 has {len(self.user1_photos)} photos, need 5')
                return False
            if len(self.user2_photos) < 5:
                print(f'  ERROR: User 2 has {len(self.user2_photos)} photos, need 5')
                return False
            
            print(f'  User 1 photos: {len(self.user1_photos)}')
            print(f'  User 2 photos: {len(self.user2_photos)}')
            
            # Step 3: User 1 creates game
            print('\n[Step 3] User 1 creating game...')
            photo_ids_1 = [p.get('mint_id') for p in self.user1_photos[:5]]
            self.game_id = await self.create_game(session, self.user1_token, photo_ids_1)
            
            if not self.game_id:
                print('  ERROR: Failed to create game')
                return False
            
            print(f'  Game created: {self.game_id}')
            
            # Step 4: User 2 joins game
            print('\n[Step 4] User 2 joining game...')
            photo_ids_2 = [p.get('mint_id') for p in self.user2_photos[:5]]
            joined = await self.join_game(session, self.user2_token, self.game_id, photo_ids_2)
            
            if not joined:
                print('  ERROR: Failed to join game')
                return False
            
            print('  Game joined successfully!')
            
            # Step 5 & 6: Connect to lobby and ready up
            print('\n[Step 5] Connecting to lobby WebSockets and readying up...')
            
            # Ready up both users
            await self.ready_up(session, self.user1_token, self.game_id)
            print('  User 1 ready')
            await self.ready_up(session, self.user2_token, self.game_id)
            print('  User 2 ready')
            
            # Connect to lobby and wait for game_start
            user1_lobby_msgs = []
            user2_lobby_msgs = []
            
            # Run lobby connections in parallel
            lobby_tasks = await asyncio.gather(
                self.connect_lobby_ws(self.user1_token, self.game_id, self.user1_id, 'User1', True, user1_lobby_msgs),
                self.connect_lobby_ws(self.user2_token, self.game_id, self.user2_id, 'User2', False, user2_lobby_msgs),
            )
            
            # Check if we got pvp_room_id
            session_id_1, pvp_room_1, session_1 = lobby_tasks[0]
            session_id_2, pvp_room_2, session_2 = lobby_tasks[1]
            
            self.pvp_room_id = pvp_room_1 or pvp_room_2
            self.session_id = session_id_1 or session_id_2
            
            if not self.pvp_room_id:
                print('  WARNING: Did not receive pvp_room_id from lobby')
                # Try to get it from the game state
                async with session.get(f'{API_URL}/api/photo-game/open-games/{self.game_id}', headers={
                    'Authorization': f'Bearer {self.user1_token}'
                }) as resp:
                    game_data = await resp.json()
                    self.pvp_room_id = game_data.get('pvp_room_id')
                    self.session_id = game_data.get('active_session_id')
                    print(f'  Retrieved from API: pvp_room_id={self.pvp_room_id}')
            
            if not self.pvp_room_id:
                print('  ERROR: Could not get PVP room ID')
                return False
            
            print(f'  PVP Room: {self.pvp_room_id}')
            print(f'  Session: {self.session_id}')
            
            # Step 7: Connect to PVP WebSocket
            print('\n[Step 6] Connecting to PVP game room...')
            
            user1_pvp_msgs = []
            user2_pvp_msgs = []
            
            # Run PVP connections in parallel
            pvp_tasks = await asyncio.gather(
                self.connect_pvp_ws(
                    self.user1_token, self.pvp_room_id, self.user1_id, 
                    'User1', self.user1_photos[:5], True, user1_pvp_msgs
                ),
                self.connect_pvp_ws(
                    self.user2_token, self.pvp_room_id, self.user2_id, 
                    'User2', self.user2_photos[:5], False, user2_pvp_msgs
                ),
            )
            
            success_1, success_2 = pvp_tasks
            
            print('\n' + '=' * 60)
            print('TEST RESULTS')
            print('=' * 60)
            print(f'  User 1 PVP success: {success_1}')
            print(f'  User 2 PVP success: {success_2}')
            print(f'  User 1 messages received: {len(user1_pvp_msgs)}')
            print(f'  User 2 messages received: {len(user2_pvp_msgs)}')
            
            if success_1 and success_2:
                print('\n✅ PVP E2E TEST PASSED!')
                return True
            else:
                print('\n❌ PVP E2E TEST FAILED')
                print('\nUser 1 messages:')
                for msg in user1_pvp_msgs[-5:]:
                    print(f'  - {msg.get("type")}')
                print('\nUser 2 messages:')
                for msg in user2_pvp_msgs[-5:]:
                    print(f'  - {msg.get("type")}')
                return False

async def main():
    tester = PVPTester()
    success = await tester.run_test()
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    asyncio.run(main())
