/**
 * Photo Game Arena Screen for Blendlink Mobile
 * PvP Photo Battles with RPS mechanics + Photo Selection
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Switch,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { photoGameAPI } from '../services/api';
import auctionSounds from '../utils/auctionSounds';

const { width } = Dimensions.get('window');

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

// ============== PHOTO SELECTION COMPONENT ==============
const PhotoSelectionView = ({ photos, loading, selectedPhotoId, onSelectPhoto, colors }) => {
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

  const availablePhotos = photos.filter(p => p.is_available);
  const unavailablePhotos = photos.filter(p => !p.is_available);

  const renderPhotoItem = ({ item: photo, isAvailable }) => {
    const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
    const isSelected = selectedPhotoId === photo.mint_id;

    return (
      <TouchableOpacity
        onPress={() => isAvailable && onSelectPhoto(photo)}
        activeOpacity={isAvailable ? 0.7 : 1}
        disabled={!isAvailable}
        style={[
          styles.photoItem,
          {
            backgroundColor: isSelected ? colors.primary + '20' : colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
            opacity: isAvailable ? 1 : 0.5,
          },
        ]}
      >
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
          {isAvailable ? (
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
        Sorted by Dollar Value (Power). Higher = Stronger!
      </Text>

      {/* Available Photos */}
      {availablePhotos.length > 0 && (
        <View style={styles.photoSection}>
          <Text style={[styles.photoSectionTitle, { color: colors.success }]}>
            ✅ Available ({availablePhotos.length})
          </Text>
          {availablePhotos.map((photo) => (
            <View key={photo.mint_id}>
              {renderPhotoItem({ item: photo, isAvailable: true })}
            </View>
          ))}
        </View>
      )}

      {/* Resting Photos */}
      {unavailablePhotos.length > 0 && (
        <View style={styles.photoSection}>
          <Text style={[styles.photoSectionTitle, { color: colors.textMuted }]}>
            ⏳ Resting ({unavailablePhotos.length})
          </Text>
          {unavailablePhotos.map((photo) => (
            <View key={photo.mint_id}>
              {renderPhotoItem({ item: photo, isAvailable: false })}
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
  
  const intervalRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchBattlePhotos();
    fetchQueueStatus();
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
      const data = await photoGameAPI.getBattlePhotos();
      setBattlePhotos(data.photos || []);
    } catch (err) {
      console.error('Failed to fetch battle photos:', err);
      setError('Failed to load your photos');
    } finally {
      setLoadingPhotos(false);
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

      {/* Battle Settings (show only when photo is selected) */}
      {selectedPhoto && (
        <View style={[styles.matchmakingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.matchmakingTitle, { color: colors.text }]}>
            🪙 Battle Settings
          </Text>
          
          {queueStatus && (
            <View style={[styles.queueStatusCard, { backgroundColor: colors.cardSecondary }]}>
              <View style={styles.queueStatusRow}>
                <Text style={[styles.queueStatusLabel, { color: colors.textMuted }]}>Players searching:</Text>
                <Text style={[styles.queueStatusValue, { color: colors.text }]}>{queueStatus.players_waiting}</Text>
              </View>
              <View style={styles.queueStatusRow}>
                <Text style={[styles.queueStatusLabel, { color: colors.textMuted }]}>Active matches:</Text>
                <Text style={[styles.queueStatusValue, { color: colors.text }]}>{queueStatus.active_matches}</Text>
              </View>
            </View>
          )}
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>BL Coin Bet (optional)</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.cardSecondary, color: colors.text, borderColor: colors.border }]}
              value={betAmount}
              onChangeText={setBetAmount}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Play with bot if no players</Text>
            <Switch
              value={useBotFallback}
              onValueChange={setUseBotFallback}
              trackColor={{ false: colors.cardSecondary, true: colors.primary + '80' }}
              thumbColor={useBotFallback ? colors.primary : colors.textMuted}
            />
          </View>
          
          {error && (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          )}
        </View>
      )}
      
      {/* Find Match Button */}
      {selectedPhoto && (
        <TouchableOpacity
          style={styles.findMatchButton}
          onPress={startMatchmaking}
          activeOpacity={0.8}
        >
          <Text style={styles.findMatchButtonText}>⚔️ Find Match with {selectedPhoto.name}</Text>
        </TouchableOpacity>
      )}
      
      {/* Practice Mode Button */}
      {selectedPhoto && (
        <TouchableOpacity
          style={[styles.practiceButton, { borderColor: colors.gold }]}
          onPress={startPracticeMode}
          activeOpacity={0.8}
        >
          <Text style={[styles.practiceButtonText, { color: colors.gold }]}>🎯 Practice vs Bot (No Risk)</Text>
          <Text style={[styles.practiceSubtext, { color: colors.textMuted }]}>No BL bet, no stamina loss, no rewards</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.quickMatchRow}>
        <TouchableOpacity
          style={[styles.quickMatchButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: selectedPhoto ? 1 : 0.5 }]}
          onPress={startMatchmaking}
          disabled={!selectedPhoto}
        >
          <Text style={styles.quickMatchIcon}>🤖</Text>
          <Text style={[styles.quickMatchText, { color: colors.text }]}>Quick Bot</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickMatchButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: selectedPhoto ? 1 : 0.5 }]}
          disabled={!selectedPhoto}
        >
          <Text style={styles.quickMatchIcon}>🏆</Text>
          <Text style={[styles.quickMatchText, { color: colors.text }]}>Ranked</Text>
        </TouchableOpacity>
      </View>

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

// ============== PHOTO BATTLE VIEW ==============
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
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [gameState, setGameState] = useState('matchmaking');
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handlePhotoSelect = (photo) => {
    setSelectedPhoto(photo);
    auctionSounds.selectionConfirm();
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
    setGameState('matchmaking');
    setSession(null);
    setMatchData(null);
    setSelectedPhoto(null);
    fetchStats();
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainerFull, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>PvP Photo Battles</Text>
          </View>
        </View>
        {stats && <WinStreakBadge streak={stats.current_win_streak} colors={colors} />}
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
      
      {/* Main Content */}
      <View style={styles.content}>
        {gameState === 'matchmaking' && (
          <MatchmakingView
            onMatchFound={handleMatchFound}
            onCancel={() => {}}
            selectedPhoto={selectedPhoto}
            onPhotoSelect={handlePhotoSelect}
            colors={colors}
          />
        )}
        
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
});
