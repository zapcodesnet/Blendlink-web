import React, { useState, useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import { 
  Bot, Send, Plus, Trash2, MessageSquare, Sparkles,
  Code, HelpCircle, Bug, RefreshCw, Loader2
} from "lucide-react";

const API_BASE = getApiUrl();

// Safe fetch helper to avoid "body stream already read" errors
const safeFetch = async (url, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, { ...options, headers });
  
  // Read body as text first to avoid body stream errors
  const rawText = await response.text();
  
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch (e) {
    console.error('JSON parse error:', e);
  }
  
  if (!response.ok) {
    throw new Error(data.detail || 'Request failed');
  }
  
  return data;
};

export default function AdminAI() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    checkStatus();
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const checkStatus = async () => {
    try {
      const data = await safeFetch(`${API_BASE}/api/ai-assistant/status`);
      setAiStatus(data);
    } catch (error) {
      setAiStatus({ available: false });
    }
  };

  const loadSessions = async () => {
    try {
      const data = await safeFetch(`${API_BASE}/api/ai-assistant/sessions`);
      setSessions(data.sessions || []);
    } catch (error) {
      console.error("Failed to load sessions");
    }
  };

  const loadSession = async (sessionId) => {
    try {
      const data = await safeFetch(`${API_BASE}/api/ai-assistant/sessions/${sessionId}`);
      setCurrentSession(sessionId);
      setMessages(data.messages || []);
    } catch (error) {
      toast.error("Failed to load session");
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput("");
    setLoading(true);

    // Add user message immediately
    setMessages(prev => [...prev, {
      message_id: `temp_${Date.now()}`,
      role: "user",
      content: userMessage,
      created_at: new Date().toISOString()
    }]);

    try {
      const data = await safeFetch(`${API_BASE}/api/ai-assistant/chat`, {
        method: 'POST',
        body: JSON.stringify({
          session_id: currentSession,
          message: userMessage
        })
      });
      
      if (!currentSession) {
        setCurrentSession(data.session_id);
        loadSessions();
      }

      // Add assistant response
      setMessages(prev => [...prev, {
        message_id: `resp_${Date.now()}`,
        role: "assistant",
        content: data.response,
        created_at: new Date().toISOString()
      }]);

    } catch (error) {
      toast.error(error.message);
      // Remove the optimistic user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const startNewChat = () => {
    setCurrentSession(null);
    setMessages([]);
  };

  const deleteSession = async (sessionId) => {
    try {
      await safeFetch(`${API_BASE}/api/ai-assistant/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
      if (currentSession === sessionId) {
        startNewChat();
      }
      toast.success("Session deleted");
    } catch (error) {
      toast.error("Failed to delete session");
    }
  };

  const quickAction = async (action, context) => {
    setLoading(true);
    try {
      const data = await safeFetch(`${API_BASE}/api/ai-assistant/quick-action`, {
        method: 'POST',
        body: JSON.stringify({ action, context })
      });
      
      // Add to current chat
      setMessages(prev => [
        ...prev,
        { role: "user", content: `[Quick Action: ${action}]\n${context}`, created_at: new Date().toISOString() },
        { role: "assistant", content: data.response, created_at: new Date().toISOString() }
      ]);
    } catch (error) {
      toast.error("Quick action failed");
    } finally {
      setLoading(false);
    }
  };

  if (!aiStatus?.available) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Bot className="w-16 h-16 text-slate-600 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">AI Assistant Unavailable</h2>
        <p className="text-slate-400 max-w-md mb-4">
          The AI Assistant requires an active Emergent LLM Key with sufficient balance.
        </p>
        <p className="text-blue-400 text-sm">
          Add balance via Profile → Universal Key → Add Balance
        </p>
        <Button onClick={checkStatus} variant="outline" className="mt-4 border-slate-600">
          <RefreshCw className="w-4 h-4 mr-2" /> Check Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Sidebar - Sessions */}
      <div className="w-64 bg-slate-800 rounded-xl border border-slate-700 flex flex-col">
        <div className="p-3 border-b border-slate-700">
          <Button onClick={startNewChat} className="w-full bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map((session) => (
            <div
              key={session.session_id}
              className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                currentSession === session.session_id 
                  ? 'bg-blue-600/20 text-blue-400' 
                  : 'text-slate-400 hover:bg-slate-700'
              }`}
              onClick={() => loadSession(session.session_id)}
            >
              <MessageSquare className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-sm truncate">{session.title || 'New Chat'}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteSession(session.session_id); }}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-4">No conversations yet</p>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-slate-800 rounded-xl border border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-white">AI Admin Assistant</h2>
              <p className="text-xs text-green-400">● Online • GPT-4o</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 text-xs"
              onClick={() => {
                const code = prompt("Paste code to debug:");
                if (code) quickAction("debug_error", code);
              }}
            >
              <Bug className="w-3 h-3 mr-1" /> Debug
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 text-xs"
              onClick={() => {
                const code = prompt("Paste code to explain:");
                if (code) quickAction("explain_code", code);
              }}
            >
              <Code className="w-3 h-3 mr-1" /> Explain
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">How can I help you today?</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Ask me anything about managing Blendlink - debugging issues, code help, user management, or platform configuration.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {[
                  "How do I ban a user?",
                  "Explain the referral system",
                  "Help me debug an API error",
                  "Show me analytics queries"
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-full text-sm hover:bg-slate-600"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={msg.message_id || i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-200'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans text-sm">{msg.content}</pre>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-slate-700 rounded-2xl px-4 py-3">
                <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={sendMessage} className="p-4 border-t border-slate-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={loading}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 px-4"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
