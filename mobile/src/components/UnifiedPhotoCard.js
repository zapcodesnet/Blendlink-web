/**
 * UnifiedPhotoCard Component for Mobile (React Native/Expo)
 * 
 * Consistent, reusable photo card component used across all screens:
 * - Minted Photos screen
 * - Photo Game Arena
 * - Battle Arena (PVP/Bot)
 * - Profile & Settings
 * 
 * Design Rules:
 * - Front: Clean image ONLY (no overlays, text, icons on image)
 * - Back: All stats displayed BELOW the image including new progression stats
 * - XP meter bar shown below Base Value
 * - Golden sparkling animation for Seniority Level 60
 * - Uniform design across all screens
 */

import React, { useState, memo, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  Pressable, 
  Animated,
  Dimensions,
  ScrollView 
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Scenery configuration - matches backend
export const SCENERY_CONFIG = {
  natural: { 
    gradient: ['#22C55E', '#10B981'], 
    emoji: '🌿', 
    label: 'Natural',
    strong: 'Water',
    weak: 'Man-made'
  },
  water: { 
    gradient: ['#3B82F6', '#06B6D4'], 
    emoji: '🌊', 
    label: 'Water',
    strong: 'Man-made',
    weak: 'Natural'
  },
  manmade: { 
    gradient: ['#F97316', '#EF4444'], 
    emoji: '🏙️', 
    label: 'Man-made',
    strong: 'Natural',
    weak: 'Water'
  },
  neutral: {
    gradient: ['#6B7280', '#4B5563'],
    emoji: '⬜',
    label: 'Neutral',
    strong: null,
    weak: null
  }
};

// Format dollar value
export const formatDollarValue = (value) => {
  if (!value || value === 0) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
};

// Format XP
export const formatXP = (xp) => {
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  return xp.toString();
};

// Calculate stars from level
export const getStarsFromLevel = (level) => {
  if (level >= 60) return 5;
  if (level >= 40) return 4;
  if (level >= 25) return 3;
  if (level >= 15) return 2;
  if (level >= 5) return 1;
  return 0;
};

// Stars display component
const StarsDisplay = ({ count, hasGoldenFrame }) => {
  return (
    <View style={styles.starsContainer}>
      {[...Array(5)].map((_, i) => (
        <Text 
          key={i} 
          style={[
            styles.star,
            i < count ? (hasGoldenFrame ? styles.starGolden : styles.starFilled) : styles.starEmpty
          ]}
        >
          ★
        </Text>
      ))}
    </View>
  );
};

// Streak badge component
const StreakBadge = ({ winStreak, loseStreak }) => {
  if (winStreak >= 3) {
    const multiplier = 1 + (winStreak * 0.1);
    return (
      <View style={[styles.streakBadge, styles.winStreakBadge]}>
        <Text style={styles.streakText}>🔥 {winStreak} ×{multiplier.toFixed(1)}</Text>
      </View>
    );
  }
  
  if (loseStreak >= 3) {
    return (
      <View style={[styles.streakBadge, styles.loseStreakBadge]}>
        <Text style={styles.streakText}>🛡️ Immunity</Text>
      </View>
    );
  }
  
  return null;
};

// XP Multiplier Badge
const XPMultiplierBadge = ({ multiplier, tier }) => {
  if (!multiplier || multiplier <= 1) return null;
  
  const tierGradients = {
    bronze: ['#B45309', '#78350F'],
    silver: ['#9CA3AF', '#4B5563'],
    gold: ['#FBBF24', '#CA8A04'],
    platinum: ['#A855F7', '#7C3AED']
  };
  
  return (
    <LinearGradient
      colors={tierGradients[tier] || ['#6B7280', '#374151']}
      style={styles.xpMultiplierBadge}
    >
      <Text style={styles.xpMultiplierText}>×{multiplier} XP</Text>
    </LinearGradient>
  );
};

const UnifiedPhotoCard = memo(function UnifiedPhotoCard({
  photo,
  onPress,
  onFlip,
  selected = false,
  disabled = false,
  showStats = true,
  showStamina = true,
  showFaceMatch = false,
  onFaceMatchPress,
  size = 'medium', // 'small' | 'medium' | 'large'
  style,
  subscription = null,
}) {
  const { colors } = useTheme();
  const [isFlipped, setIsFlipped] = useState(false);
  const [showXPMultiplier, setShowXPMultiplier] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  
  // Size configurations - INCREASED by 3% to fit Name and Tap to flip
  // Original: small=100, medium=140, large=180
  // +3%: small=103, medium=144, large=185
  const sizeConfig = {
    small: { width: 103, imageHeight: 82, fontSize: 10 },
    medium: { width: 144, imageHeight: 113, fontSize: 12 },
    large: { width: 185, imageHeight: 155, fontSize: 14 },
  };
  const config = sizeConfig[size] || sizeConfig.medium;
  
  // Photo stats
  const dollarValue = photo?.dollar_value || photo?.total_dollar_value || photo?.base_dollar_value || 0;
  const baseDollarValue = photo?.base_dollar_value || 1000000;
  const level = photo?.level || 1;
  const xp = photo?.xp || 0;
  const stars = photo?.stars || getStarsFromLevel(level);
  const hasGoldenFrame = photo?.has_golden_frame || level >= 60;
  const stamina = photo?.current_stamina ?? photo?.stamina ?? 24;
  const maxStamina = photo?.max_stamina || 24;
  const staminaPercent = Math.min((stamina / maxStamina) * 100, 100);
  
  // Win/Loss streaks
  const winStreak = photo?.win_streak || 0;
  const loseStreak = photo?.lose_streak || 0;
  
  // Reactions and bonuses
  const reactions = photo?.total_reactions || 0;
  const reactionBonus = photo?.reaction_bonus_value || 0;
  const upgradeValue = photo?.total_upgrade_value || 0;
  
  // NEW PROGRESSION STATS
  const ageDays = photo?.age_days || 0;
  const ageBonus = photo?.age_bonus_value || 0;
  const starBonusValue = photo?.star_bonus_value || 0;
  const seniorityAchieved = photo?.seniority_achieved || level >= 60;
  const seniorityBonusValue = photo?.seniority_bonus_value || 0;
  const levelsToSeniority = photo?.levels_to_seniority || Math.max(0, 60 - level);
  const blCoinsSpent = photo?.bl_coins_spent || upgradeValue || 0;
  const reactionsToNextBonus = photo?.reactions_to_next_bonus || (100 - (reactions % 100));
  
  // XP Progress data
  const xpProgress = photo?.xp_progress || {};
  const xpProgressPercent = photo?.xp_progress_percent || xpProgress.progress_percent || 0;
  const xpToNextLevel = xpProgress.remaining || photo?.xp_to_next_level || 10;
  const xpForNextLevel = xpProgress.xp_for_next_level || photo?.xp_for_next_level || 10;
  
  // Authenticity
  const faceScore = photo?.face_detection_score || 0;
  const selfieScore = photo?.selfie_match_score || 0;
  const selfieCompleted = photo?.selfie_match_completed || false;
  const hasFace = photo?.has_face || false;
  
  // Level bonus
  const levelBonus = photo?.level_bonus_percent || Math.floor(level / 5) * 2;
  
  // Start sparkle animation for Level 60
  useEffect(() => {
    if (seniorityAchieved) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(sparkleAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [seniorityAchieved, sparkleAnim]);
  
  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    
    onPress?.(photo);
  };
  
  const handleFlip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const toValue = isFlipped ? 0 : 1;
    Animated.spring(flipAnim, {
      toValue,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    
    setIsFlipped(!isFlipped);
    setShowXPMultiplier(true);
    setTimeout(() => setShowXPMultiplier(false), 3000);
    onFlip?.(!isFlipped);
  };
  
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  
  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };
  
  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };
  
  const sparkleOpacity = sparkleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });
  
  const getStaminaColor = () => {
    if (staminaPercent > 50) return '#22C55E';
    if (staminaPercent > 25) return '#EAB308';
    return '#EF4444';
  };
  
  return (
    <Pressable onPress={handlePress} disabled={disabled}>
      <Animated.View 
        style={[
          styles.container,
          { width: config.width, transform: [{ scale: scaleAnim }] },
          selected && styles.selected,
          disabled && styles.disabled,
          hasGoldenFrame && styles.goldenFrame,
          style,
        ]}
      >
        {/* Golden sparkle overlay for Level 60 */}
        {seniorityAchieved && (
          <Animated.View 
            style={[
              styles.sparkleOverlay,
              { opacity: sparkleOpacity }
            ]}
            pointerEvents="none"
          />
        )}
        
        {/* FRONT: Clean image only */}
        <Animated.View style={[styles.cardFace, frontAnimatedStyle]}>
          {/* Clean image - NO overlays */}
          <View style={[styles.imageContainer, { height: config.imageHeight }]}>
            <Image
              source={{ uri: photo?.image_url || photo?.thumbnail_url }}
              style={styles.image}
              resizeMode="cover"
            />
            {/* Seniority sparkle icon */}
            {seniorityAchieved && (
              <Animated.Text style={[styles.sparkleIcon, { opacity: sparkleOpacity }]}>
                ✨
              </Animated.Text>
            )}
          </View>
          
          {/* Stats BELOW image only */}
          {showStats && (
            <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
              {/* Photo Name - Top of details section */}
              <Text style={[styles.photoName, { fontSize: config.fontSize }]} numberOfLines={1}>
                {photo?.name || photo?.title || 'Unnamed Photo'}
              </Text>
              
              {/* Dollar Value & Level */}
              <View style={styles.headerRow}>
                <Text style={[styles.dollarValue, { color: scenery.gradient[0], fontSize: config.fontSize + 2 }]}>
                  {formatDollarValue(dollarValue)}
                </Text>
                <View style={styles.levelContainer}>
                  <Text style={[styles.levelText, { fontSize: config.fontSize - 2 }]}>Lv{level}</Text>
                  <StarsDisplay count={stars} hasGoldenFrame={hasGoldenFrame} />
                </View>
              </View>
              
              {/* Scenery Badge */}
              <LinearGradient
                colors={scenery.gradient}
                style={styles.sceneryBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.sceneryEmoji}>{scenery.emoji}</Text>
                <Text style={[styles.sceneryLabel, { fontSize: config.fontSize - 2 }]}>{scenery.label}</Text>
              </LinearGradient>
              
              {/* Stamina Bar - UPDATED: "Battles left: X/24" per user spec */}
              {showStamina && (
                <View style={styles.staminaContainer}>
                  <View style={styles.staminaHeader}>
                    <Text style={[styles.staminaLabel, { fontSize: config.fontSize - 4 }]}>⚔️ Battles</Text>
                    <Text style={[
                      styles.staminaValue, 
                      { 
                        fontSize: config.fontSize - 4,
                        color: stamina <= 0 ? '#EF4444' : '#fff'
                      }
                    ]}>
                      Battles left: {stamina}/{maxStamina}
                    </Text>
                  </View>
                  <View style={styles.staminaBarBg}>
                    <View 
                      style={[
                        styles.staminaBarFill,
                        { width: `${staminaPercent}%`, backgroundColor: getStaminaColor() }
                      ]}
                    />
                  </View>
                  {/* Zero stamina warning */}
                  {stamina <= 0 && (
                    <Text style={styles.noStaminaWarning}>
                      ⚠️ No battles left! Regenerates 1/hour
                    </Text>
                  )}
                </View>
              )}
              
              {/* Flip indicator */}
              <Pressable onPress={handleFlip} style={styles.flipButton}>
                <Text style={styles.flipText}>Tap to flip →</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
        
        {/* BACK: All stats - Scrollable */}
        <Animated.View style={[styles.cardFace, styles.cardBack, backAnimatedStyle]}>
          {/* Small preview */}
          <View style={styles.backPreview}>
            <Image
              source={{ uri: photo?.image_url || photo?.thumbnail_url }}
              style={styles.backPreviewImage}
              resizeMode="cover"
            />
            {seniorityAchieved && (
              <Animated.Text style={[styles.sparkleIconBack, { opacity: sparkleOpacity }]}>
                ✨
              </Animated.Text>
            )}
            {showXPMultiplier && subscription?.xp_multiplier > 1 && (
              <XPMultiplierBadge 
                multiplier={subscription.xp_multiplier} 
                tier={subscription.tier} 
              />
            )}
          </View>
          
          <ScrollView 
            style={[styles.backContent, { backgroundColor: colors.card }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Base Value */}
            <View style={styles.baseValueSection}>
              <Text style={styles.baseValueLabel}>Base Value</Text>
              <Text style={[styles.baseValueAmount, { color: scenery.gradient[0] }]}>
                {formatDollarValue(baseDollarValue)}
              </Text>
            </View>
            
            {/* ========== XP METER BAR (Below Base Value) ========== */}
            <View style={styles.xpMeterSection}>
              <View style={styles.xpHeader}>
                <View style={styles.xpLevelRow}>
                  <Text style={styles.xpLevelText}>🏆 Lv {level}</Text>
                  <StarsDisplay count={stars} hasGoldenFrame={hasGoldenFrame} />
                </View>
                <Text style={styles.xpCountText}>{formatXP(xp)} / {formatXP(xpForNextLevel)} XP</Text>
              </View>
              
              {/* XP Progress Bar */}
              <View style={styles.xpBarContainer}>
                <View style={styles.xpBarBg}>
                  <LinearGradient
                    colors={['#A855F7', '#EC4899']}
                    style={[styles.xpBarFill, { width: `${Math.min(xpProgressPercent, 100)}%` }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  <Text style={styles.xpBarPercent}>{Math.round(xpProgressPercent)}%</Text>
                </View>
                <View style={styles.xpBarFooter}>
                  <Text style={styles.xpToNext}>{xpToNextLevel} XP to Lv{level + 1}</Text>
                  {levelBonus > 0 && (
                    <Text style={styles.levelBonusText}>+{levelBonus}% boost</Text>
                  )}
                </View>
              </View>
            </View>
            
            {/* Total Dollar Value */}
            <View style={styles.totalValueSection}>
              <Text style={styles.totalValueLabel}>Total Dollar Value</Text>
              <Text style={styles.totalValueAmount}>
                {formatDollarValue(dollarValue)}
              </Text>
            </View>
            
            {/* Authenticity Section */}
            <View style={styles.authenticitySection}>
              <View style={styles.backStatRow}>
                <Text style={styles.backStatLabel}>🔐 Authenticity</Text>
                <Text style={[styles.backStatValue, { color: '#22C55E' }]}>{faceScore + selfieScore}%</Text>
              </View>
              <View style={styles.authenticityDetails}>
                <Text style={styles.authenticityDetail}>Face: {faceScore}%/5%</Text>
                <Text style={styles.authenticityDetail}>Selfie: {selfieScore > 0 ? `${selfieScore}%/5%` : 'Not done'}</Text>
              </View>
              
              {/* Face Match Button */}
              {showFaceMatch && hasFace && !selfieCompleted && (
                <Pressable
                  onPress={() => onFaceMatchPress?.(photo)}
                  style={styles.faceMatchButton}
                >
                  <LinearGradient
                    colors={['#A855F7', '#EC4899']}
                    style={styles.faceMatchGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.faceMatchText}>📷 Face Match (+5%)</Text>
                  </LinearGradient>
                </Pressable>
              )}
              
              {selfieCompleted && (
                <Text style={styles.authenticityLocked}>🔒 Authenticity Locked Forever</Text>
              )}
            </View>
            
            {/* ========== NEW STATS SECTION (Below Authenticity) ========== */}
            <View style={styles.newStatsSection}>
              <Text style={styles.newStatsSectionTitle}>✨ Photo Stats & Bonuses</Text>
              
              {/* 1. Stars */}
              <View style={styles.newStatRow}>
                <Text style={styles.newStatLabel}>⭐ Stars</Text>
                <View style={styles.newStatRight}>
                  <StarsDisplay count={stars} hasGoldenFrame={hasGoldenFrame} />
                  {starBonusValue > 0 && (
                    <Text style={styles.newStatBonus}>+{formatDollarValue(starBonusValue)}</Text>
                  )}
                </View>
              </View>
              
              {/* 2. Level */}
              <View style={styles.newStatRow}>
                <Text style={styles.newStatLabel}>🏆 Level</Text>
                <View style={styles.newStatRight}>
                  <Text style={styles.newStatValue}>Lv {level}</Text>
                  {levelBonus > 0 && (
                    <Text style={styles.newStatBonus}>+{levelBonus}%</Text>
                  )}
                </View>
              </View>
              
              {/* 3. Age */}
              <View style={styles.newStatRow}>
                <Text style={styles.newStatLabel}>📅 Age</Text>
                <View style={styles.newStatRight}>
                  <Text style={styles.newStatValue}>{ageDays} days</Text>
                  {ageBonus > 0 && (
                    <Text style={styles.newStatBonus}>+{formatDollarValue(ageBonus)}</Text>
                  )}
                </View>
              </View>
              
              {/* 4. Reactions */}
              <View style={styles.newStatRow}>
                <Text style={styles.newStatLabel}>❤️ Reactions</Text>
                <View style={styles.newStatRight}>
                  <Text style={[styles.newStatValue, { color: '#EC4899' }]}>{reactions}</Text>
                  {reactionBonus > 0 && (
                    <Text style={styles.newStatBonus}>+{formatDollarValue(reactionBonus)}</Text>
                  )}
                </View>
              </View>
              {reactions > 0 && reactionsToNextBonus < 100 && (
                <Text style={styles.reactionsHint}>{reactionsToNextBonus} to next +$1M</Text>
              )}
              
              {/* 5. BL Coins */}
              <View style={styles.newStatRow}>
                <Text style={styles.newStatLabel}>🪙 BL Coins</Text>
                <View style={styles.newStatRight}>
                  <Text style={[styles.newStatValue, { color: '#FBBF24' }]}>{blCoinsSpent.toLocaleString()} BL</Text>
                  {upgradeValue > 0 && (
                    <Text style={styles.newStatBonus}>+{formatDollarValue(upgradeValue)}</Text>
                  )}
                </View>
              </View>
              
              {/* 6. Seniority */}
              <View style={[
                styles.newStatRow, 
                seniorityAchieved && styles.seniorityRowAchieved
              ]}>
                <Text style={[
                  styles.newStatLabel, 
                  seniorityAchieved && styles.seniorityLabelAchieved
                ]}>⚡ Seniority</Text>
                <View style={styles.newStatRight}>
                  {seniorityAchieved ? (
                    <>
                      <Text style={styles.seniorityMaxText}>✨ MAX</Text>
                      <Text style={styles.newStatBonus}>+{formatDollarValue(seniorityBonusValue)}</Text>
                    </>
                  ) : (
                    <Text style={styles.seniorityRemaining}>{levelsToSeniority} levels to max</Text>
                  )}
                </View>
              </View>
            </View>
            
            {/* Scenery & Streaks */}
            <View style={styles.sceneryStreakSection}>
              <View style={styles.backStatRow}>
                <Text style={styles.backStatLabel}>{scenery.emoji} {scenery.label}</Text>
                {scenery.strong && (
                  <Text style={styles.backStatHint}>💪 vs {scenery.strong}</Text>
                )}
              </View>
              
              {/* Streak */}
              <StreakBadge winStreak={winStreak} loseStreak={loseStreak} />
            </View>
            
            {/* Flip back */}
            <Pressable onPress={handleFlip} style={styles.flipButton}>
              <Text style={styles.flipText}>← Tap to flip back</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  selected: {
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  disabled: {
    opacity: 0.5,
  },
  goldenFrame: {
    borderWidth: 2,
    borderColor: '#FBBF24',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  sparkleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FBBF24',
    zIndex: 10,
  },
  sparkleIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
    fontSize: 16,
  },
  sparkleIconBack: {
    position: 'absolute',
    top: 4,
    right: 4,
    fontSize: 14,
  },
  cardFace: {
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  imageContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  statsContainer: {
    padding: 8,
  },
  photoName: {
    color: '#FBBF24',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dollarValue: {
    fontWeight: 'bold',
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  levelText: {
    color: '#9CA3AF',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  star: {
    fontSize: 10,
  },
  starFilled: {
    color: '#F59E0B',
  },
  starGolden: {
    color: '#FBBF24',
    textShadowColor: '#FBBF24',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  starEmpty: {
    color: '#4B5563',
  },
  sceneryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  sceneryEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  sceneryLabel: {
    color: '#FFFFFF',
  },
  staminaContainer: {
    marginTop: 4,
  },
  staminaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  staminaLabel: {
    color: '#9CA3AF',
  },
  staminaValue: {
    color: '#9CA3AF',
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
  flipButton: {
    marginTop: 4,
    alignItems: 'center',
  },
  flipText: {
    fontSize: 10,
    color: '#6B7280',
  },
  backPreview: {
    height: 50,
    overflow: 'hidden',
  },
  backPreviewImage: {
    width: '100%',
    height: '100%',
    opacity: 0.5,
  },
  backContent: {
    padding: 8,
    maxHeight: 300,
  },
  // Base Value Section
  baseValueSection: {
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  baseValueLabel: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 2,
  },
  baseValueAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // XP Meter Section
  xpMeterSection: {
    backgroundColor: 'rgba(55, 65, 81, 0.5)',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  xpLevelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  xpLevelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  xpCountText: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  xpBarContainer: {
    marginTop: 4,
  },
  xpBarBg: {
    height: 10,
    backgroundColor: '#374151',
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  xpBarPercent: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    textAlign: 'center',
    fontSize: 7,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 10,
  },
  xpBarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  xpToNext: {
    fontSize: 8,
    color: '#6B7280',
  },
  levelBonusText: {
    fontSize: 8,
    color: '#22C55E',
  },
  // Total Value Section
  totalValueSection: {
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 8,
    marginTop: 8,
  },
  totalValueLabel: {
    fontSize: 9,
    color: '#9CA3AF',
  },
  totalValueAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FBBF24',
  },
  // Back stat rows
  backStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  backStatLabel: {
    fontSize: 11,
    color: '#D1D5DB',
  },
  backStatValue: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  backStatHint: {
    fontSize: 9,
    color: '#6B7280',
  },
  streakBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginVertical: 4,
  },
  winStreakBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
  },
  loseStreakBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  streakText: {
    fontSize: 10,
    color: '#FFFFFF',
  },
  // Authenticity Section
  authenticitySection: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    marginTop: 8,
    paddingTop: 8,
  },
  authenticityDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  authenticityDetail: {
    fontSize: 9,
    color: '#6B7280',
  },
  faceMatchButton: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  faceMatchGradient: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  faceMatchText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  authenticityLocked: {
    fontSize: 10,
    color: '#22C55E',
    textAlign: 'center',
    marginTop: 4,
  },
  // NEW STATS SECTION
  newStatsSection: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    marginTop: 8,
    paddingTop: 8,
  },
  newStatsSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D1D5DB',
    marginBottom: 8,
  },
  newStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(55, 65, 81, 0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  newStatLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  newStatRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  newStatValue: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  newStatBonus: {
    fontSize: 9,
    color: '#22C55E',
    fontWeight: '500',
  },
  reactionsHint: {
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'right',
    marginTop: -2,
    marginBottom: 4,
  },
  seniorityRowAchieved: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  seniorityLabelAchieved: {
    color: '#FBBF24',
  },
  seniorityMaxText: {
    fontSize: 10,
    color: '#FBBF24',
    fontWeight: 'bold',
  },
  seniorityRemaining: {
    fontSize: 9,
    color: '#6B7280',
  },
  // Scenery & Streak Section
  sceneryStreakSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(55, 65, 81, 0.5)',
    marginTop: 8,
    paddingTop: 8,
  },
  xpMultiplierBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  xpMultiplierText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default UnifiedPhotoCard;
