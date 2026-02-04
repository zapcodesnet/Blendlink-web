/**
 * Games Screen - Consolidated Casino Games Section
 * All mini-games (Spin Wheel, Scratch Card, Memory Match) nested inside single Casino Games card
 * BL Coins balance REMOVED from this screen
 * Admin (blendlinknet@gmail.com) has full access
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
import { casinoAPI, photoGameAPI } from '../services/api';

const { width } = Dimensions.get('window');

// Admin email for full casino access
const ADMIN_EMAIL = "blendlinknet@gmail.com";

// Casino mini-games data
const CASINO_MINI_GAMES = [
  {
    id: "spin_wheel",
    name: "Spin Wheel",
    description: "Spin to win up to 5x your bet!",
    emoji: "🎡",
    color: "#8B5CF6",
  },
  {
    id: "scratch_card",
    name: "Scratch Card",
    description: "Match 3 symbols to win big!",
    emoji: "🎫",
    color: "#10B981",
  },
  {
    id: "memory_match",
    name: "Memory Match",
    description: "Free to play! Earn coins for matching pairs",
    emoji: "🧠",
    color: "#3B82F6",
  }
];

export default function GamesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, toggleTheme, isDark } = useTheme();
  const [gameStats, setGameStats] = useState(null);

  // Check if current user is admin
  const isAdmin = user?.email === ADMIN_EMAIL || user?.role === 'admin' || user?.is_admin === true;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const stats = await photoGameAPI.getMyStats().catch(() => null);
      setGameStats(stats);
    } catch (error) {
      console.error('Failed to load games data:', error);
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
        <TouchableOpacity onPress={toggleTheme} style={styles.themeToggle}>
          <Text style={styles.themeToggleText}>{isDark ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Photo Game Arena CTA */}
        <TouchableOpacity
          style={styles.photoBattleBanner}
          onPress={() => navigation.navigate('PhotoGameArena')}
          activeOpacity={0.9}
        >
          <View style={styles.photoBattleContent}>
            <View style={styles.photoBattleLeft}>
              <View style={styles.newFeatureBadge}>
                <Text style={styles.newFeatureBadgeText}>⚡ NEW</Text>
              </View>
              <Text style={styles.photoBattleTitle}>⚔️ Photo Battle Arena</Text>
              <Text style={styles.photoBattleSubtitle}>PvP • RPS • Photo Auctions</Text>
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

        {/* Quick Links Row */}
        <View style={styles.quickLinksRow}>
          <TouchableOpacity
            style={[styles.quickLinkCard, { backgroundColor: '#F59E0B' }]}
            onPress={() => navigation.navigate('MintedPhotos')}
          >
            <Text style={styles.quickLinkEmoji}>✨</Text>
            <Text style={styles.quickLinkTitle}>Minted Photos</Text>
            <Text style={styles.quickLinkDesc}>Mint collectibles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickLinkCard, { backgroundColor: '#10B981' }]}
            onPress={() => navigation.navigate('PhotoMarketplace')}
          >
            <Text style={styles.quickLinkEmoji}>🏪</Text>
            <Text style={styles.quickLinkTitle}>Marketplace</Text>
            <Text style={styles.quickLinkDesc}>Buy & Sell</Text>
          </TouchableOpacity>
        </View>

        {/* SINGLE CONSOLIDATED Casino Games Section */}
        <View style={[
          styles.casinoSection,
          { backgroundColor: isAdmin ? '#D97706' : '#4B5563' }
        ]}>
          {/* Casino Header */}
          <View style={styles.casinoHeader}>
            <View style={styles.casinoHeaderLeft}>
              <View style={styles.casinoTitleRow}>
                <Text style={styles.casinoLabel}>🎰 CASINO</Text>
                {!isAdmin && (
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonBadgeText}>Coming Soon</Text>
                  </View>
                )}
              </View>
              <Text style={styles.casinoTitle}>Casino Games</Text>
              {!isAdmin && (
                <Text style={styles.casinoSubtitle}>Exciting games launching soon!</Text>
              )}
            </View>
            <View style={[styles.casinoHeaderIcon, { backgroundColor: isAdmin ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }]}>
              <Text style={styles.casinoHeaderEmoji}>{isAdmin ? '♠️' : '🔒'}</Text>
            </View>
          </View>

          {/* Tags */}
          <View style={styles.casinoTags}>
            {isAdmin ? (
              <>
                <View style={styles.casinoTag}>
                  <Text style={styles.casinoTagText}>Bet 10-10,000 BL</Text>
                </View>
                <View style={styles.casinoTag}>
                  <Text style={styles.casinoTagText}>Provably Fair</Text>
                </View>
              </>
            ) : (
              <View style={[styles.casinoTag, { opacity: 0.7 }]}>
                <Text style={styles.casinoTagText}>Stay Tuned!</Text>
              </View>
            )}
          </View>

          {/* Mini-Games Grid - NESTED INSIDE */}
          <View style={[styles.miniGamesContainer, { backgroundColor: isAdmin ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.2)' }]}>
            {CASINO_MINI_GAMES.map((game) => (
              <TouchableOpacity
                key={game.id}
                style={[
                  styles.miniGameItem,
                  { backgroundColor: isAdmin ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)' }
                ]}
                onPress={() => handleCasinoGamePress(game.id)}
                disabled={!isAdmin}
                activeOpacity={isAdmin ? 0.7 : 1}
              >
                {/* Game Icon */}
                <View style={[
                  styles.miniGameIcon,
                  { backgroundColor: isAdmin ? game.color : '#6B7280' }
                ]}>
                  <Text style={styles.miniGameEmoji}>{game.emoji}</Text>
                  {!isAdmin && (
                    <View style={styles.miniLockBadge}>
                      <Text style={styles.miniLockText}>🔒</Text>
                    </View>
                  )}
                </View>

                {/* Game Info */}
                <View style={styles.miniGameInfo}>
                  <Text style={[styles.miniGameName, { color: isAdmin ? '#fff' : '#9CA3AF' }]}>
                    {game.name}
                  </Text>
                  <Text style={[styles.miniGameDesc, { color: isAdmin ? 'rgba(255,255,255,0.7)' : '#6B7280' }]}>
                    {game.description}
                  </Text>
                </View>

                {/* Action */}
                {isAdmin ? (
                  <View style={[styles.playButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                    <Text style={styles.playButtonText}>Play</Text>
                  </View>
                ) : (
                  <View style={[styles.lockedBadge, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
                    <Text style={styles.lockedBadgeText}>Locked</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* View All Button (Admin Only) */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => navigation.navigate('Casino')}
            >
              <Text style={styles.viewAllText}>View All Casino Games →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Raffles Section */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contests</Text>
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
    shadowColor: '#8B5CF6',
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
    width: 60,
  },
  photoBattleEmoji: {
    fontSize: 40,
  },
  photoBattleArrow: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  arrowText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Quick Links
  quickLinksRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  quickLinkCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
  },
  quickLinkEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickLinkTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  quickLinkDesc: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 2,
  },

  // CONSOLIDATED Casino Section
  casinoSection: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  casinoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
  },
  casinoHeaderLeft: {
    flex: 1,
  },
  casinoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  casinoLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  comingSoonBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  comingSoonBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  casinoTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  casinoSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  casinoHeaderIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  casinoHeaderEmoji: {
    fontSize: 24,
  },
  casinoTags: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  casinoTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  casinoTagText: {
    color: '#fff',
    fontSize: 11,
  },

  // Mini-Games Container (NESTED)
  miniGamesContainer: {
    padding: 12,
    gap: 10,
  },
  miniGameItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  miniGameIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  miniGameEmoji: {
    fontSize: 22,
  },
  miniLockBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#374151',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  miniLockText: {
    fontSize: 9,
  },
  miniGameInfo: {
    flex: 1,
  },
  miniGameName: {
    fontSize: 15,
    fontWeight: '600',
  },
  miniGameDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  playButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  playButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  lockedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  lockedBadgeText: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  viewAllButton: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  viewAllText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },

  // Raffles Card
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
    marginTop: 2,
  },

  // Sync Notice
  syncNotice: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
  bottomPadding: {
    height: 40,
  },
});
