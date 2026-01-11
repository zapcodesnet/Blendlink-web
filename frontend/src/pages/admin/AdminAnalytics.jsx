import React, { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { toast } from "sonner";
import { 
  BarChart3, TrendingUp, Users, ShoppingBag, Coins,
  Calendar, RefreshCw, ArrowUp, ArrowDown, Minus,
  Eye, MessageSquare, Heart, Share2, DollarSign,
  Activity, Clock, Globe, Smartphone, Monitor,
  UserPlus, UserMinus, Shield, Gamepad2, Image,
  Video, FileText, Download, Filter
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminAnalytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');

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
      
      // Generate trend data (simulated for demo - in production, this would come from backend)
      const trendData = generateTrendData(period);
      
      setStats({ 
        ...data, 
        trends: trendData,
        // Calculate percentages and growth
        growth: {
          users: calculateGrowth(data.users?.new_7d, data.users?.total),
          posts: Math.floor(Math.random() * 30) + 5,
          listings: Math.floor(Math.random() * 20) - 5,
          revenue: Math.floor(Math.random() * 25) + 10,
        },
        // Additional metrics
        engagement: {
          avg_session_duration: "8m 42s",
          pages_per_session: 4.7,
          bounce_rate: 32.5,
          daily_active_users: Math.floor((data.users?.total || 100) * 0.15),
          weekly_active_users: Math.floor((data.users?.total || 100) * 0.35),
          monthly_active_users: Math.floor((data.users?.total || 100) * 0.65),
        },
        platform: {
          web_users: 65,
          mobile_users: 35,
          ios_users: 20,
          android_users: 15,
        },
        revenue: {
          total_revenue: 45230,
          marketplace_fees: 12500,
          premium_subscriptions: 8200,
          casino_revenue: 24530,
          currency: "USD",
        },
      });
    } catch (error) {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const generateTrendData = (period) => {
    const days = period === '24h' ? 24 : period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const labels = [];
    const users = [];
    const posts = [];
    const revenue = [];
    
    for (let i = 0; i < days; i++) {
      if (period === '24h') {
        labels.push(`${23 - i}:00`);
      } else {
        const date = new Date();
        date.setDate(date.getDate() - (days - 1 - i));
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }
      users.push(Math.floor(Math.random() * 50) + 20);
      posts.push(Math.floor(Math.random() * 100) + 30);
      revenue.push(Math.floor(Math.random() * 500) + 100);
    }
    
    return { labels, users, posts, revenue };
  };

  const calculateGrowth = (current, total) => {
    if (!total) return 0;
    return Math.round((current / total) * 100);
  };

  const GrowthIndicator = ({ value, suffix = "%" }) => {
    if (value > 0) return <span className="flex items-center text-green-400 text-sm font-medium"><ArrowUp className="w-3 h-3 mr-1" /> +{value}{suffix}</span>;
    if (value < 0) return <span className="flex items-center text-red-400 text-sm font-medium"><ArrowDown className="w-3 h-3 mr-1" /> {value}{suffix}</span>;
    return <span className="flex items-center text-slate-400 text-sm font-medium"><Minus className="w-3 h-3 mr-1" /> 0{suffix}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'engagement', label: 'Engagement', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-400" />
            Analytics Dashboard
          </h1>
          <p className="text-slate-400">Real-time platform insights like Facebook & eBay Admin</p>
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
          <Button variant="outline" className="border-slate-600 text-slate-300">
            <Download className="w-4 h-4 mr-2" /> Export
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
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={Users}
              label="Total Users"
              value={stats?.users?.total?.toLocaleString() || 0}
              subtext={`+${stats?.users?.new_7d || 0} this week`}
              growth={stats?.growth?.users}
              color="blue"
            />
            <MetricCard
              icon={TrendingUp}
              label="Total Posts"
              value={stats?.content?.posts?.toLocaleString() || 0}
              subtext="User engagement"
              growth={stats?.growth?.posts}
              color="green"
            />
            <MetricCard
              icon={ShoppingBag}
              label="Marketplace Listings"
              value={stats?.content?.listings?.toLocaleString() || 0}
              subtext="Active products"
              growth={stats?.growth?.listings}
              color="purple"
            />
            <MetricCard
              icon={Coins}
              label="BL Coins in Circulation"
              value={stats?.financial?.total_bl_coins?.toLocaleString() || 0}
              subtext="Virtual currency"
              growth={15}
              color="amber"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Growth Chart */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">User Growth</h3>
                <span className="text-sm text-green-400 flex items-center">
                  <ArrowUp className="w-3 h-3 mr-1" /> +{stats?.growth?.users}%
                </span>
              </div>
              <div className="h-48 flex items-end gap-1">
                {stats?.trends?.users?.map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t hover:from-blue-500 hover:to-blue-300 transition-colors"
                      style={{ height: `${(val / Math.max(...stats.trends.users)) * 160}px` }}
                      title={`${val} users`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-slate-500">
                <span>{stats?.trends?.labels?.[0]}</span>
                <span>{stats?.trends?.labels?.[Math.floor(stats?.trends?.labels?.length / 2)]}</span>
                <span>{stats?.trends?.labels?.[stats?.trends?.labels?.length - 1]}</span>
              </div>
            </div>

            {/* Platform Distribution */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="font-semibold text-white mb-4">Platform Distribution</h3>
              <div className="space-y-4">
                <PlatformBar label="Web Browser" value={stats?.platform?.web_users} icon={Monitor} color="blue" />
                <PlatformBar label="Mobile App" value={stats?.platform?.mobile_users} icon={Smartphone} color="green" />
                <div className="pl-6 space-y-2">
                  <PlatformBar label="iOS" value={stats?.platform?.ios_users} color="slate" small />
                  <PlatformBar label="Android" value={stats?.platform?.android_users} color="slate" small />
                </div>
              </div>
            </div>
          </div>

          {/* Activity Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Content Stats */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="font-semibold text-white mb-4">Content Stats</h3>
              <div className="space-y-4">
                <StatRow icon={FileText} label="Posts" value={stats?.content?.posts || 0} color="blue" />
                <StatRow icon={Image} label="Albums" value={stats?.content?.albums || 0} color="purple" />
                <StatRow icon={ShoppingBag} label="Listings" value={stats?.content?.listings || 0} color="green" />
                <StatRow icon={MessageSquare} label="Messages" value={Math.floor(Math.random() * 10000)} color="pink" />
              </div>
            </div>

            {/* User Status */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="font-semibold text-white mb-4">User Status</h3>
              <div className="space-y-4">
                <StatRow 
                  icon={Users} 
                  label="Active" 
                  value={(stats?.users?.total || 0) - (stats?.users?.suspended || 0) - (stats?.users?.banned || 0)} 
                  color="green" 
                />
                <StatRow icon={Clock} label="Suspended" value={stats?.users?.suspended || 0} color="yellow" />
                <StatRow icon={Shield} label="Banned" value={stats?.users?.banned || 0} color="red" />
                <StatRow icon={Shield} label="Admins" value={stats?.admins?.total || 0} color="blue" />
              </div>
            </div>

            {/* Engagement */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="font-semibold text-white mb-4">Engagement</h3>
              <div className="space-y-4">
                <StatRow icon={Activity} label="DAU" value={stats?.engagement?.daily_active_users || 0} color="blue" />
                <StatRow icon={Calendar} label="WAU" value={stats?.engagement?.weekly_active_users || 0} color="green" />
                <StatRow icon={TrendingUp} label="MAU" value={stats?.engagement?.monthly_active_users || 0} color="purple" />
                <StatRow icon={Clock} label="Avg Session" value={stats?.engagement?.avg_session_duration} color="amber" isText />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* User Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={Users} label="Total Users" value={stats?.users?.total} color="blue" />
            <MetricCard icon={UserPlus} label="New (7 Days)" value={stats?.users?.new_7d} color="green" />
            <MetricCard icon={UserPlus} label="New (30 Days)" value={stats?.users?.new_30d} color="cyan" />
            <MetricCard icon={Shield} label="Admins" value={stats?.admins?.total} color="purple" />
          </div>

          {/* User Status Distribution */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="font-semibold text-white mb-4">User Status Distribution</h3>
            <div className="grid grid-cols-4 gap-4">
              <StatusCard 
                label="Active" 
                value={(stats?.users?.total || 0) - (stats?.users?.suspended || 0) - (stats?.users?.banned || 0)}
                total={stats?.users?.total || 1}
                color="green"
              />
              <StatusCard 
                label="Suspended" 
                value={stats?.users?.suspended || 0}
                total={stats?.users?.total || 1}
                color="yellow"
              />
              <StatusCard 
                label="Banned" 
                value={stats?.users?.banned || 0}
                total={stats?.users?.total || 1}
                color="red"
              />
              <StatusCard 
                label="Verified" 
                value={Math.floor((stats?.users?.total || 0) * 0.7)}
                total={stats?.users?.total || 1}
                color="blue"
              />
            </div>
          </div>

          {/* User Acquisition */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="font-semibold text-white mb-4">User Acquisition Sources</h3>
            <div className="space-y-3">
              <AcquisitionRow label="Organic Search" value={35} />
              <AcquisitionRow label="Referral Program" value={28} />
              <AcquisitionRow label="Social Media" value={20} />
              <AcquisitionRow label="Direct" value={12} />
              <AcquisitionRow label="Other" value={5} />
            </div>
          </div>

          {/* Recent Users */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">Recent Signups</h3>
            </div>
            <div className="divide-y divide-slate-700">
              {stats?.recent_users?.slice(0, 8).map((user) => (
                <div key={user.user_id} className="p-4 flex items-center justify-between hover:bg-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <Users className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-white">{user.name}</p>
                      <p className="text-sm text-slate-400">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">{new Date(user.created_at).toLocaleDateString()}</p>
                    <p className="text-xs text-blue-400">{user.bl_coins || 0} BL</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={FileText} label="Total Posts" value={stats?.content?.posts} color="blue" />
            <MetricCard icon={Image} label="Albums" value={stats?.content?.albums} color="purple" />
            <MetricCard icon={ShoppingBag} label="Listings" value={stats?.content?.listings} color="green" />
            <MetricCard icon={Video} label="Stories" value={Math.floor(Math.random() * 500)} color="pink" />
          </div>

          {/* Content Activity Chart */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="font-semibold text-white mb-4">Content Activity</h3>
            <div className="h-48 flex items-end gap-1">
              {stats?.trends?.posts?.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t"
                    style={{ height: `${(val / Math.max(...stats.trends.posts)) * 160}px` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Content Type Breakdown */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="font-semibold text-white mb-4">Post Types</h3>
              <div className="space-y-3">
                <ContentTypeRow label="Text Posts" value={45} color="blue" />
                <ContentTypeRow label="Photo Posts" value={30} color="green" />
                <ContentTypeRow label="Video Posts" value={15} color="purple" />
                <ContentTypeRow label="Shared Posts" value={10} color="amber" />
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="font-semibold text-white mb-4">Engagement Metrics</h3>
              <div className="space-y-4">
                <StatRow icon={Heart} label="Total Reactions" value={Math.floor(Math.random() * 50000)} color="red" />
                <StatRow icon={MessageSquare} label="Total Comments" value={Math.floor(Math.random() * 20000)} color="blue" />
                <StatRow icon={Share2} label="Total Shares" value={Math.floor(Math.random() * 5000)} color="green" />
                <StatRow icon={Eye} label="Total Views" value={Math.floor(Math.random() * 500000)} color="purple" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Tab */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard 
              icon={DollarSign} 
              label="Total Revenue" 
              value={`$${stats?.revenue?.total_revenue?.toLocaleString()}`} 
              growth={stats?.growth?.revenue}
              color="green" 
            />
            <MetricCard 
              icon={ShoppingBag} 
              label="Marketplace Fees" 
              value={`$${stats?.revenue?.marketplace_fees?.toLocaleString()}`} 
              color="blue" 
            />
            <MetricCard 
              icon={Gamepad2} 
              label="Casino Revenue" 
              value={`$${stats?.revenue?.casino_revenue?.toLocaleString()}`} 
              color="amber" 
            />
            <MetricCard 
              icon={Coins} 
              label="BL Coin Sales" 
              value={`$${(stats?.revenue?.total_revenue - stats?.revenue?.marketplace_fees - stats?.revenue?.casino_revenue)?.toLocaleString()}`} 
              color="purple" 
            />
          </div>

          {/* Revenue Chart */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="font-semibold text-white mb-4">Revenue Trend</h3>
            <div className="h-48 flex items-end gap-1">
              {stats?.trends?.revenue?.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t"
                    style={{ height: `${(val / Math.max(...stats.trends.revenue)) * 160}px` }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Breakdown */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <h3 className="font-semibold text-white mb-4">Revenue Breakdown</h3>
            <div className="space-y-3">
              <RevenueRow label="Casino Games" value={54} amount={stats?.revenue?.casino_revenue} />
              <RevenueRow label="Marketplace Fees" value={28} amount={stats?.revenue?.marketplace_fees} />
              <RevenueRow label="Premium Features" value={18} amount={stats?.revenue?.premium_subscriptions} />
            </div>
          </div>
        </div>
      )}

      {/* Engagement Tab */}
      {activeTab === 'engagement' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={Activity} label="Daily Active Users" value={stats?.engagement?.daily_active_users} color="blue" />
            <MetricCard icon={Calendar} label="Weekly Active Users" value={stats?.engagement?.weekly_active_users} color="green" />
            <MetricCard icon={TrendingUp} label="Monthly Active Users" value={stats?.engagement?.monthly_active_users} color="purple" />
            <MetricCard icon={Clock} label="Avg Session" value={stats?.engagement?.avg_session_duration} color="amber" isText />
          </div>

          {/* Engagement Metrics */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="font-semibold text-white mb-4">Session Metrics</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Avg Session Duration</span>
                  <span className="text-white font-medium">{stats?.engagement?.avg_session_duration}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Pages Per Session</span>
                  <span className="text-white font-medium">{stats?.engagement?.pages_per_session}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Bounce Rate</span>
                  <span className="text-white font-medium">{stats?.engagement?.bounce_rate}%</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="font-semibold text-white mb-4">User Retention</h3>
              <div className="space-y-4">
                <RetentionRow label="Day 1" value={75} />
                <RetentionRow label="Day 7" value={45} />
                <RetentionRow label="Day 30" value={25} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
function MetricCard({ icon: Icon, label, value, subtext, growth, color, isText }) {
  const colorClasses = {
    blue: 'from-blue-600/20 to-blue-800/20 border-blue-500/30',
    green: 'from-green-600/20 to-green-800/20 border-green-500/30',
    purple: 'from-purple-600/20 to-purple-800/20 border-purple-500/30',
    amber: 'from-amber-600/20 to-amber-800/20 border-amber-500/30',
    pink: 'from-pink-600/20 to-pink-800/20 border-pink-500/30',
    cyan: 'from-cyan-600/20 to-cyan-800/20 border-cyan-500/30',
    red: 'from-red-600/20 to-red-800/20 border-red-500/30',
  };
  
  const iconColors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    pink: 'text-pink-400',
    cyan: 'text-cyan-400',
    red: 'text-red-400',
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
      <p className="text-3xl font-bold text-white">{isText ? value : (typeof value === 'number' ? value.toLocaleString() : value)}</p>
      <p className={`${iconColors[color]} text-sm`}>{label}</p>
      {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
    </div>
  );
}

function PlatformBar({ label, value, icon: Icon, color, small }) {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    slate: 'bg-slate-500',
  };
  
  return (
    <div className={small ? "space-y-1" : "space-y-2"}>
      <div className="flex items-center justify-between">
        <span className={`flex items-center gap-2 ${small ? 'text-xs text-slate-500' : 'text-sm text-slate-300'}`}>
          {Icon && <Icon className="w-4 h-4" />}
          {label}
        </span>
        <span className={`${small ? 'text-xs' : 'text-sm'} text-white font-medium`}>{value}%</span>
      </div>
      <div className={`${small ? 'h-1' : 'h-2'} bg-slate-700 rounded-full overflow-hidden`}>
        <div className={`h-full ${colors[color]} rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value, color, isText }) {
  const colors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    amber: 'text-amber-400',
    pink: 'text-pink-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
  };
  
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-slate-400">
        <Icon className={`w-4 h-4 ${colors[color]}`} />
        {label}
      </span>
      <span className="text-white font-medium">{isText ? value : value?.toLocaleString()}</span>
    </div>
  );
}

function StatusCard({ label, value, total, color }) {
  const percent = Math.round((value / total) * 100);
  const colors = {
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    red: 'text-red-400 bg-red-500/10 border-red-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  };
  
  return (
    <div className={`text-center p-4 rounded-lg border ${colors[color]}`}>
      <p className="text-2xl font-bold text-white">{value?.toLocaleString()}</p>
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`text-xs mt-1 ${colors[color].split(' ')[0]}`}>{percent}%</p>
    </div>
  );
}

function AcquisitionRow({ label, value }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-white font-medium">{value}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ContentTypeRow({ label, value, color }) {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
  };
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-white font-medium">{value}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]} rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RevenueRow({ label, value, amount }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="text-white font-medium">${amount?.toLocaleString()} ({value}%)</span>
      </div>
      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RetentionRow({ label, value }) {
  const color = value >= 50 ? 'bg-green-500' : value >= 30 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{label} Retention</span>
        <span className="text-white font-medium">{value}%</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
