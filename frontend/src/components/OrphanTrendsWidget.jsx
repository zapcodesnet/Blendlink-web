import React, { useState, useEffect, useCallback } from "react";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { Button } from "./ui/button";
import { getApiUrl } from "../utils/runtimeConfig";
import { 
  TrendingUp, TrendingDown, Calendar, Users, 
  Activity, AlertTriangle, CheckCircle, RefreshCw,
  ChevronDown, Zap, Clock, Target
} from "lucide-react";

const API_BASE = getApiUrl();

// Chart colors
const COLORS = {
  auto: '#8b5cf6',      // purple
  manual: '#3b82f6',    // blue
  registration: '#10b981', // green
  successful: '#22c55e',
  failed: '#ef4444',
  primary: '#8b5cf6',
  secondary: '#06b6d4'
};

const TIER_COLORS = [
  '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444',
  '#ec4899', '#d946ef', '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4'
];

// Safe fetch helper
const safeFetch = async (url, options = {}) => {
  const token = localStorage.getItem('blendlink_token') || localStorage.getItem('admin_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, { ...options, headers });
  
  let data = {};
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    // Body unreadable - use empty object
  }
  
  if (!response.ok) {
    throw new Error(data.detail || data.message || `Request failed`);
  }
  return data;
};

// Date range presets
const DATE_PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 14 days', days: 14 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 6 months', days: 180 },
  { label: 'Last year', days: 365 },
];

