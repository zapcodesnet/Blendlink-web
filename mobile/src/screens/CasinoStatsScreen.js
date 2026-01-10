/**
 * Casino Stats Screen - Shows user's casino statistics and history
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { casinoAPI } from '../services/api';

const COLORS = {
  background: '#0F172A',
  card: '#1E293B',
  primary: '#F59E0B',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  border: '#334155',
  success: '#22C55E',
  error: '#EF4444',
};

export default function CasinoStatsScreen() {
  const navigation = useNavigation();
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsData, historyData] = await Promise.all([
        casinoAPI.getStats(),
        casinoAPI.getHistory(30),
      ]);
      setStats(statsData);
      setHistory(historyData.history || []);
    } catch (error) {
      console.error('Failed to load casino stats:', error);
    }
    setLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const formatGameType = (type) => {
    const types = {
      slots: '🎰 Slots',
      blackjack: '🃏 Blackjack',
      roulette: '🎡 Roulette',
      wheel: '🎡 Wheel',
      poker: '🃏 Poker',
      baccarat: '🎴 Baccarat',
      craps: '🎲 Craps',
      daily_spin: '🎁 Daily Spin',
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
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
        <Text style={styles.headerTitle}>📊 Casino Stats</Text>
        <View style={styles.placeholder} />
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
        {/* Overall Stats */}
        {stats && (
          <View style={styles.statsCard}>
            <Text style={styles.sectionTitle}>🏆 Your Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{stats.totals?.games_played || 0}</Text>
                <Text style={styles.statLabel}>Games Played</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{(stats.totals?.total_bets || 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Wagered</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{(stats.totals?.total_won || 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Won</Text>
              </View>
              <View style={[styles.statBox, (stats.totals?.net_profit || 0) >= 0 ? styles.profitPositive : styles.profitNegative]}>
                <Text style={[styles.statValue, (stats.totals?.net_profit || 0) >= 0 ? styles.textSuccess : styles.textError]}>
                  {(stats.totals?.net_profit || 0) >= 0 ? '+' : ''}{(stats.totals?.net_profit || 0).toLocaleString()}
                </Text>
                <Text style={styles.statLabel}>Net Profit</Text>
              </View>
            </View>
          </View>
        )}

        {/* Game Breakdown */}
        {stats?.by_game && Object.keys(stats.by_game).length > 0 && (
          <View style={styles.breakdownCard}>
            <Text style={styles.sectionTitle}>📈 By Game</Text>
            {Object.entries(stats.by_game).map(([game, data]) => (
              <View key={game} style={styles.gameRow}>
                <Text style={styles.gameName}>{formatGameType(game)}</Text>
                <View style={styles.gameStats}>
                  <Text style={styles.gameStatText}>{data.games_played} games</Text>
                  <Text style={[
                    styles.gameProfit,
                    data.net_profit >= 0 ? styles.textSuccess : styles.textError
                  ]}>
                    {data.net_profit >= 0 ? '+' : ''}{data.net_profit.toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Games */}
        <View style={styles.historyCard}>
          <Text style={styles.sectionTitle}>📜 Recent Games</Text>
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No games played yet. Try your luck!</Text>
          ) : (
            history.map((game, index) => (
              <View key={index} style={styles.historyRow}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyGame}>{formatGameType(game.game_type)}</Text>
                  <Text style={styles.historyDate}>
                    {new Date(game.timestamp).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={styles.historyBet}>Bet: {game.bet_amount.toLocaleString()}</Text>
                  <Text style={[
                    styles.historyProfit,
                    game.profit >= 0 ? styles.textSuccess : styles.textError
                  ]}>
                    {game.profit >= 0 ? '+' : ''}{game.profit.toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          )}
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  statsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  profitPositive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  profitNegative: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  textSuccess: {
    color: COLORS.success,
  },
  textError: {
    color: COLORS.error,
  },
  breakdownCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  gameName: {
    color: COLORS.text,
    fontSize: 16,
  },
  gameStats: {
    alignItems: 'flex-end',
  },
  gameStatText: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  gameProfit: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 32,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyLeft: {},
  historyGame: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  historyDate: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyBet: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  historyProfit: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 40,
  },
});
