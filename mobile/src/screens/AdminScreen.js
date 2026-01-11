/**
 * Admin Panel Screen for Blendlink Mobile
 * Role-based access: Super Admin, Co-Admin, Moderator
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';

// Role permissions configuration
const ROLE_PERMISSIONS = {
  super_admin: {
    dashboard: true,
    users: true,
    admins: true,
    analytics: true,
    settings: true,
    audit: true,
    ab_testing: true,
  },
  co_admin: {
    dashboard: true,
    users: true,
    admins: false,
    analytics: true,
    settings: true,
    audit: true,
    ab_testing: true,
  },
  moderator: {
    dashboard: true,
    users: true,
    admins: false,
    analytics: true,
    settings: false,
    audit: false,
    ab_testing: false,
  },
};

export default function AdminScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState(null);

  const loadAdminData = useCallback(async () => {
    try {
      const [profile, dashboard] = await Promise.all([
        adminAPI.getProfile(),
        adminAPI.getDashboard(),
      ]);
      setAdminData(profile);
      setDashboardStats(dashboard);
      
      // Try to get real-time metrics
      try {
        const metrics = await adminAPI.getRealtimeMetrics();
        setRealtimeMetrics(metrics);
      } catch (e) {
        console.log('Real-time metrics not available');
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
      Alert.alert('Error', 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAdminData();
  }, [loadAdminData]);

  const getRole = () => {
    return adminData?.admin?.role || 'super_admin';
  };

  const hasPermission = (permission) => {
    const role = getRole();
    return ROLE_PERMISSIONS[role]?.[permission] ?? false;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading Admin Panel...</Text>
      </View>
    );
  }

  const menuItems = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: '📊',
      description: 'Overview & statistics',
      screen: 'AdminDashboard',
      permission: 'dashboard',
    },
    {
      id: 'users',
      title: 'Users',
      icon: '👥',
      description: 'Manage users',
      screen: 'AdminUsers',
      permission: 'users',
    },
    {
      id: 'admins',
      title: 'Admins',
      icon: '🛡️',
      description: 'Manage admin accounts',
      screen: 'AdminManagement',
      permission: 'admins',
    },
    {
      id: 'analytics',
      title: 'Analytics',
      icon: '📈',
      description: 'Real-time insights',
      screen: 'AdminAnalytics',
      permission: 'analytics',
    },
    {
      id: 'ab_testing',
      title: 'A/B Testing',
      icon: '🧪',
      description: 'Experiments & splits',
      screen: 'AdminABTesting',
      permission: 'ab_testing',
    },
    {
      id: 'audit',
      title: 'Audit Logs',
      icon: '📋',
      description: 'Activity history',
      screen: 'AdminAudit',
      permission: 'audit',
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: '⚙️',
      description: 'Platform configuration',
      screen: 'AdminSettings',
      permission: 'settings',
    },
  ];

  const roleColors = {
    super_admin: '#F59E0B',
    co_admin: '#3B82F6',
    moderator: '#10B981',
  };

  const roleLabels = {
    super_admin: 'Super Admin',
    co_admin: 'Co-Admin',
    moderator: 'Moderator',
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <View style={styles.roleContainer}>
            <View style={[styles.roleBadge, { backgroundColor: roleColors[getRole()] + '20' }]}>
              <Text style={[styles.roleText, { color: roleColors[getRole()] }]}>
                {roleLabels[getRole()]}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.exitButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.exitButtonText}>Exit</Text>
        </TouchableOpacity>
      </View>

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
        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statBlue]}>
            <Text style={styles.statValue}>
              {realtimeMetrics?.users_online || dashboardStats?.users?.total || 0}
            </Text>
            <Text style={styles.statLabel}>
              {realtimeMetrics ? 'Online Now' : 'Total Users'}
            </Text>
          </View>
          <View style={[styles.statCard, styles.statGreen]}>
            <Text style={styles.statValue}>
              {realtimeMetrics?.new_signups?.today || dashboardStats?.users?.new_7d || 0}
            </Text>
            <Text style={styles.statLabel}>
              {realtimeMetrics ? 'New Today' : 'New (7d)'}
            </Text>
          </View>
          <View style={[styles.statCard, styles.statAmber]}>
            <Text style={styles.statValue}>
              {dashboardStats?.content?.posts || 0}
            </Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={[styles.statCard, styles.statPurple]}>
            <Text style={styles.statValue}>
              {(dashboardStats?.financial?.total_bl_coins || 0).toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>BL Coins</Text>
          </View>
        </View>

        {/* Live Indicator */}
        {realtimeMetrics && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live Data</Text>
          </View>
        )}

        {/* Menu Grid */}
        <View style={styles.menuGrid}>
          {menuItems.map((item) => {
            const permitted = hasPermission(item.permission);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuCard, !permitted && styles.menuCardDisabled]}
                onPress={() => permitted && navigation.navigate(item.screen)}
                disabled={!permitted}
              >
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={[styles.menuTitle, !permitted && styles.menuTitleDisabled]}>
                  {item.title}
                </Text>
                <Text style={[styles.menuDesc, !permitted && styles.menuDescDisabled]}>
                  {permitted ? item.description : 'No access'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Users</Text>
          {dashboardStats?.recent_users?.slice(0, 5).map((user, index) => (
            <View key={user.user_id || index} style={styles.userRow}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {user.name?.charAt(0) || '?'}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
              <Text style={styles.userDate}>
                {new Date(user.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  roleContainer: {
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  exitButtonText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statBlue: {
    backgroundColor: '#3B82F610',
    borderColor: '#3B82F630',
  },
  statGreen: {
    backgroundColor: '#10B98110',
    borderColor: '#10B98130',
  },
  statAmber: {
    backgroundColor: '#F59E0B10',
    borderColor: '#F59E0B30',
  },
  statPurple: {
    backgroundColor: '#8B5CF610',
    borderColor: '#8B5CF630',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  liveText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  menuCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  menuCardDisabled: {
    backgroundColor: '#1E293B50',
    borderColor: '#33415550',
  },
  menuIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  menuTitleDisabled: {
    color: '#64748B',
  },
  menuDesc: {
    fontSize: 12,
    color: '#94A3B8',
  },
  menuDescDisabled: {
    color: '#475569',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  userEmail: {
    color: '#94A3B8',
    fontSize: 12,
  },
  userDate: {
    color: '#64748B',
    fontSize: 12,
  },
});
