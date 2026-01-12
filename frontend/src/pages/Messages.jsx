import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { ArrowLeft, MessageCircle, Search, Plus, Users, X } from "lucide-react";
import { Input } from "../components/ui/input";
import { toast } from "sonner";

const API_BASE = process.env.REACT_APP_BACKEND_URL;
const getToken = () => localStorage.getItem("blendlink_token");

export default function Messages() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // all, dms, groups

  useEffect(() => {
    fetchConversations();
    fetchGroups();
    const interval = setInterval(() => {
      fetchConversations();
      fetchGroups();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchConversations = async () => {
    try {
      const data = await api.messages.getConversations();
      setConversations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Conversations error:", error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/messaging/groups`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Groups error:", error);
    }
  };

  const filteredConversations = conversations.filter(c => 
    c.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.user?.username?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGroups = groups.filter(g =>
    g.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Combine and sort by last activity
  const allConversations = [
    ...filteredConversations.map(c => ({ ...c, type: "dm" })),
    ...filteredGroups.map(g => ({ 
      ...g, 
      type: "group",
      user_id: g.group_id,
      last_message: { created_at: g.last_message_at }
    }))
  ].sort((a, b) => {
    const dateA = new Date(a.last_message?.created_at || 0);
    const dateB = new Date(b.last_message?.created_at || 0);
    return dateB - dateA;
  });

  const displayItems = activeTab === "all" 
    ? allConversations 
    : activeTab === "dms" 
      ? filteredConversations.map(c => ({ ...c, type: "dm" }))
      : filteredGroups.map(g => ({ ...g, type: "group", user_id: g.group_id }));

  return (
    <div className="min-h-screen bg-background" data-testid="messages-page">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold">Messages</h1>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowNewGroup(true)} data-testid="new-group-btn">
              <Plus className="w-4 h-4 mr-1" /> Group
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              className="pl-10 h-10 rounded-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {/* Tabs */}
          <div className="flex gap-2 mt-3">
            {[
              { id: "all", label: "All" },
              { id: "dms", label: "Direct" },
              { id: "groups", label: "Groups" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {loading ? (
          <div className="divide-y divide-border/50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 flex items-center gap-3">
                <div className="w-12 h-12 rounded-full skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 skeleton rounded" />
                  <div className="h-3 w-2/3 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold text-lg mb-2">No conversations yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Start chatting with friends or create a group
            </p>
            <Button onClick={() => setShowNewGroup(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Group Chat
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {displayItems.map((conv) => (
              <button
                key={conv.user_id || conv.group_id}
                onClick={() => navigate(conv.type === "group" ? `/messages/group/${conv.group_id}` : `/messages/${conv.user_id}`)}
                className="w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                data-testid={`conversation-${conv.user_id || conv.group_id}`}
              >
                <div className="relative">
                  {conv.type === "group" ? (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                  ) : (
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={conv.user?.avatar} />
                      <AvatarFallback>{conv.user?.name?.[0]}</AvatarFallback>
                    </Avatar>
                  )}
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold truncate">
                      {conv.type === "group" ? conv.name : conv.user?.name}
                    </p>
                    {conv.last_message?.created_at && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(conv.last_message?.created_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {conv.type === "group" 
                      ? `${conv.member_ids?.length || 0} members`
                      : (conv.last_message?.sender_id === user?.user_id ? "You: " : "") + (conv.last_message?.content || "No messages")
                    }
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Sync Notice */}
        <p className="text-center text-xs text-muted-foreground mt-8 pb-4">
          🔄 Synced with Blendlink mobile app
        </p>
      </main>

      {/* New Group Modal */}
      {showNewGroup && (
        <NewGroupModal 
          onClose={() => setShowNewGroup(false)} 
          onCreated={(group) => {
            fetchGroups();
            setShowNewGroup(false);
            navigate(`/messages/group/${group.group_id}`);
          }}
        />
      )}
    </div>
  );
}

// New Group Modal Component
function NewGroupModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE}/api/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch (e) {
      console.error("Search failed:", e);
    }
  };

  const createGroup = async () => {
    if (!name.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/messaging/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          name,
          member_ids: selectedMembers.map(m => m.user_id)
        })
      });
      
      if (res.ok) {
        const group = await res.json();
        toast.success("Group created!");
        onCreated(group);
      } else {
        const data = await res.json();
        throw new Error(data.detail || "Failed to create group");
      }
    } catch (e) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="new-group-modal">
      <div className="bg-card rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Create Group Chat</h2>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          className="mb-4"
          data-testid="group-name-input"
        />

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              searchUsers(e.target.value);
            }}
            placeholder="Search users to add..."
            className="pl-10"
          />
        </div>

        {/* Selected Members */}
        {selectedMembers.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedMembers.map(member => (
              <span 
                key={member.user_id}
                className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-sm flex items-center gap-1"
              >
                {member.name || member.username}
                <button onClick={() => setSelectedMembers(prev => prev.filter(m => m.user_id !== member.user_id))}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="max-h-40 overflow-y-auto mb-4 border border-border rounded-lg">
            {searchResults.map(usr => (
              <button
                key={usr.user_id}
                onClick={() => {
                  if (!selectedMembers.find(m => m.user_id === usr.user_id)) {
                    setSelectedMembers(prev => [...prev, usr]);
                  }
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="w-full p-3 flex items-center gap-3 hover:bg-muted text-left"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm">
                  {(usr.name || usr.username || "?").charAt(0).toUpperCase()}
                </div>
                <span>{usr.name || usr.username}</span>
              </button>
            ))}
          </div>
        )}

        <Button onClick={createGroup} disabled={loading || !name.trim()} className="w-full" data-testid="create-group-btn">
          {loading ? "Creating..." : "Create Group"}
        </Button>
      </div>
    </div>
  );
}
