/**
 * Minted Photos Screen for Blendlink Mobile
 * View, mint, and manage photo collectibles
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Switch,
  Image,
  Animated,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { mintingAPI } from '../services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// Scenery config
const SCENERY_CONFIG = {
  natural: { gradient: ['#22C55E', '#10B981'], emoji: '🌿', label: 'Natural' },
  water: { gradient: ['#3B82F6', '#06B6D4'], emoji: '🌊', label: 'Water' },
  manmade: { gradient: ['#F97316', '#EF4444'], emoji: '🏙️', label: 'Man-made' },
};

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
};

// ============== COMPONENTS ==============

// Photo Card Component
const PhotoCard = ({ photo, onPress, viewMode, colors }) => {
  const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onPress?.(photo);
  };

  if (viewMode === 'list') {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <Animated.View
          style={[
            styles.listCard,
            { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={[styles.listCardImage, { backgroundColor: scenery.gradient[0] }]}>
            <Text style={styles.listCardEmoji}>{scenery.emoji}</Text>
          </View>
          
          <View style={styles.listCardInfo}>
            <View style={styles.listCardHeader}>
              <Text style={[styles.listCardName, { color: colors.text }]} numberOfLines={1}>
                {photo.name}
              </Text>
              <Text style={styles.listCardPrivacy}>
                {photo.is_private ? '🔒' : '🌐'}
              </Text>
            </View>
            <View style={styles.listCardMeta}>
              <View style={styles.listCardMetaItem}>
                <Text style={styles.listCardMetaEmoji}>{scenery.emoji}</Text>
                <Text style={[styles.listCardMetaText, { color: colors.textMuted }]}>{scenery.label}</Text>
              </View>
              <Text style={[styles.listCardValue, { color: colors.gold }]}>
                {formatDollarValue(photo.dollar_value)}
              </Text>
            </View>
          </View>
          
          <View style={styles.listCardPower}>
            <Text style={[styles.listCardPowerLabel, { color: colors.textMuted }]}>Power</Text>
            <Text style={[styles.listCardPowerValue, { color: colors.primary }]}>
              {photo.power?.toFixed(0) || 100}
            </Text>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
      <Animated.View
        style={[
          styles.gridCard,
          { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* Image */}
        <View style={[styles.gridCardImage, { backgroundColor: scenery.gradient[0] }]}>
          <Text style={styles.gridCardEmoji}>{scenery.emoji}</Text>
          
          {/* Badges */}
          <View style={[styles.gridCardBadge, { backgroundColor: scenery.gradient[0] }]}>
            <Text style={styles.gridCardBadgeText}>{scenery.label}</Text>
          </View>
          
          <View style={styles.gridCardPrivacy}>
            <Text style={styles.gridCardPrivacyEmoji}>
              {photo.is_private ? '🔒' : '🌐'}
            </Text>
          </View>
          
          {/* Value */}
          <View style={styles.gridCardValueContainer}>
            <View style={[styles.gridCardValueBg, { backgroundColor: colors.overlay }]}>
              <Text style={[styles.gridCardValue, { color: colors.gold }]}>
                {formatDollarValue(photo.dollar_value)}
              </Text>
              <View style={styles.gridCardPower}>
                <Text style={styles.gridCardPowerEmoji}>⚡</Text>
                <Text style={[styles.gridCardPowerText, { color: colors.primary }]}>
                  {photo.power?.toFixed(0) || 100}
                </Text>
              </View>
            </View>
          </View>
        </View>
        
        {/* Info */}
        <View style={styles.gridCardInfo}>
          <Text style={[styles.gridCardName, { color: colors.text }]} numberOfLines={1}>
            {photo.name}
          </Text>
          <View style={styles.gridCardStats}>
            <Text style={[styles.gridCardLevel, { color: colors.textMuted }]}>
              Lvl {photo.level || 1}
            </Text>
            <Text style={[styles.gridCardRecord, { color: colors.textMuted }]}>
              🏆 {photo.battles_won || 0}W / {photo.battles_lost || 0}L
            </Text>
          </View>
          
          {/* Strength/Weakness */}
          <View style={styles.gridCardStrengthWeakness}>
            <View style={[styles.strengthBadge, { backgroundColor: colors.success + '20' }]}>
              <Text style={[styles.strengthText, { color: colors.success }]}>
                +25% vs {SCENERY_CONFIG[photo.strength_vs]?.label || 'Water'}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Mint Animation Overlay
