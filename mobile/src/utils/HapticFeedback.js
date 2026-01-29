/**
 * Haptic Feedback Utility for Mobile
 * 
 * Provides unified haptic feedback for game interactions
 * Falls back gracefully on devices without haptic support
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Check if haptics are available
const isHapticsAvailable = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Game-specific haptic patterns
 */
const HapticFeedback = {
  // Light tap - for UI interactions like button presses
  light: async () => {
    if (!isHapticsAvailable) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  },

  // Medium tap - for selections and confirmations
  medium: async () => {
    if (!isHapticsAvailable) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  },

  // Heavy tap - for important actions
  heavy: async () => {
    if (!isHapticsAvailable) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  },

  // Selection changed - for scrolling through options
  selection: async () => {
    if (!isHapticsAvailable) return;
    try {
      await Haptics.selectionAsync();
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  },

  // Success notification - for wins, achievements
  success: async () => {
    if (!isHapticsAvailable) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  },

  // Warning notification - for low stamina, timeout approaching
  warning: async () => {
    if (!isHapticsAvailable) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  },

  // Error notification - for losses, errors
  error: async () => {
    if (!isHapticsAvailable) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  },

  // =============== GAME-SPECIFIC PATTERNS ===============

  // Photo selection in battle
  photoSelect: async () => {
    await HapticFeedback.medium();
  },

  // Tap in tapping arena (fast, light)
  tap: async () => {
    await HapticFeedback.light();
  },

  // Rapid tapping pattern (use sparingly)
  rapidTap: async () => {
    await HapticFeedback.selection();
  },

  // RPS choice selection
  rpsChoice: async () => {
    await HapticFeedback.medium();
  },

  // Round win
  roundWin: async () => {
    await HapticFeedback.success();
  },

  // Round loss
  roundLoss: async () => {
    await HapticFeedback.error();
  },

  // Battle victory
  victory: async () => {
    if (!isHapticsAvailable) return;
    try {
      // Celebratory pattern: success + pause + success
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise(resolve => setTimeout(resolve, 150));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  },

  // Battle defeat
  defeat: async () => {
    if (!isHapticsAvailable) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  },

  // Match found
  matchFound: async () => {
    if (!isHapticsAvailable) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise(resolve => setTimeout(resolve, 100));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  },

  // Countdown tick
  countdownTick: async () => {
    await HapticFeedback.selection();
  },

  // Game start countdown (final 3 seconds)
  countdownFinal: async () => {
    await HapticFeedback.heavy();
  },

  // Photo minted successfully
  mintSuccess: async () => {
    await HapticFeedback.success();
  },

  // Dollar value increase
  valueIncrease: async () => {
    await HapticFeedback.selection();
  },

  // Streak milestone (3, 5, 6+)
  streakMilestone: async () => {
    if (!isHapticsAvailable) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise(resolve => setTimeout(resolve, 100));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.warn('Haptic feedback failed:', error);
    }
  },

  // Button press (generic)
  buttonPress: async () => {
    await HapticFeedback.light();
  },

  // Toggle switch
  toggle: async () => {
    await HapticFeedback.selection();
  },

  // Scroll snap (for carousels, pagination)
  scrollSnap: async () => {
    await HapticFeedback.selection();
  },

  // Pull to refresh
  pullRefresh: async () => {
    await HapticFeedback.medium();
  },
};

export default HapticFeedback;
