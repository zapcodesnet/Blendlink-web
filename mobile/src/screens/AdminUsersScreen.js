/**
 * Admin Users Screen for Blendlink Mobile
 * Full user management with search, filter, and admin actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminAPI } from '../services/api';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'banned', label: 'Banned' },
];

export default function AdminUsersScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Action modals
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [suspendDays, setSuspendDays] = useState('7');
  const [balanceAdjust, setBalanceAdjust] = useState({ currency: 'bl_coins', amount: '', reason: '' });

  const limit = 20;

  const loadUsers = useCallback(async () => {
    try {
      const params = { skip: page * limit, limit };
      if (search) params.query = search;
      if (statusFilter) params.status = statusFilter;
      
      const data = await adminAPI.searchUsers(params);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUsers();
  }, [loadUsers]);

  const handleSearch = () => {
    setPage(0);
    loadUsers();
  };

  const loadUserDetail = async (userId) => {
    setSelectedUser(userId);
    setShowDetail(true);
    try {
      const data = await adminAPI.getUser(userId);
      setUserDetail(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load user details');
      setShowDetail(false);
    }
  };

  const handleSuspend = async () => {
    if (!actionReason.trim()) {
      Alert.alert('Error', 'Please provide a reason');
      return;
    }
    setActionLoading(true);
    try {
      await adminAPI.suspendUser(selectedUser, actionReason, parseInt(suspendDays));
      Alert.alert('Success', 'User suspended');
      setShowSuspendModal(false);
      setActionReason('');
      loadUserDetail(selectedUser);
      loadUsers();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to suspend user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async () => {
    setActionLoading(true);
    try {
      await adminAPI.unsuspendUser(selectedUser);
      Alert.alert('Success', 'User unsuspended');
      loadUserDetail(selectedUser);
      loadUsers();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to unsuspend user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBan = async () => {
    if (!actionReason.trim()) {
      Alert.alert('Error', 'Please provide a reason');
      return;
    }
    setActionLoading(true);
    try {
      await adminAPI.banUser(selectedUser, actionReason);
      Alert.alert('Success', 'User banned');
      setShowBanModal(false);
      setActionReason('');
      loadUserDetail(selectedUser);
      loadUsers();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to ban user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async () => {
    setActionLoading(true);
    try {
      await adminAPI.unbanUser(selectedUser);
      Alert.alert('Success', 'User unbanned');
      loadUserDetail(selectedUser);
      loadUsers();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to unban user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = () => {
    Alert.prompt(
      'Reset Password',
      'Enter new password for user:',
      async (newPassword) => {
        if (!newPassword) return;
        setActionLoading(true);
        try {
          await adminAPI.resetUserPassword(selectedUser, newPassword);
          Alert.alert('Success', 'Password reset successfully');
        } catch (error) {
          Alert.alert('Error', error.message || 'Failed to reset password');
        } finally {
          setActionLoading(false);
        }
      },
      'secure-text'
    );
  };

  const handleForceLogout = async () => {
    Alert.alert(
      'Force Logout',
      'This will log the user out of all sessions. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await adminAPI.forceLogout(selectedUser);
              Alert.alert('Success', 'User logged out from all sessions');
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to force logout');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleBalanceAdjust = async () => {
    if (!balanceAdjust.amount || !balanceAdjust.reason.trim()) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    setActionLoading(true);
    try {
      await adminAPI.adjustBalance(
        selectedUser,
        balanceAdjust.currency,
        parseFloat(balanceAdjust.amount),
        balanceAdjust.reason
      );
      Alert.alert('Success', 'Balance adjusted');
      setShowBalanceModal(false);
      setBalanceAdjust({ currency: 'bl_coins', amount: '', reason: '' });
      loadUserDetail(selectedUser);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to adjust balance');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (user) => {
    if (user.is_banned) return { label: 'Banned', color: '#EF4444', bg: '#EF444420' };
    if (user.is_suspended) return { label: 'Suspended', color: '#F59E0B', bg: '#F59E0B20' };
    if (user.is_deleted) return { label: 'Deleted', color: '#64748B', bg: '#64748B20' };
    return { label: 'Active', color: '#10B981', bg: '#10B98120' };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading users...</Text>
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
        <View>
          <Text style={styles.headerTitle}>User Management</Text>
          <Text style={styles.headerSubtitle}>{total.toLocaleString()} total users</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or ID..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
      </View>

      {/* Status Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {STATUS_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[styles.filterChip, statusFilter === filter.key && styles.filterChipActive]}
            onPress={() => { setStatusFilter(filter.key); setPage(0); }}
          >
            <Text style={[styles.filterText, statusFilter === filter.key && styles.filterTextActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Users List */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          users.map((user) => {
            const status = getStatusBadge(user);
            return (
              <TouchableOpacity
                key={user.user_id}
                style={styles.userCard}
                onPress={() => loadUserDetail(user.user_id)}
              >
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>{user.name?.charAt(0) || '?'}</Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name || 'Unknown'}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  <View style={styles.userStats}>
                    <Text style={styles.statText}>💰 {(user.bl_coins || 0).toLocaleString()} BL</Text>
                    <Text style={styles.statText}>👥 {user.referral_count || 0} refs</Text>
                  </View>
                </View>
                <View style={styles.userRight}>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                  <Text style={styles.userDate}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Pagination */}
        {total > limit && (
          <View style={styles.pagination}>
            <TouchableOpacity
              style={[styles.pageButton, page === 0 && styles.pageButtonDisabled]}
              onPress={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <Text style={styles.pageButtonText}>← Prev</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>
              {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total}
            </Text>
            <TouchableOpacity
              style={[styles.pageButton, (page + 1) * limit >= total && styles.pageButtonDisabled]}
              onPress={() => setPage(p => p + 1)}
              disabled={(page + 1) * limit >= total}
            >
              <Text style={styles.pageButtonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* User Detail Modal */}
      <Modal visible={showDetail} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDetail(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>User Details</Text>
            <View style={{ width: 24 }} />
          </View>

          {userDetail ? (
            <ScrollView style={styles.modalContent}>
              {/* User Info */}
              <View style={styles.detailCard}>
                <View style={styles.detailAvatar}>
                  <Text style={styles.detailAvatarText}>{userDetail.user?.name?.charAt(0) || '?'}</Text>
                </View>
                <Text style={styles.detailName}>{userDetail.user?.name}</Text>
                <Text style={styles.detailEmail}>{userDetail.user?.email}</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusBadge(userDetail.user || {}).bg, marginTop: 8 }]}>
                  <Text style={{ color: getStatusBadge(userDetail.user || {}).color, fontSize: 12 }}>
                    {getStatusBadge(userDetail.user || {}).label}
                  </Text>
                </View>
              </View>

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={[styles.statBox, styles.statAmber]}>
                  <Text style={styles.statValue}>{(userDetail.user?.bl_coins || 0).toLocaleString()}</Text>
                  <Text style={styles.statLabel}>BL Coins</Text>
                </View>
                <View style={[styles.statBox, styles.statGreen]}>
                  <Text style={styles.statValue}>${(userDetail.user?.usd_balance || 0).toFixed(2)}</Text>
                  <Text style={styles.statLabel}>USD</Text>
                </View>
                <View style={[styles.statBox, styles.statBlue]}>
                  <Text style={styles.statValue}>{userDetail.stats?.referral_count || 0}</Text>
                  <Text style={styles.statLabel}>Referrals</Text>
                </View>
              </View>

              {/* Admin Actions */}
              <View style={styles.actionsSection}>
                <Text style={styles.sectionTitle}>Admin Actions</Text>
                <View style={styles.actionsGrid}>
                  {userDetail.user?.is_suspended ? (
                    <TouchableOpacity style={[styles.actionButton, styles.actionGreen]} onPress={handleUnsuspend} disabled={actionLoading}>
                      <Text style={styles.actionIcon}>✓</Text>
                      <Text style={styles.actionText}>Unsuspend</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.actionButton, styles.actionYellow]} onPress={() => setShowSuspendModal(true)} disabled={userDetail.user?.is_banned || actionLoading}>
                      <Text style={styles.actionIcon}>⏸</Text>
                      <Text style={styles.actionText}>Suspend</Text>
                    </TouchableOpacity>
                  )}

                  {userDetail.user?.is_banned ? (
                    <TouchableOpacity style={[styles.actionButton, styles.actionGreen]} onPress={handleUnban} disabled={actionLoading}>
                      <Text style={styles.actionIcon}>✓</Text>
                      <Text style={styles.actionText}>Unban</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.actionButton, styles.actionRed]} onPress={() => setShowBanModal(true)} disabled={actionLoading}>
                      <Text style={styles.actionIcon}>🚫</Text>
                      <Text style={styles.actionText}>Ban User</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.actionButton} onPress={handleResetPassword} disabled={actionLoading}>
                    <Text style={styles.actionIcon}>🔑</Text>
                    <Text style={styles.actionText}>Reset PW</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton} onPress={handleForceLogout} disabled={actionLoading}>
                    <Text style={styles.actionIcon}>🚪</Text>
                    <Text style={styles.actionText}>Logout</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.actionButton, styles.actionBlue, { width: '100%', marginTop: 12 }]} onPress={() => setShowBalanceModal(true)} disabled={actionLoading}>
                  <Text style={styles.actionIcon}>💰</Text>
                  <Text style={styles.actionText}>Adjust Balance</Text>
                </TouchableOpacity>
              </View>

              {/* Recent Transactions */}
              <View style={styles.transactionsSection}>
                <Text style={styles.sectionTitle}>Recent Transactions</Text>
                {userDetail.recent_transactions?.length === 0 ? (
                  <Text style={styles.noData}>No transactions</Text>
                ) : (
                  userDetail.recent_transactions?.slice(0, 5).map((txn, i) => (
                    <View key={txn.transaction_id || i} style={styles.txnRow}>
                      <View>
                        <Text style={styles.txnType}>{txn.transaction_type?.replace(/_/g, ' ')}</Text>
                        <Text style={styles.txnDate}>{new Date(txn.created_at).toLocaleDateString()}</Text>
                      </View>
                      <Text style={[styles.txnAmount, txn.amount >= 0 ? styles.txnPositive : styles.txnNegative]}>
                        {txn.amount >= 0 ? '+' : ''}{txn.amount} {txn.currency?.toUpperCase()}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Suspend Modal */}
      <Modal visible={showSuspendModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.actionModal}>
            <Text style={styles.actionModalTitle}>Suspend User</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for suspension"
              placeholderTextColor="#64748B"
              value={actionReason}
              onChangeText={setActionReason}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Duration (days)"
              placeholderTextColor="#64748B"
              value={suspendDays}
              onChangeText={setSuspendDays}
              keyboardType="number-pad"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowSuspendModal(false); setActionReason(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, styles.actionYellow]} onPress={handleSuspend} disabled={actionLoading}>
                <Text style={styles.modalConfirmText}>{actionLoading ? 'Loading...' : 'Suspend'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ban Modal */}
      <Modal visible={showBanModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.actionModal}>
            <Text style={styles.actionModalTitle}>Ban User</Text>
            <Text style={styles.warningText}>⚠️ This action will permanently ban the user.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for ban"
              placeholderTextColor="#64748B"
              value={actionReason}
              onChangeText={setActionReason}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowBanModal(false); setActionReason(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, styles.actionRed]} onPress={handleBan} disabled={actionLoading}>
                <Text style={styles.modalConfirmText}>{actionLoading ? 'Loading...' : 'Ban User'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Balance Adjust Modal */}
      <Modal visible={showBalanceModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.actionModal}>
            <Text style={styles.actionModalTitle}>Adjust Balance</Text>
            <View style={styles.currencyRow}>
              <TouchableOpacity
                style={[styles.currencyButton, balanceAdjust.currency === 'bl_coins' && styles.currencyActive]}
                onPress={() => setBalanceAdjust({ ...balanceAdjust, currency: 'bl_coins' })}
              >
                <Text style={styles.currencyText}>BL Coins</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.currencyButton, balanceAdjust.currency === 'usd' && styles.currencyActive]}
                onPress={() => setBalanceAdjust({ ...balanceAdjust, currency: 'usd' })}
              >
                <Text style={styles.currencyText}>USD</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Amount (negative for debit)"
              placeholderTextColor="#64748B"
              value={balanceAdjust.amount}
              onChangeText={(text) => setBalanceAdjust({ ...balanceAdjust, amount: text })}
              keyboardType="numeric"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Reason (for audit)"
              placeholderTextColor="#64748B"
              value={balanceAdjust.reason}
              onChangeText={(text) => setBalanceAdjust({ ...balanceAdjust, reason: text })}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowBalanceModal(false); setBalanceAdjust({ currency: 'bl_coins', amount: '', reason: '' }); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirm, styles.actionBlue]} onPress={handleBalanceAdjust} disabled={actionLoading}>
                <Text style={styles.modalConfirmText}>{actionLoading ? 'Loading...' : 'Adjust'}</Text>
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
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: '#94A3B8' },
  refreshButton: { marginLeft: 'auto', padding: 8 },
  refreshText: { fontSize: 20, color: '#3B82F6' },
  searchContainer: { padding: 16 },
  searchInput: { backgroundColor: '#1E293B', borderRadius: 12, padding: 12, color: '#fff', fontSize: 16 },
  filterRow: { paddingHorizontal: 16, marginBottom: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1E293B', borderRadius: 20, marginRight: 8 },
  filterChipActive: { backgroundColor: '#3B82F6' },
  filterText: { color: '#94A3B8', fontSize: 14 },
  filterTextActive: { color: '#fff' },
  content: { flex: 1, paddingHorizontal: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { color: '#64748B', fontSize: 16 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', padding: 12, borderRadius: 12, marginBottom: 8 },
  userAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userAvatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  userInfo: { flex: 1 },
  userName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  userEmail: { color: '#94A3B8', fontSize: 13 },
  userStats: { flexDirection: 'row', gap: 12, marginTop: 4 },
  statText: { color: '#64748B', fontSize: 12 },
  userRight: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  userDate: { color: '#64748B', fontSize: 11, marginTop: 4 },
  pagination: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  pageButton: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1E293B', borderRadius: 8 },
  pageButtonDisabled: { opacity: 0.5 },
  pageButtonText: { color: '#fff' },
  pageInfo: { color: '#94A3B8' },
  // Modal styles
  modalContainer: { flex: 1, backgroundColor: '#0F172A' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  modalClose: { fontSize: 24, color: '#94A3B8' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  modalContent: { flex: 1, padding: 16 },
  detailCard: { alignItems: 'center', padding: 20, backgroundColor: '#1E293B', borderRadius: 16, marginBottom: 16 },
  detailAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  detailAvatarText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
  detailName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  detailEmail: { color: '#94A3B8', fontSize: 14, marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  statAmber: { backgroundColor: '#F59E0B20' },
  statGreen: { backgroundColor: '#10B98120' },
  statBlue: { backgroundColor: '#3B82F620' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  actionsSection: { marginBottom: 16 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButton: { width: '48%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: '#1E293B', borderRadius: 12, gap: 8 },
  actionYellow: { backgroundColor: '#F59E0B20', borderWidth: 1, borderColor: '#F59E0B40' },
  actionRed: { backgroundColor: '#EF444420', borderWidth: 1, borderColor: '#EF444440' },
  actionGreen: { backgroundColor: '#10B98120', borderWidth: 1, borderColor: '#10B98140' },
  actionBlue: { backgroundColor: '#3B82F620', borderWidth: 1, borderColor: '#3B82F640' },
  actionIcon: { fontSize: 16 },
  actionText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  transactionsSection: { marginBottom: 32 },
  noData: { color: '#64748B', textAlign: 'center', paddingVertical: 20 },
  txnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#1E293B', borderRadius: 8, marginBottom: 8 },
  txnType: { color: '#fff', fontSize: 14, textTransform: 'capitalize' },
  txnDate: { color: '#64748B', fontSize: 12, marginTop: 2 },
  txnAmount: { fontSize: 14, fontWeight: 'bold' },
  txnPositive: { color: '#10B981' },
  txnNegative: { color: '#EF4444' },
  // Action Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  actionModal: { width: '100%', backgroundColor: '#1E293B', borderRadius: 16, padding: 20 },
  actionModalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
  warningText: { color: '#EF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  modalInput: { backgroundColor: '#0F172A', borderRadius: 8, padding: 12, color: '#fff', marginBottom: 12 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#334155', alignItems: 'center' },
  modalCancelText: { color: '#94A3B8', fontWeight: '600' },
  modalConfirm: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '600' },
  currencyRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  currencyButton: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: '#0F172A', alignItems: 'center' },
  currencyActive: { backgroundColor: '#3B82F6' },
  currencyText: { color: '#fff', fontWeight: '500' },
});
