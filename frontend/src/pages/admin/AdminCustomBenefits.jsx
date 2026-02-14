import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import {
  Gift, Plus, Edit2, Trash2, Save, X, RefreshCw, Search,
  Star, Zap, Image, FileText, Percent, Users, Crown, Shield,
  ChevronDown, ChevronUp, Sparkles, CheckCircle
} from "lucide-react";

const API_BASE = getApiUrl();

const TIER_CONFIG = {
  free: { color: "bg-gray-500", label: "Free" },
  bronze: { color: "bg-amber-600", label: "Bronze" },
  silver: { color: "bg-slate-400", label: "Silver" },
  gold: { color: "bg-yellow-500", label: "Gold" },
  diamond: { color: "bg-cyan-400", label: "Diamond" }
};

const BENEFIT_TYPE_CONFIG = {
  numeric: { icon: Zap, label: "Numeric", description: "Number value (e.g., limits, counts)" },
  boolean: { icon: CheckCircle, label: "Boolean", description: "Yes/No toggle" },
  text: { icon: FileText, label: "Text", description: "Text description or status" },
  percentage: { icon: Percent, label: "Percentage", description: "Percentage value" }
};

const ICON_OPTIONS = [
  "star", "zap", "crown", "shield", "gift", "sparkles", 
  "image", "users", "percent", "file-text", "trophy", "medal"
];

