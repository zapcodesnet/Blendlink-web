import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext, API } from "../App";
import axios from "axios";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ArrowLeft, Send, Image, Paperclip, MoreVertical } from "lucide-react";

export default function Chat() {
  const { user } = useContext(AuthContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    fetchOtherUser();
    fetchMessages();
    const interval = setInterval(() => {
      fetchMessages();
      checkTypingStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchOtherUser = async () => {
    try {
      const response = await axios.get(`${API}/users/${id}`);
      setOtherUser(response.data);
    } catch (error) {
      console.error("User error:", error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API}/messages/${id}`, { withCredentials: true });
      setMessages(response.data);
    } catch (error) {
      console.error("Messages error:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkTypingStatus = async () => {
    try {
      const response = await axios.get(`${API}/messages/${id}/typing`, { withCredentials: true });
      setIsTyping(response.data.typing);
    } catch (error) {
      // Ignore
    }
  };

  const sendTypingIndicator = async () => {
    try {
      await axios.post(`${API}/messages/${id}/typing`, {}, { withCredentials: true });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(async () => {
        await axios.delete(`${API}/messages/${id}/typing`, { withCredentials: true });
      }, 3000);
    } catch (error) {
      // Ignore
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      await axios.post(`${API}/messages/${id}`, { content: input }, { withCredentials: true });
      setInput("");
      fetchMessages();
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      await axios.delete(`${API}/messages/${id}/typing`, { withCredentials: true });
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/messages")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <button 
            className="flex items-center gap-3 flex-1"
            onClick={() => navigate(`/profile/${id}`)}
          >
            <Avatar className="w-10 h-10">
              <AvatarImage src={otherUser?.avatar} />
              <AvatarFallback>{otherUser?.name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="text-left">
              <p className="font-semibold">{otherUser?.name}</p>
              {isTyping && (
                <p className="text-xs text-primary">typing...</p>
              )}
            </div>
          </button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No messages yet</p>
            <p className="text-sm">Say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSent = msg.sender_id === user?.user_id;
            return (
              <div
                key={msg.message_id}
                className={`flex ${isSent ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2 ${
                    isSent ? "message-sent" : "message-received"
                  }`}
                >
                  {msg.media_url && (
                    <img 
                      src={msg.media_url} 
                      alt="" 
                      className="rounded-lg mb-2 max-w-full"
                    />
                  )}
                  <p className="break-words">{msg.content}</p>
                  <p className={`text-xs mt-1 ${isSent ? "text-white/70" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="message-received px-4 py-2 flex items-center gap-1">
              <div className="typing-dot w-2 h-2 bg-muted-foreground rounded-full"></div>
              <div className="typing-dot w-2 h-2 bg-muted-foreground rounded-full"></div>
              <div className="typing-dot w-2 h-2 bg-muted-foreground rounded-full"></div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input */}
      <div className="glass border-t border-border/50 p-4 safe-bottom">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Image className="w-5 h-5" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              sendTypingIndicator();
            }}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            className="rounded-full"
            data-testid="message-input"
          />
          <Button 
            size="icon" 
            className="rounded-full"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            data-testid="send-btn"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
