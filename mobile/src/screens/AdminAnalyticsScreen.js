/**
 * Admin Analytics Screen with Real-time WebSocket Updates
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminAPI, getToken } from '../services/api';

const { width } = Dimensions.get('window');

export default function AdminAnalyticsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // WebSocket connection
  const connectWebSocket = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const wsUrl = process.env.EXPO_PUBLIC_API_URL?.replace('https://', 'wss://').replace('http://', 'ws://');
      if (!wsUrl) return;

      const ws = new WebSocket(`${wsUrl}/api/realtime/ws/analytics?token=${token}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'initial' || data.type === 'update') {
            setMetrics(data.data);
            setLoading(false);
          } else if (data.type === 'event') {
            // Handle real-time events
            console.log('Real-time event:', data.event);
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setWsConnected(false);
        // Reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }, []);

  // Fallback REST API load
  const loadMetrics = useCallback(async () => {
    try {
      const data = await adminAPI.getRealtimeMetrics();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics:', error);
      // Try dashboard as fallback
      try {
        const dashboard = await adminAPI.getDashboard();
        setMetrics({
          users_online: dashboard.users?.total || 0,
          new_signups: { hour: 0, today: dashboard.users?.new_7d || 0 },
          content: { new_posts_hour: 0, new_posts_today: dashboard.content?.posts || 0 },
          transactions: { count_hour: 0, bl_coins_volume: dashboard.financial?.total_bl_coins || 0 },
        });
      } catch (e) {
        console.error('Dashboard fallback failed:', e);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    loadMetrics();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket, loadMetrics]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMetrics();
    if (wsRef.current) {
      wsRef.current.send('refresh');
    }
  }, [loadMetrics]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'content', label: 'Content', icon: '📝' },
    { id: 'revenue', label: 'Revenue', icon: '💰' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading Analytics...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, wsConnected ? styles.statusConnected : styles.statusDisconnected]} />
          <Text style={styles.statusText}>{wsConnected ? 'Live' : 'Offline'}</Text>
        </View>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
      >
        {activeTab === 'overview' && (
          <>
            {/* Key Metrics */}
            <View style={styles.metricsGrid}>
              <MetricCard
                label="Users Online"
                value={metrics?.users_online || 0}
                color="#3B82F6"
                icon="🟢"
              />
              <MetricCard
                label="New Today"
                value={metrics?.new_signups?.today || 0}
                color="#10B981"
                icon="📈"
              />
              <MetricCard
                label="Posts (1h)"
                value={metrics?.content?.new_posts_hour || 0}
                color="#8B5CF6"
                icon="📝"
              />
              <MetricCard
                label="Transactions"
                value={metrics?.transactions?.count_hour || 0}
                color="#F59E0B"
                icon="💳"
              />
            </View>

            {/* Activity Chart Placeholder */}
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Activity Overview</Text>
              <View style={styles.chartPlaceholder}>
                <View style={styles.barChart}>
                  {[40, 65, 45, 80, 55, 70, 90].map((height, index) => (
                    <View key={index} style={styles.barContainer}>
                      <View style={[styles.bar, { height: `${height}%` }]} />
                      <Text style={styles.barLabel}>
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Quick Stats */}
            <View style={styles.quickStats}>
              <QuickStat label="BL Coins Volume" value={metrics?.transactions?.bl_coins_volume || 0} />
              <QuickStat label="Casino Bets (1h)" value={metrics?.casino?.bets_hour || 0} />
              <QuickStat label="Active Sessions" value={metrics?.active_sessions || 0} />
            </View>
          </>
        )}

        {activeTab === 'users' && (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard
                label="Online Now"
                value={metrics?.users_online || 0}
                color="#3B82F6"
                icon="🟢"
              />
              <MetricCard
                label="New (Hour)"
                value={metrics?.new_signups?.hour || 0}
                color="#10B981"
                icon="⏰"
              />
              <MetricCard
                label="New (Today)"
                value={metrics?.new_signups?.today || 0}
                color="#8B5CF6"
                icon="📅"
              />
              <MetricCard
                label="Sessions"
                value={metrics?.active_sessions || 0}
                color="#F59E0B"
                icon="📱"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>User Acquisition</Text>
              <ProgressBar label="Organic" value={45} color="#3B82F6" />
              <ProgressBar label="Referral" value={30} color="#10B981" />
              <ProgressBar label="Social" value={15} color="#8B5CF6" />
              <ProgressBar label="Direct" value={10} color="#F59E0B" />
            </View>
          </>
        )}

        {activeTab === 'content' && (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard
                label="Posts (Hour)"
                value={metrics?.content?.new_posts_hour || 0}
                color="#3B82F6"
                icon="📝"
              />
              <MetricCard
                label="Posts (Today)"
                value={metrics?.content?.new_posts_today || 0}
                color="#10B981"
                icon="📰"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Content Breakdown</Text>
              <ProgressBar label="Text Posts" value={50} color="#3B82F6" />
              <ProgressBar label="Photo Posts" value={30} color="#10B981" />
              <ProgressBar label="Video Posts" value={15} color="#8B5CF6" />
              <ProgressBar label="Shares" value={5} color="#F59E0B" />
            </View>
          </>
        )}

        {activeTab === 'revenue' && (
          <>
            <View style={styles.metricsGrid}>
              <MetricCard
                label="BL Volume"
                value={(metrics?.transactions?.bl_coins_volume || 0).toLocaleString()}
                color="#F59E0B"
                icon="🪙"
              />
              <MetricCard
                label="Transactions"
                value={metrics?.transactions?.count_hour || 0}
                color="#10B981"
                icon="💳"
              />
              <MetricCard
                label="Casino Bets"
                value={metrics?.casino?.bets_hour || 0}
                color="#8B5CF6"
                icon="🎰"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Revenue Sources</Text>
              <ProgressBar label="Casino" value={55} color="#F59E0B" />
              <ProgressBar label="Marketplace" value={25} color="#3B82F6" />
              <ProgressBar label="Premium" value={20} color="#10B981" />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Metric Card Component
function MetricCard({ label, value, color, icon }) {
  return (
    <View style={[styles.metricCard, { borderColor: color + '40' }]}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={[styles.metricValue, { color }]}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

// Quick Stat Component
function QuickStat({ label, value }) {
  return (
    <View style={styles.quickStat}>
      <Text style={styles.quickStatValue}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
  );
}

// Progress Bar Component
function ProgressBar({ label, value, color }) {
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{value}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    fontSize: 24,
    color: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusConnected: {
    backgroundColor: '#10B981',
  },
  statusDisconnected: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  tabIcon: {
    fontSize: 16,
  },
  tabLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  tabLabelActive: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  chartContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  chartTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  chartPlaceholder: {
    height: 180,
    justifyContent: 'flex-end',
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: '100%',
  },
  barContainer: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: '60%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
  },
  quickStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickStat: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  quickStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quickStatLabel: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  progressValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
});
