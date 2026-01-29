/**
 * BotDifficultySelector Component for Mobile
 * 
 * Progressive bot unlock system with 5-photo selection
 * FIXED: Single scroll, Loading screen, Quick Play button
 */

import React, { useState, useEffect, useMemo } from 'react';
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

const { width, height } = Dimensions.get('window');

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
    fixedBet: 100,
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.1)',
    unlockRequirement: null,
    requiredWinsField: null,
    winsNeeded: 0,
    unlockBonus: 0,
  },
  {
    id: 'medium',
    name: 'Medium Bot',
    emoji: '🤖',
    description: 'Balanced challenge',
    dollarValue: '$800M',
    minDollarValue: 800000000,
    tapsPerSec: 10,
    fixedBet: 500,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    unlockRequirement: 'Win 3 games vs Easy Bot',
    requiredWinsField: 'easy_bot_wins',
    winsNeeded: 3,
    unlockBonus: 20000,
  },
  {
    id: 'hard',
    name: 'Hard Bot',
    emoji: '🤖',
    description: 'For experienced players',
    dollarValue: '$1B',
    minDollarValue: 1000000000,
    tapsPerSec: 12,
    fixedBet: 1000,
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    unlockRequirement: 'Win 3 games vs Medium Bot',
    requiredWinsField: 'medium_bot_wins',
    winsNeeded: 3,
    unlockBonus: 100000,
  },
  {
    id: 'extreme',
    name: 'Extremely Hard Bot',
    emoji: '💀',
    description: 'Ultimate challenge',
    dollarValue: '$2B',
    minDollarValue: 2000000000,
    tapsPerSec: 15,
    fixedBet: 2000,
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    unlockRequirement: 'Win 3 games vs Hard Bot',
    requiredWinsField: 'hard_bot_wins',
    winsNeeded: 3,
    unlockBonus: 500000,
  },
];

const SCENERY_CONFIG = {
  water: { emoji: '🌊', label: 'Water', color: '#3b82f6', strong: 'Natural', weak: 'Man-made' },
  natural: { emoji: '🌿', label: 'Natural', color: '#22c55e', strong: 'Man-made', weak: 'Water' },
  man_made: { emoji: '🏙️', label: 'Man-made', color: '#6b7280', strong: 'Water', weak: 'Natural' },
  neutral: { emoji: '⚪', label: 'Neutral', color: '#9ca3af', strong: 'None', weak: 'None' },
};

