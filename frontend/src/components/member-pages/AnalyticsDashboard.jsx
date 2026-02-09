/**
 * Enhanced Analytics Dashboard Component
 * Section 2: Detailed analytics with charts
 */

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  TrendingUp, TrendingDown, Eye, ShoppingCart, DollarSign, Users,
  Calendar, Download, RefreshCw, Loader2, BarChart3, PieChart
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AnalyticsDashboard({ pageId, pageName }) {
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState("7d");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/page-analytics/${pageId}?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to load analytics");
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      toast.error("Failed to load analytics");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAnalytics();
  }, [pageId, period]);

  const handleExport = async (format) => {
    setExporting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/page-analytics/${pageId}/export?format=${format}&period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (format === "csv" && data.csv_data) {
        const blob = new Blob([data.csv_data], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || `analytics_${pageId}.csv`;
        a.click();
        toast.success("Analytics exported!");
      } else if (format === "json") {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `analytics_${pageId}.json`;
        a.click();
        toast.success("Analytics exported!");
      }
    } catch (err) {
      toast.error("Failed to export");
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const overview = analytics?.overview || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Analytics Dashboard
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadAnalytics}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport("csv")} disabled={exporting}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2">
        {["7d", "30d", "90d", "1y"].map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p 
                ? "bg-primary text-white" 
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : p === "90d" ? "90 Days" : "1 Year"}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Eye}
          label="Page Views"
          value={overview.total_views || 0}
          change={"+12%"}
          trend="up"
        />
        <StatCard
          icon={ShoppingCart}
          label="Orders"
          value={overview.total_orders || 0}
          sublabel={`${overview.completed_orders || 0} completed`}
        />
        <StatCard
          icon={DollarSign}
          label="Revenue"
          value={`$${(overview.total_revenue || 0).toFixed(2)}`}
          sublabel={`Avg: $${(overview.average_order_value || 0).toFixed(2)}`}
        />
        <StatCard
          icon={TrendingUp}
          label="Conversion"
          value={`${(overview.conversion_rate || 0).toFixed(1)}%`}
          sublabel="Views to orders"
        />
      </div>

      {/* Top Items */}
      {analytics?.top_items?.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" />
            Top Performing Items
          </h3>
          <div className="space-y-3">
            {analytics.top_items.map((item, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-sm text-muted-foreground">{item.quantity} sold</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">${item.revenue.toFixed(2)}</p>
                  <div className="w-24 h-2 bg-muted rounded-full mt-1">
                    <div 
                      className="h-full bg-primary rounded-full" 
                      style={{ width: `${Math.min(100, (item.revenue / (analytics.top_items[0]?.revenue || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referral Stats - Enhanced */}
      {analytics?.referral_stats && (
        <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-200/50 p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-gray-900">
            <Users className="w-5 h-5 text-purple-600" />
            Referral Performance
          </h3>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div className="bg-white/60 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-purple-600">{analytics.referral_stats.signups || 0}</p>
              <p className="text-xs text-gray-500">Signups</p>
            </div>
            <div className="bg-white/60 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-pink-600">{analytics.referral_stats.clicks || 0}</p>
              <p className="text-xs text-gray-500">Link Clicks</p>
            </div>
            <div className="bg-white/60 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-indigo-600">{analytics.referral_stats.referral_orders || 0}</p>
              <p className="text-xs text-gray-500">Orders</p>
            </div>
            <div className="bg-white/60 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">${(analytics.referral_stats.referral_revenue || 0).toFixed(0)}</p>
              <p className="text-xs text-gray-500">Revenue</p>
            </div>
          </div>
          
          {/* Referral Code & Link */}
          <div className="bg-white/70 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Your Referral Code</p>
                <code className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg font-mono font-bold text-lg">
                  {analytics.referral_stats.referral_code}
                </code>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(analytics.referral_stats.referral_code);
                  toast.success("Code copied!");
                }}
                className="p-2 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4 text-purple-600" />
              </button>
            </div>
            
            <div className="border-t border-purple-100 pt-3">
              <p className="text-xs text-gray-500 mb-2">Share Your Referral Link</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={`https://blendlink.net/${pageName?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}?ref=${analytics.referral_stats.referral_code}`}
                  className="flex-1 px-3 py-2 bg-gray-50 rounded-xl text-sm text-gray-600 truncate border border-gray-200"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://blendlink.net/${pageName?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}?ref=${analytics.referral_stats.referral_code}`);
                    toast.success("Link copied!");
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium text-sm hover:from-purple-600 hover:to-pink-600 transition-all flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" /> Copy
                </button>
              </div>
            </div>
            
            {/* Social Share Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  const url = `https://blendlink.net/${pageName?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}?ref=${analytics.referral_stats.referral_code}`;
                  window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`Check out ${pageName} on BlendLink!`)}`, '_blank');
                }}
                className="flex-1 py-2 bg-[#1DA1F2] text-white rounded-xl text-sm font-medium hover:bg-[#1a8cd8] transition-colors"
              >
                Twitter
              </button>
              <button
                onClick={() => {
                  const url = `https://blendlink.net/${pageName?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}?ref=${analytics.referral_stats.referral_code}`;
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
                }}
                className="flex-1 py-2 bg-[#4267B2] text-white rounded-xl text-sm font-medium hover:bg-[#365899] transition-colors"
              >
                Facebook
              </button>
              <button
                onClick={() => {
                  const url = `https://blendlink.net/${pageName?.toLowerCase().replace(/[^a-z0-9]+/g, '-')}?ref=${analytics.referral_stats.referral_code}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${pageName} on BlendLink! ${url}`)}`, '_blank');
                }}
                className="flex-1 py-2 bg-[#25D366] text-white rounded-xl text-sm font-medium hover:bg-[#20bd5a] transition-colors"
              >
                WhatsApp
              </button>
            </div>
          </div>
          
          {/* Top Referrers */}
          {analytics.referral_stats.top_referrers?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-purple-200/50">
              <p className="text-sm font-semibold text-gray-700 mb-3">Top Referrers</p>
              <div className="space-y-2">
                {analytics.referral_stats.top_referrers.map((referrer, i) => (
                  <div key={i} className="flex items-center justify-between bg-white/50 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-bold text-purple-600">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700">{referrer.name || `User ${referrer._id?.slice(-4)}`}</span>
                    </div>
                    <span className="text-sm font-semibold text-purple-600">{referrer.count} referrals</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const StatCard = ({ icon: Icon, label, value, sublabel, change, trend }) => (
  <div className="bg-card rounded-xl border border-border p-4">
    <div className="flex items-center justify-between mb-2">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      {change && (
        <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
          trend === "up" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
        }`}>
          {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change}
        </span>
      )}
    </div>
    <p className="text-2xl font-bold">{value}</p>
    <p className="text-sm text-muted-foreground">{sublabel || label}</p>
  </div>
);
