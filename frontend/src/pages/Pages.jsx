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

// API functions for member pages (using correct /api/member-pages endpoints)
const pagesAPI = {
  // Get all public/discoverable pages
  getPages: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/member-pages/discover`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      // Fallback to empty array if endpoint doesn't exist yet
      console.warn("Discover endpoint not available");
      return [];
    }
    const data = await res.json();
    return data.pages || data || [];
  },
  
  // Get user's owned pages and followed pages
  getMyPages: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/member-pages/my-pages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error("Failed to load my pages");
      return { pages: [], following: [] };
    }
    const data = await res.json();
    // Handle both response formats
    return {
      owned: data.pages || [],
      following: data.following || []
    };
  },
  
  // Create a new member page
  createPage: async (data) => {
    const token = localStorage.getItem("token");
    // Transform data to match member-pages API format
    const pageData = {
      page_type: data.page_type || "general",
      name: data.name,
      slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      description: data.description || "",
      category: data.category || "business",
    };
    
    const res = await fetch(`${API_URL}/api/member-pages/`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify(pageData),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.detail || "Failed to create page");
    }
    return result;
  },
  
  // Subscribe/follow a page
  followPage: async (pageId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/member-pages/${pageId}/subscribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || "Failed to follow page");
    return result;
  },
  
  // Unsubscribe/unfollow a page
  unfollowPage: async (pageId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/member-pages/${pageId}/unsubscribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || "Failed to unfollow page");
    return result;
  },
};

// Page Card Component - Modern Glassmorphism Design
const PageCard = ({ page, onFollow, onUnfollow, onView, isFollowing, isOwner }) => {
  const CategoryIcon = PAGE_CATEGORIES.find(c => c.id === page.category)?.icon || FileText;
  const followerCount = page.subscriber_count || page.followers_count || 0;
  const pageSlug = page.slug || page.page_id;
  
  // Get page type color
  const getTypeGradient = () => {
    switch(page.page_type) {
      case 'store': return 'from-blue-500 to-indigo-600';
      case 'restaurant': return 'from-orange-500 to-red-500';
      case 'services': return 'from-purple-500 to-pink-500';
      case 'rental': return 'from-green-500 to-teal-500';
      default: return 'from-cyan-500 to-blue-500';
    }
  };
  
  return (
    <div className="member-page-card group relative overflow-hidden rounded-3xl border border-white/20 bg-white/70 backdrop-blur-xl shadow-lg hover:shadow-2xl hover:border-cyan-400/40 transition-all duration-300">
      {/* Cover Image */}
      <div className={`h-28 bg-gradient-to-br ${getTypeGradient()} relative overflow-hidden`}>
        {page.cover_image && (
          <img src={page.cover_image} alt="" className="w-full h-full object-cover" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        
        {/* Status badges */}
        <div className="absolute top-3 right-3 flex gap-2">
          {page.is_verified && (
            <span className="px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded-full flex items-center gap-1 shadow-lg">
              <Star className="w-3 h-3 fill-current" /> Verified
            </span>
          )}
          {page.is_published === false && (
            <span className="px-2 py-1 bg-gray-700/80 text-white text-xs font-medium rounded-full shadow-lg">
              Draft
            </span>
          )}
        </div>
        
        {/* Page type badge */}
        {page.page_type && (
          <div className="absolute top-3 left-3">
            <span className="px-2 py-1 bg-white/90 text-gray-800 text-xs font-medium rounded-full capitalize shadow-lg">
              {page.page_type}
            </span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getTypeGradient()} flex items-center justify-center text-white -mt-12 border-4 border-white shadow-xl overflow-hidden`}>
            {page.logo_image || page.avatar ? (
              <img src={page.logo_image || page.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <CategoryIcon className="w-8 h-8" />
            )}
          </div>
          
          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            <h3 className="font-bold text-gray-900 truncate text-lg">{page.name}</h3>
            <p className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
              <span className="capitalize">{page.category || "Business"}</span>
              <span className="text-gray-300">•</span>
              <span className="text-cyan-600 font-medium">{followerCount} followers</span>
            </p>
          </div>
        </div>
        
        {/* Description */}
        {page.description && (
          <p className="text-sm text-gray-600 mt-4 line-clamp-2">{page.description}</p>
        )}
        
        {/* Slug preview */}
        {pageSlug && (
          <div className="mt-3 text-xs text-gray-400 flex items-center gap-1">
            <Globe className="w-3 h-3" />
            <span className="truncate">blendlink.net/{pageSlug}</span>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-3 mt-5">
          {isOwner ? (
            <Button 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 rounded-xl shadow-lg shadow-cyan-500/25 h-10"
              onClick={() => onView(page)}
            >
              <Settings className="w-4 h-4 mr-2" /> Manage
            </Button>
          ) : isFollowing ? (
            <>
              <Button 
                size="sm" 
                className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl h-10"
                onClick={() => onView(page)}
              >
                <ExternalLink className="w-4 h-4 mr-2" /> View
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="rounded-xl h-10 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                onClick={() => onUnfollow(page.page_id)}
              >
                <BellOff className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 rounded-xl shadow-lg shadow-emerald-500/25 h-10"
              onClick={() => onFollow(page.page_id)}
            >
              <Heart className="w-4 h-4 mr-2" /> Follow
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
      const [discoverPages, userPages] = await Promise.all([
        pagesAPI.getPages().catch((e) => { console.error("Discover error:", e); return []; }),
        pagesAPI.getMyPages().catch((e) => { console.error("MyPages error:", e); return { owned: [], following: [] }; }),
      ]);
      setPages(Array.isArray(discoverPages) ? discoverPages : []);
      setMyPages(userPages.owned || []);
      setFollowedPages(userPages.following || []);
    } catch (error) {
      console.error("Failed to load pages:", error);
    }
    setLoading(false);
  };

  const handleCreatePage = async (data) => {
    const result = await pagesAPI.createPage(data);
    // Reload data after successful creation
    await loadData();
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
    // Navigate to page dashboard for owners, public view for others
    if (page.is_owner || myPages.some(p => p.page_id === page.page_id)) {
      navigate(`/pages/${page.page_id}/dashboard`);
    } else {
      navigate(`/pages/${page.page_id}`);
    }
  };

  const ownedPageIds = myPages.map(p => p.page_id);
  const followedPageIds = followedPages.map(p => p.page_id);

  let displayPages = pages;
  if (activeTab === "my-pages") displayPages = myPages;
  else if (activeTab === "following") displayPages = followedPages;
  
  if (searchQuery) {
    displayPages = displayPages.filter(p => 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  if (selectedCategory) {
    displayPages = displayPages.filter(p => p.category === selectedCategory);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F5FF] via-white to-[#F0F8FF]" data-testid="pages-page">
      {/* Premium Glassmorphism Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-white/50 shadow-sm safe-top">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2.5 hover:bg-white/80 rounded-2xl transition-all border border-transparent hover:border-gray-200/50"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Business Pages</h1>
              <p className="text-xs text-gray-500">Create & manage your pages</p>
            </div>
          </div>
          
          <Button 
            size="sm" 
            className="ml-auto bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 rounded-2xl px-5 h-10 shadow-lg shadow-cyan-500/25 font-medium"
            onClick={() => setShowCreateModal(true)} 
            data-testid="create-page-btn" 
            title="Create a new business page"
          >
            <Plus className="w-4 h-4 mr-2" /> Create Page
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Premium Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search pages by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 rounded-2xl border-white/50 bg-white/70 backdrop-blur-lg shadow-sm focus:border-cyan-400 focus:ring-cyan-400/20 text-gray-700 placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Premium Category Filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-2xl text-sm font-medium whitespace-nowrap transition-all ${
              !selectedCategory 
                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25" 
                : "bg-white/70 backdrop-blur-lg text-gray-600 hover:bg-white border border-white/50"
            }`}
          >
            All
          </button>
          {PAGE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={`px-4 py-2 rounded-2xl text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-all ${
                selectedCategory === cat.id 
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25" 
                  : "bg-white/70 backdrop-blur-lg text-gray-600 hover:bg-white border border-white/50"
              }`}
            >
              <cat.icon className="w-4 h-4" /> {cat.name}
            </button>
          ))}
        </div>

        {/* Premium Glassmorphism Tabs */}
        <div className="flex gap-2 mb-8 p-1.5 bg-white/50 backdrop-blur-lg rounded-2xl border border-white/50 shadow-sm">
          {[
            { id: "discover", label: "Discover", icon: Globe },
            { id: "following", label: `Following`, count: followedPages.length, icon: Heart },
            { id: "my-pages", label: `My Pages`, count: myPages.length, icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id 
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20" 
                  : "text-gray-600 hover:bg-white/80"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-cyan-100 text-cyan-600"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Pages Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-full border-4 border-cyan-200 border-t-cyan-500 animate-spin"></div>
            <p className="mt-4 text-gray-500">Loading pages...</p>
          </div>
        ) : displayPages.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              {activeTab === "my-pages" ? "No Pages Yet" : 
               activeTab === "following" ? "Not Following Any Pages" : 
               "No Pages Found"}
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto">
              {activeTab === "my-pages" 
                ? "Create your first business page and start earning BL Coins!" 
                : activeTab === "following" 
                  ? "Discover amazing pages and follow them to stay updated"
                  : "Try adjusting your search or filters"}
            </p>
            {activeTab === "my-pages" && (
              <Button 
                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 rounded-2xl px-6 h-11 shadow-lg shadow-cyan-500/25"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" /> Create Your First Page
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayPages.map((page) => (
              <PageCard
                key={page.page_id}
                page={page}
                onFollow={handleFollowPage}
                onUnfollow={handleUnfollowPage}
                onView={handleViewPage}
                isFollowing={followedPageIds.includes(page.page_id) || page.is_subscribed}
                isOwner={ownedPageIds.includes(page.page_id) || page.is_owner}
              />
            ))}
          </div>
        )}

        {/* Info Banner - Only show for users with pages */}
        {myPages.length > 0 && activeTab === "my-pages" && (
          <div className="mt-10 p-6 rounded-3xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-100/50">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Grow Your Pages</h3>
                <p className="text-gray-600 mt-1">
                  Earn <span className="font-bold text-cyan-600">40 BL Coins</span> for each new page and{" "}
                  <span className="font-bold text-cyan-600">10 BL Coins</span> for every new follower!
                </p>
              </div>
            </div>
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
          <Button size="sm" className="ml-auto" onClick={() => setShowCreateModal(true)} data-testid="create-page-btn" title="Create a new business page">
            <Plus className="w-4 h-4 mr-1" /> Create New Page
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
