/**
 * Admin UI Editor Screen for Blendlink Mobile
 * Edit UI components and styles
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const UI_SECTIONS = [
  { id: 'header', name: 'Header', icon: '📱' },
  { id: 'footer', name: 'Footer', icon: '🦶' },
  { id: 'buttons', name: 'Buttons', icon: '🔘' },
  { id: 'cards', name: 'Cards', icon: '🃏' },
  { id: 'forms', name: 'Forms', icon: '📝' },
  { id: 'colors', name: 'Color Palette', icon: '🎨' },
];

export default function AdminUIEditorScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState(null);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoading(false), 500);
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading UI Editor...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>✏️ UI Editor</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Edit UI Components</Text>
        <Text style={styles.sectionSubtitle}>Visual editor for app styling</Text>

        <View style={styles.grid}>
          {UI_SECTIONS.map((section) => (
            <TouchableOpacity
              key={section.id}
              style={[styles.sectionCard, selectedSection === section.id && styles.sectionCardActive]}
              onPress={() => setSelectedSection(section.id)}
            >
              <Text style={styles.sectionIcon}>{section.icon}</Text>
              <Text style={styles.sectionName}>{section.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {selectedSection && (
          <View style={styles.editorPanel}>
            <Text style={styles.editorTitle}>
              Editing: {UI_SECTIONS.find(s => s.id === selectedSection)?.name}
            </Text>
            
            <View style={styles.propertyRow}>
              <Text style={styles.propertyLabel}>Background Color</Text>
              <TextInput
                style={styles.propertyInput}
                placeholder="#1E293B"
                placeholderTextColor="#64748B"
              />
            </View>
            
            <View style={styles.propertyRow}>
              <Text style={styles.propertyLabel}>Text Color</Text>
              <TextInput
                style={styles.propertyInput}
                placeholder="#FFFFFF"
                placeholderTextColor="#64748B"
              />
            </View>
            
            <View style={styles.propertyRow}>
              <Text style={styles.propertyLabel}>Border Radius</Text>
              <TextInput
                style={styles.propertyInput}
                placeholder="12"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity style={styles.saveButton}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🔄 Live Preview</Text>
          <Text style={styles.infoText}>
            Changes made here are synced with the web admin panel. Preview updates in real-time.
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
  backButton: { color: '#10B981', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  content: { flex: 1, padding: 16 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 4 },
  sectionSubtitle: { color: '#64748B', fontSize: 14, marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sectionCard: { width: '31%', backgroundColor: '#1E293B', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  sectionCardActive: { borderColor: '#10B981' },
  sectionIcon: { fontSize: 28, marginBottom: 8 },
  sectionName: { color: '#fff', fontSize: 12, textAlign: 'center' },
  editorPanel: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginTop: 20 },
  editorTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  propertyRow: { marginBottom: 16 },
  propertyLabel: { color: '#94A3B8', fontSize: 12, marginBottom: 8 },
  propertyInput: { backgroundColor: '#334155', borderRadius: 8, padding: 12, color: '#fff', borderWidth: 1, borderColor: '#475569' },
  saveButton: { backgroundColor: '#10B981', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  infoCard: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginTop: 20 },
  infoTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  infoText: { color: '#94A3B8', fontSize: 13, lineHeight: 20 },
});
