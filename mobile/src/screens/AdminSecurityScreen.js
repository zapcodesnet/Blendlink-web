/**
 * Admin Security Screen for Blendlink Mobile
 * Security dashboard and monitoring
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

export default function AdminSecurityScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [securityData, setSecurityData] = useState({
    failed_logins_24h: 0,
    suspicious_activity: 0,
    blocked_ips: 0,
    active_sessions: 0,
  });

  const loadData = useCallback(async () => {
    try {
      const health = await adminAPI.getSystemHealth();
      setSecurityData({
        failed_logins_24h: health.failed_logins_24h || 0,
        suspicious_activity: health.suspicious_activity || 0,
        blocked_ips: health.blocked_ips || 0,
        active_sessions: health.active_sessions || 0,
      });
    } catch (error) {
      console.error('Failed to load security data:', error);
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#EF4444" />
        <Text style={styles.loadingText}>Loading Security Dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🔒 Security</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EF4444" />
        }
      >
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statRed]}>
            <Text style={styles.statValue}>{securityData.failed_logins_24h}</Text>
            <Text style={styles.statLabel}>Failed Logins (24h)</Text>
          </View>
          <View style={[styles.statCard, styles.statAmber]}>
            <Text style={styles.statValue}>{securityData.suspicious_activity}</Text>
            <Text style={styles.statLabel}>Suspicious Activity</Text>
          </View>
          <View style={[styles.statCard, styles.statPurple]}>
            <Text style={styles.statValue}>{securityData.blocked_ips}</Text>
            <Text style={styles.statLabel}>Blocked IPs</Text>
          </View>
          <View style={[styles.statCard, styles.statGreen]}>
            <Text style={styles.statValue}>{securityData.active_sessions}</Text>
            <Text style={styles.statLabel}>Active Sessions</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>2FA Enforcement</Text>
              <View style={styles.statusBadgeGreen}>
                <Text style={styles.statusBadgeText}>Enabled</Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Rate Limiting</Text>
              <View style={styles.statusBadgeGreen}>
                <Text style={styles.statusBadgeText}>Active</Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Session Timeout</Text>
              <View style={styles.statusBadgeAmber}>
                <Text style={styles.statusBadgeText}>5 min</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>🔐</Text>
            <Text style={styles.actionText}>Force All Sessions Logout</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>🚫</Text>
            <Text style={styles.actionText}>Block IP Address</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionText}>View Security Logs</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backButton: { color: '#EF4444', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { width: '47%', padding: 16, borderRadius: 12, borderWidth: 1 },
  statRed: { backgroundColor: '#EF444420', borderColor: '#EF444440' },
  statAmber: { backgroundColor: '#F59E0B20', borderColor: '#F59E0B40' },
  statPurple: { backgroundColor: '#8B5CF620', borderColor: '#8B5CF640' },
  statGreen: { backgroundColor: '#10B98120', borderColor: '#10B98140' },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  statusCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155' },
  statusLabel: { color: '#94A3B8', fontSize: 14 },
  statusBadgeGreen: { backgroundColor: '#10B98130', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusBadgeAmber: { backgroundColor: '#F59E0B30', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { color: '#fff', fontSize: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', padding: 16, borderRadius: 12, marginBottom: 8, gap: 12 },
  actionIcon: { fontSize: 24 },
  actionText: { color: '#fff', fontSize: 14 },
});
