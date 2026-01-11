/**
 * Admin A/B Testing Screen
 * Create and manage A/B tests with configurable percentage splits
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminAPI } from '../services/api';

const TEST_TYPES = [
  { id: 'ui_element', label: 'UI Element', icon: '🎨', desc: 'Button colors, layouts, CTAs' },
  { id: 'feature', label: 'Feature', icon: '⚡', desc: 'Onboarding flows, pricing' },
  { id: 'content', label: 'Content', icon: '📝', desc: 'Copy, images, messaging' },
];

export default function AdminABTestingScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tests, setTests] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadTests = useCallback(async () => {
    try {
      const data = await adminAPI.getABTests(activeFilter === 'all' ? null : activeFilter);
      setTests(data || []);
    } catch (error) {
      console.error('Failed to load tests:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTests();
  }, [loadTests]);

  const updateTestStatus = async (testId, newStatus) => {
    try {
      await adminAPI.updateABTestStatus(testId, newStatus);
      loadTests();
    } catch (error) {
      Alert.alert('Error', 'Failed to update test status');
    }
  };

  const deleteTest = async (testId) => {
    Alert.alert('Delete Test', 'Are you sure you want to delete this test?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await adminAPI.deleteABTest(testId);
            loadTests();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete test');
          }
        },
      },
    ]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10B981';
      case 'paused': return '#F59E0B';
      case 'completed': return '#3B82F6';
      default: return '#64748B';
    }
  };

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'draft', label: 'Draft' },
    { id: 'completed', label: 'Completed' },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading A/B Tests...</Text>
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
        <Text style={styles.headerTitle}>A/B Testing</Text>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.createButtonText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[styles.filterChip, activeFilter === filter.id && styles.filterChipActive]}
            onPress={() => setActiveFilter(filter.id)}
          >
            <Text style={[styles.filterLabel, activeFilter === filter.id && styles.filterLabelActive]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {tests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🧪</Text>
            <Text style={styles.emptyTitle}>No A/B Tests</Text>
            <Text style={styles.emptyDesc}>Create your first experiment to optimize conversions</Text>
          </View>
        ) : (
          tests.map((test) => (
            <View key={test.test_id} style={styles.testCard}>
              <View style={styles.testHeader}>
                <View>
                  <Text style={styles.testName}>{test.name}</Text>
                  <View style={styles.testMeta}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(test.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(test.status) }]}>
                        {test.status}
                      </Text>
                    </View>
                    <Text style={styles.testType}>
                      {TEST_TYPES.find(t => t.id === test.test_type)?.icon} {test.test_type}
                    </Text>
                  </View>
                </View>
              </View>

              {test.description && (
                <Text style={styles.testDesc}>{test.description}</Text>
              )}

              {/* Variants */}
              <View style={styles.variantsContainer}>
                <Text style={styles.variantsTitle}>Variants</Text>
                {test.variants?.map((variant, index) => (
                  <View key={variant.variant_id || index} style={styles.variantRow}>
                    <View style={styles.variantInfo}>
                      <Text style={styles.variantName}>{variant.name}</Text>
                      <Text style={styles.variantPercent}>{variant.percentage}%</Text>
                    </View>
                    <View style={styles.variantStats}>
                      <Text style={styles.variantStat}>
                        👁️ {variant.impressions || 0}
                      </Text>
                      <Text style={styles.variantStat}>
                        ✅ {variant.conversions || 0}
                      </Text>
                      <Text style={styles.variantRate}>
                        {variant.impressions > 0 
                          ? ((variant.conversions / variant.impressions) * 100).toFixed(1) 
                          : 0}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.testActions}>
                {test.status === 'draft' && (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.actionActivate]}
                    onPress={() => updateTestStatus(test.test_id, 'active')}
                  >
                    <Text style={styles.actionButtonText}>▶️ Activate</Text>
                  </TouchableOpacity>
                )}
                {test.status === 'active' && (
                  <>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.actionPause]}
                      onPress={() => updateTestStatus(test.test_id, 'paused')}
                    >
                      <Text style={styles.actionButtonText}>⏸️ Pause</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionButton, styles.actionComplete]}
                      onPress={() => updateTestStatus(test.test_id, 'completed')}
                    >
                      <Text style={styles.actionButtonText}>✅ Complete</Text>
                    </TouchableOpacity>
                  </>
                )}
                {test.status === 'paused' && (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.actionActivate]}
                    onPress={() => updateTestStatus(test.test_id, 'active')}
                  >
                    <Text style={styles.actionButtonText}>▶️ Resume</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  style={[styles.actionButton, styles.actionDelete]}
                  onPress={() => deleteTest(test.test_id)}
                >
                  <Text style={styles.actionButtonText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Modal */}
      <CreateTestModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false);
          loadTests();
        }}
      />
    </SafeAreaView>
  );
}

