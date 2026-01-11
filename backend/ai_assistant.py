"""
Blendlink AI Admin Assistant
- Natural language help for admins
- Code suggestions and debugging assistance
- Platform management queries
- Uses Emergent LLM Key with GPT-4o
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

from server import get_current_user, db, logger
from admin_system import require_admin, log_audit, AuditAction, AdminRole

# Import emergent integrations
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False
    logger.warning("emergentintegrations not installed - AI Assistant disabled")

ai_assistant_router = APIRouter(prefix="/ai-assistant", tags=["AI Assistant"])

# Get API Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# System prompt for the admin AI assistant
ADMIN_SYSTEM_PROMPT = """You are Blendlink Admin AI Assistant - an expert helper for platform administrators.

Your capabilities:
1. **Platform Knowledge**: You understand the Blendlink platform - a social media app with marketplace, casino, referral system, and more.
2. **Code Assistance**: You can suggest code fixes, explain errors, and help debug issues.
3. **User Management**: You can explain how to manage users, handle reports, and moderate content.
4. **Analytics**: You can help interpret platform metrics and suggest improvements.
5. **Configuration**: You can guide admins through settings and configurations.

Platform Architecture:
- Backend: FastAPI + MongoDB
- Frontend: React PWA with Tailwind CSS
- Mobile: React Native + Expo
- Features: Social feed, marketplace, casino games, referral system, BL Coins virtual currency

When helping with code:
- Always provide complete, working code examples
- Explain the changes and why they work
- Consider security and performance implications

