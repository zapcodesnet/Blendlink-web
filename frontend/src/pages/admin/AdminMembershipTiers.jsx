import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { adminAPI } from "./AdminLayout";
import { getApiUrl } from "../../utils/runtimeConfig";
import {
  Crown, Users, DollarSign, Coins, Gift, Edit2, Save, X,
  ChevronDown, ChevronUp, RefreshCw, Percent, Image, FileText,
  AlertTriangle, CheckCircle, Sparkles, Shield, Zap, Star
} from "lucide-react";

const API_BASE = getApiUrl();

// Tier colors and icons
const TIER_CONFIG = {
  free: { color: "from-gray-500 to-gray-600", icon: Users, label: "Free" },
  bronze: { color: "from-amber-600 to-amber-700", icon: Shield, label: "Bronze" },
  silver: { color: "from-gray-400 to-slate-500", icon: Star, label: "Silver" },
  gold: { color: "from-yellow-500 to-amber-500", icon: Crown, label: "Gold" },
  diamond: { color: "from-cyan-400 to-blue-500", icon: Sparkles, label: "Diamond" }
};

export default function AdminMembershipTiers() {
  const [activeTab, setActiveTab] = useState('tiers'); // 'tiers' | 'users'
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTier, setEditingTier] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [expandedTier, setExpandedTier] = useState(null);
  const [stats, setStats] = useState({ total: 0 });
  
  // Per-user management state
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userLoading, setUserLoading] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userEditForm, setUserEditForm] = useState({
    tier: 'free', custom_price: '', validity_type: '', validity_value: '', reason: '', immediately: true
  });
  const [userSaving, setUserSaving] = useState(false);

  const fetchTiers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/tiers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Failed to fetch tiers");
      
      const data = await response.json();
      setTiers(data.tiers || []);
      setStats({ total: data.total_active_subscriptions || 0 });
    } catch (error) {
      toast.error("Failed to load membership tiers");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  // === Per-User Management Functions ===
  const searchUsers = useCallback(async (search = userSearch, page = 1) => {
    setUserLoading(true);
    try {
      const data = await adminAPI(`${API_BASE}/api/admin/membership/users?search=${encodeURIComponent(search)}&page=${page}&limit=15`);
      setUserResults(data.users || []);
      setUserTotal(data.total || 0);
      setUserPage(page);
    } catch (e) {
      toast.error("Failed to search users");
    } finally {
      setUserLoading(false);
    }
  }, [userSearch]);

  const handleChangeTier = async () => {
    if (!editingUser) return;
    if (!confirm(`Change ${editingUser.email}'s tier to ${userEditForm.tier}?`)) return;
    setUserSaving(true);
    try {
      const data = await adminAPI(`${API_BASE}/api/admin/membership/users/${editingUser.user_id}/change-tier`, {
        method: 'POST',
        body: JSON.stringify({
          tier: userEditForm.tier,
          custom_price: userEditForm.custom_price ? parseFloat(userEditForm.custom_price) : null,
          validity_type: userEditForm.validity_type || null,
          validity_value: userEditForm.validity_value || null,
          reason: userEditForm.reason,
        })
      });
      toast.success(data.message || "Tier changed successfully");
      setEditingUser(null);
      searchUsers(userSearch, userPage);
    } catch (e) {
      toast.error(e.message || "Failed to change tier");
    } finally {
      setUserSaving(false);
    }
  };

  const handleCancelSubscription = async (userId, email) => {
    const immediately = confirm(`Cancel ${email}'s subscription IMMEDIATELY?\n\nOK = Cancel now\nCancel = Cancel at end of billing period`);
    const reason = prompt("Reason for cancellation (optional):");
    try {
      const data = await adminAPI(`${API_BASE}/api/admin/membership/users/${userId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ immediately, reason: reason || "" })
      });
      toast.success(data.message);
      searchUsers(userSearch, userPage);
    } catch (e) {
      toast.error(e.message || "Failed to cancel");
    }
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setUserEditForm({
      tier: user.subscription_tier || 'free',
      custom_price: user.custom_price || '',
      validity_type: user.validity_type || '',
      validity_value: user.validity_value || '',
      reason: '',
      immediately: true,
    });
  };

  const handleEdit = (tier) => {
    setEditingTier(tier.tier_id);
    setEditForm({
      daily_mint_limit: tier.daily_mint_limit,
      daily_bl_bonus: tier.daily_bl_bonus,
      xp_multiplier: tier.xp_multiplier,
      max_member_pages: tier.max_member_pages,
      commission_l1_rate: tier.commission_l1_rate * 100,
      commission_l2_rate: tier.commission_l2_rate * 100,
      price_monthly: tier.price_monthly
    });
  };

  const handleSave = async (tierId) => {
    setSaving(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/tiers/${tierId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tier_id: tierId,
          daily_mint_limit: parseInt(editForm.daily_mint_limit),
          daily_bl_bonus: parseInt(editForm.daily_bl_bonus),
          xp_multiplier: parseInt(editForm.xp_multiplier),
          max_member_pages: parseInt(editForm.max_member_pages),
          commission_l1_rate: parseFloat(editForm.commission_l1_rate) / 100,
          commission_l2_rate: parseFloat(editForm.commission_l2_rate) / 100,
          price_monthly: parseFloat(editForm.price_monthly)
        })
      });

      if (!response.ok) throw new Error("Failed to save tier");

      toast.success(`${tierId} tier updated successfully`);
      setEditingTier(null);
      fetchTiers();
    } catch (error) {
      toast.error("Failed to save tier changes");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOverride = async (tierId) => {
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/tiers/${tierId}/override`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Failed to remove override");

      toast.success(`Override removed for ${tierId} tier`);
      fetchTiers();
    } catch (error) {
      toast.error("Failed to remove override");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Membership Tiers</h2>
          <p className="text-slate-400 mt-1">
            Manage tier benefits, pricing, and individual user memberships
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-slate-800 rounded-lg px-4 py-2">
            <p className="text-sm text-slate-400">Total Active Subscribers</p>
            <p className="text-2xl font-bold text-white">{stats.total.toLocaleString()}</p>
          </div>
          <Button onClick={activeTab === 'tiers' ? fetchTiers : () => searchUsers()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <button onClick={() => setActiveTab('tiers')} className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${activeTab === 'tiers' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
          <Crown className="w-4 h-4 inline mr-2" />Tier Configuration
        </button>
        <button onClick={() => { setActiveTab('users'); if (userResults.length === 0) searchUsers('', 1); }} className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${activeTab === 'users' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
          <Users className="w-4 h-4 inline mr-2" />Manage User Memberships
        </button>
      </div>

      {/* Tab: Tier Configuration */}
      {activeTab === 'tiers' && (
      <>
      {/* Tier Cards */}
      <div className="grid gap-4">
        {tiers.map((tier) => {
          const config = TIER_CONFIG[tier.tier_id] || TIER_CONFIG.free;
          const TierIcon = config.icon;
          const isEditing = editingTier === tier.tier_id;
          const isExpanded = expandedTier === tier.tier_id;

          return (
            <div
              key={tier.tier_id}
              className={`bg-slate-800 rounded-xl border ${
                tier.has_override ? "border-yellow-500/50" : "border-slate-700"
              } overflow-hidden`}
            >
              {/* Tier Header */}
              <div
                className={`bg-gradient-to-r ${config.color} p-4 cursor-pointer`}
                onClick={() => setExpandedTier(isExpanded ? null : tier.tier_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <TierIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        {config.label}
                        {tier.has_override && (
                          <Badge className="bg-yellow-500/20 text-yellow-300 text-xs">
                            Custom Override
                          </Badge>
                        )}
                      </h3>
                      <p className="text-white/80 text-sm">
                        {tier.active_subscribers.toLocaleString()} active subscribers
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">
                        ${tier.price_monthly.toFixed(2)}
                      </p>
                      <p className="text-white/70 text-sm">/month</p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-6 h-6 text-white" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-white" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="p-6 space-y-6">
                  {/* Benefits Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Daily Mint Limit */}
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Image className="w-4 h-4" />
                        <span className="text-sm">Daily Mints</span>
                      </div>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editForm.daily_mint_limit}
                          onChange={(e) => setEditForm({ ...editForm, daily_mint_limit: e.target.value })}
                          className="bg-slate-600 border-slate-500"
                        />
                      ) : (
                        <p className="text-xl font-bold text-white">
                          {tier.daily_mint_limit >= 999999 ? "Unlimited" : tier.daily_mint_limit}
                        </p>
                      )}
                    </div>

                    {/* Daily BL Bonus */}
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Coins className="w-4 h-4" />
                        <span className="text-sm">Daily BL Bonus</span>
                      </div>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editForm.daily_bl_bonus}
                          onChange={(e) => setEditForm({ ...editForm, daily_bl_bonus: e.target.value })}
                          className="bg-slate-600 border-slate-500"
                        />
                      ) : (
                        <p className="text-xl font-bold text-white">
                          {tier.daily_bl_bonus.toLocaleString()}
                        </p>
                      )}
                    </div>

                    {/* XP Multiplier */}
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <Zap className="w-4 h-4" />
                        <span className="text-sm">XP Multiplier</span>
                      </div>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editForm.xp_multiplier}
                          onChange={(e) => setEditForm({ ...editForm, xp_multiplier: e.target.value })}
                          className="bg-slate-600 border-slate-500"
                        />
                      ) : (
                        <p className="text-xl font-bold text-white">
                          {tier.xp_multiplier}x
                        </p>
                      )}
                    </div>

                    {/* Max Pages */}
                    <div className="bg-slate-700/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">Member Pages</span>
                      </div>
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editForm.max_member_pages}
                          onChange={(e) => setEditForm({ ...editForm, max_member_pages: e.target.value })}
                          className="bg-slate-600 border-slate-500"
                        />
                      ) : (
                        <p className="text-xl font-bold text-white">
                          {tier.max_member_pages >= 999999 ? "Unlimited" : tier.max_member_pages}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Commission Rates */}
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                      <Percent className="w-5 h-5 text-green-400" />
                      Commission Rates
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-400 mb-2">Level 1 (Direct Recruits)</p>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.1"
                              value={editForm.commission_l1_rate}
                              onChange={(e) => setEditForm({ ...editForm, commission_l1_rate: e.target.value })}
                              className="bg-slate-600 border-slate-500"
                            />
                            <span className="text-white">%</span>
                          </div>
                        ) : (
                          <p className="text-2xl font-bold text-green-400">
                            {(tier.commission_l1_rate * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-slate-400 mb-2">Level 2 (Indirect Recruits)</p>
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.1"
                              value={editForm.commission_l2_rate}
                              onChange={(e) => setEditForm({ ...editForm, commission_l2_rate: e.target.value })}
                              className="bg-slate-600 border-slate-500"
                            />
                            <span className="text-white">%</span>
                          </div>
                        ) : (
                          <p className="text-2xl font-bold text-green-400">
                            {(tier.commission_l2_rate * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <h4 className="font-semibold text-white mb-3">Features</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {tier.features?.map((feature, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-300 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                    {tier.has_override && !isEditing && (
                      <Button
                        variant="outline"
                        onClick={() => handleRemoveOverride(tier.tier_id)}
                        className="text-yellow-400 border-yellow-400/50 hover:bg-yellow-400/10"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Remove Override
                      </Button>
                    )}
                    {isEditing ? (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setEditingTier(null)}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleSave(tier.tier_id)}
                          disabled={saving}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {saving ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Save Changes
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => handleEdit(tier)}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Edit Tier
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
