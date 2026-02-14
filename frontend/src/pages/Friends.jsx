import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getApiUrl } from "../utils/runtimeConfig";
import {
  Users,
  UserPlus,
  UserMinus,
  UserCheck,
  Search,
  ChevronLeft,
  Clock,
  X,
  Check,
  MessageCircle,
  MoreHorizontal,
} from "lucide-react";

const API_URL = getApiUrl();

// API functions for friends
const friendsAPI = {
  getFriends: async () => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/friends/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to load friends");
    return res.json();
  },
  
  getRequests: async () => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/friends/requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to load requests");
    return res.json();
  },
  
  sendRequest: async (userId) => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/friends/request/${userId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.detail || "Failed to send request");
    }
    return res.json();
  },
  
  acceptRequest: async (requestId) => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/friends/accept/${requestId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to accept request");
    return res.json();
  },
  
  declineRequest: async (requestId) => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/friends/decline/${requestId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to decline request");
    return res.json();
  },
  
  removeFriend: async (userId) => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/friends/remove/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to remove friend");
    return res.json();
  },
  
  searchUsers: async (query) => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to search users");
    return res.json();
  },
};

// Friend Card Component
const FriendCard = ({ friend, onRemove, onMessage }) => (
  <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/50 hover:border-primary/30 transition-all">
    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white text-xl font-bold overflow-hidden">
      {friend.avatar ? (
        <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
      ) : (
        friend.name?.charAt(0).toUpperCase() || "?"
      )}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-semibold truncate">{friend.name}</h3>
      <p className="text-sm text-muted-foreground truncate">@{friend.username || friend.user_id?.slice(0, 8)}</p>
    </div>
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => onMessage(friend)} data-testid={`message-${friend.user_id}`}>
        <MessageCircle className="w-4 h-4" />
      </Button>
      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => onRemove(friend)}>
        <UserMinus className="w-4 h-4" />
      </Button>
    </div>
  </div>
);

// Friend Request Card
const RequestCard = ({ request, type, onAccept, onDecline, onCancel }) => {
  const user = type === "incoming" ? request.from_user : request.to_user;
  
  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/50">
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold overflow-hidden">
        {user?.avatar ? (
          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
        ) : (
          user?.name?.charAt(0).toUpperCase() || "?"
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold truncate">{user?.name || "Unknown"}</h3>
        <p className="text-xs text-muted-foreground">
          {type === "incoming" ? "Wants to be your friend" : "Request pending"}
        </p>
      </div>
      {type === "incoming" ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onAccept(request.request_id)} className="bg-green-600 hover:bg-green-700">
            <Check className="w-4 h-4 mr-1" /> Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDecline(request.request_id)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => onCancel(request.request_id)}>
          Cancel
        </Button>
      )}
    </div>
  );
};

// Search Result Card
const SearchResultCard = ({ user, onSendRequest, isPending, isFriend }) => (
  <div className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border/50">
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold overflow-hidden">
      {user.avatar ? (
        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
      ) : (
        user.name?.charAt(0).toUpperCase() || "?"
      )}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="font-semibold truncate">{user.name}</h3>
      <p className="text-sm text-muted-foreground truncate">@{user.username || user.user_id?.slice(0, 8)}</p>
    </div>
    {isFriend ? (
      <span className="px-3 py-1 bg-green-500/20 text-green-600 text-xs rounded-full flex items-center gap-1">
        <UserCheck className="w-3 h-3" /> Friends
      </span>
    ) : isPending ? (
      <span className="px-3 py-1 bg-amber-500/20 text-amber-600 text-xs rounded-full flex items-center gap-1">
        <Clock className="w-3 h-3" /> Pending
      </span>
    ) : (
      <Button size="sm" onClick={() => onSendRequest(user.user_id)}>
        <UserPlus className="w-4 h-4 mr-1" /> Add Friend
      </Button>
    )}
  </div>
);

