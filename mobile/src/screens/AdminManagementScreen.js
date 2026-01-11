/**
 * Admin Management Screen for Blendlink Mobile
 * Manage admin roles, permissions, and create new admins
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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminAPI } from '../services/api';

const ADMIN_ROLES = [
  { key: 'super_admin', label: 'Super Admin', color: '#F59E0B', description: 'Full access to all features' },
  { key: 'co_admin', label: 'Co-Admin', color: '#3B82F6', description: 'Most features except admin management' },
  { key: 'moderator', label: 'Moderator', color: '#10B981', description: 'User management and content moderation' },
];

const PERMISSIONS = [
  { key: 'users', label: 'User Management', description: 'View and manage users' },
  { key: 'finance', label: 'Financial', description: 'View balances and adjust funds' },
  { key: 'genealogy', label: 'Genealogy', description: 'Manage referral network' },
  { key: 'withdrawals', label: 'Withdrawals', description: 'Approve/reject withdrawals & KYC' },
  { key: 'analytics', label: 'Analytics', description: 'View platform analytics' },
  { key: 'settings', label: 'Settings', description: 'Configure platform settings' },
  { key: 'audit', label: 'Audit Logs', description: 'View admin activity logs' },
  { key: 'ab_testing', label: 'A/B Testing', description: 'Manage experiments' },
];

export default function AdminManagementScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // New admin form
  const [newAdminUserId, setNewAdminUserId] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('moderator');
  const [newAdminPermissions, setNewAdminPermissions] = useState({});
  
  // Edit form
  const [editRole, setEditRole] = useState('');
  const [editPermissions, setEditPermissions] = useState({});

  const loadAdmins = useCallback(async () => {
    try {
      const data = await adminAPI.listAdmins();
      setAdmins(data.admins || []);
    } catch (error) {
      console.error('Failed to load admins:', error);
      Alert.alert('Error', 'Failed to load admin list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAdmins();
  }, [loadAdmins]);

  const handleCreateAdmin = async () => {
    if (!newAdminUserId.trim()) {
      Alert.alert('Error', 'Please enter a user ID');
      return;
    }

    setActionLoading(true);
    try {
      await adminAPI.createAdmin(newAdminUserId, newAdminRole, newAdminPermissions);
      Alert.alert('Success', 'Admin created successfully');
      setShowAddModal(false);
      resetAddForm();
      loadAdmins();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create admin');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateAdmin = async () => {
    if (!selectedAdmin) return;

    setActionLoading(true);
    try {
      await adminAPI.updateAdmin(selectedAdmin.admin_id, {
        role: editRole,
        permissions: editPermissions,
      });
      Alert.alert('Success', 'Admin updated successfully');
      setShowEditModal(false);
      loadAdmins();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update admin');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAdmin = (admin) => {
    Alert.alert(
      'Remove Admin',
      `Are you sure you want to remove admin privileges from ${admin.user?.name || admin.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await adminAPI.deleteAdmin(admin.admin_id);
              Alert.alert('Success', 'Admin removed');
              loadAdmins();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to remove admin');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const openEditModal = (admin) => {
    setSelectedAdmin(admin);
    setEditRole(admin.role);
    setEditPermissions(admin.permissions || {});
    setShowEditModal(true);
  };

  const resetAddForm = () => {
    setNewAdminUserId('');
    setNewAdminRole('moderator');
    setNewAdminPermissions({});
  };

  const getRoleInfo = (roleKey) => {
    return ADMIN_ROLES.find(r => r.key === roleKey) || ADMIN_ROLES[2];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading admins...</Text>
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
          <Text style={styles.headerTitle}>Admin Management</Text>
          <Text style={styles.headerSubtitle}>{admins.length} administrators</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Role Legend */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.legendRow}>
        {ADMIN_ROLES.map(role => (
          <View key={role.key} style={[styles.legendChip, { backgroundColor: role.color + '20' }]}>
            <View style={[styles.legendDot, { backgroundColor: role.color }]} />
            <Text style={[styles.legendText, { color: role.color }]}>{role.label}</Text>
          </View>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {admins.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyText}>No admins found</Text>
          </View>
        ) : (
          admins.map((admin) => {
            const roleInfo = getRoleInfo(admin.role);
            return (
              <TouchableOpacity
                key={admin.admin_id}
                style={styles.adminCard}
                onPress={() => openEditModal(admin)}
              >
                <View style={[styles.adminAvatar, { borderColor: roleInfo.color }]}>
                  <Text style={styles.adminAvatarText}>
                    {admin.user?.name?.charAt(0) || admin.email?.charAt(0) || '?'}
                  </Text>
                </View>
                <View style={styles.adminInfo}>
                  <Text style={styles.adminName}>{admin.user?.name || 'Unknown'}</Text>
                  <Text style={styles.adminEmail}>{admin.user?.email || admin.email}</Text>
                  <View style={styles.permissionTags}>
                    {Object.entries(admin.permissions || {}).filter(([_, v]) => v).slice(0, 3).map(([key]) => (
                      <View key={key} style={styles.permissionTag}>
                        <Text style={styles.permissionTagText}>{key}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.adminRight}>
                  <View style={[styles.roleBadge, { backgroundColor: roleInfo.color + '20' }]}>
                    <Text style={[styles.roleText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
                  </View>
                  <View style={[styles.statusDot, admin.is_active ? styles.statusActive : styles.statusInactive]} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add Admin Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowAddModal(false); resetAddForm(); }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add New Admin</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* User ID Input */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>User ID</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Enter user ID to promote"
                placeholderTextColor="#64748B"
                value={newAdminUserId}
                onChangeText={setNewAdminUserId}
              />
              <Text style={styles.formHint}>Enter the user_id of the user you want to make admin</Text>
            </View>

            {/* Role Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Role</Text>
              {ADMIN_ROLES.map(role => (
                <TouchableOpacity
                  key={role.key}
                  style={[styles.roleOption, newAdminRole === role.key && styles.roleOptionActive]}
                  onPress={() => setNewAdminRole(role.key)}
                >
                  <View style={[styles.radioOuter, newAdminRole === role.key && { borderColor: role.color }]}>
                    {newAdminRole === role.key && <View style={[styles.radioInner, { backgroundColor: role.color }]} />}
                  </View>
                  <View style={styles.roleOptionInfo}>
                    <Text style={[styles.roleOptionLabel, { color: role.color }]}>{role.label}</Text>
                    <Text style={styles.roleOptionDesc}>{role.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Permissions */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Permissions</Text>
              {PERMISSIONS.map(perm => (
                <View key={perm.key} style={styles.permissionRow}>
                  <View style={styles.permissionInfo}>
                    <Text style={styles.permissionLabel}>{perm.label}</Text>
                    <Text style={styles.permissionDesc}>{perm.description}</Text>
                  </View>
                  <Switch
                    value={newAdminPermissions[perm.key] || false}
                    onValueChange={(val) => setNewAdminPermissions({ ...newAdminPermissions, [perm.key]: val })}
                    trackColor={{ false: '#334155', true: '#3B82F6' }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.submitButton, actionLoading && styles.submitButtonDisabled]}
              onPress={handleCreateAdmin}
              disabled={actionLoading}
            >
              <Text style={styles.submitButtonText}>
                {actionLoading ? 'Creating...' : 'Create Admin'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Admin Modal */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Admin</Text>
            <TouchableOpacity onPress={() => { setShowEditModal(false); handleDeleteAdmin(selectedAdmin); }}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Admin Info */}
            {selectedAdmin && (
              <View style={styles.editAdminInfo}>
                <View style={styles.editAvatar}>
                  <Text style={styles.editAvatarText}>{selectedAdmin.user?.name?.charAt(0) || '?'}</Text>
                </View>
                <Text style={styles.editName}>{selectedAdmin.user?.name}</Text>
                <Text style={styles.editEmail}>{selectedAdmin.user?.email || selectedAdmin.email}</Text>
              </View>
            )}

            {/* Role Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Role</Text>
              {ADMIN_ROLES.map(role => (
                <TouchableOpacity
                  key={role.key}
                  style={[styles.roleOption, editRole === role.key && styles.roleOptionActive]}
                  onPress={() => setEditRole(role.key)}
                >
                  <View style={[styles.radioOuter, editRole === role.key && { borderColor: role.color }]}>
                    {editRole === role.key && <View style={[styles.radioInner, { backgroundColor: role.color }]} />}
                  </View>
                  <View style={styles.roleOptionInfo}>
                    <Text style={[styles.roleOptionLabel, { color: role.color }]}>{role.label}</Text>
                    <Text style={styles.roleOptionDesc}>{role.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Permissions */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Permissions</Text>
              {PERMISSIONS.map(perm => (
                <View key={perm.key} style={styles.permissionRow}>
                  <View style={styles.permissionInfo}>
                    <Text style={styles.permissionLabel}>{perm.label}</Text>
                    <Text style={styles.permissionDesc}>{perm.description}</Text>
                  </View>
                  <Switch
                    value={editPermissions[perm.key] || false}
                    onValueChange={(val) => setEditPermissions({ ...editPermissions, [perm.key]: val })}
                    trackColor={{ false: '#334155', true: '#3B82F6' }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
            </View>

            {/* Update Button */}
            <TouchableOpacity
              style={[styles.submitButton, actionLoading && styles.submitButtonDisabled]}
              onPress={handleUpdateAdmin}
              disabled={actionLoading}
            >
              <Text style={styles.submitButtonText}>
                {actionLoading ? 'Updating...' : 'Update Admin'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
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
  addButton: { marginLeft: 'auto', backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  legendRow: { paddingHorizontal: 16, paddingVertical: 12 },
  legendChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyText: { color: '#64748B', fontSize: 16 },
  adminCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', padding: 16, borderRadius: 12, marginBottom: 12 },
  adminAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 2 },
  adminAvatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  adminInfo: { flex: 1 },
  adminName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  adminEmail: { color: '#94A3B8', fontSize: 13, marginTop: 2 },
  permissionTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  permissionTag: { backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  permissionTagText: { color: '#94A3B8', fontSize: 10, textTransform: 'capitalize' },
  adminRight: { alignItems: 'flex-end' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleText: { fontSize: 11, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8 },
  statusActive: { backgroundColor: '#10B981' },
  statusInactive: { backgroundColor: '#64748B' },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#0F172A' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  modalClose: { fontSize: 24, color: '#94A3B8' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  deleteText: { color: '#EF4444', fontWeight: '600' },
  modalContent: { flex: 1, padding: 16 },
  formGroup: { marginBottom: 24 },
  formLabel: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  formInput: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, color: '#fff', fontSize: 16 },
  formHint: { color: '#64748B', fontSize: 12, marginTop: 8 },
  roleOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', padding: 16, borderRadius: 12, marginBottom: 8 },
  roleOptionActive: { borderWidth: 1, borderColor: '#3B82F6' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#64748B', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  roleOptionInfo: { flex: 1 },
  roleOptionLabel: { fontSize: 16, fontWeight: '600' },
  roleOptionDesc: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  permissionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E293B', padding: 16, borderRadius: 12, marginBottom: 8 },
  permissionInfo: { flex: 1, marginRight: 16 },
  permissionLabel: { color: '#fff', fontSize: 14, fontWeight: '500' },
  permissionDesc: { color: '#64748B', fontSize: 12, marginTop: 2 },
  submitButton: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16, marginBottom: 32 },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  editAdminInfo: { alignItems: 'center', padding: 20, backgroundColor: '#1E293B', borderRadius: 16, marginBottom: 24 },
  editAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  editAvatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  editName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  editEmail: { color: '#94A3B8', fontSize: 14, marginTop: 4 },
});
