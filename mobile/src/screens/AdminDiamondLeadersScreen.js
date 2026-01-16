/**
 * Admin Diamond Leaders Screen for Blendlink Mobile
 * Manage Diamond Leader promotions, demotions, and performance
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
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminAPI } from '../services/api';

const QUALIFICATION_REQUIREMENTS = {
  direct_recruits: 100,
  downline_commissions: 1000,
  personal_sales: 1000,
  bl_coins_earned: 6000000,
};

const MAINTENANCE_REQUIREMENTS = {
  new_recruits: 1,
  personal_sales: 10,
  team_commissions: 10,
  bl_earned: 100000,
};

export default function AdminDiamondLeadersScreen({ navigation }) {
  const [diamonds, setDiamonds] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [pendingDemotions, setPendingDemotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('active');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({
    total_diamonds: 0,
    promoted_this_month: 0,
    demoted_this_month: 0,
    pending_bonuses: 0,
  });
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [diamondsData, candidatesData, demotionsData, statsData] = await Promise.all([
        adminAPI.getDiamondLeaders(),
        adminAPI.getDiamondCandidates(),
        adminAPI.getPendingDemotions(),
        adminAPI.getDiamondStats(),
      ]);
      setDiamonds(diamondsData.diamonds || []);
      setCandidates(candidatesData.candidates || []);
      setPendingDemotions(demotionsData.pending || []);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load diamond data:', error);
      Alert.alert('Error', 'Failed to load diamond leaders data');
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

  const handlePromote = async (userId) => {
    setActionLoading(true);
    try {
      await adminAPI.promoteToDiamond(userId);
      Alert.alert('Success', 'User promoted to Diamond Leader! 10M BL + $100 USD bonus awarded.');
      setSelectedUser(null);
      loadData();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to promote user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDemote = async (userId) => {
    setActionLoading(true);
    try {
      await adminAPI.demoteDiamond(userId);
      Alert.alert('Success', 'User demoted from Diamond Leader');
      setSelectedUser(null);
      loadData();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to demote user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExtend = async (userId) => {
    setActionLoading(true);
    try {
      await adminAPI.extendMaintenance(userId, 30);
      Alert.alert('Success', 'Maintenance period extended by 30 days');
      loadData();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to extend');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  const getProgressPercent = (current, required) => {
    return Math.min(Math.round((current / required) * 100), 100);
  };

  const getCurrentList = () => {
    const list = tab === 'active' ? diamonds : tab === 'candidates' ? candidates : pendingDemotions;
    if (!search) return list;
    return list.filter(item => 
      item.username?.toLowerCase().includes(search.toLowerCase()) ||
      item.email?.toLowerCase().includes(search.toLowerCase())
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Loading Diamond Leaders...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>👑 Diamond Leaders</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />
        }
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statGold]}>
            <Text style={styles.statValue}>{stats.total_diamonds}</Text>
            <Text style={styles.statLabel}>Diamonds</Text>
          </View>
          <View style={[styles.statCard, styles.statGreen]}>
            <Text style={styles.statValue}>{stats.promoted_this_month}</Text>
            <Text style={styles.statLabel}>Promoted</Text>
          </View>
          <View style={[styles.statCard, styles.statRed]}>
            <Text style={styles.statValue}>{stats.demoted_this_month}</Text>
            <Text style={styles.statLabel}>Demoted</Text>
          </View>
        </View>

        {/* Requirements Cards */}
        <View style={styles.requirementsRow}>
          <View style={styles.reqCard}>
            <Text style={styles.reqTitle}>🎯 Qualification (30d)</Text>
            <Text style={styles.reqItem}>• {QUALIFICATION_REQUIREMENTS.direct_recruits} recruits</Text>
            <Text style={styles.reqItem}>• ${QUALIFICATION_REQUIREMENTS.downline_commissions} commissions</Text>
            <Text style={styles.reqItem}>• ${QUALIFICATION_REQUIREMENTS.personal_sales} sales</Text>
            <Text style={styles.reqItem}>• {(QUALIFICATION_REQUIREMENTS.bl_coins_earned / 1000000).toFixed(0)}M BL</Text>
            <Text style={styles.reqBonus}>Bonus: 10M BL + $100</Text>
          </View>
          <View style={styles.reqCard}>
            <Text style={styles.reqTitle}>⏰ Maintenance (30d)</Text>
            <Text style={styles.reqItem}>• {MAINTENANCE_REQUIREMENTS.new_recruits}+ new recruit</Text>
            <Text style={styles.reqItem}>• ${MAINTENANCE_REQUIREMENTS.personal_sales}+ sales</Text>
            <Text style={styles.reqItem}>• ${MAINTENANCE_REQUIREMENTS.team_commissions}+ commissions</Text>
            <Text style={styles.reqItem}>• {(MAINTENANCE_REQUIREMENTS.bl_earned / 1000).toFixed(0)}K BL</Text>
            <Text style={styles.reqWarning}>Failure = Demotion</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {[
            { key: 'active', label: 'Active', count: diamonds.length },
            { key: 'candidates', label: 'Candidates', count: candidates.length },
            { key: 'demotions', label: 'Pending', count: pendingDemotions.length },
          ].map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
                {t.label}
              </Text>
              {t.count > 0 && (
                <View style={[styles.tabBadge, t.key === 'demotions' && t.count > 0 && styles.tabBadgeRed]}>
                  <Text style={styles.tabBadgeText}>{t.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Search */}
        <TextInput
          style={styles.searchInput}
          placeholder="Search..."
          placeholderTextColor="#64748B"
          value={search}
          onChangeText={setSearch}
        />

        {/* List */}
        {getCurrentList().length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👑</Text>
            <Text style={styles.emptyText}>
              No {tab === 'active' ? 'diamond leaders' : tab === 'candidates' ? 'candidates' : 'pending demotions'}
            </Text>
          </View>
        ) : (
          getCurrentList().map((user) => (
            <View key={user.user_id} style={styles.userCard}>
              <View style={[styles.userAvatar, tab === 'active' && styles.avatarGold]}>
                {tab === 'active' ? (
                  <Text style={styles.avatarIcon}>👑</Text>
                ) : (
                  <Text style={styles.avatarText}>{user.username?.[0]?.toUpperCase() || '?'}</Text>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.username}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
                
                {/* Progress for candidates */}
                {tab === 'candidates' && user.progress && (
                  <View style={styles.progressContainer}>
                    {Object.entries(user.progress).map(([key, val]) => (
                      <View key={key} style={styles.progressItem}>
                        <View style={styles.progressBar}>
                          <View 
                            style={[
                              styles.progressFill, 
                              { width: `${getProgressPercent(val.current, val.required)}%` }
                            ]} 
                          />
                        </View>
                        <Text style={styles.progressText}>
                          {getProgressPercent(val.current, val.required)}%
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                
                {/* Stats for active diamonds */}
                {tab === 'active' && (
                  <Text style={styles.userMeta}>
                    Since: {formatDate(user.diamond_achieved_at)} • Due: {formatDate(user.diamond_maintenance_due)}
                  </Text>
                )}
              </View>
              
              {/* Actions */}
              <View style={styles.userActions}>
                {tab === 'active' && (
                  <>
                    <TouchableOpacity
                      style={styles.extendBtn}
                      onPress={() => handleExtend(user.user_id)}
                    >
                      <Text style={styles.extendBtnText}>+30d</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.demoteBtn}
                      onPress={() => setSelectedUser({ ...user, action: 'demote' })}
                    >
                      <Text style={styles.demoteBtnText}>Demote</Text>
                    </TouchableOpacity>
                  </>
                )}
                {tab === 'candidates' && (
                  <TouchableOpacity
                    style={[styles.promoteBtn, !user.qualified && styles.btnDisabled]}
                    onPress={() => user.qualified && setSelectedUser({ ...user, action: 'promote' })}
                    disabled={!user.qualified}
                  >
                    <Text style={styles.promoteBtnText}>
                      {user.qualified ? 'Promote' : 'Not Ready'}
                    </Text>
                  </TouchableOpacity>
                )}
                {tab === 'demotions' && (
                  <>
                    <TouchableOpacity
                      style={styles.extendBtn}
                      onPress={() => handleExtend(user.user_id)}
                    >
                      <Text style={styles.extendBtnText}>Extend</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.demoteBtn}
                      onPress={() => handleDemote(user.user_id)}
                    >
                      <Text style={styles.demoteBtnText}>Approve</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={!!selectedUser}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSelectedUser(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedUser?.action === 'promote' ? '👑 Confirm Promotion' : '⚠️ Confirm Demotion'}
            </Text>
            <Text style={styles.modalText}>
              {selectedUser?.action === 'promote' 
                ? `Promote ${selectedUser?.username} to Diamond Leader?\n\nBonus: 10,000,000 BL + $100 USD`
                : `Demote ${selectedUser?.username} from Diamond Leader?\n\nBenefits will be reverted.`
              }
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setSelectedUser(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  selectedUser?.action === 'demote' && styles.modalConfirmRed
                ]}
                onPress={() => selectedUser?.action === 'promote' 
                  ? handlePromote(selectedUser.user_id) 
                  : handleDemote(selectedUser.user_id)
                }
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {selectedUser?.action === 'promote' ? 'Promote' : 'Demote'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    color: '#F59E0B',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statGold: {
    backgroundColor: '#F59E0B20',
    borderColor: '#F59E0B40',
    borderWidth: 1,
  },
  statGreen: {
    backgroundColor: '#10B98120',
    borderColor: '#10B98140',
    borderWidth: 1,
  },
  statRed: {
    backgroundColor: '#EF444420',
    borderColor: '#EF444440',
    borderWidth: 1,
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
  requirementsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  reqCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
  },
  reqTitle: {
    color: '#fff',
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 13,
  },
  reqItem: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 2,
  },
  reqBonus: {
    color: '#F59E0B',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  reqWarning: {
    color: '#EF4444',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#F59E0B',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeRed: {
    backgroundColor: '#EF4444',
  },
  tabBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  searchInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 16,
  },
  userCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarGold: {
    backgroundColor: '#F59E0B30',
  },
  avatarIcon: {
    fontSize: 24,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    color: '#94A3B8',
    fontSize: 12,
  },
  userMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 2,
  },
  progressText: {
    color: '#94A3B8',
    fontSize: 10,
    width: 30,
  },
  userActions: {
    flexDirection: 'column',
    gap: 6,
  },
  extendBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  extendBtnText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  demoteBtn: {
    backgroundColor: '#EF444430',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  demoteBtnText: {
    color: '#EF4444',
    fontSize: 12,
  },
  promoteBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnDisabled: {
    backgroundColor: '#334155',
  },
  promoteBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F59E0B',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmRed: {
    backgroundColor: '#EF4444',
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
});