export default function Friends() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("friends");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [friendsData, requestsData] = await Promise.all([
        friendsAPI.getFriends(),
        friendsAPI.getRequests(),
      ]);
      setFriends(friendsData);
      setRequests(requestsData);
    } catch (error) {
      toast.error("Failed to load friends data");
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await friendsAPI.searchUsers(searchQuery);
      setSearchResults(results.filter(u => u.user_id !== user?.user_id));
    } catch (error) {
      toast.error("Search failed");
    }
    setSearching(false);
  };

  const handleSendRequest = async (userId) => {
    try {
      await friendsAPI.sendRequest(userId);
      toast.success("Friend request sent!");
      loadData();
      // Update search results to show pending
      setSearchResults(prev => 
        prev.map(u => u.user_id === userId ? { ...u, _pending: true } : u)
      );
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      await friendsAPI.acceptRequest(requestId);
      toast.success("Friend request accepted!");
      loadData();
    } catch (error) {
      toast.error("Failed to accept request");
    }
  };

  const handleDeclineRequest = async (requestId) => {
    try {
      await friendsAPI.declineRequest(requestId);
      toast.success("Request declined");
      loadData();
    } catch (error) {
      toast.error("Failed to decline request");
    }
  };

  const handleRemoveFriend = async (friend) => {
    if (!window.confirm(`Remove ${friend.name} from friends?`)) return;
    try {
      await friendsAPI.removeFriend(friend.user_id);
      toast.success("Friend removed");
      loadData();
    } catch (error) {
      toast.error("Failed to remove friend");
    }
  };

  const handleMessage = (friend) => {
    navigate(`/messages?user=${friend.user_id}`);
  };

  const friendIds = friends.map(f => f.user_id);
  const pendingIds = [...requests.incoming.map(r => r.from_user?.user_id), ...requests.outgoing.map(r => r.to_user?.user_id)];

  return (
    <div className="min-h-screen bg-background" data-testid="friends-page">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Friends
          </h1>
          <div className="ml-auto flex items-center gap-2">
            {requests.incoming.length > 0 && (
              <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                {requests.incoming.length}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search for friends..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10"
              data-testid="friends-search-input"
            />
          </div>
          <Button onClick={handleSearch} disabled={searching} data-testid="friends-search-btn">
            {searching ? "..." : "Search"}
          </Button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Search Results</h2>
              <Button variant="ghost" size="sm" onClick={() => setSearchResults([])}>
                Clear
              </Button>
            </div>
            <div className="space-y-3">
              {searchResults.map((u) => (
                <SearchResultCard
                  key={u.user_id}
                  user={u}
                  onSendRequest={handleSendRequest}
                  isPending={pendingIds.includes(u.user_id) || u._pending}
                  isFriend={friendIds.includes(u.user_id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "friends", label: "Friends", count: friends.length },
            { id: "requests", label: "Requests", count: requests.incoming.length },
            { id: "sent", label: "Sent", count: requests.outgoing.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
            {activeTab === "friends" && (
              <div className="space-y-3">
                {friends.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No friends yet</p>
                    <p className="text-sm text-muted-foreground">Search for people to add as friends!</p>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <FriendCard
                      key={friend.user_id}
                      friend={friend}
                      onRemove={handleRemoveFriend}
                      onMessage={handleMessage}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === "requests" && (
              <div className="space-y-3">
                {requests.incoming.length === 0 ? (
                  <div className="text-center py-12">
                    <UserPlus className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No pending requests</p>
                  </div>
                ) : (
                  requests.incoming.map((req) => (
                    <RequestCard
                      key={req.request_id}
                      request={req}
                      type="incoming"
                      onAccept={handleAcceptRequest}
                      onDecline={handleDeclineRequest}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === "sent" && (
              <div className="space-y-3">
                {requests.outgoing.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No sent requests</p>
                  </div>
                ) : (
                  requests.outgoing.map((req) => (
                    <RequestCard
                      key={req.request_id}
                      request={req}
                      type="outgoing"
                      onCancel={handleDeclineRequest}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}

        {/* Find Friends Suggestion */}
        <div className="mt-8 bg-gradient-to-br from-primary/10 to-amber-500/10 rounded-2xl p-6 border border-primary/20">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" /> Find New Friends
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect with people on Blendlink! Search by name or username to find and add friends.
          </p>
          <Button onClick={() => document.querySelector('[data-testid="friends-search-input"]')?.focus()}>
            Start Searching
          </Button>
        </div>
      </main>
    </div>
  );
}
