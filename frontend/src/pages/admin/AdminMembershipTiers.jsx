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

// Admin-authenticated fetch that sends the user's JWT token
const adminFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const response = await fetch(`${API_BASE}/api${endpoint}`, { ...options, headers, cache: 'no-store' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${response.status}`);
  }
  return response.json();
};

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
      </>
      )}

      {/* Tab: Manage User Memberships */}
      {activeTab === 'users' && (
      <div className="space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Search by email, username, name, or user ID..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchUsers(userSearch, 1)}
            className="bg-slate-800 border-slate-700 text-white"
          />
          <Button onClick={() => searchUsers(userSearch, 1)} disabled={userLoading}>
            {userLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
          </Button>
        </div>

        {/* Results */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Tier</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Price</th>
                  <th className="px-4 py-3 text-left">Expires</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {userResults.map((u) => {
                  const tc = TIER_CONFIG[u.subscription_tier] || TIER_CONFIG.free;
                  return (
                    <tr key={u.user_id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{u.name || u.username}</p>
                        <p className="text-slate-400 text-xs">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`bg-gradient-to-r ${tc.color} text-white border-0`}>{tc.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${u.subscription_status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'}`}>
                          {u.subscription_status || 'none'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{u.custom_price ? `$${u.custom_price}` : 'Default'}</td>
                      <td className="px-4 py-3 text-slate-300 text-xs">{u.expires_at ? new Date(u.expires_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => openEditUser(u)} className="text-xs h-7">
                            <Edit2 className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          {u.subscription_tier !== 'free' && (
                            <Button size="sm" variant="outline" onClick={() => handleCancelSubscription(u.user_id, u.email)} className="text-xs h-7 border-red-500/50 text-red-400 hover:bg-red-500/10">
                              <X className="w-3 h-3 mr-1" /> Cancel
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {userResults.length === 0 && !userLoading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No users found. Search above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {userTotal > 15 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <span className="text-sm text-slate-400">Page {userPage} of {Math.ceil(userTotal / 15)}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={userPage <= 1} onClick={() => searchUsers(userSearch, userPage - 1)}>Prev</Button>
                <Button size="sm" variant="outline" disabled={userPage >= Math.ceil(userTotal / 15)} onClick={() => searchUsers(userSearch, userPage + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setEditingUser(null)}>
            <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-white">Edit Membership — {editingUser.name || editingUser.email}</h3>
              <p className="text-sm text-slate-400">{editingUser.email} ({editingUser.user_id})</p>
              
              {/* Tier Select */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Membership Tier</label>
                <select value={userEditForm.tier} onChange={(e) => setUserEditForm({...userEditForm, tier: e.target.value})} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                  <option value="free">Free</option>
                  <option value="bronze">Bronze ($4.99/mo)</option>
                  <option value="silver">Silver ($9.99/mo)</option>
                  <option value="gold">Gold ($14.99/mo)</option>
                  <option value="diamond">Diamond ($29.99/mo)</option>
                </select>
              </div>
              
              {/* Custom Price */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Custom Price (USD, optional)</label>
                <Input type="number" min="0" step="0.01" placeholder="Leave blank for default" value={userEditForm.custom_price} onChange={(e) => setUserEditForm({...userEditForm, custom_price: e.target.value})} className="bg-slate-700 border-slate-600 text-white" />
              </div>
              
              {/* Validity */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Validity</label>
                <select value={userEditForm.validity_type} onChange={(e) => setUserEditForm({...userEditForm, validity_type: e.target.value, validity_value: ''})} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white mb-2">
                  <option value="">Default (monthly recurring)</option>
                  <option value="months"># of Months</option>
                  <option value="years"># of Years</option>
                  <option value="forever">Forever (Lifetime)</option>
                  <option value="date">Until Specific Date</option>
                </select>
                {(userEditForm.validity_type === 'months' || userEditForm.validity_type === 'years') && (
                  <Input type="number" min="1" placeholder={userEditForm.validity_type === 'months' ? 'Number of months' : 'Number of years'} value={userEditForm.validity_value} onChange={(e) => setUserEditForm({...userEditForm, validity_value: e.target.value})} className="bg-slate-700 border-slate-600 text-white" />
                )}
                {userEditForm.validity_type === 'date' && (
                  <Input type="date" value={userEditForm.validity_value} onChange={(e) => setUserEditForm({...userEditForm, validity_value: e.target.value})} className="bg-slate-700 border-slate-600 text-white" />
                )}
              </div>
              
              {/* Reason */}
              <div>
                <label className="block text-sm text-slate-300 mb-1">Reason (for audit log)</label>
                <Input placeholder="Optional reason" value={userEditForm.reason} onChange={(e) => setUserEditForm({...userEditForm, reason: e.target.value})} className="bg-slate-700 border-slate-600 text-white" />
              </div>
              
              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleChangeTier} disabled={userSaving} className="flex-1 bg-blue-600 hover:bg-blue-700">
                  {userSaving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
                <Button onClick={() => setEditingUser(null)} variant="outline" className="flex-1">Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
