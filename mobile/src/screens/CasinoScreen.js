/**
 * Casino Screen - Main casino lobby with all games
 * Synced 100% with website using same API endpoints
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { casinoAPI, walletAPI } from '../services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// Color scheme matching website
const COLORS = {
  background: '#0F172A',
  card: '#1E293B',
  primary: '#F59E0B',
  primaryDark: '#D97706',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  border: '#334155',
  success: '#22C55E',
  error: '#EF4444',
};

// Game configurations
const GAMES = [
  { id: 'pko_poker', name: 'PKO Poker', icon: '🃏', gradient: ['#8B5CF6', '#6366F1'], desc: 'Tournament!', isNew: true, route: 'PokerLobby' },
  { id: 'daily', name: 'Daily Spin', icon: '🎁', gradient: ['#EAB308', '#D97706'], desc: 'FREE spin every day!' },
  { id: 'slots', name: 'Slots', icon: '🎰', gradient: ['#9333EA', '#EC4899'], desc: 'Win up to 500x!' },
  { id: 'blackjack', name: 'Blackjack', icon: '🃏', gradient: ['#16A34A', '#059669'], desc: 'Beat the dealer' },
  { id: 'roulette', name: 'Roulette', icon: '🎡', gradient: ['#D97706', '#EA580C'], desc: 'Red or black' },
  { id: 'wheel', name: 'Wheel', icon: '🎡', gradient: ['#4F46E5', '#7C3AED'], desc: 'Up to 50x jackpot' },
  { id: 'poker', name: 'Video Poker', icon: '🃏', gradient: ['#2563EB', '#0891B2'], desc: 'Jacks or better' },
  { id: 'baccarat', name: 'Baccarat', icon: '🎴', gradient: ['#E11D48', '#EC4899'], desc: 'Player or banker' },
  { id: 'craps', name: 'Craps', icon: '🎲', gradient: ['#DC2626', '#EA580C'], desc: 'Roll the dice!' },
];

export default function CasinoScreen() {
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const [balance, setBalance] = useState(user?.bl_coins || 0);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [dailySpinAvailable, setDailySpinAvailable] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [balanceData, statsData, dailyStatus] = await Promise.all([
        walletAPI.getBalance(),
        casinoAPI.getStats().catch(() => null),
        casinoAPI.getDailySpinStatus().catch(() => ({ can_spin: false })),
      ]);
      setBalance(balanceData.balance);
      setStats(statsData);
      setDailySpinAvailable(dailyStatus.can_spin);
    } catch (error) {
      console.error('Failed to load casino data:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    if (refreshUser) await refreshUser();
    setRefreshing(false);
  }, [refreshUser]);

  const navigateToGame = (gameId) => {
    // Special handling for PKO Poker (navigate to separate screen)
    if (gameId === 'pko_poker') {
      navigation.navigate('PokerLobby');
      return;
    }
    navigation.navigate('CasinoGame', { gameId });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>🎰 Casino</Text>
        <TouchableOpacity 
          style={styles.statsButton}
          onPress={() => navigation.navigate('CasinoStats')}
        >
          <Text style={styles.statsIcon}>📊</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceLeft}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <Text style={styles.balanceAmount}>{Math.floor(balance).toLocaleString()} BL</Text>
            <Text style={styles.balanceSubtext}>Min: 10 BL • Max: 10,000 BL</Text>
          </View>
          <View style={styles.balanceIcon}>
            <Text style={styles.balanceEmoji}>🎰</Text>
          </View>
        </View>

        {/* Stats Summary */}
        {stats && (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totals?.games_played || 0}</Text>
              <Text style={styles.statLabel}>Games</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{(stats.totals?.total_won || 0).toLocaleString()}</Text>
              <Text style={styles.statLabel}>Won</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[
                styles.statValue,
                { color: (stats.totals?.net_profit || 0) >= 0 ? COLORS.success : COLORS.error }
              ]}>
                {(stats.totals?.net_profit || 0) >= 0 ? '+' : ''}{(stats.totals?.net_profit || 0).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Profit</Text>
            </View>
          </View>
        )}

        {/* Games Section */}
        <Text style={styles.sectionTitle}>Choose Your Game</Text>
        
        <View style={styles.gamesGrid}>
          {GAMES.map((game) => (
            <TouchableOpacity
              key={game.id}
              style={[styles.gameCard, { 
                backgroundColor: game.gradient[0],
                shadowColor: game.gradient[0],
              }]}
              onPress={() => navigateToGame(game.id)}
              activeOpacity={0.8}
            >
              {game.id === 'daily' && dailySpinAvailable && (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeBadgeText}>FREE!</Text>
                </View>
              )}
              {game.isNew && (
                <View style={[styles.freeBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.freeBadgeText}>NEW!</Text>
                </View>
              )}
              <Text style={styles.gameIcon}>{game.icon}</Text>
              <Text style={styles.gameName}>{game.name}</Text>
              <Text style={styles.gameDesc}>{game.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🏆 How It Works</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoCheck}>✓</Text>
            <Text style={styles.infoText}>Provably fair random number generation</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoCheck}>✓</Text>
            <Text style={styles.infoText}>Bet between 10 and 10,000 BL Coins</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoCheck}>✓</Text>
            <Text style={styles.infoText}>Winnings instantly credited to balance</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoCheck}>✓</Text>
            <Text style={styles.infoText}>Synced with Blendlink website</Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
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
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  statsButton: {
    padding: 8,
  },
  statsIcon: {
    fontSize: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  balanceLeft: {},
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  balanceAmount: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  balanceSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  balanceIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceEmoji: {
    fontSize: 32,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gameCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
  },
  freeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  freeBadgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  gameIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  gameName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  gameDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoCheck: {
    color: COLORS.success,
    fontSize: 14,
    marginRight: 8,
  },
  infoText: {
    color: COLORS.textMuted,
    fontSize: 14,
    flex: 1,
  },
  bottomPadding: {
    height: 40,
  },
});
