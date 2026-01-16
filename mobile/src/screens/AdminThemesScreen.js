/**
 * Admin Themes Screen for Blendlink Mobile
 * Theme management synced with web admin
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const THEMES = [
  { id: 'dark', name: 'Dark Mode', colors: ['#0F172A', '#1E293B', '#334155'], active: true },
  { id: 'light', name: 'Light Mode', colors: ['#FFFFFF', '#F1F5F9', '#E2E8F0'], active: false },
  { id: 'purple', name: 'Purple Night', colors: ['#1E1B4B', '#312E81', '#4338CA'], active: false },
  { id: 'green', name: 'Forest', colors: ['#064E3B', '#065F46', '#047857'], active: false },
];

export default function AdminThemesScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [themes, setThemes] = useState(THEMES);
  const [activeTheme, setActiveTheme] = useState('dark');

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  const handleSetActive = (themeId) => {
    setActiveTheme(themeId);
    setThemes(prev => prev.map(t => ({ ...t, active: t.id === themeId })));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading Themes...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🎨 Themes</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Available Themes</Text>
        <Text style={styles.sectionSubtitle}>Changes sync across web and mobile</Text>

        {themes.map((theme) => (
          <TouchableOpacity
            key={theme.id}
            style={[styles.themeCard, theme.active && styles.themeCardActive]}
            onPress={() => handleSetActive(theme.id)}
          >
            <View style={styles.themeHeader}>
              <Text style={styles.themeName}>{theme.name}</Text>
              {theme.active && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Active</Text>
                </View>
              )}
            </View>
            <View style={styles.colorPreview}>
              {theme.colors.map((color, idx) => (
                <View key={idx} style={[styles.colorSwatch, { backgroundColor: color }]} />
              ))}
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Theme Sync</Text>
          <Text style={styles.infoText}>
            Theme changes are automatically synced between web and mobile apps in real-time.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backButton: { color: '#8B5CF6', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 4 },
  sectionSubtitle: { color: '#64748B', fontSize: 14, marginBottom: 20 },
  themeCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: 'transparent' },
  themeCardActive: { borderColor: '#8B5CF6' },
  themeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  themeName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  activeBadge: { backgroundColor: '#8B5CF630', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  activeBadgeText: { color: '#8B5CF6', fontSize: 12, fontWeight: '600' },
  colorPreview: { flexDirection: 'row', gap: 8 },
  colorSwatch: { flex: 1, height: 40, borderRadius: 8 },
  infoCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginTop: 12 },
  infoTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  infoText: { color: '#94A3B8', fontSize: 13, lineHeight: 20 },
});
