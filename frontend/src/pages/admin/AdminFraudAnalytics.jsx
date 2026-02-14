import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { getApiUrl } from "../../utils/runtimeConfig";
import {
  Shield, AlertTriangle, RefreshCw, TrendingUp, TrendingDown,
  User, Clock, Eye, Play, Settings, ChevronDown, ChevronUp,
  BarChart3, Activity, Zap, Target, Users, Search, Info
} from "lucide-react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const API_BASE = getApiUrl();

const SEVERITY_COLORS = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444"
};

const RULE_CATEGORIES = {
  velocity: { label: "Velocity", color: "#3b82f6", icon: Zap },
  amount: { label: "Amount", color: "#22c55e", icon: TrendingUp },
  commission: { label: "Commission", color: "#a855f7", icon: Target },
  account: { label: "Account", color: "#f59e0b", icon: User },
  statistical: { label: "Statistical", color: "#06b6d4", icon: Activity },
  behavioral: { label: "Behavioral", color: "#ec4899", icon: Users }
};

export default function AdminFraudAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [rules, setRules] = useState({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedRule, setExpandedRule] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [userRiskSearch, setUserRiskSearch] = useState("");
  const [userRiskResult, setUserRiskResult] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/fraud-detection/analytics?days=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Failed to fetch analytics");
      
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      toast.error("Failed to load fraud analytics");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchRules = useCallback(async () => {
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/fraud-detection/rules`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      setRules(data.rules || {});
    } catch (error) {
      console.error("Failed to fetch rules:", error);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchRules();
  }, [fetchAnalytics, fetchRules]);

  const handleRunScan = async () => {
    setScanning(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/fraud-detection/scan?hours=24`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error("Scan failed");
      
      const data = await response.json();
      toast.success(`Scan complete: ${data.result?.flagged || 0} transactions flagged`);
      fetchAnalytics();
    } catch (error) {
      toast.error("Failed to run scan");
    } finally {
      setScanning(false);
    }
  };

  const handleCalculateUserRisk = async () => {
    if (!userRiskSearch.trim()) {
      toast.error("Please enter a user ID");
      return;
    }
    
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/fraud-detection/user-risk/${userRiskSearch}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to calculate risk");
      }
      
      const data = await response.json();
      setUserRiskResult(data);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const toggleRule = async (ruleId, enabled) => {
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_BASE}/api/admin/fraud-detection/rules/${ruleId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled })
      });
      
      if (!response.ok) throw new Error("Failed to update rule");
      
      toast.success(`Rule ${enabled ? "enabled" : "disabled"}`);
      fetchRules();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const getSeverityDistributionData = () => {
    if (!analytics?.severity_distribution) return [];
    return analytics.severity_distribution.map(s => ({
      name: s._id || "unknown",
      value: s.count || 0,
      amount: s.total_amount || 0
    }));
  };

  const getRuleBreakdownData = () => {
    if (!analytics?.rules_breakdown) return [];
    return analytics.rules_breakdown.slice(0, 10).map(r => ({
      name: r._id?.replace(/_/g, " ") || "unknown",
      count: r.count || 0,
      severity: r.avg_severity_score?.toFixed(1) || 0
    }));
  };

  if (loading && !analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-fraud-analytics">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-7 h-7 text-red-400" />
            Fraud Analytics
          </h2>
          <p className="text-slate-400 mt-1">
            Advanced pattern detection and risk scoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
          </select>
          <Button onClick={handleRunScan} disabled={scanning} variant="outline" size="sm">
            {scanning ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Run Scan
          </Button>
          <Button onClick={fetchAnalytics} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Pending Alerts Banner */}
      {analytics?.pending_alerts > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">
              {analytics.pending_alerts} unread fraud alerts require attention
            </span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        <Button
          variant={activeTab === "overview" ? "default" : "ghost"}
          onClick={() => setActiveTab("overview")}
          size="sm"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          Overview
        </Button>
        <Button
          variant={activeTab === "rules" ? "default" : "ghost"}
          onClick={() => setActiveTab("rules")}
          size="sm"
        >
          <Settings className="w-4 h-4 mr-2" />
          Detection Rules
        </Button>
        <Button
          variant={activeTab === "users" ? "default" : "ghost"}
          onClick={() => setActiveTab("users")}
          size="sm"
        >
          <Users className="w-4 h-4 mr-2" />
          User Risk
        </Button>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm">Total Transactions</span>
                <Activity className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {analytics?.summary?.total_transactions?.toLocaleString() || 0}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm">Flagged Transactions</span>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-2xl font-bold text-red-400">
                {analytics?.summary?.flagged_transactions?.toLocaleString() || 0}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {analytics?.summary?.flag_rate_percentage || 0}% flag rate
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm">Peak Fraud Hour</span>
                <Clock className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {analytics?.peak_fraud_hour !== undefined 
                  ? `${analytics.peak_fraud_hour}:00` 
                  : "—"}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                UTC timezone
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-400 text-sm">Active Rules</span>
                <Shield className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-2xl font-bold text-white">
                {Object.values(rules).filter(r => r.enabled).length}
                <span className="text-slate-500 text-lg">/{Object.keys(rules).length}</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Severity Distribution */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Severity Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={getSeverityDistributionData()}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {getSeverityDistributionData().map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={SEVERITY_COLORS[entry.name] || "#6b7280"} 
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                    formatter={(value, name) => [value, name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Rules Triggered */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Top Rules Triggered</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={getRuleBreakdownData()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fill: "#9ca3af", fontSize: 10 }} 
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                  />
                  <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Trend */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-4">Daily Fraud Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={analytics?.daily_trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="_id" tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#ef4444" 
                  fill="#ef4444" 
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top Flagged Users */}
          {analytics?.top_flagged_users?.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Top Flagged Users
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900/50">
                      <th className="text-left px-4 py-3 text-slate-400 text-sm font-medium">User</th>
                      <th className="text-center px-4 py-3 text-slate-400 text-sm font-medium">Flags</th>
                      <th className="text-right px-4 py-3 text-slate-400 text-sm font-medium">Amount</th>
                      <th className="text-center px-4 py-3 text-slate-400 text-sm font-medium">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.top_flagged_users.slice(0, 10).map((user) => (
                      <tr key={user._id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <div>
                              <p className="text-white text-sm">{user.username || user._id}</p>
                              <p className="text-slate-500 text-xs">{user.email || ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-red-400 font-medium">
                          {user.flag_count}
                        </td>
                        <td className="px-4 py-3 text-right text-white">
                          ${(user.total_flagged_amount || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge 
                            className="capitalize"
                            style={{ 
                              backgroundColor: `${SEVERITY_COLORS[user.most_common_severity] || "#6b7280"}20`,
                              color: SEVERITY_COLORS[user.most_common_severity] || "#6b7280"
                            }}
                          >
                            {user.most_common_severity || "unknown"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === "rules" && (
        <div className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-2 text-blue-400">
              <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Advanced ML-Inspired Detection Rules</p>
                <p className="text-blue-300/80 mt-1">
                  These rules use statistical analysis, behavioral patterns, and velocity detection to identify suspicious activity without external ML services.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {Object.entries(rules).map(([ruleId, rule]) => {
              const isExpanded = expandedRule === ruleId;
              
              return (
                <div 
                  key={ruleId}
                  className={`bg-slate-800/50 border rounded-xl overflow-hidden ${
                    rule.enabled ? "border-slate-700" : "border-slate-700/50 opacity-60"
                  }`}
                >
                  <div 
                    className="p-4 cursor-pointer hover:bg-slate-700/30"
                    onClick={() => setExpandedRule(isExpanded ? null : ruleId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${rule.enabled ? "bg-green-500" : "bg-slate-500"}`} />
                        <div>
                          <h4 className="text-white font-medium">{ruleId.replace(/_/g, " ")}</h4>
                          <p className="text-slate-400 text-sm">{rule.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge 
                          className="capitalize"
                          style={{ 
                            backgroundColor: `${SEVERITY_COLORS[rule.severity]}20`,
                            color: SEVERITY_COLORS[rule.severity]
                          }}
                        >
                          {rule.severity}
                        </Badge>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-4 border-t border-slate-700 bg-slate-900/30">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        {Object.entries(rule).filter(([k]) => 
                          !["enabled", "description", "severity"].includes(k)
                        ).map(([key, value]) => (
                          <div key={key} className="bg-slate-800 rounded-lg p-3">
                            <p className="text-xs text-slate-400 mb-1">{key.replace(/_/g, " ")}</p>
                            <p className="text-white font-medium">{JSON.stringify(value)}</p>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant={rule.enabled ? "destructive" : "default"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRule(ruleId, !rule.enabled);
                          }}
                        >
                          {rule.enabled ? "Disable Rule" : "Enable Rule"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* User Risk Tab */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* Risk Calculator */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              Calculate User Risk Score
            </h3>
            
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm text-slate-400 mb-1">User ID</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter user ID (e.g., user_abc123)"
                    value={userRiskSearch}
                    onChange={(e) => setUserRiskSearch(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500"
                  />
                  <Button onClick={handleCalculateUserRisk}>
                    <Search className="w-4 h-4 mr-2" />
                    Calculate
                  </Button>
                </div>
              </div>
            </div>
            
            {userRiskResult && (
              <div className="mt-6 p-4 bg-slate-900/50 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white font-medium">Risk Score Result</h4>
                  <div className="flex items-center gap-3">
                    <span className={`text-3xl font-bold ${
                      userRiskResult.risk_level === "high" ? "text-red-400" :
                      userRiskResult.risk_level === "medium" ? "text-yellow-400" :
                      "text-green-400"
                    }`}>
                      {(userRiskResult.risk_score * 100).toFixed(0)}%
                    </span>
                    <Badge className={`capitalize ${
                      userRiskResult.risk_level === "high" ? "bg-red-500/20 text-red-300" :
                      userRiskResult.risk_level === "medium" ? "bg-yellow-500/20 text-yellow-300" :
                      "bg-green-500/20 text-green-300"
                    }`}>
                      {userRiskResult.risk_level} risk
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {userRiskResult.risk_factors?.map((factor, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
                      <div>
                        <p className="text-white text-sm font-medium">{factor.factor.replace(/_/g, " ")}</p>
                        <p className="text-slate-400 text-xs">{factor.detail}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              factor.score > 0.7 ? "bg-red-500" :
                              factor.score > 0.4 ? "bg-yellow-500" :
                              "bg-green-500"
                            }`}
                            style={{ width: `${factor.score * 100}%` }}
                          />
                        </div>
                        <span className="text-slate-400 text-sm w-12 text-right">
                          {(factor.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Risk Score Stats */}
          {analytics?.risk_score_stats && Object.keys(analytics.risk_score_stats).length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <h3 className="text-lg font-semibold text-white mb-4">Platform Risk Overview</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-slate-400 text-sm mb-1">Average Risk Score</p>
                  <p className="text-2xl font-bold text-white">
                    {((analytics.risk_score_stats.avg_risk_score || 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400 text-sm mb-1">Max Risk Score</p>
                  <p className="text-2xl font-bold text-red-400">
                    {((analytics.risk_score_stats.max_risk_score || 0) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-slate-400 text-sm mb-1">High Risk Users</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {analytics.risk_score_stats.high_risk_count || 0}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
