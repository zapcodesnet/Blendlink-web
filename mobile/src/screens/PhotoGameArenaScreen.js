/**
 * Photo Game Arena Screen for Blendlink Mobile
 * PvP Photo Battles with Tapping Arena + RPS mechanics + Photo Selection
 * 
 * UPDATED: Full WebSocket integration for real-time PVP sync
 * - 30 TPS rate limit for Photo Auction Bidding rounds
 * - Ready button before countdown
 * - Server-authoritative timer synchronization
 * - Live opponent tap meter updates
 * - Bot Battle progression system with difficulty unlocks
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Animated,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Switch,
  FlatList,
  Vibration,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { photoGameAPI } from '../services/api';
import { usePVPWebSocket } from '../hooks/usePVPWebSocket';
import BotDifficultySelector from '../components/BotDifficultySelector';
import auctionSounds from '../utils/auctionSounds';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// ============== TAPPING ARENA CONSTANTS ==============
const BASE_TAPS_TO_WIN = 200;
const MAX_TAPS_PER_SECOND = 30; // 30 TPS rate limit - CRITICAL
const COUNTDOWN_SECONDS = 10;
const ROUND_DURATION_SECONDS = 15;

// RPS choices
const RPS_CHOICES = [
  { id: 'rock', emoji: '🪨', label: 'Rock', beats: 'scissors' },
  { id: 'paper', emoji: '📄', label: 'Paper', beats: 'rock' },
  { id: 'scissors', emoji: '✂️', label: 'Scissors', beats: 'paper' },
];

// Scenery config
const SCENERY_CONFIG = {
  natural: { gradient: ['#22C55E', '#10B981'], emoji: '🌿', label: 'Natural', strong: 'water', weak: 'manmade' },
  water: { gradient: ['#3B82F6', '#06B6D4'], emoji: '🌊', label: 'Water', strong: 'manmade', weak: 'natural' },
  manmade: { gradient: ['#F97316', '#EF4444'], emoji: '🏙️', label: 'Man-made', strong: 'natural', weak: 'water' },
};

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
};

// Calculate required taps based on power difference
const calculateRequiredTaps = (playerValue, opponentValue, baseTaps = BASE_TAPS_TO_WIN) => {
  const totalPower = playerValue + opponentValue;
  if (totalPower === 0) return baseTaps;
  const playerRatio = playerValue / totalPower;
  const requiredTaps = Math.round(baseTaps * (1.5 - playerRatio));
  return Math.max(50, Math.min(400, requiredTaps));
};

// ============== COMPONENTS ==============

// Stamina Bar Component
const StaminaBar = ({ stamina, maxStamina = 100, colors, showLabel = true }) => {
  const percent = (stamina / maxStamina) * 100;
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: percent,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  return (
    <View style={styles.staminaContainer}>
      <Text style={styles.staminaIcon}>⚡</Text>
      <View style={[styles.staminaBarBg, { backgroundColor: colors.cardSecondary }]}>
        <Animated.View
          style={[
            styles.staminaBarFill,
            {
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: percent > 20 ? colors.gold : colors.error,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.staminaText, { color: colors.textMuted }]}>
          {Math.round(stamina)}/{maxStamina}
        </Text>
      )}
    </View>
  );
};

// Win Streak Badge
const WinStreakBadge = ({ streak, colors }) => {
  if (streak < 3) return null;
  
  const multiplier = streak >= 6 ? 2 : streak >= 5 ? 1.75 : streak >= 4 ? 1.5 : 1.25;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.winStreakBadge, { transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.winStreakIcon}>🏆</Text>
      <Text style={styles.winStreakText}>{streak} Win Streak! ({multiplier}x)</Text>
    </Animated.View>
  );
};

// ============== ROUND TRANSITION COMPONENT ==============
const RoundTransitionView = ({ 
  roundResult, 
  currentRound, 
  player1Wins, 
  player2Wins, 
  isWinner, 
  onContinue, 
  colors 
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();
  }, []);

  const totalRoundsToWin = 3;
  const nextRound = currentRound + 1;

  return (
    <Animated.View 
      style={[
        styles.roundTransitionContainer, 
        { 
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        }
      ]}
    >
      {/* Result Emoji with Pulse */}
      <Text style={styles.roundTransitionEmoji}>
        {isWinner ? '🎉' : '😔'}
      </Text>

      {/* Round Result Title */}
      <Text style={[styles.roundTransitionTitle, { 
        color: isWinner ? colors.success : colors.error 
      }]}>
        {isWinner ? 'Round Won!' : 'Round Lost'}
      </Text>

      {/* Score Display */}
      <View style={styles.roundTransitionScoreContainer}>
        <View style={[styles.scoreCircle, { 
          backgroundColor: player1Wins > player2Wins ? colors.success : colors.cardSecondary 
        }]}>
          <Text style={styles.scoreCircleText}>{player1Wins}</Text>
        </View>
        <Text style={[styles.scoreSeparator, { color: colors.textMuted }]}>-</Text>
        <View style={[styles.scoreCircle, { 
          backgroundColor: player2Wins > player1Wins ? colors.error : colors.cardSecondary 
        }]}>
          <Text style={styles.scoreCircleText}>{player2Wins}</Text>
        </View>
      </View>

      {/* Progress to next round */}
      <Text style={[styles.roundTransitionSubtitle, { color: colors.textMuted }]}>
        {player1Wins >= totalRoundsToWin || player2Wins >= totalRoundsToWin
          ? 'Game Over!'
          : `Preparing Round ${nextRound}...`}
      </Text>

      {/* Auto-transition progress bar */}
      <View style={[styles.transitionProgressBg, { backgroundColor: colors.cardSecondary }]}>
        <Animated.View 
          style={[
            styles.transitionProgressFill, 
            { 
              backgroundColor: colors.primary,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }
          ]} 
        />
      </View>

      {/* Next round info */}
      <View style={[styles.nextRoundInfo, { backgroundColor: colors.cardSecondary }]}>
        <Text style={[styles.nextRoundInfoText, { color: colors.text }]}>
          📷 Select a new photo for Round {nextRound}
        </Text>
        <Text style={[styles.nextRoundInfoHint, { color: colors.textMuted }]}>
          Previously used photos cannot be selected again
        </Text>
      </View>
    </Animated.View>
  );
};

