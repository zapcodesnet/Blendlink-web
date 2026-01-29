/**
 * OpenGamesBrowserScreen - Mobile
 * 
 * Browse and join open PVP Photo Battle games
 * Features:
 * - Grid view of open games with thumbnails
 * - Search by username or game ID
 * - Tap to preview with flip cards showing all 5 photos
 * - Haptic feedback on interactions
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Dimensions,
  RefreshControl,
  Modal,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { photoGameAPI } from '../services/api';
import HapticFeedback from '../utils/HapticFeedback';
import { SCENERY_CONFIG, formatDollarValue } from '../components/PhotoCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // 2 columns with padding

// Time ago helper
const timeAgo = (date) => {
  if (!date) return '';
  const now = new Date();
  const created = new Date(date);
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

// ============== FLIP CARD COMPONENT ==============
const FlipCard = ({ photo, index, colors }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;

  const handleFlip = () => {
    HapticFeedback.medium();
    const toValue = isFlipped ? 0 : 1;
    Animated.spring(flipAnim, {
      toValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setIsFlipped(!isFlipped);
  };

  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <Pressable onPress={handleFlip} style={styles.flipCardContainer}>
      {/* Front */}
      <Animated.View
        style={[
          styles.flipCardFace,
          styles.flipCardFront,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            transform: [{ rotateY: frontInterpolate }],
            opacity: frontOpacity,
          },
        ]}
      >
        {photo?.image_url ? (
          <Image source={{ uri: photo.image_url }} style={styles.flipCardImage} />
        ) : (
          <View style={[styles.flipCardPlaceholder, { backgroundColor: scenery.gradient[0] }]}>
            <Text style={styles.flipCardPlaceholderEmoji}>{scenery.emoji}</Text>
          </View>
        )}

        {/* Scenery badge */}
        <View style={[styles.sceneryBadge, { backgroundColor: scenery.gradient[0] }]}>
          <Text style={styles.sceneryBadgeText}>{scenery.emoji} {scenery.label}</Text>
        </View>

        {/* Info overlay */}
        <View style={styles.flipCardOverlay}>
          <Text style={styles.flipCardName} numberOfLines={1}>{photo?.name || 'Photo'}</Text>
          <Text style={styles.flipCardValue}>{formatDollarValue(photo?.dollar_value)}</Text>
        </View>

        {/* Tap hint */}
        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Tap to flip</Text>
        </View>

        {/* Streaks */}
        {photo?.win_streak >= 3 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakBadgeText}>🔥 {photo.win_streak}</Text>
          </View>
        )}
      </Animated.View>

      {/* Back */}
      <Animated.View
        style={[
          styles.flipCardFace,
          styles.flipCardBack,
          {
            backgroundColor: colors.card,
            borderColor: colors.primary,
            transform: [{ rotateY: backInterpolate }],
            opacity: backOpacity,
          },
        ]}
      >
        <Text style={[styles.backTitle, { color: colors.text }]} numberOfLines={1}>
          {photo?.name || 'Photo'}
        </Text>

        <View style={styles.backStats}>
          <View style={styles.backStatRow}>
            <Text style={[styles.backStatLabel, { color: colors.textMuted }]}>Dollar Value:</Text>
            <Text style={[styles.backStatValue, { color: colors.gold }]}>
              {formatDollarValue(photo?.dollar_value)}
            </Text>
          </View>

          <View style={styles.backStatRow}>
            <Text style={[styles.backStatLabel, { color: colors.textMuted }]}>Scenery:</Text>
            <Text style={{ color: scenery.gradient[0], fontWeight: 'bold' }}>
              {scenery.emoji} {scenery.label}
            </Text>
          </View>

          <View style={styles.backStatRow}>
            <Text style={[styles.backStatLabel, { color: colors.textMuted }]}>Stamina:</Text>
            <Text style={{ color: (photo?.current_stamina || 24) < 5 ? colors.error : colors.success, fontWeight: 'bold' }}>
              {photo?.current_stamina || 24}/{photo?.max_stamina || 24}
            </Text>
          </View>

          <View style={styles.backStatRow}>
            <Text style={[styles.backStatLabel, { color: colors.textMuted }]}>Level:</Text>
            <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Lv. {photo?.level || 1}</Text>
          </View>

          <View style={styles.backStatRow}>
            <Text style={[styles.backStatLabel, { color: colors.textMuted }]}>Win Streak:</Text>
            <Text style={{ color: '#F97316', fontWeight: 'bold' }}>
              {photo?.win_streak >= 3 ? `🔥 ${photo.win_streak}` : photo?.win_streak || 0}
            </Text>
          </View>
        </View>

        <View style={styles.tapHintBack}>
          <Text style={[styles.tapHintText, { color: colors.textMuted }]}>Tap to flip back</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
};

