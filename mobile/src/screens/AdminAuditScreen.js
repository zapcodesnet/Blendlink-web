/**
 * Admin Audit Screen for Blendlink Mobile
 * Activity feed and audit logs
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminAPI } from '../services/api';

const TABS = [
  { key: 'audit', label: 'Audit Logs', icon: '📋' },
  { key: 'signups', label: 'Signups', icon: '👤' },
  { key: 'transactions', label: 'Transactions', icon: '💰' },
];

const ACTION_ICONS = {
  login_success: '🔐',
  login_failed: '⚠️',
  logout: '🚪',
  user_view: '👁️',
  user_suspend: '⏸️',
  user_ban: '🚫',
  user_unsuspend: '▶️',
  user_unban: '✓',
  balance_adjust: '💰',
  withdrawal_approve: '✅',
  withdrawal_reject: '❌',
  kyc_approve: '🪪',
  kyc_reject: '🚫',
  genealogy_reassign: '🔄',
  admin_create: '➕',
  settings_update: '⚙️',
};

export default function AdminAuditScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState({ audit_logs: [], recent_signups: [], recent_transactions: [] });
  const [activeTab, setActiveTab] = useState('audit');

  const loadData = useCallback(async () => {
    try {
      const result = await adminAPI.getActivityFeed(100);
      setData(result);
    } catch (error) {
      console.error('Failed to load activity feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatAction = (action) => {
    return action?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading activity...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity & Audit</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Audit Logs Tab */}
        {activeTab === 'audit' && (
          <>
            {data.audit_logs?.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyText}>No audit logs yet</Text>
              </View>
            ) : (
              data.audit_logs?.map((log, i) => (
                <View key={log.log_id || i} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <View style={styles.logIcon}>
                      <Text style={styles.logIconText}>{ACTION_ICONS[log.action] || '📝'}</Text>
                    </View>
                    <View style={styles.logInfo}>
                      <Text style={styles.logAction}>{formatAction(log.action)}</Text>
                      <Text style={styles.logAdmin}>{log.admin_email || 'System'}</Text>
                    </View>
                    <Text style={styles.logTime}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.logDetails}>
                    <View style={styles.logDetail}>
                      <Text style={styles.logDetailLabel}>Target:</Text>
                      <Text style={styles.logDetailValue}>
                        {log.target_type}:{log.target_id?.slice(0, 12) || 'N/A'}
                      </Text>
                    </View>
                    {log.ip_address && (
                      <View style={styles.logDetail}>
                        <Text style={styles.logDetailLabel}>IP:</Text>
                        <Text style={styles.logDetailValue}>{log.ip_address}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Signups Tab */}
        {activeTab === 'signups' && (
          <>
            {data.recent_signups?.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>👤</Text>
                <Text style={styles.emptyText}>No recent signups</Text>
              </View>
            ) : (
              data.recent_signups?.map((user, i) => (
                <View key={user.user_id || i} style={styles.signupCard}>
                  <View style={styles.signupAvatar}>
                    <Text style={styles.signupAvatarText}>{user.name?.charAt(0) || '?'}</Text>
                  </View>
                  <View style={styles.signupInfo}>
                    <Text style={styles.signupName}>{user.name || 'New User'}</Text>
                    <Text style={styles.signupEmail}>{user.email}</Text>
                  </View>
                  <View style={styles.signupRight}>
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                    <Text style={styles.signupDate}>
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <>
            {data.recent_transactions?.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>💰</Text>
                <Text style={styles.emptyText}>No recent transactions</Text>
              </View>
            ) : (
              data.recent_transactions?.map((txn, i) => (
                <View key={txn.transaction_id || i} style={styles.txnCard}>
                  <View style={styles.txnLeft}>
                    <View style={[
                      styles.txnIcon,
                      (txn.amount || 0) >= 0 ? styles.txnIconPositive : styles.txnIconNegative
                    ]}>
                      <Text style={styles.txnIconText}>
                        {(txn.amount || 0) >= 0 ? '↑' : '↓'}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.txnType}>
                        {txn.transaction_type?.replace(/_/g, ' ') || 'Transaction'}
                      </Text>
                      <Text style={styles.txnId}>ID: {txn.transaction_id?.slice(0, 12)}</Text>
                    </View>
                  </View>
                  <View style={styles.txnRight}>
                    <Text style={[
                      styles.txnAmount,
                      (txn.amount || 0) >= 0 ? styles.txnPositive : styles.txnNegative
                    ]}>
                      {(txn.amount || 0) >= 0 ? '+' : ''}{txn.amount || 0} {txn.currency?.toUpperCase() || 'BL'}
                    </Text>
                    <Text style={styles.txnDate}>
                      {txn.created_at ? new Date(txn.created_at).toLocaleDateString() : 'N/A'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* Summary Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statsRow}>
            <View style={[styles.statBox, styles.statBlue]}>
              <Text style={styles.statValue}>{data.audit_logs?.length || 0}</Text>
              <Text style={styles.statLabel}>Audit Logs</Text>
            </View>
            <View style={[styles.statBox, styles.statGreen]}>
              <Text style={styles.statValue}>{data.recent_signups?.length || 0}</Text>
              <Text style={styles.statLabel}>New Signups</Text>
            </View>
            <View style={[styles.statBox, styles.statAmber]}>
              <Text style={styles.statValue}>{data.recent_transactions?.length || 0}</Text>
              <Text style={styles.statLabel}>Transactions</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backButton: { padding: 8, marginRight: 12 },
  backText: { fontSize: 24, color: '#fff' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff', flex: 1 },
  refreshButton: { padding: 8 },
  refreshText: { fontSize: 20, color: '#3B82F6' },
  tabsRow: { flexDirection: 'row', padding: 16, paddingBottom: 8, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#1E293B', borderRadius: 8, gap: 4 },
  tabActive: { backgroundColor: '#3B82F6' },
  tabIcon: { fontSize: 14 },
  tabText: { color: '#94A3B8', fontSize: 12, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  content: { flex: 1, padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { color: '#64748B', fontSize: 16 },
  // Audit Log Card
  logCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 8 },
  logHeader: { flexDirection: 'row', alignItems: 'center' },
  logIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3B82F620', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  logIconText: { fontSize: 16 },
  logInfo: { flex: 1 },
  logAction: { color: '#fff', fontSize: 14, fontWeight: '600' },
  logAdmin: { color: '#64748B', fontSize: 12 },
  logTime: { color: '#64748B', fontSize: 11 },
  logDetails: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#334155', flexDirection: 'row', gap: 16 },
  logDetail: { flexDirection: 'row', alignItems: 'center' },
  logDetailLabel: { color: '#64748B', fontSize: 11, marginRight: 4 },
  logDetailValue: { color: '#94A3B8', fontSize: 11 },
  // Signup Card
  signupCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 8 },
  signupAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  signupAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  signupInfo: { flex: 1 },
  signupName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  signupEmail: { color: '#94A3B8', fontSize: 12 },
  signupRight: { alignItems: 'flex-end' },
  newBadge: { backgroundColor: '#10B98130', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  newBadgeText: { color: '#10B981', fontSize: 10, fontWeight: 'bold' },
  signupDate: { color: '#64748B', fontSize: 11, marginTop: 4 },
  // Transaction Card
  txnCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 8 },
  txnLeft: { flexDirection: 'row', alignItems: 'center' },
  txnIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  txnIconPositive: { backgroundColor: '#10B98130' },
  txnIconNegative: { backgroundColor: '#EF444430' },
  txnIconText: { fontSize: 16 },
  txnType: { color: '#fff', fontSize: 13, fontWeight: '500', textTransform: 'capitalize' },
  txnId: { color: '#64748B', fontSize: 11 },
  txnRight: { alignItems: 'flex-end' },
  txnAmount: { fontSize: 14, fontWeight: 'bold' },
  txnPositive: { color: '#10B981' },
  txnNegative: { color: '#EF4444' },
  txnDate: { color: '#64748B', fontSize: 11, marginTop: 2 },
  // Stats
  statsSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1E293B' },
  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  statBlue: { backgroundColor: '#3B82F620' },
  statGreen: { backgroundColor: '#10B98120' },
  statAmber: { backgroundColor: '#F59E0B20' },
  statValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  statLabel: { color: '#94A3B8', fontSize: 11, marginTop: 4 },
});
