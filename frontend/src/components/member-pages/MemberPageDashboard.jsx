/**
 * Member Page Dashboard
 * Individual page management interface
 * - Page settings
 * - Items management (products/menu/services/rentals)
 * - Analytics
 * - Orders
 * - Inventory
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  ChevronLeft, Settings, Package, UtensilsCrossed, Briefcase, Home,
  Plus, Edit2, Trash2, Eye, EyeOff, BarChart3, ShoppingCart, Bell,
  Users, Star, TrendingUp, DollarSign, Calendar, Clock, MapPin,
  Image, Tag, Save, Loader2, ExternalLink, Copy, Check, AlertTriangle,
  Globe, Archive, RefreshCw, ScanLine, CreditCard, Truck
} from "lucide-react";
import { memberPagesAPI, PAGE_TYPES } from "./MemberPagesSystem";
import AnalyticsDashboard from "./AnalyticsDashboard";
import InventoryManager from "./InventoryManager";
import ScannerTools from "./ScannerTools";
import POSTerminal from "./POSTerminal";
import CustomerOptionsManager from "./CustomerOptionsManager";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Dashboard Tab Components
const OverviewTab = ({ page, analytics, onRefresh }) => {
  const [period, setPeriod] = useState("7d");

  useEffect(() => {
    onRefresh(period);
  }, [period]);

  if (!analytics) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex gap-2">
        {["7d", "30d", "90d", "1y"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"
            }`}
          >
            {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : p === "90d" ? "90 Days" : "1 Year"}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Eye className="w-4 h-4" />
            <span className="text-sm">Views</span>
          </div>
          <p className="text-2xl font-bold">{analytics.overview?.total_views || 0}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <ShoppingCart className="w-4 h-4" />
            <span className="text-sm">Orders</span>
          </div>
          <p className="text-2xl font-bold">{analytics.overview?.total_orders || 0}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-sm">Revenue</span>
          </div>
          <p className="text-2xl font-bold">${(analytics.overview?.total_revenue || 0).toFixed(2)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm">Conversion</span>
          </div>
          <p className="text-2xl font-bold">{(analytics.overview?.conversion_rate || 0).toFixed(1)}%</p>
        </div>
      </div>

      {/* Top Items */}
      {analytics.top_items && analytics.top_items.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-semibold mb-4">Top Performing Items</h3>
          <div className="space-y-3">
            {analytics.top_items.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {i + 1}
                  </span>
                  <span className="font-medium">{item.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${item.revenue.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity} sold</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referral Stats */}
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Referral Program
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Your referral code</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="px-3 py-1 bg-background rounded-lg font-mono text-sm">
                {analytics.referral_stats?.referral_code || page.referral_code}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(analytics.referral_stats?.referral_code || page.referral_code);
                  toast.success("Referral code copied!");
                }}
                className="p-1.5 hover:bg-background rounded transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{analytics.referral_stats?.signups || 0}</p>
            <p className="text-sm text-muted-foreground">Signups</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Items Management Tab (Products/Menu/Services/Rentals)
