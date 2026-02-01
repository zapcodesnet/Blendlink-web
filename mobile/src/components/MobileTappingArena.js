/**
 * TappingArena Component for Mobile
 * 
 * Real-time tapping game for Photo Auction Bidding Rounds (1, 3, 5)
 * 
 * Features:
 * - 30 TPS max rate limit (anti-cheat)
 * - Warning toast on rate exceeded
 * - Haptic feedback on every valid tap
 * - Dollar meter animation
 * - Confetti on win, shake on loss
 * - WebSocket sync for PVP
 * - Bot tapping for PvB
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { photoGameAPI } from '../services/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============== CONSTANTS ==============
const BASE_TAPS_TO_WIN = 200;
const MAX_TAPS_PER_SECOND = 30; // 30 TPS rate limit
const COUNTDOWN_SECONDS = 10;
const ROUND_DURATION_SECONDS = 15;

// Scenery config
const SCENERY_CONFIG = {
  natural: { gradient: ['#22C55E', '#10B981'], emoji: '🌿', label: 'Natural', strong: 'water', weak: 'manmade' },
  water: { gradient: ['#3B82F6', '#06B6D4'], emoji: '🌊', label: 'Water', strong: 'manmade', weak: 'natural' },
  manmade: { gradient: ['#F97316', '#EF4444'], emoji: '🏙️', label: 'Man-made', strong: 'natural', weak: 'water' },
  neutral: { gradient: ['#6B7280', '#4B5563'], emoji: '⬜', label: 'Neutral', strong: null, weak: 'all' },
};

// Format dollar value
const formatDollarValue = (value) => {
  if (!value || value === 0) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
};

// Calculate required taps based on power difference
const calculateRequiredTaps = (playerValue, opponentValue, baseTaps = BASE_TAPS_TO_WIN) => {
  const totalPower = playerValue + opponentValue;
  if (totalPower === 0) return baseTaps;
  
  const playerRatio = playerValue / totalPower;
  const requiredTaps = Math.round(baseTaps * (1.5 - playerRatio));
  return Math.max(50, Math.min(400, requiredTaps));
};

// ============== TOAST COMPONENT ==============
const Toast = ({ message, visible, type = 'warning' }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1000),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const bgColor = type === 'warning' ? '#F59E0B' : type === 'error' ? '#EF4444' : '#22C55E';

  return (
    <Animated.View style={[styles.toast, { opacity, backgroundColor: bgColor }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

// ============== CONFETTI COMPONENT ==============
const Confetti = ({ active }) => {
  const particles = useRef(
    Array.from({ length: 30 }).map(() => ({
      x: new Animated.Value(Math.random() * SCREEN_WIDTH),
      y: new Animated.Value(-20),
      rotation: new Animated.Value(0),
      color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1'][Math.floor(Math.random() * 5)],
    }))
  ).current;

  useEffect(() => {
    if (active) {
      particles.forEach((p, i) => {
        p.x.setValue(Math.random() * SCREEN_WIDTH);
        p.y.setValue(-20);
        p.rotation.setValue(0);

        Animated.parallel([
          Animated.timing(p.y, {
            toValue: SCREEN_HEIGHT + 50,
            duration: 2500 + Math.random() * 1000,
            delay: i * 50,
            useNativeDriver: true,
          }),
          Animated.timing(p.rotation, {
            toValue: 360 * (Math.random() > 0.5 ? 1 : -1),
            duration: 2500,
            delay: i * 50,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [active]);

  if (!active) return null;

  return (
    <View style={styles.confettiContainer} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.confetti,
            {
              backgroundColor: p.color,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { rotate: p.rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

// ============== MAIN COMPONENT ==============
export default function MobileTappingArena({
  playerPhoto,
  opponentPhoto,
  playerStats,
  opponentStats,
  isBot = false,
  botDifficulty = 'medium',
  websocket = null,
  onRoundComplete,
  onTap,
  roundNumber = 1,
  sessionId = null, // For API polling fallback
}) {
  const { colors } = useTheme();
  
  // Game state
  const [gamePhase, setGamePhase] = useState('waiting'); // waiting, countdown, active, finished
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [timeRemaining, setTimeRemaining] = useState(ROUND_DURATION_SECONDS);
  
  // Tap tracking
  const [playerTaps, setPlayerTaps] = useState(0);
  const [opponentTaps, setOpponentTaps] = useState(0);
  const [tapsThisSecond, setTapsThisSecond] = useState(0);
  
  // Dollar amounts for display (from API)
  const [playerDollar, setPlayerDollar] = useState(0);
  const [opponentDollar, setOpponentDollar] = useState(0);
  
  // Warning state
  const [showRateWarning, setShowRateWarning] = useState(false);
  const lastWarningTime = useRef(0);
  
  // Result state
  const [winner, setWinner] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Timers
  const gameTimerRef = useRef(null);
  const botTimerRef = useRef(null);
  const tapResetRef = useRef(null);
  const pollIntervalRef = useRef(null);
  
  // Refs for polling to avoid stale closures
  const playerTapsRef = useRef(playerTaps);
  const opponentTapsRef = useRef(opponentTaps);
  
  // Keep refs updated
  useEffect(() => {
    playerTapsRef.current = playerTaps;
  }, [playerTaps]);
  
  useEffect(() => {
    opponentTapsRef.current = opponentTaps;
  }, [opponentTaps]);
  
  // Calculate effective values with all bonuses
  const playerEffectiveValue = playerPhoto?.dollar_value || 0;
  const opponentEffectiveValue = opponentPhoto?.dollar_value || 0;
  
  // Calculate required taps
  const playerRequiredTaps = calculateRequiredTaps(playerEffectiveValue, opponentEffectiveValue);
  const opponentRequiredTaps = calculateRequiredTaps(opponentEffectiveValue, playerEffectiveValue);
  
  // Calculate progress
  const playerProgress = Math.min((playerTaps / playerRequiredTaps) * 100, 100);
  const opponentProgress = Math.min((opponentTaps / opponentRequiredTaps) * 100, 100);
  
  // Scenery info
  const playerScenery = SCENERY_CONFIG[playerPhoto?.scenery_type] || SCENERY_CONFIG.natural;
  const opponentScenery = SCENERY_CONFIG[opponentPhoto?.scenery_type] || SCENERY_CONFIG.natural;

  // ============== HANDLERS ==============

  // Handle tap
  const handleTap = useCallback(() => {
    if (gamePhase !== 'active' || winner) return;
    
    // Anti-cheat: Max 30 taps per second
    if (tapsThisSecond >= MAX_TAPS_PER_SECOND) {
      const now = Date.now();
      // Show warning toast (debounced to 1 per second)
      if (now - lastWarningTime.current > 1000) {
        setShowRateWarning(true);
        lastWarningTime.current = now;
        setTimeout(() => setShowRateWarning(false), 1500);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      // Discard excess taps
      return;
    }
    
    // Valid tap - increment counters
    const newTaps = playerTaps + 1;
    setPlayerTaps(newTaps);
    setTapsThisSecond(prev => prev + 1);
    
    // Haptic feedback for every valid tap
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Pulse animation
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.02, duration: 30, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 30, useNativeDriver: true }),
    ]).start();
    
    // Send to WebSocket if PVP
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({ type: 'tap', count: 1 }));
    }
    
    // ALWAYS send to API as fallback (critical for sync when WS fails)
    sendTapToApi(1);
    
    // Callback
    onTap?.(newTaps);
    
    // Check win condition
    if (newTaps >= playerRequiredTaps) {
      handlePlayerWin();
    }
  }, [gamePhase, winner, playerTaps, playerRequiredTaps, tapsThisSecond, websocket, onTap, sendTapToApi]);

  // Handle player win
  const handlePlayerWin = useCallback(() => {
    if (winner) return;
    
    setGamePhase('finished');
    setWinner('player');
    setShowConfetti(true);
    
    // Strong haptic for win
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Vibration.vibrate([100, 50, 100, 50, 200]);
    
    // Cleanup timers
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (botTimerRef.current) clearInterval(botTimerRef.current);
    
    // Callback
    setTimeout(() => {
      onRoundComplete?.('player');
    }, 2500);
  }, [winner, onRoundComplete]);

  // Handle opponent win
  const handleOpponentWin = useCallback(() => {
    if (winner) return;
    
    setGamePhase('finished');
    setWinner('opponent');
    
    // Screen shake animation
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 15, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -15, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
    
    // Error haptic for loss
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([200, 100, 200]);
    
    // Cleanup timers
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (botTimerRef.current) clearInterval(botTimerRef.current);
    
    // Callback
    setTimeout(() => {
      onRoundComplete?.('opponent');
    }, 2500);
  }, [winner, onRoundComplete]);

  // ============== EFFECTS ==============

  // Reset taps counter every second
  useEffect(() => {
    if (gamePhase === 'active') {
      tapResetRef.current = setInterval(() => {
        setTapsThisSecond(0);
      }, 1000);
    }
    
    return () => {
      if (tapResetRef.current) clearInterval(tapResetRef.current);
    };
  }, [gamePhase]);

  // Store refs to avoid stale closures in polling
  const handleOpponentWinRef = useRef(handleOpponentWin);
  useEffect(() => {
    handleOpponentWinRef.current = handleOpponentWin;
  }, [handleOpponentWin]);
  
  const opponentRequiredTapsRef = useRef(opponentRequiredTaps);
  useEffect(() => {
    opponentRequiredTapsRef.current = opponentRequiredTaps;
  }, [opponentRequiredTaps]);
  
  // API POLLING FOR TAP STATE (Critical for real-time sync when WebSocket fails)
  useEffect(() => {
    if (gamePhase !== 'active' || !sessionId || isBot) return;
    
    const pollTapState = async () => {
      try {
        const data = await photoGameAPI.pvpGetTapState(sessionId);
        
        if (data) {
          // Update opponent taps and dollar from server
          const serverOpponentTaps = data.opponent_taps || 0;
          const serverOpponentDollar = data.opponent_dollar || 0;
          
          if (serverOpponentTaps > opponentTaps) {
            console.log('[Mobile TapPoll] Opponent taps updated:', serverOpponentTaps, 'dollar:', serverOpponentDollar);
            setOpponentTaps(serverOpponentTaps);
            setOpponentDollar(serverOpponentDollar);
            
            // Check if opponent has won (critical for sync!)
            if (serverOpponentTaps >= opponentRequiredTapsRef.current && !winner) {
              console.log('[Mobile TapPoll] Opponent has won via poll!');
              handleOpponentWinRef.current?.();
            }
          }
        }
      } catch (err) {
        // Silent fail - polling should not interrupt gameplay
        console.debug('[Mobile TapPoll] Error:', err.message);
      }
    };
    
    // Poll every 150ms for more responsive updates
    pollIntervalRef.current = setInterval(pollTapState, 150);
    pollTapState(); // Initial poll
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [gamePhase, sessionId, isBot, opponentTaps, winner]);

  // Send taps to API (in addition to WebSocket)
  const sendTapToApi = useCallback(async (tapCount) => {
    if (!sessionId || isBot) return;
    
    try {
      const response = await photoGameAPI.pvpSubmitTap(sessionId, tapCount);
      
      if (response) {
        // Update dollar display from API response
        setPlayerDollar(response.my_dollar || 0);
        if (response.opponent_taps > opponentTaps) {
          setOpponentTaps(response.opponent_taps);
          setOpponentDollar(response.opponent_dollar || 0);
        }
      }
    } catch (err) {
      console.debug('[Mobile TapAPI] Error:', err.message);
    }
  }, [sessionId, isBot, opponentTaps]);

  // Auto-start countdown
  useEffect(() => {
    if (gamePhase === 'waiting') {
      const startTimeout = setTimeout(() => {
        setGamePhase('countdown');
      }, 500);
      return () => clearTimeout(startTimeout);
    }
  }, [gamePhase]);

  // Countdown timer
  useEffect(() => {
    if (gamePhase === 'countdown') {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setGamePhase('active');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            return 0;
          }
          Haptics.selectionAsync();
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [gamePhase]);

  // Game timer
  useEffect(() => {
    if (gamePhase === 'active') {
      gameTimerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(gameTimerRef.current);
            
            // Time's up - determine winner by progress
            const pProgress = playerTaps / playerRequiredTaps;
            const oProgress = opponentTaps / opponentRequiredTaps;
            
            if (pProgress >= oProgress) {
              handlePlayerWin();
            } else {
              handleOpponentWin();
            }
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      };
    }
  }, [gamePhase, playerTaps, opponentTaps, playerRequiredTaps, opponentRequiredTaps]);

  // Bot tapping (PvB mode) - Updated for 30 TPS max
  useEffect(() => {
    if (gamePhase === 'active' && isBot) {
      const botSpeeds = {
        easy: { min: 5, max: 10 },      // Casual: 5-10 TPS
        medium: { min: 10, max: 18 },   // Moderate: 10-18 TPS
        hard: { min: 18, max: 28 },     // Challenging: 18-28 TPS (near max)
      };
      
      const speed = botSpeeds[botDifficulty] || botSpeeds.medium;
      
      botTimerRef.current = setInterval(() => {
        setOpponentTaps(prev => {
          const tapsToAdd = Math.floor(Math.random() * (speed.max - speed.min + 1)) + speed.min;
          const newTaps = prev + tapsToAdd;
          
          if (newTaps >= opponentRequiredTaps && !winner) {
            handleOpponentWin();
          }
          
          return newTaps;
        });
      }, 1000);
      
      return () => {
        if (botTimerRef.current) clearInterval(botTimerRef.current);
      };
    }
  }, [gamePhase, isBot, botDifficulty, opponentRequiredTaps, winner]);

  // WebSocket handler (PVP mode)
  useEffect(() => {
    if (websocket && !isBot) {
      const handleMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'bid_update' && data.player_id !== 'self') {
            setOpponentTaps(data.current_bids || 0);
            
            if (data.current_bids >= opponentRequiredTaps && !winner) {
              handleOpponentWin();
            }
          } else if (data.type === 'auction_end') {
            if (data.winner_id === 'player' || data.winner_id === playerStats?.user_id) {
              handlePlayerWin();
            } else {
              handleOpponentWin();
            }
          }
        } catch (e) {
          console.error('WebSocket message error:', e);
        }
      };
      
      websocket.addEventListener('message', handleMessage);
      return () => websocket.removeEventListener('message', handleMessage);
    }
  }, [websocket, isBot, opponentRequiredTaps, winner, playerStats]);

  // ============== RENDER ==============

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          backgroundColor: colors.background,
          transform: [{ translateX: shakeAnim }],
        }
      ]}
    >
      {/* Rate Warning Toast */}
      <Toast 
        message="⚠️ Tap rate exceeded! Slow down."
        visible={showRateWarning}
        type="warning"
      />
      
      {/* Confetti */}
      <Confetti active={showConfetti} />

      {/* Header - Round info */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.roundLabel, { color: colors.primary }]}>
            Round {roundNumber}
          </Text>
          <Text style={[styles.roundType, { color: colors.textMuted }]}>
            Photo Auction Bidding
          </Text>
        </View>
        <View style={[styles.timerBadge, { backgroundColor: timeRemaining <= 5 ? colors.error : colors.gold }]}>
          <Text style={styles.timerText}>⏱️ {timeRemaining}s</Text>
        </View>
      </View>

      {/* Photo cards */}
      <View style={styles.photosRow}>
        {/* Player Photo */}
        <View style={[styles.photoCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <View style={[styles.photoPlaceholder, { backgroundColor: playerScenery.gradient[0] }]}>
            <Text style={styles.photoEmoji}>{playerScenery.emoji}</Text>
          </View>
          <View style={styles.photoInfo}>
            <Text style={[styles.photoLabel, { color: colors.text }]} numberOfLines={1}>
              {playerPhoto?.name || 'Your Photo'}
            </Text>
            <Text style={[styles.photoValue, { color: colors.gold }]}>
              {formatDollarValue(playerEffectiveValue)}
            </Text>
          </View>
          {/* Progress bar */}
          <View style={[styles.progressBarBg, { backgroundColor: colors.cardSecondary }]}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${playerProgress}%`,
                  backgroundColor: colors.primary,
                }
              ]} 
            />
          </View>
          <Text style={[styles.tapCount, { color: colors.textMuted }]}>
            {playerTaps} / {playerRequiredTaps} taps
          </Text>
        </View>

        {/* VS */}
        <View style={styles.vsContainer}>
          <Text style={[styles.vsText, { color: colors.textMuted }]}>VS</Text>
        </View>

        {/* Opponent Photo */}
        <View style={[styles.photoCard, { backgroundColor: colors.card, borderColor: colors.error }]}>
          <View style={[styles.photoPlaceholder, { backgroundColor: opponentScenery.gradient[0] }]}>
            <Text style={styles.photoEmoji}>{opponentScenery.emoji}</Text>
          </View>
          <View style={styles.photoInfo}>
            <Text style={[styles.photoLabel, { color: colors.text }]} numberOfLines={1}>
              {opponentPhoto?.name || 'Opponent'}
            </Text>
            <Text style={[styles.photoValue, { color: colors.gold }]}>
              {formatDollarValue(opponentEffectiveValue)}
            </Text>
          </View>
          {/* Progress bar */}
          <View style={[styles.progressBarBg, { backgroundColor: colors.cardSecondary }]}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${opponentProgress}%`,
                  backgroundColor: colors.error,
                }
              ]} 
            />
          </View>
          <Text style={[styles.tapCount, { color: colors.textMuted }]}>
            {opponentTaps} / {opponentRequiredTaps} taps
          </Text>
        </View>
      </View>

      {/* Countdown Overlay */}
      {gamePhase === 'countdown' && (
        <View style={styles.countdownOverlay}>
          <Animated.Text 
            style={[
              styles.countdownNumber,
              { transform: [{ scale: pulseAnim }] }
            ]}
          >
            {countdown}
          </Animated.Text>
          <Text style={styles.countdownLabel}>Get Ready!</Text>
        </View>
      )}

      {/* Result Overlay */}
      {winner && (
        <View style={styles.resultOverlay}>
          {winner === 'player' ? (
            <>
              <Text style={styles.winEmoji}>🎉</Text>
              <Text style={styles.winText}>YOU WIN!</Text>
            </>
          ) : (
            <>
              <Text style={styles.loseEmoji}>😔</Text>
              <Text style={styles.loseText}>YOU LOSE</Text>
            </>
          )}
        </View>
      )}

      {/* Tap Area - Optimized for fast touch response */}
      <Pressable
        style={({ pressed }) => [
          styles.tapArea,
          { 
            backgroundColor: gamePhase === 'active' 
              ? (pressed ? 'rgba(139, 92, 246, 0.4)' : 'rgba(139, 92, 246, 0.2)')
              : 'rgba(0, 0, 0, 0.3)',
            opacity: winner ? 0.5 : 1,
          }
        ]}
        onPressIn={handleTap}
        disabled={gamePhase !== 'active' || winner !== null}
        android_disableSound={true}
        unstable_pressDelay={0}
      >
        {gamePhase === 'active' && !winner && (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Text style={styles.tapEmoji}>👆</Text>
            <Text style={styles.tapText}>TAP TO BID!</Text>
            <Text style={styles.tapSubtext}>
              {playerRequiredTaps - playerTaps} taps remaining
            </Text>
          </Animated.View>
        )}
        
        {gamePhase === 'waiting' && (
          <Text style={styles.waitingText}>Preparing arena...</Text>
        )}
      </Pressable>

      {/* TPS Indicator (debug) */}
      <View style={[styles.tpsIndicator, { backgroundColor: colors.cardSecondary }]}>
        <Text style={[styles.tpsText, { color: tapsThisSecond >= 25 ? colors.error : colors.textMuted }]}>
          TPS: {tapsThisSecond}/{MAX_TAPS_PER_SECOND}
        </Text>
      </View>
    </Animated.View>
  );
}

// ============== STYLES ==============
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Toast
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    padding: 12,
    borderRadius: 12,
    zIndex: 100,
    alignItems: 'center',
  },
  toastText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Confetti
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerLeft: {},
  roundLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  roundType: {
    fontSize: 12,
    marginTop: 2,
  },
  timerBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  timerText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Photos row
  photosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    gap: 8,
  },
  photoCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
    padding: 8,
  },
  photoPlaceholder: {
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoEmoji: {
    fontSize: 40,
    opacity: 0.7,
  },
  photoInfo: {
    marginTop: 8,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  photoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  tapCount: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  vsContainer: {
    paddingHorizontal: 8,
  },
  vsText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Countdown
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 30,
  },
  countdownNumber: {
    fontSize: 120,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  countdownLabel: {
    fontSize: 24,
    color: '#fff',
    marginTop: 10,
  },
  // Result
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 40,
  },
  winEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  winText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  loseEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  loseText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  // Tap area
  tapArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 24,
  },
  tapEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 12,
  },
  tapText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  tapSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginTop: 8,
  },
  waitingText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  // TPS indicator
  tpsIndicator: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tpsText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
