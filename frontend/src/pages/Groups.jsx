import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  Users2,
  Plus,
  Search,
  ChevronLeft,
  Globe,
  Lock,
  Settings,
  UserPlus,
  LogOut,
  MoreHorizontal,
  Image,
  Coins,
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// API functions for groups
const groupsAPI = {
  getGroups: async () => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/groups/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to load groups");
    return res.json();
  },
  
  getMyGroups: async () => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/groups/my-groups/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to load my groups");
    return res.json();
  },
  
  createGroup: async (data) => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/groups/`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create group");
    }
    return res.json();
  },
  
  joinGroup: async (groupId) => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/groups/${groupId}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to join group");
    return res.json();
  },
  
  leaveGroup: async (groupId) => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/groups/${groupId}/leave`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to leave group");
    return res.json();
  },
  
  searchGroups: async (query) => {
    const token = localStorage.getItem("blendlink_token") || localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/groups/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to search groups");
    return res.json();
  },
};

// Group Card Component
const GroupCard = ({ group, onJoin, onLeave, onView, isMember, isOwner }) => (
  <div className="bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/30 transition-all">
    {/* Cover Image */}
    <div className="h-24 bg-gradient-to-br from-blue-500 to-purple-600 relative">
      {group.cover_image && (
        <img src={group.cover_image} alt="" className="w-full h-full object-cover" />
      )}
      <div className="absolute top-2 right-2">
        <span className={`px-2 py-1 rounded-full text-xs ${
          group.privacy === "public" ? "bg-green-500/90" : "bg-amber-500/90"
        } text-white flex items-center gap-1`}>
          {group.privacy === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
          {group.privacy}
        </span>
      </div>
    </div>
    
    {/* Content */}
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-white text-lg font-bold -mt-8 border-2 border-background">
          {group.avatar ? (
            <img src={group.avatar} alt="" className="w-full h-full object-cover rounded-xl" />
          ) : (
            <Users2 className="w-6 h-6" />
          )}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <h3 className="font-semibold truncate">{group.name}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{group.members_count || 0} members</span>
            {isOwner && <span className="text-primary">• Owner</span>}
          </p>
        </div>
      </div>
      
      {group.description && (
        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{group.description}</p>
      )}
      
      <div className="flex gap-2 mt-4">
        {isOwner ? (
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onView(group)}>
            <Settings className="w-4 h-4 mr-1" /> Manage
          </Button>
        ) : isMember ? (
          <>
            <Button size="sm" className="flex-1" onClick={() => onView(group)}>
              View Group
            </Button>
            <Button size="sm" variant="outline" onClick={() => onLeave(group.group_id)}>
              <LogOut className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <Button size="sm" className="flex-1" onClick={() => onJoin(group.group_id)}>
            <UserPlus className="w-4 h-4 mr-1" /> Join Group
          </Button>
        )}
      </div>
    </div>
  </div>
);

// Create Group Modal
const CreateGroupModal = ({ onClose, onCreate }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState("public");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Group name is required");
      return;
    }
    
    setLoading(true);
    try {
      await onCreate({ name, description, privacy });
      toast.success("Group created! +40 BL Coins");
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Users2 className="w-5 h-5 text-primary" /> Create Group
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Group Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter group name"
              data-testid="group-name-input"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              rows={3}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Privacy</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPrivacy("public")}
                className={`flex-1 p-3 rounded-lg border ${
                  privacy === "public" ? "border-primary bg-primary/10" : "border-border"
                } flex items-center justify-center gap-2`}
              >
                <Globe className="w-4 h-4" /> Public
              </button>
              <button
                type="button"
                onClick={() => setPrivacy("private")}
                className={`flex-1 p-3 rounded-lg border ${
                  privacy === "private" ? "border-primary bg-primary/10" : "border-border"
                } flex items-center justify-center gap-2`}
              >
                <Lock className="w-4 h-4" /> Private
              </button>
            </div>
          </div>
          
          <div className="bg-primary/10 rounded-lg p-3 flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <span className="text-sm">Creating a group earns you <strong>40 BL Coins!</strong></span>
          </div>
          
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1" data-testid="create-group-submit">
              {loading ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function Groups() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("discover");
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allGroups, userGroups] = await Promise.all([
        groupsAPI.getGroups().catch(() => []),
        groupsAPI.getMyGroups().catch(() => []),
      ]);
      setGroups(allGroups);
      setMyGroups(userGroups);
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const results = await groupsAPI.searchGroups(searchQuery);
      setSearchResults(results);
    } catch (error) {
      toast.error("Search failed");
    }
  };

  const handleCreateGroup = async (data) => {
    const result = await groupsAPI.createGroup(data);
    loadData();
    return result;
  };

  const handleJoinGroup = async (groupId) => {
    try {
      await groupsAPI.joinGroup(groupId);
      toast.success("Joined group!");
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    try {
      await groupsAPI.leaveGroup(groupId);
      toast.success("Left group");
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleViewGroup = (group) => {
    navigate(`/groups/${group.group_id}`);
  };

  const myGroupIds = myGroups.map(g => g.group_id);
  const ownedGroupIds = myGroups.filter(g => g.owner_id === user?.user_id).map(g => g.group_id);
  const displayGroups = searchResults.length > 0 ? searchResults : (activeTab === "my-groups" ? myGroups : groups);

  return (
    <div className="min-h-screen bg-background" data-testid="groups-page">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Users2 className="w-5 h-5 text-primary" /> Groups
          </h1>
          <Button size="sm" className="ml-auto" onClick={() => setShowCreateModal(true)} data-testid="create-group-btn">
            <Plus className="w-4 h-4 mr-1" /> Create
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch}>Search</Button>
        </div>

        {searchResults.length > 0 && (
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {searchResults.length} results found
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSearchResults([])}>
              Clear Search
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setActiveTab("discover"); setSearchResults([]); }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              activeTab === "discover" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            Discover
          </button>
          <button
            onClick={() => { setActiveTab("my-groups"); setSearchResults([]); }}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              activeTab === "my-groups" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            }`}
          >
            My Groups ({myGroups.length})
          </button>
        </div>

        {/* Groups Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : displayGroups.length === 0 ? (
          <div className="text-center py-12">
            <Users2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {activeTab === "my-groups" ? "You haven't joined any groups yet" : "No groups found"}
            </p>
            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create Your First Group
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayGroups.map((group) => (
              <GroupCard
                key={group.group_id}
                group={group}
                onJoin={handleJoinGroup}
                onLeave={handleLeaveGroup}
                onView={handleViewGroup}
                isMember={myGroupIds.includes(group.group_id)}
                isOwner={ownedGroupIds.includes(group.group_id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Group Modal */}
      {showCreateModal && (
        <CreateGroupModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateGroup}
        />
      )}
    </div>
  );
}
