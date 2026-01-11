import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  BarChart3, TrendingUp, Users, ShoppingBag, Coins,
  Calendar, RefreshCw, ArrowUp, ArrowDown, Minus
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminAnalytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');

  useEffect(() => {
    loadStats();
  }, [period]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      
      // Get dashboard stats
      const response = await fetch(`${API_BASE}/api/admin-system/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      
      // Calculate growth (mock for now)
      const growth = {
        users: Math.random() > 0.5 ? Math.floor(Math.random() * 20) : -Math.floor(Math.random() * 10),
        posts: Math.floor(Math.random() * 30) + 5,
        listings: Math.floor(Math.random() * 15) - 5,
        coins: Math.floor(Math.random() * 1000) + 100,
      };
      
      setStats({ ...data, growth });
    } catch (error) {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const GrowthIndicator = ({ value }) => {
    if (value > 0) return <span className="flex items-center text-green-400 text-sm"><ArrowUp className="w-3 h-3" /> +{value}%</span>;
    if (value < 0) return <span className="flex items-center text-red-400 text-sm"><ArrowDown className="w-3 h-3" /> {value}%</span>;
    return <span className="flex items-center text-slate-400 text-sm"><Minus className="w-3 h-3" /> 0%</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Analytics Dashboard
          </h1>
          <p className="text-slate-400">Platform performance metrics</p>
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
            <option value="90d">Last 90 Days</option>
          </select>
          <Button onClick={loadStats} variant="ghost" size="icon" className="text-slate-400">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-xl border border-blue-500/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <Users className="w-8 h-8 text-blue-400" />
            <GrowthIndicator value={stats?.growth?.users} />
          </div>
          <p className="text-3xl font-bold text-white">{stats?.users?.total?.toLocaleString() || 0}</p>
          <p className="text-blue-300 text-sm">Total Users</p>
          <p className="text-xs text-slate-400 mt-1">+{stats?.users?.new_7d || 0} this week</p>
        </div>

        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-xl border border-green-500/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-8 h-8 text-green-400" />
            <GrowthIndicator value={stats?.growth?.posts} />
          </div>
          <p className="text-3xl font-bold text-white">{stats?.content?.posts?.toLocaleString() || 0}</p>
          <p className="text-green-300 text-sm">Total Posts</p>
          <p className="text-xs text-slate-400 mt-1">User engagement</p>
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-xl border border-purple-500/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <ShoppingBag className="w-8 h-8 text-purple-400" />
            <GrowthIndicator value={stats?.growth?.listings} />
          </div>
          <p className="text-3xl font-bold text-white">{stats?.content?.listings?.toLocaleString() || 0}</p>
          <p className="text-purple-300 text-sm">Marketplace Listings</p>
          <p className="text-xs text-slate-400 mt-1">Active products</p>
        </div>

        <div className="bg-gradient-to-br from-amber-600/20 to-amber-800/20 rounded-xl border border-amber-500/30 p-5">
          <div className="flex items-center justify-between mb-3">
            <Coins className="w-8 h-8 text-amber-400" />
            <GrowthIndicator value={stats?.growth?.coins} />
          </div>
          <p className="text-3xl font-bold text-white">{stats?.financial?.total_bl_coins?.toLocaleString() || 0}</p>
          <p className="text-amber-300 text-sm">BL Coins in Circulation</p>
          <p className="text-xs text-slate-400 mt-1">Virtual currency</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart (Mock) */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4">User Growth</h3>
          <div className="h-48 flex items-end gap-2">
            {[30, 45, 35, 55, 48, 60, 72].map((val, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full bg-blue-500/50 rounded-t"
                  style={{ height: `${val * 2}px` }}
                />
                <span className="text-xs text-slate-500">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Breakdown */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h3 className="font-semibold text-white mb-4">Activity Breakdown</h3>
          <div className="space-y-4">
            {[
              { label: 'Posts Created', value: stats?.content?.posts || 0, color: 'bg-blue-500', percent: 35 },
              { label: 'Listings Added', value: stats?.content?.listings || 0, color: 'bg-green-500', percent: 25 },
              { label: 'Albums Created', value: stats?.content?.albums || 0, color: 'bg-purple-500', percent: 20 },
              { label: 'Messages Sent', value: 0, color: 'bg-pink-500', percent: 20 },
            ].map((item, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="text-white font-medium">{item.value.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User Status */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
        <h3 className="font-semibold text-white mb-4">User Status Distribution</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/30">
            <p className="text-2xl font-bold text-green-400">
              {(stats?.users?.total || 0) - (stats?.users?.suspended || 0) - (stats?.users?.banned || 0)}
            </p>
            <p className="text-sm text-slate-400">Active</p>
          </div>
          <div className="text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
            <p className="text-2xl font-bold text-yellow-400">{stats?.users?.suspended || 0}</p>
            <p className="text-sm text-slate-400">Suspended</p>
          </div>
          <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/30">
            <p className="text-2xl font-bold text-red-400">{stats?.users?.banned || 0}</p>
            <p className="text-sm text-slate-400">Banned</p>
          </div>
          <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
            <p className="text-2xl font-bold text-blue-400">{stats?.admins?.total || 0}</p>
            <p className="text-sm text-slate-400">Admins</p>
          </div>
        </div>
      </div>
    </div>
  );
}
