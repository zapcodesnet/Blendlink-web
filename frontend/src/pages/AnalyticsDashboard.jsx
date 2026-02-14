import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { AuthContext } from "../App";
import { toast } from "sonner";
import { getApiUrl } from "../utils/runtimeConfig";
import {
  TrendingUp,
  TrendingDown,
  Users,
  MessageCircle,
  ThumbsUp,
  Share2,
  Eye,
  Coins,
  Trophy,
  Calendar,
  Clock,
  Sparkles,
  Bell,
  ChevronRight,
  BarChart3,
  Activity,
  Loader2,
} from "lucide-react";

const API_BASE_URL = getApiUrl();

// API helper
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}/api${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  return response.json();
};

// Stat Card Component
const StatCard = ({ title, value, change, icon: Icon, color = "blue" }) => {
  const isPositive = change >= 0;
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-500",
    green: "bg-green-500/10 text-green-500",
    amber: "bg-amber-500/10 text-amber-500",
    purple: "bg-purple-500/10 text-purple-500",
    red: "bg-red-500/10 text-red-500",
  };

  return (
    <Card className="bg-card border-border" data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center mt-1 text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                <span>{isPositive ? '+' : ''}{change}%</span>
                <span className="text-muted-foreground ml-1">vs last week</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Leaderboard Card Component
const LeaderboardCard = ({ leaderboard, metric, currentUserRank }) => {
  const metricLabels = {
    bl_coins_earned: "BL Coins Earned",
    posts_created: "Posts Created",
    reactions_received: "Reactions Received",
    comments_received: "Comments Received",
    friends_added: "Friends Added",
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-amber-500" />
          {metricLabels[metric] || metric} Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leaderboard.slice(0, 5).map((entry, i) => (
            <div
              key={entry.user_id}
              className={`flex items-center justify-between p-2 rounded-lg ${
                entry.is_current_user ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                  i === 0 ? 'bg-amber-500 text-white' :
                  i === 1 ? 'bg-gray-300 text-gray-700' :
                  i === 2 ? 'bg-amber-700 text-white' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {entry.rank}
                </span>
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  {entry.avatar ? (
                    <img src={entry.avatar} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <span className="text-sm font-medium">{entry.name?.[0]}</span>
                  )}
                </div>
                <span className={`font-medium ${entry.is_current_user ? 'text-primary' : ''}`}>
                  {entry.name} {entry.is_current_user && '(You)'}
                </span>
              </div>
              <span className="font-bold text-amber-500">
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
              </span>
            </div>
          ))}
        </div>
        
        {currentUserRank && !leaderboard.some(l => l.is_current_user) && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                  {currentUserRank.rank}
                </span>
                <span className="font-medium text-primary">Your Rank</span>
              </div>
              <span className="font-bold text-amber-500">{currentUserRank.value.toLocaleString()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Trend Chart Component (Simple)
const TrendChart = ({ data, label, color = "#3B82F6" }) => {
  if (!data || data.length === 0) return null;
  
  const max = Math.max(...data, 1);
  const chartHeight = 100;
  
  return (
    <div className="mt-4">
      <div className="flex items-end space-x-1 h-24">
        {data.map((value, i) => (
          <div
            key={i}
            className="flex-1 rounded-t transition-all duration-300 hover:opacity-80"
            style={{
              height: `${(value / max) * chartHeight}%`,
              backgroundColor: color,
              minHeight: '4px',
            }}
            title={`${value}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">{label}</p>
    </div>
  );
};

// Main Analytics Dashboard
export default function AnalyticsDashboard() {
  const { user } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const [summaryData, statsData, trendsData, leaderboardData] = await Promise.all([
        apiRequest('/analytics/summary'),
        apiRequest(`/analytics/my-stats?days=${selectedPeriod}`),
        apiRequest(`/analytics/trends?days=${selectedPeriod}`),
        apiRequest('/analytics/leaderboard?metric=bl_coins_earned&days=7'),
      ]);
      
      setSummary(summaryData);
      setStats(statsData);
      setTrends(trendsData);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const periodTotals = stats?.period_totals || {};
  const weekChange = trends?.week_over_week_change?.bl_coins || 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-6" data-testid="analytics-dashboard">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Track your performance and engagement</p>
          </div>
          
          {/* Period Selector */}
          <div className="flex items-center space-x-2 mt-4 md:mt-0">
            {[7, 30, 90].map((days) => (
              <Button
                key={days}
                variant={selectedPeriod === days ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(days)}
              >
                {days}D
              </Button>
            ))}
          </div>
        </div>

        {/* Quick Summary */}
        <Card className="bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20 mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Coins className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                <p className="text-2xl font-bold text-amber-500">{summary?.bl_coins_balance?.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Total BL Coins</p>
              </div>
              <div className="text-center">
                <TrendingUp className="w-8 h-8 mx-auto text-green-500 mb-2" />
                <p className="text-2xl font-bold text-green-500">+{summary?.today_earned?.toLocaleString() || 0}</p>
                <p className="text-sm text-muted-foreground">Earned Today</p>
              </div>
              <div className="text-center">
                <Activity className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                <p className="text-2xl font-bold text-blue-500">{summary?.today_engagement || 0}</p>
                <p className="text-sm text-muted-foreground">Engagement Today</p>
              </div>
              <div className="text-center">
                <Bell className="w-8 h-8 mx-auto text-purple-500 mb-2" />
                <p className="text-2xl font-bold text-purple-500">{summary?.unread_notifications || 0}</p>
                <p className="text-sm text-muted-foreground">Notifications</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Posts Created"
            value={periodTotals.posts_created || 0}
            icon={MessageCircle}
            color="blue"
          />
          <StatCard
            title="Reactions Received"
            value={periodTotals.reactions_received || 0}
            icon={ThumbsUp}
            color="amber"
          />
          <StatCard
            title="Comments Received"
            value={periodTotals.comments_received || 0}
            icon={MessageCircle}
            color="green"
          />
          <StatCard
            title="Profile Views"
            value={periodTotals.profile_views || 0}
            icon={Eye}
            color="purple"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Stories Created"
            value={periodTotals.stories_created || 0}
            icon={Clock}
            color="blue"
          />
          <StatCard
            title="Shares Made"
            value={periodTotals.shares_made || 0}
            icon={Share2}
            color="green"
          />
          <StatCard
            title="Friends Added"
            value={periodTotals.friends_added || 0}
            icon={Users}
            color="purple"
          />
          <StatCard
            title="BL Coins Earned"
            value={periodTotals.bl_coins_earned?.toLocaleString() || 0}
            change={weekChange}
            icon={Coins}
            color="amber"
          />
        </div>

        {/* Charts and Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Trends */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Activity Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-center mb-2">BL Coins Earned</h4>
                  <TrendChart 
                    data={trends?.bl_coins_trend || []} 
                    label="Last 30 days"
                    color="#F59E0B"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-center mb-2">Engagement</h4>
                  <TrendChart 
                    data={trends?.engagement_trend || []} 
                    label="Reactions + Comments"
                    color="#10B981"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-center mb-2">Content Created</h4>
                  <TrendChart 
                    data={trends?.content_trend || []} 
                    label="Posts + Stories"
                    color="#3B82F6"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          {leaderboard && (
            <LeaderboardCard
              leaderboard={leaderboard.leaderboard}
              metric={leaderboard.metric}
              currentUserRank={leaderboard.current_user_rank}
            />
          )}
        </div>

        {/* All-Time Stats */}
        <Card className="bg-card border-border mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="w-5 h-5 mr-2 text-amber-500" />
              All-Time Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{stats?.all_time_stats?.total_posts || 0}</p>
                <p className="text-sm text-muted-foreground">Total Posts</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{stats?.all_time_stats?.total_comments || 0}</p>
                <p className="text-sm text-muted-foreground">Total Comments</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{stats?.all_time_stats?.total_reactions || 0}</p>
                <p className="text-sm text-muted-foreground">Total Reactions</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{stats?.all_time_stats?.total_friends || 0}</p>
                <p className="text-sm text-muted-foreground">Total Friends</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold text-amber-500">
                  {stats?.all_time_stats?.bl_coins_balance?.toLocaleString() || 0}
                </p>
                <p className="text-sm text-muted-foreground">BL Coins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Rate */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Engagement Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto rounded-full border-4 border-primary flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold">{stats?.engagement_rate || 0}%</span>
                </div>
                <p className="text-sm text-muted-foreground">Engagement Rate</p>
                <p className="text-xs text-muted-foreground mt-1">
                  (Reactions + Comments) / Content
                </p>
              </div>
              <div className="text-center">
                <div className="w-24 h-24 mx-auto rounded-full border-4 border-green-500 flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold">{periodTotals.reactions_given || 0}</span>
                </div>
                <p className="text-sm text-muted-foreground">Reactions Given</p>
                <p className="text-xs text-muted-foreground mt-1">
                  +{periodTotals.reactions_given * 10 || 0} BL Coins earned
                </p>
              </div>
              <div className="text-center">
                <div className="w-24 h-24 mx-auto rounded-full border-4 border-purple-500 flex items-center justify-center mb-2">
                  <span className="text-2xl font-bold">{periodTotals.ai_images_generated + periodTotals.ai_videos_generated || 0}</span>
                </div>
                <p className="text-sm text-muted-foreground">AI Content Generated</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Images: {periodTotals.ai_images_generated || 0} | Videos: {periodTotals.ai_videos_generated || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
