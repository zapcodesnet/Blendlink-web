import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import {
  Tag, Plus, Trash2, Edit2, Save, X, RefreshCw, Copy,
  Calendar, Users, Percent, DollarSign, Coins, CheckCircle,
  XCircle, Clock, Gift
} from "lucide-react";

const API_BASE = getApiUrl();

export default function AdminPromoCodes() {
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCode, setEditingCode] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: 10,
    max_uses: "",
    valid_until: "",
    applicable_tiers: ["bronze", "silver", "gold", "diamond"],
    is_active: true,
    description: ""
  });

  const fetchPromoCodes = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/promo-codes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Failed to fetch promo codes");
      
      const data = await response.json();
      setPromoCodes(data.promo_codes || []);
    } catch (error) {
      toast.error("Failed to load promo codes");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromoCodes();
  }, [fetchPromoCodes]);

  const resetForm = () => {
    setForm({
      code: "",
      discount_type: "percentage",
      discount_value: 10,
      max_uses: "",
      valid_until: "",
      applicable_tiers: ["bronze", "silver", "gold", "diamond"],
      is_active: true,
      description: ""
    });
  };

  const handleCreate = async () => {
    if (!form.code) {
      toast.error("Promo code is required");
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/promo-codes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          max_uses: form.max_uses ? parseInt(form.max_uses) : null
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Failed to create promo code");
      }

      toast.success("Promo code created successfully");
      setShowCreateModal(false);
      resetForm();
      fetchPromoCodes();
    } catch (error) {
      toast.error(error.message);
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (code) => {
    setSaving(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/promo-codes/${code}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          max_uses: form.max_uses ? parseInt(form.max_uses) : null
        })
      });

      if (!response.ok) throw new Error("Failed to update promo code");

      toast.success("Promo code updated successfully");
      setEditingCode(null);
      resetForm();
      fetchPromoCodes();
    } catch (error) {
      toast.error("Failed to update promo code");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (code) => {
    if (!window.confirm(`Are you sure you want to delete promo code "${code}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/promo-codes/${code}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("Failed to delete promo code");

      toast.success("Promo code deleted");
      fetchPromoCodes();
    } catch (error) {
      toast.error("Failed to delete promo code");
      console.error(error);
    }
  };

  const handleEdit = (promoCode) => {
    setEditingCode(promoCode.code);
    setForm({
      code: promoCode.code,
      discount_type: promoCode.discount_type,
      discount_value: promoCode.discount_value,
      max_uses: promoCode.max_uses?.toString() || "",
      valid_until: promoCode.valid_until || "",
      applicable_tiers: promoCode.applicable_tiers || ["bronze", "silver", "gold", "diamond"],
      is_active: promoCode.is_active,
      description: promoCode.description || ""
    });
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  const toggleTier = (tier) => {
    setForm(prev => ({
      ...prev,
      applicable_tiers: prev.applicable_tiers.includes(tier)
        ? prev.applicable_tiers.filter(t => t !== tier)
        : [...prev.applicable_tiers, tier]
    }));
  };

  const getDiscountDisplay = (promoCode) => {
    switch (promoCode.discount_type) {
      case "percentage":
        return `${promoCode.discount_value}% off`;
      case "fixed":
        return `$${promoCode.discount_value} off`;
      case "bl_coins":
        return `${promoCode.discount_value.toLocaleString()} BL coins`;
      default:
        return promoCode.discount_value;
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
          <h2 className="text-2xl font-bold text-white">Promo Codes</h2>
          <p className="text-slate-400 mt-1">
            Create and manage promotional codes for subscriptions
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchPromoCodes} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Code
          </Button>
        </div>
      </div>

      {/* Promo Codes List */}
      <div className="grid gap-4">
        {promoCodes.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <Gift className="w-16 h-16 mx-auto mb-4 text-slate-600" />
            <h3 className="text-xl font-semibold text-white mb-2">No Promo Codes</h3>
            <p className="text-slate-400 mb-4">Create your first promo code to offer discounts</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Code
            </Button>
          </div>
        ) : (
          promoCodes.map((promoCode) => {
            const isEditing = editingCode === promoCode.code;
            const isExpired = promoCode.valid_until && new Date(promoCode.valid_until) < new Date();
            const isMaxed = promoCode.max_uses && promoCode.usage_count >= promoCode.max_uses;

            return (
              <div
                key={promoCode.code}
                className={`bg-slate-800 rounded-xl border ${
                  !promoCode.is_active || isExpired || isMaxed
                    ? "border-slate-700 opacity-60"
                    : "border-green-500/30"
                } overflow-hidden`}
              >
                {isEditing ? (
                  /* Edit Form */
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-slate-400">Code</label>
                        <Input
                          value={form.code}
                          disabled
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">Discount Type</label>
                        <select
                          value={form.discount_type}
                          onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                          className="w-full h-10 bg-slate-700 border border-slate-600 rounded-md px-3 text-white"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount ($)</option>
                          <option value="bl_coins">BL Coins</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm text-slate-400">Discount Value</label>
                        <Input
                          type="number"
                          value={form.discount_value}
                          onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) })}
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">Max Uses (blank = unlimited)</label>
                        <Input
                          type="number"
                          value={form.max_uses}
                          onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                          className="bg-slate-700 border-slate-600"
                          placeholder="Unlimited"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400">Valid Until</label>
                        <Input
                          type="datetime-local"
                          value={form.valid_until?.slice(0, 16) || ""}
                          onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                          className="bg-slate-700 border-slate-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">Applicable Tiers</label>
                      <div className="flex gap-2">
                        {["bronze", "silver", "gold", "diamond"].map((tier) => (
                          <button
                            key={tier}
                            onClick={() => toggleTier(tier)}
                            className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${
                              form.applicable_tiers.includes(tier)
                                ? "bg-blue-500 text-white"
                                : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                            }`}
                          >
                            {tier}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm text-slate-400">Description</label>
                      <Input
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="bg-slate-700 border-slate-600"
                        placeholder="Internal note about this promo code"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`active-${promoCode.code}`}
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                      <label htmlFor={`active-${promoCode.code}`} className="text-white">
                        Active
                      </label>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingCode(null);
                          resetForm();
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleUpdate(promoCode.code)}
                        disabled={saving}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Display View */
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          promoCode.is_active && !isExpired && !isMaxed
                            ? "bg-green-500/20"
                            : "bg-slate-700"
                        }`}
                      >
                        <Tag className={`w-6 h-6 ${
                          promoCode.is_active && !isExpired && !isMaxed
                            ? "text-green-400"
                            : "text-slate-500"
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono font-bold text-xl text-white">
                            {promoCode.code}
                          </h3>
                          <button
                            onClick={() => copyCode(promoCode.code)}
                            className="p-1 hover:bg-slate-700 rounded"
                          >
                            <Copy className="w-4 h-4 text-slate-400" />
                          </button>
                          {!promoCode.is_active && (
                            <Badge variant="secondary" className="bg-slate-700 text-slate-400">
                              Inactive
                            </Badge>
                          )}
                          {isExpired && (
                            <Badge variant="destructive" className="bg-red-500/20 text-red-400">
                              Expired
                            </Badge>
                          )}
                          {isMaxed && (
                            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                              Max Used
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                          <span className="flex items-center gap-1">
                            {promoCode.discount_type === "percentage" && <Percent className="w-4 h-4" />}
                            {promoCode.discount_type === "fixed" && <DollarSign className="w-4 h-4" />}
                            {promoCode.discount_type === "bl_coins" && <Coins className="w-4 h-4" />}
                            {getDiscountDisplay(promoCode)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {promoCode.usage_count || 0}
                            {promoCode.max_uses ? ` / ${promoCode.max_uses}` : ""} uses
                          </span>
                          {promoCode.valid_until && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              Until {new Date(promoCode.valid_until).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(promoCode)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(promoCode.code)}
                        className="text-red-400 border-red-400/50 hover:bg-red-400/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-xl font-bold text-white">Create Promo Code</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm text-slate-400">Code</label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="bg-slate-700 border-slate-600 font-mono"
                  placeholder="SUMMER2026"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Discount Type</label>
                  <select
                    value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
                    className="w-full h-10 bg-slate-700 border border-slate-600 rounded-md px-3 text-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                    <option value="bl_coins">BL Coins</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Discount Value</label>
                  <Input
                    type="number"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: parseFloat(e.target.value) })}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Max Uses (blank = unlimited)</label>
                  <Input
                    type="number"
                    value={form.max_uses}
                    onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                    className="bg-slate-700 border-slate-600"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400">Valid Until</label>
                  <Input
                    type="datetime-local"
                    value={form.valid_until}
                    onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    className="bg-slate-700 border-slate-600"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Applicable Tiers</label>
                <div className="flex gap-2">
                  {["bronze", "silver", "gold", "diamond"].map((tier) => (
                    <button
                      key={tier}
                      onClick={() => toggleTier(tier)}
                      className={`px-3 py-1 rounded-full text-sm font-medium capitalize transition-colors ${
                        form.applicable_tiers.includes(tier)
                          ? "bg-blue-500 text-white"
                          : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm text-slate-400">Description (optional)</label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-slate-700 border-slate-600"
                  placeholder="Internal note about this promo code"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving || !form.code}
                className="bg-green-600 hover:bg-green-700"
              >
                {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Code
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
