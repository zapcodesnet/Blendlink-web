/**
 * Casino Screen - Main casino lobby with all games
 * Shows all games in locked/teaser mode for non-admin users
 * Full access for admin (blendlinknet@gmail.com)
 * 100% synchronized with web version
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { casinoAPI, walletAPI } from '../services/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

// Admin email for full access
const ADMIN_EMAIL = "blendlinknet@gmail.com";

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
  locked: '#4B5563',
};

// All casino games - always visible
const GAMES = [
  { id: 'daily', name: 'Daily Spin', icon: '🎁', gradient: ['#EAB308', '#D97706'], desc: 'FREE spin every day!' },
  { id: 'pko_poker', name: 'PKO Poker', icon: '🃏', gradient: ['#8B5CF6', '#6366F1'], desc: 'Tournament!', isNew: true, route: 'PokerLobby' },
  { id: 'slots', name: 'Slots', icon: '🎰', gradient: ['#9333EA', '#EC4899'], desc: 'Win up to 500x!' },
  { id: 'blackjack', name: 'Blackjack', icon: '🃏', gradient: ['#16A34A', '#059669'], desc: 'Beat the dealer' },
  { id: 'roulette', name: 'Roulette', icon: '🎡', gradient: ['#D97706', '#EA580C'], desc: 'Red or black' },
  { id: 'wheel', name: 'Wheel of Fortune', icon: '🎡', gradient: ['#4F46E5', '#7C3AED'], desc: 'Up to 50x jackpot' },
  { id: 'poker', name: 'Video Poker', icon: '🃏', gradient: ['#2563EB', '#0891B2'], desc: 'Jacks or better' },
  { id: 'baccarat', name: 'Baccarat', icon: '🎴', gradient: ['#E11D48', '#EC4899'], desc: 'Player or banker' },
  { id: 'craps', name: 'Craps', icon: '🎲', gradient: ['#DC2626', '#EA580C'], desc: 'Roll the dice!' },
  // Mini-games from Games page (relocated here)
  { id: 'spin_wheel', name: 'Spin Wheel', icon: '🎡', gradient: ['#8B5CF6', '#EC4899'], desc: 'Win up to 5x your bet!' },
  { id: 'scratch_card', name: 'Scratch Card', icon: '✨', gradient: ['#10B981', '#14B8A6'], desc: 'Match 3 to win!' },
  { id: 'memory_match', name: 'Memory Match', icon: '🧠', gradient: ['#3B82F6', '#6366F1'], desc: 'Free to play!' },
];

export default function CasinoScreen() {
  const navigation = useNavigation();
  const { user, refreshUser } = useAuth();
  const [balance, setBalance] = useState(user?.bl_coins || 0);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);

  // Check if user is admin by email
  const isAdmin = user?.email === ADMIN_EMAIL || user?.role === 'admin' || user?.is_admin === true;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [balanceData, statsData] = await Promise.all([
        walletAPI.getBalance().catch(() => ({ balance: user?.bl_coins || 0 })),
        casinoAPI.getStats().catch(() => null),
      ]);
      setBalance(balanceData.balance);
      setStats(statsData);
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

  // Handle game press - only works for admin
  const handleGamePress = (game) => {
    if (!isAdmin) {
      // Show toast or alert for non-admin
      return;
    }
    if (game.route) {
      navigation.navigate(game.route);
    } else {
      navigation.navigate('CasinoGame', { gameId: game.id });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>🎰 Casino</Text>
          {!isAdmin && (
            <View style={styles.comingSoonHeaderBadge}>
              <Text style={styles.comingSoonHeaderText}>Coming Soon</Text>
            </View>
          )}
        </View>
        {isAdmin && (
          <TouchableOpacity 
            style={styles.statsButton}
            onPress={() => navigation.navigate('CasinoStats')}
          >
            <Text style={styles.statsIcon}>📊</Text>
          </TouchableOpacity>
        )}
        {!isAdmin && <View style={styles.statsButton} />}
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
        <View style={[
          styles.balanceCard,
          { backgroundColor: isAdmin ? COLORS.primary : COLORS.locked }
        ]}>
          <View style={styles.balanceLeft}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <Text style={styles.balanceAmount}>{Math.floor(balance).toLocaleString()} BL</Text>
            <Text style={styles.balanceSubtext}>
              {isAdmin ? 'Min: 10 BL • Max: 10,000 BL' : 'Games unlocking soon!'}
            </Text>
          </View>
          <View style={[styles.balanceIcon, { backgroundColor: isAdmin ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }]}>
            <Text style={styles.balanceEmoji}>{isAdmin ? '🎰' : '🔒'}</Text>
          </View>
        </View>

        {/* Status Banner for non-admin */}
        {!isAdmin && (
          <View style={styles.comingSoonBanner}>
            <Text style={styles.comingSoonTitle}>🚧 Casino Games Coming Soon!</Text>
            <Text style={styles.comingSoonDesc}>All games below are in development. Stay tuned for launch!</Text>
          </View>
        )}

        {/* Stats Summary - Admin only */}
        {isAdmin && stats && (
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
        <Text style={styles.sectionTitle}>
          Choose Your Game {!isAdmin && <Text style={styles.previewText}>(Preview)</Text>}
        </Text>
        
        <View style={styles.gamesGrid}>
          {GAMES.map((game) => (
            <TouchableOpacity
              key={game.id}
              style={[
                styles.gameCard,
                { 
                  backgroundColor: isAdmin ? game.gradient[0] : COLORS.locked,
                  shadowColor: isAdmin ? game.gradient[0] : '#000',
                  opacity: isAdmin ? 1 : 0.6,
                }
              ]}
              onPress={() => handleGamePress(game)}
              activeOpacity={isAdmin ? 0.8 : 1}
              disabled={!isAdmin}
            >
              {/* Lock overlay for non-admin */}
              {!isAdmin && (
                <View style={styles.lockOverlay}>
                  <Text style={styles.lockIcon}>🔒</Text>
                </View>
              )}
              {game.isNew && isAdmin && (
                <View style={[styles.newBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={styles.newBadgeText}>NEW!</Text>
                </View>
              )}
              <Text style={[styles.gameIcon, { opacity: isAdmin ? 1 : 0.5 }]}>{game.icon}</Text>
              <Text style={styles.gameName}>{game.name}</Text>
              <Text style={[styles.gameDesc, { color: isAdmin ? 'rgba(255,255,255,0.8)' : '#6B7280' }]}>{game.desc}</Text>
              {!isAdmin && (
                <View style={styles.lockedBadge}>
                  <Text style={styles.lockedBadgeText}>Locked</Text>
                </View>
              )}
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
    width: 70,
  },
  backText: {
    color: COLORS.text,
    fontSize: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  comingSoonHeaderBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  comingSoonHeaderText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsButton: {
    padding: 8,
    width: 70,
    alignItems: 'flex-end',
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
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  balanceLeft: {
    flex: 1,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  balanceAmount: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  balanceSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  balanceIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceEmoji: {
    fontSize: 32,
  },
  comingSoonBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  comingSoonTitle: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  comingSoonDesc: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
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
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  previewText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: 'normal',
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
    marginBottom: 12,
    position: 'relative',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  lockOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  lockIcon: {
    fontSize: 12,
  },
  newBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newBadgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  gameIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  gameName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  gameDesc: {
    fontSize: 11,
    marginTop: 4,
  },
  lockedBadge: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  lockedBadgeText: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoCheck: {
    color: COLORS.success,
    fontSize: 14,
    marginRight: 10,
  },
  infoText: {
    color: COLORS.textMuted,
    fontSize: 13,
    flex: 1,
  },
  bottomPadding: {
    height: 40,
  },
});
