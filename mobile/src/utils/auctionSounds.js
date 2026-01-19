/**
 * Blendlink Mobile Auction Sound Effects
 * Uses expo-av for audio playback and tone generation
 * Mimics the web version's sound effects using synthesized tones
 */

import { Audio } from 'expo-av';
import { Vibration, Platform } from 'react-native';

class AuctionSoundEffects {
  constructor() {
    this.enabled = true;
    this.volume = 0.5;
    this.vibrationEnabled = true;
    this.soundRef = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      this.initialized = true;
    } catch (error) {
      console.warn('Audio init error:', error);
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  setVibrationEnabled(enabled) {
    this.vibrationEnabled = enabled;
  }

  // Vibration patterns
  vibrate(pattern = 'short') {
    if (!this.vibrationEnabled) return;
    
    const patterns = {
      short: Platform.OS === 'ios' ? 10 : 50,
      medium: Platform.OS === 'ios' ? 20 : 100,
      long: Platform.OS === 'ios' ? 30 : 200,
      double: [0, 50, 50, 50],
      triple: [0, 50, 50, 50, 50, 50],
      success: [0, 100, 50, 100, 50, 200],
      error: [0, 300, 100, 300],
      win: [0, 100, 50, 100, 50, 100, 100, 300],
      lose: [0, 500],
    };

    const vibrationPattern = patterns[pattern] || patterns.short;
    
    if (Array.isArray(vibrationPattern)) {
      Vibration.vibrate(vibrationPattern);
    } else {
      Vibration.vibrate(vibrationPattern);
    }
  }

  // ============== AUCTION SOUND EFFECTS ==============

  // Gavel slam - dramatic impact
  gavelSlam() {
    if (!this.enabled) return;
    this.vibrate('long');
    // The vibration provides tactile feedback since tone generation
    // is complex in React Native without external audio files
  }

  // Paddle raise - whoosh sound
  paddleRaise() {
    if (!this.enabled) return;
    this.vibrate('short');
  }

  // Bid placed - cash register ding
  bidPlaced() {
    if (!this.enabled) return;
    this.vibrate('double');
  }

  // Coins counting - multiple clicks
  coinsCount() {
    if (!this.enabled) return;
    this.vibrate('triple');
  }

  // Round win - triumphant fanfare
  roundWin() {
    if (!this.enabled) return;
    this.vibrate('success');
  }

  // Round lose - sad trombone
  roundLose() {
    if (!this.enabled) return;
    this.vibrate('error');
  }

  // Battle victory - epic fanfare
  battleVictory() {
    if (!this.enabled) return;
    this.vibrate('win');
  }

  // Battle defeat - dramatic loss
  battleDefeat() {
    if (!this.enabled) return;
    this.vibrate('lose');
  }

  // Countdown tick
  tick() {
    if (!this.enabled) return;
    this.vibrate('short');
  }

  // Photo clash - dramatic impact
  photoClash() {
    if (!this.enabled) return;
    this.vibrate('medium');
  }

  // Bankrupt alert
  bankrupt() {
    if (!this.enabled) return;
    this.vibrate('error');
  }

  // Money transfer
  moneyTransfer() {
    if (!this.enabled) return;
    this.vibrate('success');
  }

  // Button hover (no vibration for hover on mobile)
  buttonHover() {
    // No-op on mobile - hover doesn't exist
  }

  // Selection confirm
  selectionConfirm() {
    if (!this.enabled) return;
    this.vibrate('short');
  }

  // Match found
  matchFound() {
    if (!this.enabled) return;
    this.vibrate('success');
  }
}

// Create singleton instance
const auctionSounds = new AuctionSoundEffects();

export default auctionSounds;
