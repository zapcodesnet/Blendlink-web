/**
 * Games Screen - Links to Casino, Photo Game, and other games
 * BL Coins balance REMOVED from this screen
 * Casino Games locked for regular users, only accessible to admin (blendlinknet@gmail.com)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { walletAPI, casinoAPI, photoGameAPI } from '../services/api';

const { width } = Dimensions.get('window');

// Admin email for full casino access
const ADMIN_EMAIL = "blendlinknet@gmail.com";

export default function GamesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, toggleTheme, isDark } = useTheme();
  const [dailySpinAvailable, setDailySpinAvailable] = useState(false);
  const [gameStats, setGameStats] = useState(null);

  // Check if current user is admin
  const isAdmin = user?.email === ADMIN_EMAIL || user?.role === 'admin' || user?.is_admin === true;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dailyStatus, stats] = await Promise.all([
        casinoAPI.getDailySpinStatus().catch(() => ({ can_spin: false })),
        photoGameAPI.getMyStats().catch(() => null),
      ]);
      setDailySpinAvailable(dailyStatus.can_spin);
      setGameStats(stats);
    } catch (error) {
      console.error('Failed to load games data:', error);
    }
  };

  // Handle casino navigation - only for admin
  const handleCasinoPress = () => {
    if (isAdmin) {
      navigation.navigate('Casino');
    }
  };

  // Handle casino game press - only for admin
  const handleCasinoGamePress = (gameId) => {
    if (isAdmin) {
      navigation.navigate('CasinoGame', { gameId });
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header - BL Coins balance REMOVED */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>🎮 Games</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
            <Text style={styles.themeToggleText}>{isDark ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          {/* Balance display removed from Games screen */}
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

        {/* Open Games Browser - Browse & Join PVP Battles */}
        <TouchableOpacity
          style={[styles.openGamesCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate('OpenGamesBrowser')}
        >
          <View style={styles.openGamesIcon}>
            <Text style={styles.openGamesEmoji}>👥</Text>
          </View>
          <View style={styles.openGamesInfo}>
            <Text style={[styles.openGamesTitle, { color: colors.text }]}>Open Games</Text>
            <Text style={[styles.openGamesDesc, { color: colors.textMuted }]}>Browse & join PvP battles</Text>
          </View>
          <Text style={[styles.openGamesArrow, { color: colors.textMuted }]}>→</Text>
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

        {/* Casino CTA - Admin Only Full Access, Coming Soon for Others */}
        {isAdmin ? (
          <TouchableOpacity
            style={[styles.casinoBanner, { shadowColor: colors.gold }]}
            onPress={handleCasinoPress}
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
        ) : (
          <View style={[styles.casinoBannerLocked, { shadowColor: '#666' }]}>
            <View style={styles.casinoBannerContent}>
              <View style={styles.casinoBannerLeft}>
                <Text style={styles.casinoBannerTitleLocked}>🎰 Casino Games</Text>
                <Text style={styles.casinoBannerSubtitleLocked}>
                  Blackjack • Slots • Roulette • Poker
                </Text>
                <View style={styles.comingSoonBannerBadge}>
                  <Text style={styles.comingSoonBannerText}>🚧 Coming Soon</Text>
                </View>
              </View>
              <View style={styles.casinoBannerRight}>
                <View style={styles.lockIconContainer}>
                  <Text style={styles.lockIcon}>🔒</Text>
                </View>
              </View>
            </View>
            <View style={styles.casinoBannerArrowLocked}>
              <Text style={styles.arrowTextLocked}>Stay Tuned!</Text>
            </View>
          </View>
        )}

        {/* Quick Access to Games - Admin Only */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Access</Text>
        <View style={styles.quickGamesGrid}>
          <TouchableOpacity
            style={[styles.quickGameCard, { backgroundColor: '#8B5CF6' }]}
            onPress={() => navigation.navigate('GameCreation', { mode: 'create' })}
          >
            <Text style={styles.quickGameIcon}>⚔️</Text>
            <Text style={styles.quickGameName}>Create</Text>
            <Text style={styles.quickGameDesc}>New Battle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickGameCard, { backgroundColor: '#22C55E' }]}
            onPress={() => navigation.navigate('OpenGamesBrowser')}
          >
            <Text style={styles.quickGameIcon}>👥</Text>
            <Text style={styles.quickGameName}>Join</Text>
            <Text style={styles.quickGameDesc}>Open Games</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickGameCard, { backgroundColor: '#EAB308' }]}
            onPress={() => navigation.navigate('GameCreation', { mode: 'bot', botDifficulty: 'medium' })}
          >
            <Text style={styles.quickGameIcon}>🤖</Text>
            <Text style={styles.quickGameName}>Bot Match</Text>
            <Text style={styles.quickGameDesc}>Practice</Text>
          </TouchableOpacity>

          {isAdmin ? (
            <TouchableOpacity
              style={[styles.quickGameCard, { backgroundColor: '#9333EA' }]}
              onPress={() => handleCasinoGamePress('slots')}
            >
              <Text style={styles.quickGameIcon}>🎰</Text>
              <Text style={styles.quickGameName}>Slots</Text>
              <Text style={styles.quickGameDesc}>Up to 500x</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.quickGameCardLocked, { backgroundColor: '#4B5563' }]}>
              <View style={styles.lockedOverlay}>
                <Text style={styles.lockIconSmall}>🔒</Text>
              </View>
              <Text style={styles.quickGameIcon}>🎰</Text>
              <Text style={styles.quickGameName}>Slots</Text>
              <Text style={styles.quickGameDescLocked}>Coming Soon</Text>
            </View>
          )}
        </View>

        {/* All Casino Games Link - Admin Only */}
        {isAdmin ? (
          <TouchableOpacity
            style={[styles.allGamesButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => navigation.navigate('Casino')}
          >
            <Text style={[styles.allGamesText, { color: colors.gold }]}>View All 8 Casino Games →</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.allGamesButtonLocked, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.allGamesTextLocked, { color: colors.textMuted }]}>🔒 Casino Games Coming Soon</Text>
          </View>
        )}

        {/* Casino Games Section - Locked for Non-Admin Users */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          🎰 Casino Games {!isAdmin && <Text style={styles.lockedBadgeInline}>🔒 Coming Soon</Text>}
        </Text>
        
        <View style={[styles.casinoGamesContainer, !isAdmin && styles.casinoGamesLocked]}>
          {/* Overlay for non-admin */}
          {!isAdmin && (
            <View style={styles.lockedOverlayFull}>
              <View style={styles.lockedContent}>
                <Text style={styles.lockedIconLarge}>🔒</Text>
                <Text style={styles.lockedTitle}>Coming Soon</Text>
                <Text style={styles.lockedSubtitle}>These games are in development</Text>
              </View>
            </View>
          )}

          {/* Spin Wheel */}
          <TouchableOpacity 
            style={[styles.miniGameCard, { backgroundColor: colors.card, borderColor: colors.border }, !isAdmin && styles.miniGameCardLocked]}
            onPress={() => isAdmin && handleCasinoGamePress('spin_wheel')}
            disabled={!isAdmin}
          >
            <View style={[styles.miniGameIcon, { backgroundColor: '#8B5CF6' }]}>
              <Text style={styles.miniGameEmoji}>🎡</Text>
              {!isAdmin && <View style={styles.miniLockBadge}><Text style={styles.miniLockText}>🔒</Text></View>}
            </View>
            <View style={styles.miniGameInfo}>
              <Text style={[styles.miniGameName, { color: colors.text }]}>Spin Wheel</Text>
              <Text style={[styles.miniGameDesc, { color: colors.textMuted }]}>Win up to 10x your bet!</Text>
            </View>
            {isAdmin ? (
              <View style={[styles.playBadge, { backgroundColor: '#8B5CF6' }]}>
                <Text style={styles.playBadgeText}>Play</Text>
              </View>
            ) : (
              <View style={[styles.comingSoonBadge, { backgroundColor: colors.background }]}>
                <Text style={[styles.comingSoonText, { color: colors.textMuted }]}>Locked</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Scratch Cards */}
          <TouchableOpacity 
            style={[styles.miniGameCard, { backgroundColor: colors.card, borderColor: colors.border }, !isAdmin && styles.miniGameCardLocked]}
            onPress={() => isAdmin && handleCasinoGamePress('scratch_card')}
            disabled={!isAdmin}
          >
            <View style={[styles.miniGameIcon, { backgroundColor: '#10B981' }]}>
              <Text style={styles.miniGameEmoji}>🎫</Text>
              {!isAdmin && <View style={styles.miniLockBadge}><Text style={styles.miniLockText}>🔒</Text></View>}
            </View>
            <View style={styles.miniGameInfo}>
              <Text style={[styles.miniGameName, { color: colors.text }]}>Scratch Cards</Text>
              <Text style={[styles.miniGameDesc, { color: colors.textMuted }]}>Instant win prizes</Text>
            </View>
            {isAdmin ? (
              <View style={[styles.playBadge, { backgroundColor: '#10B981' }]}>
                <Text style={styles.playBadgeText}>Play</Text>
              </View>
            ) : (
              <View style={[styles.comingSoonBadge, { backgroundColor: colors.background }]}>
                <Text style={[styles.comingSoonText, { color: colors.textMuted }]}>Locked</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Memory Match */}
          <TouchableOpacity 
            style={[styles.miniGameCard, { backgroundColor: colors.card, borderColor: colors.border }, !isAdmin && styles.miniGameCardLocked]}
            onPress={() => isAdmin && handleCasinoGamePress('memory_match')}
            disabled={!isAdmin}
          >
            <View style={[styles.miniGameIcon, { backgroundColor: '#3B82F6' }]}>
              <Text style={styles.miniGameEmoji}>🧠</Text>
              {!isAdmin && <View style={styles.miniLockBadge}><Text style={styles.miniLockText}>🔒</Text></View>}
            </View>
            <View style={styles.miniGameInfo}>
              <Text style={[styles.miniGameName, { color: colors.text }]}>Memory Match</Text>
              <Text style={[styles.miniGameDesc, { color: colors.textMuted }]}>Free to play! Match pairs</Text>
            </View>
            {isAdmin ? (
              <View style={[styles.playBadge, { backgroundColor: '#3B82F6' }]}>
                <Text style={styles.playBadgeText}>Play</Text>
              </View>
            ) : (
              <View style={[styles.comingSoonBadge, { backgroundColor: colors.background }]}>
                <Text style={[styles.comingSoonText, { color: colors.textMuted }]}>Locked</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Raffles Link */}
        <TouchableOpacity 
          style={[styles.rafflesCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => navigation.navigate('Raffles')}
        >
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themeToggle: {
    padding: 8,
  },
  themeToggleText: {
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  // Photo Battle Banner
  photoBattleBanner: {
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  photoBattleContent: {
    flexDirection: 'row',
    padding: 20,
  },
  photoBattleLeft: {
    flex: 1,
  },
  newFeatureBadge: {
    backgroundColor: '#22C55E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  newFeatureBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  photoBattleTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  photoBattleSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 12,
  },
  photoBattleStats: {
    flexDirection: 'row',
    gap: 16,
  },
  photoBattleStat: {
    alignItems: 'center',
  },
  photoBattleStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  photoBattleStatLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
  },
  photoBattleRight: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  photoBattleEmoji: {
    fontSize: 48,
  },
  photoBattleArrow: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  // Minted Photos Card
  mintedPhotosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  mintedPhotosIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F59E0B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mintedPhotosEmoji: {
    fontSize: 22,
  },
  mintedPhotosInfo: {
    flex: 1,
    marginLeft: 12,
  },
  mintedPhotosTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  mintedPhotosDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  mintedPhotosArrow: {
    fontSize: 20,
  },
  // Open Games Card
  openGamesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  openGamesIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  openGamesEmoji: {
    fontSize: 22,
  },
  openGamesInfo: {
    flex: 1,
    marginLeft: 12,
  },
  openGamesTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  openGamesDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  openGamesArrow: {
    fontSize: 20,
  },
  // Casino Banner
  casinoBanner: {
    backgroundColor: '#D97706',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  casinoBannerLocked: {
    backgroundColor: '#4B5563',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    opacity: 0.8,
  },
  casinoBannerContent: {
    flexDirection: 'row',
    padding: 20,
  },
  casinoBannerLeft: {
    flex: 1,
  },
  newBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  casinoBannerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  casinoBannerTitleLocked: {
    color: '#9CA3AF',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  casinoBannerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 12,
  },
  casinoBannerSubtitleLocked: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 12,
  },
  comingSoonBannerBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  comingSoonBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
    color: '#fff',
    fontSize: 11,
  },
  casinoBannerRight: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
  },
  lockIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockIcon: {
    fontSize: 32,
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
    backgroundColor: '#fff',
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
  casinoBannerArrowLocked: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  arrowText: {
    color: '#fff',
    fontWeight: '600',
  },
  arrowTextLocked: {
    color: '#9CA3AF',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  lockedBadgeInline: {
    fontSize: 12,
    color: '#F59E0B',
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
  quickGameCardLocked: {
    width: (width - 48) / 2,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
    opacity: 0.6,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  lockIconSmall: {
    fontSize: 16,
  },
  quickGameIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  quickGameName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickGameDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  quickGameDescLocked: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  allGamesButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  allGamesButtonLocked: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    opacity: 0.6,
  },
  allGamesText: {
    fontWeight: '600',
  },
  allGamesTextLocked: {
    fontWeight: '600',
  },
  // Casino Games Section
  casinoGamesContainer: {
    marginBottom: 24,
    position: 'relative',
  },
  casinoGamesLocked: {
    opacity: 0.5,
  },
  lockedOverlayFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedContent: {
    alignItems: 'center',
  },
  lockedIconLarge: {
    fontSize: 48,
    marginBottom: 8,
  },
  lockedTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  lockedSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  miniGameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  miniGameCardLocked: {
    opacity: 0.7,
  },
  miniGameIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  miniLockBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniLockText: {
    fontSize: 10,
  },
  miniGameEmoji: {
    fontSize: 24,
  },
  miniGameInfo: {
    flex: 1,
    marginLeft: 12,
  },
  miniGameName: {
    fontSize: 16,
    fontWeight: '600',
  },
  miniGameDesc: {
    fontSize: 12,
  },
  playBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  playBadgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  comingSoonBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  comingSoonText: {
    fontSize: 11,
  },
  rafflesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  rafflesIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: '600',
  },
  rafflesDesc: {
    fontSize: 12,
  },
  syncNotice: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
  bottomPadding: {
    height: 40,
  },
});
