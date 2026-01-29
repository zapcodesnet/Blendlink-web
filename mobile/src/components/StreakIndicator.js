/**
 * StreakIndicator Component for Mobile
 * 
 * Displays win/loss streaks with animated visual feedback
 * Shows multiplier bonus for win streaks
 */

import React, { memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

// Calculate streak multiplier
const getStreakMultiplier = (streak) => {
  if (streak >= 6) return 2.0;
  if (streak >= 5) return 1.75;
  if (streak >= 4) return 1.5;
  if (streak >= 3) return 1.25;
  return 1.0;
};

const StreakIndicator = memo(function StreakIndicator({
  winStreak = 0,
  lossStreak = 0,
  showAnimation = true,
  size = 'medium', // 'small' | 'medium' | 'large'
  style,
}) {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const isWinStreak = winStreak >= 3;
  const isLossStreak = lossStreak >= 3;
  const displayStreak = isWinStreak ? winStreak : (isLossStreak ? lossStreak : 0);
  const multiplier = isWinStreak ? getStreakMultiplier(winStreak) : 1;

  // Animate on streak change
  useEffect(() => {
    if (!showAnimation || displayStreak < 3) return;

    // Haptic on new streak milestone
    if (isWinStreak) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    // Glow animation for win streaks
    if (isWinStreak) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }

    return () => {
      scaleAnim.setValue(1);
      glowAnim.setValue(0);
    };
  }, [displayStreak, isWinStreak, showAnimation]);

  // Don't render if no streak
  if (displayStreak < 3) return null;

  // Size configurations
  const sizeConfig = {
    small: { padding: 6, fontSize: 10, iconSize: 12 },
    medium: { padding: 10, fontSize: 12, iconSize: 16 },
    large: { padding: 14, fontSize: 14, iconSize: 20 },
  };
  const config = sizeConfig[size] || sizeConfig.medium;

  const backgroundColor = isWinStreak 
    ? colors.gold 
    : (isLossStreak ? colors.error : colors.cardSecondary);

  return (
    <Animated.View 
      style={[
        styles.container,
        { 
          backgroundColor,
          paddingHorizontal: config.padding,
          paddingVertical: config.padding / 2,
          transform: [{ scale: scaleAnim }],
        },
        style,
      ]}
    >
      <Text style={[styles.icon, { fontSize: config.iconSize }]}>
        {isWinStreak ? '🔥' : '💔'}
      </Text>
      
      <View style={styles.textContainer}>
        <Text style={[styles.streakText, { fontSize: config.fontSize }]}>
          {displayStreak} {isWinStreak ? 'Win' : 'Loss'} Streak
        </Text>
        
        {isWinStreak && multiplier > 1 && (
          <Text style={[styles.multiplierText, { fontSize: config.fontSize - 2 }]}>
            {multiplier}x XP Bonus!
          </Text>
        )}
      </View>
    </Animated.View>
  );
});

// Simple streak dots display
export const StreakDots = memo(function StreakDots({
  streak = 0,
  isWinStreak = true,
  maxDots = 6,
  size = 'small',
  style,
}) {
  const { colors } = useTheme();
  
  const dotSize = size === 'small' ? 8 : size === 'medium' ? 12 : 16;
  const dotColor = isWinStreak ? colors.gold : colors.error;
  const emptyColor = colors.cardSecondary;

  return (
    <View style={[styles.dotsContainer, style]}>
      {Array.from({ length: maxDots }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: index < streak ? dotColor : emptyColor,
              marginHorizontal: 2,
            },
          ]}
        />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  icon: {
    marginRight: 6,
  },
  textContainer: {
    flexDirection: 'column',
  },
  streakText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  multiplierText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    // Styles applied dynamically
  },
});

export default StreakIndicator;
