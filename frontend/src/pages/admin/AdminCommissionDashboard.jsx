import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import {
  DollarSign, TrendingUp, TrendingDown, Users, Crown, RefreshCw,
  Shield, AlertTriangle, CheckCircle, Clock, Ban, Play, Pause,
  ChevronDown, ChevronUp, Eye, User, Calendar, Download, Filter,
  PieChart, BarChart3, Activity, Wallet, Percent, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const API_BASE = getApiUrl();

const TIER_COLORS = {
  free: "#6b7280",
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  diamond: "#b9f2ff"
};

const LEVEL_LABELS = {
  "1": "Level 1 (Direct)",
  "2": "Level 2",
  "3": "Level 3",
  "4": "Level 4",
  "5": "Level 5"
};

export default function AdminCommissionDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState("30d");
  const [heldCommissions, setHeldCommissions] = useState([]);
  const [topEarners, setTopEarners] = useState([]);
  const [expandedUser, setExpandedUser] = useState(null);
  const [holdModal, setHoldModal] = useState({ show: false, user: null });
  const [holdReason, setHoldReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchCommissionStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(
        `${API_BASE}/api/admin/membership/commission-stats?period=${period}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error("Failed to fetch commission stats");

      const data = await response.json();
      setStats(data);
      setTopEarners(data.top_earners || []);
    } catch (error) {
      toast.error("Failed to load commission statistics");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchHeldCommissions = useCallback(async () => {
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(
        `${API_BASE}/api/admin/membership/commissions/held`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) return;

      const data = await response.json();
      setHeldCommissions(data.held_commissions || []);
    } catch (error) {
      console.error("Failed to fetch held commissions:", error);
    }
  }, []);

  useEffect(() => {
    fetchCommissionStats();
    fetchHeldCommissions();
  }, [fetchCommissionStats, fetchHeldCommissions]);

  const handleHoldCommissions = async (userId) => {
    if (!holdReason.trim()) {
      toast.error("Please provide a reason for holding commissions");
      return;
    }

    setProcessing(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(
        `${API_BASE}/api/admin/membership/commission-hold/${userId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ reason: holdReason })
        }
      );

      if (!response.ok) throw new Error("Failed to hold commissions");

      toast.success("Commissions placed on hold");
      setHoldModal({ show: false, user: null });
      setHoldReason("");
      fetchHeldCommissions();
      fetchCommissionStats();
    } catch (error) {
      toast.error("Failed to hold commissions");
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReleaseCommissions = async (userId) => {
    setProcessing(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(
        `${API_BASE}/api/admin/membership/commission-release/${userId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!response.ok) throw new Error("Failed to release commissions");

      toast.success("Commissions released");
      fetchHeldCommissions();
      fetchCommissionStats();
    } catch (error) {
      toast.error("Failed to release commissions");
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const getLevelData = () => {
    if (!stats?.level_stats) return [];
    return stats.level_stats.map(item => ({
      name: LEVEL_LABELS[item._id] || `Level ${item._id}`,
      amount: item.total_amount || 0,
      count: item.count || 0,
      avg: item.avg_amount || 0
    }));
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-green-400" />
            Commission Dashboard
          </h2>
          <p className="text-slate-400 mt-1">
            Monitor commission payouts, hold suspicious activity, and track earnings
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
          <Button onClick={fetchCommissionStats} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {heldCommissions.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">
              {heldCommissions.length} user(s) have commissions on hold
            </span>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-sm">Total Volume</span>
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(stats?.total_volume)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {period === "all" ? "All time" : `Last ${period}`}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-sm">Held Commissions</span>
            <Ban className="w-5 h-5 text-orange-400" />
          </div>
          <div className="text-2xl font-bold text-orange-400">
            {stats?.held_commissions_count || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Pending review
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-sm">Top Earner</span>
            <Crown className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {topEarners[0]?.username || "—"}
          </div>
          <div className="text-xs text-green-400 mt-1">
            {formatCurrency(topEarners[0]?.total_earned)}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-sm">Avg Commission</span>
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {formatCurrency(
              stats?.level_stats?.reduce((acc, l) => acc + (l.avg_amount || 0), 0) / 
              Math.max(stats?.level_stats?.length || 1, 1)
            )}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Per transaction
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Commission by Level */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Commissions by Level</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getLevelData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tier Distribution Pie */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h3 className="text-lg font-semibold text-white mb-4">Top Earners by Tier</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPie>
              <Pie
                data={topEarners.slice(0, 10).map(e => ({
                  name: e.username || e._id,
                  value: e.total_earned || 0,
                  tier: e.subscription_tier || "free"
                }))}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
              >
                {topEarners.slice(0, 10).map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={TIER_COLORS[entry.subscription_tier] || TIER_COLORS.free} 
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                formatter={(value) => formatCurrency(value)}
              />
            </RechartsPie>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Earners Table */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Top Commission Earners
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="text-left px-5 py-3 text-slate-400 text-sm font-medium">Rank</th>
                <th className="text-left px-5 py-3 text-slate-400 text-sm font-medium">User</th>
                <th className="text-left px-5 py-3 text-slate-400 text-sm font-medium">Tier</th>
                <th className="text-right px-5 py-3 text-slate-400 text-sm font-medium">Total Earned</th>
                <th className="text-right px-5 py-3 text-slate-400 text-sm font-medium">Transactions</th>
                <th className="text-center px-5 py-3 text-slate-400 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {topEarners.map((earner, index) => (
                <tr key={earner._id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-5 py-4">
                    <span className={`font-bold ${
                      index === 0 ? "text-yellow-400" : 
                      index === 1 ? "text-slate-300" : 
                      index === 2 ? "text-orange-400" : "text-slate-500"
                    }`}>
                      #{index + 1}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{earner.username || "Unknown"}</p>
                        <p className="text-slate-500 text-xs">{earner.email || earner._id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge 
                      className="capitalize"
                      style={{ 
                        backgroundColor: `${TIER_COLORS[earner.subscription_tier] || TIER_COLORS.free}20`,
                        color: TIER_COLORS[earner.subscription_tier] || TIER_COLORS.free
                      }}
                    >
                      {earner.subscription_tier || "Free"}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-green-400 font-semibold">
                      {formatCurrency(earner.total_earned)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-300">
                    {earner.commission_count || 0}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedUser(expandedUser === earner._id ? null : earner._id)}
                        className="text-slate-400 hover:text-white"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setHoldModal({ show: true, user: earner })}
                        className="text-orange-400 hover:text-orange-300"
                      >
                        <Ban className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Held Commissions Section */}
      {heldCommissions.length > 0 && (
        <div className="bg-slate-800/50 border border-orange-500/30 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-700 bg-orange-500/5">
            <h3 className="text-lg font-semibold text-orange-400 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Held Commissions ({heldCommissions.length})
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {heldCommissions.map((held) => (
              <div 
                key={held.user_id} 
                className="flex items-center justify-between bg-slate-900/50 p-4 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{held.username || held.user_id}</p>
                    <p className="text-slate-500 text-sm">{held.reason || "No reason provided"}</p>
                    <p className="text-slate-600 text-xs mt-1">
                      Held since: {new Date(held.held_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-orange-400 font-semibold">
                    {held.held_amount ? formatCurrency(held.held_amount) : "Pending"}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleReleaseCommissions(held.user_id)}
                    disabled={processing}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Release
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hold Commission Modal */}
      {holdModal.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md p-6 m-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              Hold Commissions for {holdModal.user?.username || holdModal.user?._id}
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              This will prevent any commission payouts to this user until released.
            </p>
            <textarea
              value={holdReason}
              onChange={(e) => setHoldReason(e.target.value)}
              placeholder="Enter reason for holding commissions..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 mb-4"
              rows={3}
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setHoldModal({ show: false, user: null });
                  setHoldReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleHoldCommissions(holdModal.user?._id)}
                disabled={processing || !holdReason.trim()}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {processing ? "Holding..." : "Hold Commissions"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
