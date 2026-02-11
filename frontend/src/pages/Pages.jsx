import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { memberPagesApi } from "../services/memberPagesApi";
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

// Use centralized API service (memberPagesApi imported above)
// All API methods use production-safe text-first pattern automatically

// Page Card Component - Modern Glassmorphism Design
const PageCard = ({ page, onFollow, onUnfollow, onView, onManage, isFollowing, isOwner, canManage }) => {
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
    <div 
      className="member-page-card group relative overflow-hidden rounded-3xl border border-white/20 bg-white/70 backdrop-blur-xl shadow-lg hover:shadow-2xl hover:border-cyan-400/40 transition-all duration-300"
      style={{ touchAction: 'manipulation' }}
      data-testid={`page-card-${page.page_id}`}
    >
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
        
        {/* Actions - Always show View button, Manage only for authorized users */}
        <div className="flex gap-3 mt-5">
          {/* View button - visible to everyone */}
          <Button 
            size="sm" 
            className="flex-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl h-10"
            onClick={() => onView(page)}
            data-testid={`page-view-${page.page_id}`}
          >
            <ExternalLink className="w-4 h-4 mr-2" /> View
          </Button>
          
          {/* Manage button - only for owners/authorized users */}
          {(isOwner || canManage) && (
            <Button 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 rounded-xl shadow-lg shadow-cyan-500/25 h-10"
              onClick={() => onManage(page)}
              data-testid={`page-manage-${page.page_id}`}
            >
              <Settings className="w-4 h-4 mr-2" /> Manage
            </Button>
          )}
          
          {/* Follow/Unfollow button for non-owners */}
          {!isOwner && !canManage && (
            isFollowing ? (
              <Button 
                size="sm" 
                variant="outline" 
                className="rounded-xl h-10 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                onClick={() => onUnfollow(page.page_id)}
                data-testid={`page-unfollow-${page.page_id}`}
              >
                <BellOff className="w-4 h-4" />
              </Button>
            ) : (
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 rounded-xl shadow-lg shadow-emerald-500/25 h-10 px-4"
                onClick={() => onFollow(page.page_id)}
                data-testid={`page-follow-${page.page_id}`}
              >
                <Heart className="w-4 h-4" />
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
};

// Create Page Modal - Premium Glassmorphism Design (Mobile-First)
const CreatePageModal = ({ onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "business",
    page_type: "general",
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
      toast.success("Page created! +40 BL Coins", {
        description: "Your new business page is ready to customize!"
      });
      onClose();
    } catch (error) {
      toast.error(error.message || "Failed to create page");
    }
    setLoading(false);
  };

  // Page types for the new system
  const PAGE_TYPES = [
    { id: "general", name: "General", description: "Basic page for any purpose" },
    { id: "store", name: "Store", description: "E-commerce with products" },
    { id: "restaurant", name: "Restaurant", description: "Menu & food ordering" },
    { id: "services", name: "Services", description: "Booking & appointments" },
    { id: "rental", name: "Rentals", description: "Equipment & property" },
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] overflow-y-auto overscroll-contain"
      style={{ touchAction: 'pan-y' }}
      onClick={onClose}
    >
      {/* Scrollable container - positioned at top with extra bottom padding for nav bar */}
      <div 
        className="min-h-full flex items-start justify-center px-4 pt-4 pb-40"
        style={{ touchAction: 'pan-y' }}
      >
        <div 
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 sm:p-6 w-full max-w-lg border border-white/50 shadow-2xl my-2"
          style={{ touchAction: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <Plus className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Create Page</h2>
                <p className="text-xs sm:text-sm text-gray-500">Set up your business presence</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-400 rotate-180" />
            </button>
          </div>
        
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Page Name */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Page Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Awesome Business"
                className="h-11 rounded-2xl border-gray-200 bg-white/80 focus:border-cyan-400 focus:ring-cyan-400/20"
                data-testid="page-name-input"
              />
            </div>

            {/* Page Type */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Page Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PAGE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, page_type: type.id })}
                    className={`p-2.5 rounded-2xl border-2 text-left transition-all ${
                      formData.page_type === type.id 
                        ? "border-cyan-400 bg-cyan-50" 
                        : "border-gray-100 bg-white hover:border-gray-200"
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-800 block">{type.name}</span>
                    <span className="text-xs text-gray-500 line-clamp-1">{type.description}</span>
                  </button>
                ))}
              </div>
            </div>
          
            {/* Category */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {PAGE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.id })}
                    className={`p-2.5 rounded-2xl border-2 flex flex-col items-center gap-1 text-xs transition-all ${
                      formData.category === cat.id 
                        ? "border-cyan-400 bg-cyan-50 text-cyan-700" 
                        : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"
                    }`}
                  >
                    <cat.icon className="w-4 h-4" />
                    <span className="font-medium">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          
            {/* Description */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Tell people what your page is about..."
                rows={2}
                className="rounded-2xl border-gray-200 bg-white/80 focus:border-cyan-400 focus:ring-cyan-400/20 resize-none"
              />
            </div>
          
            {/* BL Coins Reward */}
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-3 flex items-center gap-3 border border-cyan-100/50">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center shadow-lg shadow-yellow-400/25 flex-shrink-0">
                <Coins className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Earn 40 BL Coins!</p>
                <p className="text-xs text-gray-500">Create your page and start earning</p>
              </div>
            </div>
          
            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                className="flex-1 h-11 rounded-2xl border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 shadow-lg shadow-cyan-500/25 font-semibold"
                data-testid="create-page-submit"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Create Page
                  </span>
                )}
              </Button>
            </div>
          </form>
        </div>
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
      const [discoverData, myPagesData] = await Promise.all([
        memberPagesApi.getDiscoverPages().catch((e) => { console.error("Discover error:", e); return { pages: [] }; }),
        memberPagesApi.getMyPages().catch((e) => { console.error("MyPages error:", e); return { pages: [], following: [] }; }),
      ]);
      // Handle both array and object responses
      const discoverPages = discoverData?.pages || discoverData || [];
      setPages(Array.isArray(discoverPages) ? discoverPages : []);
      setMyPages(myPagesData?.pages || []);
      setFollowedPages(myPagesData?.following || []);
    } catch (error) {
      console.error("Failed to load pages:", error);
    }
    setLoading(false);
  };

  const handleCreatePage = async (data) => {
    // Build page data with auto-generated slug
    const pageData = {
      page_type: data.page_type || "general",
      name: data.name,
      slug: data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now(),
      description: data.description || "",
      category: data.category || "business",
    };
    const result = await memberPagesApi.createPage(pageData);
    // Reload data after successful creation
    await loadData();
    return result;
  };

  const handleFollowPage = async (pageId) => {
    try {
      await memberPagesApi.followPage(pageId);
      toast.success("Following page! +10 BL Coins");
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleUnfollowPage = async (pageId) => {
    try {
      await memberPagesApi.unfollowPage(pageId);
      toast.success("Unfollowed page");
      loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleViewPage = (page) => {
    // Navigate to member page dashboard for owners, public view for others
    if (page.is_owner || myPages.some(p => p.page_id === page.page_id)) {
      // Use correct route: /member-pages/:pageId (not /pages/:id/dashboard)
      navigate(`/member-pages/${page.page_id}`);
    } else {
      // Public view for non-owners
      navigate(`/member-pages/${page.page_id}`);
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
    <div className="min-h-screen bg-gradient-to-br from-[#F0F5FF] via-white to-[#F0F8FF] pb-24" data-testid="pages-page" style={{ touchAction: 'pan-y' }}>
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
            className="ml-auto bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 rounded-2xl px-5 h-10 shadow-lg shadow-cyan-500/25 font-medium z-50"
            onClick={() => setShowCreateModal(true)} 
            data-testid="create-page-btn" 
            title="Create a new business page"
          >
            <Plus className="w-4 h-4 mr-2" /> Create Page
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6" style={{ touchAction: 'pan-y' }}>
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

        {/* Premium Category Filter - Horizontal scrollable */}
        <div 
          className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4"
          style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}
        >
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-2xl text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 ${
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
              className={`px-4 py-2 rounded-2xl text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-all flex-shrink-0 ${
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
              className={`flex-1 py-3 px-2 sm:px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-1 sm:gap-2 text-sm sm:text-base ${
                activeTab === tab.id 
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20" 
                  : "text-gray-600 hover:bg-white/80"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.id === 'my-pages' ? 'Mine' : tab.id === 'following' ? 'Following' : 'Discover'}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-bold ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-cyan-100 text-cyan-600"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Pages Grid - with proper touch scrolling */}
        <div style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}>
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
        </div>

        {/* Info Banner - Only show for users with pages */}
        {myPages.length > 0 && activeTab === "my-pages" && (
          <div className="mt-10 p-6 rounded-3xl bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-100/50 mb-8">
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
