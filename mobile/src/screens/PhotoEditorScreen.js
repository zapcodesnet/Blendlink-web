/**
 * Photo Editor Screen for Blendlink Mobile
 * AI-powered photo editing for product listings
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Slider from '@react-native-community/slider';
import api from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Background presets matching web
const BACKGROUND_PRESETS = {
  solid: [
    { id: 'solid_white', name: 'White', color: '#FFFFFF' },
    { id: 'solid_black', name: 'Black', color: '#000000' },
    { id: 'solid_gray', name: 'Gray', color: '#F5F5F5' },
    { id: 'solid_cream', name: 'Cream', color: '#FFFDD0' },
    { id: 'solid_blue', name: 'Blue', color: '#87CEEB' },
    { id: 'solid_pink', name: 'Pink', color: '#FFB6C1' },
    { id: 'solid_mint', name: 'Mint', color: '#98FF98' },
    { id: 'solid_lavender', name: 'Lavender', color: '#E6E6FA' },
  ],
  gradient: [
    { id: 'gradient_sunset', name: 'Sunset', colors: ['#FF6B6B', '#FFA07A'] },
    { id: 'gradient_ocean', name: 'Ocean', colors: ['#667eea', '#764ba2'] },
    { id: 'gradient_forest', name: 'Forest', colors: ['#11998e', '#38ef7d'] },
    { id: 'gradient_purple', name: 'Purple', colors: ['#DA22FF', '#9733EE'] },
    { id: 'gradient_peach', name: 'Peach', colors: ['#FFECD2', '#FCB69F'] },
  ],
};

// Tab Button Component
const TabButton = ({ label, icon, active, onPress }) => (
  <TouchableOpacity
    style={[styles.tabButton, active && styles.tabButtonActive]}
    onPress={onPress}
  >
    <Text style={styles.tabIcon}>{icon}</Text>
    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

// Photo Thumbnail Component
const PhotoThumbnail = ({ photo, isSelected, onSelect, onDelete }) => (
  <TouchableOpacity
    style={[styles.thumbnail, isSelected && styles.thumbnailSelected]}
    onPress={onSelect}
    onLongPress={() => {
      Alert.alert('Delete Photo', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]);
    }}
  >
    <Image source={{ uri: photo.thumbnail_url || photo.current_url }} style={styles.thumbnailImage} />
    {photo.has_background_removed && (
      <View style={styles.bgRemovedBadge}>
        <Text style={styles.bgRemovedText}>✓</Text>
      </View>
    )}
  </TouchableOpacity>
);

// Color Swatch Component
const ColorSwatch = ({ color, isSelected, onPress }) => (
  <TouchableOpacity
    style={[
      styles.colorSwatch,
      { backgroundColor: color },
      isSelected && styles.colorSwatchSelected,
    ]}
    onPress={onPress}
  />
);

// Gradient Swatch Component
const GradientSwatch = ({ colors, isSelected, onPress, name }) => (
  <TouchableOpacity
    style={[styles.gradientSwatch, isSelected && styles.gradientSwatchSelected]}
    onPress={onPress}
  >
    <View
      style={[
        styles.gradientInner,
        { backgroundColor: colors[0] }, // Simplified gradient representation
      ]}
    >
      <View style={[styles.gradientOverlay, { backgroundColor: colors[1], opacity: 0.5 }]} />
    </View>
  </TouchableOpacity>
);

export default function PhotoEditorScreen({ navigation }) {
  // State
  const [photos, setPhotos] = useState([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('edit');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Adjustments
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const [sharpness, setSharpness] = useState(1.0);

  // Background
  const [selectedBackground, setSelectedBackground] = useState(null);

  // AI Listing
  const [aiListingResult, setAiListingResult] = useState(null);

  const selectedPhoto = photos[selectedPhotoIndex];

  // Load photos on mount
  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      const response = await api.get('/photo-editor/photos?limit=10');
      setPhotos(response.data.photos || []);
    } catch (error) {
      console.error('Failed to load photos:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Pick images from gallery
  const handlePickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets) {
        if (photos.length + result.assets.length > 10) {
          Alert.alert('Limit Reached', 'Maximum 10 photos allowed');
          return;
        }

        setIsProcessing(true);
        setProcessingMessage('Uploading photos...');

        const base64Images = result.assets.map(
          (asset) => `data:image/jpeg;base64,${asset.base64}`
        );

        const response = await api.post('/photo-editor/upload', {
          photos: base64Images,
        });

        Alert.alert('Success', `Uploaded ${response.data.length} photo(s)`);
        await loadPhotos();
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to upload photos');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Remove background (single)
  const handleRemoveBackground = async () => {
    if (!selectedPhoto) return;

    setIsProcessing(true);
    setProcessingMessage('Removing background with AI...');

    try {
      const response = await api.post('/photo-editor/remove-background', {
        photo_id: selectedPhoto.photo_id,
      });

      Alert.alert('Success', `Background removed in ${response.data.processing_time_ms}ms`);
      await loadPhotos();
      setActiveTab('background');
    } catch (error) {
      Alert.alert('Error', error.message || 'Background removal failed');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Batch remove backgrounds - with real-time progress
  const handleBatchRemoveBackgrounds = async () => {
    const photosToProcess = photos.filter((p) => !p.has_background_removed);

    if (photosToProcess.length === 0) {
      Alert.alert('Info', 'All photos already have backgrounds removed');
      return;
    }

    setIsProcessing(true);
    setBatchProgress({ current: 0, total: photosToProcess.length });
    
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    // Process photos one-by-one for real-time progress
    for (let i = 0; i < photosToProcess.length; i++) {
      const photo = photosToProcess[i];
      const photoNum = i + 1;
      
      setBatchProgress({ current: i, total: photosToProcess.length });
      setProcessingMessage(`Removing background ${photoNum} of ${photosToProcess.length}...`);

      try {
        await api.post('/photo-editor/remove-background', {
          photo_id: photo.photo_id,
        });
        successCount++;
        setBatchProgress({ current: photoNum, total: photosToProcess.length });
      } catch (error) {
        console.error(`Failed to remove background for photo ${photo.photo_id}:`, error);
        failCount++;
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    Alert.alert(
      'Batch Complete',
      `${successCount} succeeded, ${failCount} failed\nTotal time: ${totalTime}s`
    );
    await loadPhotos();
    setActiveTab('background');
    setIsProcessing(false);
    setBatchProgress({ current: 0, total: 0 });
    setProcessingMessage('');
  };

  // AI Auto-Enhance (single photo)
  const handleAutoEnhance = async () => {
    if (!selectedPhoto) return;

    setIsProcessing(true);
    setProcessingMessage('AI analyzing and enhancing...');

    try {
      const response = await api.post('/photo-editor/auto-enhance', {
        photo_id: selectedPhoto.photo_id,
      });

      // Update sliders to show applied values
      setBrightness(response.data.adjustments_applied.brightness);
      setContrast(response.data.adjustments_applied.contrast);
      setSaturation(response.data.adjustments_applied.saturation);
      setSharpness(response.data.adjustments_applied.sharpness);

      Alert.alert('Success', `Auto-enhanced in ${response.data.processing_time_ms}ms`);
      await loadPhotos();
    } catch (error) {
      Alert.alert('Error', error.message || 'Auto-enhance failed');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Batch AI Auto-Enhance - with real-time progress
  const handleBatchAutoEnhance = async () => {
    const photosToEnhance = photos.filter((p) => !p.auto_enhanced);

    if (photosToEnhance.length === 0) {
      Alert.alert('Info', 'All photos already enhanced');
      return;
    }

    setIsProcessing(true);
    setBatchProgress({ current: 0, total: photosToEnhance.length });
    
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;

    // Process photos one-by-one for real-time progress
    for (let i = 0; i < photosToEnhance.length; i++) {
      const photo = photosToEnhance[i];
      const photoNum = i + 1;
      
      setBatchProgress({ current: i, total: photosToEnhance.length });
      setProcessingMessage(`Enhancing photo ${photoNum} of ${photosToEnhance.length}...`);

      try {
        await api.post('/photo-editor/auto-enhance', {
          photo_id: photo.photo_id,
        });
        successCount++;
        setBatchProgress({ current: photoNum, total: photosToEnhance.length });
      } catch (error) {
        console.error(`Failed to enhance photo ${photo.photo_id}:`, error);
        failCount++;
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

    Alert.alert(
      'Auto-Enhance Complete',
      `${successCount} enhanced, ${failCount} failed\nTotal time: ${totalTime}s`
    );
    await loadPhotos();
    setIsProcessing(false);
    setBatchProgress({ current: 0, total: 0 });
    setProcessingMessage('');
  };

  // Apply adjustments
  const handleApplyAdjustments = async () => {
    if (!selectedPhoto) return;

    setIsProcessing(true);
    setProcessingMessage('Applying adjustments...');

    try {
      await api.post('/photo-editor/adjust', {
        photo_id: selectedPhoto.photo_id,
        brightness,
        contrast,
        saturation,
        sharpness,
      });

      Alert.alert('Success', 'Adjustments applied');
      await loadPhotos();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to apply adjustments');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Apply background
  const handleApplyBackground = async (type, value) => {
    if (!selectedPhoto || !selectedPhoto.has_background_removed) {
      Alert.alert('Info', 'Remove background first');
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Applying background...');

    try {
      await api.post('/photo-editor/apply-background', {
        photo_id: selectedPhoto.photo_id,
        background_type: type,
        background_value: value,
        background_scale: 1.0,
        background_offset_x: 0,
        background_offset_y: 0,
      });

      setSelectedBackground({ type, value });
      Alert.alert('Success', 'Background applied');
      await loadPhotos();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to apply background');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Reset photo
  const handleReset = async () => {
    if (!selectedPhoto) return;

    setIsProcessing(true);
    try {
      await api.post(`/photo-editor/reset/${selectedPhoto.photo_id}`);
      Alert.alert('Success', 'Photo reset to original');
      await loadPhotos();
      setBrightness(1.0);
      setContrast(1.0);
      setSaturation(1.0);
      setSharpness(1.0);
      setSelectedBackground(null);
    } catch (error) {
      Alert.alert('Error', error.message || 'Reset failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete photo
  const handleDeletePhoto = async (photoId) => {
    try {
      await api.delete(`/photo-editor/photos/${photoId}`);
      await loadPhotos();
      if (selectedPhotoIndex >= photos.length - 1) {
        setSelectedPhotoIndex(Math.max(0, photos.length - 2));
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Delete failed');
    }
  };

  // Generate AI Listing
  const handleGenerateAIListing = async () => {
    if (photos.length === 0) {
      Alert.alert('Error', 'Upload photos first');
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Generating AI Listing...');

    try {
      const response = await api.post('/photo-editor/generate-ai-listing', {
        photo_ids: photos.map((p) => p.photo_id),
        condition: 'like_new',
      });

      setAiListingResult(response.data.listing_data);
      Alert.alert('Success', 'AI Listing generated!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to generate AI listing');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Finalize photos
  const handleFinalize = async () => {
    if (photos.length === 0) {
      Alert.alert('Error', 'No photos to finalize');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await api.post('/photo-editor/finalize', {
        photo_ids: photos.map((p) => p.photo_id),
      });

      Alert.alert('Success', `${response.data.count} photo(s) ready for listing!`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Finalization failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const photosWithBgRemoved = photos.filter((p) => p.has_background_removed).length;
  const photosNeedingBgRemoval = photos.length - photosWithBgRemoved;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#8B5CF6" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Processing Modal - Enhanced with real-time progress */}
      <Modal visible={isProcessing} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.processingModal}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={styles.processingText}>{processingMessage}</Text>
            
            {/* Progress bar for batch operations */}
            {batchProgress.total > 0 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBg}>
                  <View 
                    style={[
                      styles.progressBarFill, 
                      { width: `${(batchProgress.current / batchProgress.total) * 100}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {batchProgress.current} of {batchProgress.total} ({Math.round((batchProgress.current / batchProgress.total) * 100)}%)
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Photo Editor</Text>
          <Text style={styles.headerSubtitle}>
            {photos.length}/10 photos • {photosWithBgRemoved} BG removed
          </Text>
        </View>
        <TouchableOpacity onPress={handleFinalize} disabled={photos.length === 0}>
          <Text style={[styles.doneButton, photos.length === 0 && styles.doneButtonDisabled]}>
            Done ✓
          </Text>
        </TouchableOpacity>
      </View>

      {/* Photo thumbnails strip */}
      <View style={styles.thumbnailStrip}>
        <FlatList
          data={photos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.photo_id}
          renderItem={({ item, index }) => (
            <PhotoThumbnail
              photo={item}
              isSelected={selectedPhotoIndex === index}
              onSelect={() => setSelectedPhotoIndex(index)}
              onDelete={() => handleDeletePhoto(item.photo_id)}
            />
          )}
          ListFooterComponent={
            photos.length < 10 ? (
              <TouchableOpacity style={styles.addPhotoButton} onPress={handlePickImages}>
                <Text style={styles.addPhotoText}>+</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </View>

      {/* Main preview */}
      <View style={styles.previewContainer}>
        {selectedPhoto ? (
          <Image
            source={{ uri: selectedPhoto.current_url }}
            style={styles.previewImage}
            resizeMode="contain"
          />
        ) : (
          <TouchableOpacity style={styles.uploadPrompt} onPress={handlePickImages}>
            <Text style={styles.uploadIcon}>📷</Text>
            <Text style={styles.uploadText}>Tap to upload photos</Text>
            <Text style={styles.uploadSubtext}>Up to 10 photos, 60MB each</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        <TabButton
          label="Edit"
          icon="✨"
          active={activeTab === 'edit'}
          onPress={() => setActiveTab('edit')}
        />
        <TabButton
          label="Background"
          icon="🎨"
          active={activeTab === 'background'}
          onPress={() => setActiveTab('background')}
        />
        <TabButton
          label="AI Listing"
          icon="🤖"
          active={activeTab === 'ai-listing'}
          onPress={() => setActiveTab('ai-listing')}
        />
      </ScrollView>

      {/* Tab content */}
      <ScrollView
        style={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadPhotos} />}
      >
        {/* Edit Tab */}
        {activeTab === 'edit' && (
          <View style={styles.editTab}>
            {/* Background Removal */}
            <Text style={styles.sectionTitle}>🪄 AI Background Removal</Text>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (selectedPhoto?.has_background_removed || !selectedPhoto) && styles.buttonDisabled,
              ]}
              onPress={handleRemoveBackground}
              disabled={selectedPhoto?.has_background_removed || !selectedPhoto}
            >
              <Text style={styles.primaryButtonText}>
                {selectedPhoto?.has_background_removed
                  ? '✓ Background Removed'
                  : '✨ Remove Background'}
              </Text>
            </TouchableOpacity>

            {photos.length > 1 && (
              <View style={styles.batchSection}>
                <Text style={styles.batchTitle}>
                  Batch Process ({photosNeedingBgRemoval} remaining)
                </Text>
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    photosNeedingBgRemoval === 0 && styles.buttonDisabled,
                  ]}
                  onPress={handleBatchRemoveBackgrounds}
                  disabled={photosNeedingBgRemoval === 0}
                >
                  <Text style={styles.secondaryButtonText}>
                    {photosNeedingBgRemoval === 0
                      ? '✓ All Done!'
                      : `✨ Remove All Backgrounds (${photosNeedingBgRemoval})`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* AI Auto-Enhance */}
            <Text style={styles.sectionTitle}>⚡ AI Auto-Enhance</Text>
            
            <View style={styles.autoEnhanceSection}>
              <Text style={styles.autoEnhanceDesc}>
                Let AI analyze and optimize brightness, contrast, saturation & sharpness
              </Text>
              <TouchableOpacity
                style={[
                  styles.aiButton,
                  (selectedPhoto?.auto_enhanced || !selectedPhoto) && styles.buttonDisabled,
                ]}
                onPress={handleAutoEnhance}
                disabled={selectedPhoto?.auto_enhanced || !selectedPhoto}
              >
                <Text style={styles.aiButtonText}>
                  {selectedPhoto?.auto_enhanced ? '✓ Already Enhanced' : '⚡ Auto-Enhance This Photo'}
                </Text>
              </TouchableOpacity>

              {photos.length > 1 && (
                <TouchableOpacity
                  style={[styles.secondaryButton, { marginTop: 8 }]}
                  onPress={handleBatchAutoEnhance}
                >
                  <Text style={styles.secondaryButtonText}>
                    ⚡ Auto-Enhance All ({photos.filter((p) => !p.auto_enhanced).length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Manual Adjustments */}
            <Text style={styles.sectionTitle}>☀️ Manual Adjustments</Text>

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Brightness</Text>
              <Text style={styles.sliderValue}>{brightness.toFixed(1)}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={2.0}
              value={brightness}
              onValueChange={setBrightness}
              minimumTrackTintColor="#8B5CF6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#8B5CF6"
            />

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Contrast</Text>
              <Text style={styles.sliderValue}>{contrast.toFixed(1)}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={2.0}
              value={contrast}
              onValueChange={setContrast}
              minimumTrackTintColor="#8B5CF6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#8B5CF6"
            />

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Saturation</Text>
              <Text style={styles.sliderValue}>{saturation.toFixed(1)}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={2.0}
              value={saturation}
              onValueChange={setSaturation}
              minimumTrackTintColor="#8B5CF6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#8B5CF6"
            />

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Sharpness</Text>
              <Text style={styles.sliderValue}>{sharpness.toFixed(1)}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0.5}
              maximumValue={2.0}
              value={sharpness}
              onValueChange={setSharpness}
              minimumTrackTintColor="#8B5CF6"
              maximumTrackTintColor="#374151"
              thumbTintColor="#8B5CF6"
            />

            <TouchableOpacity
              style={[styles.secondaryButton, !selectedPhoto && styles.buttonDisabled]}
              onPress={handleApplyAdjustments}
              disabled={!selectedPhoto}
            >
              <Text style={styles.secondaryButtonText}>Apply Adjustments</Text>
            </TouchableOpacity>

            {/* Reset */}
            <TouchableOpacity
              style={[styles.resetButton, !selectedPhoto && styles.buttonDisabled]}
              onPress={handleReset}
              disabled={!selectedPhoto}
            >
              <Text style={styles.resetButtonText}>🔄 Reset Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Background Tab */}
        {activeTab === 'background' && (
          <View style={styles.backgroundTab}>
            {!selectedPhoto?.has_background_removed ? (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  🪄 Remove the background first to apply a custom background
                </Text>
                <TouchableOpacity style={styles.primaryButton} onPress={handleRemoveBackground}>
                  <Text style={styles.primaryButtonText}>Remove Background</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Solid Colors */}
                <Text style={styles.sectionTitle}>Solid Colors</Text>
                <View style={styles.colorGrid}>
                  {BACKGROUND_PRESETS.solid.map((bg) => (
                    <ColorSwatch
                      key={bg.id}
                      color={bg.color}
                      isSelected={selectedBackground?.value === bg.color}
                      onPress={() => handleApplyBackground('solid', bg.color)}
                    />
                  ))}
                </View>

                {/* Gradients */}
                <Text style={styles.sectionTitle}>Gradients</Text>
                <View style={styles.colorGrid}>
                  {BACKGROUND_PRESETS.gradient.map((bg) => (
                    <GradientSwatch
                      key={bg.id}
                      colors={bg.colors}
                      name={bg.name}
                      isSelected={selectedBackground?.value === bg.id}
                      onPress={() => handleApplyBackground('gradient', bg.id)}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* AI Listing Tab */}
        {activeTab === 'ai-listing' && (
          <View style={styles.aiListingTab}>
            <View style={styles.aiListingBox}>
              <Text style={styles.aiListingIcon}>🤖</Text>
              <Text style={styles.aiListingTitle}>AI Listing Generator</Text>
              <Text style={styles.aiListingSubtitle}>
                Generate title, description, dimensions, and price suggestions from your photos
              </Text>

              <TouchableOpacity
                style={[styles.aiButton, photos.length === 0 && styles.buttonDisabled]}
                onPress={handleGenerateAIListing}
                disabled={photos.length === 0}
              >
                <Text style={styles.aiButtonText}>
                  ✨ Generate AI Listing ({photos.length} photos)
                </Text>
              </TouchableOpacity>
            </View>

            {aiListingResult && (
              <View style={styles.aiResult}>
                <Text style={styles.aiResultTitle}>✓ AI Generated Listing</Text>

                {aiListingResult.title && (
                  <View style={styles.aiField}>
                    <Text style={styles.aiFieldLabel}>Title</Text>
                    <Text style={styles.aiFieldValue}>{aiListingResult.title}</Text>
                  </View>
                )}

                {aiListingResult.description && (
                  <View style={styles.aiField}>
                    <Text style={styles.aiFieldLabel}>Description</Text>
                    <Text style={styles.aiFieldValue}>{aiListingResult.description}</Text>
                  </View>
                )}

                {aiListingResult.price_suggestion && (
                  <View style={styles.aiField}>
                    <Text style={styles.aiFieldLabel}>Suggested Price</Text>
                    <Text style={[styles.aiFieldValue, { color: '#10B981', fontWeight: 'bold' }]}>
                      {aiListingResult.price_suggestion}
                    </Text>
                  </View>
                )}

                {aiListingResult.dimensions && (
                  <View style={styles.aiField}>
                    <Text style={styles.aiFieldLabel}>Dimensions</Text>
                    <Text style={styles.aiFieldValue}>{aiListingResult.dimensions}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  backButton: {
    color: '#8B5CF6',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
  doneButton: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: 'bold',
  },
  doneButtonDisabled: {
    color: '#6B7280',
  },
  thumbnailStrip: {
    height: 80,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  thumbnail: {
    width: 60,
    height: 60,
    marginHorizontal: 4,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailSelected: {
    borderColor: '#8B5CF6',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  bgRemovedBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: '#10B981',
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgRemovedText: {
    color: '#fff',
    fontSize: 10,
  },
  addPhotoButton: {
    width: 60,
    height: 60,
    marginHorizontal: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#374151',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    color: '#9CA3AF',
    fontSize: 24,
  },
  previewContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  uploadPrompt: {
    alignItems: 'center',
    padding: 20,
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  uploadText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadSubtext: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  tabsContainer: {
    maxHeight: 50,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#374151',
  },
  tabIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  tabLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  tabLabelActive: {
    color: '#fff',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  editTab: {
    paddingVertical: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 16,
  },
  primaryButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#374151',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  batchSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#8B5CF620',
  },
  batchTitle: {
    color: '#D8B4FE',
    fontSize: 12,
    marginBottom: 8,
  },
  autoEnhanceSection: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#92400E20',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#92400E40',
  },
  autoEnhanceDesc: {
    color: '#FCD34D',
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sliderLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  sliderValue: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  slider: {
    height: 40,
    marginBottom: 8,
  },
  resetButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  resetButtonText: {
    color: '#EF4444',
    fontSize: 14,
  },
  backgroundTab: {
    paddingVertical: 16,
  },
  warningBox: {
    backgroundColor: '#92400E20',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#92400E40',
    alignItems: 'center',
  },
  warningText: {
    color: '#FCD34D',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: '#8B5CF6',
  },
  gradientSwatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gradientSwatchSelected: {
    borderColor: '#8B5CF6',
  },
  gradientInner: {
    flex: 1,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  aiListingTab: {
    paddingVertical: 16,
  },
  aiListingBox: {
    backgroundColor: '#92400E20',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#92400E40',
    alignItems: 'center',
  },
  aiListingIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  aiListingTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  aiListingSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  aiButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  aiResult: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#1F2937',
    borderRadius: 12,
  },
  aiResultTitle: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  aiField: {
    marginBottom: 12,
  },
  aiFieldLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  aiFieldValue: {
    color: '#fff',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingModal: {
    backgroundColor: '#1F2937',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 280,
  },
  processingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 14,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginTop: 16,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  progressText: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});
