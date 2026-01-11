/**
 * Admin Genealogy Screen for Blendlink Mobile
 * View and manage user referral hierarchy/network tree
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

export default function AdminGenealogyScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [treeData, setTreeData] = useState(null);
  const [orphans, setOrphans] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userNetwork, setUserNetwork] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [newUplineId, setNewUplineId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [maxDepth, setMaxDepth] = useState(3);

  const loadGenealogyData = useCallback(async () => {
    try {
      const [tree, orphanData] = await Promise.all([
        adminAPI.getGenealogyTree(null, maxDepth),
        adminAPI.getOrphans().catch(() => ({ orphans: [] })),
      ]);
      setTreeData(tree);
      setOrphans(orphanData.orphans || []);
    } catch (error) {
      console.error('Failed to load genealogy:', error);
      Alert.alert('Error', 'Failed to load genealogy data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [maxDepth]);

  useEffect(() => {
    loadGenealogyData();
  }, [loadGenealogyData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGenealogyData();
  }, [loadGenealogyData]);

  const searchUser = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const result = await adminAPI.searchUsers({ query: searchQuery, limit: 1 });
      if (result.users?.length > 0) {
        const user = result.users[0];
        await loadUserNetwork(user.user_id);
      } else {
        Alert.alert('Not Found', 'No user found with that search term');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to search user');
    } finally {
      setLoading(false);
    }
  };

  const loadUserNetwork = async (userId) => {
    try {
      const network = await adminAPI.getUserNetwork(userId);
      setSelectedUser(userId);
      setUserNetwork(network);
      setShowUserModal(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to load user network');
    }
  };

  const handleReassign = async () => {
    if (!newUplineId.trim() || !reassignReason.trim()) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setActionLoading(true);
    try {
      await adminAPI.reassignDownline(selectedUser, newUplineId, reassignReason);
      Alert.alert('Success', 'User reassigned successfully');
      setShowReassignModal(false);
      setNewUplineId('');
      setReassignReason('');
      loadGenealogyData();
      loadUserNetwork(selectedUser);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to reassign user');
    } finally {
      setActionLoading(false);
    }
  };

  const renderTreeNode = (node, level = 0) => {
    if (!node) return null;
    
    return (
      <View key={node.user_id} style={[styles.treeNode, { marginLeft: level * 16 }]}>
        <TouchableOpacity 
          style={styles.nodeCard}
          onPress={() => loadUserNetwork(node.user_id)}
        >
          <View style={styles.nodeAvatar}>
            <Text style={styles.nodeAvatarText}>{node.name?.charAt(0) || '?'}</Text>
          </View>
          <View style={styles.nodeInfo}>
            <Text style={styles.nodeName}>{node.name || 'Unknown'}</Text>
            <Text style={styles.nodeEmail}>{node.email}</Text>
            <View style={styles.nodeStats}>
              <Text style={styles.nodeStatText}>👥 {node.direct_count || 0} direct</Text>
              <Text style={styles.nodeStatText}>🌳 {node.total_network || 0} total</Text>
            </View>
          </View>
          <View style={styles.nodeRight}>
            <View style={[styles.levelBadge, { backgroundColor: getLevelColor(node.rank || 'member') }]}>
              <Text style={styles.levelText}>{node.rank || 'Member'}</Text>
            </View>
          </View>
        </TouchableOpacity>
        
        {node.children?.map(child => renderTreeNode(child, level + 1))}
      </View>
    );
  };

  const getLevelColor = (rank) => {
    const colors = {
      'diamond': '#3B82F630',
      'platinum': '#8B5CF630',
      'gold': '#F59E0B30',
      'silver': '#64748B30',
      'member': '#1E293B',
    };
    return colors[rank?.toLowerCase()] || colors.member;
  };

  if (loading && !treeData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading genealogy...</Text>
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
          <Text style={styles.headerTitle}>Genealogy</Text>
          <Text style={styles.headerSubtitle}>Referral Network Tree</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search user by name, email, or ID..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={searchUser}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchButton} onPress={searchUser}>
          <Text style={styles.searchButtonText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Depth Control */}
      <View style={styles.depthControl}>
        <Text style={styles.depthLabel}>Tree Depth:</Text>
        {[2, 3, 4, 5].map(depth => (
          <TouchableOpacity
            key={depth}
            style={[styles.depthButton, maxDepth === depth && styles.depthButtonActive]}
            onPress={() => { setMaxDepth(depth); setLoading(true); }}
          >
            <Text style={[styles.depthButtonText, maxDepth === depth && styles.depthButtonTextActive]}>
              {depth}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statBlue]}>
          <Text style={styles.statValue}>{treeData?.total_users || 0}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={[styles.statCard, styles.statGreen]}>
          <Text style={styles.statValue}>{treeData?.total_with_network || 0}</Text>
          <Text style={styles.statLabel}>With Network</Text>
        </View>
        <View style={[styles.statCard, styles.statAmber]}>
          <Text style={styles.statValue}>{orphans.length}</Text>
          <Text style={styles.statLabel}>Orphans</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Orphans Alert */}
        {orphans.length > 0 && (
          <View style={styles.orphanAlert}>
            <Text style={styles.orphanAlertTitle}>⚠️ Orphaned Users ({orphans.length})</Text>
            <Text style={styles.orphanAlertText}>These users have no upline assigned</Text>
            {orphans.slice(0, 3).map(orphan => (
              <TouchableOpacity 
                key={orphan.user_id}
                style={styles.orphanRow}
                onPress={() => loadUserNetwork(orphan.user_id)}
              >
                <Text style={styles.orphanName}>{orphan.name}</Text>
                <Text style={styles.orphanEmail}>{orphan.email}</Text>
              </TouchableOpacity>
            ))}
            {orphans.length > 3 && (
              <Text style={styles.moreOrphans}>+{orphans.length - 3} more...</Text>
            )}
          </View>
        )}

        {/* Tree */}
        <View style={styles.treeContainer}>
          <Text style={styles.sectionTitle}>Network Tree</Text>
          {treeData?.tree?.map(node => renderTreeNode(node))}
          {(!treeData?.tree || treeData.tree.length === 0) && (
            <Text style={styles.noData}>No network data available</Text>
          )}
        </View>
      </ScrollView>

      {/* User Network Modal */}
      <Modal visible={showUserModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowUserModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>User Network</Text>
            <View style={{ width: 24 }} />
          </View>

          {userNetwork ? (
            <ScrollView style={styles.modalContent}>
              {/* User Info */}
              <View style={styles.userCard}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>{userNetwork.user?.name?.charAt(0) || '?'}</Text>
                </View>
                <Text style={styles.userName}>{userNetwork.user?.name}</Text>
                <Text style={styles.userEmail}>{userNetwork.user?.email}</Text>
                <Text style={styles.userId}>ID: {userNetwork.user?.user_id}</Text>
              </View>

              {/* Network Stats */}
              <View style={styles.networkStats}>
                <View style={styles.networkStatBox}>
                  <Text style={styles.networkStatValue}>{userNetwork.upline ? '1' : '0'}</Text>
                  <Text style={styles.networkStatLabel}>Upline</Text>
                </View>
                <View style={styles.networkStatBox}>
                  <Text style={styles.networkStatValue}>{userNetwork.direct_downline?.length || 0}</Text>
                  <Text style={styles.networkStatLabel}>Direct</Text>
                </View>
                <View style={styles.networkStatBox}>
                  <Text style={styles.networkStatValue}>{userNetwork.total_network || 0}</Text>
                  <Text style={styles.networkStatLabel}>Total</Text>
                </View>
              </View>

              {/* Upline */}
              {userNetwork.upline && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Upline (Sponsor)</Text>
                  <TouchableOpacity 
                    style={styles.memberRow}
                    onPress={() => loadUserNetwork(userNetwork.upline.user_id)}
                  >
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>{userNetwork.upline.name?.charAt(0)}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{userNetwork.upline.name}</Text>
                      <Text style={styles.memberEmail}>{userNetwork.upline.email}</Text>
                    </View>
                    <Text style={styles.memberArrow}>→</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Direct Downline */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Direct Downline ({userNetwork.direct_downline?.length || 0})</Text>
                {userNetwork.direct_downline?.length > 0 ? (
                  userNetwork.direct_downline.map(member => (
                    <TouchableOpacity 
                      key={member.user_id}
                      style={styles.memberRow}
                      onPress={() => loadUserNetwork(member.user_id)}
                    >
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>{member.name?.charAt(0)}</Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <Text style={styles.memberEmail}>{member.email}</Text>
                      </View>
                      <Text style={styles.memberArrow}>→</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noData}>No direct referrals</Text>
                )}
              </View>

              {/* Actions */}
              <View style={styles.actionsSection}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.actionBlue]}
                  onPress={() => setShowReassignModal(true)}
                >
                  <Text style={styles.actionButtonText}>🔄 Reassign to New Upline</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Reassign Modal */}
      <Modal visible={showReassignModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.actionModal}>
            <Text style={styles.actionModalTitle}>Reassign User</Text>
            <Text style={styles.warningText}>⚠️ This will move the user and their downline to a new sponsor</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="New Upline User ID"
              placeholderTextColor="#64748B"
              value={newUplineId}
              onChangeText={setNewUplineId}
            />
            <TextInput
              style={[styles.modalInput, styles.modalInputMultiline]}
              placeholder="Reason for reassignment (for audit)"
              placeholderTextColor="#64748B"
              value={reassignReason}
              onChangeText={setReassignReason}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalCancel} 
                onPress={() => { setShowReassignModal(false); setNewUplineId(''); setReassignReason(''); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalConfirm, styles.actionBlue]} 
                onPress={handleReassign}
                disabled={actionLoading}
              >
                <Text style={styles.modalConfirmText}>{actionLoading ? 'Loading...' : 'Reassign'}</Text>
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
  searchContainer: { flexDirection: 'row', padding: 16, gap: 8 },
  searchInput: { flex: 1, backgroundColor: '#1E293B', borderRadius: 12, padding: 12, color: '#fff', fontSize: 16 },
  searchButton: { backgroundColor: '#3B82F6', borderRadius: 12, padding: 12, justifyContent: 'center' },
  searchButtonText: { fontSize: 18 },
  depthControl: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  depthLabel: { color: '#94A3B8', fontSize: 14 },
  depthButton: { paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#1E293B', borderRadius: 8 },
  depthButtonActive: { backgroundColor: '#3B82F6' },
  depthButtonText: { color: '#94A3B8', fontWeight: '600' },
  depthButtonTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  statCard: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  statBlue: { backgroundColor: '#3B82F620' },
  statGreen: { backgroundColor: '#10B98120' },
  statAmber: { backgroundColor: '#F59E0B20' },
  statValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  content: { flex: 1, paddingHorizontal: 16 },
  orphanAlert: { backgroundColor: '#EF444420', borderWidth: 1, borderColor: '#EF444440', borderRadius: 12, padding: 16, marginBottom: 16 },
  orphanAlertTitle: { color: '#EF4444', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  orphanAlertText: { color: '#94A3B8', fontSize: 13, marginBottom: 12 },
  orphanRow: { backgroundColor: '#0F172A', padding: 10, borderRadius: 8, marginBottom: 6 },
  orphanName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  orphanEmail: { color: '#64748B', fontSize: 12 },
  moreOrphans: { color: '#64748B', fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  treeContainer: { marginBottom: 32 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  treeNode: { marginBottom: 4 },
  nodeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#3B82F6' },
  nodeAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  nodeAvatarText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  nodeInfo: { flex: 1 },
  nodeName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  nodeEmail: { color: '#94A3B8', fontSize: 12 },
  nodeStats: { flexDirection: 'row', gap: 12, marginTop: 4 },
  nodeStatText: { color: '#64748B', fontSize: 11 },
  nodeRight: { alignItems: 'flex-end' },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  levelText: { color: '#fff', fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  noData: { color: '#64748B', textAlign: 'center', paddingVertical: 20, fontStyle: 'italic' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0F172A' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  modalClose: { fontSize: 24, color: '#94A3B8' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  modalContent: { flex: 1, padding: 16 },
  userCard: { alignItems: 'center', padding: 20, backgroundColor: '#1E293B', borderRadius: 16, marginBottom: 16 },
  userAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  userAvatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  userName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  userEmail: { color: '#94A3B8', fontSize: 14, marginTop: 4 },
  userId: { color: '#64748B', fontSize: 12, marginTop: 4 },
  networkStats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  networkStatBox: { flex: 1, backgroundColor: '#1E293B', padding: 16, borderRadius: 12, alignItems: 'center' },
  networkStatValue: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  networkStatLabel: { color: '#94A3B8', fontSize: 12, marginTop: 4 },
  section: { marginBottom: 16 },
  memberRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', padding: 12, borderRadius: 12, marginBottom: 8 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberAvatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  memberInfo: { flex: 1 },
  memberName: { color: '#fff', fontSize: 14, fontWeight: '500' },
  memberEmail: { color: '#64748B', fontSize: 12 },
  memberArrow: { color: '#64748B', fontSize: 16 },
  actionsSection: { marginBottom: 32 },
  actionButton: { padding: 16, borderRadius: 12, alignItems: 'center' },
  actionBlue: { backgroundColor: '#3B82F620', borderWidth: 1, borderColor: '#3B82F640' },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  // Action Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  actionModal: { width: '100%', backgroundColor: '#1E293B', borderRadius: 16, padding: 20 },
  actionModalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  warningText: { color: '#F59E0B', fontSize: 13, marginBottom: 16, textAlign: 'center' },
  modalInput: { backgroundColor: '#0F172A', borderRadius: 8, padding: 12, color: '#fff', marginBottom: 12 },
  modalInputMultiline: { height: 80, textAlignVertical: 'top' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#334155', alignItems: 'center' },
  modalCancelText: { color: '#94A3B8', fontWeight: '600' },
  modalConfirm: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '600' },
});
