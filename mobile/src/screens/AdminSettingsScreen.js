/**
 * Admin Settings Screen for Mobile
 * Comprehensive platform configuration like Facebook/eBay admin
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { adminAPI } from '../services/api';

const SETTINGS_CATEGORIES = [
  {
    id: 'registration',
    title: 'Registration & Auth',
    icon: '🔐',
    color: '#3B82F6',
    fields: [
      { key: 'registration_enabled', label: 'Allow New Registrations', type: 'toggle' },
      { key: 'email_verification_required', label: 'Email Verification Required', type: 'toggle' },
      { key: 'google_auth_enabled', label: 'Google Sign-In', type: 'toggle' },
      { key: 'min_password_length', label: 'Min Password Length', type: 'number' },
      { key: 'max_login_attempts', label: 'Max Login Attempts', type: 'number' },
    ],
  },
  {
    id: 'features',
    title: 'Platform Features',
    icon: '⚡',
    color: '#10B981',
    fields: [
      { key: 'social_feed_enabled', label: 'Social Feed', type: 'toggle' },
      { key: 'messaging_enabled', label: 'Private Messaging', type: 'toggle' },
      { key: 'marketplace_enabled', label: 'Marketplace', type: 'toggle' },
      { key: 'casino_enabled', label: 'Casino Games', type: 'toggle' },
      { key: 'daily_spin_enabled', label: 'Daily Spin Bonus', type: 'toggle' },
      { key: 'groups_enabled', label: 'Groups', type: 'toggle' },
      { key: 'ai_generation_enabled', label: 'AI Generation', type: 'toggle' },
      { key: 'referral_system_enabled', label: 'Referral System', type: 'toggle' },
    ],
  },
  {
    id: 'rewards',
    title: 'Rewards & BL Coins',
    icon: '🪙',
    color: '#F59E0B',
    fields: [
      { key: 'welcome_bonus', label: 'Welcome Bonus (BL)', type: 'number' },
      { key: 'referral_bonus', label: 'Referral Bonus (BL)', type: 'number' },
      { key: 'daily_login_bonus', label: 'Daily Login Bonus (BL)', type: 'number' },
      { key: 'post_video_reward', label: 'Video Post Reward (BL)', type: 'number' },
      { key: 'post_photo_reward', label: 'Photo Post Reward (BL)', type: 'number' },
    ],
  },
  {
    id: 'referral',
    title: 'Referral & Commissions',
    icon: '🔗',
    color: '#EC4899',
    fields: [
      { key: 'level1_commission_rate', label: 'Level 1 Commission (%)', type: 'number' },
      { key: 'level2_commission_rate', label: 'Level 2 Commission (%)', type: 'number' },
      { key: 'min_withdrawal_amount', label: 'Min Withdrawal (BL)', type: 'number' },
      { key: 'withdrawal_fee_percent', label: 'Withdrawal Fee (%)', type: 'number' },
      { key: 'referral_transfer_enabled', label: 'Referral Transfer', type: 'toggle' },
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace',
    icon: '🛒',
    color: '#06B6D4',
    fields: [
      { key: 'marketplace_fee_percent', label: 'Platform Fee (%)', type: 'number' },
      { key: 'max_listing_price', label: 'Max Listing Price ($)', type: 'number' },
      { key: 'max_listings_per_user', label: 'Max Listings Per User', type: 'number' },
      { key: 'stripe_enabled', label: 'Stripe Payments', type: 'toggle' },
      { key: 'escrow_enabled', label: 'Escrow Protection', type: 'toggle' },
    ],
  },
  {
    id: 'casino',
    title: 'Casino Settings',
    icon: '🎰',
    color: '#EF4444',
    fields: [
      { key: 'casino_min_bet', label: 'Minimum Bet (BL)', type: 'number' },
      { key: 'casino_max_bet', label: 'Maximum Bet (BL)', type: 'number' },
      { key: 'slots_enabled', label: 'Slots Game', type: 'toggle' },
      { key: 'blackjack_enabled', label: 'Blackjack', type: 'toggle' },
      { key: 'roulette_enabled', label: 'Roulette', type: 'toggle' },
      { key: 'house_edge_percent', label: 'House Edge (%)', type: 'number' },
    ],
  },
  {
    id: 'moderation',
    title: 'Moderation & Safety',
    icon: '🛡️',
    color: '#F97316',
    fields: [
      { key: 'report_threshold_for_review', label: 'Report Threshold', type: 'number' },
      { key: 'auto_ban_threshold', label: 'Auto-Ban Threshold', type: 'number' },
      { key: 'adult_content_allowed', label: 'Adult Content', type: 'toggle' },
      { key: 'profanity_filter_enabled', label: 'Profanity Filter', type: 'toggle' },
      { key: 'spam_detection_enabled', label: 'Spam Detection', type: 'toggle' },
    ],
  },
  {
    id: 'maintenance',
    title: 'Maintenance',
    icon: '🔧',
    color: '#64748B',
    fields: [
      { key: 'maintenance_mode', label: 'Maintenance Mode', type: 'toggle' },
      { key: 'read_only_mode', label: 'Read-Only Mode', type: 'toggle' },
      { key: 'rate_limit_requests', label: 'Rate Limit (req/min)', type: 'number' },
      { key: 'debug_mode', label: 'Debug Mode', type: 'toggle' },
    ],
  },
];

const DEFAULT_SETTINGS = {
  registration_enabled: true,
  email_verification_required: false,
  google_auth_enabled: true,
  min_password_length: 8,
  max_login_attempts: 5,
  social_feed_enabled: true,
  messaging_enabled: true,
  marketplace_enabled: true,
  casino_enabled: true,
  daily_spin_enabled: true,
  groups_enabled: true,
  ai_generation_enabled: true,
  referral_system_enabled: true,
  welcome_bonus: 100,
  referral_bonus: 100,
  daily_login_bonus: 10,
  post_video_reward: 50,
  post_photo_reward: 20,
  level1_commission_rate: 10,
  level2_commission_rate: 5,
  min_withdrawal_amount: 1000,
  withdrawal_fee_percent: 2,
  referral_transfer_enabled: true,
  marketplace_fee_percent: 5,
  max_listing_price: 100000,
  max_listings_per_user: 100,
  stripe_enabled: true,
  escrow_enabled: true,
  casino_min_bet: 10,
  casino_max_bet: 10000,
  slots_enabled: true,
  blackjack_enabled: true,
  roulette_enabled: true,
  house_edge_percent: 5,
  report_threshold_for_review: 3,
  auto_ban_threshold: 5,
  adult_content_allowed: false,
  profanity_filter_enabled: true,
  spam_detection_enabled: true,
  maintenance_mode: false,
  read_only_mode: false,
  rate_limit_requests: 100,
  debug_mode: false,
};

export default function AdminSettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState('registration');

  const loadSettings = useCallback(async () => {
    try {
      const data = await adminAPI.getSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSettings();
  }, [loadSettings]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await adminAPI.updateSettings(settings);
      setHasChanges(false);
      Alert.alert('Success', 'Settings saved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to defaults?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setSettings(DEFAULT_SETTINGS);
            setHasChanges(true);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading Settings...</Text>
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
        <Text style={styles.headerTitle}>Platform Settings</Text>
        <TouchableOpacity 
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          onPress={saveSettings}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{hasChanges ? 'Save' : 'Saved'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>⚠️ You have unsaved changes</Text>
        </View>
      )}

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />
        }
      >
        {/* Categories */}
        {SETTINGS_CATEGORIES.map((category) => (
          <View key={category.id} style={styles.categoryCard}>
            <TouchableOpacity
              style={[styles.categoryHeader, { borderLeftColor: category.color }]}
              onPress={() => setExpandedCategory(
                expandedCategory === category.id ? null : category.id
              )}
            >
              <View style={styles.categoryTitleRow}>
                <Text style={styles.categoryIcon}>{category.icon}</Text>
                <Text style={styles.categoryTitle}>{category.title}</Text>
              </View>
              <Text style={styles.expandIcon}>
                {expandedCategory === category.id ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {expandedCategory === category.id && (
              <View style={styles.categoryContent}>
                {category.fields.map((field) => (
                  <View key={field.key} style={styles.settingRow}>
                    <Text style={styles.settingLabel}>{field.label}</Text>
                    {field.type === 'toggle' ? (
                      <Switch
                        value={settings[field.key] === true}
                        onValueChange={(value) => updateSetting(field.key, value)}
                        trackColor={{ false: '#334155', true: '#3B82F6' }}
                        thumbColor="#fff"
                      />
                    ) : (
                      <TextInput
                        style={styles.numberInput}
                        value={String(settings[field.key] || '')}
                        onChangeText={(text) => updateSetting(field.key, parseFloat(text) || 0)}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#64748B"
                      />
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.quickActionsTitle}>Quick Actions</Text>
          <View style={styles.quickActionButtons}>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.quickActionRed]}
              onPress={() => {
                updateSetting('maintenance_mode', true);
                Alert.alert('Maintenance Mode', 'Enabled. Save to apply.');
              }}
            >
              <Text style={styles.quickActionText}>🔒 Maintenance</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.quickActionAmber]}
              onPress={() => {
                updateSetting('registration_enabled', false);
                Alert.alert('Registration', 'Disabled. Save to apply.');
              }}
            >
              <Text style={styles.quickActionText}>🚫 Disable Signups</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.quickActionGreen]}
              onPress={() => {
                setSettings(prev => ({
                  ...prev,
                  maintenance_mode: false,
                  registration_enabled: true,
                  casino_enabled: true,
                  marketplace_enabled: true,
                }));
                setHasChanges(true);
              }}
            >
              <Text style={styles.quickActionText}>✅ Enable All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.quickActionSlate]}
              onPress={resetToDefaults}
            >
              <Text style={styles.quickActionText}>🔄 Reset</Text>
            </TouchableOpacity>
          </View>
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
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#334155',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  warningBanner: {
    backgroundColor: '#F59E0B20',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B30',
  },
  warningText: {
    color: '#F59E0B',
    textAlign: 'center',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  categoryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderLeftWidth: 4,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryIcon: {
    fontSize: 20,
  },
  categoryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  expandIcon: {
    color: '#94A3B8',
    fontSize: 12,
  },
  categoryContent: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#33415530',
  },
  settingLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    flex: 1,
  },
  numberInput: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 14,
    textAlign: 'right',
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickActions: {
    marginTop: 8,
    marginBottom: 32,
  },
  quickActionsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickActionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  quickActionRed: {
    backgroundColor: '#EF444420',
    borderWidth: 1,
    borderColor: '#EF444440',
  },
  quickActionAmber: {
    backgroundColor: '#F59E0B20',
    borderWidth: 1,
    borderColor: '#F59E0B40',
  },
  quickActionGreen: {
    backgroundColor: '#10B98120',
    borderWidth: 1,
    borderColor: '#10B98140',
  },
  quickActionSlate: {
    backgroundColor: '#64748B20',
    borderWidth: 1,
    borderColor: '#64748B40',
  },
  quickActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
});
