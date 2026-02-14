import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import {
  DollarSign, Settings, RefreshCw, Search, User, AlertTriangle,
  CheckCircle, Clock, TrendingUp, TrendingDown, Percent, Globe,
  History, Edit2, Save, X, Plus, Trash2, Calendar, Info
} from "lucide-react";

const API_BASE = getApiUrl();

export default function AdminCommissionControls() {
  const [activeTab, setActiveTab] = useState("adjustments");
  const [loading, setLoading] = useState(false);
  const [adjustments, setAdjustments] = useState([]);
  const [globalOverride, setGlobalOverride] = useState(null);
  const [overrideHistory, setOverrideHistory] = useState([]);
  
  // Adjustment form state
  const [adjustmentForm, setAdjustmentForm] = useState({
    user_id: "",
    transaction_id: "",
    adjustment_type: "percentage",
    adjustment_value: 0,
    reason: "",
    notify_user: true,
    apply_to_future: false
  });
  
  // Global override form state
  const [globalForm, setGlobalForm] = useState({
    l1_rate_override: "",
    l2_rate_override: "",
    affected_tiers: ["free", "bronze", "silver", "gold", "diamond"],
    reason: "",
    expires_at: ""
  });
  
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [searchUserId, setSearchUserId] = useState("");

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const url = searchUserId 
        ? `${API_BASE}/api/admin/membership/commissions/adjustments?user_id=${searchUserId}`
        : `${API_BASE}/api/admin/membership/commissions/adjustments`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Failed to fetch adjustments");
      
      const data = await response.json();
      setAdjustments(data.adjustments || []);
    } catch (error) {
      toast.error("Failed to load commission adjustments");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [searchUserId]);

  const fetchGlobalOverride = useCallback(async () => {
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/commissions/global-override`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      setGlobalOverride(data.active_override);
      setOverrideHistory(data.history || []);
    } catch (error) {
      console.error("Failed to fetch global override:", error);
    }
  }, []);

  useEffect(() => {
    fetchAdjustments();
    fetchGlobalOverride();
  }, [fetchAdjustments, fetchGlobalOverride]);

  const handleCreateAdjustment = async () => {
    if (!adjustmentForm.reason.trim()) {
      toast.error("Please provide a reason for the adjustment");
      return;
    }
    
    if (!adjustmentForm.user_id && !adjustmentForm.transaction_id) {
      toast.error("Please provide either a user ID or transaction ID");
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/commissions/adjust`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(adjustmentForm)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create adjustment");
      }
      
      toast.success("Commission adjustment applied successfully");
      setShowAdjustmentModal(false);
      setAdjustmentForm({
        user_id: "",
        transaction_id: "",
        adjustment_type: "percentage",
        adjustment_value: 0,
        reason: "",
        notify_user: true,
        apply_to_future: false
      });
      fetchAdjustments();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGlobalOverride = async () => {
    if (!globalForm.reason.trim()) {
      toast.error("Please provide a reason for the global override");
      return;
    }
    
    if (!globalForm.l1_rate_override && !globalForm.l2_rate_override) {
      toast.error("Please provide at least one rate override");
      return;
    }
    
    setLoading(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/commissions/global-override`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...globalForm,
          l1_rate_override: globalForm.l1_rate_override ? parseFloat(globalForm.l1_rate_override) / 100 : null,
          l2_rate_override: globalForm.l2_rate_override ? parseFloat(globalForm.l2_rate_override) / 100 : null
        })
      });
      
      if (!response.ok) throw new Error("Failed to create global override");
      
      toast.success("Global commission override applied");
      setShowGlobalModal(false);
      setGlobalForm({
        l1_rate_override: "",
        l2_rate_override: "",
        affected_tiers: ["free", "bronze", "silver", "gold", "diamond"],
        reason: "",
        expires_at: ""
      });
      fetchGlobalOverride();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveGlobalOverride = async (overrideId) => {
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/commissions/global-override/${overrideId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Failed to remove override");
      
      toast.success("Global override removed");
      fetchGlobalOverride();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6" data-testid="admin-commission-controls">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-7 h-7 text-blue-400" />
            Commission Controls
          </h2>
          <p className="text-slate-400 mt-1">
            Real-time commission adjustments and global rate overrides
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchAdjustments} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Active Global Override Alert */}
      {globalOverride && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow-400">
              <Globe className="w-5 h-5" />
              <span className="font-medium">Global Override Active</span>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => handleRemoveGlobalOverride(globalOverride.override_id)}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Remove
            </Button>
          </div>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {globalOverride.l1_rate_override && (
              <div>
                <span className="text-slate-400">L1 Rate:</span>
                <span className="ml-2 text-white">{(globalOverride.l1_rate_override * 100).toFixed(1)}%</span>
              </div>
            )}
            {globalOverride.l2_rate_override && (
              <div>
                <span className="text-slate-400">L2 Rate:</span>
                <span className="ml-2 text-white">{(globalOverride.l2_rate_override * 100).toFixed(1)}%</span>
              </div>
            )}
            <div>
              <span className="text-slate-400">Reason:</span>
              <span className="ml-2 text-white">{globalOverride.reason}</span>
            </div>
            {globalOverride.expires_at && (
              <div>
                <span className="text-slate-400">Expires:</span>
                <span className="ml-2 text-white">{formatDate(globalOverride.expires_at)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <Button
          variant={activeTab === "adjustments" ? "default" : "ghost"}
          onClick={() => setActiveTab("adjustments")}
          size="sm"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Individual Adjustments
        </Button>
        <Button
          variant={activeTab === "global" ? "default" : "ghost"}
          onClick={() => setActiveTab("global")}
          size="sm"
        >
          <Globe className="w-4 h-4 mr-2" />
          Global Overrides
        </Button>
      </div>

      {/* Individual Adjustments Tab */}
      {activeTab === "adjustments" && (
        <div className="space-y-4">
          {/* Actions Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by user ID..."
                  value={searchUserId}
                  onChange={(e) => setSearchUserId(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700"
                />
              </div>
              <Button onClick={fetchAdjustments} variant="outline" size="sm">
                Search
              </Button>
            </div>
            <Button onClick={() => setShowAdjustmentModal(true)} data-testid="new-adjustment-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Adjustment
            </Button>
          </div>

          {/* Adjustments Table */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900/50">
                    <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Date</th>
                    <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">User/Transaction</th>
                    <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Type</th>
                    <th className="text-right px-4 py-3 text-slate-400 text-sm font-medium">Value</th>
                    <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Reason</th>
                    <th className="text-center px-4 py-3 text-slate-400 text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No adjustments found
                      </td>
                    </tr>
                  ) : (
                    adjustments.map((adj) => (
                      <tr key={adj.adjustment_id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-slate-300 text-sm">
                          {formatDate(adj.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-white text-sm">
                              {adj.user_id || adj.transaction_id || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={`capitalize ${
                            adj.adjustment_type === "percentage" ? "bg-blue-500/20 text-blue-300" :
                            adj.adjustment_type === "fixed" ? "bg-green-500/20 text-green-300" :
                            "bg-purple-500/20 text-purple-300"
                          }`}>
                            {adj.adjustment_type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={adj.adjustment_value >= 0 ? "text-green-400" : "text-red-400"}>
                            {adj.adjustment_type === "percentage" 
                              ? `${adj.adjustment_value > 0 ? "+" : ""}${adj.adjustment_value}%`
                              : `${adj.adjustment_value > 0 ? "+" : ""}$${adj.adjustment_value.toFixed(2)}`
                            }
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-sm max-w-xs truncate">
                          {adj.reason}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className="bg-green-500/20 text-green-300">
                            {adj.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Global Overrides Tab */}
      {activeTab === "global" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowGlobalModal(true)} data-testid="new-global-override-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Global Override
            </Button>
          </div>

          {/* Override History */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-slate-400" />
                Override History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900/50">
                    <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Created</th>
                    <th className="text-center px-4 py-3 text-slate-400 text-sm font-medium">L1 Rate</th>
                    <th className="text-center px-4 py-3 text-slate-400 text-sm font-medium">L2 Rate</th>
                    <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Tiers</th>
                    <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">Reason</th>
                    <th className="text-center px-4 py-3 text-slate-400 text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {overrideHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No override history
                      </td>
                    </tr>
                  ) : (
                    overrideHistory.map((override) => (
                      <tr key={override.override_id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-slate-300 text-sm">
                          {formatDate(override.created_at)}
                        </td>
                        <td className="px-4 py-3 text-center text-white">
                          {override.l1_rate_override ? `${(override.l1_rate_override * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-center text-white">
                          {override.l2_rate_override ? `${(override.l2_rate_override * 100).toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {override.affected_tiers?.map((tier) => (
                              <Badge key={tier} className="text-xs capitalize bg-slate-700 text-slate-300">
                                {tier}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-sm max-w-xs truncate">
                          {override.reason}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={override.is_active 
                            ? "bg-green-500/20 text-green-300" 
                            : "bg-slate-500/20 text-slate-400"
                          }>
                            {override.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* New Adjustment Modal */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg p-6 m-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-400" />
              New Commission Adjustment
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">User ID</label>
                  <Input
                    placeholder="user_xxx..."
                    value={adjustmentForm.user_id}
                    onChange={(e) => setAdjustmentForm({...adjustmentForm, user_id: e.target.value})}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Transaction ID</label>
                  <Input
                    placeholder="txn_xxx..."
                    value={adjustmentForm.transaction_id}
                    onChange={(e) => setAdjustmentForm({...adjustmentForm, transaction_id: e.target.value})}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Adjustment Type</label>
                  <select
                    value={adjustmentForm.adjustment_type}
                    onChange={(e) => setAdjustmentForm({...adjustmentForm, adjustment_type: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="percentage">Percentage (+/-)</option>
                    <option value="fixed">Fixed Amount (+/-)</option>
                    <option value="override">Override Value</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Value</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={adjustmentForm.adjustment_type === "percentage" ? "e.g., 10 or -5" : "e.g., 25.00"}
                    value={adjustmentForm.adjustment_value}
                    onChange={(e) => setAdjustmentForm({...adjustmentForm, adjustment_value: parseFloat(e.target.value) || 0})}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Reason</label>
                <textarea
                  placeholder="Enter reason for adjustment..."
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({...adjustmentForm, reason: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500"
                  rows={2}
                />
              </div>
              
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adjustmentForm.notify_user}
                    onChange={(e) => setAdjustmentForm({...adjustmentForm, notify_user: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-slate-300 text-sm">Notify User</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adjustmentForm.apply_to_future}
                    onChange={(e) => setAdjustmentForm({...adjustmentForm, apply_to_future: e.target.checked})}
                    className="rounded"
                  />
                  <span className="text-slate-300 text-sm">Apply to Future Commissions</span>
                </label>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowAdjustmentModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAdjustment} disabled={loading}>
                {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Apply Adjustment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Global Override Modal */}
      {showGlobalModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg p-6 m-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-yellow-400" />
              New Global Commission Override
            </h3>
            
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2 text-yellow-400 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>This will override commission rates for all selected tiers. Any existing global override will be deactivated.</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">L1 Rate Override (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 5"
                    value={globalForm.l1_rate_override}
                    onChange={(e) => setGlobalForm({...globalForm, l1_rate_override: e.target.value})}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">L2 Rate Override (%)</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g., 3"
                    value={globalForm.l2_rate_override}
                    onChange={(e) => setGlobalForm({...globalForm, l2_rate_override: e.target.value})}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Affected Tiers</label>
                <div className="flex flex-wrap gap-2">
                  {["free", "bronze", "silver", "gold", "diamond"].map((tier) => (
                    <label key={tier} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={globalForm.affected_tiers.includes(tier)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setGlobalForm({...globalForm, affected_tiers: [...globalForm.affected_tiers, tier]});
                          } else {
                            setGlobalForm({...globalForm, affected_tiers: globalForm.affected_tiers.filter(t => t !== tier)});
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-slate-300 text-sm capitalize">{tier}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Expires At (optional)</label>
                <Input
                  type="datetime-local"
                  value={globalForm.expires_at}
                  onChange={(e) => setGlobalForm({...globalForm, expires_at: e.target.value})}
                  className="bg-slate-900 border-slate-700"
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Reason</label>
                <textarea
                  placeholder="Enter reason for global override..."
                  value={globalForm.reason}
                  onChange={(e) => setGlobalForm({...globalForm, reason: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowGlobalModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateGlobalOverride} disabled={loading} className="bg-yellow-600 hover:bg-yellow-700">
                {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />}
                Apply Override
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
