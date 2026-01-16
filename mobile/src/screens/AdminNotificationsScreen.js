/**
 * Admin Notifications Screen for Blendlink Mobile
 * Notification settings and management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminNotificationsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    push_enabled: true,
    email_enabled: true,
    new_user_alerts: true,
    withdrawal_alerts: true,
    security_alerts: true,
    system_alerts: true,
  });

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 500);
  }, []);

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🔔 Notifications</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Methods</Text>
          <View style={styles.settingCard}>
            <SettingRow
              label="Push Notifications"
              value={settings.push_enabled}
              onToggle={() => toggleSetting('push_enabled')}
            />
            <SettingRow
              label="Email Notifications"
              value={settings.email_enabled}
              onToggle={() => toggleSetting('email_enabled')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert Types</Text>
          <View style={styles.settingCard}>
            <SettingRow
              label="New User Registrations"
              value={settings.new_user_alerts}
              onToggle={() => toggleSetting('new_user_alerts')}
            />
            <SettingRow
              label="Withdrawal Requests"
              value={settings.withdrawal_alerts}
              onToggle={() => toggleSetting('withdrawal_alerts')}
            />
            <SettingRow
              label="Security Alerts"
              value={settings.security_alerts}
              onToggle={() => toggleSetting('security_alerts')}
            />
            <SettingRow
              label="System Alerts"
              value={settings.system_alerts}
              onToggle={() => toggleSetting('system_alerts')}
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const SettingRow = ({ label, value, onToggle }) => (
  <View style={styles.settingRow}>
    <Text style={styles.settingLabel}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: '#334155', true: '#3B82F680' }}
      thumbColor={value ? '#3B82F6' : '#64748B'}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backButton: { color: '#3B82F6', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 12 },
  settingCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 4 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#334155' },
  settingLabel: { color: '#fff', fontSize: 14 },
  saveButton: { backgroundColor: '#3B82F6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
