/**
 * Casino Game Screen - Handles all individual casino games
 * Matches website design and functionality 100%
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { casinoAPI, walletAPI } from '../services/api';

const { width } = Dimensions.get('window');

// Color scheme
const COLORS = {
  background: '#0F172A',
  card: '#1E293B',
  primary: '#F59E0B',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  border: '#334155',
  success: '#22C55E',
  error: '#EF4444',
  purple: '#9333EA',
  green: '#16A34A',
  amber: '#D97706',
  indigo: '#4F46E5',
  blue: '#2563EB',
  rose: '#E11D48',
  red: '#DC2626',
  yellow: '#EAB308',
};

const MIN_BET = 10;
const MAX_BET = 10000;

// ============== BET CONTROLS COMPONENT ==============
const BetControls = ({ bet, setBet, disabled }) => (
  <View style={styles.betControls}>
    <TouchableOpacity 
      style={styles.betButton} 
      onPress={() => setBet(Math.max(MIN_BET, bet - 50))}
      disabled={disabled}
    >
      <Text style={styles.betButtonText}>−</Text>
    </TouchableOpacity>
    <TextInput
      style={styles.betInput}
      value={bet.toString()}
      onChangeText={(t) => setBet(Math.min(MAX_BET, Math.max(MIN_BET, parseInt(t) || MIN_BET)))}
      keyboardType="numeric"
      editable={!disabled}
    />
    <TouchableOpacity 
      style={styles.betButton} 
      onPress={() => setBet(Math.min(MAX_BET, bet + 50))}
      disabled={disabled}
    >
      <Text style={styles.betButtonText}>+</Text>
    </TouchableOpacity>
  </View>
);

// ============== DAILY SPIN GAME ==============
const DailySpinGame = ({ balance, onBalanceUpdate }) => {
  const [status, setStatus] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const REWARDS = [1000, 5000, 15000, 35000, 80000, 200000];
  const REWARD_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#A855F7'];

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await casinoAPI.getDailySpinStatus();
      setStatus(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const spin = async () => {
    if (!status?.can_spin) {
      Alert.alert('Daily Spin', 'Already claimed today! Come back tomorrow.');
      return;
    }

    setSpinning(true);
    setResult(null);

    // Start rotation animation
    Animated.timing(rotateAnim, {
      toValue: 10,
      duration: 4000,
      useNativeDriver: true,
    }).start();

    try {
      const response = await casinoAPI.claimDailySpin();
      
      setTimeout(() => {
        setResult(response);
        onBalanceUpdate(response.new_balance);
        setStatus({ ...status, can_spin: false });
        setSpinning(false);
        Alert.alert('🎉 Congratulations!', `You won ${response.reward.toLocaleString()} BL Coins!`);
      }, 4000);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to spin');
      setSpinning(false);
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 10],
    outputRange: ['0deg', '3600deg'],
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.yellow} />
      </View>
    );
  }

  return (
    <View style={[styles.gameContainer, { backgroundColor: 'rgba(234, 179, 8, 0.1)' }]}>
      <Text style={[styles.gameTitle, { color: COLORS.yellow }]}>🎁 Daily Bonus Spin</Text>
      <Text style={styles.gameSubtitle}>One FREE spin every day!</Text>

      {/* Wheel */}
      <View style={styles.wheelContainer}>
        <View style={styles.wheelPointer}>
          <View style={styles.pointerTriangle} />
        </View>
        <Animated.View 
          style={[
            styles.wheel,
            { transform: [{ rotate: rotateInterpolate }] }
          ]}
        >
          {REWARDS.map((reward, i) => (
            <View 
              key={i} 
              style={[
                styles.wheelSegment,
                { 
                  backgroundColor: REWARD_COLORS[i],
                  transform: [{ rotate: `${i * 60}deg` }]
                }
              ]}
            >
              <Text style={styles.wheelSegmentText}>
                {reward >= 1000 ? `${reward/1000}K` : reward}
              </Text>
            </View>
          ))}
          <View style={styles.wheelCenter}>
            <Text style={styles.wheelCenterText}>FREE</Text>
          </View>
        </Animated.View>
      </View>

      {result && (
        <View style={[styles.resultBox, styles.resultWin]}>
          <Text style={styles.resultText}>🎉 {result.reward.toLocaleString()} BL!</Text>
          <Text style={styles.resultSubtext}>Added to your balance</Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.spinButton,
          { backgroundColor: status?.can_spin ? COLORS.yellow : COLORS.textMuted }
        ]}
        onPress={spin}
        disabled={spinning || !status?.can_spin}
      >
        <Text style={styles.spinButtonText}>
          {spinning ? '🎡 Spinning...' : status?.can_spin ? '🎁 Claim Free Spin!' : 'Come Back Tomorrow!'}
        </Text>
      </TouchableOpacity>

      {/* Rewards Preview */}
      <View style={styles.rewardsPreview}>
        {REWARDS.map((reward, i) => (
          <View key={i} style={[styles.rewardItem, { backgroundColor: `${REWARD_COLORS[i]}40` }]}>
            <Text style={[styles.rewardText, { color: REWARD_COLORS[i] }]}>
              {reward.toLocaleString()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ============== SLOTS GAME ==============
const SlotsGame = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(100);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState([['🍒', '🍋', '🍊'], ['🍇', '🔔', '⭐'], ['💎', '7️⃣', '🍒']]);
  const [result, setResult] = useState(null);

  const SYMBOLS = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];

  const spin = async () => {
    if (balance < bet) {
      Alert.alert('Insufficient Balance', 'Not enough BL Coins!');
      return;
    }

    setSpinning(true);
    setResult(null);

    // Animate reels
    const interval = setInterval(() => {
      setReels([
        [SYMBOLS[Math.floor(Math.random() * 8)], SYMBOLS[Math.floor(Math.random() * 8)], SYMBOLS[Math.floor(Math.random() * 8)]],
        [SYMBOLS[Math.floor(Math.random() * 8)], SYMBOLS[Math.floor(Math.random() * 8)], SYMBOLS[Math.floor(Math.random() * 8)]],
        [SYMBOLS[Math.floor(Math.random() * 8)], SYMBOLS[Math.floor(Math.random() * 8)], SYMBOLS[Math.floor(Math.random() * 8)]],
      ]);
    }, 100);

    try {
      const response = await casinoAPI.spinSlots(bet, 1);
      setTimeout(() => {
        clearInterval(interval);
        setReels(response.reels);
        setResult(response);
        onBalanceUpdate(response.balance);
        setSpinning(false);
        if (response.winnings > 0) {
          Alert.alert('🎰 Winner!', `You won ${response.winnings.toLocaleString()} BL! (${response.multiplier}x)`);
        }
      }, 1500);
    } catch (error) {
      clearInterval(interval);
      Alert.alert('Error', error.message);
      setSpinning(false);
    }
  };

  return (
    <View style={[styles.gameContainer, { backgroundColor: 'rgba(147, 51, 234, 0.1)' }]}>
      <Text style={[styles.gameTitle, { color: COLORS.purple }]}>🎰 Slot Machine</Text>

      {/* Reels */}
      <View style={styles.slotsContainer}>
        {reels.map((reel, i) => (
          <View key={i} style={styles.reelColumn}>
            {reel.map((symbol, j) => (
              <View 
                key={j} 
                style={[
                  styles.reelCell,
                  j === 1 && styles.reelCellMiddle
                ]}
              >
                <Text style={styles.reelSymbol}>{symbol}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>

      {result && (
        <View style={[styles.resultBox, result.winnings > 0 ? styles.resultWin : styles.resultLose]}>
          <Text style={styles.resultText}>
            {result.winnings > 0 ? `Won ${result.winnings.toLocaleString()} BL!` : 'No win - try again!'}
          </Text>
        </View>
      )}

      <BetControls bet={bet} setBet={setBet} disabled={spinning} />

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: COLORS.purple }]}
        onPress={spin}
        disabled={spinning}
      >
        <Text style={styles.actionButtonText}>
          {spinning ? 'Spinning...' : `Spin (${bet.toLocaleString()} BL)`}
        </Text>
      </TouchableOpacity>

      {/* Paytable */}
      <View style={styles.paytable}>
        <Text style={styles.paytableTitle}>Payouts:</Text>
        <Text style={styles.paytableText}>7️⃣7️⃣7️⃣ = 500x • 💎💎💎 = 100x • ⭐⭐⭐ = 50x</Text>
      </View>
    </View>
  );
};

// ============== BLACKJACK GAME ==============
const BlackjackGame = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(100);
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(false);

  const startGame = async () => {
    if (balance < bet) {
      Alert.alert('Insufficient Balance', 'Not enough BL Coins!');
      return;
    }

    setLoading(true);
    try {
      const response = await casinoAPI.startBlackjack(bet);
      setGameState(response);
      if (response.result) {
        onBalanceUpdate(response.balance);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  };

  const performAction = async (action) => {
    if (!gameState?.game_id) return;
    setLoading(true);
    try {
      const response = await casinoAPI.blackjackAction(gameState.game_id, action);
      setGameState(response);
      if (response.result) {
        onBalanceUpdate(response.balance);
        if (response.winnings > 0) {
          Alert.alert('🎉 Winner!', `You won ${response.winnings.toLocaleString()} BL!`);
        }
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  };

  const getResultMessage = () => {
    if (!gameState?.result) return null;
    const messages = {
      blackjack: '🎉 BLACKJACK! 3:2 Payout!',
      win: '✅ You Win!',
      dealer_bust: '💥 Dealer Bust!',
      push: '🤝 Push - Bet Returned',
      lose: '❌ Dealer Wins',
      bust: '💥 Bust! Over 21',
    };
    return messages[gameState.result] || gameState.result;
  };

  return (
    <View style={[styles.gameContainer, { backgroundColor: 'rgba(22, 163, 74, 0.1)' }]}>
      <Text style={[styles.gameTitle, { color: COLORS.green }]}>🃏 Blackjack</Text>

      {!gameState ? (
        <>
          <BetControls bet={bet} setBet={setBet} disabled={loading} />
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.green }]}
            onPress={startGame}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>
              {loading ? 'Dealing...' : `Deal (${bet.toLocaleString()} BL)`}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Dealer Hand */}
          <View style={styles.handContainer}>
            <Text style={styles.handLabel}>
              Dealer {gameState.dealer_value ? `(${gameState.dealer_value})` : ''}
            </Text>
            <View style={styles.cardsRow}>
              {(gameState.dealer_hand || gameState.dealer_showing || []).map((card, i) => (
                <View key={i} style={styles.card}>
                  <Text style={styles.cardText}>{card}</Text>
                </View>
              ))}
              {!gameState.result && gameState.dealer_showing && (
                <View style={[styles.card, styles.cardHidden]}>
                  <Text style={styles.cardText}>🂠</Text>
                </View>
              )}
            </View>
          </View>

          {/* Player Hand */}
          <View style={styles.handContainer}>
            <Text style={styles.handLabel}>Your Hand ({gameState.player_value})</Text>
            <View style={styles.cardsRow}>
              {(gameState.player_hand || []).map((card, i) => (
                <View key={i} style={styles.card}>
                  <Text style={styles.cardText}>{card}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Result or Actions */}
          {gameState.result ? (
            <View style={[
              styles.resultBox,
              gameState.winnings > gameState.bet ? styles.resultWin : 
              gameState.winnings === gameState.bet ? styles.resultPush : styles.resultLose
            ]}>
              <Text style={styles.resultText}>{getResultMessage()}</Text>
              <Text style={styles.resultSubtext}>
                {gameState.winnings > 0 ? `Won: ${gameState.winnings.toLocaleString()} BL` : `Lost: ${gameState.bet.toLocaleString()} BL`}
              </Text>
            </View>
          ) : (
            <View style={styles.actionsRow}>
              {(gameState.actions || ['hit', 'stand']).map((action) => (
                <TouchableOpacity
                  key={action}
                  style={[
                    styles.actionButtonSmall,
                    { backgroundColor: action === 'stand' ? COLORS.textMuted : COLORS.green }
                  ]}
                  onPress={() => performAction(action)}
                  disabled={loading}
                >
                  <Text style={styles.actionButtonText}>
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border }]}
            onPress={() => setGameState(null)}
            disabled={loading && !gameState.result}
          >
            <Text style={styles.actionButtonText}>🔄 New Game</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.gameInfo}>Blackjack pays 3:2 • Dealer stands on 17</Text>
    </View>
  );
};

// ============== ROULETTE GAME ==============
const RouletteGame = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(50);
  const [betType, setBetType] = useState('red');
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  const betOptions = [
    { type: 'red', label: 'Red', color: COLORS.error },
    { type: 'black', label: 'Black', color: '#1F2937' },
    { type: 'odd', label: 'Odd', color: COLORS.purple },
    { type: 'even', label: 'Even', color: COLORS.blue },
    { type: '1-18', label: '1-18', color: COLORS.amber },
    { type: '19-36', label: '19-36', color: '#0D9488' },
  ];

  const spin = async () => {
    if (balance < bet) {
      Alert.alert('Insufficient Balance', 'Not enough BL Coins!');
      return;
    }

    setSpinning(true);
    setResult(null);

    try {
      const response = await casinoAPI.spinRoulette([
        { amount: bet, bet_type: betType, bet_value: null }
      ]);
      
      setTimeout(() => {
        setResult(response);
        onBalanceUpdate(response.balance);
        setSpinning(false);
        if (response.total_winnings > 0) {
          Alert.alert('🎡 Winner!', `You won ${response.total_winnings.toLocaleString()} BL!`);
        }
      }, 2000);
    } catch (error) {
      Alert.alert('Error', error.message);
      setSpinning(false);
    }
  };

  return (
    <View style={[styles.gameContainer, { backgroundColor: 'rgba(217, 119, 6, 0.1)' }]}>
      <Text style={[styles.gameTitle, { color: COLORS.amber }]}>🎡 Roulette</Text>

      {/* Wheel Display */}
      <View style={[styles.rouletteWheel, spinning && styles.spinning]}>
        <Text style={styles.rouletteNumber}>
          {result ? result.result_number : '?'}
        </Text>
      </View>

      {result && (
        <View style={[styles.resultBox, result.total_winnings > 0 ? styles.resultWin : styles.resultLose]}>
          <Text style={styles.resultText}>
            {result.result_number} {result.result_color?.toUpperCase()}
          </Text>
          <Text style={styles.resultSubtext}>
            {result.total_winnings > 0 ? `Won ${result.total_winnings.toLocaleString()} BL!` : 'No win'}
          </Text>
        </View>
      )}

      {/* Bet Type Selection */}
      <View style={styles.betTypeGrid}>
        {betOptions.map((option) => (
          <TouchableOpacity
            key={option.type}
            style={[
              styles.betTypeButton,
              { backgroundColor: option.color },
              betType === option.type && styles.betTypeSelected
            ]}
            onPress={() => setBetType(option.type)}
          >
            <Text style={styles.betTypeText}>{option.label}</Text>
            <Text style={styles.betTypePayout}>2x</Text>
          </TouchableOpacity>
        ))}
      </View>

      <BetControls bet={bet} setBet={setBet} disabled={spinning} />

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: COLORS.amber }]}
        onPress={spin}
        disabled={spinning}
      >
        <Text style={styles.actionButtonText}>
          {spinning ? 'Spinning...' : `Spin (${bet.toLocaleString()} BL on ${betType})`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============== WHEEL OF FORTUNE GAME ==============
const WheelGame = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const spin = async () => {
    if (balance < bet) {
      Alert.alert('Insufficient Balance', 'Not enough BL Coins!');
      return;
    }

    setSpinning(true);
    setResult(null);

    Animated.timing(rotateAnim, {
      toValue: rotateAnim._value + 10,
      duration: 3000,
      useNativeDriver: true,
    }).start();

    try {
      const response = await casinoAPI.spinWheel(bet);
      setTimeout(() => {
        setResult(response);
        onBalanceUpdate(response.balance);
        setSpinning(false);
        if (response.winnings > 0) {
          Alert.alert('🎡 Winner!', `You won ${response.winnings.toLocaleString()} BL! (${response.multiplier}x)`);
        }
      }, 3000);
    } catch (error) {
      Alert.alert('Error', error.message);
      setSpinning(false);
    }
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 10],
    outputRange: ['0deg', '3600deg'],
  });

  return (
    <View style={[styles.gameContainer, { backgroundColor: 'rgba(79, 70, 229, 0.1)' }]}>
      <Text style={[styles.gameTitle, { color: COLORS.indigo }]}>🎡 Wheel of Fortune</Text>

      <View style={styles.wheelContainer}>
        <View style={styles.wheelPointer}>
          <View style={styles.pointerTriangle} />
        </View>
        <Animated.View style={[styles.fortuneWheel, { transform: [{ rotate: rotation }] }]}>
          <Text style={styles.wheelText}>WHEEL</Text>
        </Animated.View>
      </View>

      {result && (
        <View style={[styles.resultBox, result.winnings > 0 ? styles.resultWin : styles.resultLose]}>
          <Text style={styles.resultText}>{result.segment?.label}</Text>
          <Text style={styles.resultSubtext}>
            {result.winnings > 0 ? `Won ${result.winnings.toLocaleString()} BL!` : 'No win - try again!'}
          </Text>
          {result.is_jackpot && <Text style={styles.jackpotText}>🎉 JACKPOT! 🎉</Text>}
        </View>
      )}

      <BetControls bet={bet} setBet={setBet} disabled={spinning} />

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: COLORS.indigo }]}
        onPress={spin}
        disabled={spinning}
      >
        <Text style={styles.actionButtonText}>
          {spinning ? 'Spinning...' : `Spin (${bet.toLocaleString()} BL)`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============== VIDEO POKER GAME ==============
const PokerGame = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(100);
  const [gameState, setGameState] = useState(null);
  const [held, setHeld] = useState([]);
  const [loading, setLoading] = useState(false);

  const deal = async () => {
    if (balance < bet) {
      Alert.alert('Insufficient Balance', 'Not enough BL Coins!');
      return;
    }

    setLoading(true);
    setHeld([]);
    try {
      const response = await casinoAPI.dealPoker(bet);
      setGameState(response);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  };

  const draw = async () => {
    if (!gameState?.game_id) return;
    setLoading(true);
    try {
      const response = await casinoAPI.drawPoker(gameState.game_id, held);
      setGameState(response);
      onBalanceUpdate(response.balance);
      if (response.winnings > 0) {
        Alert.alert('🃏 Winner!', `${response.hand_name}! Won ${response.winnings.toLocaleString()} BL!`);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  };

  const toggleHold = (index) => {
    if (gameState?.hand_name) return;
    setHeld((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <View style={[styles.gameContainer, { backgroundColor: 'rgba(37, 99, 235, 0.1)' }]}>
      <Text style={[styles.gameTitle, { color: COLORS.blue }]}>🃏 Video Poker</Text>

      {gameState && (
        <View style={styles.cardsRow}>
          {(gameState.hand || []).map((card, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.pokerCard, held.includes(i) && styles.pokerCardHeld]}
              onPress={() => toggleHold(i)}
              disabled={!!gameState.hand_name}
            >
              {held.includes(i) && <Text style={styles.holdLabel}>HOLD</Text>}
              <Text style={styles.cardText}>{card}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {gameState?.hand_name && (
        <View style={[styles.resultBox, gameState.winnings > 0 ? styles.resultWin : styles.resultLose]}>
          <Text style={styles.resultText}>{gameState.hand_name}</Text>
          <Text style={styles.resultSubtext}>
            {gameState.winnings > 0 ? `Won ${gameState.winnings.toLocaleString()} BL (${gameState.multiplier}x)` : 'No winning hand'}
          </Text>
        </View>
      )}

      {!gameState ? (
        <>
          <BetControls bet={bet} setBet={setBet} disabled={loading} />
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.blue }]}
            onPress={deal}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>Deal ({bet.toLocaleString()} BL)</Text>
          </TouchableOpacity>
        </>
      ) : !gameState.hand_name ? (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: COLORS.blue }]}
          onPress={draw}
          disabled={loading}
        >
          <Text style={styles.actionButtonText}>Draw ({held.length} held)</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border }]}
          onPress={() => setGameState(null)}
        >
          <Text style={styles.actionButtonText}>🔄 New Game</Text>
        </TouchableOpacity>
      )}

      <View style={styles.paytable}>
        <Text style={styles.paytableTitle}>Payouts:</Text>
        <Text style={styles.paytableText}>Royal Flush: 800x • Straight Flush: 50x • 4 of Kind: 25x</Text>
      </View>
    </View>
  );
};

// ============== BACCARAT GAME ==============
const BaccaratGame = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(100);
  const [betOn, setBetOn] = useState('player');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const play = async () => {
    if (balance < bet) {
      Alert.alert('Insufficient Balance', 'Not enough BL Coins!');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await casinoAPI.playBaccarat(bet, betOn);
      setResult(response);
      onBalanceUpdate(response.balance);
      if (response.winnings > 0) {
        Alert.alert('🎴 Winner!', `You won ${response.winnings.toLocaleString()} BL!`);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  };

  return (
    <View style={[styles.gameContainer, { backgroundColor: 'rgba(225, 29, 72, 0.1)' }]}>
      <Text style={[styles.gameTitle, { color: COLORS.rose }]}>🎴 Baccarat</Text>

      {result && (
        <>
          <View style={styles.baccaratHands}>
            <View style={styles.baccaratHand}>
              <Text style={styles.handLabel}>Player ({result.player_value})</Text>
              <View style={styles.cardsRow}>
                {result.player_hand.map((card, i) => (
                  <View key={i} style={styles.smallCard}>
                    <Text style={styles.smallCardText}>{card}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.baccaratHand}>
              <Text style={styles.handLabel}>Banker ({result.banker_value})</Text>
              <View style={styles.cardsRow}>
                {result.banker_hand.map((card, i) => (
                  <View key={i} style={styles.smallCard}>
                    <Text style={styles.smallCardText}>{card}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={[styles.resultBox, result.winnings > 0 ? styles.resultWin : styles.resultLose]}>
            <Text style={styles.resultText}>{result.winner.toUpperCase()} WINS!</Text>
            <Text style={styles.resultSubtext}>
              {result.winnings > 0 ? `Won ${result.winnings.toLocaleString()} BL` : `Lost ${bet.toLocaleString()} BL`}
            </Text>
          </View>
        </>
      )}

      {/* Bet Selection */}
      <View style={styles.betTypeRow}>
        {['player', 'banker', 'tie'].map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.betTypeButtonWide,
              { backgroundColor: COLORS.rose },
              betOn === option && styles.betTypeSelected
            ]}
            onPress={() => setBetOn(option)}
          >
            <Text style={styles.betTypeText}>{option.charAt(0).toUpperCase() + option.slice(1)}</Text>
            <Text style={styles.betTypePayout}>
              {option === 'player' ? '2x' : option === 'banker' ? '1.95x' : '9x'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <BetControls bet={bet} setBet={setBet} disabled={loading} />

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: COLORS.rose }]}
        onPress={play}
        disabled={loading}
      >
        <Text style={styles.actionButtonText}>
          {loading ? 'Dealing...' : `Play (${bet.toLocaleString()} BL on ${betOn})`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============== CRAPS GAME ==============
const CrapsGame = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(50);
  const [betType, setBetType] = useState('pass');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const betOptions = [
    { type: 'pass', label: 'Pass Line', desc: '7/11 wins' },
    { type: 'dont_pass', label: "Don't Pass", desc: '2/3 wins' },
    { type: 'field', label: 'Field', desc: '3,4,9,10,11' },
    { type: 'any_seven', label: 'Any 7', desc: '4:1 payout' },
    { type: 'any_craps', label: 'Any Craps', desc: '7:1 payout' },
  ];

  const DICE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  const roll = async () => {
    if (balance < bet) {
      Alert.alert('Insufficient Balance', 'Not enough BL Coins!');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await casinoAPI.rollCraps(bet, betType);
      setResult(response);
      onBalanceUpdate(response.balance);
      if (response.winnings > 0) {
        Alert.alert('🎲 Winner!', `${response.result}! Won ${response.winnings.toLocaleString()} BL!`);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
    setLoading(false);
  };

  return (
    <View style={[styles.gameContainer, { backgroundColor: 'rgba(220, 38, 38, 0.1)' }]}>
      <Text style={[styles.gameTitle, { color: COLORS.red }]}>🎲 Craps</Text>

      {result && (
        <>
          <View style={styles.diceContainer}>
            <View style={styles.die}>
              <Text style={styles.dieText}>{DICE[result.dice[0] - 1]}</Text>
            </View>
            <View style={styles.die}>
              <Text style={styles.dieText}>{DICE[result.dice[1] - 1]}</Text>
            </View>
            <Text style={styles.diceTotal}>= {result.total}</Text>
          </View>

          <View style={[styles.resultBox, result.winnings > 0 ? styles.resultWin : styles.resultLose]}>
            <Text style={styles.resultText}>{result.result}</Text>
            <Text style={styles.resultSubtext}>
              {result.winnings > 0 ? `Won ${result.winnings.toLocaleString()} BL` : 'No win'}
            </Text>
          </View>
        </>
      )}

      {/* Bet Type Selection */}
      <View style={styles.crapsBetOptions}>
        {betOptions.map((option) => (
          <TouchableOpacity
            key={option.type}
            style={[
              styles.crapsBetButton,
              { backgroundColor: COLORS.red },
              betType === option.type && styles.betTypeSelected
            ]}
            onPress={() => setBetType(option.type)}
          >
            <Text style={styles.betTypeText}>{option.label}</Text>
            <Text style={styles.betTypeDesc}>{option.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <BetControls bet={bet} setBet={setBet} disabled={loading} />

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: COLORS.red }]}
        onPress={roll}
        disabled={loading}
      >
        <Text style={styles.actionButtonText}>
          {loading ? 'Rolling...' : `Roll Dice (${bet.toLocaleString()} BL)`}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============== MAIN SCREEN ==============
export default function CasinoGameScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user, refreshUser } = useAuth();
  const [balance, setBalance] = useState(user?.bl_coins || 0);
  const { gameId } = route.params || {};

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    try {
      const data = await walletAPI.getBalance();
      setBalance(data.balance);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBalanceUpdate = useCallback((newBalance) => {
    setBalance(newBalance);
    if (refreshUser) refreshUser();
  }, [refreshUser]);

  const GameComponents = {
    daily: DailySpinGame,
    slots: SlotsGame,
    blackjack: BlackjackGame,
    roulette: RouletteGame,
    wheel: WheelGame,
    poker: PokerGame,
    baccarat: BaccaratGame,
    craps: CrapsGame,
  };

  const GameComponent = GameComponents[gameId];

  if (!GameComponent) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Game not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.balanceChip}>
          <Text style={styles.balanceChipText}>💰 {Math.floor(balance).toLocaleString()} BL</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <GameComponent balance={balance} onBalanceUpdate={handleBalanceUpdate} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: COLORS.text,
    fontSize: 16,
  },
  balanceChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  balanceChipText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
  },
  gameContainer: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gameTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  gameSubtitle: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },
  gameInfo: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  betControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    gap: 8,
  },
  betButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  betButtonText: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  betInput: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    minWidth: 120,
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  actionButtonSmall: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    marginVertical: 12,
  },
  resultBox: {
    padding: 16,
    borderRadius: 12,
    marginVertical: 12,
    alignItems: 'center',
  },
  resultWin: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  resultLose: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  resultPush: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
  },
  resultText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultSubtext: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  jackpotText: {
    color: COLORS.yellow,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  
  // Slots specific
  slotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  reelColumn: {
    marginHorizontal: 4,
  },
  reelCell: {
    width: 60,
    height: 60,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  reelCellMiddle: {
    backgroundColor: 'rgba(234, 179, 8, 0.3)',
    borderWidth: 2,
    borderColor: COLORS.yellow,
  },
  reelSymbol: {
    fontSize: 32,
  },
  
  // Cards
  handContainer: {
    marginBottom: 16,
  },
  handLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  cardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    width: 50,
    height: 70,
    backgroundColor: COLORS.text,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHidden: {
    backgroundColor: COLORS.blue,
  },
  cardText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  smallCard: {
    width: 40,
    height: 56,
    backgroundColor: COLORS.text,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallCardText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  
  // Poker
  pokerCard: {
    width: 56,
    height: 78,
    backgroundColor: COLORS.text,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    position: 'relative',
  },
  pokerCardHeld: {
    borderWidth: 3,
    borderColor: COLORS.yellow,
    transform: [{ translateY: -10 }],
  },
  holdLabel: {
    position: 'absolute',
    top: -20,
    backgroundColor: COLORS.yellow,
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  
  // Roulette
  rouletteWheel: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.green,
    borderWidth: 6,
    borderColor: COLORS.amber,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 20,
  },
  spinning: {
    opacity: 0.7,
  },
  rouletteNumber: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  
  // Bet types
  betTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  betTypeButton: {
    width: (width - 80) / 3,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  betTypeButtonWide: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  betTypeSelected: {
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  betTypeText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  betTypePayout: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  betTypeRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  betTypeDesc: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 2,
  },
  
  // Wheel
  wheelContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  wheelPointer: {
    marginBottom: -10,
    zIndex: 10,
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.yellow,
  },
  wheel: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.card,
    borderWidth: 6,
    borderColor: COLORS.yellow,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  wheelSegment: {
    position: 'absolute',
    width: 100,
    height: 100,
    right: 0,
    top: 0,
    justifyContent: 'center',
    alignItems: 'center',
    transformOrigin: 'bottom left',
  },
  wheelSegmentText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 12,
  },
  wheelCenter: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.background,
    borderWidth: 3,
    borderColor: COLORS.yellow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelCenterText: {
    color: COLORS.yellow,
    fontWeight: 'bold',
    fontSize: 10,
  },
  fortuneWheel: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'linear-gradient(#9333EA, #7C3AED)',
    borderWidth: 6,
    borderColor: COLORS.yellow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  rewardsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    gap: 8,
  },
  rewardItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Baccarat
  baccaratHands: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  baccaratHand: {
    alignItems: 'center',
  },
  
  // Craps
  diceContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  die: {
    width: 60,
    height: 60,
    backgroundColor: COLORS.text,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  dieText: {
    fontSize: 40,
  },
  diceTotal: {
    color: COLORS.yellow,
    fontSize: 24,
    fontWeight: 'bold',
  },
  crapsBetOptions: {
    marginBottom: 16,
  },
  crapsBetButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 8,
  },
  
  // Paytable
  paytable: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
  },
  paytableTitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  paytableText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  
  errorText: {
    color: COLORS.error,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 40,
  },
});