// ============== GAME PREVIEW MODAL ==============
const GamePreviewModal = ({ game, visible, onClose, onJoin, colors }) => {
  const [loading, setLoading] = useState(false);
  const [fullGame, setFullGame] = useState(null);

  useEffect(() => {
    if (visible && game?.game_id) {
      setLoading(true);
      photoGameAPI.getOpenGameDetails(game.game_id)
        .then(data => setFullGame(data))
        .catch(err => console.error('Failed to load game details:', err))
        .finally(() => setLoading(false));
    }
  }, [visible, game?.game_id]);

  const handleJoin = () => {
    HapticFeedback.heavy();
    onJoin(game);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                👤 {fullGame?.creator_username || game?.creator_username}'s Battle
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                Game ID: {game?.game_id?.slice(0, 8)}...
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <>
                {/* Game info badges */}
                <View style={styles.gameBadges}>
                  <View style={[styles.badge, { backgroundColor: colors.gold + '20', borderColor: colors.gold }]}>
                    <Text style={[styles.badgeText, { color: colors.gold }]}>
                      💰 {game?.bet_amount > 0 ? `${game.bet_amount} BL` : 'FREE'}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                    <Text style={[styles.badgeText, { color: colors.primary }]}>
                      💵 {formatDollarValue(fullGame?.total_dollar_value || game?.total_dollar_value)}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.cardSecondary }]}>
                    <Text style={[styles.badgeText, { color: colors.textMuted }]}>
                      🕐 {timeAgo(fullGame?.created_at || game?.created_at)}
                    </Text>
                  </View>
                </View>

                {/* Creator's photos */}
                <Text style={[styles.photosTitle, { color: colors.text }]}>
                  🏆 {fullGame?.creator_username || game?.creator_username}'s Photos
                </Text>

                <View style={styles.photosGrid}>
                  {(fullGame?.creator_photos || []).map((photo, index) => (
                    <FlipCard key={photo.mint_id} photo={photo} index={index} colors={colors} />
                  ))}
                </View>

                {/* Join button */}
                <TouchableOpacity
                  style={styles.joinButton}
                  onPress={handleJoin}
                  activeOpacity={0.8}
                >
                  <Text style={styles.joinButtonText}>⚡ Join This Battle</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============== GAME CARD ==============
