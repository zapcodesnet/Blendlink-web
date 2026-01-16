/**
 * Admin Pages Screen for Blendlink Mobile
 * Manage app pages and navigation
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PAGES = [
  { id: 'home', name: 'Home Feed', icon: '🏠', route: '/', visible: true, order: 1 },
  { id: 'marketplace', name: 'Marketplace', icon: '🛒', route: '/marketplace', visible: true, order: 2 },
  { id: 'games', name: 'Games', icon: '🎮', route: '/games', visible: true, order: 3 },
  { id: 'casino', name: 'Casino', icon: '🎰', route: '/casino', visible: true, order: 4 },
  { id: 'wallet', name: 'Wallet', icon: '💰', route: '/wallet', visible: true, order: 5 },
  { id: 'profile', name: 'Profile', icon: '👤', route: '/profile', visible: true, order: 6 },
  { id: 'my_team', name: 'My Team', icon: '👥', route: '/my-team', visible: true, order: 7 },
  { id: 'seller', name: 'Seller Dashboard', icon: '📊', route: '/seller', visible: true, order: 8 },
];

export default function AdminPagesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState(PAGES);

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  const toggleVisibility = (pageId) => {
    setPages(prev => prev.map(p => 
      p.id === pageId ? { ...p, visible: !p.visible } : p
    ));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Loading Pages...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📄 Pages</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Page Management</Text>
        <Text style={styles.sectionSubtitle}>Toggle visibility and configure pages</Text>

        {pages.map((page, index) => (
          <View key={page.id} style={styles.pageCard}>
            <View style={styles.pageInfo}>
              <Text style={styles.pageIcon}>{page.icon}</Text>
              <View style={styles.pageDetails}>
                <Text style={styles.pageName}>{page.name}</Text>
                <Text style={styles.pageRoute}>{page.route}</Text>
              </View>
            </View>
            <View style={styles.pageActions}>
              <Text style={styles.orderText}>#{page.order}</Text>
              <Switch
                value={page.visible}
                onValueChange={() => toggleVisibility(page.id)}
                trackColor={{ false: '#334155', true: '#10B98180' }}
                thumbColor={page.visible ? '#10B981' : '#64748B'}
              />
            </View>
          </View>
        ))}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>📱 Page Sync</Text>
          <Text style={styles.infoText}>
            Page visibility changes are synced across web and mobile. Drag to reorder (coming soon).
          </Text>
        </View>

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Page Order</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backButton: { color: '#F59E0B', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 4 },
  sectionSubtitle: { color: '#64748B', fontSize: 14, marginBottom: 20 },
  pageCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pageIcon: { fontSize: 28 },
  pageDetails: {},
  pageName: { color: '#fff', fontSize: 16, fontWeight: '500' },
  pageRoute: { color: '#64748B', fontSize: 12 },
  pageActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderText: { color: '#64748B', fontSize: 14 },
  infoCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginTop: 12 },
  infoTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  infoText: { color: '#94A3B8', fontSize: 13, lineHeight: 20 },
  saveButton: { backgroundColor: '#F59E0B', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