Be concise, helpful, and proactive. If you need more information to help, ask specific questions."""

# ============== MODELS ==============

class ChatMessage(BaseModel):
    """Chat message model"""
    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    role: str  # user, assistant
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatSession(BaseModel):
    """Chat session model"""
    session_id: str = Field(default_factory=lambda: f"chat_{uuid.uuid4().hex[:12]}")
    admin_id: str
    title: str = "New Conversation"
    messages: List[Dict[str, Any]] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SendMessageRequest(BaseModel):
    session_id: Optional[str] = None
    message: str

class AIAssistantResponse(BaseModel):
    session_id: str
    response: str
    title: Optional[str] = None

# ============== ENDPOINTS ==============

@ai_assistant_router.get("/status")
async def get_ai_status():
    """Check if AI Assistant is available"""
    return {
        "available": LLM_AVAILABLE and bool(EMERGENT_LLM_KEY),
        "model": "gpt-4o",
        "provider": "openai",
        "message": "AI Assistant is ready" if (LLM_AVAILABLE and EMERGENT_LLM_KEY) else "AI Assistant requires Emergent LLM Key top-up"
    }

@ai_assistant_router.get("/sessions")
async def get_chat_sessions(
    current_user: dict = Depends(require_admin)
):
    """Get all chat sessions for current admin"""
    admin_id = current_user.get("admin", {}).get("admin_id", current_user["user_id"])
    
    sessions = await db.ai_chat_sessions.find(
        {"admin_id": admin_id},
        {"_id": 0, "messages": 0}
    ).sort("updated_at", -1).to_list(50)
    
    return {"sessions": sessions}

@ai_assistant_router.get("/sessions/{session_id}")
async def get_chat_session(
    session_id: str,
    current_user: dict = Depends(require_admin)
):
    """Get a specific chat session with messages"""
    admin_id = current_user.get("admin", {}).get("admin_id", current_user["user_id"])
    
    session = await db.ai_chat_sessions.find_one(
        {"session_id": session_id, "admin_id": admin_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session

@ai_assistant_router.post("/chat")
async def send_message(
    data: SendMessageRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Send a message to the AI Assistant"""
    # Check permissions
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("use_ai_assistant", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="AI Assistant access not permitted")
    
    if not LLM_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI Assistant not available - emergentintegrations not installed")
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI Assistant requires Emergent LLM Key. Please add balance via Profile → Universal Key → Add Balance")
    
    admin_id = current_user.get("admin", {}).get("admin_id", current_user["user_id"])
    
    # Get or create session
    session_id = data.session_id
    if session_id:
        session = await db.ai_chat_sessions.find_one(
            {"session_id": session_id, "admin_id": admin_id},
            {"_id": 0}
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        messages = session.get("messages", [])
    else:
        session_id = f"chat_{uuid.uuid4().hex[:12]}"
        messages = []
    
    # Add user message
    user_msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "role": "user",
        "content": data.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    messages.append(user_msg)
    
    try:
        # Initialize LLM chat
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=ADMIN_SYSTEM_PROMPT
        ).with_model("openai", "gpt-4o")
        
        # Build conversation history for context
        for msg in messages[:-1]:  # All except the current message
            if msg["role"] == "user":
                await chat.send_message(UserMessage(text=msg["content"]))
        
        # Send current message and get response
        response = await chat.send_message(UserMessage(text=data.message))
        
        # Add assistant response
        assistant_msg = {
            "message_id": f"msg_{uuid.uuid4().hex[:12]}",
            "role": "assistant",
            "content": response,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        messages.append(assistant_msg)
        
        # Generate title from first message if new session
        title = "New Conversation"
        if len(messages) == 2:
            title = data.message[:50] + ("..." if len(data.message) > 50 else "")
        
        # Save session
        await db.ai_chat_sessions.update_one(
            {"session_id": session_id},
            {"$set": {
                "session_id": session_id,
                "admin_id": admin_id,
                "title": title if len(messages) == 2 else None,
                "messages": messages,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            "$setOnInsert": {
                "created_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True
        )
        
        # Log audit
        await log_audit(
            admin_id=admin_id,
            admin_email=current_user["email"],
            action=AuditAction.AI_ASSIST_REQUEST,
            target_type="ai_chat",
            target_id=session_id,
            details={"message_length": len(data.message)},
            request=request
        )
        
        return AIAssistantResponse(
            session_id=session_id,
            response=response,
            title=title if len(messages) == 2 else None
        )
        
    except Exception as e:
        logger.error(f"AI Assistant error: {str(e)}")
        
        # Check for budget issues
        error_msg = str(e).lower()
        if "budget" in error_msg or "balance" in error_msg or "insufficient" in error_msg:
            raise HTTPException(
                status_code=402,
                detail="Emergent LLM Key budget exhausted. Please add balance via Profile → Universal Key → Add Balance"
            )
        
        raise HTTPException(status_code=500, detail=f"AI Assistant error: {str(e)}")

@ai_assistant_router.delete("/sessions/{session_id}")
async def delete_chat_session(
    session_id: str,
    current_user: dict = Depends(require_admin)
):
    """Delete a chat session"""
    admin_id = current_user.get("admin", {}).get("admin_id", current_user["user_id"])
    
    result = await db.ai_chat_sessions.delete_one(
        {"session_id": session_id, "admin_id": admin_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"message": "Session deleted"}

# ============== QUICK ACTIONS ==============

class QuickActionRequest(BaseModel):
    action: str  # debug_error, explain_code, suggest_fix, platform_help
    context: str

@ai_assistant_router.post("/quick-action")
async def quick_action(
    data: QuickActionRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Quick AI actions without persistent session"""
    if not LLM_AVAILABLE or not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=503, detail="AI Assistant not available")
    
    prompts = {
        "debug_error": f"Debug this error and suggest a fix:\n\n{data.context}",
        "explain_code": f"Explain what this code does:\n\n{data.context}",
        "suggest_fix": f"Suggest improvements or fixes for this code:\n\n{data.context}",
        "platform_help": f"Help with this platform question:\n\n{data.context}",
    }
    
    prompt = prompts.get(data.action, data.context)
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"quick_{uuid.uuid4().hex[:8]}",
            system_message=ADMIN_SYSTEM_PROMPT
        ).with_model("openai", "gpt-4o")
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        return {"response": response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")
