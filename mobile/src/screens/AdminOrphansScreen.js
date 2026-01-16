/**
 * Admin Orphans Screen for Blendlink Mobile
 * Manage orphan users (without referrers) based on 11 priority tiers
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

const PRIORITY_TIERS = [
  "ID-verified + 0 recruits + daily login",
  "0 recruits + daily login",
  "0 recruits + weekly login",
  "0 recruits + monthly login",
  "0 recruits + quarterly login",
  "ID-verified + 1 recruit + daily login",
  "1 recruit + daily login",
  "1 recruit + weekly login",
  "1 recruit + monthly login",
  "1 recruit + quarterly login",
  "1 recruit + biannual login",
];

export default function AdminOrphansScreen({ navigation }) {
  const [orphans, setOrphans] = useState([]);
  const [potentialParents, setPotentialParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({
    total_orphans: 0,
    unassigned: 0,
    assigned_today: 0,
  });
  const [assignModal, setAssignModal] = useState(null);
  const [assigning, setAssigning] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [orphansData, parentsData, statsData] = await Promise.all([
        adminAPI.getOrphansAdmin(),
        adminAPI.getPotentialParents(),
        adminAPI.getOrphanStats(),
      ]);
      setOrphans(orphansData.orphans || []);
      setPotentialParents(parentsData.parents || []);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load orphan data:', error);
      Alert.alert('Error', 'Failed to load orphan data');
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

  const handleAutoAssign = async (orphanId) => {
    setAssigning(true);
    try {
      const result = await adminAPI.autoAssignOrphan(orphanId);
      Alert.alert('Success', `Assigned to ${result.assigned_to_username}`);
      loadData();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to auto-assign');
    } finally {
      setAssigning(false);
    }
  };

  const handleManualAssign = async (orphanId, parentId) => {
    setAssigning(true);
    try {
      await adminAPI.manualAssignOrphan(orphanId, parentId);
      Alert.alert('Success', 'Orphan assigned successfully');
      setAssignModal(null);
      loadData();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const filteredOrphans = orphans.filter(orphan => {
    const matchesSearch = !search || 
      orphan.username?.toLowerCase().includes(search.toLowerCase()) ||
      orphan.email?.toLowerCase().includes(search.toLowerCase());
    
    const matchesFilter = filter === 'all' || 
      (filter === 'unassigned' && !orphan.is_orphan_assigned) ||
      (filter === 'assigned' && orphan.is_orphan_assigned);
    
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading Orphans...</Text>
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
        <Text style={styles.headerTitle}>👥 Orphan Management</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />
        }
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statPurple]}>
            <Text style={styles.statValue}>{stats.total_orphans}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, styles.statAmber]}>
            <Text style={styles.statValue}>{stats.unassigned}</Text>
            <Text style={styles.statLabel}>Unassigned</Text>
          </View>
          <View style={[styles.statCard, styles.statGreen]}>
            <Text style={styles.statValue}>{stats.assigned_today}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
        </View>

        {/* Priority Tiers Info */}
        <View style={styles.tiersCard}>
          <Text style={styles.tiersTitle}>11 Priority Tiers</Text>
          <Text style={styles.tiersSubtitle}>Max 2 orphans per user • Must be active within 6 months</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {PRIORITY_TIERS.map((tier, idx) => (
              <View key={idx} style={styles.tierBadge}>
                <Text style={styles.tierNum}>{idx + 1}</Text>
                <Text style={styles.tierText}>{tier}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Search & Filter */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search orphans..."
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={setSearch}
          />
        </View>
        
        <View style={styles.filterRow}>
          {['all', 'unassigned', 'assigned'].map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Orphans List */}
        {filteredOrphans.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>No orphans found</Text>
          </View>
        ) : (
          filteredOrphans.map((orphan) => (
            <View key={orphan.user_id} style={styles.orphanCard}>
              <View style={styles.orphanAvatar}>
                <Text style={styles.avatarText}>
                  {orphan.username?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
              <View style={styles.orphanInfo}>
                <View style={styles.orphanHeader}>
                  <Text style={styles.orphanName}>{orphan.username}</Text>
                  <View style={[
                    styles.statusBadge,
                    orphan.is_orphan_assigned ? styles.statusAssigned : styles.statusUnassigned
                  ]}>
                    <Text style={styles.statusText}>
                      {orphan.is_orphan_assigned ? 'Assigned' : 'Unassigned'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.orphanEmail}>{orphan.email}</Text>
                <Text style={styles.orphanMeta}>
                  Joined: {formatTimeAgo(orphan.created_at)} • {(orphan.bl_coins || 0).toLocaleString()} BL
                </Text>
                {orphan.is_orphan_assigned && orphan.assigned_to_username && (
                  <Text style={styles.assignedTo}>→ {orphan.assigned_to_username}</Text>
                )}
              </View>
              {!orphan.is_orphan_assigned && (
                <View style={styles.orphanActions}>
                  <TouchableOpacity
                    style={styles.autoBtn}
                    onPress={() => handleAutoAssign(orphan.user_id)}
                    disabled={assigning}
                  >
                    <Text style={styles.autoBtnText}>Auto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.manualBtn}
                    onPress={() => setAssignModal(orphan)}
                  >
                    <Text style={styles.manualBtnText}>Manual</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Manual Assignment Modal */}
      <Modal
        visible={!!assignModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAssignModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manual Assignment</Text>
              <TouchableOpacity onPress={() => setAssignModal(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {assignModal && (
              <Text style={styles.modalSubtitle}>
                Assign {assignModal.username} to:
              </Text>
            )}
            <ScrollView style={styles.parentsList}>
              {potentialParents.map((parent) => (
                <TouchableOpacity
                  key={parent.user_id}
                  style={styles.parentItem}
                  onPress={() => handleManualAssign(assignModal?.user_id, parent.user_id)}
                  disabled={assigning}
                >
                  <View style={styles.parentAvatar}>
                    <Text style={styles.parentAvatarText}>
                      {parent.username?.[0]?.toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.parentInfo}>
                    <Text style={styles.parentName}>{parent.username}</Text>
                    <Text style={styles.parentMeta}>
                      Tier {parent.tier} • {parent.direct_referrals} recruits • {parent.orphans_assigned}/2 orphans
                    </Text>
                  </View>
                  <Text style={styles.parentArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
    color: '#8B5CF6',
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
  statPurple: {
    backgroundColor: '#8B5CF620',
    borderColor: '#8B5CF640',
    borderWidth: 1,
  },
  statAmber: {
    backgroundColor: '#F59E0B20',
    borderColor: '#F59E0B40',
    borderWidth: 1,
  },
  statGreen: {
    backgroundColor: '#10B98120',
    borderColor: '#10B98140',
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
  tiersCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tiersTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  tiersSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 12,
  },
  tierBadge: {
    backgroundColor: '#334155',
    borderRadius: 8,
    padding: 8,
    marginRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tierNum: {
    color: '#8B5CF6',
    fontWeight: 'bold',
    fontSize: 12,
  },
  tierText: {
    color: '#94A3B8',
    fontSize: 10,
    maxWidth: 100,
  },
  searchRow: {
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
  },
  filterBtnActive: {
    backgroundColor: '#8B5CF6',
  },
  filterText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  filterTextActive: {
    color: '#fff',
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
  orphanCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  orphanAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  orphanInfo: {
    flex: 1,
  },
  orphanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  orphanName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusAssigned: {
    backgroundColor: '#10B98130',
  },
  statusUnassigned: {
    backgroundColor: '#F59E0B30',
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
  },
  orphanEmail: {
    color: '#94A3B8',
    fontSize: 13,
  },
  orphanMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  assignedTo: {
    color: '#10B981',
    fontSize: 12,
    marginTop: 4,
  },
  orphanActions: {
    flexDirection: 'column',
    gap: 6,
  },
  autoBtn: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  autoBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  manualBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  manualBtnText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalClose: {
    color: '#64748B',
    fontSize: 24,
  },
  modalSubtitle: {
    color: '#94A3B8',
    marginBottom: 16,
  },
  parentsList: {
    maxHeight: 400,
  },
  parentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  parentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  parentAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  parentInfo: {
    flex: 1,
  },
  parentName: {
    color: '#fff',
    fontWeight: '600',
  },
  parentMeta: {
    color: '#64748B',
    fontSize: 11,
  },
  parentArrow: {
    color: '#64748B',
    fontSize: 18,
  },
});
