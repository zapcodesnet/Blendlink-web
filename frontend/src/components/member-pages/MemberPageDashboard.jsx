/**
 * Member Page Dashboard
 * Individual page management interface
 * - Page settings
 * - Items management (products/menu/services/rentals)
 * - Analytics
 * - Orders
 * - Inventory
 */

import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AuthContext } from "../../App";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { safeFetch } from "../../services/memberPagesApi";
import {
  ChevronLeft, Settings, Package, UtensilsCrossed, Briefcase, Home,
  Plus, Edit2, Trash2, Eye, EyeOff, BarChart3, ShoppingCart, Bell,
  Users, Star, TrendingUp, DollarSign, Calendar, Clock, MapPin,
  Image, Tag, Save, Loader2, ExternalLink, Copy, Check, AlertTriangle,
  Globe, Archive, RefreshCw, ScanLine, CreditCard, Truck, Store, FileText,
  Camera, X
} from "lucide-react";
import { memberPagesAPI, PAGE_TYPES } from "./MemberPagesSystem";
import AnalyticsDashboard from "./AnalyticsDashboard";
import InventoryManager from "./InventoryManager";
import ScannerTools from "./ScannerTools";
import POSTerminal from "./POSTerminal";
import CustomerOptionsManager from "./CustomerOptionsManager";
import OrdersManager from "./OrdersManager";
import MarketplaceIntegration from "./MarketplaceIntegration";
import DailySalesReport from "./DailySalesReport";
import TeamMembersManager from "./TeamMembersManager";
import PlatformFeesManager from "./PlatformFeesManager";
import CurrencySelector from "./CurrencySelector";

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