const ItemsTab = ({ page, pageType }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      let data;
      if (pageType === "store") {
        data = await memberPagesAPI.getProducts(page.page_id);
        setItems(data.products || []);
      } else if (pageType === "restaurant") {
        data = await memberPagesAPI.getMenuItems(page.page_id);
        setItems(data.items || []);
      } else if (pageType === "services") {
        data = await memberPagesAPI.getServices(page.page_id);
        setItems(data.services || []);
      } else if (pageType === "rental") {
        data = await memberPagesAPI.getRentals(page.page_id);
        setItems(data.rentals || []);
      }
    } catch (err) {
      toast.error("Failed to load items");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, [page.page_id, pageType]);

  const getItemConfig = () => {
    switch (pageType) {
      case "store":
        return { label: "Products", icon: Package, idField: "product_id" };
      case "restaurant":
        return { label: "Menu Items", icon: UtensilsCrossed, idField: "item_id" };
      case "services":
        return { label: "Services", icon: Briefcase, idField: "service_id" };
      case "rental":
        return { label: "Rentals", icon: Home, idField: "rental_id" };
      default:
        return { label: "Items", icon: Package, idField: "id" };
    }
  };

  const config = getItemConfig();
  const Icon = config.icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          {config.label} ({items.length})
        </h3>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add {config.label.slice(0, -1)}
        </Button>
      </div>

      {/* Items Grid */}
      {items.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-border">
          <Icon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">No {config.label.toLowerCase()} yet</p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Your First {config.label.slice(0, -1)}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div 
              key={item[config.idField]} 
              className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Image */}
              <div className="h-32 bg-muted relative">
                {item.images?.[0] ? (
                  <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                {item.is_featured && (
                  <span className="absolute top-2 left-2 px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full">
                    Featured
                  </span>
                )}
                {!item.is_active && !item.is_available && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="px-3 py-1 bg-red-500 text-white text-sm rounded-full">Inactive</span>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-4">
                <h4 className="font-semibold truncate">{item.name}</h4>
                <p className="text-sm text-muted-foreground truncate">{item.description}</p>
                
                <div className="flex items-center justify-between mt-3">
                  <p className="text-lg font-bold text-primary">
                    ${item.price?.toFixed(2) || item.daily_rate?.toFixed(2) || "0.00"}
                    {item.daily_rate && <span className="text-xs text-muted-foreground">/day</span>}
                  </p>
                  {item.stock_quantity !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.stock_quantity <= (item.low_stock_threshold || 5)
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}>
                      {item.stock_quantity} in stock
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Item Modal - Simplified for now */}
      {showAddModal && (
        <AddItemModal 
          pageId={page.page_id} 
          pageType={pageType} 
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadItems();
          }}
        />
      )}
    </div>
  );
};

