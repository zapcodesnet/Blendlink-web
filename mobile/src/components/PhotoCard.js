/**
 * PhotoCard Component for Mobile
 * 
 * Reusable photo card with scenery type, dollar value, and stamina display
 * Used across game screens, marketplace, and photo galleries
 */

import React, { memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Animated, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

// Scenery configuration
export const SCENERY_CONFIG = {
  natural: { 
    gradient: ['#22C55E', '#10B981'], 
    emoji: '🌿', 
    label: 'Natural',
    strong: 'water',
    weak: 'manmade'
  },
  water: { 
    gradient: ['#3B82F6', '#06B6D4'], 
    emoji: '🌊', 
    label: 'Water',
    strong: 'manmade',
    weak: 'natural'
  },
  manmade: { 
    gradient: ['#F97316', '#EF4444'], 
    emoji: '🏙️', 
    label: 'Man-made',
    strong: 'natural',
    weak: 'water'
  },
  neutral: {
    gradient: ['#6B7280', '#4B5563'],
    emoji: '⬜',
    label: 'Neutral',
    strong: null,
    weak: null
  }
};

// Format dollar value for display
export const formatDollarValue = (value) => {
  if (!value || value === 0) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
};

const PhotoCard = memo(function PhotoCard({
  photo,
  onPress,
  selected = false,
  disabled = false,
  showStamina = true,
  showValue = true,
  size = 'medium', // 'small' | 'medium' | 'large'
  style,
}) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;

  const handlePress = () => {
    if (disabled) return;
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    
    onPress?.(photo);
  };

  // Size configurations
  const sizeConfig = {
    small: { width: 80, imageSize: 60, fontSize: 10, emojiSize: 24 },
    medium: { width: 120, imageSize: 100, fontSize: 12, emojiSize: 32 },
    large: { width: 160, imageSize: 140, fontSize: 14, emojiSize: 40 },
  };
  const config = sizeConfig[size] || sizeConfig.medium;

  const staminaPercent = photo?.stamina ?? 100;
  const hasImage = photo?.image_url || photo?.thumbnail_url;

  return (
    <Pressable onPress={handlePress} disabled={disabled}>
      <Animated.View 
        style={[
          styles.container,
          { 
            width: config.width,
            backgroundColor: colors.card,
            borderColor: selected ? colors.primary : colors.border,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: scaleAnim }],
          },
          style,
        ]}
      >
        {/* Image/Thumbnail */}
        <View style={[styles.imageContainer, { height: config.imageSize }]}>
          {hasImage ? (
            <Image
              source={{ uri: photo.image_url || photo.thumbnail_url }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: scenery.gradient[0] }]}>
              <Text style={[styles.placeholderEmoji, { fontSize: config.emojiSize }]}>
                {scenery.emoji}
              </Text>
            </View>
          )}

          {/* Scenery Badge */}
          <View style={[styles.sceneryBadge, { backgroundColor: scenery.gradient[0] }]}>
            <Text style={[styles.sceneryText, { fontSize: config.fontSize - 2 }]}>
              {scenery.label}
            </Text>
          </View>

          {/* Selection Indicator */}
          {selected && (
            <View style={[styles.selectedBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.selectedCheck}>✓</Text>
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoContainer}>
          <Text 
            style={[styles.name, { color: colors.text, fontSize: config.fontSize }]} 
            numberOfLines={1}
          >
            {photo?.name || 'Unnamed Photo'}
          </Text>

          {showValue && (
            <Text style={[styles.value, { color: colors.gold, fontSize: config.fontSize }]}>
              {formatDollarValue(photo?.dollar_value)}
            </Text>
          )}

          {showStamina && (
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
              <Text style={[styles.staminaText, { color: colors.textMuted, fontSize: config.fontSize - 2 }]}>
                {Math.round(staminaPercent)}%
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    opacity: 0.7,
  },
  sceneryBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sceneryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  selectedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedCheck: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoContainer: {
    padding: 8,
  },
  name: {
    fontWeight: '600',
    marginBottom: 2,
  },
  value: {
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
    marginRight: 6,
    overflow: 'hidden',
  },
  staminaBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  staminaText: {
    minWidth: 30,
  },
});

export default PhotoCard;
