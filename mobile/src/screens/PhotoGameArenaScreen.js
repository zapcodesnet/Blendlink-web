/**
 * Photo Game Arena Screen for Blendlink Mobile
 * PvP Photo Battles with RPS mechanics
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Switch,
  Modal,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { photoGameAPI } from '../services/api';

const { width } = Dimensions.get('window');

// RPS choices
const RPS_CHOICES = [
  { id: 'rock', emoji: '🪨', label: 'Rock', beats: 'scissors' },
  { id: 'paper', emoji: '📄', label: 'Paper', beats: 'rock' },
  { id: 'scissors', emoji: '✂️', label: 'Scissors', beats: 'paper' },
];

// Scenery config
const SCENERY_CONFIG = {
  natural: { gradient: ['#22C55E', '#10B981'], emoji: '🌿', label: 'Natural' },
  water: { gradient: ['#3B82F6', '#06B6D4'], emoji: '🌊', label: 'Water' },
  manmade: { gradient: ['#F97316', '#EF4444'], emoji: '🏙️', label: 'Man-made' },
};

// ============== COMPONENTS ==============

// Stamina Bar Component
const StaminaBar = ({ stamina, maxStamina = 100, colors }) => {
  const percent = (stamina / maxStamina) * 100;
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: percent,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  return (
    <View style={styles.staminaContainer}>
      <Text style={styles.staminaIcon}>⚡</Text>
      <View style={[styles.staminaBarBg, { backgroundColor: colors.cardSecondary }]}>
        <Animated.View
          style={[
            styles.staminaBarFill,
            {
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={[styles.staminaText, { color: colors.textMuted }]}>
        {Math.round(stamina)}/{maxStamina}
      </Text>
    </View>
  );
};

// Win Streak Badge
const WinStreakBadge = ({ streak, colors }) => {
  if (streak < 3) return null;
  
  const multiplier = streak >= 6 ? 2 : streak >= 5 ? 1.75 : streak >= 4 ? 1.5 : 1.25;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.winStreakBadge, { transform: [{ scale: scaleAnim }] }]}>
      <Text style={styles.winStreakIcon}>🏆</Text>
      <Text style={styles.winStreakText}>{streak} Win Streak! ({multiplier}x)</Text>
    </Animated.View>
  );
};

// RPS Choice Button
const RPSChoiceButton = ({ choice, onPress, selected, disabled, colors }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    Vibration.vibrate(50);
    onPress(choice.id);
  };

  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled} activeOpacity={0.8}>
      <Animated.View
        style={[
          styles.rpsButton,
          { 
            backgroundColor: selected ? colors.primary : colors.card,
            borderColor: selected ? colors.primary : colors.border,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.rpsEmoji}>{choice.emoji}</Text>
        <Text style={[styles.rpsLabel, { color: selected ? '#fff' : colors.textMuted }]}>
          {choice.label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Photo Card
const PhotoCard = ({ photo, isPlayer, effectiveValue, isAnimating, colors }) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isAnimating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: isPlayer ? 20 : -20, duration: 200, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ])
      ).start();
    } else {
      shakeAnim.setValue(0);
    }
  }, [isAnimating]);

  const formatValue = (value) => {
    if (!value) return '$0';
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <Animated.View
      style={[
        styles.photoCard,
        {
          borderColor: isPlayer ? colors.primary : colors.error,
          transform: [{ translateX: shakeAnim }],
        },
      ]}
    >
      <View style={[styles.photoCardImage, { backgroundColor: scenery.gradient[0] }]}>
        <Text style={styles.photoCardEmoji}>{scenery.emoji}</Text>
      </View>
      
      <View style={[styles.photoCardBadge, { backgroundColor: scenery.gradient[0] }]}>
        <Text style={styles.photoCardBadgeText}>{scenery.label}</Text>
      </View>
      
      <View style={[styles.photoCardInfo, { backgroundColor: colors.card }]}>
        <Text style={[styles.photoCardName, { color: colors.text }]} numberOfLines={1}>
          {photo?.name || 'Photo'}
        </Text>
        <Text style={[styles.photoCardValue, { color: colors.gold }]}>
          {formatValue(photo?.dollar_value)}
        </Text>
        {effectiveValue && effectiveValue !== photo?.dollar_value && (
          <Text style={[styles.photoCardEffective, { color: colors.success }]}>
            Effective: {formatValue(effectiveValue)}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

// ============== MATCHMAKING VIEW ==============
const MatchmakingView = ({ onMatchFound, onCancel, colors }) => {
  const [status, setStatus] = useState('idle');
  const [betAmount, setBetAmount] = useState('0');
  const [useBotFallback, setUseBotFallback] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [queueStatus, setQueueStatus] = useState(null);
  const [error, setError] = useState(null);
  
  const intervalRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status === 'searching') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 750, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status]);

  const fetchQueueStatus = async () => {
    try {
      const data = await photoGameAPI.getQueueStatus();
      setQueueStatus(data);
    } catch (err) {
      console.error('Failed to fetch queue status:', err);
    }
  };

  const startMatchmaking = async () => {
    setError(null);
    try {
      setStatus('searching');
      setElapsed(0);
      
      const response = await photoGameAPI.findMatch({
        bet_amount: parseInt(betAmount) || 0,
        use_bot_fallback: useBotFallback,
      });
      
      if (response.status === 'matched') {
        setStatus('matched');
        Vibration.vibrate([100, 100, 100]);
        onMatchFound?.(response);
      } else if (response.status === 'searching') {
        // Start polling
        intervalRef.current = setInterval(async () => {
          try {
            const statusRes = await photoGameAPI.checkMatchStatus();
            setElapsed(statusRes.elapsed_seconds || 0);
            
            if (statusRes.status === 'matched') {
              clearInterval(intervalRef.current);
              setStatus('matched');
              Vibration.vibrate([100, 100, 100]);
              onMatchFound?.(statusRes);
            }
          } catch (err) {
            console.error('Match status check failed:', err);
          }
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to start matchmaking');
      setStatus('idle');
    }
  };

  const cancelMatchmaking = async () => {
    clearInterval(intervalRef.current);
    try {
      await photoGameAPI.cancelMatchmaking();
    } catch (err) {
      console.error('Cancel failed:', err);
    }
    setStatus('idle');
    onCancel?.();
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (status === 'searching') {
    return (
      <View style={styles.matchmakingSearching}>
        <Animated.View
          style={[
            styles.searchingCircle,
            { backgroundColor: colors.primary + '30', transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Text style={styles.searchingIcon}>👥</Text>
        </Animated.View>
        
        <Text style={[styles.searchingTitle, { color: colors.text }]}>
          Searching for Opponent...
        </Text>
        <Text style={[styles.searchingSubtitle, { color: colors.textMuted }]}>
          {Math.round(elapsed)}s / 30s
          {useBotFallback && ' (Bot match after timeout)'}
        </Text>
        
        <View style={[styles.searchingProgressBg, { backgroundColor: colors.cardSecondary }]}>
          <View
            style={[
              styles.searchingProgressFill,
              { width: `${(elapsed / 30) * 100}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>
        
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: colors.border }]}
          onPress={cancelMatchmaking}
        >
          <Text style={[styles.cancelButtonText, { color: colors.text }]}>✕ Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.matchmakingIdle}>
      <View style={[styles.matchmakingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.matchmakingTitle, { color: colors.text }]}>
          👥 Find PvP Match
        </Text>
        
        {queueStatus && (
          <View style={[styles.queueStatusCard, { backgroundColor: colors.cardSecondary }]}>
            <View style={styles.queueStatusRow}>
              <Text style={[styles.queueStatusLabel, { color: colors.textMuted }]}>Players searching:</Text>
              <Text style={[styles.queueStatusValue, { color: colors.text }]}>{queueStatus.players_waiting}</Text>
            </View>
            <View style={styles.queueStatusRow}>
              <Text style={[styles.queueStatusLabel, { color: colors.textMuted }]}>Active matches:</Text>
              <Text style={[styles.queueStatusValue, { color: colors.text }]}>{queueStatus.active_matches}</Text>
            </View>
          </View>
        )}
        
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>BL Coin Bet (optional)</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.cardSecondary, color: colors.text, borderColor: colors.border }]}
            value={betAmount}
            onChangeText={setBetAmount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Play with bot if no players</Text>
          <Switch
            value={useBotFallback}
            onValueChange={setUseBotFallback}
            trackColor={{ false: colors.cardSecondary, true: colors.primary + '80' }}
            thumbColor={useBotFallback ? colors.primary : colors.textMuted}
          />
        </View>
        
        {error && (
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        )}
      </View>
      
      <TouchableOpacity
        style={styles.findMatchButton}
        onPress={startMatchmaking}
        activeOpacity={0.8}
      >
        <Text style={styles.findMatchButtonText}>⚔️ Find Match</Text>
      </TouchableOpacity>
      
      <View style={styles.quickMatchRow}>
        <TouchableOpacity
          style={[styles.quickMatchButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={startMatchmaking}
        >
          <Text style={styles.quickMatchIcon}>🤖</Text>
          <Text style={[styles.quickMatchText, { color: colors.text }]}>Quick Bot</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickMatchButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={styles.quickMatchIcon}>🏆</Text>
          <Text style={[styles.quickMatchText, { color: colors.text }]}>Ranked</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ============== RPS BATTLE VIEW ==============
const RPSBattleView = ({ session, onChoice, isTiebreaker, colors }) => {
  const [playerChoice, setPlayerChoice] = useState(null);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [roundResult, setRoundResult] = useState(null);
  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChoice = async (choice) => {
    if (isSubmitting || playerChoice) return;
    
    setIsSubmitting(true);
    setPlayerChoice(choice);
    Vibration.vibrate(100);
    
    try {
      const result = await onChoice(choice);
      
      if (result?.round) {
        setOpponentChoice(result.round.player2_choice);
        setRoundResult(result.round.winner === 'player1' ? 'win' : result.round.winner === 'player2' ? 'lose' : 'tie');
        setScore({ player: result.player1_wins, opponent: result.player2_wins });
        
        // Reset for next round after delay
        setTimeout(() => {
          setPlayerChoice(null);
          setOpponentChoice(null);
          setRoundResult(null);
          setIsSubmitting(false);
        }, 1500);
      }
    } catch (err) {
      console.error('RPS choice failed:', err);
      setPlayerChoice(null);
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.rpsContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {isTiebreaker && (
        <View style={styles.tiebreakerBadge}>
          <Text style={styles.tiebreakerText}>⚡ TIEBREAKER ROUND</Text>
        </View>
      )}
      
      <Text style={[styles.rpsTitle, { color: colors.text }]}>Rock Paper Scissors</Text>
      <Text style={[styles.rpsSubtitle, { color: colors.textMuted }]}>First to 3 wins!</Text>
      
      {/* Score Display */}
      <View style={styles.scoreContainer}>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>You</Text>
          <Text style={[styles.scoreValue, { color: colors.primary }]}>{score.player}</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Need</Text>
          <Text style={[styles.scoreValue, { color: colors.textSecondary }]}>3</Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>Opponent</Text>
          <Text style={[styles.scoreValue, { color: colors.error }]}>{score.opponent}</Text>
        </View>
      </View>
      
      {/* RPS Choices */}
      <View style={styles.rpsChoicesRow}>
        {RPS_CHOICES.map((choice) => (
          <RPSChoiceButton
            key={choice.id}
            choice={choice}
            onPress={handleChoice}
            selected={playerChoice === choice.id}
            disabled={isSubmitting}
            colors={colors}
          />
        ))}
      </View>
      
      {/* Battle Result */}
      {playerChoice && opponentChoice && (
        <View style={styles.battleResultContainer}>
          <View style={styles.battleResultRow}>
            <View style={styles.battleResultPlayer}>
              <Text style={[styles.battleResultLabel, { color: colors.textMuted }]}>You</Text>
              <Text style={styles.battleResultEmoji}>
                {RPS_CHOICES.find(c => c.id === playerChoice)?.emoji}
              </Text>
            </View>
            
            <Text style={styles.battleVS}>VS</Text>
            
            <View style={styles.battleResultPlayer}>
              <Text style={[styles.battleResultLabel, { color: colors.textMuted }]}>Opponent</Text>
              <Text style={styles.battleResultEmoji}>
                {RPS_CHOICES.find(c => c.id === opponentChoice)?.emoji}
              </Text>
            </View>
          </View>
          
          <Text
            style={[
              styles.roundResultText,
              { color: roundResult === 'win' ? colors.success : roundResult === 'lose' ? colors.error : colors.gold },
            ]}
          >
            {roundResult === 'win' ? '🎉 You Win!' : roundResult === 'lose' ? '😢 You Lose!' : '🤝 Tie!'}
          </Text>
        </View>
      )}
    </View>
  );
};

