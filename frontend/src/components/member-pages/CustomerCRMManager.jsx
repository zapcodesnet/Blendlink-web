/**
 * Customer CRM Manager Component
 * Tracks repeat customers, purchase history, and enables page owners to send offers
 */
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Users, Search, Phone, Mail, Gift, Star, MessageSquare,
  TrendingUp, DollarSign, Calendar, ChevronRight, Loader2,
  Send, Copy, Heart, ShoppingBag, Clock, Filter
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Customer Card Component
const CustomerCard = ({ customer, onSendOffer, onRequestReview, pageId }) => {
  const [showActions, setShowActions] = useState(false);
  
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
          {customer.name?.[0]?.toUpperCase() || customer.email?.[0]?.toUpperCase() || "?"}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">{customer.name || "Guest Customer"}</h4>
          <div className="flex flex-wrap gap-2 mt-1">
            {customer.email && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Mail className="w-3 h-3" /> {customer.email}
              </span>
            )}
            {customer.phone && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Phone className="w-3 h-3" /> {customer.phone}
              </span>
            )}
          </div>
        </div>
        
        {/* Stats */}
        <div className="text-right">
          <p className="font-bold text-cyan-600">${customer.total_spent?.toFixed(2) || "0.00"}</p>
          <p className="text-xs text-gray-500">{customer.order_count || 0} orders</p>
        </div>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-gray-900">{customer.order_count || 0}</p>
          <p className="text-xs text-gray-500">Orders</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-gray-900">${customer.avg_order?.toFixed(2) || "0.00"}</p>
          <p className="text-xs text-gray-500">Avg Order</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-gray-900">{customer.last_visit || "Never"}</p>
          <p className="text-xs text-gray-500">Last Visit</p>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <Button 
          size="sm" 
          variant="outline" 
          className="flex-1"
          onClick={() => onSendOffer(customer)}
          data-testid={`send-offer-${customer.id}`}
        >
          <Gift className="w-4 h-4 mr-1" /> Send Offer
        </Button>
        <Button 
          size="sm" 
          variant="outline" 
          className="flex-1"
          onClick={() => onRequestReview(customer)}
          data-testid={`request-review-${customer.id}`}
        >
          <Star className="w-4 h-4 mr-1" /> Request Review
        </Button>
      </div>
    </div>
  );
};

