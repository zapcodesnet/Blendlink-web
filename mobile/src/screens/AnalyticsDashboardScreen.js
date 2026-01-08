/**
 * Analytics Dashboard Screen for Blendlink Mobile
 * Detailed user analytics and engagement tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { analyticsAPI } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Stat Card Component
const StatCard = ({ title, value, icon, color = '#3B82F6', change }) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
      <Text style={styles.statIcon}>{icon}</Text>
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
    {change !== undefined && (
      <Text style={[styles.statChange, { color: change >= 0 ? '#10B981' : '#EF4444' }]}>
        {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
      </Text>
    )}
  </View>
);

// Simple Bar Chart Component
const SimpleBarChart = ({ data, label, color = '#3B82F6' }) => {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);

  return (
    <View style={styles.chartContainer}>
      <View style={styles.barsContainer}>
        {data.slice(-14).map((value, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: `${Math.max((value / max) * 100, 5)}%`,
                backgroundColor: color,
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.chartLabel}>{label}</Text>
    </View>
  );
};

// Leaderboard Item
const LeaderboardItem = ({ entry, rank }) => (
  <View style={[styles.leaderboardItem, entry.is_current_user && styles.leaderboardItemHighlighted]}>
    <View style={styles.leaderboardRank}>
      <Text style={[
        styles.leaderboardRankText,
        rank === 1 && { color: '#F59E0B' },
        rank === 2 && { color: '#9CA3AF' },
        rank === 3 && { color: '#B45309' },
      ]}>
        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
      </Text>
    </View>
    <View style={styles.leaderboardAvatar}>
      <Text style={styles.leaderboardAvatarText}>{entry.name?.[0] || '?'}</Text>
    </View>
    <Text style={[styles.leaderboardName, entry.is_current_user && { color: '#3B82F6' }]}>
      {entry.name} {entry.is_current_user && '(You)'}
    </Text>
    <Text style={styles.leaderboardValue}>{entry.value.toLocaleString()}</Text>
  </View>
);

// Main Analytics Dashboard Screen
export default function AnalyticsDashboardScreen({ navigation }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  const loadAnalytics = useCallback(async () => {
    try {
      const [summaryData, statsData, trendsData, leaderboardData] = await Promise.all([
        analyticsAPI.getSummary(),
        analyticsAPI.getMyStats(selectedPeriod),
        analyticsAPI.getTrends(selectedPeriod),
        analyticsAPI.getLeaderboard('bl_coins_earned', 7, 10),
      ]);

      setSummary(summaryData);
      setStats(statsData);
      setTrends(trendsData);
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadAnalytics();
      setIsLoading(false);
    };
    init();
  }, [loadAnalytics]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAnalytics();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const periodTotals = stats?.period_totals || {};
  const weekChange = trends?.week_over_week_change?.bl_coins || 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={styles.periodSelector}>
            {[7, 30, 90].map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.periodButton,
                  selectedPeriod === days && styles.periodButtonActive,
                ]}
                onPress={() => setSelectedPeriod(days)}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    selectedPeriod === days && styles.periodButtonTextActive,
                  ]}
                >
                  {days}D
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryEmoji}>🪙</Text>
            <Text style={styles.summaryValue}>{summary?.bl_coins_balance?.toLocaleString() || 0}</Text>
            <Text style={styles.summaryLabel}>Total BL Coins</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryEmoji}>📈</Text>
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>
              +{summary?.today_earned?.toLocaleString() || 0}
            </Text>
            <Text style={styles.summaryLabel}>Earned Today</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryEmoji}>🔔</Text>
            <Text style={[styles.summaryValue, { color: '#8B5CF6' }]}>
              {summary?.unread_notifications || 0}
            </Text>
            <Text style={styles.summaryLabel}>Notifications</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard title="Posts" value={periodTotals.posts_created || 0} icon="📝" color="#3B82F6" />
          <StatCard title="Reactions" value={periodTotals.reactions_received || 0} icon="👍" color="#F59E0B" />
          <StatCard title="Comments" value={periodTotals.comments_received || 0} icon="💬" color="#10B981" />
          <StatCard title="Friends" value={periodTotals.friends_added || 0} icon="👥" color="#8B5CF6" />
        </View>

        {/* BL Coins Earned with Change */}
        <View style={styles.coinsStat}>
          <View style={styles.coinsStatLeft}>
            <Text style={styles.coinsStatIcon}>🪙</Text>
            <View>
              <Text style={styles.coinsStatValue}>
                {(periodTotals.bl_coins_earned || 0).toLocaleString()} BL
              </Text>
              <Text style={styles.coinsStatLabel}>Earned this period</Text>
            </View>
          </View>
          <View style={[styles.changeIndicator, { backgroundColor: weekChange >= 0 ? '#10B98120' : '#EF444420' }]}>
            <Text style={[styles.changeText, { color: weekChange >= 0 ? '#10B981' : '#EF4444' }]}>
              {weekChange >= 0 ? '↑' : '↓'} {Math.abs(weekChange)}%
            </Text>
          </View>
        </View>

        {/* Trends Charts */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>📊 Activity Trends</Text>
          <View style={styles.chartsRow}>
            <View style={styles.chartWrapper}>
              <SimpleBarChart
                data={trends?.bl_coins_trend || []}
                label="BL Coins"
                color="#F59E0B"
              />
            </View>
            <View style={styles.chartWrapper}>
              <SimpleBarChart
                data={trends?.engagement_trend || []}
                label="Engagement"
                color="#10B981"
              />
            </View>
          </View>
        </View>

        {/* Leaderboard */}
        {leaderboard && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🏆 Weekly Leaderboard</Text>
            <Text style={styles.sectionSubtitle}>Top earners this week</Text>
            {leaderboard.leaderboard.slice(0, 5).map((entry, i) => (
              <LeaderboardItem key={entry.user_id} entry={entry} rank={i + 1} />
            ))}
            {leaderboard.current_user_rank && !leaderboard.leaderboard.some(l => l.is_current_user) && (
              <>
                <View style={styles.leaderboardDivider}>
                  <Text style={styles.leaderboardDividerText}>• • •</Text>
                </View>
                <LeaderboardItem
                  entry={{ ...leaderboard.current_user_rank, is_current_user: true, name: 'You', value: leaderboard.current_user_rank.value }}
                  rank={leaderboard.current_user_rank.rank}
                />
              </>
            )}
          </View>
        )}

        {/* All-Time Stats */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>🎯 All-Time Statistics</Text>
          <View style={styles.allTimeGrid}>
            <View style={styles.allTimeItem}>
              <Text style={styles.allTimeValue}>{stats?.all_time_stats?.total_posts || 0}</Text>
              <Text style={styles.allTimeLabel}>Posts</Text>
            </View>
            <View style={styles.allTimeItem}>
              <Text style={styles.allTimeValue}>{stats?.all_time_stats?.total_comments || 0}</Text>
              <Text style={styles.allTimeLabel}>Comments</Text>
            </View>
            <View style={styles.allTimeItem}>
              <Text style={styles.allTimeValue}>{stats?.all_time_stats?.total_reactions || 0}</Text>
              <Text style={styles.allTimeLabel}>Reactions</Text>
            </View>
            <View style={styles.allTimeItem}>
              <Text style={styles.allTimeValue}>{stats?.all_time_stats?.total_friends || 0}</Text>
              <Text style={styles.allTimeLabel}>Friends</Text>
            </View>
          </View>
        </View>

        {/* Engagement Rate */}
        <View style={styles.engagementCard}>
          <View style={styles.engagementCircle}>
            <Text style={styles.engagementValue}>{stats?.engagement_rate || 0}%</Text>
          </View>
          <View style={styles.engagementInfo}>
            <Text style={styles.engagementTitle}>Engagement Rate</Text>
            <Text style={styles.engagementSubtitle}>
              Based on reactions & comments per post
            </Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  periodSelector: {
    flexDirection: 'row',
    gap: 4,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  periodButtonActive: {
    backgroundColor: '#3B82F6',
  },
  periodButtonText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    margin: 12,
    borderRadius: 12,
    padding: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#334155',
    marginHorizontal: 8,
  },
  summaryEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    gap: 8,
  },
  statCard: {
    width: (SCREEN_WIDTH - 40) / 2,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIcon: {
    fontSize: 20,
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statTitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  statChange: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  coinsStat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    margin: 12,
    borderRadius: 12,
    padding: 16,
  },
  coinsStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinsStatIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  coinsStatValue: {
    color: '#F59E0B',
    fontSize: 20,
    fontWeight: 'bold',
  },
  coinsStatLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  changeIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#1E293B',
    margin: 12,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 12,
  },
  chartsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  chartWrapper: {
    flex: 1,
  },
  chartContainer: {
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 12,
    height: 100,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    gap: 2,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },
  chartLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  leaderboardItemHighlighted: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  leaderboardRank: {
    width: 32,
  },
  leaderboardRankText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  leaderboardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  leaderboardAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  leaderboardName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  leaderboardValue: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
  },
  leaderboardDivider: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  leaderboardDividerText: {
    color: '#6B7280',
  },
  allTimeGrid: {
    flexDirection: 'row',
    marginTop: 12,
  },
  allTimeItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: '#334155',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  allTimeValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  allTimeLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 2,
  },
  engagementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    margin: 12,
    borderRadius: 12,
    padding: 16,
  },
  engagementCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  engagementValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  engagementInfo: {
    flex: 1,
  },
  engagementTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  engagementSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
});
