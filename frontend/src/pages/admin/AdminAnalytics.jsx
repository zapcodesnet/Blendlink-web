import React, { useState, useEffect, useCallback } from "react";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { adminAPI } from "./AdminLayout";
import { 
  BarChart3, TrendingUp, Users, Coins,
  Calendar, RefreshCw, ArrowUp, ArrowDown, Minus,
  DollarSign, Activity, UserPlus, Database, Server,
  Wallet, CreditCard, AlertCircle
} from "lucide-react";

// GrowthIndicator component moved outside to avoid re-creation on every render
const GrowthIndicator = ({ value }) => {
  if (value > 0) return <span className="flex items-center text-green-400 text-sm font-medium"><ArrowUp className="w-3 h-3 mr-1" /> +{value}%</span>;
  if (value < 0) return <span className="flex items-center text-red-400 text-sm font-medium"><ArrowDown className="w-3 h-3 mr-1" /> {value}%</span>;
  return <span className="flex items-center text-slate-400 text-sm font-medium"><Minus className="w-3 h-3 mr-1" /> 0%</span>;
};

export default function AdminAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [finance, setFinance] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load all data in parallel using new production endpoints
      const [analyticsData, financeData, healthData] = await Promise.all([
        adminAPI.getAnalytics(period),
        adminAPI.getFinancialOverview(),
        adminAPI.getSystemHealth().catch(() => null), // Health might fail without permission
      ]);
      
      setAnalytics(analyticsData);
      setFinance(financeData);
      setHealth(healthData);
    } catch (error) {
      toast.error("Failed to load analytics: " + error.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate growth from analytics data
  const calculateGrowth = (data) => {
    if (!data || data.length < 2) return 0;
    const recent = data.slice(-7).reduce((sum, d) => sum + (d.count || 0), 0);
    const previous = data.slice(-14, -7).reduce((sum, d) => sum + (d.count || 0), 0);
    if (previous === 0) return recent > 0 ? 100 : 0;
    return Math.round(((recent - previous) / previous) * 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-400 mx-auto mb-2" />
          <p className="text-slate-400">Loading real-time analytics...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'User Growth', icon: Users },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'system', label: 'System Health', icon: Server },
  ];

  // Get totals from analytics data
  const totalSignups = analytics?.signups?.reduce((sum, d) => sum + (d.count || 0), 0) || 0;
  const totalActiveUsers = analytics?.active_users?.reduce((sum, d) => sum + (d.count || 0), 0) || 0;
  const totalTransactions = analytics?.transactions?.reduce((sum, d) => sum + (d.count || 0), 0) || 0;
  const totalVolume = analytics?.transactions?.reduce((sum, d) => sum + (d.volume || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Analytics Dashboard
          </h1>
          <p className="text-slate-400">Real-time production data • Period: {period}</p>
        </div>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Key Metrics from Real Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={UserPlus}
              label="New Signups"
              value={totalSignups}
              subtext={`in ${period}`}
              growth={calculateGrowth(analytics?.signups)}
              color="blue"
            />
            <MetricCard
              icon={Activity}
              label="Active Users"
              value={totalActiveUsers}
              subtext="unique logins"
              growth={calculateGrowth(analytics?.active_users)}
              color="green"
            />
            <MetricCard
              icon={CreditCard}
              label="Transactions"
              value={totalTransactions}
              subtext={`${period} period`}
              growth={calculateGrowth(analytics?.transactions)}
              color="purple"
            />
            <MetricCard
              icon={Coins}
              label="BL Coins Total"
              value={finance?.total_bl_coins?.toLocaleString() || 0}
              subtext="in circulation"
              color="amber"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Signups Chart */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">User Signups</h3>
                <GrowthIndicator value={calculateGrowth(analytics?.signups)} />
              </div>
              <div className="h-48 flex items-end gap-1">
                {analytics?.signups?.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:from-blue-500 hover:to-blue-300 transition-colors"
                      style={{ 
                        height: `${Math.max(4, (day.count / Math.max(...analytics.signups.map(d => d.count || 1))) * 160)}px` 
                      }}
                      title={`${day._id}: ${day.count} signups`}
                    />
                  </div>
                ))}
              </div>
              {analytics?.signups?.length > 0 && (
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                  <span>{analytics.signups[0]?._id}</span>
                  <span>{analytics.signups[analytics.signups.length - 1]?._id}</span>
                </div>
              )}
            </div>

            {/* Active Users Chart */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Active Users</h3>
                <GrowthIndicator value={calculateGrowth(analytics?.active_users)} />
              </div>
              <div className="h-48 flex items-end gap-1">
                {analytics?.active_users?.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t hover:from-green-500 hover:to-green-300 transition-colors"
                      style={{ 
                        height: `${Math.max(4, (day.count / Math.max(...analytics.active_users.map(d => d.count || 1))) * 160)}px` 
                      }}
                      title={`${day._id}: ${day.count} active users`}
                    />
                  </div>
                ))}
              </div>
              {analytics?.active_users?.length > 0 && (
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                  <span>{analytics.active_users[0]?._id}</span>
                  <span>{analytics.active_users[analytics.active_users.length - 1]?._id}</span>
                </div>
              )}
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-400" />
              Financial Overview (Real Data)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-400 mb-1">Total BL Coins</p>
                <p className="text-2xl font-bold text-white">{(finance?.total_bl_coins || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <p className="text-xs text-green-400 mb-1">Total USD Balances</p>
                <p className="text-2xl font-bold text-white">${(finance?.total_usd_balances || 0).toFixed(2)}</p>
              </div>
              <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-xs text-yellow-400 mb-1">Pending Withdrawals</p>
                <p className="text-2xl font-bold text-white">{finance?.pending_withdrawals?.count || 0}</p>
                <p className="text-xs text-slate-500">${(finance?.pending_withdrawals?.amount || 0).toFixed(2)}</p>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-400 mb-1">Commissions Paid</p>
                <p className="text-2xl font-bold text-white">${(finance?.total_commissions_paid || 0).toFixed(2)}</p>
              </div>
              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <p className="text-xs text-purple-400 mb-1">Platform Fees</p>
                <p className="text-2xl font-bold text-white">${(finance?.total_platform_fees || 0).toFixed(2)}</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* User Growth Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={UserPlus} label="Total Signups" value={totalSignups} subtext={`Period: ${period}`} color="blue" />
            <MetricCard icon={Activity} label="Active Users" value={totalActiveUsers} subtext="Unique logins" color="green" />
            <MetricCard icon={TrendingUp} label="Signup Growth" value={`${calculateGrowth(analytics?.signups)}%`} color="cyan" />
            <MetricCard icon={Users} label="Activity Growth" value={`${calculateGrowth(analytics?.active_users)}%`} color="purple" />
          </div>

          {/* Daily Signups Breakdown */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">Daily Signups Breakdown</h3>
            </div>
            <div className="divide-y divide-slate-700">
              {analytics?.signups?.map((day, i) => (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="text-white">{day._id}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full"
                        style={{ 
                          width: `${(day.count / Math.max(...analytics.signups.map(d => d.count || 1))) * 100}%` 
                        }}
                      />
                    </div>
                    <span className="text-white font-bold w-12 text-right">{day.count}</span>
                  </div>
                </div>
              ))}
              {(!analytics?.signups || analytics.signups.length === 0) && (
                <div className="p-8 text-center text-slate-400">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No signup data available for this period</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Financial Tab */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={Coins} label="BL Coins" value={(finance?.total_bl_coins || 0).toLocaleString()} color="amber" />
            <MetricCard icon={DollarSign} label="USD Balances" value={`$${(finance?.total_usd_balances || 0).toFixed(2)}`} color="green" />
            <MetricCard icon={Wallet} label="Pending Payouts" value={finance?.pending_withdrawals?.count || 0} color="yellow" />
            <MetricCard icon={CreditCard} label="Commissions" value={`$${(finance?.total_commissions_paid || 0).toFixed(2)}`} color="blue" />
          </div>

          {/* Transaction Volume Chart */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Transaction Activity</h3>
              <Badge className="bg-green-500/20 text-green-400">{totalTransactions} total</Badge>
            </div>
            <div className="h-48 flex items-end gap-1">
              {analytics?.transactions?.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t hover:from-purple-500 hover:to-purple-300 transition-colors"
                    style={{ 
                      height: `${Math.max(4, (day.count / Math.max(...analytics.transactions.map(d => d.count || 1))) * 160)}px` 
                    }}
                    title={`${day._id}: ${day.count} transactions, volume: ${day.volume}`}
                  />
                </div>
              ))}
            </div>
            {analytics?.transactions?.length > 0 && (
              <div className="flex justify-between mt-2 text-xs text-slate-500">
                <span>{analytics.transactions[0]?._id}</span>
                <span>{analytics.transactions[analytics.transactions.length - 1]?._id}</span>
              </div>
            )}
          </div>

          {/* Transaction Breakdown */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">Daily Transaction Volume</h3>
            </div>
            <div className="divide-y divide-slate-700 max-h-80 overflow-y-auto">
              {analytics?.transactions?.map((day, i) => (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-purple-400" />
                    </div>
                    <span className="text-white">{day._id}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-white font-bold">{day.count} txns</p>
                      <p className="text-xs text-slate-500">Volume: {day.volume?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(!analytics?.transactions || analytics.transactions.length === 0) && (
                <div className="p-8 text-center text-slate-400">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No transaction data available for this period</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* System Health Tab */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {health ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard icon={Database} label="Collections" value={health.database?.collections || 0} color="blue" />
                <MetricCard icon={Server} label="Data Size" value={`${health.database?.data_size_mb || 0} MB`} color="green" />
                <MetricCard icon={Users} label="Total Users" value={health.users?.total || 0} color="purple" />
                <MetricCard icon={Activity} label="Active (24h)" value={health.users?.active_24h || 0} color="amber" />
              </div>

              {/* Database Stats */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-400" />
                  Database Health
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Collections</p>
                    <p className="text-2xl font-bold text-white">{health.database?.collections || 0}</p>
                  </div>
                  <div className="p-4 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Data Size</p>
                    <p className="text-2xl font-bold text-white">{health.database?.data_size_mb || 0} MB</p>
                  </div>
                  <div className="p-4 bg-slate-700/30 rounded-lg">
                    <p className="text-sm text-slate-400">Storage Size</p>
                    <p className="text-2xl font-bold text-white">{health.database?.storage_size_mb || 0} MB</p>
                  </div>
                </div>
              </div>

              {/* User Stats */}
              <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Users className="w-5 h-5 text-green-400" />
                  User Statistics
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-sm text-green-400">Total Users</p>
                    <p className="text-2xl font-bold text-white">{health.users?.total || 0}</p>
                  </div>
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-blue-400">Active (24h)</p>
                    <p className="text-2xl font-bold text-white">{health.users?.active_24h || 0}</p>
                  </div>
                  <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <p className="text-sm text-purple-400">Transactions (24h)</p>
                    <p className="text-2xl font-bold text-white">{health.transactions?.last_24h || 0}</p>
                  </div>
                </div>
              </div>

              {/* Timestamp */}
              <div className="text-center text-sm text-slate-500">
                Last updated: {health.timestamp ? new Date(health.timestamp).toLocaleString() : 'N/A'}
              </div>
            </>
          ) : (
            <div className="bg-slate-800 rounded-xl border border-yellow-500/30 p-8 text-center">
              <AlertCircle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">System Health Unavailable</h3>
              <p className="text-slate-400">You may not have permission to view system health metrics.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper Components
function MetricCard({ icon: Icon, label, value, subtext, growth, color }) {
  const colorClasses = {
    blue: 'from-blue-600/20 to-blue-800/20 border-blue-500/30',
    green: 'from-green-600/20 to-green-800/20 border-green-500/30',
    purple: 'from-purple-600/20 to-purple-800/20 border-purple-500/30',
    amber: 'from-amber-600/20 to-amber-800/20 border-amber-500/30',
    cyan: 'from-cyan-600/20 to-cyan-800/20 border-cyan-500/30',
    yellow: 'from-yellow-600/20 to-yellow-800/20 border-yellow-500/30',
  };
  
  const iconColors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
    yellow: 'text-yellow-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl border p-5`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-8 h-8 ${iconColors[color]}`} />
        {growth !== undefined && (
          <span className={`flex items-center text-sm font-medium ${growth > 0 ? 'text-green-400' : growth < 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {growth > 0 ? <ArrowUp className="w-3 h-3 mr-1" /> : growth < 0 ? <ArrowDown className="w-3 h-3 mr-1" /> : <Minus className="w-3 h-3 mr-1" />}
            {growth > 0 ? '+' : ''}{growth}%
          </span>
        )}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      <p className={`${iconColors[color]} text-sm`}>{label}</p>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  );
}