// ============== PHOTO SELECTION COMPONENT ==============
const PhotoSelectionView = ({ 
  photos, 
  loading, 
  selectedPhotoId, 
  onSelectPhoto, 
  colors,
  usedPhotoIds = [],  // NEW: Photos used in previous rounds
  opponentHasSelected = false,  // NEW: Whether opponent has selected
  showOpponentStatus = false,  // NEW: Whether to show opponent selection status
}) => {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading your photos...</Text>
      </View>
    );
  }

  if (!photos || photos.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.emptyIcon}>📷</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Minted Photos</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Mint some photos first to enter battles!
        </Text>
      </View>
    );
  }

  // Filter photos: exclude used photos from available
  const isPhotoUsed = (photo) => usedPhotoIds.includes(photo.mint_id);
  const availablePhotos = photos.filter(p => p.is_available && !isPhotoUsed(p));
  const unavailablePhotos = photos.filter(p => !p.is_available || isPhotoUsed(p));

  const renderPhotoItem = ({ item: photo, isAvailable, isUsed = false }) => {
    const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
    const isSelected = selectedPhotoId === photo.mint_id;
    const canSelect = isAvailable && !isUsed;

    return (
      <TouchableOpacity
        onPress={() => canSelect && onSelectPhoto(photo)}
        activeOpacity={canSelect ? 0.7 : 1}
        disabled={!canSelect}
        style={[
          styles.photoItem,
          {
            backgroundColor: isSelected ? colors.primary + '20' : colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
            opacity: canSelect ? 1 : 0.5,
          },
        ]}
      >
        {/* Used Badge Overlay */}
        {isUsed && (
          <View style={styles.usedBadgeOverlay}>
            <View style={[styles.usedBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.usedBadgeText}>USED</Text>
            </View>
          </View>
        )}
        
        {/* Thumbnail */}
        <View style={[styles.photoThumbnail, { backgroundColor: scenery.gradient[0] }]}>
          <Text style={styles.photoThumbnailEmoji}>{scenery.emoji}</Text>
        </View>

        {/* Info */}
        <View style={styles.photoInfo}>
          <View style={styles.photoNameRow}>
            <Text style={[styles.photoName, { color: colors.text }]} numberOfLines={1}>
              {photo.name}
            </Text>
            <View style={[styles.sceneryBadge, { backgroundColor: scenery.gradient[0] }]}>
              <Text style={styles.sceneryBadgeText}>{scenery.label}</Text>
            </View>
          </View>

          <View style={styles.photoStatsRow}>
            <Text style={[styles.photoValue, { color: colors.gold }]}>
              {formatDollarValue(photo.dollar_value)}
            </Text>
            <Text style={[styles.photoStrength, { color: colors.textMuted }]}>
              💪 vs {SCENERY_CONFIG[photo.strength_vs]?.label || 'Unknown'}
            </Text>
          </View>

          {/* Stamina */}
          {isAvailable && !isUsed ? (
            <View style={styles.photoStaminaRow}>
              <View style={styles.photoStaminaBar}>
                <View
                  style={[
                    styles.photoStaminaFill,
                    {
                      width: `${photo.stamina}%`,
                      backgroundColor: photo.stamina > 20 ? colors.gold : colors.error,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.photoStaminaText, { color: colors.textMuted }]}>
                {Math.round(photo.stamina)}% ({photo.battles_remaining} battles)
              </Text>
            </View>
          ) : (
            <Text style={[styles.photoRecoveryText, { color: colors.error }]}>
              ⏳ Available in ~{photo.time_until_available || 60} min
            </Text>
          )}
        </View>

        {/* Selection indicator */}
        {isAvailable && (
          <View
            style={[
              styles.selectionIndicator,
              {
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? colors.primary : 'transparent',
              },
            ]}
          >
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.photoSelectionContainer}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Your Battle Photo</Text>
      <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
        {usedPhotoIds.length > 0 
          ? `Round ${usedPhotoIds.length + 1} - Choose a fresh photo!`
          : 'Sorted by Dollar Value (Power). Higher = Stronger!'}
      </Text>

      {/* Opponent Selection Status */}
      {showOpponentStatus && (
        <View style={[styles.opponentSelectionStatus, { 
          backgroundColor: opponentHasSelected ? colors.success + '20' : colors.cardSecondary 
        }]}>
          <Text style={[styles.opponentStatusText, { 
            color: opponentHasSelected ? colors.success : colors.textMuted 
          }]}>
            {opponentHasSelected ? '✓ Opponent has selected their photo' : '⏳ Waiting for opponent to select...'}
          </Text>
        </View>
      )}

      {/* Available Photos */}
      {availablePhotos.length > 0 && (
        <View style={styles.photoSection}>
          <Text style={[styles.photoSectionTitle, { color: colors.success }]}>
            ✅ Available ({availablePhotos.length})
          </Text>
          {availablePhotos.map((photo) => (
            <View key={photo.mint_id}>
              {renderPhotoItem({ item: photo, isAvailable: true, isUsed: false })}
            </View>
          ))}
        </View>
      )}

      {/* Used Photos (from previous rounds) */}
      {usedPhotoIds.length > 0 && (
        <View style={styles.photoSection}>
          <Text style={[styles.photoSectionTitle, { color: colors.error }]}>
            🚫 Used This Game ({photos.filter(p => isPhotoUsed(p)).length})
          </Text>
          {photos.filter(p => isPhotoUsed(p)).map((photo) => (
            <View key={photo.mint_id}>
              {renderPhotoItem({ item: photo, isAvailable: false, isUsed: true })}
            </View>
          ))}
        </View>
      )}

      {/* Resting Photos (low stamina) */}
      {unavailablePhotos.filter(p => !isPhotoUsed(p)).length > 0 && (
        <View style={styles.photoSection}>
          <Text style={[styles.photoSectionTitle, { color: colors.textMuted }]}>
            ⏳ Resting ({unavailablePhotos.filter(p => !isPhotoUsed(p)).length})
          </Text>
          {unavailablePhotos.filter(p => !isPhotoUsed(p)).map((photo) => (
            <View key={photo.mint_id}>
              {renderPhotoItem({ item: photo, isAvailable: false, isUsed: false })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

// RPS Choice Button
const RPSChoiceButton = ({ choice, onPress, selected, disabled, colors }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    auctionSounds.selectionConfirm();
    onPress(choice.id);
  };

  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled} activeOpacity={0.8}>
      <Animated.View
        style={[
          styles.rpsButton,
          { 
            backgroundColor: selected ? colors.primary : colors.card,
            borderColor: selected ? colors.primary : colors.border,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.rpsEmoji}>{choice.emoji}</Text>
        <Text style={[styles.rpsLabel, { color: selected ? '#fff' : colors.textMuted }]}>
          {choice.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Photo Card for Battle
const PhotoCard = ({ photo, isPlayer, effectiveValue, isAnimating, colors }) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isAnimating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: isPlayer ? 20 : -20, duration: 200, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      shakeAnim.setValue(0);
    }
  }, [isAnimating]);

  return (
    <Animated.View
      style={[
        styles.photoCard,
        {
          borderColor: isPlayer ? colors.primary : colors.error,
          transform: [{ translateX: shakeAnim }],
        },
      ]}
    >
      <View style={[styles.photoCardImage, { backgroundColor: scenery.gradient[0] }]}>
        <Text style={styles.photoCardEmoji}>{scenery.emoji}</Text>
      </View>
      
      <View style={[styles.photoCardBadge, { backgroundColor: scenery.gradient[0] }]}>
        <Text style={styles.photoCardBadgeText}>{scenery.label}</Text>
      </View>
      
      <View style={[styles.photoCardInfo, { backgroundColor: colors.card }]}>
        <Text style={[styles.photoCardName, { color: colors.text }]} numberOfLines={1}>
          {photo?.name || 'Photo'}
        </Text>
        <Text style={[styles.photoCardValue, { color: colors.gold }]}>
          {formatDollarValue(photo?.dollar_value)}
        </Text>
        {effectiveValue && effectiveValue !== photo?.dollar_value && (
          <Text style={[styles.photoCardEffective, { color: colors.success }]}>
            Effective: {formatDollarValue(effectiveValue)}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

// ============== MATCHMAKING VIEW ==============
const MatchmakingView = ({ onMatchFound, onCancel, onPracticeStart, selectedPhoto, onPhotoSelect, colors }) => {
  const [status, setStatus] = useState('photo_select');
  const [betAmount, setBetAmount] = useState('0');
  const [useBotFallback, setUseBotFallback] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [queueStatus, setQueueStatus] = useState(null);
  const [battlePhotos, setBattlePhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [error, setError] = useState(null);
  const [showBotSelector, setShowBotSelector] = useState(false);
  const [botWinStats, setBotWinStats] = useState({});
  const [userBalance, setUserBalance] = useState(0);
  
  const intervalRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchBattlePhotos();
    fetchQueueStatus();
    fetchBotStats();
    const interval = setInterval(fetchQueueStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status === 'searching') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 750, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

  const fetchBattlePhotos = async () => {
    try {
      setLoadingPhotos(true);
      const [photosData, userProfile] = await Promise.all([
        photoGameAPI.getBattlePhotos(),
        photoGameAPI.getUserProfile().catch(() => ({})),
      ]);
      setBattlePhotos(photosData.photos || []);
      setUserBalance(userProfile?.bl_coins || 0);
    } catch (err) {
      console.error('Failed to fetch battle photos:', err);
      setError('Failed to load your photos');
    } finally {
      setLoadingPhotos(false);
    }
  };

  const fetchBotStats = async () => {
    try {
      const stats = await photoGameAPI.getBotBattleStats();
      setBotWinStats(stats || {});
    } catch (err) {
      console.error('Failed to fetch bot stats:', err);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      const data = await photoGameAPI.getQueueStatus();
      setQueueStatus(data);
    } catch (err) {
      console.error('Failed to fetch queue status:', err);
    }
  };

  // Start Practice Mode - instant bot battle, no BL bet, no stamina loss
  const startPracticeMode = async () => {
    if (!selectedPhoto) {
      setError('Please select a photo first!');
      return;
    }

    setError(null);
    try {
      auctionSounds.paddleRaise();
      
      const response = await photoGameAPI.startGame({
        opponent_id: 'bot',
        bet_amount: 0,
        photo_id: selectedPhoto.mint_id,
        practice_mode: true,
      });
      
      if (response.success) {
        auctionSounds.matchFound();
        onPracticeStart?.(response);
      } else {
        setError(response.error || 'Failed to start practice');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start practice mode');
    }
  };

  const startMatchmaking = async () => {
    if (!selectedPhoto) {
      setError('Please select a photo first!');
      return;
    }

    setError(null);
    try {
      setStatus('searching');
      setElapsed(0);
      auctionSounds.paddleRaise();
      
      const response = await photoGameAPI.findMatch({
        bet_amount: parseInt(betAmount) || 0,
        photo_id: selectedPhoto.mint_id,
        use_bot_fallback: useBotFallback,
      });
      
      if (response.status === 'matched' || response.status === 'in_match') {
        setStatus('matched');
        auctionSounds.matchFound();
        onMatchFound?.(response);
      } else if (response.status === 'searching' || response.status === 'already_searching') {
        intervalRef.current = setInterval(async () => {
          try {
            const statusRes = await photoGameAPI.checkMatchStatus();
            setElapsed(statusRes.elapsed_seconds || 0);
            auctionSounds.tick();
            
            if (statusRes.status === 'matched') {
              clearInterval(intervalRef.current);
              setStatus('matched');
              auctionSounds.matchFound();
              onMatchFound?.(statusRes);
            } else if (statusRes.status === 'not_searching' || statusRes.status === 'not_in_queue') {
              clearInterval(intervalRef.current);
              setStatus('photo_select');
              setError('Matchmaking expired. Please try again.');
            }
          } catch (err) {
            console.error('Match status check failed:', err);
          }
        }, 800);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start matchmaking');
      setStatus('photo_select');
    }
  };

  const cancelMatchmaking = async () => {
    clearInterval(intervalRef.current);
    try {
      const response = await photoGameAPI.cancelMatchmaking();
      if (response.bet_refunded) {
        setError(`Bet refunded: ${response.bet_refunded} BL`);
      }
    } catch (err) {
      console.error('Cancel failed:', err);
    }
    setStatus('photo_select');
    onCancel?.();
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (status === 'searching') {
    return (
      <View style={styles.matchmakingSearching}>
        <Animated.View
          style={[
            styles.searchingCircle,
            { backgroundColor: colors.primary + '30', transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Text style={styles.searchingIcon}>👥</Text>
        </Animated.View>
        
        <Text style={[styles.searchingTitle, { color: colors.text }]}>
          Searching for Opponent...
        </Text>
        <Text style={[styles.searchingSubtitle, { color: colors.textMuted }]}>
          {Math.round(elapsed)}s / 30s
          {useBotFallback && ' (Bot match after timeout)'}
        </Text>
        
        {selectedPhoto && (
          <Text style={[styles.searchingPhoto, { color: colors.primary }]}>
            Fighting with: {selectedPhoto.name} ({formatDollarValue(selectedPhoto.dollar_value)})
          </Text>
        )}
        
        <View style={[styles.searchingProgressBg, { backgroundColor: colors.cardSecondary }]}>
          <View
            style={[
              styles.searchingProgressFill,
              { width: `${(elapsed / 30) * 100}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
        
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.border }]}
          onPress={cancelMatchmaking}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>✕ Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.matchmakingIdle} showsVerticalScrollIndicator={false}>
      {/* Photo Selection */}
      <View style={[styles.matchmakingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <PhotoSelectionView
          photos={battlePhotos}
          loading={loadingPhotos}
          selectedPhotoId={selectedPhoto?.mint_id}
          onSelectPhoto={onPhotoSelect}
          colors={colors}
        />
      </View>

      {error && selectedPhoto && (
        <View style={[styles.matchmakingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}
      
      {/* Auction Bidding Battle with Bot Button */}
      <TouchableOpacity
        style={[styles.auctionBattleButton, { opacity: battlePhotos.length > 0 ? 1 : 0.5 }]}
        onPress={() => {
          if (battlePhotos.length > 0) {
            setShowBotSelector(true);
          } else {
            Alert.alert('No Photos', 'You need at least 5 minted photos to start a bot battle.');
          }
        }}
        activeOpacity={0.8}
        disabled={battlePhotos.length === 0}
      >
        <Text style={styles.auctionBattleButtonText}>Auction Bidding Battle with Bot</Text>
      </TouchableOpacity>

      {/* Bot Difficulty Selector Modal */}
      <BotDifficultySelector
        visible={showBotSelector}
        onClose={() => setShowBotSelector(false)}
        onStart={async (battleConfig) => {
          setShowBotSelector(false);
          try {
            // Call backend to start bot battle
            const response = await photoGameAPI.startBotBattle({
              difficulty: battleConfig.difficulty,
              photo_ids: battleConfig.photos.map(p => p.mint_id),
            });
            
            if (response.success) {
              auctionSounds.matchFound();
              onPracticeStart?.({
                success: true,
                session: { session_id: response.session_id },
                playerPhotos: battleConfig.photos,
                opponentPhotos: response.bot_photos,
                betAmount: response.bet_amount,
                isBot: true,
                botDifficulty: battleConfig.difficulty,
                botConfig: response.bot_config,
              });
            }
          } catch (err) {
            Alert.alert('Error', err.response?.data?.detail || 'Failed to start bot battle');
          }
        }}
        photos={battlePhotos}
        userBalance={userBalance}
        botWinStats={botWinStats}
        colors={colors}
      />

      <View style={{ height: 100 }} />
    </ScrollView>
  );
};

// ============== RPS BATTLE VIEW ==============
const RPSBattleView = ({ session, onChoice, isTiebreaker, colors }) => {
  const [playerChoice, setPlayerChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChoice = async (choice) => {
    if (isSubmitting || playerChoice) return;
    
    setIsSubmitting(true);
    setPlayerChoice(choice);
    auctionSounds.bidPlaced();
    
    try {
      const result = await onChoice(choice);
      
      if (result?.round) {
        setOpponentChoice(result.round.player2_choice);
        const isWin = result.round.winner === 'player1';
        const isLose = result.round.winner === 'player2';
        setRoundResult(isWin ? 'win' : isLose ? 'lose' : 'tie');
        setScore({ player: result.player1_wins, opponent: result.player2_wins });
        
        // Play appropriate sound
        if (isWin) {
          auctionSounds.roundWin();
        } else if (isLose) {
          auctionSounds.roundLose();
        }
        
        setTimeout(() => {
          setPlayerChoice(null);
          setOpponentChoice(null);
          setRoundResult(null);
          setIsSubmitting(false);
        }, 1500);
      }
    } catch (err) {
      console.error('RPS choice failed:', err);
      setPlayerChoice(null);
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.rpsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {isTiebreaker && (
        <View style={styles.tiebreakerBadge}>
          <Text style={styles.tiebreakerText}>⚡ TIEBREAKER ROUND</Text>
        </View>
      )}
      
      <Text style={[styles.rpsTitle, { color: colors.text }]}>Rock Paper Scissors</Text>
      <Text style={[styles.rpsSubtitle, { color: colors.textMuted }]}>First to 3 wins!</Text>
      
      {/* Score Display */}
      <View style={styles.scoreContainer}>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>You</Text>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>{score.player}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Need</Text>
          <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>3</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Opponent</Text>
          <Text style={[styles.scoreValue, { color: colors.error }]}>{score.opponent}</Text>
        </View>
      </View>
      
      {/* RPS Choices */}
      <View style={styles.rpsChoicesRow}>
        {RPS_CHOICES.map((choice) => (
          <RPSChoiceButton
            key={choice.id}
            choice={choice}
            onPress={handleChoice}
            selected={playerChoice === choice.id}
            disabled={isSubmitting}
            colors={colors}
          />
        ))}
      </View>
      
      {/* Battle Result */}
      {playerChoice && opponentChoice && (
        <View style={styles.battleResultContainer}>
          <View style={styles.battleResultRow}>
            <View style={styles.battleResultPlayer}>
              <Text style={[styles.battleResultLabel, { color: colors.textMuted }]}>You</Text>
              <Text style={styles.battleResultEmoji}>
                {RPS_CHOICES.find(c => c.id === playerChoice)?.emoji}
              </Text>
            </View>
            
            <Text style={styles.battleVS}>VS</Text>
            
            <View style={styles.battleResultPlayer}>
              <Text style={[styles.battleResultLabel, { color: colors.textMuted }]}>Opponent</Text>
              <Text style={styles.battleResultEmoji}>
                {RPS_CHOICES.find(c => c.id === opponentChoice)?.emoji}
              </Text>
            </View>
          </View>
          
          <Text
            style={[
              styles.roundResultText,
              { color: roundResult === 'win' ? colors.success : roundResult === 'lose' ? colors.error : colors.gold },
            ]}
          >
            {roundResult === 'win' ? '🎉 You Win!' : roundResult === 'lose' ? '😢 You Lose!' : '🤝 Tie!'}
          </Text>
        </View>
      )}
    </View>
  );
};

// ============== TAPPING ARENA VIEW (30 TPS) WITH WEBSOCKET ==============
const TappingArenaView = ({ 
  playerPhoto, 
  opponentPhoto, 
  isBot = false, 
  botDifficulty = 'medium',
  onRoundComplete, 
  roundNumber = 1,
  colors,
  // WebSocket props for real-time PVP
  wsGamePhase,       // Phase from WebSocket: 'ready', 'countdown', 'playing'
  wsCountdown,       // Server countdown value
  wsOpponentTaps,    // Opponent taps from WebSocket
  wsPlayerReady,     // Whether we're marked ready
  wsOpponentReady,   // Whether opponent is ready
  onSendTap,         // Function to send tap via WebSocket
  onMarkReady,       // Function to mark ready via WebSocket
  isWebSocketMode = false,  // Whether using WebSocket for sync
}) => {
  // Game state - use WebSocket state if available, otherwise local state
  const [localGamePhase, setLocalGamePhase] = useState('waiting'); // waiting, countdown, active, finished
  const [localCountdown, setLocalCountdown] = useState(COUNTDOWN_SECONDS);
  const [timeRemaining, setTimeRemaining] = useState(ROUND_DURATION_SECONDS);
  
  // Use WebSocket values when in WebSocket mode
  const gamePhase = isWebSocketMode 
    ? (wsGamePhase === 'playing' ? 'active' : wsGamePhase === 'countdown' ? 'countdown' : wsGamePhase) 
    : localGamePhase;
  const countdown = isWebSocketMode ? (wsCountdown || COUNTDOWN_SECONDS) : localCountdown;
  
  // Tap tracking
  const [playerTaps, setPlayerTaps] = useState(0);
  const [localOpponentTaps, setLocalOpponentTaps] = useState(0);
  const [tapsThisSecond, setTapsThisSecond] = useState(0);
  
  // Use WebSocket opponent taps if available
  const opponentTaps = isWebSocketMode ? (wsOpponentTaps || 0) : localOpponentTaps;
  
  // Warning state
  const [showRateWarning, setShowRateWarning] = useState(false);
  const lastWarningTime = useRef(0);
  
  // Result state
  const [winner, setWinner] = useState(null);
  
  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const confettiAnims = useRef(
    Array.from({ length: 20 }).map(() => ({
      y: new Animated.Value(-50),
      x: new Animated.Value(Math.random() * width),
    }))
  ).current;
  
  // Timers
  const gameTimerRef = useRef(null);
  const botTimerRef = useRef(null);
  const tapResetRef = useRef(null);
  
  // Calculate values
  const playerValue = playerPhoto?.dollar_value || 0;
  const opponentValue = opponentPhoto?.dollar_value || 0;
  const playerRequiredTaps = calculateRequiredTaps(playerValue, opponentValue);
  const opponentRequiredTaps = calculateRequiredTaps(opponentValue, playerValue);
  
  // Progress
  const playerProgress = Math.min((playerTaps / playerRequiredTaps) * 100, 100);
  const opponentProgress = Math.min((opponentTaps / opponentRequiredTaps) * 100, 100);
  
  // Scenery
  const playerScenery = SCENERY_CONFIG[playerPhoto?.scenery_type] || SCENERY_CONFIG.natural;
  const opponentScenery = SCENERY_CONFIG[opponentPhoto?.scenery_type] || SCENERY_CONFIG.natural;

  // Handle tap - 30 TPS rate limit
  const handleTap = useCallback(() => {
    // Use local phase for WebSocket mode as it should be 'active' when playing
    const currentPhase = isWebSocketMode ? (wsGamePhase === 'playing' ? 'active' : wsGamePhase) : localGamePhase;
    if (currentPhase !== 'active' || winner) return;
    
    // Anti-cheat: Max 30 taps per second
    if (tapsThisSecond >= MAX_TAPS_PER_SECOND) {
      const now = Date.now();
      if (now - lastWarningTime.current > 1000) {
        setShowRateWarning(true);
        lastWarningTime.current = now;
        setTimeout(() => setShowRateWarning(false), 1500);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      // Discard excess taps
      return;
    }
    
    // Valid tap
    const newTaps = playerTaps + 1;
    setPlayerTaps(newTaps);
    setTapsThisSecond(prev => prev + 1);
    
    // Send tap via WebSocket if in WebSocket mode
    if (isWebSocketMode && onSendTap) {
      onSendTap(1);
    }
    
    // Haptic feedback for every valid tap
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Pulse animation
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.02, duration: 30, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 30, useNativeDriver: true }),
    ]).start();
    
    // Check win (only in bot mode - WebSocket mode uses server result)
    if (!isWebSocketMode && newTaps >= playerRequiredTaps) {
      handlePlayerWin();
    }
  }, [localGamePhase, wsGamePhase, isWebSocketMode, winner, playerTaps, playerRequiredTaps, tapsThisSecond, onSendTap]);

  // Handle player win
  const handlePlayerWin = useCallback(() => {
    if (winner) return;
    setLocalGamePhase('finished');
    setWinner('player');
    
    // Confetti animation
    confettiAnims.forEach((anim, i) => {
      anim.y.setValue(-50);
      Animated.timing(anim.y, {
        toValue: 800,
        duration: 2000 + Math.random() * 1000,
        delay: i * 50,
        useNativeDriver: true,
      }).start();
    });
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Vibration.vibrate([100, 50, 100, 50, 200]);
    auctionSounds.roundWin();
    
    clearInterval(gameTimerRef.current);
    clearInterval(botTimerRef.current);
    
    setTimeout(() => onRoundComplete?.('player'), 2500);
  }, [winner, onRoundComplete]);

  // Handle opponent win
  const handleOpponentWin = useCallback(() => {
    if (winner) return;
    setLocalGamePhase('finished');
    setWinner('opponent');
    
    // Screen shake
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 15, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -15, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([200, 100, 200]);
    auctionSounds.roundLose();
    
    clearInterval(gameTimerRef.current);
    clearInterval(botTimerRef.current);
    
    setTimeout(() => onRoundComplete?.('opponent'), 2500);
  }, [winner, onRoundComplete]);

  // Reset taps counter every second (works in both modes)
  useEffect(() => {
    const currentPhase = isWebSocketMode ? (wsGamePhase === 'playing' ? 'active' : wsGamePhase) : localGamePhase;
    if (currentPhase === 'active') {
      tapResetRef.current = setInterval(() => setTapsThisSecond(0), 1000);
    }
    return () => clearInterval(tapResetRef.current);
  }, [localGamePhase, wsGamePhase, isWebSocketMode]);

  // Auto-start countdown (BOT MODE ONLY)
  useEffect(() => {
    if (!isWebSocketMode && localGamePhase === 'waiting') {
      const timeout = setTimeout(() => setLocalGamePhase('countdown'), 500);
      return () => clearTimeout(timeout);
    }
  }, [localGamePhase, isWebSocketMode]);

  // Countdown timer (BOT MODE ONLY - WebSocket mode uses server time)
  useEffect(() => {
    if (!isWebSocketMode && localGamePhase === 'countdown') {
      const timer = setInterval(() => {
        setLocalCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setLocalGamePhase('active');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            return 0;
          }
          Haptics.selectionAsync();
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [localGamePhase, isWebSocketMode]);

  // Game timer (BOT MODE ONLY - WebSocket mode uses server result)
  useEffect(() => {
    if (!isWebSocketMode && localGamePhase === 'active') {
      gameTimerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(gameTimerRef.current);
            const pProgress = playerTaps / playerRequiredTaps;
            const oProgress = localOpponentTaps / opponentRequiredTaps;
            if (pProgress >= oProgress) handlePlayerWin();
            else handleOpponentWin();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(gameTimerRef.current);
    }
  }, [localGamePhase, isWebSocketMode, playerTaps, localOpponentTaps, playerRequiredTaps, opponentRequiredTaps]);

  // Bot tapping - 30 TPS max (BOT MODE ONLY)
  useEffect(() => {
    if (!isWebSocketMode && localGamePhase === 'active' && isBot) {
      const botSpeeds = {
        easy: { min: 5, max: 10 },
        medium: { min: 10, max: 18 },
        hard: { min: 18, max: 28 },
      };
      const speed = botSpeeds[botDifficulty] || botSpeeds.medium;
      
      botTimerRef.current = setInterval(() => {
        setLocalOpponentTaps(prev => {
          const tapsToAdd = Math.floor(Math.random() * (speed.max - speed.min + 1)) + speed.min;
          const newTaps = prev + tapsToAdd;
          if (newTaps >= opponentRequiredTaps && !winner) handleOpponentWin();
          return newTaps;
        });
      }, 1000);
      return () => clearInterval(botTimerRef.current);
    }
  }, [localGamePhase, isWebSocketMode, isBot, botDifficulty, opponentRequiredTaps, winner]);

  // Determine effective game phase for UI
  const effectiveGamePhase = isWebSocketMode 
    ? (wsGamePhase === 'playing' ? 'active' : wsGamePhase === 'countdown' ? 'countdown' : wsGamePhase)
    : localGamePhase;

  return (
    <Animated.View style={[styles.tappingArenaContainer, { transform: [{ translateX: shakeAnim }] }]}>
      {/* Rate Warning Toast */}
      {showRateWarning && (
        <View style={styles.rateWarningToast}>
          <Text style={styles.rateWarningText}>⚠️ Tap rate exceeded! Slow down.</Text>
        </View>
      )}
      
      {/* Confetti */}
      {winner === 'player' && confettiAnims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.confettiPiece,
            {
              backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'][i % 4],
              transform: [{ translateX: anim.x }, { translateY: anim.y }],
            },
          ]}
        />
      ))}

      {/* Header */}
      <View style={[styles.tappingHeader, { backgroundColor: colors.card }]}>
        <View>
          <Text style={[styles.tappingRoundLabel, { color: colors.primary }]}>Round {roundNumber}</Text>
          <Text style={[styles.tappingRoundType, { color: colors.textMuted }]}>Photo Auction Bidding</Text>
        </View>
        <View style={[styles.tappingTimerBadge, { backgroundColor: timeRemaining <= 5 ? colors.error : colors.gold }]}>
          <Text style={styles.tappingTimerText}>⏱️ {timeRemaining}s</Text>
        </View>
      </View>

      {/* Photo Cards */}
      <View style={styles.tappingPhotosRow}>
        {/* Player */}
        <View style={[styles.tappingPhotoCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <View style={[styles.tappingPhotoPlaceholder, { backgroundColor: playerScenery.gradient[0] }]}>
            <Text style={styles.tappingPhotoEmoji}>{playerScenery.emoji}</Text>
          </View>
          <Text style={[styles.tappingPhotoLabel, { color: colors.text }]} numberOfLines={1}>
            {playerPhoto?.name || 'Your Photo'}
          </Text>
          <Text style={[styles.tappingPhotoValue, { color: colors.gold }]}>
            {formatDollarValue(playerValue)}
          </Text>
          <View style={[styles.tappingProgressBg, { backgroundColor: colors.cardSecondary }]}>
            <View style={[styles.tappingProgressFill, { width: `${playerProgress}%`, backgroundColor: colors.primary }]} />
          </View>
          <Text style={[styles.tappingTapCount, { color: colors.textMuted }]}>
            {playerTaps}/{playerRequiredTaps}
          </Text>
          {/* Ready indicator for WebSocket mode */}
          {isWebSocketMode && effectiveGamePhase === 'ready' && (
            <View style={[styles.readyIndicator, { backgroundColor: wsPlayerReady ? colors.success : colors.cardSecondary }]}>
              <Text style={styles.readyIndicatorText}>{wsPlayerReady ? '✓ Ready' : 'Not Ready'}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.tappingVS, { color: colors.textMuted }]}>VS</Text>

        {/* Opponent */}
        <View style={[styles.tappingPhotoCard, { backgroundColor: colors.card, borderColor: colors.error }]}>
          <View style={[styles.tappingPhotoPlaceholder, { backgroundColor: opponentScenery.gradient[0] }]}>
            <Text style={styles.tappingPhotoEmoji}>{opponentScenery.emoji}</Text>
          </View>
          <Text style={[styles.tappingPhotoLabel, { color: colors.text }]} numberOfLines={1}>
            {opponentPhoto?.name || 'Opponent'}
          </Text>
          <Text style={[styles.tappingPhotoValue, { color: colors.gold }]}>
            {formatDollarValue(opponentValue)}
          </Text>
          <View style={[styles.tappingProgressBg, { backgroundColor: colors.cardSecondary }]}>
            <View style={[styles.tappingProgressFill, { width: `${opponentProgress}%`, backgroundColor: colors.error }]} />
          </View>
          <Text style={[styles.tappingTapCount, { color: colors.textMuted }]}>
            {opponentTaps}/{opponentRequiredTaps}
          </Text>
          {/* Opponent ready indicator for WebSocket mode */}
          {isWebSocketMode && effectiveGamePhase === 'ready' && (
            <View style={[styles.readyIndicator, { backgroundColor: wsOpponentReady ? colors.success : colors.cardSecondary }]}>
              <Text style={styles.readyIndicatorText}>{wsOpponentReady ? '✓ Ready' : 'Waiting...'}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Ready Button Overlay (WebSocket mode only) */}
      {isWebSocketMode && effectiveGamePhase === 'ready' && !wsPlayerReady && (
        <View style={styles.readyButtonOverlay}>
          <Text style={styles.readyOverlayTitle}>Both photos selected!</Text>
          <Text style={styles.readyOverlaySubtitle}>Press Ready when you want to start</Text>
          <TouchableOpacity 
            style={[styles.readyButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              onMarkReady?.();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              auctionSounds.selectionConfirm();
            }}
          >
            <Text style={styles.readyButtonText}>✓ I'm Ready!</Text>
          </TouchableOpacity>
          <Text style={styles.readyOverlayHint}>
            {wsOpponentReady ? 'Opponent is ready! Press to start!' : 'Waiting for opponent...'}
          </Text>
        </View>
      )}

      {/* Waiting for opponent ready (WebSocket mode only) */}
      {isWebSocketMode && effectiveGamePhase === 'ready' && wsPlayerReady && !wsOpponentReady && (
        <View style={styles.readyButtonOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.readyOverlayTitle}>Waiting for opponent...</Text>
          <Text style={styles.readyOverlaySubtitle}>You're ready! Opponent is still preparing.</Text>
        </View>
      )}

      {/* Countdown Overlay */}
      {effectiveGamePhase === 'countdown' && (
        <View style={styles.tappingCountdownOverlay}>
          <Animated.Text style={[styles.tappingCountdownNumber, { transform: [{ scale: pulseAnim }] }]}>
            {countdown}
          </Animated.Text>
          <Text style={styles.tappingCountdownLabel}>Get Ready!</Text>
        </View>
      )}

      {/* Result Overlay */}
      {winner && (
        <View style={styles.tappingResultOverlay}>
          {winner === 'player' ? (
            <>
              <Text style={styles.tappingWinEmoji}>🎉</Text>
              <Text style={styles.tappingWinText}>YOU WIN!</Text>
            </>
          ) : (
            <>
              <Text style={styles.tappingLoseEmoji}>😔</Text>
              <Text style={styles.tappingLoseText}>YOU LOSE</Text>
            </>
          )}
        </View>
      )}

      {/* Tap Area */}
      <Pressable
        style={[
          styles.tappingTapArea,
          { backgroundColor: effectiveGamePhase === 'active' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(0, 0, 0, 0.3)' }
        ]}
        onPress={handleTap}
        disabled={effectiveGamePhase !== 'active' || winner !== null}
      >
        {effectiveGamePhase === 'active' && !winner && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }], alignItems: 'center' }}>
            <Text style={styles.tappingTapEmoji}>👆</Text>
            <Text style={styles.tappingTapText}>TAP TO BID!</Text>
            <Text style={styles.tappingTapSubtext}>{playerRequiredTaps - playerTaps} taps remaining</Text>
          </Animated.View>
        )}
        {effectiveGamePhase === 'waiting' && <Text style={styles.tappingWaitingText}>Preparing arena...</Text>}
        {effectiveGamePhase === 'selecting' && <Text style={styles.tappingWaitingText}>Selecting photos...</Text>}
      </Pressable>

      {/* TPS Debug Indicator */}
      <View style={[styles.tappingTPSIndicator, { backgroundColor: colors.cardSecondary }]}>
        <Text style={[styles.tappingTPSText, { color: tapsThisSecond >= 25 ? colors.error : colors.textMuted }]}>
          TPS: {tapsThisSecond}/{MAX_TAPS_PER_SECOND}
        </Text>
      </View>
    </Animated.View>
  );
};

// ============== PHOTO BATTLE VIEW (Legacy - value comparison) ==============
const PhotoBattleView = ({ session, onBattle, colors }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [result, setResult] = useState(null);

  const handleBattle = async () => {
    setIsAnimating(true);
    auctionSounds.paddleRaise();
    
    try {
      const battleResult = await onBattle();
      setTimeout(() => {
        setIsAnimating(false);
        setResult(battleResult?.battle_result);
        // Play sound based on result
        if (battleResult?.battle_result?.winner === 'player1') {
          auctionSounds.roundWin();
        } else {
          auctionSounds.roundLose();
        }
        auctionSounds.photoClash();
      }, 2000);
    } catch (err) {
      console.error('Photo battle failed:', err);
      setIsAnimating(false);
    }
  };

  return (
    <View style={[styles.photoBattleContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.photoBattleTitle, { color: colors.text }]}>Photo Auction Battle</Text>
      <Text style={[styles.photoBattleSubtitle, { color: colors.textMuted }]}>Highest effective value wins!</Text>
      
      <View style={styles.photoBattleCardsRow}>
        <PhotoCard
          photo={session?.player1_photo}
          isPlayer={true}
          effectiveValue={result?.player1_value}
          isAnimating={isAnimating}
          colors={colors}
        />
        
        <View style={styles.photoBattleVS}>
          <Text style={styles.photoBattleVSEmoji}>⚔️</Text>
          {!result && !isAnimating && (
            <TouchableOpacity style={styles.battleButton} onPress={handleBattle}>
              <Text style={styles.battleButtonText}>Battle!</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <PhotoCard
          photo={session?.player2_photo}
          isPlayer={false}
          effectiveValue={result?.player2_value}
          isAnimating={isAnimating}
          colors={colors}
        />
      </View>
      
      {result && (
        <View style={styles.photoBattleResult}>
          <Text
            style={[
              styles.photoBattleWinner,
              { color: result.winner === 'player1' ? colors.success : colors.error },
            ]}
          >
            {result.winner === 'player1' ? '🏆 Your Photo Wins!' : '😢 Opponent Wins!'}
          </Text>
        </View>
      )}
    </View>
  );
};

// ============== RESULT VIEW ==============
const ResultView = ({ session, onPlayAgain, user, colors }) => {
  const isWinner = session?.winner_id === user?.user_id;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
    if (isWinner) {
      auctionSounds.battleVictory();
    }
  }, [isWinner]);

  return (
    <View style={[styles.resultContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Text style={styles.resultEmoji}>{isWinner ? '🏆' : '😢'}</Text>
      </Animated.View>
      
      <Text style={[styles.resultTitle, { color: isWinner ? colors.success : colors.error }]}>
        {isWinner ? 'Victory!' : 'Defeat'}
      </Text>
      
      {session?.bet_amount > 0 && (
        <Text style={[styles.resultBet, { color: isWinner ? colors.gold : colors.textMuted }]}>
          {isWinner ? '+' : '-'}{session.bet_amount * (isWinner ? 2 : 1)} BL Coins
        </Text>
      )}
      
      <TouchableOpacity style={styles.playAgainButton} onPress={onPlayAgain}>
        <Text style={styles.playAgainButtonText}>🔄 Play Again</Text>
      </TouchableOpacity>
    </View>
  );
};

// ============== MAIN SCREEN ==============
export default function PhotoGameArenaScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  
  // Get pvpRoomId from navigation params (when joining an open game)
  const pvpRoomId = route.params?.pvpRoomId || null;
  const isCreator = route.params?.isCreator || false;
  
  const [gameState, setGameState] = useState('matchmaking');
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // PVP WebSocket Hook
  const {
    isConnected: wsConnected,
    isConnecting: wsConnecting,
    error: wsError,
    gameState: wsGameState,
    connect: wsConnect,
    disconnect: wsDisconnect,
    selectPhoto: wsSelectPhoto,
    markReady: wsMarkReady,
    sendTap: wsSendTap,
    requestGameState: wsRequestState,
  } = usePVPWebSocket(pvpRoomId, {
    autoConnect: !!pvpRoomId,
    onMessage: (msg) => {
      console.log('WS Message:', msg.type);
      
      // Handle game state transitions
      if (msg.type === 'round_selecting') {
        setGameState('pvp_selecting');
      } else if (msg.type === 'round_ready') {
        setGameState('pvp_ready');
      } else if (msg.type === 'countdown_tick' || msg.type === 'countdown_start') {
        setGameState('pvp_countdown');
      } else if (msg.type === 'round_start') {
        setGameState('pvp_tapping');
      } else if (msg.type === 'round_result') {
        // Handle round result - show winner briefly then transition
        setGameState('pvp_round_result');
      } else if (msg.type === 'round_selecting') {
        // New round starting - reset photo selection
        setSelectedPhoto(null);
        setGameState('pvp_selecting');
      } else if (msg.type === 'game_end') {
        setGameState('pvp_game_over');
      } else if (msg.type === 'game_forfeit') {
        // Handle opponent disconnect/forfeit
        setGameState('pvp_forfeit');
      }
    },
  });

  const fetchStats = async () => {
    try {
      const data = await photoGameAPI.getMyStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // If we have a pvpRoomId, transition to waiting state
  useEffect(() => {
    if (pvpRoomId && wsConnected) {
      setGameState('pvp_waiting');
    }
  }, [pvpRoomId, wsConnected]);

  const handlePhotoSelect = (photo) => {
    setSelectedPhoto(photo);
    auctionSounds.selectionConfirm();
  };
  
  // Handle photo selection in PVP mode
  const handlePVPPhotoSelect = (photo) => {
    setSelectedPhoto(photo);
    auctionSounds.selectionConfirm();
    
    // Send selection to server via WebSocket
    if (pvpRoomId && wsSelectPhoto) {
      wsSelectPhoto(photo.mint_id);
    }
  };

  // Handle practice mode start (direct bot battle, no matchmaking)
  const handlePracticeStart = (gameData) => {
    if (gameData.success) {
      setSession(gameData.session);
      setGameState('rps');
      auctionSounds.gavelSlam();
      // Could add a toast/alert here: "Practice mode - No risk, just fun!"
    }
  };

  const handleMatchFound = async (matchInfo) => {
    setMatchData(matchInfo);
    
    try {
      const response = await photoGameAPI.startMatch(matchInfo.match_id);
      
      if (response.success) {
        setSession(response.session);
        setGameState('rps');
        auctionSounds.gavelSlam();
      }
    } catch (err) {
      console.error('Failed to start game:', err);
      setGameState('matchmaking');
    }
  };

  const handleRPSChoice = async (choice) => {
    if (!session) return null;
    
    try {
      const result = await photoGameAPI.playRPS(session.session_id, choice);
      
      if (result.phase === 'photo_battle') {
        setTimeout(() => setGameState('photo_battle'), 1500);
      } else if (result.phase === 'tiebreaker') {
        setTimeout(() => setGameState('tiebreaker'), 1500);
      } else if (result.phase === 'completed') {
        setTimeout(() => {
          setSession(result.session);
          setGameState('result');
        }, 1500);
      }
      
      return result;
    } catch (err) {
      console.error('RPS failed:', err);
      return null;
    }
  };

  const handlePhotoBattle = async () => {
    if (!session) return null;
    
    try {
      const result = await photoGameAPI.playPhotoBattle(session.session_id);
      
      if (result.phase === 'tiebreaker') {
        setTimeout(() => setGameState('tiebreaker'), 3000);
      } else if (result.phase === 'completed') {
        setTimeout(() => {
          setSession(result.session);
          setGameState('result');
        }, 3000);
      }
      
      return result;
    } catch (err) {
      console.error('Photo battle failed:', err);
      return null;
    }
  };

  const handlePlayAgain = () => {
    // Disconnect WebSocket if connected
    if (pvpRoomId) {
      wsDisconnect();
    }
    setGameState('matchmaking');
    setSession(null);
    setMatchData(null);
    setSelectedPhoto(null);
    fetchStats();
  };
  
  // Handle PVP round complete (called from TappingArenaView in WebSocket mode)
  const handlePVPRoundComplete = (winner) => {
    // The WebSocket will handle transitioning to next round or game end
    console.log('PVP Round completed, winner:', winner);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainerFull, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Determine if we're in PVP WebSocket mode
  const isPVPMode = !!pvpRoomId && wsConnected;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>⚔️ Battle Arena</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {isPVPMode ? 'Live PvP Battle' : 'PvP Photo Battles'}
            </Text>
          </View>
        </View>
        {stats && <WinStreakBadge streak={stats.current_win_streak} colors={colors} />}
        {/* WebSocket connection indicator */}
        {pvpRoomId && (
          <View style={[styles.connectionIndicator, { 
            backgroundColor: wsConnected ? colors.success : wsConnecting ? colors.gold : colors.error 
          }]}>
            <Text style={styles.connectionText}>
              {wsConnected ? '●' : wsConnecting ? '○' : '✕'}
            </Text>
          </View>
        )}
      </View>
      
      {/* Stats Bar */}
      {stats && (
        <View style={[styles.statsBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.battles_won}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Wins</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.battles_lost}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Losses</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.gold }]}>{stats.total_bl_won}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>BL Won</Text>
          </View>
          <View style={[styles.statItem, styles.staminaStatItem]}>
            <StaminaBar stamina={stats.stamina} colors={colors} />
          </View>
        </View>
      )}
      
      {/* WebSocket Error Display */}
      {wsError && (
        <View style={[styles.wsErrorBanner, { backgroundColor: colors.error }]}>
          <Text style={styles.wsErrorText}>Connection Error: {wsError.message || 'Unknown error'}</Text>
          <TouchableOpacity onPress={() => wsConnect()} style={styles.wsRetryButton}>
            <Text style={styles.wsRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* Main Content */}
      <View style={styles.content}>
        {/* Standard matchmaking flow */}
        {gameState === 'matchmaking' && !pvpRoomId && (
          <MatchmakingView
            onMatchFound={handleMatchFound}
            onCancel={() => {}}
            onPracticeStart={handlePracticeStart}
            selectedPhoto={selectedPhoto}
            onPhotoSelect={handlePhotoSelect}
            colors={colors}
          />
        )}
        
        {/* PVP Waiting for opponent */}
        {(gameState === 'pvp_waiting' || gameState === 'pvp_selecting') && (
          <ScrollView 
            style={styles.pvpWaitingContainer}
            contentContainerStyle={styles.pvpWaitingContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.pvpWaitingTitle, { color: colors.text }]}>
              {gameState === 'pvp_waiting' 
                ? '👥 Waiting for Opponent...' 
                : `📷 Round ${wsGameState.currentRound} - Select Your Photo`}
            </Text>
            <Text style={[styles.pvpWaitingSubtitle, { color: colors.textMuted }]}>
              {gameState === 'pvp_waiting' 
                ? 'The battle will begin when your opponent joins'
                : wsGameState.usedPhotoIds?.length > 0
                  ? 'Choose a fresh photo (previously used photos are unavailable)'
                  : 'Choose your photo for this round'
              }
            </Text>
            {gameState === 'pvp_selecting' && (
              <PhotoSelectionView
                photos={stats?.battle_photos || []}
                loading={false}
                selectedPhotoId={selectedPhoto?.mint_id}
                onSelectPhoto={handlePVPPhotoSelect}
                colors={colors}
                usedPhotoIds={wsGameState.usedPhotoIds || []}
                opponentHasSelected={wsGameState.opponentHasSelected}
                showOpponentStatus={true}
              />
            )}
            {wsConnecting && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />}
          </ScrollView>
        )}
        
        {/* PVP Ready phase / Countdown / Tapping */}
        {(gameState === 'pvp_ready' || gameState === 'pvp_countdown' || gameState === 'pvp_tapping') && (
          <TappingArenaView
            playerPhoto={wsGameState.myPhoto || selectedPhoto}
            opponentPhoto={wsGameState.opponentPhoto}
            isBot={false}
            onRoundComplete={handlePVPRoundComplete}
            roundNumber={wsGameState.currentRound}
            colors={colors}
            // WebSocket props
            isWebSocketMode={true}
            wsGamePhase={wsGameState.roundPhase}
            wsCountdown={wsGameState.countdown}
            wsOpponentTaps={wsGameState.opponentTaps}
            wsPlayerReady={wsGameState.myReady}
            wsOpponentReady={wsGameState.opponentReady}
            onSendTap={wsSendTap}
            onMarkReady={wsMarkReady}
          />
        )}
        
        {/* PVP Round Result with Transition Animation */}
        {gameState === 'pvp_round_result' && wsGameState.roundResult && (
          <RoundTransitionView
            roundResult={wsGameState.roundResult}
            currentRound={wsGameState.currentRound}
            player1Wins={wsGameState.player1Wins}
            player2Wins={wsGameState.player2Wins}
            isWinner={wsGameState.roundResult.winner_user_id === user?.user_id}
            onContinue={() => {
              // Clear selected photo for next round
              setSelectedPhoto(null);
              // Transition will happen automatically from WebSocket
            }}
            colors={colors}
          />
        )}
        
        {/* PVP Game Over */}
        {gameState === 'pvp_game_over' && wsGameState.gameResult && (
          <View style={styles.pvpGameOverContainer}>
            <Text style={styles.pvpGameOverEmoji}>
              {wsGameState.gameResult.winner_user_id === user?.user_id ? '🏆' : '😢'}
            </Text>
            <Text style={[styles.pvpGameOverTitle, { 
              color: wsGameState.gameResult.winner_user_id === user?.user_id ? colors.gold : colors.error 
            }]}>
              {wsGameState.gameResult.winner_user_id === user?.user_id ? 'VICTORY!' : 'DEFEAT'}
            </Text>
            <Text style={[styles.pvpFinalScore, { color: colors.text }]}>
              Final Score: {wsGameState.player1Wins} - {wsGameState.player2Wins}
            </Text>
            <TouchableOpacity style={[styles.playAgainButton, { marginTop: 20 }]} onPress={handlePlayAgain}>
              <Text style={styles.playAgainButtonText}>🔄 Play Again</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* PVP Forfeit */}
        {gameState === 'pvp_forfeit' && (
          <View style={styles.pvpForfeitContainer}>
            <Text style={styles.pvpForfeitEmoji}>🏳️</Text>
            <Text style={[styles.pvpForfeitTitle, { color: colors.gold }]}>Opponent Disconnected</Text>
            <Text style={[styles.pvpForfeitSubtitle, { color: colors.textMuted }]}>
              You win by forfeit!
            </Text>
            <TouchableOpacity style={[styles.playAgainButton, { marginTop: 20 }]} onPress={handlePlayAgain}>
              <Text style={styles.playAgainButtonText}>🔄 Play Again</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Legacy RPS Flow (for bot battles) */}
        {(gameState === 'rps' || gameState === 'tiebreaker') && (
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <RPSBattleView
              session={session}
              onChoice={handleRPSChoice}
              isTiebreaker={gameState === 'tiebreaker'}
              colors={colors}
            />
          </ScrollView>
        )}
        
        {gameState === 'photo_battle' && (
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <PhotoBattleView
              session={session}
              onBattle={handlePhotoBattle}
              colors={colors}
            />
          </ScrollView>
        )}
        
        {gameState === 'result' && session && (
          <ScrollView contentContainerStyle={styles.contentContainer}>
            <ResultView
              session={session}
              onPlayAgain={handlePlayAgain}
              user={user}
              colors={colors}
            />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainerFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
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
  // Win Streak Badge
  winStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F97316',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  winStreakIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  winStreakText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  staminaStatItem: {
    flex: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  // Stamina
  staminaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  staminaIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  staminaBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  staminaBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  staminaText: {
    fontSize: 11,
    marginLeft: 8,
  },
  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  // Photo Selection
  photoSelectionContainer: {
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  photoSection: {
    marginBottom: 20,
  },
  photoSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 8,
  },
  photoThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  photoThumbnailEmoji: {
    fontSize: 24,
  },
  photoInfo: {
    flex: 1,
  },
  photoNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  photoName: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
    flexShrink: 1,
  },
  sceneryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sceneryBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  photoStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  photoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 12,
  },
  photoStrength: {
    fontSize: 12,
  },
  photoStaminaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoStaminaBar: {
    width: 60,
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  photoStaminaFill: {
    height: '100%',
    borderRadius: 3,
  },
  photoStaminaText: {
    fontSize: 11,
  },
  photoRecoveryText: {
    fontSize: 12,
    marginTop: 4,
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  // Matchmaking
  matchmakingIdle: {
    flex: 1,
    padding: 16,
  },
  matchmakingCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  matchmakingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  queueStatusCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  queueStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  queueStatusLabel: {
    fontSize: 13,
  },
  queueStatusValue: {
    fontSize: 13,
    fontWeight: 'bold',
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
  },
  switchLabel: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  findMatchButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  findMatchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  practiceButton: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  practiceButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  practiceSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  quickMatchRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickMatchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickMatchIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  quickMatchText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Auction Battle Button
  auctionBattleButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  auctionBattleButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Searching
  matchmakingSearching: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  searchingCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  searchingIcon: {
    fontSize: 48,
  },
  searchingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  searchingSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  searchingPhoto: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  searchingProgressBg: {
    width: 200,
    height: 8,
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  searchingProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // RPS
  rpsContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  tiebreakerBadge: {
    backgroundColor: '#EAB308',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  tiebreakerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rpsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  rpsSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 32,
  },
  scoreBox: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  rpsChoicesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  rpsButton: {
    width: 90,
    height: 90,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  rpsEmoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  rpsLabel: {
    fontSize: 11,
  },
  battleResultContainer: {
    alignItems: 'center',
  },
  battleResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 12,
  },
  battleResultPlayer: {
    alignItems: 'center',
  },
  battleResultLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  battleResultEmoji: {
    fontSize: 48,
  },
  battleVS: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  roundResultText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Photo Battle
  photoBattleContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  photoBattleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  photoBattleSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  photoBattleCardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  photoCard: {
    width: (width - 100) / 2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
  },
  photoCardImage: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCardEmoji: {
    fontSize: 48,
    opacity: 0.5,
  },
  photoCardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoCardBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  photoCardInfo: {
    padding: 8,
  },
  photoCardName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  photoCardValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  photoCardEffective: {
    fontSize: 10,
    marginTop: 2,
  },
  photoBattleVS: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  photoBattleVSEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  battleButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  battleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  photoBattleResult: {
    marginTop: 20,
    alignItems: 'center',
  },
  photoBattleWinner: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Result
  resultContainer: {
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    alignItems: 'center',
  },
  resultEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultBet: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
  },
  playAgainButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  playAgainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // ============== TAPPING ARENA STYLES ==============
  tappingArenaContainer: {
    flex: 1,
    position: 'relative',
  },
  rateWarningToast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: '#F59E0B',
    padding: 12,
    borderRadius: 12,
    zIndex: 100,
    alignItems: 'center',
  },
  rateWarningText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  confettiPiece: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    zIndex: 50,
  },
  tappingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tappingRoundLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tappingRoundType: {
    fontSize: 12,
    marginTop: 2,
  },
  tappingTimerBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tappingTimerText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tappingPhotosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  tappingPhotoCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    padding: 8,
  },
  tappingPhotoPlaceholder: {
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tappingPhotoEmoji: {
    fontSize: 32,
    opacity: 0.7,
  },
  tappingPhotoLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
  },
  tappingPhotoValue: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  tappingProgressBg: {
    height: 6,
    borderRadius: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  tappingProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  tappingTapCount: {
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center',
  },
  tappingVS: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tappingCountdownOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 30,
  },
  tappingCountdownNumber: {
    fontSize: 100,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  tappingCountdownLabel: {
    fontSize: 20,
    color: '#fff',
    marginTop: 8,
  },
  tappingResultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 40,
  },
  tappingWinEmoji: {
    fontSize: 72,
    marginBottom: 12,
  },
  tappingWinText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  tappingLoseEmoji: {
    fontSize: 72,
    marginBottom: 12,
  },
  tappingLoseText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  tappingTapArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginHorizontal: 12,
    borderRadius: 20,
  },
  tappingTapEmoji: {
    fontSize: 56,
    marginBottom: 8,
  },
  tappingTapText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  tappingTapSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 6,
  },
  tappingWaitingText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  tappingTPSIndicator: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tappingTPSText: {
    fontSize: 11,
    fontWeight: '600',
  },
  // ============== WEBSOCKET/PVP STYLES ==============
  connectionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  connectionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  wsErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  wsErrorText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
  },
  wsRetryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    marginLeft: 12,
  },
  wsRetryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Ready button styles
  readyIndicator: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  readyIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  readyButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 25,
    padding: 20,
  },
  readyOverlayTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  readyOverlaySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 24,
    textAlign: 'center',
  },
  readyButton: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
  },
  readyButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  readyOverlayHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
    textAlign: 'center',
  },
  // PVP Waiting/Selecting styles
  pvpWaitingContainer: {
    flex: 1,
  },
  pvpWaitingContent: {
    padding: 20,
    paddingBottom: 40,
  },
  pvpWaitingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  pvpWaitingSubtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  // PVP Round Result styles
  pvpRoundResultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pvpRoundResultTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  pvpScoreText: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  pvpNextRoundText: {
    fontSize: 14,
    opacity: 0.7,
  },
  // PVP Game Over styles
  pvpGameOverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pvpGameOverEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  pvpGameOverTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  pvpFinalScore: {
    fontSize: 24,
    fontWeight: '600',
  },
  // PVP Forfeit styles
  pvpForfeitContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pvpForfeitEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  pvpForfeitTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  pvpForfeitSubtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  // ============== NEW: USED PHOTO BADGE STYLES ==============
  usedBadgeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  usedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    transform: [{ rotate: '-15deg' }],
  },
  usedBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  // ============== NEW: OPPONENT SELECTION STATUS ==============
  opponentSelectionStatus: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  opponentStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ============== NEW: ROUND TRANSITION STYLES ==============
  roundTransitionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  roundTransitionEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  roundTransitionTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  roundTransitionScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreCircleText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  scoreSeparator: {
    fontSize: 32,
    fontWeight: 'bold',
    marginHorizontal: 16,
  },
  roundTransitionSubtitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  transitionProgressBg: {
    width: '80%',
    height: 6,
    borderRadius: 3,
    marginBottom: 24,
    overflow: 'hidden',
  },
  transitionProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  nextRoundInfo: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextRoundInfoText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  nextRoundInfoHint: {
    fontSize: 13,
  },
  // PVP Waiting content container
  pvpWaitingContent: {
    paddingBottom: 40,
  },
});