export default function OrphanTrendsWidget() {
  const [trendsData, setTrendsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Date range state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [granularity, setGranularity] = useState('day');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('Last 30 days');
  
  // Chart view toggle
  const [chartType, setChartType] = useState('area'); // 'area', 'line', 'bar'
  
  const loadTrends = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE}/api/admin/orphans/trends?granularity=${granularity}`;
      if (startDate) url += `&start_date=${startDate}`;
      if (endDate) url += `&end_date=${endDate}`;
      
      const data = await safeFetch(url);
      setTrendsData(data);
    } catch (err) {
      console.error("Failed to load trends:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, granularity]);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  // Apply preset
  const applyPreset = (preset) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - preset.days);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
    setSelectedPreset(preset.label);
    
    // Auto-adjust granularity based on date range
    if (preset.days <= 14) {
      setGranularity('day');
    } else if (preset.days <= 90) {
      setGranularity('day');
    } else {
      setGranularity('week');
    }
    
    setShowDatePicker(false);
  };

  // Apply custom date range
  const applyCustomRange = () => {
    setSelectedPreset('Custom');
    setShowDatePicker(false);
    loadTrends();
  };

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    
    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-white font-medium mb-2">{formatDate(label)}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400 capitalize">{entry.dataKey}:</span>
            <span className="text-white font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading && !trendsData) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6" data-testid="orphan-trends-widget-loading">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-xl border border-red-500/30 p-6" data-testid="orphan-trends-widget-error">
        <div className="flex flex-col items-center justify-center h-64 text-red-400">
          <AlertTriangle className="w-12 h-12 mb-3" />
          <p>Failed to load trends data</p>
          <p className="text-sm text-slate-500">{error}</p>
          <Button onClick={loadTrends} variant="ghost" className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const { timeline, summary, pool_status, tier_distribution, date_range } = trendsData || {};

  // Prepare tier distribution for pie chart
  const tierPieData = tier_distribution 
    ? Object.entries(tier_distribution)
        .filter(([_, v]) => v > 0)
        .map(([tier, count]) => ({
          name: `Tier ${tier}`,
          value: count
        }))
    : [];

  return (
    <div className="space-y-6" data-testid="orphan-trends-widget">
      {/* Header with Date Range Selector */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Orphan Assignment Trends
            </h3>
            <p className="text-sm text-slate-400">
              Track system effectiveness and pool utilization over time
            </p>
          </div>
          
          {/* Date Range Selector */}
          <div className="flex items-center gap-2 relative">
            <Button
              variant="outline"
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              data-testid="date-range-selector"
            >
              <Calendar className="w-4 h-4 mr-2" />
              {selectedPreset}
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
            
            {showDatePicker && (
              <div className="absolute top-full right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-xl z-50 min-w-[320px]" data-testid="date-picker-dropdown">
                {/* Presets */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Quick Select</p>
                  <div className="grid grid-cols-2 gap-2">
                    {DATE_PRESETS.map((preset) => (
                      <Button
                        key={preset.label}
                        variant={selectedPreset === preset.label ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => applyPreset(preset)}
                        className={selectedPreset === preset.label ? 'bg-purple-600' : 'text-slate-400'}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                </div>
                
                {/* Custom Range */}
                <div className="border-t border-slate-700 pt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Custom Range</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div>
                      <label className="text-xs text-slate-400">Start</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        data-testid="start-date-input"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">End</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm"
                        data-testid="end-date-input"
                      />
                    </div>
                  </div>
                  <Button onClick={applyCustomRange} size="sm" className="w-full bg-purple-600">
                    Apply Custom Range
                  </Button>
                </div>
                
                {/* Granularity */}
                <div className="border-t border-slate-700 pt-4 mt-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Granularity</p>
                  <div className="flex gap-2">
                    {['day', 'week', 'month'].map((g) => (
                      <Button
                        key={g}
                        variant={granularity === g ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setGranularity(g)}
                        className={granularity === g ? 'bg-purple-600' : 'text-slate-400'}
                      >
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <Button onClick={loadTrends} variant="ghost" size="icon" className="text-slate-400">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700" data-testid="total-assignments-stat">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{summary.total_assignments}</p>
                <p className="text-xs text-slate-400">Total Assignments</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700" data-testid="success-rate-stat">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{summary.success_rate}%</p>
                <p className="text-xs text-slate-400">Success Rate</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700" data-testid="daily-rate-stat">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{summary.recent_daily_rate}</p>
                <p className="text-xs text-slate-400">Avg Daily Rate</p>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700" data-testid="wow-change-stat">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                summary.week_over_week_change >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                {summary.week_over_week_change >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
              </div>
              <div>
                <p className={`text-2xl font-bold ${
                  summary.week_over_week_change >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {summary.week_over_week_change > 0 ? '+' : ''}{summary.week_over_week_change}%
                </p>
                <p className="text-xs text-slate-400">Week over Week</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pool Health Alert */}
      {pool_status && (
        <div className={`rounded-xl p-4 border ${
          pool_status.pool_health === 'healthy' 
            ? 'bg-green-500/10 border-green-500/30' 
            : 'bg-amber-500/10 border-amber-500/30'
        }`} data-testid="pool-health-alert">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              {pool_status.pool_health === 'healthy' ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              )}
              <div>
                <p className={`font-semibold ${
                  pool_status.pool_health === 'healthy' ? 'text-green-400' : 'text-amber-400'
                }`}>
                  Pool Status: {pool_status.pool_health === 'healthy' ? 'Healthy' : 'Needs Attention'}
                </p>
                <p className="text-sm text-slate-400">
                  {pool_status.current_eligible} eligible users available for {pool_status.current_unassigned} pending orphans
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{pool_status.current_unassigned}</p>
                <p className="text-slate-400">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{pool_status.current_eligible}</p>
                <p className="text-slate-400">Eligible Users</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${
                  pool_status.days_until_exhaustion > 30 ? 'text-green-400' : 
                  pool_status.days_until_exhaustion > 7 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {pool_status.days_until_exhaustion > 365 ? '365+' : pool_status.days_until_exhaustion}
                </p>
                <p className="text-slate-400">Days Until Empty</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Trends Chart */}
      {timeline && timeline.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-white">Assignment Trends Over Time</h4>
            <div className="flex gap-2">
              {['area', 'line', 'bar'].map((type) => (
                <Button
                  key={type}
                  variant={chartType === type ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setChartType(type)}
                  className={chartType === type ? 'bg-purple-600' : 'text-slate-400'}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="h-80" data-testid="trends-chart">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={timeline}>
                  <defs>
                    <linearGradient id="colorAuto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.auto} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={COLORS.auto} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorManual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.manual} stopOpacity={0.4}/>
                      <stop offset="95%" stopColor={COLORS.manual} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="auto" 
                    stroke={COLORS.auto} 
                    fill="url(#colorAuto)"
                    name="Auto"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="manual" 
                    stroke={COLORS.manual}
                    fill="url(#colorManual)"
                    name="Manual"
                  />
                </AreaChart>
              ) : chartType === 'line' ? (
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke={COLORS.primary}
                    strokeWidth={2}
                    dot={false}
                    name="Total"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="auto" 
                    stroke={COLORS.auto}
                    strokeWidth={2}
                    dot={false}
                    name="Auto"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="manual" 
                    stroke={COLORS.manual}
                    strokeWidth={2}
                    dot={false}
                    name="Manual"
                  />
                </LineChart>
              ) : (
                <BarChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDate}
                    stroke="#64748b"
                    fontSize={12}
                  />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="auto" fill={COLORS.auto} name="Auto" stackId="a" />
                  <Bar dataKey="manual" fill={COLORS.manual} name="Manual" stackId="a" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bottom Row: Assignment Breakdown & Tier Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignment Type Breakdown */}
        {summary && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4" data-testid="assignment-breakdown">
            <h4 className="font-semibold text-white mb-4">Assignment Type Breakdown</h4>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-400">Auto Assignments</span>
                  <span className="text-sm font-medium text-white">{summary.total_auto}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full transition-all"
                    style={{ 
                      width: `${summary.total_assignments > 0 
                        ? (summary.total_auto / summary.total_assignments * 100) 
                        : 0}%` 
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-400">Manual Assignments</span>
                  <span className="text-sm font-medium text-white">{summary.total_manual}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ 
                      width: `${summary.total_assignments > 0 
                        ? (summary.total_manual / summary.total_assignments * 100) 
                        : 0}%` 
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-400">Registration Assignments</span>
                  <span className="text-sm font-medium text-white">{summary.total_registration}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ 
                      width: `${summary.total_assignments > 0 
                        ? (summary.total_registration / summary.total_assignments * 100) 
                        : 0}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tier Distribution */}
        {tierPieData.length > 0 && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4" data-testid="tier-distribution">
            <h4 className="font-semibold text-white mb-4">Tier Distribution</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {tierPieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={TIER_COLORS[index % TIER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    formatter={(value) => <span className="text-slate-300 text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Date Range Info */}
      {date_range && (
        <div className="text-center text-xs text-slate-500">
          Showing data from {formatDate(date_range.start)} to {formatDate(date_range.end)} 
          ({date_range.days} days, {date_range.granularity} granularity)
        </div>
      )}
    </div>
  );
}