// Loading Screen Component
const LoadingScreen = ({ difficulty }) => (
  <View style={styles.loadingOverlay}>
    <Text style={styles.loadingEmoji}>{difficulty?.emoji || '🤖'}</Text>
    <Text style={styles.loadingTitle}>Loading Bot Battle...</Text>
    <Text style={styles.loadingSubtitle}>Preparing your battle against {difficulty?.name || 'Bot'}</Text>
    <ActivityIndicator size="large" color="#8b5cf6" style={styles.loadingSpinner} />
    <View style={styles.loadingBar}>
      <View style={styles.loadingBarInner} />
    </View>
  </View>
);

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
  const [step, setStep] = useState('difficulty');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('difficulty');
      setSelectedPhotos([]);
      setSelectedDifficulty('easy');
      setIsLoading(false);
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

  // Get top 5 photos by dollar value with valid stamina
  const top5Photos = useMemo(() => {
    return photos
      .filter(p => (p.current_stamina || p.stamina || 0) >= 1)
      .sort((a, b) => (b.dollar_value || 0) - (a.dollar_value || 0))
      .slice(0, 5);
  }, [photos]);

  const validPhotosCount = useMemo(() => {
    return photos.filter(p => (p.current_stamina || p.stamina || 0) >= 1).length;
  }, [photos]);

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

  // Quick Play - Auto-select top 5 photos
  const handleQuickPlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (top5Photos.length === 5) {
      setSelectedPhotos(top5Photos);
    }
  };

  const handleStart = async () => {
    if (selectedPhotos.length !== 5 || !currentDifficulty) return;
    
    setIsLoading(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Small delay for loading screen visibility
    await new Promise(resolve => setTimeout(resolve, 500));
    
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

  const formatValue = (value) => {
    if (!value) return '$0';
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
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
          <View style={[styles.statBadge, { backgroundColor: 'rgba(234, 179, 8, 0.2)' }]}>
            <Text style={[styles.statText, { color: '#eab308' }]}>{difficulty.fixedBet} BL</Text>
          </View>
          {difficulty.unlockBonus > 0 && !isUnlocked && (
            <View style={[styles.statBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <Text style={[styles.statText, { color: '#10b981' }]}>+{(difficulty.unlockBonus / 1000).toFixed(0)}K</Text>
            </View>
          )}
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
    const stamina = Math.min((photo.current_stamina || photo.stamina || 0), 100);
    const level = photo.level || 1;
    const hearts = photo.hearts || photo.reaction_count || 0;
    const winStreak = photo.current_win_streak || 0;
    const loseStreak = photo.current_lose_streak || 0;
    const imageUrl = photo.image_url || photo.thumbnail_url;

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
            borderWidth: isSelected ? 2 : 1,
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
            <Text style={styles.lowStaminaSubtext}>Regenerating...</Text>
          </View>
        )}

        <View style={styles.photoImageContainer}>
          {imageUrl ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.photoImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.photoThumbnail, { backgroundColor: scenery.color }]}>
              <Text style={styles.photoThumbnailEmoji}>{scenery.emoji}</Text>
            </View>
          )}
          
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Lv{level}</Text>
            <Text style={styles.starsText}>{'★'.repeat(Math.min(level, 5))}</Text>
          </View>
          
          <View style={styles.sceneryBadge}>
            <Text style={styles.sceneryBadgeText}>{scenery.emoji} {scenery.label}</Text>
          </View>
        </View>

        <View style={styles.photoInfoContainer}>
          <Text style={[styles.photoName, { color: colors.text }]} numberOfLines={1}>
            {photo.name}
          </Text>
          
          <View style={styles.dollarValueContainer}>
            <Text style={styles.dollarValueText}>{formatValue(photo.dollar_value)}</Text>
          </View>
          
          <View style={styles.sceneryStrengthRow}>
            <Text style={styles.strengthText}>💪 {scenery.strong}</Text>
            <Text style={styles.weaknessText}>😰 {scenery.weak}</Text>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.heartsContainer}>
              <Text style={styles.heartsText}>❤️ {hearts > 999 ? `${(hearts/1000).toFixed(1)}K` : hearts}</Text>
            </View>
            <View style={styles.streaksContainer}>
              {winStreak > 0 && (
                <Text style={styles.winStreakText}>🔥{winStreak}</Text>
              )}
              {loseStreak >= 3 && (
                <Text style={styles.immunityText}>🛡️</Text>
              )}
            </View>
          </View>
          
          <View style={styles.staminaContainer}>
            <View style={styles.staminaLabelRow}>
              <Text style={styles.staminaLabel}>Stamina</Text>
              <Text style={[styles.staminaPercent, { 
                color: stamina > 50 ? '#22c55e' : stamina > 20 ? '#eab308' : '#ef4444' 
              }]}>
                {stamina.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.staminaBarBg}>
              <View style={[
                styles.staminaBarFill, 
                { 
                  width: `${stamina}%`,
                  backgroundColor: stamina > 50 ? '#22c55e' : stamina > 20 ? '#eab308' : '#ef4444'
                }
              ]} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const needMorePhotos = selectedPhotos.length < 5;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      {/* Loading Screen Overlay */}
      {isLoading && <LoadingScreen difficulty={currentDifficulty} />}
      
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          {/* Header */}
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
              <View style={styles.balanceChip}>
                <Text style={styles.balanceChipText}>{userBalance.toLocaleString()} BL</Text>
              </View>
              <TouchableOpacity onPress={onClose} disabled={isLoading} style={styles.closeButton}>
                <Text style={[styles.closeButtonText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Single ScrollView - No nested scroll */}
          <ScrollView 
            style={styles.scrollContent} 
            showsVerticalScrollIndicator={true}
            contentContainerStyle={styles.scrollContentContainer}
            bounces={true}
          >
            {step === 'difficulty' ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Difficulty</Text>
                {BOT_DIFFICULTIES.map(renderDifficultyCard)}

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

                <View style={[styles.infoBox, { backgroundColor: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.3)' }]}>
                  <Text style={styles.infoTitle}>Bot Battle Rules:</Text>
                  <Text style={styles.infoText}>• Select exactly 5 minted photos (stamina ≥1)</Text>
                  <Text style={styles.infoText}>• First to 3 rounds wins the game</Text>
                  <Text style={styles.infoText}>• Winner takes entire pot</Text>
                  <Text style={styles.infoText}>• All PVP mechanics apply</Text>
                  <Text style={styles.infoText}>• Win 3 games to unlock next difficulty</Text>
                </View>

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
                <TouchableOpacity onPress={() => setStep('difficulty')} style={styles.backButton}>
                  <Text style={[styles.backButtonText, { color: colors.textMuted }]}>← Back to difficulty</Text>
                </TouchableOpacity>

                <View style={[styles.summaryCard, { backgroundColor: currentDifficulty?.bgColor, borderColor: currentDifficulty?.color }]}>
                  <Text style={styles.summaryEmoji}>{currentDifficulty?.emoji}</Text>
                  <View style={styles.summaryInfo}>
                    <Text style={[styles.summaryName, { color: currentDifficulty?.color }]}>
                      {currentDifficulty?.name}
                    </Text>
                    <Text style={[styles.summaryStats, { color: colors.textMuted }]}>
                      {currentDifficulty?.dollarValue} • {currentDifficulty?.fixedBet} BL Bet
                    </Text>
                  </View>
                </View>

                {/* Selection Counter */}
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

                {/* Quick Play Button */}
                {top5Photos.length === 5 && selectedPhotos.length === 0 && (
                  <TouchableOpacity
                    onPress={handleQuickPlay}
                    style={styles.quickPlayButton}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.quickPlayText}>⚡ Quick Play - Auto-Select Top 5 Photos</Text>
                  </TouchableOpacity>
                )}

                {needMorePhotos && selectedPhotos.length > 0 && (
                  <View style={styles.instructionBox}>
                    <Text style={styles.instructionText}>
                      ⚠️ Select {5 - selectedPhotos.length} more photo{5 - selectedPhotos.length > 1 ? 's' : ''} to start
                    </Text>
                  </View>
                )}

                {validPhotosCount < 5 && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorBoxText}>
                      ❌ You need at least 5 photos with stamina ≥1 ({validPhotosCount} available)
                    </Text>
                  </View>
                )}

                {/* Photo Grid - Part of main scroll, no inner scroll */}
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
              </>
            )}
          </ScrollView>

          {/* Fixed Start Button - Always visible above nav bar */}
          {step === 'photos' && validPhotosCount >= 5 && (
            <View style={styles.fixedStartButtonContainer}>
              <TouchableOpacity
                onPress={handleStart}
                disabled={selectedPhotos.length !== 5 || isLoading}
                style={[
                  styles.startButton,
                  {
                    backgroundColor: selectedPhotos.length === 5 ? '#f59e0b' : colors.cardSecondary,
                    opacity: selectedPhotos.length === 5 ? 1 : 0.5,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.startButtonEmoji}>{currentDifficulty?.emoji}</Text>
                    <Text style={styles.startButtonText}>
                      Start Battle vs {currentDifficulty?.name}
                    </Text>
                    <View style={styles.startButtonBet}>
                      <Text style={styles.startButtonBetText}>{currentDifficulty?.fixedBet} BL</Text>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
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
    maxHeight: '90%',
    flex: 1,
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
    flex: 1,
    padding: 16,
  },
  scrollContentContainer: {
    paddingBottom: 120,
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
  quickPlayButton: {
    backgroundColor: '#0ea5e9',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  quickPlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  instructionBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 12,
  },
  instructionText: {
    color: '#f59e0b',
    fontSize: 12,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 12,
  },
  errorBoxText: {
    color: '#ef4444',
    fontSize: 12,
    textAlign: 'center',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoItem: {
    width: (width - 52) / 2,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  photoSelectionNumber: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  photoSelectionNumberText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  lowStaminaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  lowStaminaText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  lowStaminaSubtext: {
    color: '#9ca3af',
    fontSize: 10,
    marginTop: 2,
  },
  photoImageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoThumbnailEmoji: {
    fontSize: 40,
    opacity: 0.5,
  },
  levelBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelText: {
    color: '#eab308',
    fontSize: 11,
    fontWeight: 'bold',
  },
  starsText: {
    color: '#fbbf24',
    fontSize: 9,
  },
  sceneryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sceneryBadgeText: {
    color: '#d1d5db',
    fontSize: 10,
  },
  photoInfoContainer: {
    padding: 8,
  },
  photoName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  dollarValueContainer: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderRadius: 6,
    paddingVertical: 4,
    alignItems: 'center',
    marginBottom: 6,
  },
  dollarValueText: {
    color: '#eab308',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sceneryStrengthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  strengthText: {
    color: '#22c55e',
    fontSize: 10,
  },
  weaknessText: {
    color: '#ef4444',
    fontSize: 10,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heartsContainer: {},
  heartsText: {
    color: '#ec4899',
    fontSize: 11,
  },
  streaksContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  winStreakText: {
    color: '#f97316',
    fontSize: 11,
  },
  immunityText: {
    color: '#3b82f6',
    fontSize: 11,
  },
  staminaContainer: {},
  staminaLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  staminaLabel: {
    color: '#9ca3af',
    fontSize: 10,
  },
  staminaPercent: {
    fontSize: 10,
    fontWeight: '600',
  },
  staminaBarBg: {
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    overflow: 'hidden',
  },
  staminaBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  emptyPhotos: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyPhotosEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyPhotosText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyPhotosHint: {
    fontSize: 12,
    marginTop: 4,
  },
  fixedStartButtonContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 12,
    padding: 4,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  startButtonEmoji: {
    fontSize: 24,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  startButtonBet: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  startButtonBetText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Loading Screen Styles
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  loadingEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  loadingTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  loadingSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 24,
  },
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingBar: {
    width: 200,
    height: 6,
    backgroundColor: '#374151',
    borderRadius: 3,
    overflow: 'hidden',
  },
  loadingBarInner: {
    width: '50%',
    height: '100%',
    backgroundColor: '#8b5cf6',
    borderRadius: 3,
  },
});

export default BotDifficultySelector;
