/**
 * StreakIndicator Component for Mobile
 * 
 * Displays win/loss streaks with animated visual feedback
 * 
 * Per user spec:
 * - Win Streak 3-10: Show 🔥 icon + streak number + tooltip with multiplier
 * - Lose Streak ≥3: Show 🛡 icon + "Immunity Active" tooltip
 */

import React, { memo, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Modal } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';

// Calculate streak multiplier - PRESERVED: existing formula unchanged
const getStreakMultiplier = (streak) => {
  if (streak >= 10) return 2.5;  // Max multiplier at 10
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
  const [showTooltip, setShowTooltip] = useState(false);

  // UPDATED per user spec: Win streak 3-10, lose streak ≥3
  const isWinStreak = winStreak >= 3 && winStreak <= 10;
  const isLossStreak = lossStreak >= 3;
  const hasImmunity = isLossStreak;  // Immunity active when lose streak ≥3
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
    : (hasImmunity ? '#3B82F6' : colors.error);  // Blue for immunity

  return (
    <>
      <Pressable onPress={() => setShowTooltip(true)}>
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
          {/* UPDATED per user spec: 🔥 for wins, 🛡 for immunity */}
          <Text style={[styles.icon, { fontSize: config.iconSize }]}>
            {isWinStreak ? '🔥' : (hasImmunity ? '🛡' : '💔')}
          </Text>
          
          <View style={styles.textContainer}>
            <Text style={[styles.streakText, { fontSize: config.fontSize }]}>
              {displayStreak} {isWinStreak ? 'Win' : 'Loss'} Streak
            </Text>
            
            {/* Win streak shows multiplier, loss streak shows Immunity */}
            {isWinStreak && multiplier > 1 && (
              <Text style={[styles.multiplierText, { fontSize: config.fontSize - 2 }]}>
                {multiplier}x XP Bonus!
              </Text>
            )}
            {hasImmunity && (
              <Text style={[styles.immunityText, { fontSize: config.fontSize - 2 }]}>
                🛡 Immunity Active
              </Text>
            )}
          </View>
        </Animated.View>
      </Pressable>

      {/* Tooltip Modal */}
      <Modal
        visible={showTooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTooltip(false)}
      >
        <Pressable 
          style={styles.tooltipOverlay}
          onPress={() => setShowTooltip(false)}
        >
          <View style={[styles.tooltipContent, { backgroundColor: colors.card }]}>
            {isWinStreak ? (
              <>
                <Text style={styles.tooltipTitle}>🔥 Win Streak: {winStreak}</Text>
                <Text style={styles.tooltipText}>
                  Current XP Multiplier: {multiplier}x
                </Text>
                <Text style={styles.tooltipSubtext}>
                  Win more to increase your XP bonus!
                </Text>
                <View style={styles.multiplierTable}>
                  <Text style={styles.tableRow}>3 wins = 1.25x | 4 wins = 1.5x</Text>
                  <Text style={styles.tableRow}>5 wins = 1.75x | 6+ wins = 2.0x</Text>
                  <Text style={styles.tableRow}>10 wins = 2.5x (MAX)</Text>
                </View>
              </>
            ) : hasImmunity ? (
              <>
                <Text style={styles.tooltipTitle}>🛡 Immunity Active</Text>
                <Text style={styles.tooltipText}>
                  Loss Streak Protection: {lossStreak} losses
                </Text>
                <Text style={styles.tooltipSubtext}>
                  Your next win will break the streak!
                </Text>
              </>
            ) : null}
            <Text style={styles.tapToClose}>Tap anywhere to close</Text>
          </View>
        </Pressable>
      </Modal>
    </>
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
  immunityText: {
    color: '#93C5FD',
    fontWeight: '600',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    // Styles applied dynamically
  },
  // Tooltip styles
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipContent: {
    padding: 20,
    borderRadius: 16,
    maxWidth: '80%',
    alignItems: 'center',
  },
  tooltipTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  tooltipText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  tooltipSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 12,
  },
  multiplierTable: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  tableRow: {
    fontSize: 12,
    color: '#D1D5DB',
    textAlign: 'center',
    marginVertical: 2,
  },
  tapToClose: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 10,
  },
});

export default StreakIndicator;
