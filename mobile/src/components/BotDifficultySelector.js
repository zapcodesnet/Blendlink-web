/**
 * BotDifficultySelector Component for Mobile
 * 
 * Progressive bot unlock system with 5-photo selection
 * - Easy Bot: Default unlocked, 8 taps/sec, 100 BL fixed bet
 * - Medium Bot: Unlocks after 3 Easy wins, 10 taps/sec, 500 BL fixed bet
 * - Hard Bot: Unlocks after 3 Medium wins, 12 taps/sec, 1000 BL fixed bet
 * - Extremely Hard Bot: Unlocks after 3 Hard wins, 15 taps/sec, 2000 BL fixed bet
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// Bot difficulty configurations
const BOT_DIFFICULTIES = [
  {
    id: 'easy',
    name: 'Easy Bot',
    emoji: '🤖',
    description: 'Perfect for beginners',
    dollarValue: '$600M',
    minDollarValue: 600000000,
    tapsPerSec: 8,
    tapsDisplay: '8 taps/sec',
    fixedBet: 100,
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.1)',
    unlockRequirement: null,
    requiredWinsField: null,
    winsNeeded: 0,
  },
  {
    id: 'medium',
    name: 'Medium Bot',
    emoji: '🤖',
    description: 'Balanced challenge',
    dollarValue: '$800M',
    minDollarValue: 800000000,
    tapsPerSec: 10,
    tapsDisplay: '10 taps/sec',
    fixedBet: 500,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    unlockRequirement: 'Win 3 games vs Easy Bot',
    requiredWinsField: 'easy_bot_wins',
    winsNeeded: 3,
  },
  {
    id: 'hard',
    name: 'Hard Bot',
    emoji: '🤖',
    description: 'For experienced players',
    dollarValue: '$1B',
    minDollarValue: 1000000000,
    tapsPerSec: 12,
    tapsDisplay: '12 taps/sec',
    fixedBet: 1000,
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    unlockRequirement: 'Win 3 games vs Medium Bot',
    requiredWinsField: 'medium_bot_wins',
    winsNeeded: 3,
  },
  {
    id: 'extreme',
    name: 'Extremely Hard Bot',
    emoji: '💀',
    description: 'Ultimate challenge',
    dollarValue: '$2B',
    minDollarValue: 2000000000,
    tapsPerSec: 15,
    tapsDisplay: '15 taps/sec',
    fixedBet: 2000,
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    unlockRequirement: 'Win 3 games vs Hard Bot',
    requiredWinsField: 'hard_bot_wins',
    winsNeeded: 3,
  },
];

// Scenery config for display
const SCENERY_CONFIG = {
  water: { emoji: '🌊', label: 'Water', color: '#3b82f6' },
  natural: { emoji: '🌿', label: 'Natural', color: '#22c55e' },
  man_made: { emoji: '🏙️', label: 'Man-made', color: '#6b7280' },
  neutral: { emoji: '⚪', label: 'Neutral', color: '#9ca3af' },
};

const BotDifficultySelector = ({
  visible,
  onClose,
  onStart,
  photos = [],
  userBalance = 0,
  botWinStats = {},
  colors,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [step, setStep] = useState('difficulty'); // 'difficulty' | 'photos'

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setStep('difficulty');
      setSelectedPhotos([]);
      setSelectedDifficulty('easy');
    }
  }, [visible]);

  const currentDifficulty = BOT_DIFFICULTIES.find(d => d.id === selectedDifficulty);

  const isBotUnlocked = (difficulty) => {
    if (!difficulty.requiredWinsField) return true;
    const wins = botWinStats[difficulty.requiredWinsField] || 0;
    return wins >= difficulty.winsNeeded;
  };

  const getWinsForDifficulty = (difficulty) => {
    if (!difficulty.requiredWinsField) return 0;
    return botWinStats[difficulty.requiredWinsField] || 0;
  };

  const canAffordBet = userBalance >= (currentDifficulty?.fixedBet || 0);

  const togglePhotoSelection = (photo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPhotos(prev => {
      const isSelected = prev.some(p => p.mint_id === photo.mint_id);
      if (isSelected) {
        return prev.filter(p => p.mint_id !== photo.mint_id);
      } else if (prev.length < 5) {
        return [...prev, photo];
      }
      return prev;
    });
  };

  const handleStart = () => {
    if (selectedPhotos.length !== 5 || !currentDifficulty) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onStart?.({
      difficulty: selectedDifficulty,
      betAmount: currentDifficulty.fixedBet,
      photos: selectedPhotos,
      botConfig: {
        tapsPerSec: currentDifficulty.tapsPerSec,
        minDollarValue: currentDifficulty.minDollarValue,
      },
    });
  };

  const proceedToPhotos = () => {
    if (isBotUnlocked(currentDifficulty) && canAffordBet) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setStep('photos');
    }
  };

  const renderDifficultyCard = (difficulty) => {
    const isUnlocked = isBotUnlocked(difficulty);
    const isSelected = selectedDifficulty === difficulty.id;
    const currentWins = getWinsForDifficulty(difficulty);
    const progress = difficulty.winsNeeded > 0 ? Math.min(currentWins / difficulty.winsNeeded, 1) : 1;

    return (
      <TouchableOpacity
        key={difficulty.id}
        onPress={() => isUnlocked && setSelectedDifficulty(difficulty.id)}
        disabled={!isUnlocked}
        activeOpacity={isUnlocked ? 0.7 : 1}
        style={[
          styles.difficultyCard,
          {
            backgroundColor: isSelected ? difficulty.bgColor : colors.card,
            borderColor: isSelected ? difficulty.color : colors.border,
            opacity: isUnlocked ? 1 : 0.5,
          },
        ]}
      >
        {!isUnlocked && (
          <View style={styles.lockBadge}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
        )}

        <View style={styles.difficultyHeader}>
          <View style={[styles.difficultyIconContainer, { backgroundColor: difficulty.color }]}>
            <Text style={styles.difficultyEmoji}>{difficulty.emoji}</Text>
          </View>
          <View style={styles.difficultyInfo}>
            <Text style={[styles.difficultyName, { color: isSelected ? difficulty.color : colors.text }]}>
              {difficulty.name}
            </Text>
            <Text style={[styles.difficultyDesc, { color: colors.textMuted }]}>
              {difficulty.description}
            </Text>
          </View>
          {isUnlocked && isSelected && (
            <View style={[styles.checkMark, { backgroundColor: difficulty.color }]}>
              <Text style={styles.checkMarkText}>✓</Text>
            </View>
          )}
        </View>

        <View style={styles.difficultyStats}>
          <View style={[styles.statBadge, { backgroundColor: difficulty.bgColor }]}>
            <Text style={[styles.statText, { color: difficulty.color }]}>{difficulty.dollarValue}</Text>
          </View>
          <View style={[styles.statBadge, { backgroundColor: colors.cardSecondary }]}>
            <Text style={[styles.statText, { color: colors.text }]}>{difficulty.tapsDisplay}</Text>
          </View>
          <View style={[styles.statBadge, { backgroundColor: 'rgba(234, 179, 8, 0.2)' }]}>
            <Text style={[styles.statText, { color: '#eab308' }]}>{difficulty.fixedBet} BL</Text>
          </View>
        </View>

        {!isUnlocked && difficulty.unlockRequirement && (
          <View style={styles.unlockProgress}>
            <Text style={[styles.unlockText, { color: colors.textMuted }]}>
              {difficulty.unlockRequirement}
            </Text>
            <View style={styles.progressRow}>
              <View style={[styles.progressBg, { backgroundColor: colors.cardSecondary }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress * 100}%`, backgroundColor: difficulty.color },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textMuted }]}>
                {currentWins}/{difficulty.winsNeeded}
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderPhotoItem = (photo) => {
    const isSelected = selectedPhotos.some(p => p.mint_id === photo.mint_id);
    const hasStamina = (photo.current_stamina || photo.stamina || 0) >= 1;
    const canSelect = hasStamina && (isSelected || selectedPhotos.length < 5);
    const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.neutral;

    return (
      <TouchableOpacity
        key={photo.mint_id}
        onPress={() => canSelect && togglePhotoSelection(photo)}
        disabled={!canSelect}
        activeOpacity={canSelect ? 0.7 : 1}
        style={[
          styles.photoItem,
          {
            backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.2)' : colors.card,
            borderColor: isSelected ? '#8b5cf6' : colors.border,
            opacity: canSelect ? 1 : 0.5,
          },
        ]}
      >
        {isSelected && (
          <View style={styles.photoSelectionNumber}>
            <Text style={styles.photoSelectionNumberText}>
              {selectedPhotos.findIndex(p => p.mint_id === photo.mint_id) + 1}
            </Text>
          </View>
        )}

        {!hasStamina && (
          <View style={styles.lowStaminaOverlay}>
            <Text style={styles.lowStaminaText}>⚡ 0 Stamina</Text>
          </View>
        )}

        <View style={[styles.photoThumbnail, { backgroundColor: scenery.color }]}>
          <Text style={styles.photoThumbnailEmoji}>{scenery.emoji}</Text>
        </View>

        <Text style={[styles.photoName, { color: colors.text }]} numberOfLines={1}>
          {photo.name}
        </Text>
        <Text style={[styles.photoValue, { color: '#eab308' }]}>
          ${((photo.dollar_value || 0) / 1000000).toFixed(0)}M
        </Text>
        
        {/* Stamina bar */}
        {hasStamina && (
          <View style={styles.staminaBar}>
            <View style={[styles.staminaFill, { width: `${Math.min((photo.current_stamina || photo.stamina || 0), 100)}%` }]} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const validPhotosCount = photos.filter(p => (p.current_stamina || p.stamina || 0) >= 1).length;
  const needMorePhotos = selectedPhotos.length < 5;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          {/* Header with Balance */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIcon, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                <Text style={styles.headerIconText}>🤖</Text>
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Bot Battle</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
                  {step === 'difficulty' ? 'Choose your opponent' : 'Select 5 photos'}
                </Text>
              </View>
            </View>
            <View style={styles.headerRight}>
              {/* Balance Display */}
              <View style={styles.balanceChip}>
                <Text style={styles.balanceChipText}>{userBalance.toLocaleString()} BL</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={[styles.closeButtonText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            style={styles.scrollContent} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentContainer}
          >
            {step === 'difficulty' ? (
              <>
                {/* Difficulty Selection */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Difficulty</Text>
                {BOT_DIFFICULTIES.map(renderDifficultyCard)}

                {/* Balance Info */}
                {currentDifficulty && isBotUnlocked(currentDifficulty) && (
                  <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.balanceRow}>
                      <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Fixed Bet:</Text>
                      <Text style={[styles.balanceValue, { color: '#eab308' }]}>
                        {currentDifficulty.fixedBet} BL
                      </Text>
                    </View>
                    <View style={styles.balanceRow}>
                      <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Your Balance:</Text>
                      <Text style={[styles.balanceValue, { color: canAffordBet ? '#22c55e' : '#ef4444' }]}>
                        {userBalance.toLocaleString()} BL
                      </Text>
                    </View>
                    {!canAffordBet && (
                      <Text style={styles.insufficientText}>Insufficient balance for this difficulty</Text>
                    )}
                  </View>
                )}

                {/* Info Box */}
                <View style={[styles.infoBox, { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)' }]}>
                  <Text style={styles.infoTitle}>Bot Battle Rules:</Text>
                  <Text style={styles.infoText}>• Select exactly 5 minted photos (stamina ≥1)</Text>
                  <Text style={styles.infoText}>• First to 3 rounds wins the game</Text>
                  <Text style={styles.infoText}>• Winner takes entire pot</Text>
                  <Text style={styles.infoText}>• All PVP mechanics apply</Text>
                  <Text style={styles.infoText}>• Win 3 games to unlock next difficulty</Text>
                </View>

                {/* Continue Button */}
                <TouchableOpacity
                  onPress={proceedToPhotos}
                  disabled={!isBotUnlocked(currentDifficulty) || !canAffordBet}
                  style={[
                    styles.continueButton,
                    {
                      backgroundColor: isBotUnlocked(currentDifficulty) && canAffordBet ? '#8b5cf6' : colors.cardSecondary,
                      opacity: isBotUnlocked(currentDifficulty) && canAffordBet ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text style={styles.continueButtonText}>Continue to Photo Selection →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Back Button */}
                <TouchableOpacity onPress={() => setStep('difficulty')} style={styles.backButton}>
                  <Text style={[styles.backButtonText, { color: colors.textMuted }]}>← Back to difficulty</Text>
                </TouchableOpacity>

                {/* Selected Difficulty Summary */}
                <View style={[styles.summaryCard, { backgroundColor: currentDifficulty?.bgColor, borderColor: currentDifficulty?.color }]}>
                  <Text style={styles.summaryEmoji}>{currentDifficulty?.emoji}</Text>
                  <View style={styles.summaryInfo}>
                    <Text style={[styles.summaryName, { color: currentDifficulty?.color }]}>
                      {currentDifficulty?.name}
                    </Text>
                    <Text style={[styles.summaryStats, { color: colors.textMuted }]}>
                      {currentDifficulty?.dollarValue} • {currentDifficulty?.tapsDisplay} • {currentDifficulty?.fixedBet} BL
                    </Text>
                  </View>
                </View>

                {/* Photo Selection Counter - Prominent */}
                <View style={[styles.selectionCounter, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View>
                    <Text style={[styles.selectionCounterLabel, { color: colors.text }]}>Photos Selected:</Text>
                    <Text style={[styles.selectionCounterHint, { color: colors.textMuted }]}>Tap photos to select/deselect</Text>
                  </View>
                  <View style={[styles.selectionCounterBadge, { 
                    backgroundColor: selectedPhotos.length === 5 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)' 
                  }]}>
                    <Text style={[styles.selectionCounterText, { 
                      color: selectedPhotos.length === 5 ? '#22c55e' : '#eab308' 
                    }]}>
                      {selectedPhotos.length} / 5
                    </Text>
                  </View>
                </View>

                {/* Instruction message */}
                {needMorePhotos && (
                  <View style={styles.instructionBox}>
                    <Text style={styles.instructionText}>
                      ⚠️ Select exactly 5 minted photos with available stamina to play
                    </Text>
                  </View>
                )}

                {/* Not enough valid photos warning */}
                {validPhotosCount < 5 && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorBoxText}>
                      ❌ You need at least 5 photos with stamina ≥1 ({validPhotosCount} available)
                    </Text>
                  </View>
                )}

                {/* Photo Grid */}
                <View style={styles.photoGrid}>
                  {photos.map(renderPhotoItem)}
                  {photos.length === 0 && (
                    <View style={styles.emptyPhotos}>
                      <Text style={styles.emptyPhotosEmoji}>📷</Text>
                      <Text style={[styles.emptyPhotosText, { color: colors.textMuted }]}>
                        No minted photos available
                      </Text>
                      <Text style={[styles.emptyPhotosHint, { color: colors.textMuted }]}>
                        Mint some photos to start battling!
                      </Text>
                    </View>
                  )}
                </View>

                {/* Start Button - Fixed at bottom with extra padding */}
                <TouchableOpacity
                  onPress={handleStart}
                  disabled={selectedPhotos.length !== 5}
                  style={[
                    styles.startButton,
                    {
                      backgroundColor: selectedPhotos.length === 5 ? '#f59e0b' : colors.cardSecondary,
                      opacity: selectedPhotos.length === 5 ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text style={styles.startButtonEmoji}>{currentDifficulty?.emoji}</Text>
                  <Text style={styles.startButtonText}>
                    Start Battle vs {currentDifficulty?.name}
                  </Text>
                  <View style={styles.startButtonBet}>
                    <Text style={styles.startButtonBetText}>{currentDifficulty?.fixedBet} BL</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balanceChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderRadius: 8,
  },
  balanceChipText: {
    color: '#eab308',
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
  },
  scrollContent: {
    padding: 16,
  },
  scrollContentContainer: {
    paddingBottom: 100, // Extra padding for nav bar clearance
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  difficultyCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
  },
  lockBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  lockIcon: {
    fontSize: 16,
  },
  difficultyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  difficultyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  difficultyEmoji: {
    fontSize: 24,
  },
  difficultyInfo: {
    flex: 1,
  },
  difficultyName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  difficultyDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  checkMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMarkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  difficultyStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  statBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
  },
  unlockProgress: {
    marginTop: 12,
  },
  unlockText: {
    fontSize: 11,
    marginBottom: 6,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 11,
  },
  balanceCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  balanceLabel: {
    fontSize: 13,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  insufficientText: {
    color: '#ef4444',
    fontSize: 11,
    marginTop: 8,
  },
  infoBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginVertical: 12,
  },
  infoTitle: {
    color: '#8b5cf6',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    color: '#9ca3af',
    fontSize: 11,
    marginBottom: 4,
  },
  continueButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 14,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  summaryEmoji: {
    fontSize: 28,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  summaryStats: {
    fontSize: 12,
    marginTop: 2,
  },
  photoSelectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoCount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoItem: {
    width: (width - 56) / 3,
    padding: 8,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
  },
  photoSelectionNumber: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  photoSelectionNumberText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  lowStaminaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  lowStaminaText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: 'bold',
  },
  staminaBar: {
    marginTop: 4,
    height: 3,
    backgroundColor: 'rgba(107, 114, 128, 0.5)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  staminaFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 2,
  },
  photoThumbnail: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  photoThumbnailEmoji: {
    fontSize: 24,
  },
  photoName: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  photoValue: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Selection counter
  selectionCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  selectionCounterLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectionCounterHint: {
    fontSize: 11,
    marginTop: 2,
  },
  selectionCounterBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectionCounterText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Instruction/Error boxes
  instructionBox: {
    padding: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 12,
    color: '#f59e0b',
    textAlign: 'center',
  },
  errorBox: {
    padding: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  errorBoxText: {
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
  },
  emptyPhotos: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
  },
  emptyPhotosEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyPhotosText: {
    fontSize: 14,
  },
  emptyPhotosHint: {
    fontSize: 12,
    marginTop: 4,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 24,
    gap: 8,
  },
  startButtonEmoji: {
    fontSize: 24,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  startButtonBet: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  startButtonBetText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default BotDifficultySelector;