// Add/Edit Item Modal Component - supports both create and edit modes
const AddItemModal = ({ pageId, pageType, onClose, onSuccess, editItem = null }) => {
  const isEditMode = !!editItem;
  const [formData, setFormData] = useState({
    name: editItem?.name || "",
    description: editItem?.description || "",
    price: editItem?.price?.toString() || editItem?.daily_rate?.toString() || "",
    category: editItem?.category || "",
    images: editItem?.images || []
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(editItem?.images?.[0] || null);
  const fileInputRef = React.useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      
      const token = localStorage.getItem('blendlink_token');
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      
      const response = await fetch(`${API_URL}/api/upload/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataUpload
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      setFormData(prev => ({ ...prev, images: [data.url, ...prev.images] }));
      toast.success("Image uploaded!");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Failed to upload image");
      setImagePreview(null);
    }
    setUploading(false);
  };

  const removeImage = () => {
    setImagePreview(null);
    setFormData(prev => ({ ...prev, images: prev.images.slice(1) }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
      <div className="bg-card rounded-xl p-6 w-full max-w-md border border-border max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">{labels.title}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image Upload Section */}
          <div>
            <label className="text-sm font-medium mb-2 block">Product Image</label>
            <div className="relative">
              {imagePreview || formData.images[0] ? (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                  <img 
                    src={imagePreview || formData.images[0]} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-white" />
                    </div>
                  )}
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-video rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors"
                >
                  <Camera className="w-10 h-10 text-gray-400" />
                  <span className="text-sm text-gray-500">Click to upload image</span>
                  <span className="text-xs text-gray-400">PNG, JPG up to 5MB</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
          </div>

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
    is_published: page.is_published,
    phone: page.phone || "",
    email: page.email || "",
    website: page.website || ""
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

      {/* Currency Settings */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-semibold mb-2">Currency</h3>
        <p className="text-sm text-muted-foreground mb-4">Select the currency used in your page's POS and checkout</p>
        <CurrencySelector 
          pageId={page.page_id}
          currentCurrency={page.currency || "USD"}
          currentSymbol={page.currency_symbol || "$"}
          onUpdate={(code, symbol) => {
            // Update local state
            setPageData(prev => ({ ...prev, currency: code, currency_symbol: symbol }));
          }}
        />
      </div>

      {/* Contact Information */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="font-semibold mb-4">Contact Information</h3>
        <p className="text-sm text-muted-foreground mb-4">This info will be displayed on your public page</p>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Phone Number</label>
            <Input
              placeholder="+1 (555) 123-4567"
              value={pageData.phone || ""}
              onChange={(e) => setPageData({ ...pageData, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Email</label>
            <Input
              type="email"
              placeholder="contact@yourstore.com"
              value={pageData.email || ""}
              onChange={(e) => setPageData({ ...pageData, email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Website</label>
            <Input
              placeholder="https://yourwebsite.com"
              value={pageData.website || ""}
              onChange={(e) => setPageData({ ...pageData, website: e.target.value })}
            />
          </div>
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
  const { user } = useContext(AuthContext);
  const [page, setPage] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const wsRef = useRef(null);

  // Load page data
  const loadPage = async () => {
    try {
      const data = await memberPagesAPI.getPage(pageId);
      setPage(data);
      // Also load products for POS
      loadProducts();
    } catch (err) {
      toast.error("Failed to load page");
      navigate("/pages");
    }
    setLoading(false);
  };

  // Load products/items for POS - PRODUCTION FIX: uses safeFetch
  const loadProducts = async () => {
    try {
      const data = await safeFetch(`${API_URL}/api/page-products/${pageId}`);
      setProducts(data.products || []);
    } catch (err) {
      console.error("Failed to load products:", err);
    }
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
    const token = localStorage.getItem("blendlink_token");
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
          loadProducts();
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
      <div className="min-h-screen bg-gradient-to-br from-[#F0F5FF] via-white to-[#F0F8FF] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-200 border-t-cyan-500 animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return null;
  }

  const type = PAGE_TYPES[page.page_type] || PAGE_TYPES.general;
  const TypeIcon = type.icon;

  // Get gradient for page type
  const getTypeGradient = () => {
    switch(page.page_type) {
      case 'store': return 'from-blue-500 to-indigo-600';
      case 'restaurant': return 'from-orange-500 to-red-500';
      case 'services': return 'from-purple-500 to-pink-500';
      case 'rental': return 'from-green-500 to-teal-500';
      default: return 'from-cyan-500 to-blue-500';
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "items", label: type.id === "restaurant" ? "Menu" : type.id === "services" ? "Services" : type.id === "rental" ? "Rentals" : "Products", icon: type.icon },
    { id: "pos", label: "POS", icon: CreditCard },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "scanner", label: "Scanner", icon: ScanLine },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "reports", label: "Reports", icon: FileText },
    { id: "marketplace", label: "Marketplace", icon: Store },
    { id: "delivery", label: "Delivery", icon: Truck },
    { id: "team", label: "Team", icon: Users },
    { id: "fees", label: "Fees", icon: DollarSign },
    { id: "settings", label: "Settings", icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F5FF] via-white to-[#F0F8FF] pb-20" data-testid="page-dashboard" style={{ touchAction: 'pan-y' }}>
      {/* Premium Glassmorphism Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-white/50 shadow-sm safe-top">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
          <button 
            onClick={() => navigate("/pages")} 
            className="p-2.5 hover:bg-white/80 rounded-2xl transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${getTypeGradient()} flex items-center justify-center shadow-lg`}>
            <TypeIcon className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{page.name}</h1>
            <p className="text-xs text-gray-500">/{page.slug}</p>
          </div>

          <div className="flex items-center gap-2">
            {page.is_published ? (
              <span className="px-3 py-1 bg-green-100 text-green-600 text-xs font-medium rounded-full flex items-center gap-1">
                <Globe className="w-3 h-3" /> Live
              </span>
            ) : (
              <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">Draft</span>
            )}
            <Button 
              size="sm" 
              variant="outline"
              className="rounded-xl border-gray-200 hover:bg-white"
              onClick={() => window.open(`${window.location.origin}/${page.slug}`, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-1" /> View
            </Button>
          </div>
        </div>
      </header>

      {/* Premium Tabs - Horizontal scrollable */}
      <div className="bg-white/50 backdrop-blur-lg border-b border-white/50">
        <div className="max-w-6xl mx-auto px-4">
          <div 
            className="flex gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4"
            style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}
          >
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                    activeTab === tab.id
                      ? "border-cyan-500 text-cyan-600 bg-cyan-50/50"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6" style={{ touchAction: 'pan-y' }}>
        {activeTab === "overview" && (
          <AnalyticsDashboard pageId={pageId} pageName={page.name} />
        )}
        {activeTab === "items" && (
          <ItemsTab page={page} pageType={page.page_type} />
        )}
        {activeTab === "pos" && (
          <POSTerminal 
            pageId={pageId} 
            pageType={page.page_type} 
            pageName={page.name}
            items={products}
          />
        )}
        {activeTab === "inventory" && (
          <InventoryManager pageId={pageId} pageType={page.page_type} />
        )}
        {activeTab === "scanner" && (
          <ScannerTools 
            pageId={pageId} 
            pageType={page.page_type}
            onItemFound={(item, type) => {
              toast.success(`Found: ${item.name}`);
            }}
          />
        )}
        {activeTab === "orders" && (
          <OrdersManager pageId={pageId} pageType={page.page_type} />
        )}
        {activeTab === "reports" && (
          <DailySalesReport pageId={pageId} pageType={page.page_type} />
        )}
        {activeTab === "marketplace" && (
          <MarketplaceIntegration pageId={pageId} pageType={page.page_type} pageName={page.name} />
        )}
        {activeTab === "delivery" && (
          <CustomerOptionsManager pageId={pageId} pageType={page.page_type} />
        )}
        {activeTab === "team" && (
          <TeamMembersManager pageId={pageId} isOwner={page.owner_id === user?.user_id} />
        )}
        {activeTab === "fees" && (
          <PlatformFeesManager pageId={pageId} currencySymbol={page.currency_symbol || "$"} />
        )}
        {activeTab === "settings" && (
          <SettingsTab page={page} onUpdate={handleUpdatePage} />
        )}
      </main>
    </div>
  );
}
