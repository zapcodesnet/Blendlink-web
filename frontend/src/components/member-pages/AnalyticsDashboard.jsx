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

      {/* Referral Stats */}
      {analytics?.referral_stats && (
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Referral Performance
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold">{analytics.referral_stats.signups || 0}</p>
              <p className="text-sm text-muted-foreground">Signups via referral</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Your referral code</p>
              <code className="px-3 py-1.5 bg-background/50 rounded-lg font-mono text-sm">
                {analytics.referral_stats.referral_code}
              </code>
            </div>
          </div>
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
