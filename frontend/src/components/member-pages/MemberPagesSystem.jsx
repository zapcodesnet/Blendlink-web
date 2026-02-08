/**
 * Enhanced Member Pages System
 * - Public Store Pages (e-commerce)
 * - Restaurant Pages (menu-driven)
 * - Services Pages (booking/calendar)
 * - Rental Pages (availability calendar)
 * - Real-time sync via WebSocket
 */

import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../../App";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Store, UtensilsCrossed, Briefcase, Home, FileText, Plus, X, Check,
  AlertCircle, Loader2, MapPin, Clock, DollarSign, Package, Calendar,
  BarChart3, Bell, Settings, Globe, ChevronRight, ExternalLink, Eye,
  Sparkles, Image, Tag, Users, Star, TrendingUp, ShoppingCart
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Page type configurations
const PAGE_TYPES = {
  store: {
    id: "store",
    name: "Public Store",
    description: "E-commerce store with products, variants, cart & checkout",
    icon: Store,
    color: "from-blue-500 to-indigo-600",
    features: ["Product catalog", "Inventory tracking", "Cart & checkout", "Customer reviews"]
  },
  restaurant: {
    id: "restaurant",
    name: "Restaurant",
    description: "Menu-driven page with categories, add-ons & dietary info",
    icon: UtensilsCrossed,
    color: "from-orange-500 to-red-600",
    features: ["Menu sections", "Add-ons & sizes", "Allergen info", "Table management"]
  },
  services: {
    id: "services",
    name: "Services",
    description: "Service catalog with booking calendar & time slots",
    icon: Briefcase,
    color: "from-purple-500 to-pink-600",
    features: ["Service tiers", "Booking calendar", "Availability slots", "Appointment management"]
  },
  rental: {
    id: "rental",
    name: "Rentals",
    description: "Rental catalog with availability & duration pricing",
    icon: Home,
    color: "from-green-500 to-teal-600",
    features: ["Hourly/daily/weekly rates", "Availability calendar", "Deposit handling", "Rental terms"]
  },
  general: {
    id: "general",
    name: "General Page",
    description: "Basic page for brand presence and content",
    icon: FileText,
    color: "from-gray-500 to-slate-600",
    features: ["About section", "Contact info", "Social links", "Content posts"]
  }
};

// Slug validation and checking
const useSlugChecker = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null); // { available, suggestions }
  const timeoutRef = useRef(null);

  const checkSlug = useCallback(async (slug) => {
    if (!slug || slug.length < 3) {
      setSlugStatus(null);
      return;
    }

    // Debounce
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(async () => {
      setIsChecking(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/member-pages/check-slug/${slug}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setSlugStatus({
          available: data.is_available,
          suggestions: data.suggestions || []
        });
      } catch (err) {
        console.error("Failed to check slug:", err);
      }
      setIsChecking(false);
    }, 500);
  }, []);

  return { isChecking, slugStatus, checkSlug };
};

