/**
 * Games Screen - Links to Casino, Photo Game, and other games
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { walletAPI, casinoAPI, photoGameAPI } from '../services/api';

const { width } = Dimensions.get('window');

export default function GamesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, toggleTheme, isDark } = useTheme();
  const [balance, setBalance] = useState(user?.bl_coins || 0);
  const [dailySpinAvailable, setDailySpinAvailable] = useState(false);
  const [gameStats, setGameStats] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [balanceData, dailyStatus, stats] = await Promise.all([
        walletAPI.getBalance(),
        casinoAPI.getDailySpinStatus().catch(() => ({ can_spin: false })),
        photoGameAPI.getMyStats().catch(() => null),
      ]);
      setBalance(balanceData.balance);
      setDailySpinAvailable(dailyStatus.can_spin);
      setGameStats(stats);
    } catch (error) {
      console.error('Failed to load games data:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>🎮 Games</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
            <Text style={styles.themeToggleText}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <View style={[styles.balanceChip, { backgroundColor: colors.gold + '20' }]}>
            <Text style={[styles.balanceText, { color: colors.gold }]}>💰 {Math.floor(balance).toLocaleString()} BL</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo Game Arena CTA - NEW */}
        <TouchableOpacity
          style={[styles.photoBattleBanner, { shadowColor: colors.primary }]}
          onPress={() => navigation.navigate('PhotoGameArena')}
          activeOpacity={0.9}
        >
          <View style={styles.photoBattleContent}>
            <View style={styles.photoBattleLeft}>
              <View style={styles.newFeatureBadge}>
                <Text style={styles.newFeatureBadgeText}>⚡ NEW</Text>
              </View>
              <Text style={styles.photoBattleTitle}>⚔️ Photo Battle Arena</Text>
              <Text style={styles.photoBattleSubtitle}>
                PvP • RPS • Photo Auctions
              </Text>
              {gameStats && (
                <View style={styles.photoBattleStats}>
                  <View style={styles.photoBattleStat}>
                    <Text style={styles.photoBattleStatValue}>{gameStats.battles_won || 0}</Text>
                    <Text style={styles.photoBattleStatLabel}>Wins</Text>
                  </View>
                  <View style={styles.photoBattleStat}>
                    <Text style={styles.photoBattleStatValue}>{gameStats.current_win_streak || 0}</Text>
                    <Text style={styles.photoBattleStatLabel}>Streak</Text>
                  </View>
                  <View style={styles.photoBattleStat}>
                    <Text style={styles.photoBattleStatValue}>{Math.round(gameStats.stamina || 100)}</Text>
                    <Text style={styles.photoBattleStatLabel}>Stamina</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.photoBattleRight}>
              <Text style={styles.photoBattleEmoji}>⚔️</Text>
            </View>
          </View>
          <View style={styles.photoBattleArrow}>
            <Text style={styles.arrowText}>Battle Now →</Text>
          </View>
        </TouchableOpacity>

        {/* Minted Photos Quick Access */}
        <TouchableOpacity
          style={[styles.mintedPhotosCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate('MintedPhotos')}
        >
          <View style={styles.mintedPhotosIcon}>
            <Text style={styles.mintedPhotosEmoji}>✨</Text>
          </View>
          <View style={styles.mintedPhotosInfo}>
            <Text style={[styles.mintedPhotosTitle, { color: colors.text }]}>Minted Photos</Text>
            <Text style={[styles.mintedPhotosDesc, { color: colors.textMuted }]}>View & mint collectibles</Text>
          </View>
          <Text style={[styles.mintedPhotosArrow, { color: colors.textMuted }]}>→</Text>
        </TouchableOpacity>

        {/* Casino CTA - Featured with Poker Image */}
        <TouchableOpacity
          style={[styles.casinoBanner, { shadowColor: colors.gold }]}
          onPress={() => navigation.navigate('Casino')}
          activeOpacity={0.9}
        >
          <View style={styles.casinoBannerContent}>
            <View style={styles.casinoBannerLeft}>
              {dailySpinAvailable && (
                <View style={[styles.newBadge, { backgroundColor: colors.success }]}>
                  <Text style={styles.newBadgeText}>FREE SPIN!</Text>
                </View>
              )}
              <Text style={styles.casinoBannerTitle}>🎰 Casino Games</Text>
              <Text style={styles.casinoBannerSubtitle}>
                Blackjack • Slots • Roulette • Poker
              </Text>
              <View style={styles.casinoBannerTags}>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Bet 10-10,000 BL</Text>
                </View>
                <View style={styles.tag}>
                  <Text style={styles.tagText}>Provably Fair</Text>
                </View>
              </View>
            </View>
            <View style={styles.casinoBannerRight}>
              {/* Poker cards visual */}
              <View style={styles.pokerCardsContainer}>
                <View style={[styles.pokerCard, styles.pokerCard1]}>
                  <Text style={styles.pokerCardText}>A♠</Text>
                </View>
                <View style={[styles.pokerCard, styles.pokerCard2]}>
                  <Text style={styles.pokerCardText}>K♥</Text>
                </View>
                <View style={[styles.pokerCard, styles.pokerCard3]}>
                  <Text style={styles.pokerCardText}>Q♦</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.casinoBannerArrow}>
            <Text style={styles.arrowText}>Play Now →</Text>
          </View>
        </TouchableOpacity>

        {/* Quick Access to Games */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Access</Text>
        <View style={styles.quickGamesGrid}>
          <TouchableOpacity
            style={[styles.quickGameCard, { backgroundColor: '#8B5CF6' }]}
            onPress={() => navigation.navigate('PhotoGameArena')}
          >
            <Text style={styles.quickGameIcon}>⚔️</Text>
            <Text style={styles.quickGameName}>Battle</Text>
            <Text style={styles.quickGameDesc}>PvP Arena</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickGameCard, { backgroundColor: '#EAB308' }]}
            onPress={() => navigation.navigate('CasinoGame', { gameId: 'daily' })}
          >
            {dailySpinAvailable && <View style={[styles.freeDot, { backgroundColor: colors.success }]} />}
            <Text style={styles.quickGameIcon}>🎁</Text>
            <Text style={styles.quickGameName}>Daily Spin</Text>
            <Text style={styles.quickGameDesc}>Free daily!</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickGameCard, { backgroundColor: '#9333EA' }]}
            onPress={() => navigation.navigate('CasinoGame', { gameId: 'slots' })}
          >
            <Text style={styles.quickGameIcon}>🎰</Text>
            <Text style={styles.quickGameName}>Slots</Text>
            <Text style={styles.quickGameDesc}>Up to 500x</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickGameCard, { backgroundColor: '#16A34A' }]}
            onPress={() => navigation.navigate('CasinoGame', { gameId: 'blackjack' })}
          >
            <Text style={styles.quickGameIcon}>🃏</Text>
            <Text style={styles.quickGameName}>Blackjack</Text>
            <Text style={styles.quickGameDesc}>Beat 21</Text>
          </TouchableOpacity>
        </View>

        {/* All Casino Games Link */}
        <TouchableOpacity
          style={[styles.allGamesButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Casino')}
        >
          <Text style={[styles.allGamesText, { color: colors.gold }]}>View All 8 Casino Games →</Text>
        </TouchableOpacity>

        {/* Mini Games Section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Mini Games</Text>
        <View style={styles.miniGamesContainer}>
          <TouchableOpacity style={[styles.miniGameCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.miniGameIcon, { backgroundColor: '#3B82F6' }]}>
              <Text style={styles.miniGameEmoji}>🧠</Text>
            </View>
            <View style={styles.miniGameInfo}>
              <Text style={[styles.miniGameName, { color: colors.text }]}>Memory Match</Text>
              <Text style={[styles.miniGameDesc, { color: colors.textMuted }]}>Free to play! Match pairs</Text>
            </View>
            <View style={[styles.comingSoonBadge, { backgroundColor: colors.background }]}>
              <Text style={[styles.comingSoonText, { color: colors.textMuted }]}>Coming Soon</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.miniGameCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.miniGameIcon, { backgroundColor: '#EC4899' }]}>
              <Text style={styles.miniGameEmoji}>🎫</Text>
            </View>
            <View style={styles.miniGameInfo}>
              <Text style={[styles.miniGameName, { color: colors.text }]}>Scratch Cards</Text>
              <Text style={[styles.miniGameDesc, { color: colors.textMuted }]}>Instant win prizes</Text>
            </View>
            <View style={[styles.comingSoonBadge, { backgroundColor: colors.background }]}>
              <Text style={[styles.comingSoonText, { color: colors.textMuted }]}>Coming Soon</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Raffles Link */}
        <TouchableOpacity style={[styles.rafflesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.rafflesIcon, { backgroundColor: colors.gold }]}>
            <Text style={styles.rafflesEmoji}>🏆</Text>
          </View>
          <View style={styles.rafflesInfo}>
            <Text style={[styles.rafflesTitle, { color: colors.text }]}>Raffles & Contests</Text>
            <Text style={[styles.rafflesDesc, { color: colors.textMuted }]}>Enter for a chance to win big prizes!</Text>
          </View>
        </TouchableOpacity>

        {/* Sync Notice */}
        <Text style={[styles.syncNotice, { color: colors.textMuted }]}>
          🔄 Synced with Blendlink website
        </Text>

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
  headerTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  balanceChip: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  balanceText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  casinoBanner: {
    backgroundColor: '#D97706',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  casinoBannerContent: {
    flexDirection: 'row',
    padding: 20,
  },
  casinoBannerLeft: {
    flex: 1,
  },
  newBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  newBadgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  casinoBannerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  casinoBannerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 12,
  },
  casinoBannerTags: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    color: COLORS.text,
    fontSize: 11,
  },
  casinoBannerRight: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
  },
  pokerCardsContainer: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  pokerCard: {
    position: 'absolute',
    width: 45,
    height: 60,
    backgroundColor: COLORS.text,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  pokerCard1: {
    left: 0,
    top: 10,
    transform: [{ rotate: '-15deg' }],
  },
  pokerCard2: {
    left: 18,
    top: 0,
    zIndex: 1,
  },
  pokerCard3: {
    left: 36,
    top: 10,
    transform: [{ rotate: '15deg' }],
  },
  pokerCardText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  casinoBannerArrow: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  arrowText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickGamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickGameCard: {
    width: (width - 48) / 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  freeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
  },
  quickGameIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  quickGameName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickGameDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  allGamesButton: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  allGamesText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  miniGamesContainer: {
    marginBottom: 24,
  },
  miniGameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniGameIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniGameEmoji: {
    fontSize: 24,
  },
  miniGameInfo: {
    flex: 1,
    marginLeft: 12,
  },
  miniGameName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  miniGameDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  comingSoonBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  rafflesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rafflesIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rafflesEmoji: {
    fontSize: 24,
  },
  rafflesInfo: {
    flex: 1,
    marginLeft: 12,
  },
  rafflesTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  rafflesDesc: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  syncNotice: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
  bottomPadding: {
    height: 40,
  },
});
