import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import {
  FileText,
  Plus,
  Search,
  ChevronLeft,
  Heart,
  Users,
  ExternalLink,
  Settings,
  Bell,
  BellOff,
  Globe,
  Coins,
  Star,
  Building2,
  Palette,
  Music,
  ShoppingBag,
  Utensils,
  Dumbbell,
  GraduationCap,
  Camera,
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Page categories
const PAGE_CATEGORIES = [
  { id: "business", name: "Business", icon: Building2 },
  { id: "creator", name: "Creator", icon: Palette },
  { id: "music", name: "Music", icon: Music },
  { id: "shopping", name: "Shopping", icon: ShoppingBag },
  { id: "food", name: "Food & Drink", icon: Utensils },
  { id: "fitness", name: "Fitness", icon: Dumbbell },
  { id: "education", name: "Education", icon: GraduationCap },
  { id: "photography", name: "Photography", icon: Camera },
  { id: "other", name: "Other", icon: FileText },
];

// API functions for pages
const pagesAPI = {
  getPages: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/pages/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to load pages");
    return res.json();
  },
  
  getMyPages: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/pages/my-pages/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to load my pages");
    return res.json();
  },
  
  createPage: async (data) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/pages/`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.detail || "Failed to create page");
    }
    return result;
  },
  
  followPage: async (pageId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/pages/${pageId}/follow`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to follow page");
    return res.json();
  },
  
  unfollowPage: async (pageId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/pages/${pageId}/unfollow`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to unfollow page");
    return res.json();
  },
};

// Page Card Component
const PageCard = ({ page, onFollow, onUnfollow, onView, isFollowing, isOwner }) => {
  const CategoryIcon = PAGE_CATEGORIES.find(c => c.id === page.category)?.icon || FileText;
  
  return (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/30 transition-all">
      {/* Cover Image */}
      <div className="h-24 bg-gradient-to-br from-emerald-500 to-teal-600 relative">
        {page.cover_image && (
          <img src={page.cover_image} alt="" className="w-full h-full object-cover" />
        )}
        {page.verified && (
          <div className="absolute top-2 right-2 bg-blue-500 text-white p-1 rounded-full">
            <Star className="w-3 h-3" />
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white -mt-10 border-2 border-background overflow-hidden">
            {page.avatar ? (
              <img src={page.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <CategoryIcon className="w-7 h-7" />
            )}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <div className="flex items-center gap-1">
              <h3 className="font-semibold truncate">{page.name}</h3>
              {page.verified && <Star className="w-4 h-4 text-blue-500 fill-blue-500" />}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <span className="capitalize">{page.category || "Page"}</span>
              <span>•</span>
              <span>{page.followers_count || 0} followers</span>
            </p>
          </div>
        </div>
        
        {page.description && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{page.description}</p>
        )}
        
        <div className="flex gap-2 mt-4">
          {isOwner ? (
            <Button size="sm" variant="outline" className="flex-1" onClick={() => onView(page)}>
              <Settings className="w-4 h-4 mr-1" /> Manage
            </Button>
          ) : isFollowing ? (
            <>
              <Button size="sm" className="flex-1" onClick={() => onView(page)}>
                View Page
              </Button>
              <Button size="sm" variant="outline" onClick={() => onUnfollow(page.page_id)}>
                <BellOff className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onFollow(page.page_id)}>
              <Heart className="w-4 h-4 mr-1" /> Follow
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Create Page Modal
const CreatePageModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "business",
    website: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Page name is required");
      return;
    }
    
    setLoading(true);
    try {
      await onCreate(formData);
      toast.success("Page created! +40 BL Coins");
      onClose();
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border my-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> Create Page
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Page Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Your page name"
              data-testid="page-name-input"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {PAGE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: cat.id })}
                  className={`p-2 rounded-lg border flex flex-col items-center gap-1 text-xs ${
                    formData.category === cat.id ? "border-primary bg-primary/10" : "border-border"
                  }`}
                >
                  <cat.icon className="w-4 h-4" />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What is your page about?"
              rows={3}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Website (optional)</label>
            <Input
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
          
          <div className="bg-primary/10 rounded-lg p-3 flex items-center gap-2">
            <Coins className="w-5 h-5 text-primary" />
            <span className="text-sm">Creating a page earns you <strong>40 BL Coins!</strong></span>
          </div>
          
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1" data-testid="create-page-submit">
              {loading ? "Creating..." : "Create Page"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function Pages() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("discover");
  const [pages, setPages] = useState([]);
  const [myPages, setMyPages] = useState([]);
  const [followedPages, setFollowedPages] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allPages, userPages] = await Promise.all([
        pagesAPI.getPages().catch(() => []),
        pagesAPI.getMyPages().catch(() => ({ owned: [], following: [] })),
      ]);
      setPages(allPages);
      setMyPages(userPages.owned || []);
      setFollowedPages(userPages.following || []);
    } catch (error) {
      console.error("Failed to load pages:", error);
    }
    setLoading(false);
  };

  const handleCreatePage = async (data) => {
    const result = await pagesAPI.createPage(data);
    loadData();
    return result;
  };

  const handleFollowPage = async (pageId) => {
    try {
      await pagesAPI.followPage(pageId);
      toast.success("Following page! +10 BL Coins");
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleUnfollowPage = async (pageId) => {
    try {
      await pagesAPI.unfollowPage(pageId);
      toast.success("Unfollowed page");
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleViewPage = (page) => {
    navigate(`/pages/${page.page_id}`);
  };

  const ownedPageIds = myPages.map(p => p.page_id);
  const followedPageIds = followedPages.map(p => p.page_id);

  let displayPages = pages;
  if (activeTab === "my-pages") displayPages = myPages;
  else if (activeTab === "following") displayPages = followedPages;
  
  if (searchQuery) {
    displayPages = displayPages.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  if (selectedCategory) {
    displayPages = displayPages.filter(p => p.category === selectedCategory);
  }

  return (
    <div className="min-h-screen bg-background" data-testid="pages-page">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Pages
          </h1>
          <Button size="sm" className="ml-auto" onClick={() => setShowCreateModal(true)} data-testid="create-page-btn">
            <Plus className="w-4 h-4 mr-1" /> Create
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              !selectedCategory ? "bg-primary text-white" : "bg-muted"
            }`}
          >
            All
          </button>
          {PAGE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex items-center gap-1 ${
                selectedCategory === cat.id ? "bg-primary text-white" : "bg-muted"
              }`}
            >
              <cat.icon className="w-3 h-3" /> {cat.name}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "discover", label: "Discover" },
            { id: "following", label: `Following (${followedPages.length})` },
            { id: "my-pages", label: `My Pages (${myPages.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                activeTab === tab.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Pages Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : displayPages.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {activeTab === "my-pages" ? "You haven't created any pages yet" : 
               activeTab === "following" ? "You're not following any pages yet" : 
               "No pages found"}
            </p>
            <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Create Your First Page
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayPages.map((page) => (
              <PageCard
                key={page.page_id}
                page={page}
                onFollow={handleFollowPage}
                onUnfollow={handleUnfollowPage}
                onView={handleViewPage}
                isFollowing={followedPageIds.includes(page.page_id)}
                isOwner={ownedPageIds.includes(page.page_id)}
              />
            ))}
          </div>
        )}

        {/* Info Section - No duplicate button */}
        {myPages.length > 0 && (
          <div className="mt-8 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-2xl p-6 border border-emerald-500/20">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" /> Grow Your Pages
            </h3>
            <p className="text-sm text-muted-foreground">
              Build your brand, promote your business, or share your passion with the world. 
              Earn 40 BL Coins for creating a page, plus 10 BL Coins for each new follower!
            </p>
          </div>
        )}
      </main>

      {/* Create Page Modal */}
      {showCreateModal && (
        <CreatePageModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePage}
        />
      )}
    </div>
  );
}
