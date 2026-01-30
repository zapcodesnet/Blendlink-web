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
 * - Back: All stats displayed BELOW the image
 * - Uniform design across all screens
 */

import React, { useState, memo, useRef } from 'react';
import { 
  View, 
  Text, 
  Image, 
  StyleSheet, 
  Pressable, 
  Animated,
  Dimensions 
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
  
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  
  // Size configurations
  const sizeConfig = {
    small: { width: 100, imageHeight: 80, fontSize: 10 },
    medium: { width: 140, imageHeight: 110, fontSize: 12 },
    large: { width: 180, imageHeight: 150, fontSize: 14 },
  };
  const config = sizeConfig[size] || sizeConfig.medium;
  
  // Photo stats
  const dollarValue = photo?.dollar_value || photo?.base_dollar_value || 0;
  const level = photo?.level || 1;
  const xp = photo?.xp || 0;
  const stars = photo?.stars || getStarsFromLevel(level);
  const hasGoldenFrame = photo?.has_golden_frame || level >= 60;
  const stamina = photo?.current_stamina ?? photo?.stamina ?? 24;
  const maxStamina = photo?.max_stamina || 24;
  const staminaPercent = (stamina / maxStamina) * 100;
  
  // Win/Loss streaks
  const winStreak = photo?.win_streak || 0;
  const loseStreak = photo?.lose_streak || 0;
  
  // Reactions and bonuses
  const reactions = photo?.total_reactions || 0;
  const reactionBonus = photo?.reaction_bonus_value || 0;
  const monthlyGrowth = photo?.monthly_growth_value || 0;
  const upgradeValue = photo?.total_upgrade_value || 0;
  
  // Authenticity
  const faceScore = photo?.face_detection_score || 0;
  const selfieScore = photo?.selfie_match_score || 0;
  const selfieCompleted = photo?.selfie_match_completed || false;
  const hasFace = photo?.has_face || false;
  
  // Level bonus
  const levelBonus = photo?.level_bonus_percent || Math.floor(level / 5) * 2;
  
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
        {/* FRONT: Clean image only */}
        <Animated.View style={[styles.cardFace, frontAnimatedStyle]}>
          {/* Clean image - NO overlays */}
          <View style={[styles.imageContainer, { height: config.imageHeight }]}>
            <Image
              source={{ uri: photo?.image_url || photo?.thumbnail_url }}
              style={styles.image}
              resizeMode="cover"
            />
          </View>
          
          {/* Stats BELOW image only */}
          {showStats && (
            <View style={[styles.statsContainer, { backgroundColor: colors.card }]}>
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
              
              {/* Stamina Bar */}
              {showStamina && (
                <View style={styles.staminaContainer}>
                  <View style={styles.staminaHeader}>
                    <Text style={[styles.staminaLabel, { fontSize: config.fontSize - 4 }]}>⚡ Stamina</Text>
                    <Text style={[styles.staminaValue, { fontSize: config.fontSize - 4 }]}>{stamina}/{maxStamina}</Text>
                  </View>
                  <View style={styles.staminaBarBg}>
                    <View 
                      style={[
                        styles.staminaBarFill,
                        { width: `${staminaPercent}%`, backgroundColor: getStaminaColor() }
                      ]}
                    />
                  </View>
                </View>
              )}
              
              {/* Flip indicator */}
              <Pressable onPress={handleFlip} style={styles.flipButton}>
                <Text style={styles.flipText}>Tap to flip →</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
        
        {/* BACK: All stats */}
        <Animated.View style={[styles.cardFace, styles.cardBack, backAnimatedStyle]}>
          {/* Small preview */}
          <View style={styles.backPreview}>
            <Image
              source={{ uri: photo?.image_url || photo?.thumbnail_url }}
              style={styles.backPreviewImage}
              resizeMode="cover"
            />
            {showXPMultiplier && subscription?.xp_multiplier > 1 && (
              <XPMultiplierBadge 
                multiplier={subscription.xp_multiplier} 
                tier={subscription.tier} 
              />
            )}
          </View>
          
          <View style={[styles.backContent, { backgroundColor: colors.card }]}>
            {/* Core Dollar Value */}
            <View style={styles.backValueContainer}>
              <Text style={[styles.backDollarValue, { color: scenery.gradient[0] }]}>
                {formatDollarValue(dollarValue)}
              </Text>
              <Text style={styles.backValueLabel}>Total Power</Text>
            </View>
            
            {/* Level & XP */}
            <View style={styles.backStatRow}>
              <Text style={styles.backStatLabel}>🏆 Lv {level}</Text>
              <StarsDisplay count={stars} hasGoldenFrame={hasGoldenFrame} />
              <Text style={styles.backStatValue}>{formatXP(xp)} XP</Text>
            </View>
            
            {/* Level Bonus */}
            {levelBonus > 0 && (
              <View style={styles.backStatRow}>
                <Text style={styles.backStatLabel}>📈 Level Bonus</Text>
                <Text style={[styles.backStatValue, { color: '#22C55E' }]}>+{levelBonus}%</Text>
              </View>
            )}
            
            {/* Scenery */}
            <View style={styles.backStatRow}>
              <Text style={styles.backStatLabel}>{scenery.emoji} {scenery.label}</Text>
              {scenery.strong && (
                <Text style={styles.backStatHint}>Strong vs {scenery.strong}</Text>
              )}
            </View>
            
            {/* Streak */}
            <StreakBadge winStreak={winStreak} loseStreak={loseStreak} />
            
            {/* Reactions */}
            {reactions > 0 && (
              <View style={styles.backStatRow}>
                <Text style={[styles.backStatLabel, { color: '#EC4899' }]}>❤️ {reactions}</Text>
                <Text style={[styles.backStatValue, { color: '#EC4899' }]}>+{formatDollarValue(reactionBonus)}</Text>
              </View>
            )}
            
            {/* Monthly Growth */}
            {monthlyGrowth > 0 && (
              <View style={styles.backStatRow}>
                <Text style={[styles.backStatLabel, { color: '#3B82F6' }]}>📅 Monthly</Text>
                <Text style={[styles.backStatValue, { color: '#3B82F6' }]}>+{formatDollarValue(monthlyGrowth)}</Text>
              </View>
            )}
            
            {/* Authenticity */}
            <View style={styles.authenticitySection}>
              <View style={styles.backStatRow}>
                <Text style={styles.backStatLabel}>🔐 Authenticity</Text>
                <Text style={[styles.backStatValue, { color: '#22C55E' }]}>{faceScore + selfieScore}%</Text>
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
                <Text style={styles.authenticityLocked}>🔒 Authenticity Locked</Text>
              )}
            </View>
            
            {/* Flip back */}
            <Pressable onPress={handleFlip} style={styles.flipButton}>
              <Text style={styles.flipText}>← Tap to flip back</Text>
            </Pressable>
          </View>
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
  },
  backValueContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  backDollarValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  backValueLabel: {
    fontSize: 10,
    color: '#6B7280',
  },
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
  authenticitySection: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    marginTop: 8,
    paddingTop: 8,
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