const GameCard = ({ game, onPress, colors }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scenery = SCENERY_CONFIG[game?.thumbnail_photo?.scenery_type] || SCENERY_CONFIG.natural;

  const handlePress = () => {
    HapticFeedback.light();
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onPress(game);
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View
        style={[
          styles.gameCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {game?.thumbnail_photo?.image_url ? (
            <Image
              source={{ uri: game.thumbnail_photo.image_url }}
              style={styles.thumbnail}
            />
          ) : (
            <View style={[styles.thumbnailPlaceholder, { backgroundColor: scenery.gradient[0] }]}>
              <Text style={styles.thumbnailPlaceholderEmoji}>{scenery.emoji}</Text>
            </View>
          )}

          {/* Bet badge */}
          <View style={[
            styles.betBadge,
            { backgroundColor: game.bet_amount > 0 ? colors.gold : colors.success }
          ]}>
            <Text style={styles.betBadgeText}>
              {game.bet_amount > 0 ? `💰 ${game.bet_amount} BL` : 'FREE'}
            </Text>
          </View>

          {/* Hover overlay effect */}
          <View style={styles.hoverOverlay}>
            <Text style={styles.hoverText}>👁️ View</Text>
          </View>
        </View>

        {/* Info */}
        <View style={styles.gameCardInfo}>
          <Text style={[styles.creatorName, { color: colors.text }]} numberOfLines={1}>
            {game.creator_username || 'Player'}
          </Text>
          <View style={styles.gameCardRow}>
            <Text style={[styles.totalValue, { color: colors.gold }]}>
              {formatDollarValue(game.total_dollar_value)}
            </Text>
            <Text style={[styles.timeAgo, { color: colors.textMuted }]}>
              {timeAgo(game.created_at)}
            </Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ============== MAIN SCREEN ==============
export default function OpenGamesBrowserScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);

  // Fetch open games
  const fetchGames = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = searchQuery ? { search: searchQuery } : {};
      const data = await photoGameAPI.getOpenGames(params);
      setGames(data.games || []);
    } catch (err) {
      console.error('Failed to load open games:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchGames();

    // Poll for new games every 15 seconds
    const interval = setInterval(() => fetchGames(false), 15000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  const handleSearch = () => {
    HapticFeedback.light();
    fetchGames();
  };

  const handleRefresh = () => {
    HapticFeedback.light();
    fetchGames(true);
  };

  const handleGamePress = (game) => {
    setSelectedGame(game);
  };

  const handleJoinGame = (game) => {
    setSelectedGame(null);
    // Navigate to photo game arena with the game to join
    navigation.navigate('PhotoGameArena', { joinGame: game });
  };

  const handleCreateGame = () => {
    HapticFeedback.heavy();
    navigation.navigate('PhotoGameArena', { mode: 'create' });
  };

  const renderGameCard = ({ item, index }) => (
    <View style={[styles.cardWrapper, index % 2 === 0 ? { paddingRight: 6 } : { paddingLeft: 6 }]}>
      <GameCard game={item} onPress={handleGamePress} colors={colors} />
    </View>
  );

  const ListEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>👥</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Open Games</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        Be the first to create a battle!
      </Text>
    </View>
  );

  const ListHeaderComponent = () => (
    <View style={styles.listHeader}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInputWrapper, { backgroundColor: colors.cardSecondary, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by username or game ID..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: colors.primary }]}
          onPress={handleSearch}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Create game button */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={handleCreateGame}
        activeOpacity={0.9}
      >
        <Text style={styles.createButtonText}>⚡ Create New Game</Text>
        <Text style={styles.createButtonArrow}>→</Text>
      </TouchableOpacity>

      {/* Games count */}
      <View style={styles.gamesCountRow}>
        <Text style={[styles.gamesCount, { color: colors.textMuted }]}>
          {games.length} open game{games.length !== 1 ? 's' : ''} available
        </Text>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
          <Text style={{ color: colors.primary }}>
            {refreshing ? '⏳' : '🔄'} Refresh
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>👥 Open Games</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Join a battle or create your own</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Games list */}
      {loading && games.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading games...</Text>
        </View>
      ) : (
        <FlatList
          data={games}
          renderItem={renderGameCard}
          keyExtractor={(item) => item.game_id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={ListEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Preview modal */}
      <GamePreviewModal
        game={selectedGame}
        visible={!!selectedGame}
        onClose={() => setSelectedGame(null)}
        onJoin={handleJoinGame}
        colors={colors}
      />
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
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
    paddingBottom: 100,
  },
  listHeader: {
    marginBottom: 16,
  },
  // Search
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
  },
  searchButton: {
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Create button
  createButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  createButtonArrow: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  gamesCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gamesCount: {
    fontSize: 13,
  },
  // Card wrapper
  cardWrapper: {
    width: '50%',
    marginBottom: 12,
  },
  // Game card
  gameCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    aspectRatio: 1,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPlaceholderEmoji: {
    fontSize: 48,
    opacity: 0.5,
  },
  betBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  betBadgeText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 11,
  },
  hoverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  hoverText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  gameCardInfo: {
    padding: 12,
  },
  creatorName: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  gameCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalValue: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  timeAgo: {
    fontSize: 11,
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
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#fff',
  },
  modalBody: {
    padding: 16,
  },
  gameBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: {
    fontWeight: '600',
    fontSize: 12,
  },
  photosTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  // Flip card
  flipCardContainer: {
    width: (SCREEN_WIDTH - 72) / 3, // 3 columns in modal
    aspectRatio: 3 / 4,
    perspective: 1000,
  },
  flipCardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },
  flipCardFront: {},
  flipCardBack: {
    padding: 8,
  },
  flipCardImage: {
    width: '100%',
    height: '100%',
  },
  flipCardPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flipCardPlaceholderEmoji: {
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
  flipCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  flipCardName: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  flipCardValue: {
    color: '#EAB308',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tapHint: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tapHintBack: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  tapHintText: {
    color: '#9CA3AF',
    fontSize: 7,
  },
  streakBadge: {
    position: 'absolute',
    top: 20,
    right: 4,
    backgroundColor: '#F97316',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  streakBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  backTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  backStats: {
    gap: 4,
  },
  backStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backStatLabel: {
    fontSize: 8,
  },
  backStatValue: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  // Join button
  joinButton: {
    backgroundColor: '#22C55E',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