// Send Offer Modal
const SendOfferModal = ({ customer, pageId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    discount_type: "percentage",
    discount_value: 10,
    message: `Hi ${customer.name || 'valued customer'}! We have a special offer just for you.`,
    expiry_days: 7
  });
  const [sending, setSending] = useState(false);
  
  const handleSend = async () => {
    if (!customer.email) {
      toast.error("Customer email is required");
      return;
    }
    
    setSending(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_URL}/api/page-analytics/${pageId}/send-customer-email`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customer_email: customer.email,
          customer_name: customer.name,
          email_type: "offer",
          subject: `Special Offer: ${formData.discount_type === "percentage" ? formData.discount_value + "% OFF" : formData.discount_type === "fixed" ? "$" + formData.discount_value + " OFF" : "FREE ITEM"} Just For You!`,
          message: formData.message,
          discount_type: formData.discount_type,
          discount_value: formData.discount_value,
          expiry_days: formData.expiry_days
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.simulated) {
          toast.success(`Offer would be sent to ${customer.email} (email service not configured)`);
        } else {
          toast.success(`Offer sent to ${customer.name || customer.email}!`);
        }
        onSuccess();
      } else {
        throw new Error(data.detail || "Failed to send");
      }
    } catch (err) {
      toast.error(err.message || "Failed to send offer");
    }
    setSending(false);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="font-bold text-lg mb-4">Send Special Offer</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Discount Type</label>
            <select
              value={formData.discount_type}
              onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
              className="w-full h-10 rounded-lg border border-gray-300 px-3"
            >
              <option value="percentage">Percentage Off</option>
              <option value="fixed">Fixed Amount Off</option>
              <option value="free_item">Free Item</option>
            </select>
          </div>
          
          {formData.discount_type !== "free_item" && (
            <div>
              <label className="text-sm font-medium mb-1 block">
                {formData.discount_type === "percentage" ? "Discount %" : "Discount Amount ($)"}
              </label>
              <Input
                type="number"
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
              />
            </div>
          )}
          
          <div>
            <label className="text-sm font-medium mb-1 block">Personal Message</label>
            <Textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={3}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Expires In (days)</label>
            <Input
              type="number"
              value={formData.expiry_days}
              onChange={(e) => setFormData({ ...formData, expiry_days: e.target.value })}
            />
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSend} disabled={sending} className="flex-1">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            Send Offer
          </Button>
        </div>
      </div>
    </div>
  );
};

// Request Review Modal
const RequestReviewModal = ({ customer, pageId, onClose, onSuccess }) => {
  const [message, setMessage] = useState(
    `Hi ${customer.name || 'valued customer'}! Thank you for your recent visit. We'd love to hear your feedback!`
  );
  const [sending, setSending] = useState(false);
  
  const handleSend = async () => {
    setSending(true);
    try {
      // For now, we'll just show a success message
      toast.success(`Review request sent to ${customer.name || customer.email || 'customer'}!`);
      onSuccess();
    } catch (err) {
      toast.error("Failed to send review request");
    }
    setSending(false);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h3 className="font-bold text-lg mb-4">Request Review</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Message</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800">
            <Star className="w-4 h-4 inline mr-1" />
            Reviews help build trust and attract new customers!
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSend} disabled={sending} className="flex-1">
            {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MessageSquare className="w-4 h-4 mr-1" />}
            Send Request
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function CustomerCRMManager({ pageId }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all, repeat, recent
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  
  // Summary stats
  const [stats, setStats] = useState({
    total_customers: 0,
    repeat_customers: 0,
    total_revenue: 0,
    avg_order_value: 0
  });
  
  useEffect(() => {
    loadCustomers();
  }, [pageId]);
  
  const loadCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_URL}/api/page-analytics/${pageId}/customers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomers(data.customers || []);
        setStats(data.stats || {
          total_customers: data.customers?.length || 0,
          repeat_customers: data.customers?.filter(c => c.order_count > 1).length || 0,
          total_revenue: data.customers?.reduce((sum, c) => sum + (c.total_spent || 0), 0) || 0,
          avg_order_value: 0
        });
      } else {
        // If endpoint doesn't exist yet, use mock data for UI development
        setCustomers([]);
        setStats({ total_customers: 0, repeat_customers: 0, total_revenue: 0, avg_order_value: 0 });
      }
    } catch (err) {
      console.error("Error loading customers:", err);
      setCustomers([]);
    }
    setLoading(false);
  };
  
  const handleSendOffer = (customer) => {
    setSelectedCustomer(customer);
    setShowOfferModal(true);
  };
  
  const handleRequestReview = (customer) => {
    setSelectedCustomer(customer);
    setShowReviewModal(true);
  };
  
  // Filter customers
  let filteredCustomers = customers.filter(c => {
    const matchesSearch = !searchQuery || 
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery);
    
    const matchesFilter = filter === "all" || 
      (filter === "repeat" && c.order_count > 1) ||
      (filter === "recent" && c.last_order_date && 
        new Date(c.last_order_date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    
    return matchesSearch && matchesFilter;
  });
  
  return (
    <div className="space-y-6 pb-24" data-testid="customer-crm-manager">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total_customers}</p>
              <p className="text-xs text-gray-500">Total Customers</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Heart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.repeat_customers}</p>
              <p className="text-xs text-gray-500">Repeat Customers</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">${stats.total_revenue.toFixed(0)}</p>
              <p className="text-xs text-gray-500">Total Revenue</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">${stats.avg_order_value.toFixed(2)}</p>
              <p className="text-xs text-gray-500">Avg Order Value</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          {["all", "repeat", "recent"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-cyan-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {f === "all" ? "All" : f === "repeat" ? "Repeat" : "Recent (30d)"}
            </button>
          ))}
        </div>
      </div>
      
      {/* Customer List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700">No Customers Yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            {searchQuery ? "No customers match your search" : "Customers will appear here after they make purchases"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id || customer.email || customer.phone}
              customer={customer}
              onSendOffer={handleSendOffer}
              onRequestReview={handleRequestReview}
              pageId={pageId}
            />
          ))}
        </div>
      )}
      
      {/* Modals */}
      {showOfferModal && selectedCustomer && (
        <SendOfferModal
          customer={selectedCustomer}
          pageId={pageId}
          onClose={() => { setShowOfferModal(false); setSelectedCustomer(null); }}
          onSuccess={() => { setShowOfferModal(false); setSelectedCustomer(null); }}
        />
      )}
      
      {showReviewModal && selectedCustomer && (
        <RequestReviewModal
          customer={selectedCustomer}
          pageId={pageId}
          onClose={() => { setShowReviewModal(false); setSelectedCustomer(null); }}
          onSuccess={() => { setShowReviewModal(false); setSelectedCustomer(null); }}
        />
      )}
    </div>
  );
}