const MintAnimationOverlay = ({ visible, onComplete, photoName, colors }) => {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const stages = [
    { label: 'Analyzing photo...', sublabel: 'AI scanning content', emoji: '📷' },
    { label: 'Minting collectible...', sublabel: 'Creating unique token', emoji: '✨' },
    { label: 'Confirming transaction...', sublabel: 'Securing ownership', emoji: '⏳' },
    { label: 'Mint Complete!', sublabel: '500 BL coins spent', emoji: '✅' },
  ];

  useEffect(() => {
    if (!visible) {
      setStage(0);
      setProgress(0);
      return;
    }

    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 100));
    }, 60);

    const stageTimers = [
      setTimeout(() => setStage(1), 1000),
      setTimeout(() => setStage(2), 2000),
      setTimeout(() => {
        setStage(3);
        Vibration.vibrate([100, 100, 100]);
      }, 3000),
      setTimeout(() => onComplete?.(), 5000),
    ];

    return () => {
      clearInterval(progressInterval);
      stageTimers.forEach(t => clearTimeout(t));
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <Animated.View style={[styles.mintOverlay, { opacity: opacityAnim }]}>
        <Animated.View
          style={[
            styles.mintContent,
            { backgroundColor: colors.card, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Photo Preview */}
          <View style={[styles.mintPhotoPreview, { backgroundColor: colors.primary + '20' }]}>
            <Text style={styles.mintPhotoEmoji}>📷</Text>
            {stage === 3 && (
              <View style={styles.mintCheckmark}>
                <Text style={styles.mintCheckmarkText}>✅</Text>
              </View>
            )}
          </View>

          {/* Status */}
          <Text style={[styles.mintStageLabel, { color: colors.text }]}>
            {stages[stage].emoji} {stages[stage].label}
          </Text>
          <Text style={[styles.mintStageSublabel, { color: colors.textMuted }]}>
            {stages[stage].sublabel}
          </Text>

          {/* Progress */}
          <View style={[styles.mintProgressBg, { backgroundColor: colors.cardSecondary }]}>
            <View
              style={[
                styles.mintProgressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: stage === 3 ? colors.success : colors.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.mintProgressText, { color: colors.textMuted }]}>
            {progress}% - {stage === 3 ? 'Complete' : 'Processing...'}
          </Text>

          {stage === 3 && (
            <View style={styles.mintCostBadge}>
              <Text style={styles.mintCostEmoji}>💰</Text>
              <Text style={styles.mintCostText}>-500 BL</Text>
            </View>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// Mint Photo Dialog with Dollar Value Preview
const MintPhotoDialog = ({ visible, onClose, onMint, mintStatus, colors }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ratingCriteria, setRatingCriteria] = useState(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Fetch rating criteria on mount
  useEffect(() => {
    const fetchCriteria = async () => {
      try {
        const data = await mintingAPI.getRatingCriteria();
        setRatingCriteria(data.criteria || []);
      } catch (err) {
        console.error('Failed to fetch rating criteria:', err);
      }
    };
    if (visible) fetchCriteria();
  }, [visible]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedImage || !name) {
      alert('Please select an image and enter a name');
      return;
    }

    setIsSubmitting(true);
    try {
      await onMint({
        image: selectedImage,
        name,
        description,
        is_private: isPrivate,
      });
      
      // Reset form
      setName('');
      setDescription('');
      setSelectedImage(null);
      setIsPrivate(false);
    } catch (err) {
      alert(err.message || 'Minting failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Category icons
  const categoryIcons = {
    composition: '📐',
    lighting: '💡',
    color: '🎨',
    subject: '👤',
    technical: '📷',
    emotional: '❤️',
    uniqueness: '✨',
    storytelling: '📖',
    context: '🌍',
    timing: '⏰',
    authenticity: '🔐',
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.dialogOverlay}>
        <View style={[styles.dialogContent, { backgroundColor: colors.card }]}>
          <View style={styles.dialogHeader}>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>
              ✨ Mint New Photo
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={[styles.dialogClose, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Mint Status */}
            {mintStatus && (
              <View style={[styles.mintStatusCard, { backgroundColor: colors.cardSecondary }]}>
                <View style={styles.mintStatusRow}>
                  <Text style={[styles.mintStatusLabel, { color: colors.textMuted }]}>BL Coins</Text>
                  <Text style={[styles.mintStatusValue, { color: colors.gold }]}>
                    {mintStatus.bl_coins?.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.mintStatusRow}>
                  <Text style={[styles.mintStatusLabel, { color: colors.textMuted }]}>Mints Today</Text>
                  <Text style={[styles.mintStatusValue, { color: colors.text }]}>
                    {mintStatus.mints_today} / {mintStatus.daily_limit}
                  </Text>
                </View>
                <View style={styles.mintStatusRow}>
                  <Text style={[styles.mintStatusLabel, { color: colors.textMuted }]}>Cost</Text>
                  <Text style={[styles.mintStatusValue, { color: colors.primary }]}>500 BL</Text>
                </View>
              </View>
            )}

            {/* Dollar Value AI Preview Section */}
            <TouchableOpacity
              style={[styles.dollarValuePreviewCard, { backgroundColor: colors.cardSecondary, borderColor: colors.gold }]}
              onPress={() => setPreviewExpanded(!previewExpanded)}
              activeOpacity={0.8}
            >
              <View style={styles.dollarValuePreviewHeader}>
                <View style={styles.dollarValuePreviewTitleRow}>
                  <Text style={styles.dollarValuePreviewEmoji}>💵</Text>
                  <Text style={[styles.dollarValuePreviewTitle, { color: colors.text }]}>
                    AI Dollar Value Scoring
                  </Text>
                </View>
                <Text style={[styles.dollarValuePreviewArrow, { color: colors.textMuted }]}>
                  {previewExpanded ? '▼' : '▶'}
                </Text>
              </View>
              
              <Text style={[styles.dollarValuePreviewDesc, { color: colors.textMuted }]}>
                Your photo will be scored across 11 categories by AI
              </Text>

              {previewExpanded && ratingCriteria && (
                <View style={styles.dollarValueCriteriaList}>
                  {ratingCriteria.map((criterion, index) => (
                    <View 
                      key={criterion.key} 
                      style={[
                        styles.dollarValueCriteriaItem,
                        { backgroundColor: colors.card, borderColor: colors.border }
                      ]}
                    >
                      <View style={styles.dollarValueCriteriaHeader}>
                        <Text style={styles.dollarValueCriteriaIcon}>
                          {categoryIcons[criterion.key] || '📊'}
                        </Text>
                        <Text style={[styles.dollarValueCriteriaLabel, { color: colors.text }]}>
                          {criterion.label}
                        </Text>
                        <View style={[styles.dollarValueWeightBadge, { backgroundColor: colors.primary + '30' }]}>
                          <Text style={[styles.dollarValueWeightText, { color: colors.primary }]}>
                            {criterion.weight}%
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.dollarValueCriteriaDesc, { color: colors.textMuted }]}>
                        {criterion.description}
                      </Text>
                      <Text style={[styles.dollarValueMaxValue, { color: colors.gold }]}>
                        Max: ${(criterion.max_value / 1_000_000).toFixed(0)}M
                      </Text>
                    </View>
                  ))}
                  
                  <View style={[styles.dollarValueTotalCard, { backgroundColor: colors.gold + '20', borderColor: colors.gold }]}>
                    <Text style={[styles.dollarValueTotalLabel, { color: colors.text }]}>
                      Maximum Possible Value
                    </Text>
                    <Text style={[styles.dollarValueTotalValue, { color: colors.gold }]}>
                      $1,000,000,000 (1B)
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Image Upload */}
            <TouchableOpacity
              style={[styles.imageUpload, { borderColor: colors.border }]}
              onPress={pickImage}
            >
              {selectedImage ? (
                <Image source={{ uri: selectedImage.uri }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Text style={styles.uploadIcon}>📤</Text>
                  <Text style={[styles.uploadText, { color: colors.textMuted }]}>
                    Tap to select image
                  </Text>
                  <Text style={[styles.uploadHint, { color: colors.textSecondary }]}>
                    Max 10MB • JPG, PNG, WebP
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Name Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.cardSecondary, color: colors.text, borderColor: colors.border }]}
                value={name}
                onChangeText={setName}
                placeholder="My Epic Photo"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Description (optional)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.cardSecondary, color: colors.text, borderColor: colors.border }]}
                value={description}
                onChangeText={setDescription}
                placeholder="A beautiful sunset..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Privacy Switch */}
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, { color: colors.text }]}>
                Private (won't show in feed)
              </Text>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: colors.cardSecondary, true: colors.primary + '80' }}
                thumbColor={isPrivate ? colors.primary : colors.textMuted}
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.mintButton,
                { opacity: isSubmitting || !selectedImage || !name || (mintStatus && !mintStatus.can_mint) ? 0.5 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || !selectedImage || !name || (mintStatus && !mintStatus.can_mint)}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.mintButtonText}>✨ Mint Photo (500 BL)</Text>
              )}
            </TouchableOpacity>

            {mintStatus && !mintStatus.can_mint && (
              <Text style={[styles.mintError, { color: colors.error }]}>
                {mintStatus.reason}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============== MAIN SCREEN ==============
export default function MintedPhotosScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [mintDialogOpen, setMintDialogOpen] = useState(false);
  const [mintStatus, setMintStatus] = useState(null);
  const [showMintAnimation, setShowMintAnimation] = useState(false);

  const fetchPhotos = async () => {
    try {
      const response = await mintingAPI.getMyPhotos();
      setPhotos(response.photos || []);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMintStatus = async () => {
    try {
      const response = await mintingAPI.getMintStatus();
      setMintStatus(response);
    } catch (err) {
      console.error('Failed to fetch mint status:', err);
    }
  };

  useEffect(() => {
    fetchPhotos();
    fetchMintStatus();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPhotos();
    fetchMintStatus();
  };

  const handleMint = async (data) => {
    setMintDialogOpen(false);
    setShowMintAnimation(true);
    
    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', {
        uri: data.image.uri,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });
      formData.append('name', data.name);
      formData.append('description', data.description || '');
      formData.append('is_private', data.is_private ? 'true' : 'false');
      formData.append('show_in_feed', data.is_private ? 'false' : 'true');

      await mintingAPI.uploadPhoto(formData);
    } catch (err) {
      console.error('Mint failed:', err);
      throw err;
    }
  };

  const handleMintComplete = () => {
    setShowMintAnimation(false);
    fetchPhotos();
    fetchMintStatus();
  };

  const handlePhotoPress = (photo) => {
    // Navigate to photo detail or battle screen
    navigation.navigate('PhotoGameArena');
  };

  const totalValue = photos.reduce((sum, p) => sum + (p.dollar_value || 0), 0);
  const totalBattles = photos.reduce((sum, p) => sum + (p.battles_won || 0) + (p.battles_lost || 0), 0);

  const renderPhoto = ({ item }) => (
    <PhotoCard
      photo={item}
      viewMode={viewMode}
      onPress={handlePhotoPress}
      colors={colors}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Mint Animation */}
      <MintAnimationOverlay
        visible={showMintAnimation}
        onComplete={handleMintComplete}
        colors={colors}
      />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>✨ Minted Photos</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Your digital collectibles</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.mintNewButton} onPress={() => setMintDialogOpen(true)}>
          <Text style={styles.mintNewButtonText}>📷 Mint</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.statCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.statIcon, { color: colors.textMuted }]}>🖼️</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{photos.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.statIcon, { color: colors.textMuted }]}>📈</Text>
          <Text style={[styles.statValue, { color: colors.gold }]}>{formatDollarValue(totalValue)}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Value</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.statIcon, { color: colors.textMuted }]}>⚔️</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>{totalBattles}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Battles</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.cardSecondary }]}>
          <Text style={[styles.statIcon, { color: colors.textMuted }]}>📊</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {mintStatus?.mints_today || 0}/{mintStatus?.daily_limit || 3}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Today</Text>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[
            styles.viewModeButton,
            viewMode === 'grid' && styles.viewModeButtonActive,
            { backgroundColor: viewMode === 'grid' ? colors.primary : colors.card },
          ]}
          onPress={() => setViewMode('grid')}
        >
          <Text style={[styles.viewModeIcon, { color: viewMode === 'grid' ? '#fff' : colors.textMuted }]}>⊞</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.viewModeButton,
            viewMode === 'list' && styles.viewModeButtonActive,
            { backgroundColor: viewMode === 'list' ? colors.primary : colors.card },
          ]}
          onPress={() => setViewMode('list')}
        >
          <Text style={[styles.viewModeIcon, { color: viewMode === 'list' ? '#fff' : colors.textMuted }]}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* Photos */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Minted Photos Yet</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Mint your first photo to start your collection!
          </Text>
          <TouchableOpacity
            style={styles.emptyMintButton}
            onPress={() => setMintDialogOpen(true)}
          >
            <Text style={styles.emptyMintButtonText}>✨ Mint Your First Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item.mint_id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Mint Dialog */}
      <MintPhotoDialog
        visible={mintDialogOpen}
        onClose={() => setMintDialogOpen(false)}
        onMint={handleMint}
        mintStatus={mintStatus}
        colors={colors}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setMintDialogOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  mintNewButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mintNewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Stats
  statsContainer: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
  },
  statIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  // Toolbar
  toolbar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  viewModeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewModeButtonActive: {},
  viewModeIcon: {
    fontSize: 18,
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyMintButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyMintButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // List
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  // Grid Card
  gridCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  gridCardImage: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCardEmoji: {
    fontSize: 48,
    opacity: 0.5,
  },
  gridCardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  gridCardBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gridCardPrivacy: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  gridCardPrivacyEmoji: {
    fontSize: 16,
  },
  gridCardValueContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  gridCardValueBg: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  gridCardValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  gridCardPower: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridCardPowerEmoji: {
    fontSize: 12,
    marginRight: 2,
  },
  gridCardPowerText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  gridCardInfo: {
    padding: 12,
  },
  gridCardName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  gridCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gridCardLevel: {
    fontSize: 11,
  },
  gridCardRecord: {
    fontSize: 11,
  },
  gridCardStrengthWeakness: {
    flexDirection: 'row',
  },
  strengthBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  strengthText: {
    fontSize: 9,
    fontWeight: '600',
  },
  // List Card
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  listCardImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listCardEmoji: {
    fontSize: 24,
  },
  listCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  listCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listCardName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  listCardPrivacy: {
    fontSize: 14,
    marginLeft: 8,
  },
  listCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  listCardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  listCardMetaEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  listCardMetaText: {
    fontSize: 12,
  },
  listCardValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  listCardPower: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  listCardPowerLabel: {
    fontSize: 10,
  },
  listCardPowerValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Dialog
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  dialogContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  dialogClose: {
    fontSize: 24,
    padding: 4,
  },
  mintStatusCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  mintStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mintStatusLabel: {
    fontSize: 13,
  },
  mintStatusValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  imageUpload: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  uploadIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 14,
  },
  uploadHint: {
    fontSize: 11,
    marginTop: 4,
  },
  uploadedImage: {
    width: '100%',
    aspectRatio: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  switchLabel: {
    fontSize: 14,
  },
  mintButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  mintButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mintError: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
  },
  // Mint Animation
  mintOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mintContent: {
    width: width - 64,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  mintPhotoPreview: {
    width: 120,
    height: 120,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  mintPhotoEmoji: {
    fontSize: 48,
  },
  mintCheckmark: {
    position: 'absolute',
    bottom: -8,
    right: -8,
  },
  mintCheckmarkText: {
    fontSize: 32,
  },
  mintStageLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  mintStageSublabel: {
    fontSize: 13,
    marginBottom: 20,
  },
  mintProgressBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  mintProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  mintProgressText: {
    fontSize: 11,
    marginBottom: 20,
  },
  mintCostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAB308',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mintCostEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  mintCostText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // FAB
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
  },
  // Dollar Value Preview
  dollarValuePreviewCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  dollarValuePreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dollarValuePreviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dollarValuePreviewEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  dollarValuePreviewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dollarValuePreviewArrow: {
    fontSize: 14,
  },
  dollarValuePreviewDesc: {
    fontSize: 12,
    marginTop: 6,
  },
  dollarValueCriteriaList: {
    marginTop: 16,
    gap: 10,
  },
  dollarValueCriteriaItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  dollarValueCriteriaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dollarValueCriteriaIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  dollarValueCriteriaLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  dollarValueWeightBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  dollarValueWeightText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  dollarValueCriteriaDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  dollarValueMaxValue: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  dollarValueTotalCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  dollarValueTotalLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  dollarValueTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