// Create Test Modal
function CreateTestModal({ visible, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [testType, setTestType] = useState('ui_element');
  const [variants, setVariants] = useState([
    { name: 'Control', percentage: 50 },
    { name: 'Variant A', percentage: 50 },
  ]);
  const [creating, setCreating] = useState(false);

  const addVariant = () => {
    if (variants.length >= 4) return;
    const newPercentage = Math.floor(100 / (variants.length + 1));
    const newVariants = variants.map(v => ({ ...v, percentage: newPercentage }));
    newVariants.push({ name: `Variant ${String.fromCharCode(65 + variants.length - 1)}`, percentage: newPercentage });
    setVariants(newVariants);
  };

  const updateVariantPercentage = (index, value) => {
    const newVariants = [...variants];
    newVariants[index].percentage = parseInt(value) || 0;
    setVariants(newVariants);
  };

  const totalPercentage = variants.reduce((sum, v) => sum + v.percentage, 0);

  const createTest = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a test name');
      return;
    }
    if (Math.abs(totalPercentage - 100) > 0.5) {
      Alert.alert('Error', 'Variant percentages must sum to 100%');
      return;
    }

    setCreating(true);
    try {
      await adminAPI.createABTest({
        name: name.trim(),
        description: description.trim() || null,
        test_type: testType,
        variants: variants.map(v => ({
          name: v.name,
          percentage: v.percentage,
          config: {},
        })),
      });
      onCreated();
      // Reset form
      setName('');
      setDescription('');
      setVariants([
        { name: 'Control', percentage: 50 },
        { name: 'Variant A', percentage: 50 },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to create test');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create A/B Test</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Test Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Button Color Test"
                placeholderTextColor="#64748B"
              />
            </View>

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="What are you testing?"
                placeholderTextColor="#64748B"
                multiline
              />
            </View>

            {/* Test Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Test Type</Text>
              <View style={styles.typeGrid}>
                {TEST_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.typeOption, testType === type.id && styles.typeOptionActive]}
                    onPress={() => setTestType(type.id)}
                  >
                    <Text style={styles.typeIcon}>{type.icon}</Text>
                    <Text style={styles.typeLabel}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Variants */}
            <View style={styles.inputGroup}>
              <View style={styles.variantsHeader}>
                <Text style={styles.inputLabel}>Variants</Text>
                <Text style={[
                  styles.percentageTotal, 
                  Math.abs(totalPercentage - 100) < 0.5 ? styles.percentageValid : styles.percentageInvalid
                ]}>
                  {totalPercentage}%
                </Text>
              </View>
              
              {variants.map((variant, index) => (
                <View key={index} style={styles.variantInput}>
                  <TextInput
                    style={[styles.input, styles.variantNameInput]}
                    value={variant.name}
                    onChangeText={(text) => {
                      const newVariants = [...variants];
                      newVariants[index].name = text;
                      setVariants(newVariants);
                    }}
                    placeholder="Variant name"
                    placeholderTextColor="#64748B"
                  />
                  <TextInput
                    style={[styles.input, styles.variantPercentInput]}
                    value={String(variant.percentage)}
                    onChangeText={(text) => updateVariantPercentage(index, text)}
                    keyboardType="numeric"
                    placeholder="%"
                    placeholderTextColor="#64748B"
                  />
                  <Text style={styles.percentSign}>%</Text>
                </View>
              ))}

              {variants.length < 4 && (
                <TouchableOpacity style={styles.addVariantButton} onPress={addVariant}>
                  <Text style={styles.addVariantText}>+ Add Variant</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.createTestButton, creating && styles.buttonDisabled]} 
              onPress={createTest}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.createTestButtonText}>Create Test</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  createButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#3B82F6',
  },
  filterLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  filterLabelActive: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
  testCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  testHeader: {
    marginBottom: 12,
  },
  testName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  testMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  testType: {
    color: '#94A3B8',
    fontSize: 12,
  },
  testDesc: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 16,
  },
  variantsContainer: {
    marginBottom: 16,
  },
  variantsTitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  variantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  variantName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  variantPercent: {
    color: '#3B82F6',
    fontSize: 12,
  },
  variantStats: {
    flexDirection: 'row',
    gap: 12,
  },
  variantStat: {
    color: '#94A3B8',
    fontSize: 12,
  },
  variantRate: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  testActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  actionActivate: {
    backgroundColor: '#10B98120',
  },
  actionPause: {
    backgroundColor: '#F59E0B20',
  },
  actionComplete: {
    backgroundColor: '#3B82F620',
  },
  actionDelete: {
    backgroundColor: '#EF444420',
    marginLeft: 'auto',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  modalClose: {
    color: '#94A3B8',
    fontSize: 24,
  },
  modalBody: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  typeOption: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  typeOptionActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#3B82F610',
  },
  typeIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  typeLabel: {
    color: '#fff',
    fontSize: 12,
  },
  variantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  percentageTotal: {
    fontSize: 14,
    fontWeight: '600',
  },
  percentageValid: {
    color: '#10B981',
  },
  percentageInvalid: {
    color: '#EF4444',
  },
  variantInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  variantNameInput: {
    flex: 1,
  },
  variantPercentInput: {
    width: 60,
    textAlign: 'center',
  },
  percentSign: {
    color: '#94A3B8',
  },
  addVariantButton: {
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  addVariantText: {
    color: '#3B82F6',
    fontSize: 14,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createTestButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  createTestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
