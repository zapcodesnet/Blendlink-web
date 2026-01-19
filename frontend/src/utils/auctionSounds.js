/**
 * Blendlink Auction Sound Effects & Animations
 * Web Audio API for sound generation (no external files needed)
 */

// Sound effect generator using Web Audio API
class AuctionSoundEffects {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    this.volume = 0.5;
  }

  init() {
    if (typeof window !== 'undefined' && !this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  // Resume audio context (required after user interaction)
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // Generate a tone
  playTone(frequency, duration, type = 'sine', gainValue = 0.3) {
    if (!this.enabled || !this.audioContext) return;
    
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(gainValue * this.volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // Play multiple tones in sequence
  playSequence(notes, interval = 0.1) {
    notes.forEach((note, i) => {
      setTimeout(() => {
        this.playTone(note.freq, note.duration || 0.2, note.type || 'sine', note.gain || 0.3);
      }, i * interval * 1000);
    });
  }

  // ============== AUCTION SOUND EFFECTS ==============

  // Gavel slam - dramatic impact sound
  gavelSlam() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    // Low thud
    this.playTone(80, 0.3, 'sine', 0.6);
    // Higher impact
    setTimeout(() => this.playTone(200, 0.15, 'triangle', 0.4), 20);
    // Wood crack
    setTimeout(() => this.playTone(800, 0.08, 'square', 0.2), 30);
  }

  // Paddle raise - whoosh sound
  paddleRaise() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    // Swoosh up
    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(0.2 * this.volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }

  // Bid placed - cash register ding
  bidPlaced() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    // High ding
    this.playTone(880, 0.15, 'sine', 0.4);
    setTimeout(() => this.playTone(1100, 0.1, 'sine', 0.3), 100);
  }

  // Coins counting - multiple clicks
  coinsCount() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        this.playTone(1200 + Math.random() * 400, 0.05, 'square', 0.15);
      }, i * 60);
    }
  }

  // Round win - triumphant fanfare
  roundWin() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    this.playSequence([
      { freq: 523, duration: 0.15 },  // C
      { freq: 659, duration: 0.15 },  // E
      { freq: 784, duration: 0.3 },   // G
      { freq: 1047, duration: 0.4 },  // High C
    ], 0.12);
  }

  // Round lose - sad trombone
  roundLose() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    this.playSequence([
      { freq: 392, duration: 0.3 },   // G
      { freq: 370, duration: 0.3 },   // F#
      { freq: 349, duration: 0.3 },   // F
      { freq: 330, duration: 0.5 },   // E
    ], 0.25);
  }

  // Battle victory - epic fanfare
  battleVictory() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    // Triumphant chord progression
    this.playTone(261, 0.3, 'sine', 0.3);  // C
    this.playTone(329, 0.3, 'sine', 0.3);  // E
    this.playTone(392, 0.3, 'sine', 0.3);  // G
    
    setTimeout(() => {
      this.playTone(349, 0.3, 'sine', 0.3);  // F
      this.playTone(440, 0.3, 'sine', 0.3);  // A
      this.playTone(523, 0.3, 'sine', 0.3);  // C
    }, 300);
    
    setTimeout(() => {
      this.playTone(392, 0.5, 'sine', 0.4);  // G
      this.playTone(494, 0.5, 'sine', 0.4);  // B
      this.playTone(587, 0.5, 'sine', 0.4);  // D
      this.playTone(784, 0.5, 'sine', 0.4);  // High G
    }, 600);
  }

  // Battle defeat - dramatic loss
  battleDefeat() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    this.playSequence([
      { freq: 440, duration: 0.4, gain: 0.3 },
      { freq: 415, duration: 0.4, gain: 0.25 },
      { freq: 392, duration: 0.4, gain: 0.2 },
      { freq: 349, duration: 0.6, gain: 0.15 },
    ], 0.35);
  }

  // Countdown tick
  tick() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    this.playTone(800, 0.05, 'square', 0.2);
  }

  // Photo clash - dramatic impact
  photoClash() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    // Impact
    this.playTone(150, 0.2, 'sine', 0.5);
    this.playTone(100, 0.3, 'triangle', 0.4);
    
    // Shimmer
    setTimeout(() => {
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          this.playTone(1000 + i * 200, 0.1, 'sine', 0.2);
        }, i * 50);
      }
    }, 100);
  }

  // Bankrupt alert
  bankrupt() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    // Alarm-like sound
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playTone(300, 0.15, 'square', 0.3);
        setTimeout(() => this.playTone(200, 0.15, 'square', 0.3), 150);
      }, i * 400);
    }
  }

  // Money transfer
  moneyTransfer() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    // Ascending coins
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.playTone(600 + i * 100, 0.08, 'sine', 0.25);
      }, i * 80);
    }
  }

  // Button hover
  buttonHover() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    this.playTone(600, 0.03, 'sine', 0.1);
  }

  // Selection confirm
  selectionConfirm() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    this.playTone(800, 0.08, 'sine', 0.25);
    setTimeout(() => this.playTone(1000, 0.1, 'sine', 0.2), 80);
  }

  // Match found
  matchFound() {
    if (!this.enabled) return;
    this.init();
    this.resume();
    
    this.playSequence([
      { freq: 600, duration: 0.1 },
      { freq: 800, duration: 0.1 },
      { freq: 1000, duration: 0.15 },
      { freq: 1200, duration: 0.2 },
    ], 0.08);
  }
}

// Create singleton instance
const auctionSounds = new AuctionSoundEffects();

export default auctionSounds;