// Add Item Modal Component
const AddItemModal = ({ pageId, pageType, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    images: []
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      toast.error("Name and price are required");
      return;
    }

    setLoading(true);
    try {
      const data = {
        ...formData,
        price: parseFloat(formData.price)
      };

      if (pageType === "store") {
        await memberPagesAPI.createProduct(pageId, data);
      } else if (pageType === "restaurant") {
        await memberPagesAPI.createMenuItem(pageId, data);
      } else if (pageType === "services") {
        await memberPagesAPI.createService(pageId, { ...data, duration_minutes: 60 });
      } else if (pageType === "rental") {
        await memberPagesAPI.createRental(pageId, { ...data, daily_rate: data.price });
      }

      toast.success("Item added successfully!");
      onSuccess();
    } catch (err) {
      toast.error(err.message || "Failed to add item");
    }
    setLoading(false);
  };

  const getLabels = () => {
    switch (pageType) {
      case "store": return { title: "Add Product", priceLabel: "Price" };
      case "restaurant": return { title: "Add Menu Item", priceLabel: "Price" };
      case "services": return { title: "Add Service", priceLabel: "Price" };
      case "rental": return { title: "Add Rental Item", priceLabel: "Daily Rate" };
      default: return { title: "Add Item", priceLabel: "Price" };
    }
  };

  const labels = getLabels();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl p-6 w-full max-w-md border border-border">
        <h2 className="text-lg font-bold mb-4">{labels.title}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Name *</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Item name"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description"
              rows={2}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{labels.priceLabel} *</label>
            <Input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Category</label>
            <Input
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              placeholder="e.g., Electronics, Main Course"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Add
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Settings Tab
const SettingsTab = ({ page, onUpdate }) => {
  const [settings, setSettings] = useState(page.settings || {});
  const [pageData, setPageData] = useState({
    name: page.name,
    description: page.description,
    is_published: page.is_published
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate({
        ...pageData,
        settings
      });
      toast.success("Settings saved!");
    } catch (err) {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Basic Info */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-semibold mb-4">Basic Information</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Page Name</label>
            <Input
              value={pageData.name}
              onChange={(e) => setPageData({ ...pageData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Textarea
              value={pageData.description}
              onChange={(e) => setPageData({ ...pageData, description: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Publish Status */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Publish Page</h3>
            <p className="text-sm text-muted-foreground">Make your page visible to everyone</p>
          </div>
          <button
            onClick={() => setPageData({ ...pageData, is_published: !pageData.is_published })}
            className={`w-12 h-6 rounded-full transition-colors ${
              pageData.is_published ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
              pageData.is_published ? "translate-x-6" : "translate-x-0.5"
            }`} />
          </button>
        </div>
      </div>

      {/* Order Types */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-semibold mb-4">Order Types</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {["dine_in", "drive_thru", "pickup", "delivery", "shipping"].map((type) => {
            const labels = {
              dine_in: "Dine In",
              drive_thru: "Drive Thru",
              pickup: "Pickup",
              delivery: "Delivery",
              shipping: "Shipping"
            };
            const isEnabled = settings.order_types?.includes(type);
            return (
              <button
                key={type}
                onClick={() => {
                  const newTypes = isEnabled
                    ? settings.order_types.filter(t => t !== type)
                    : [...(settings.order_types || []), type];
                  setSettings({ ...settings, order_types: newTypes });
                }}
                className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                  isEnabled
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {isEnabled && <Check className="w-4 h-4 inline mr-1" />}
                {labels[type]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Referral Settings */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-semibold mb-4">Referral Settings</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Show Referral Link</p>
            <p className="text-sm text-muted-foreground">Display referral link on your page</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, show_referral_link: !settings.show_referral_link })}
            className={`w-12 h-6 rounded-full transition-colors ${
              settings.show_referral_link ? "bg-green-500" : "bg-gray-300"
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
              settings.show_referral_link ? "translate-x-6" : "translate-x-0.5"
            }`} />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
        Save Settings
      </Button>
    </div>
  );
};

// Main Dashboard Component
export default function MemberPageDashboard() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const wsRef = useRef(null);

  // Load page data
  const loadPage = async () => {
    try {
      const data = await memberPagesAPI.getPage(pageId);
      setPage(data);
    } catch (err) {
      toast.error("Failed to load page");
      navigate("/member-pages");
    }
    setLoading(false);
  };

  // Load analytics
  const loadAnalytics = async (period = "7d") => {
    try {
      const data = await memberPagesAPI.getAnalytics(pageId, period);
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    }
  };

  // WebSocket connection for real-time sync
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token || !pageId) return;

    const wsUrl = `${API_URL.replace('http', 'ws')}/api/member-pages/ws/${pageId}?token=${token}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log("Page sync connected");
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Page sync message:", data);
        
        // Handle real-time updates
        if (data.type === "page_updated") {
          setPage(prev => ({ ...prev, ...data.changes }));
        } else if (data.type === "product_created" || data.type === "menu_item_created") {
          // Refresh items list
          loadPage();
        } else if (data.type === "inventory_updated") {
          toast.info(`Inventory updated for ${data.item_id}`);
        }
      };

      wsRef.current.onerror = (err) => {
        console.error("WebSocket error:", err);
      };

      wsRef.current.onclose = () => {
        console.log("Page sync disconnected");
      };
    } catch (err) {
      console.error("Failed to connect WebSocket:", err);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [pageId]);

  useEffect(() => {
    loadPage();
    loadAnalytics();
  }, [pageId]);

  // Update page handler
  const handleUpdatePage = async (data) => {
    await memberPagesAPI.updatePage(pageId, data);
    loadPage();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!page) {
    return null;
  }

  const type = PAGE_TYPES[page.page_type] || PAGE_TYPES.general;
  const TypeIcon = type.icon;

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "items", label: type.id === "restaurant" ? "Menu" : type.id === "services" ? "Services" : type.id === "rental" ? "Rentals" : "Products", icon: type.icon },
    { id: "pos", label: "POS", icon: CreditCard },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "scanner", label: "Scanner", icon: ScanLine },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "delivery", label: "Delivery", icon: Truck },
    { id: "settings", label: "Settings", icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="page-dashboard">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate("/member-pages")} className="p-2 hover:bg-muted rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${type.color} flex items-center justify-center`}>
            <TypeIcon className="w-4 h-4 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate">{page.name}</h1>
            <p className="text-xs text-muted-foreground">/{page.slug}</p>
          </div>

          <div className="flex items-center gap-2">
            {page.is_published ? (
              <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs rounded-full flex items-center gap-1">
                <Globe className="w-3 h-3" /> Live
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-500/10 text-gray-500 text-xs rounded-full">Draft</span>
            )}
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => window.open(`${window.location.origin}/${page.slug}`, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-1" /> View
            </Button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === "overview" && (
          <OverviewTab page={page} analytics={analytics} onRefresh={loadAnalytics} />
        )}
        {activeTab === "items" && (
          <ItemsTab page={page} pageType={page.page_type} />
        )}
        {activeTab === "orders" && (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No orders yet</p>
          </div>
        )}
        {activeTab === "settings" && (
          <SettingsTab page={page} onUpdate={handleUpdatePage} />
        )}
      </main>
    </div>
  );
}
