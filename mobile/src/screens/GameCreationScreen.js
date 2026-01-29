/**
 * GameCreationScreen - Mobile
 * 
 * 5-photo selection with stamina validation for creating/joining games
 * 
 * Features:
 * - Grid view of user's minted photos
 * - Stamina bar on each photo (grayed out if stamina = 0)
 * - Low stamina warning
 * - Exactly 5 photos required
 * - Total dollar value display
 * - Bet amount input
 * - Create Open Game or Start Bot Match
 * - Haptic feedback on selection
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { photoGameAPI } from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48 - 16) / 3; // 3 columns

// Constants
const REQUIRED_PHOTOS = 5;
const MAX_STAMINA = 24;

// Scenery config
const SCENERY_CONFIG = {
  natural: { gradient: ['#22C55E', '#10B981'], emoji: '🌿', label: 'Natural' },
  water: { gradient: ['#3B82F6', '#06B6D4'], emoji: '🌊', label: 'Water' },
  manmade: { gradient: ['#F97316', '#EF4444'], emoji: '🏙️', label: 'Man-made' },
  neutral: { gradient: ['#6B7280', '#4B5563'], emoji: '⬜', label: 'Neutral' },
};

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
};

// Selectable Photo Card
const SelectablePhotoCard = ({ photo, selected, disabled, onSelect, colors }) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  const currentStamina = photo?.current_stamina ?? MAX_STAMINA;
  const staminaPercent = (currentStamina / MAX_STAMINA) * 100;
  const isLowStamina = currentStamina < 5;
  const hasNoStamina = currentStamina < 1;

  const handlePress = () => {
    if (hasNoStamina) {
      Alert.alert('No Stamina', 'This photo has no stamina left. Wait for it to regenerate.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSelect(photo);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled && !selected}
      activeOpacity={0.8}
      style={[
        styles.photoCard,
        {
          backgroundColor: colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: hasNoStamina ? 0.4 : 1,
        },
      ]}
    >
      {/* Photo placeholder */}
      <View style={[styles.photoImage, { backgroundColor: scenery.gradient[0] }]}>
        <Text style={styles.photoEmoji}>{scenery.emoji}</Text>
        
        {/* Scenery badge */}
        <View style={[styles.sceneryBadge, { backgroundColor: scenery.gradient[0] }]}>
          <Text style={styles.sceneryBadgeText}>{scenery.label}</Text>
        </View>

        {/* Selection indicator */}
        {selected && (
          <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.selectedCheck}>✓</Text>
          </View>
        )}

        {/* No stamina overlay */}
        {hasNoStamina && (
          <View style={styles.noStaminaOverlay}>
            <Text style={styles.noStaminaText}>⚡ 0</Text>
          </View>
        )}

        {/* Low stamina warning */}
        {isLowStamina && !hasNoStamina && (
          <View style={[styles.lowStaminaBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.lowStaminaText}>⚠️ Low</Text>
          </View>
        )}
      </View>

      {/* Photo info */}
      <View style={styles.photoInfo}>
        <Text style={[styles.photoName, { color: colors.text }]} numberOfLines={1}>
          {photo?.name || 'Photo'}
        </Text>
        <Text style={[styles.photoValue, { color: colors.gold }]}>
          {formatDollarValue(photo?.dollar_value)}
        </Text>

        {/* Stamina bar */}
        <View style={styles.staminaRow}>
          <View style={[styles.staminaBarBg, { backgroundColor: colors.cardSecondary }]}>
            <View
              style={[
                styles.staminaBarFill,
                {
                  width: `${staminaPercent}%`,
                  backgroundColor: staminaPercent > 20 ? colors.gold : colors.error,
                },
              ]}
            />
          </View>
          <Text style={[styles.staminaText, { color: colors.textMuted }]}>
            {Math.round(currentStamina)}
          </Text>
        </View>

        {/* Level & streak */}
        <View style={styles.statsRow}>
          <Text style={[styles.statText, { color: colors.primary }]}>
            Lv.{photo?.level || 1}
          </Text>
          {(photo?.win_streak || 0) >= 3 && (
            <Text style={styles.streakText}>🔥{photo.win_streak}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Main Screen
export default function GameCreationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { user } = useAuth();

  // Mode: 'create' (open game) or 'join' (join existing) or 'bot' (vs bot)
  const mode = route.params?.mode || 'create';
  const joinGameId = route.params?.joinGameId;
  const botDifficulty = route.params?.botDifficulty;

  // State
  const [photos, setPhotos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [betAmount, setBetAmount] = useState('0');
  const [sortBy, setSortBy] = useState('dollar_value');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch user's battle photos with stamina
  const fetchPhotos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await photoGameAPI.getBattlePhotos();
      
      // Fetch stamina for each photo
      const enrichedPhotos = await Promise.all(
        (data.photos || []).map(async (photo) => {
          try {
            const staminaData = await photoGameAPI.getPhotoStamina(photo.mint_id);
            return { ...photo, ...staminaData };
          } catch {
            return {
              ...photo,
              current_stamina: MAX_STAMINA,
              max_stamina: MAX_STAMINA,
              level: 1,
              xp: 0,
              win_streak: 0,
            };
          }
        })
      );

      setPhotos(enrichedPhotos);
    } catch (err) {
      console.error('Failed to load photos:', err);
      Alert.alert('Error', 'Failed to load your photos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // Toggle photo selection
  const togglePhoto = (photo) => {
    const id = photo.mint_id;

    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((sid) => sid !== id));
      Haptics.selectionAsync();
    } else {
      if (selectedIds.length >= REQUIRED_PHOTOS) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Maximum Reached', `You can only select ${REQUIRED_PHOTOS} photos`);
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  // Selected photos data
  const selectedPhotos = photos.filter((p) => selectedIds.includes(p.mint_id));
  const totalDollarValue = selectedPhotos.reduce((sum, p) => sum + (p.dollar_value || 0), 0);
  const canConfirm = selectedIds.length === REQUIRED_PHOTOS;

  // Sort photos
  const sortedPhotos = [...photos].sort((a, b) => {
    if (sortBy === 'dollar_value') return (b.dollar_value || 0) - (a.dollar_value || 0);
    if (sortBy === 'stamina') return (b.current_stamina || 0) - (a.current_stamina || 0);
    if (sortBy === 'level') return (b.level || 1) - (a.level || 1);
    return 0;
  });

  // Available photos count
  const availablePhotos = photos.filter((p) => (p.current_stamina ?? MAX_STAMINA) >= 1).length;

  // Handle create game
  const handleCreateGame = async () => {
    if (!canConfirm) return;

    try {
      setCreating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      if (mode === 'bot') {
        // Start bot match
        const result = await photoGameAPI.startBotMatch({
          photo_ids: selectedIds,
          difficulty: botDifficulty || 'medium',
        });
        navigation.replace('PhotoGameArena', {
          mode: 'bot',
          sessionId: result.session_id,
          photos: selectedPhotos,
          difficulty: botDifficulty,
        });
      } else if (mode === 'join' && joinGameId) {
        // Join existing game
        const result = await photoGameAPI.joinOpenGame(joinGameId, selectedIds);
        navigation.replace('PhotoGameArena', {
          mode: 'pvp',
          gameId: joinGameId,
          sessionId: result.session_id,
          photos: selectedPhotos,
        });
      } else {
        // Create open game
        const result = await photoGameAPI.createOpenGame({
          photo_ids: selectedIds,
          bet_amount: parseInt(betAmount) || 0,
        });
        
        Alert.alert(
          '🎮 Game Created!',
          'Your game is now open for others to join. You can wait or browse other games.',
          [
            { text: 'Browse Games', onPress: () => navigation.navigate('OpenGamesBrowser') },
            { text: 'Wait Here', style: 'cancel' },
          ]
        );
      }
    } catch (err) {
      console.error('Failed to create game:', err);
      Alert.alert('Error', err.message || 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  // Render photo card
  const renderPhotoCard = ({ item }) => (
    <SelectablePhotoCard
      photo={item}
      selected={selectedIds.includes(item.mint_id)}
      disabled={selectedIds.length >= REQUIRED_PHOTOS}
      onSelect={togglePhoto}
      colors={colors}
    />
  );

  // Header component
  const ListHeader = () => (
    <View style={styles.header}>
      {/* Title */}
      <Text style={[styles.title, { color: colors.text }]}>
        {mode === 'join' ? '⚔️ Select Photos to Join' : mode === 'bot' ? '🤖 Select Photos for Bot Match' : '⚔️ Create New Battle'}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Choose exactly 5 minted photos for this battle
      </Text>

      {/* Selection stats */}
      <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Selected</Text>
          <Text style={[styles.statValue, { color: canConfirm ? colors.success : colors.text }]}>
            {selectedIds.length}/{REQUIRED_PHOTOS}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Value</Text>
          <Text style={[styles.statValue, { color: colors.gold }]}>
            {formatDollarValue(totalDollarValue)}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Available</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {availablePhotos} photos
          </Text>
        </View>
      </View>

      {/* Sort options */}
      <View style={styles.sortRow}>
        <Text style={[styles.sortLabel, { color: colors.textMuted }]}>Sort by:</Text>
        {['dollar_value', 'stamina', 'level'].map((option) => (
          <TouchableOpacity
            key={option}
            onPress={() => {
              setSortBy(option);
              Haptics.selectionAsync();
            }}
            style={[
              styles.sortButton,
              {
                backgroundColor: sortBy === option ? colors.primary : colors.cardSecondary,
              },
            ]}
          >
            <Text
              style={[
                styles.sortButtonText,
                { color: sortBy === option ? '#fff' : colors.textMuted },
              ]}
            >
              {option === 'dollar_value' ? '💵 Value' : option === 'stamina' ? '⚡ Stamina' : '⭐ Level'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bet amount (only for create mode) */}
      {mode === 'create' && (
        <View style={[styles.betSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.betHeader}>
            <Text style={styles.betEmoji}>💰</Text>
            <Text style={[styles.betLabel, { color: colors.text }]}>Bet Amount (BL Coins)</Text>
          </View>
          <TextInput
            style={[styles.betInput, { backgroundColor: colors.cardSecondary, color: colors.text, borderColor: colors.border }]}
            value={betAmount}
            onChangeText={setBetAmount}
            keyboardType="numeric"
            placeholder="0 for free game"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.betHint, { color: colors.textMuted }]}>
            Winner takes all! 0 = free game
          </Text>
        </View>
      )}

      {/* Photo grid label */}
      <Text style={[styles.gridLabel, { color: colors.text }]}>
        Your Minted Photos ({photos.length})
      </Text>
    </View>
  );

  // Empty state
  const ListEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📷</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Photos Available</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        Mint some photos first to create a battle
      </Text>
      <TouchableOpacity
        style={styles.mintButton}
        onPress={() => navigation.navigate('MintedPhotos')}
      >
        <Text style={styles.mintButtonText}>Mint Photos</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Nav header */}
      <View style={[styles.navHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]}>
          {mode === 'join' ? 'Join Battle' : mode === 'bot' ? 'Bot Match' : 'Create Battle'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading photos...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={sortedPhotos}
            renderItem={renderPhotoCard}
            keyExtractor={(item) => item.mint_id}
            numColumns={3}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchPhotos();
                }}
                tintColor={colors.primary}
              />
            }
          />

          {/* Bottom action bar */}
          {photos.length > 0 && (
            <View style={[styles.actionBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <View style={styles.actionInfo}>
                <Text style={[styles.actionInfoLabel, { color: colors.textMuted }]}>
                  {canConfirm ? '✅ Ready to battle!' : `Select ${REQUIRED_PHOTOS - selectedIds.length} more`}
                </Text>
                <Text style={[styles.actionInfoValue, { color: colors.gold }]}>
                  {formatDollarValue(totalDollarValue)}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: canConfirm ? colors.primary : colors.cardSecondary,
                    opacity: canConfirm ? 1 : 0.5,
                  },
                ]}
                onPress={handleCreateGame}
                disabled={!canConfirm || creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.actionButtonText}>
                    {mode === 'join' ? '⚔️ Join Battle' : mode === 'bot' ? '🤖 Start Match' : '⚡ Create Game'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  navTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 120,
  },
  // Header
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  // Stats card
  statsCard: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  statDivider: {
    width: 1,
    marginHorizontal: 12,
  },
  // Sort
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sortLabel: {
    fontSize: 13,
    marginRight: 8,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Bet section
  betSection: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  betHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  betEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  betLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  betInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  betHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  gridLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  // Photo card
  photoCard: {
    width: CARD_WIDTH,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  photoEmoji: {
    fontSize: 32,
    opacity: 0.6,
  },
  sceneryBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sceneryBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  noStaminaOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
    alignItems: 'center',
  },
  noStaminaText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  lowStaminaBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lowStaminaText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  photoInfo: {
    padding: 8,
  },
  photoName: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  photoValue: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  staminaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staminaBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginRight: 4,
    overflow: 'hidden',
  },
  staminaBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  staminaText: {
    fontSize: 9,
    fontWeight: '600',
    width: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  statText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  streakText: {
    fontSize: 9,
  },
  // Empty state
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  mintButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  mintButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  actionInfo: {},
  actionInfoLabel: {
    fontSize: 12,
  },
  actionInfoValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    minWidth: 140,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
