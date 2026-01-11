/**
 * Admin Withdrawals Screen for Blendlink Mobile
 * KYC verification and withdrawal management
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
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminAPI } from '../services/api';

const STATUS_TABS = [
  { key: 'pending', label: 'Pending', icon: '⏳' },
  { key: 'approved', label: 'Approved', icon: '✓' },
  { key: 'rejected', label: 'Rejected', icon: '✗' },
];

export default function AdminWithdrawalsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [pendingKYC, setPendingKYC] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    try {
      const [statsData, kycData, withdrawalsData] = await Promise.all([
        adminAPI.getWithdrawalStats(),
        adminAPI.getPendingKYC(),
        adminAPI.getWithdrawals({ status: activeTab, limit: 50 }),
      ]);
      setStats(statsData);
      setPendingKYC(kycData.users || []);
      setWithdrawals(withdrawalsData.withdrawals || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load withdrawal data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleApproveKYC = async (userId) => {
    Alert.alert(
      'Approve KYC',
      'Confirm approving this user\'s KYC verification?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setActionLoading(true);
            try {
              await adminAPI.approveKYC(userId);
              Alert.alert('Success', 'KYC approved');
              loadData();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to approve KYC');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRejectKYC = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Error', 'Please provide a reason');
      return;
    }
    setActionLoading(true);
    try {
      await adminAPI.rejectKYC(rejectModal.userId, rejectReason);
      Alert.alert('Success', 'KYC rejected');
      setRejectModal(null);
      setRejectReason('');
      loadData();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to reject KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveWithdrawal = async (withdrawalId) => {
    Alert.alert(
      'Approve Withdrawal',
      'Confirm approving this withdrawal request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            setActionLoading(true);
            try {
              await adminAPI.approveWithdrawal(withdrawalId);
              Alert.alert('Success', 'Withdrawal approved');
              loadData();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to approve withdrawal');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRejectWithdrawal = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Error', 'Please provide a reason');
      return;
    }
    setActionLoading(true);
    try {
      await adminAPI.rejectWithdrawal(rejectModal.withdrawalId, rejectReason);
      Alert.alert('Success', 'Withdrawal rejected');
      setRejectModal(null);
      setRejectReason('');
      loadData();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to reject withdrawal');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading withdrawals...</Text>
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
        <Text style={styles.headerTitle}>Withdrawals & KYC</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statGreen]}>
            <Text style={styles.statValue}>${(stats?.total_paid_out || 0).toFixed(2)}</Text>
            <Text style={styles.statLabel}>Total Paid Out</Text>
          </View>
          <View style={[styles.statCard, styles.statAmber]}>
            <Text style={styles.statValue}>{stats?.pending_count || 0}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={[styles.statCard, styles.statBlue]}>
            <Text style={styles.statValue}>${(stats?.total_fees_collected || 0).toFixed(2)}</Text>
            <Text style={styles.statLabel}>Fees Collected</Text>
          </View>
          <View style={[styles.statCard, styles.statPurple]}>
            <Text style={styles.statValue}>{pendingKYC.length}</Text>
            <Text style={styles.statLabel}>Pending KYC</Text>
          </View>
        </View>

        {/* Pending KYC Section */}
        {pendingKYC.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🪪 Pending KYC Verifications</Text>
            {pendingKYC.map((user) => (
              <View key={user.user_id} style={styles.kycCard}>
                <View style={styles.kycInfo}>
                  <View style={styles.kycAvatar}>
                    <Text style={styles.kycAvatarText}>{user.name?.charAt(0) || '?'}</Text>
                  </View>
                  <View>
                    <Text style={styles.kycName}>{user.name}</Text>
                    <Text style={styles.kycEmail}>{user.email}</Text>
                    <Text style={styles.kycDate}>
                      Requested: {user.kyc_submitted_at ? new Date(user.kyc_submitted_at).toLocaleDateString() : 'N/A'}
                    </Text>
                  </View>
                </View>
                <View style={styles.kycActions}>
                  <TouchableOpacity
                    style={[styles.kycButton, styles.kycApprove]}
                    onPress={() => handleApproveKYC(user.user_id)}
                    disabled={actionLoading}
                  >
                    <Text style={styles.kycButtonText}>✓ Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.kycButton, styles.kycReject]}
                    onPress={() => setRejectModal({ type: 'kyc', userId: user.user_id })}
                    disabled={actionLoading}
                  >
                    <Text style={styles.kycButtonText}>✗ Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Withdrawals Tabs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💸 Withdrawal Requests</Text>
          <View style={styles.tabsRow}>
            {STATUS_TABS.map((tab) => (
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

          {/* Withdrawals List */}
          {withdrawals.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>No {activeTab} withdrawals</Text>
            </View>
          ) : (
            withdrawals.map((withdrawal) => (
              <View key={withdrawal.withdrawal_id} style={styles.withdrawalCard}>
                <View style={styles.withdrawalHeader}>
                  <View style={styles.withdrawalUser}>
                    <View style={styles.withdrawalAvatar}>
                      <Text style={styles.withdrawalAvatarText}>{withdrawal.user_name?.charAt(0) || '$'}</Text>
                    </View>
                    <View>
                      <Text style={styles.withdrawalName}>{withdrawal.user_name || 'Unknown'}</Text>
                      <Text style={styles.withdrawalId}>ID: {withdrawal.withdrawal_id?.slice(0, 12)}</Text>
                    </View>
                  </View>
                  <View style={styles.withdrawalAmount}>
                    <Text style={styles.amountValue}>${(withdrawal.amount || 0).toFixed(2)}</Text>
                    <Text style={styles.amountFee}>Fee: ${(withdrawal.fee || 0).toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.withdrawalDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Method</Text>
                    <Text style={styles.detailValue}>{withdrawal.method || 'Bank Transfer'}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Requested</Text>
                    <Text style={styles.detailValue}>
                      {withdrawal.created_at ? new Date(withdrawal.created_at).toLocaleDateString() : 'N/A'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={[
                      styles.statusBadge,
                      withdrawal.status === 'pending' && styles.statusPending,
                      withdrawal.status === 'approved' && styles.statusApproved,
                      withdrawal.status === 'rejected' && styles.statusRejected,
                    ]}>
                      <Text style={styles.statusText}>{withdrawal.status}</Text>
                    </View>
                  </View>
                </View>

                {activeTab === 'pending' && (
                  <View style={styles.withdrawalActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionApprove]}
                      onPress={() => handleApproveWithdrawal(withdrawal.withdrawal_id)}
                      disabled={actionLoading}
                    >
                      <Text style={styles.actionButtonText}>✓ Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionReject]}
                      onPress={() => setRejectModal({ type: 'withdrawal', withdrawalId: withdrawal.withdrawal_id })}
                      disabled={actionLoading}
                    >
                      <Text style={styles.actionButtonText}>✗ Reject</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {withdrawal.rejection_reason && (
                  <View style={styles.rejectionReason}>
                    <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
                    <Text style={styles.rejectionText}>{withdrawal.rejection_reason}</Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={!!rejectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.rejectModalContent}>
            <Text style={styles.rejectModalTitle}>
              {rejectModal?.type === 'kyc' ? 'Reject KYC' : 'Reject Withdrawal'}
            </Text>
            <TextInput
              style={styles.rejectInput}
              placeholder="Reason for rejection"
              placeholderTextColor="#64748B"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.rejectModalButtons}>
              <TouchableOpacity
                style={styles.rejectCancel}
                onPress={() => { setRejectModal(null); setRejectReason(''); }}
              >
                <Text style={styles.rejectCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectConfirm}
                onPress={rejectModal?.type === 'kyc' ? handleRejectKYC : handleRejectWithdrawal}
                disabled={actionLoading}
              >
                <Text style={styles.rejectConfirmText}>{actionLoading ? 'Loading...' : 'Reject'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  content: { flex: 1, padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, minWidth: '45%', padding: 16, borderRadius: 12, borderWidth: 1 },
  statGreen: { backgroundColor: '#10B98110', borderColor: '#10B98130' },
  statAmber: { backgroundColor: '#F59E0B10', borderColor: '#F59E0B30' },
  statBlue: { backgroundColor: '#3B82F610', borderColor: '#3B82F630' },
  statPurple: { backgroundColor: '#8B5CF610', borderColor: '#8B5CF630' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  statLabel: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 12 },
  kycCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 8 },
  kycInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  kycAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  kycAvatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  kycName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  kycEmail: { color: '#94A3B8', fontSize: 13 },
  kycDate: { color: '#64748B', fontSize: 12, marginTop: 2 },
  kycActions: { flexDirection: 'row', gap: 8 },
  kycButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  kycApprove: { backgroundColor: '#10B98130' },
  kycReject: { backgroundColor: '#EF444430' },
  kycButtonText: { color: '#fff', fontWeight: '600' },
  tabsRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#1E293B', borderRadius: 8, gap: 4 },
  tabActive: { backgroundColor: '#3B82F6' },
  tabIcon: { fontSize: 14 },
  tabText: { color: '#94A3B8', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { color: '#64748B', fontSize: 16 },
  withdrawalCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 12 },
  withdrawalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  withdrawalUser: { flexDirection: 'row', alignItems: 'center' },
  withdrawalAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  withdrawalAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  withdrawalName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  withdrawalId: { color: '#64748B', fontSize: 11 },
  withdrawalAmount: { alignItems: 'flex-end' },
  amountValue: { color: '#10B981', fontSize: 18, fontWeight: 'bold' },
  amountFee: { color: '#64748B', fontSize: 11 },
  withdrawalDetails: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#334155' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  detailLabel: { color: '#64748B', fontSize: 13 },
  detailValue: { color: '#fff', fontSize: 13 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPending: { backgroundColor: '#F59E0B30' },
  statusApproved: { backgroundColor: '#10B98130' },
  statusRejected: { backgroundColor: '#EF444430' },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  withdrawalActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  actionApprove: { backgroundColor: '#10B98130' },
  actionReject: { backgroundColor: '#EF444430' },
  actionButtonText: { color: '#fff', fontWeight: '600' },
  rejectionReason: { marginTop: 12, padding: 12, backgroundColor: '#EF444420', borderRadius: 8 },
  rejectionLabel: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  rejectionText: { color: '#fff', fontSize: 13, marginTop: 4 },
  // Reject Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  rejectModalContent: { width: '100%', backgroundColor: '#1E293B', borderRadius: 16, padding: 20 },
  rejectModalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  rejectInput: { backgroundColor: '#0F172A', borderRadius: 8, padding: 12, color: '#fff', height: 100, textAlignVertical: 'top', marginBottom: 16 },
  rejectModalButtons: { flexDirection: 'row', gap: 12 },
  rejectCancel: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#334155', alignItems: 'center' },
  rejectCancelText: { color: '#94A3B8', fontWeight: '600' },
  rejectConfirm: { flex: 1, padding: 14, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center' },
  rejectConfirmText: { color: '#fff', fontWeight: '600' },
});