// ============== PHOTO BATTLE VIEW ==============
const PhotoBattleView = ({ session, onBattle, colors }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [result, setResult] = useState(null);

  const handleBattle = async () => {
    setIsAnimating(true);
    Vibration.vibrate([100, 50, 100, 50, 100]);
    
    try {
      const battleResult = await onBattle();
      setTimeout(() => {
        setIsAnimating(false);
        setResult(battleResult?.battle_result);
      }, 2000);
    } catch (err) {
      console.error('Photo battle failed:', err);
      setIsAnimating(false);
    }
  };

  return (
    <View style={[styles.photoBattleContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.photoBattleTitle, { color: colors.text }]}>Photo Auction Battle</Text>
      <Text style={[styles.photoBattleSubtitle, { color: colors.textMuted }]}>Highest effective value wins!</Text>
      
      <View style={styles.photoBattleCardsRow}>
        <PhotoCard
          photo={session?.player1_photo}
          isPlayer={true}
          effectiveValue={result?.player1_value}
          isAnimating={isAnimating}
          colors={colors}
        />
        
        <View style={styles.photoBattleVS}>
          <Text style={styles.photoBattleVSEmoji}>⚔️</Text>
          {!result && !isAnimating && (
            <TouchableOpacity style={styles.battleButton} onPress={handleBattle}>
              <Text style={styles.battleButtonText}>Battle!</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <PhotoCard
          photo={session?.player2_photo}
          isPlayer={false}
          effectiveValue={result?.player2_value}
          isAnimating={isAnimating}
          colors={colors}
        />
      </View>
      
      {result && (
        <View style={styles.photoBattleResult}>
          <Text
            style={[
              styles.photoBattleWinner,
              { color: result.winner === 'player1' ? colors.success : colors.error },
            ]}
          >
            {result.winner === 'player1' ? '🏆 Your Photo Wins!' : '😢 Opponent Wins!'}
          </Text>
        </View>
      )}
    </View>
  );
};

// ============== RESULT VIEW ==============
const ResultView = ({ session, onPlayAgain, user, colors }) => {
  const isWinner = session?.winner_id === user?.user_id;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }),
      Animated.timing(rotateAnim, {
        toValue: isWinner ? 1 : 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
    
    if (isWinner) {
      Vibration.vibrate([100, 100, 100, 100, 100]);
    }
  }, [isWinner]);

  return (
    <View style={[styles.resultContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Text style={styles.resultEmoji}>{isWinner ? '🏆' : '😢'}</Text>
      </Animated.View>
      
      <Text style={[styles.resultTitle, { color: isWinner ? colors.success : colors.error }]}>
        {isWinner ? 'Victory!' : 'Defeat'}
      </Text>
      
      {session?.bet_amount > 0 && (
        <Text style={[styles.resultBet, { color: isWinner ? colors.gold : colors.textMuted }]}>
          {isWinner ? '+' : '-'}{session.bet_amount * (isWinner ? 2 : 1)} BL Coins
        </Text>
      )}
      
      <TouchableOpacity style={styles.playAgainButton} onPress={onPlayAgain}>
        <Text style={styles.playAgainButtonText}>🔄 Play Again</Text>
      </TouchableOpacity>
    </View>
  );
};

// ============== MAIN SCREEN ==============
export default function PhotoGameArenaScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [gameState, setGameState] = useState('matchmaking');
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const data = await photoGameAPI.getMyStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleMatchFound = async (matchInfo) => {
    setMatchData(matchInfo);
    
    try {
      const response = await photoGameAPI.startMatch(matchInfo.match_id);
      
      if (response.success) {
        setSession(response.session);
        setGameState('rps');
        Vibration.vibrate([100, 100, 100]);
      }
    } catch (err) {
      console.error('Failed to start game:', err);
      setGameState('matchmaking');
    }
  };

  const handleRPSChoice = async (choice) => {
    if (!session) return null;
    
    try {
      const result = await photoGameAPI.playRPS(session.session_id, choice);
      
      if (result.phase === 'photo_battle') {
        setTimeout(() => setGameState('photo_battle'), 1500);
      } else if (result.phase === 'tiebreaker') {
        setTimeout(() => setGameState('tiebreaker'), 1500);
      } else if (result.phase === 'completed') {
        setTimeout(() => {
          setSession(result.session);
          setGameState('result');
        }, 1500);
      }
      
      return result;
    } catch (err) {
      console.error('RPS failed:', err);
      return null;
    }
  };

  const handlePhotoBattle = async () => {
    if (!session) return null;
    
    try {
      const result = await photoGameAPI.playPhotoBattle(session.session_id);
      
      if (result.phase === 'tiebreaker') {
        setTimeout(() => setGameState('tiebreaker'), 3000);
      } else if (result.phase === 'completed') {
        setTimeout(() => {
          setSession(result.session);
          setGameState('result');
        }, 3000);
      }
      
      return result;
    } catch (err) {
      console.error('Photo battle failed:', err);
      return null;
    }
  };

  const handlePlayAgain = () => {
    setGameState('matchmaking');
    setSession(null);
    setMatchData(null);
    fetchStats();
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>⚔️ Battle Arena</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>PvP Photo Battles</Text>
          </View>
        </View>
        {stats && <WinStreakBadge streak={stats.current_win_streak} colors={colors} />}
      </View>
      
      {/* Stats Bar */}
      {stats && (
        <View style={[styles.statsBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.battles_won}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Wins</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.battles_lost}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Losses</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.gold }]}>{stats.total_bl_won}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>BL Won</Text>
          </View>
          <View style={[styles.statItem, styles.staminaStatItem]}>
            <StaminaBar stamina={stats.stamina} colors={colors} />
          </View>
        </View>
      )}
      
      {/* Main Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {gameState === 'matchmaking' && (
          <MatchmakingView
            onMatchFound={handleMatchFound}
            onCancel={() => {}}
            colors={colors}
          />
        )}
        
        {(gameState === 'rps' || gameState === 'tiebreaker') && (
          <RPSBattleView
            session={session}
            onChoice={handleRPSChoice}
            isTiebreaker={gameState === 'tiebreaker'}
            colors={colors}
          />
        )}
        
        {gameState === 'photo_battle' && (
          <PhotoBattleView
            session={session}
            onBattle={handlePhotoBattle}
            colors={colors}
          />
        )}
        
        {gameState === 'result' && session && (
          <ResultView
            session={session}
            onPlayAgain={handlePlayAgain}
            user={user}
            colors={colors}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  // Win Streak Badge
  winStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F97316',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  winStreakIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  winStreakText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Stats Bar
  statsBar: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  staminaStatItem: {
    flex: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  // Stamina
  staminaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  staminaIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  staminaBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  staminaBarFill: {
    height: '100%',
    backgroundColor: '#EAB308',
    borderRadius: 4,
  },
  staminaText: {
    fontSize: 11,
    marginLeft: 8,
  },
  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  // Matchmaking
  matchmakingIdle: {
    flex: 1,
  },
  matchmakingCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  matchmakingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  queueStatusCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  queueStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  queueStatusLabel: {
    fontSize: 13,
  },
  queueStatusValue: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },
  findMatchButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  findMatchButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quickMatchRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickMatchButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickMatchIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  quickMatchText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Searching
  matchmakingSearching: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  searchingCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  searchingIcon: {
    fontSize: 48,
  },
  searchingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  searchingSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  searchingProgressBg: {
    width: 200,
    height: 8,
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  searchingProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // RPS
  rpsContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  tiebreakerBadge: {
    backgroundColor: '#EAB308',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  tiebreakerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rpsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  rpsSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 32,
  },
  scoreBox: {
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  rpsChoicesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  rpsButton: {
    width: 90,
    height: 90,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  rpsEmoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  rpsLabel: {
    fontSize: 11,
  },
  battleResultContainer: {
    alignItems: 'center',
  },
  battleResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginBottom: 12,
  },
  battleResultPlayer: {
    alignItems: 'center',
  },
  battleResultLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  battleResultEmoji: {
    fontSize: 48,
  },
  battleVS: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  roundResultText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Photo Battle
  photoBattleContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  photoBattleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  photoBattleSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  photoBattleCardsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  photoCard: {
    width: (width - 100) / 2,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
  },
  photoCardImage: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCardEmoji: {
    fontSize: 48,
    opacity: 0.5,
  },
  photoCardBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoCardBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  photoCardInfo: {
    padding: 8,
  },
  photoCardName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  photoCardValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  photoCardEffective: {
    fontSize: 10,
    marginTop: 2,
  },
  photoBattleVS: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  photoBattleVSEmoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  battleButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  battleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  photoBattleResult: {
    marginTop: 20,
    alignItems: 'center',
  },
  photoBattleWinner: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Result
  resultContainer: {
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    alignItems: 'center',
  },
  resultEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultBet: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
  },
  playAgainButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  playAgainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