export default function AdminCustomBenefits() {
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBenefit, setEditingBenefit] = useState(null);
  const [expandedBenefit, setExpandedBenefit] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: "",
    description: "",
    benefit_type: "numeric",
    default_value: "",
    icon: "star",
    display_order: 0,
    tier_values: {
      free: "",
      bronze: "",
      silver: "",
      gold: "",
      diamond: ""
    }
  });

  const fetchBenefits = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/custom-benefits`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Failed to fetch benefits");
      
      const data = await response.json();
      setBenefits(data.benefits || []);
    } catch (error) {
      toast.error("Failed to load custom benefits");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBenefits();
  }, [fetchBenefits]);

  const handleOpenModal = (benefit = null) => {
    if (benefit) {
      setEditingBenefit(benefit);
      setForm({
        name: benefit.name,
        description: benefit.description,
        benefit_type: benefit.benefit_type,
        default_value: benefit.default_value,
        icon: benefit.icon || "star",
        display_order: benefit.display_order || 0,
        tier_values: benefit.tier_values || {
          free: benefit.default_value,
          bronze: benefit.default_value,
          silver: benefit.default_value,
          gold: benefit.default_value,
          diamond: benefit.default_value
        }
      });
    } else {
      setEditingBenefit(null);
      setForm({
        name: "",
        description: "",
        benefit_type: "numeric",
        default_value: "",
        icon: "star",
        display_order: benefits.length,
        tier_values: {
          free: "",
          bronze: "",
          silver: "",
          gold: "",
          diamond: ""
        }
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Please provide a benefit name");
      return;
    }
    
    if (!form.description.trim()) {
      toast.error("Please provide a description");
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const url = editingBenefit 
        ? `${API_BASE}/api/admin/membership/custom-benefits/${editingBenefit.benefit_id}`
        : `${API_BASE}/api/admin/membership/custom-benefits`;
      
      // Convert tier values based on benefit type
      const processedTierValues = {};
      Object.keys(form.tier_values).forEach(tier => {
        const value = form.tier_values[tier];
        if (form.benefit_type === "numeric" || form.benefit_type === "percentage") {
          processedTierValues[tier] = value === "" ? form.default_value : parseFloat(value);
        } else if (form.benefit_type === "boolean") {
          processedTierValues[tier] = value === "true" || value === true;
        } else {
          processedTierValues[tier] = value || form.default_value;
        }
      });
      
      const response = await fetch(url, {
        method: editingBenefit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          default_value: form.benefit_type === "numeric" || form.benefit_type === "percentage" 
            ? parseFloat(form.default_value) || 0 
            : form.benefit_type === "boolean" 
              ? form.default_value === "true" || form.default_value === true
              : form.default_value,
          tier_values: processedTierValues
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save benefit");
      }
      
      toast.success(editingBenefit ? "Benefit updated" : "Benefit created");
      setShowModal(false);
      fetchBenefits();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (benefitId) => {
    if (!confirm("Are you sure you want to delete this benefit?")) return;
    
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/membership/custom-benefits/${benefitId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Failed to delete benefit");
      
      toast.success("Benefit deleted");
      fetchBenefits();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const renderValueInput = (tier) => {
    const value = form.tier_values[tier];
    
    if (form.benefit_type === "boolean") {
      return (
        <select
          value={value.toString()}
          onChange={(e) => setForm({
            ...form,
            tier_values: {...form.tier_values, [tier]: e.target.value}
          })}
          className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    }
    
    return (
      <Input
        type={form.benefit_type === "numeric" || form.benefit_type === "percentage" ? "number" : "text"}
        value={value}
        onChange={(e) => setForm({
          ...form,
          tier_values: {...form.tier_values, [tier]: e.target.value}
        })}
        placeholder={form.default_value?.toString() || "Value"}
        className="bg-slate-700 border-slate-600 text-white text-sm placeholder:text-slate-400"
      />
    );
  };

  const getIconComponent = (iconName) => {
    const icons = {
      star: Star,
      zap: Zap,
      crown: Crown,
      shield: Shield,
      gift: Gift,
      sparkles: Sparkles,
      image: Image,
      users: Users,
      percent: Percent,
      "file-text": FileText
    };
    return icons[iconName] || Star;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-custom-benefits">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gift className="w-7 h-7 text-purple-400" />
            Custom Benefits
          </h2>
          <p className="text-slate-400 mt-1">
            Create and manage custom membership benefits for each tier
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={fetchBenefits} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => handleOpenModal()} data-testid="create-benefit-btn">
            <Plus className="w-4 h-4 mr-2" />
            Create Benefit
          </Button>
        </div>
      </div>

      {/* Benefits List */}
      {benefits.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <Gift className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No Custom Benefits Yet</h3>
          <p className="text-slate-400 mb-4">Create your first custom benefit to enhance membership tiers.</p>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Benefit
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {benefits.map((benefit) => {
            const IconComp = getIconComponent(benefit.icon);
            const isExpanded = expandedBenefit === benefit.benefit_id;
            
            return (
              <div 
                key={benefit.benefit_id}
                className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
              >
                {/* Benefit Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-slate-700/30"
                  onClick={() => setExpandedBenefit(isExpanded ? null : benefit.benefit_id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                        <IconComp className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{benefit.name}</h3>
                        <p className="text-slate-400 text-sm">{benefit.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`capitalize ${
                        benefit.benefit_type === "numeric" ? "bg-blue-500/20 text-blue-300" :
                        benefit.benefit_type === "boolean" ? "bg-green-500/20 text-green-300" :
                        benefit.benefit_type === "percentage" ? "bg-yellow-500/20 text-yellow-300" :
                        "bg-purple-500/20 text-purple-300"
                      }`}>
                        {benefit.benefit_type}
                      </Badge>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-700 bg-slate-900/30">
                    {/* Tier Values Grid */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-slate-400 mb-3">Values by Tier</h4>
                      <div className="grid grid-cols-5 gap-3">
                        {Object.keys(TIER_CONFIG).map((tier) => (
                          <div 
                            key={tier}
                            className="bg-slate-800 rounded-lg p-3 text-center"
                          >
                            <div className={`w-8 h-8 ${TIER_CONFIG[tier].color} rounded-full mx-auto mb-2 flex items-center justify-center`}>
                              <span className="text-xs text-white font-bold">
                                {TIER_CONFIG[tier].label[0]}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mb-1">{TIER_CONFIG[tier].label}</p>
                            <p className="text-lg font-bold text-white">
                              {benefit.benefit_type === "boolean" 
                                ? (benefit.tier_values?.[tier] ? "Yes" : "No")
                                : benefit.benefit_type === "percentage"
                                  ? `${benefit.tier_values?.[tier] || benefit.default_value}%`
                                  : benefit.tier_values?.[tier] || benefit.default_value
                              }
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-700">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDelete(benefit.benefit_id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleOpenModal(benefit)}
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl p-6 m-4">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              {editingBenefit ? (
                <>
                  <Edit2 className="w-5 h-5 text-blue-400" />
                  Edit Benefit
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-green-400" />
                  Create Custom Benefit
                </>
              )}
            </h3>
            
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Benefit Name</label>
                  <Input
                    placeholder="e.g., Priority Support"
                    value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})}
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Display Order</label>
                  <Input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm({...form, display_order: parseInt(e.target.value) || 0})}
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  placeholder="Describe what this benefit provides..."
                  value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500"
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Benefit Type</label>
                  <select
                    value={form.benefit_type}
                    onChange={(e) => setForm({...form, benefit_type: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    {Object.keys(BENEFIT_TYPE_CONFIG).map((type) => (
                      <option key={type} value={type}>
                        {BENEFIT_TYPE_CONFIG[type].label} - {BENEFIT_TYPE_CONFIG[type].description}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Icon</label>
                  <select
                    value={form.icon}
                    onChange={(e) => setForm({...form, icon: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    {ICON_OPTIONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Default Value</label>
                {form.benefit_type === "boolean" ? (
                  <select
                    value={form.default_value?.toString()}
                    onChange={(e) => setForm({...form, default_value: e.target.value})}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <Input
                    type={form.benefit_type === "numeric" || form.benefit_type === "percentage" ? "number" : "text"}
                    placeholder="Default value for all tiers"
                    value={form.default_value}
                    onChange={(e) => setForm({...form, default_value: e.target.value})}
                    className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                  />
                )}
              </div>
              
              {/* Tier Values */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Values by Tier</label>
                <div className="grid grid-cols-5 gap-3">
                  {Object.keys(TIER_CONFIG).map((tier) => (
                    <div key={tier} className="text-center">
                      <div className={`w-6 h-6 ${TIER_CONFIG[tier].color} rounded-full mx-auto mb-1`} />
                      <p className="text-xs text-slate-400 mb-1">{TIER_CONFIG[tier].label}</p>
                      {renderValueInput(tier)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                {editingBenefit ? "Update Benefit" : "Create Benefit"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