// Create Page Modal Component
export const CreateMemberPageModal = ({ onClose, onCreate }) => {
  const [step, setStep] = useState(1); // 1: type selection, 2: details
  const [selectedType, setSelectedType] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    category: "",
  });
  const [loading, setLoading] = useState(false);
  const { isChecking, slugStatus, checkSlug } = useSlugChecker();

  // Auto-generate slug from name
  useEffect(() => {
    if (formData.name && !formData.slug) {
      const autoSlug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setFormData(prev => ({ ...prev, slug: autoSlug }));
      checkSlug(autoSlug);
    }
  }, [formData.name]);

  const handleSlugChange = (e) => {
    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setFormData(prev => ({ ...prev, slug }));
    checkSlug(slug);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedType || !formData.name || !formData.slug) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    if (slugStatus && !slugStatus.available) {
      toast.error("Please choose an available URL slug");
      return;
    }

    setLoading(true);
    try {
      await onCreate({
        page_type: selectedType,
        ...formData
      });
      toast.success(`${PAGE_TYPES[selectedType].name} page created! +40 BL Coins`);
      onClose();
    } catch (error) {
      const errorDetail = error.message;
      if (typeof errorDetail === 'object' && errorDetail.suggestions) {
        toast.error(errorDetail.message);
      } else {
        toast.error(errorDetail || "Failed to create page");
      }
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl w-full max-w-2xl border border-border shadow-2xl my-8 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Create Business Page
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 1 ? "Choose your page type" : "Set up your page details"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Type Selection */}
        {step === 1 && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.values(PAGE_TYPES).map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type.id)}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected 
                        ? "border-primary bg-primary/5 shadow-lg" 
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                    data-testid={`page-type-${type.id}`}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center mb-3`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-semibold">{type.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {type.features.slice(0, 2).map((feature, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 bg-muted rounded-full">{feature}</span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end mt-6">
              <Button 
                onClick={() => setStep(2)} 
                disabled={!selectedType}
                className="gap-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Page Details */}
        {step === 2 && selectedType && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Selected Type Badge */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              {(() => {
                const type = PAGE_TYPES[selectedType];
                const Icon = type.icon;
                return (
                  <>
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${type.color} flex items-center justify-center`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium">{type.name}</p>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setStep(1)}
                      className="ml-auto text-sm text-primary hover:underline"
                    >
                      Change
                    </button>
                  </>
                );
              })()}
            </div>

            {/* Page Name */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Page Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Awesome Store"
                data-testid="page-name-input"
              />
            </div>

            {/* URL Slug */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">URL Slug *</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  blendlink.net/
                </div>
                <Input
                  value={formData.slug}
                  onChange={handleSlugChange}
                  placeholder="my-store"
                  className="pl-28"
                  data-testid="page-slug-input"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isChecking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                  {!isChecking && slugStatus?.available && <Check className="w-4 h-4 text-green-500" />}
                  {!isChecking && slugStatus && !slugStatus.available && <AlertCircle className="w-4 h-4 text-red-500" />}
                </div>
              </div>
              {slugStatus && !slugStatus.available && slugStatus.suggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-red-500 mb-1">This URL is taken. Try:</p>
                  <div className="flex flex-wrap gap-1">
                    {slugStatus.suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, slug: s }));
                          checkSlug(s);
                        }}
                        className="text-xs px-2 py-1 bg-muted rounded hover:bg-primary/10 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Description</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Tell customers about your business..."
                rows={3}
              />
            </div>

            {/* Category */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Category</label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Fashion, Food, Technology"
              />
            </div>

            {/* BL Coins Reward */}
            <div className="bg-gradient-to-r from-amber-500/10 to-yellow-500/10 rounded-lg p-4 flex items-center gap-3 border border-amber-500/20">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="font-medium">Earn 40 BL Coins!</p>
                <p className="text-sm text-muted-foreground">Create your page and start earning</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !formData.name || !formData.slug || (slugStatus && !slugStatus.available)} 
                className="flex-1"
                data-testid="create-page-submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Page
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// Page Card Component for listing
export const MemberPageCard = ({ page, onManage, onView }) => {
  const type = PAGE_TYPES[page.page_type] || PAGE_TYPES.general;
  const Icon = type.icon;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all group">
      {/* Cover */}
      <div className={`h-20 bg-gradient-to-br ${type.color} relative`}>
        {page.cover_image && (
          <img src={page.cover_image} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          {page.is_published ? (
            <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full flex items-center gap-1">
              <Globe className="w-3 h-3" /> Live
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-gray-500 text-white text-xs rounded-full">Draft</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${type.color} flex items-center justify-center -mt-8 border-2 border-background shadow-lg`}>
            {page.logo_image ? (
              <img src={page.logo_image} alt="" className="w-full h-full object-cover rounded-lg" />
            ) : (
              <Icon className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <h3 className="font-semibold truncate">{page.name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="capitalize">{type.name}</span>
              <span>•</span>
              <span>/{page.slug}</span>
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-bold">{page.total_views || 0}</p>
            <p className="text-xs text-muted-foreground">Views</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-bold">{page.total_orders || 0}</p>
            <p className="text-xs text-muted-foreground">Orders</p>
          </div>
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-bold flex items-center justify-center gap-0.5">
              <Star className="w-3 h-3 text-yellow-500" />
              {page.rating_average?.toFixed(1) || "0.0"}
            </p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => onView(page)}>
            <Eye className="w-4 h-4 mr-1" /> Preview
          </Button>
          <Button size="sm" className="flex-1" onClick={() => onManage(page)}>
            <Settings className="w-4 h-4 mr-1" /> Manage
          </Button>
        </div>
      </div>
    </div>
  );
};

// API functions for member pages
export const memberPagesAPI = {
  getMyPages: async () => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/member-pages/my-pages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to load pages");
    return res.json();
  },

  createPage: async (data) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/member-pages/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Failed to create page");
    }
    return res.json();
  },

  getPage: async (pageId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/member-pages/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to load page");
    return res.json();
  },

  updatePage: async (pageId, data) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/member-pages/${pageId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update page");
    return res.json();
  },

  deletePage: async (pageId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/member-pages/${pageId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to delete page");
    return res.json();
  },

  getPublicPage: async (slug) => {
    const res = await fetch(`${API_URL}/api/member-pages/public/${slug}`);
    if (!res.ok) throw new Error("Page not found");
    return res.json();
  },

  // Products
  getProducts: async (pageId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/page-products/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to load products");
    return res.json();
  },

  createProduct: async (pageId, data) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/page-products/${pageId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create product");
    return res.json();
  },

  // Menu Items
  getMenuItems: async (pageId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/page-menu/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to load menu");
    return res.json();
  },

  createMenuItem: async (pageId, data) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/page-menu/${pageId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create menu item");
    return res.json();
  },

  // Services
  getServices: async (pageId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/page-services/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to load services");
    return res.json();
  },

  createService: async (pageId, data) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/page-services/${pageId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create service");
    return res.json();
  },

  // Rentals
  getRentals: async (pageId) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/page-rentals/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to load rentals");
    return res.json();
  },

  createRental: async (pageId, data) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/page-rentals/${pageId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to create rental");
    return res.json();
  },

  // Analytics
  getAnalytics: async (pageId, period = "7d") => {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_URL}/api/page-analytics/${pageId}?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to load analytics");
    return res.json();
  },

  // Inventory
  getInventory: async (pageId, lowStockOnly = false) => {
    const token = localStorage.getItem("token");
    const url = `${API_URL}/api/page-inventory/${pageId}${lowStockOnly ? '?low_stock_only=true' : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to load inventory");
    return res.json();
  }
};

export default {
  CreateMemberPageModal,
  MemberPageCard,
  memberPagesAPI,
  PAGE_TYPES
};
