/**
 * Orders Manager Component
 * Displays order history with filtering, status updates, refunds, and detailed views
 */

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  ShoppingBag, Clock, CheckCircle, XCircle, Truck, Package,
  Search, Filter, ChevronDown, ChevronRight, Calendar, DollarSign,
  User, Phone, MapPin, RefreshCw, Eye, Loader2, Receipt, RotateCcw,
  AlertTriangle
} from "lucide-react";
import { safeFetch } from "../../services/memberPagesApi";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Order Status Badge
const StatusBadge = ({ status }) => {
  const statusConfig = {
    pending: { color: "bg-yellow-100 text-yellow-700", icon: Clock, label: "Pending" },
    pending_payment: { color: "bg-orange-100 text-orange-700", icon: Clock, label: "Awaiting Payment" },
    confirmed: { color: "bg-blue-100 text-blue-700", icon: CheckCircle, label: "Confirmed" },
    preparing: { color: "bg-purple-100 text-purple-700", icon: Package, label: "Preparing" },
    ready: { color: "bg-cyan-100 text-cyan-700", icon: Package, label: "Ready" },
    out_for_delivery: { color: "bg-indigo-100 text-indigo-700", icon: Truck, label: "Out for Delivery" },
    completed: { color: "bg-green-100 text-green-700", icon: CheckCircle, label: "Completed" },
    cancelled: { color: "bg-red-100 text-red-700", icon: XCircle, label: "Cancelled" },
    payment_failed: { color: "bg-red-100 text-red-700", icon: XCircle, label: "Payment Failed" },
    refunded: { color: "bg-orange-100 text-orange-700", icon: RotateCcw, label: "Refunded" },
    partially_refunded: { color: "bg-amber-100 text-amber-700", icon: RotateCcw, label: "Partial Refund" }
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
};

// Order Type Badge
const OrderTypeBadge = ({ type }) => {
  const types = {
    pickup: { color: "bg-gray-100 text-gray-700", label: "Pickup" },
    dine_in: { color: "bg-blue-50 text-blue-700", label: "Dine In" },
    delivery: { color: "bg-purple-50 text-purple-700", label: "Delivery" },
    shipping: { color: "bg-indigo-50 text-indigo-700", label: "Shipping" }
  };

  const config = types[type] || types.pickup;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

// Refund Modal Component
const RefundModal = ({ order, onClose, onSuccess }) => {
  const [refundAmount, setRefundAmount] = useState(order.total);
  const [refundReason, setRefundReason] = useState("");
  const [isFullRefund, setIsFullRefund] = useState(true);
  const [processing, setProcessing] = useState(false);

  const platformFee = (refundAmount / order.total) * (order.platform_fee || order.total * 0.08);

  const handleRefund = async () => {
    if (!refundReason.trim()) {
      toast.error("Please provide a reason for the refund");
      return;
    }

    setProcessing(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const data = await safeFetch(`${API_URL}/api/pos/refund`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          order_id: order.order_id,
          amount: isFullRefund ? null : refundAmount,
          reason: refundReason
        })
      });

      toast.success(data.message || "Refund processed successfully");
      onSuccess();
    } catch (err) {
      toast.error(err.message || "Failed to process refund");
    }
    setProcessing(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
            <RotateCcw className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Process Refund</h3>
            <p className="text-sm text-gray-500">Order #{order.order_id.slice(-8)}</p>
          </div>
        </div>

        {/* Refund Type Selection */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => { setIsFullRefund(true); setRefundAmount(order.total); }}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
              isFullRefund 
                ? 'bg-orange-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Full Refund
          </button>
          <button
            onClick={() => setIsFullRefund(false)}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
              !isFullRefund 
                ? 'bg-orange-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Partial Refund
          </button>
        </div>

        {/* Refund Amount */}
        {!isFullRefund && (
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Refund Amount</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="number"
                step="0.01"
                max={order.total}
                value={refundAmount}
                onChange={(e) => setRefundAmount(Math.min(parseFloat(e.target.value) || 0, order.total))}
                className="pl-10 h-11 rounded-xl"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Max: ${order.total.toFixed(2)}</p>
          </div>
        )}

        {/* Refund Reason */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Reason for Refund *</label>
          <Textarea
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder="Enter reason for refund..."
            rows={3}
            className="rounded-xl"
          />
        </div>

        {/* Refund Summary */}
        <div className="bg-orange-50 rounded-xl p-4 mb-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Refund Amount</span>
            <span className="font-bold text-orange-700">${refundAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Platform Fee Credit (8%)</span>
            <span className="font-medium text-green-600">+${platformFee.toFixed(2)}</span>
          </div>
          <div className="pt-2 border-t border-orange-200 flex justify-between">
            <span className="text-gray-700 font-medium">Payment Method</span>
            <span className="font-bold text-gray-900 capitalize">{order.payment_method}</span>
          </div>
        </div>

        {/* Warning for cash refunds */}
        {order.payment_method === "cash" && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              Cash refund must be given to customer manually. This will be logged for accounting purposes.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl"
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRefund}
            disabled={processing || !refundReason.trim()}
            className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white"
          >
            {processing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Process Refund
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Order Detail Modal
const OrderDetailModal = ({ order, onClose, onUpdateStatus }) => {
  const [updating, setUpdating] = useState(false);

  const handleStatusUpdate = async (newStatus) => {
    setUpdating(true);
    await onUpdateStatus(order.order_id, newStatus);
    setUpdating(false);
  };

  const nextStatuses = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["out_for_delivery", "completed"],
    out_for_delivery: ["completed"],
    completed: [],
    cancelled: []
  };

  const availableStatuses = nextStatuses[order.status] || [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Order</p>
              <p className="text-xl font-bold">#{order.order_id}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Status & Type */}
          <div className="flex items-center justify-between">
            <StatusBadge status={order.status} />
            <OrderTypeBadge type={order.order_type} />
          </div>

          {/* Customer Info */}
          {(order.customer_name || order.customer_phone) && (
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="text-sm font-medium text-gray-500">Customer</p>
              {order.customer_name && (
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-4 h-4 text-gray-400" />
                  {order.customer_name}
                </div>
              )}
              {order.customer_phone && (
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {order.customer_phone}
                </div>
              )}
              {order.table_number && (
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  Table {order.table_number}
                </div>
              )}
            </div>
          )}

          {/* Items */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500">Items</p>
            <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
              {order.items?.map((item, i) => (
                <div key={i} className="p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-gray-800">{item.name}</p>
                    <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-medium text-gray-800">
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700">${order.subtotal?.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Discount</span>
                <span className="text-green-600">-${order.discount?.toFixed(2)}</span>
              </div>
            )}
            {order.tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax</span>
                <span className="text-gray-700">${order.tax?.toFixed(2)}</span>
              </div>
            )}
            {order.tip > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tip</span>
                <span className="text-gray-700">${order.tip?.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200">
              <span>Total</span>
              <span>${order.total?.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>Payment: {order.payment_method || "N/A"}</span>
            <span>{new Date(order.created_at).toLocaleString()}</span>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-yellow-50 rounded-xl p-3">
              <p className="text-sm font-medium text-yellow-700">Notes</p>
              <p className="text-sm text-yellow-600">{order.notes}</p>
            </div>
          )}

          {/* Status Actions */}
          {availableStatuses.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {availableStatuses.map(status => (
                  <Button
                    key={status}
                    size="sm"
                    variant={status === "cancelled" ? "destructive" : "outline"}
                    onClick={() => handleStatusUpdate(status)}
                    disabled={updating}
                    className="rounded-xl"
                  >
                    {updating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    {status.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function OrdersManager({ pageId, pageType }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [summary, setSummary] = useState(null);

  // Load orders - PRODUCTION FIX: Text-first pattern
  const loadOrders = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const res = await fetch(`${API_URL}/api/pos/${pageId}/transactions?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // PRODUCTION FIX: Read body as text first
      let responseText;
      try {
        responseText = await res.text();
      } catch (readError) {
        throw new Error("Failed to read server response");
      }

      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        throw new Error("Server returned invalid response");
      }

      if (!res.ok) throw new Error(data?.detail || "Failed to load orders");

      setOrders(data.transactions || []);
      setSummary(data.summary || null);
    } catch (err) {
      toast.error("Failed to load orders");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadOrders();
  }, [pageId]);

  // Update order status - PRODUCTION FIX: Text-first pattern
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const token = localStorage.getItem("blendlink_token");
      const res = await fetch(`${API_URL}/api/member-pages/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      // PRODUCTION FIX: Read body as text first
      let responseText;
      try {
        responseText = await res.text();
      } catch (readError) {
        throw new Error("Failed to read server response");
      }

      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        // Status update might return empty - that's OK
        data = { success: res.ok };
      }

      if (!res.ok) throw new Error(data?.detail || "Failed to update status");

      toast.success(`Order ${newStatus.replace(/_/g, " ")}`);
      loadOrders();
      setSelectedOrder(null);
    } catch (err) {
      toast.error("Failed to update order status");
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Status filter options
  const statusOptions = [
    { id: "all", label: "All Orders" },
    { id: "pending", label: "Pending" },
    { id: "confirmed", label: "Confirmed" },
    { id: "preparing", label: "Preparing" },
    { id: "ready", label: "Ready" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" }
  ];

  return (
    <div className="space-y-6" data-testid="orders-manager">
      {/* Header with Stats */}
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Order History</h3>
              <p className="text-sm text-gray-500">{orders.length} total orders</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadOrders}
            className="rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Quick Stats */}
        {summary && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">${summary.total_sales?.toFixed(2)}</p>
              <p className="text-xs text-green-600/70">Total Sales</p>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{summary.total_transactions}</p>
              <p className="text-xs text-blue-600/70">Transactions</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-purple-600">${summary.average_transaction?.toFixed(2)}</p>
              <p className="text-xs text-purple-600/70">Avg Order</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by order ID or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-xl border-gray-200 bg-white/80"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statusOptions.map(option => (
            <button
              key={option.id}
              onClick={() => setStatusFilter(option.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === option.id
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-500 mb-3" />
            <p className="text-gray-500">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white/50 rounded-2xl">
            <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No orders found</p>
            <p className="text-sm text-gray-400">
              {searchQuery || statusFilter !== "all" 
                ? "Try adjusting your filters" 
                : "Orders will appear here when customers make purchases"}
            </p>
          </div>
        ) : (
          filteredOrders.map(order => (
            <div
              key={order.order_id}
              className="bg-white rounded-xl border border-gray-100 hover:border-cyan-200 hover:shadow-lg transition-all overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900">#{order.order_id}</p>
                      <OrderTypeBadge type={order.order_type} />
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {/* Items Preview */}
                <div className="flex items-center gap-2 mb-3 text-sm text-gray-600">
                  <Receipt className="w-4 h-4 text-gray-400" />
                  <span>
                    {order.items?.length || 0} items: {order.items?.slice(0, 2).map(i => i.name).join(", ")}
                    {(order.items?.length || 0) > 2 && `... +${order.items.length - 2} more`}
                  </span>
                </div>

                {/* Customer & Total */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    {order.customer_name && (
                      <>
                        <User className="w-4 h-4" />
                        <span>{order.customer_name}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-gray-900">${order.total?.toFixed(2)}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedOrder(order)}
                      className="rounded-xl"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdateStatus={updateOrderStatus}
        />
      )}
    </div>
  );
}
