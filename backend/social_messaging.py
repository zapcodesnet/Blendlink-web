"""
Social Messaging System for Blendlink
- Direct messages between users
- Group chat functionality
- Real-time WebSocket support
"""

from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import json

# Import from main server
from server import get_current_user, db, logger

# Create router
messaging_router = APIRouter(prefix="/messaging", tags=["Social Messaging"])

# ============== MODELS ==============

class CreateGroupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = ""
    member_ids: List[str] = []
    avatar_url: Optional[str] = None

class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None

class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    reply_to: Optional[str] = None

class AddMembersRequest(BaseModel):
    member_ids: List[str]

# ============== WEBSOCKET CONNECTIONS ==============

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
    
    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(message)
                except:
                    pass
    
    async def send_to_users(self, user_ids: List[str], message: dict):
        for user_id in user_ids:
            await self.send_to_user(user_id, message)

manager = ConnectionManager()

# ============== GROUP CHAT ENDPOINTS ==============

@messaging_router.post("/groups")
async def create_group(
    request: CreateGroupRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new group chat"""
    group_id = f"grp_{uuid.uuid4().hex[:12]}"
    
    # Add creator to members
    member_ids = list(set([current_user["user_id"]] + request.member_ids))
    
    # Validate all members exist
    members = await db.users.find(
        {"user_id": {"$in": member_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "username": 1, "avatar": 1}
    ).to_list(len(member_ids))
    
    if len(members) != len(member_ids):
        raise HTTPException(status_code=400, detail="Some members not found")
    
    group = {
        "group_id": group_id,
        "name": request.name,
        "description": request.description,
        "avatar_url": request.avatar_url,
        "creator_id": current_user["user_id"],
        "admin_ids": [current_user["user_id"]],
        "member_ids": member_ids,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "last_message_at": None,
        "message_count": 0,
    }
    
    await db.chat_groups.insert_one(group)
    
    # Notify members
    for member_id in member_ids:
        if member_id != current_user["user_id"]:
            await manager.send_to_user(member_id, {
                "type": "group_created",
                "group": {k: v for k, v in group.items() if k != "_id"}
            })
    
    group.pop("_id", None)
    return group

@messaging_router.get("/groups")
async def get_my_groups(current_user: dict = Depends(get_current_user)):
    """Get all groups user is a member of"""
    groups = await db.chat_groups.find(
        {"member_ids": current_user["user_id"]},
        {"_id": 0}
    ).sort("last_message_at", -1).to_list(100)
    
    # Add unread count for each group
    for group in groups:
        # Count unread messages
        unread = await db.group_messages.count_documents({
            "group_id": group["group_id"],
            "sender_id": {"$ne": current_user["user_id"]},
            "read_by": {"$ne": current_user["user_id"]}
        })
        group["unread_count"] = unread
    
    return {"groups": groups}

@messaging_router.get("/groups/{group_id}")
async def get_group(
    group_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get group details"""
    group = await db.chat_groups.find_one(
        {"group_id": group_id, "member_ids": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Fetch member details
    members = await db.users.find(
        {"user_id": {"$in": group["member_ids"]}},
        {"_id": 0, "user_id": 1, "name": 1, "username": 1, "avatar": 1}
    ).to_list(len(group["member_ids"]))
    
    group["members"] = members
    return group

@messaging_router.put("/groups/{group_id}")
async def update_group(
    group_id: str,
    request: UpdateGroupRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update group settings (admin only)"""
    group = await db.chat_groups.find_one({
        "group_id": group_id,
        "admin_ids": current_user["user_id"]
    })
    
    if not group:
        raise HTTPException(status_code=403, detail="Not authorized or group not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if request.name:
        update_data["name"] = request.name
    if request.description is not None:
        update_data["description"] = request.description
    if request.avatar_url:
        update_data["avatar_url"] = request.avatar_url
    
    await db.chat_groups.update_one(
        {"group_id": group_id},
        {"$set": update_data}
    )
    
    return {"success": True}

@messaging_router.post("/groups/{group_id}/members")
async def add_group_members(
    group_id: str,
    request: AddMembersRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add members to group (admin only)"""
    group = await db.chat_groups.find_one({
        "group_id": group_id,
        "admin_ids": current_user["user_id"]
    })
    
    if not group:
        raise HTTPException(status_code=403, detail="Not authorized or group not found")
    
    # Validate new members exist
    new_members = await db.users.find(
        {"user_id": {"$in": request.member_ids}},
        {"_id": 0, "user_id": 1}
    ).to_list(len(request.member_ids))
    
    new_member_ids = [m["user_id"] for m in new_members]
    
    await db.chat_groups.update_one(
        {"group_id": group_id},
        {
            "$addToSet": {"member_ids": {"$each": new_member_ids}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Notify new members
    for member_id in new_member_ids:
        await manager.send_to_user(member_id, {
            "type": "added_to_group",
            "group_id": group_id
        })
    
    return {"success": True, "added": new_member_ids}

@messaging_router.delete("/groups/{group_id}/members/{member_id}")
async def remove_group_member(
    group_id: str,
    member_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove member from group (admin only, or self-leave)"""
    group = await db.chat_groups.find_one({"group_id": group_id})
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    is_admin = current_user["user_id"] in group.get("admin_ids", [])
    is_self = member_id == current_user["user_id"]
    
    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Can't remove creator
    if member_id == group["creator_id"] and not is_self:
        raise HTTPException(status_code=400, detail="Cannot remove group creator")
    
    await db.chat_groups.update_one(
        {"group_id": group_id},
        {
            "$pull": {"member_ids": member_id, "admin_ids": member_id},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Notify removed member
    await manager.send_to_user(member_id, {
        "type": "removed_from_group",
        "group_id": group_id
    })
    
    return {"success": True}

@messaging_router.delete("/groups/{group_id}")
async def delete_group(
    group_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete group (creator only)"""
    group = await db.chat_groups.find_one({
        "group_id": group_id,
        "creator_id": current_user["user_id"]
    })
    
    if not group:
        raise HTTPException(status_code=403, detail="Not authorized or group not found")
    
    # Notify all members
    for member_id in group["member_ids"]:
        await manager.send_to_user(member_id, {
            "type": "group_deleted",
            "group_id": group_id
        })
    
    # Delete group and messages
    await db.chat_groups.delete_one({"group_id": group_id})
    await db.group_messages.delete_many({"group_id": group_id})
    
    return {"success": True}

# ============== GROUP MESSAGES ==============

@messaging_router.get("/groups/{group_id}/messages")
async def get_group_messages(
    group_id: str,
    limit: int = Query(default=50, le=100),
    before: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get group messages"""
    group = await db.chat_groups.find_one({
        "group_id": group_id,
        "member_ids": current_user["user_id"]
    })
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    query = {"group_id": group_id}
    if before:
        query["created_at"] = {"$lt": before}
    
    messages = await db.group_messages.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Mark as read
    await db.group_messages.update_many(
        {
            "group_id": group_id,
            "sender_id": {"$ne": current_user["user_id"]},
            "read_by": {"$ne": current_user["user_id"]}
        },
        {"$addToSet": {"read_by": current_user["user_id"]}}
    )
    
    # Fetch sender details
    sender_ids = list(set(m["sender_id"] for m in messages))
    senders = await db.users.find(
        {"user_id": {"$in": sender_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "username": 1, "avatar": 1}
    ).to_list(len(sender_ids))
    senders_map = {s["user_id"]: s for s in senders}
    
    for msg in messages:
        msg["sender"] = senders_map.get(msg["sender_id"])
    
    return {"messages": list(reversed(messages))}

@messaging_router.post("/groups/{group_id}/messages")
async def send_group_message(
    group_id: str,
    request: SendMessageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Send message to group"""
    group = await db.chat_groups.find_one({
        "group_id": group_id,
        "member_ids": current_user["user_id"]
    })
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found or not a member")
    
    message_id = f"msg_{uuid.uuid4().hex[:12]}"
    
    message = {
        "message_id": message_id,
        "group_id": group_id,
        "sender_id": current_user["user_id"],
        "content": request.content,
        "media_url": request.media_url,
        "media_type": request.media_type,
        "reply_to": request.reply_to,
        "read_by": [current_user["user_id"]],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.group_messages.insert_one(message)
    
    # Update group last message
    await db.chat_groups.update_one(
        {"group_id": group_id},
        {
            "$set": {"last_message_at": message["created_at"]},
            "$inc": {"message_count": 1}
        }
    )
    
    # Get sender info for broadcast
    sender_info = {
        "user_id": current_user["user_id"],
        "name": current_user.get("name"),
        "username": current_user.get("username"),
        "avatar": current_user.get("avatar"),
    }
    message["sender"] = sender_info
    message.pop("_id", None)
    
    # Notify all group members
    for member_id in group["member_ids"]:
        await manager.send_to_user(member_id, {
            "type": "group_message",
            "group_id": group_id,
            "message": message
        })
    
    return message

# ============== DIRECT MESSAGES (enhanced) ==============

@messaging_router.get("/conversations")
async def get_all_conversations(current_user: dict = Depends(get_current_user)):
    """Get all conversations (both DMs and groups) sorted by recent activity"""
    # Get DM conversations
    dm_pipeline = [
        {"$match": {"$or": [
            {"sender_id": current_user["user_id"]},
            {"receiver_id": current_user["user_id"]}
        ]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {"$cond": [
                {"$eq": ["$sender_id", current_user["user_id"]]},
                "$receiver_id",
                "$sender_id"
            ]},
            "last_message": {"$first": "$$ROOT"},
            "unread_count": {"$sum": {"$cond": [
                {"$and": [
                    {"$eq": ["$receiver_id", current_user["user_id"]]},
                    {"$eq": ["$read", False]}
                ]},
                1, 0
            ]}}
        }}
    ]
    
    dm_conversations = await db.messages.aggregate(dm_pipeline).to_list(100)
    
    # Get user details for DMs
    dm_user_ids = [conv["_id"] for conv in dm_conversations]
    dm_users = await db.users.find(
        {"user_id": {"$in": dm_user_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "username": 1, "avatar": 1}
    ).to_list(len(dm_user_ids))
    dm_users_map = {u["user_id"]: u for u in dm_users}
    
    conversations = []
    
    for conv in dm_conversations:
        user = dm_users_map.get(conv["_id"], {})
        last_msg = conv["last_message"]
        last_msg.pop("_id", None)
        
        conversations.append({
            "type": "dm",
            "id": conv["_id"],
            "user": user,
            "last_message": last_msg,
            "unread_count": conv["unread_count"],
            "last_activity": last_msg.get("created_at"),
        })
    
    # Get groups
    groups = await db.chat_groups.find(
        {"member_ids": current_user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    for group in groups:
        unread = await db.group_messages.count_documents({
            "group_id": group["group_id"],
            "sender_id": {"$ne": current_user["user_id"]},
            "read_by": {"$ne": current_user["user_id"]}
        })
        
        conversations.append({
            "type": "group",
            "id": group["group_id"],
            "group": group,
            "unread_count": unread,
            "last_activity": group.get("last_message_at"),
        })
    
    # Sort by last activity
    conversations.sort(
        key=lambda x: x.get("last_activity") or "",
        reverse=True
    )
    
    return {"conversations": conversations}

# ============== WEBSOCKET ==============

@messaging_router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...)
):
    """WebSocket for real-time messaging"""
    try:
        from server import decode_token
        payload = decode_token(token)
        user_id = payload.get("user_id") or payload.get("sub")
    except Exception as e:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif data.get("type") == "typing":
                # Broadcast typing indicator
                target_id = data.get("target_id")
                is_group = data.get("is_group", False)
                
                if is_group:
                    group = await db.chat_groups.find_one({"group_id": target_id})
                    if group:
                        for member_id in group["member_ids"]:
                            if member_id != user_id:
                                await manager.send_to_user(member_id, {
                                    "type": "typing",
                                    "user_id": user_id,
                                    "group_id": target_id,
                                    "is_typing": data.get("is_typing", True)
                                })
                else:
                    await manager.send_to_user(target_id, {
                        "type": "typing",
                        "user_id": user_id,
                        "is_typing": data.get("is_typing", True)
                    })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, user_id)
