/**
 * Games Screen - Main Games Hub
 * Casino Games teaser redirects to dedicated Casino screen
 * BL Coins balance REMOVED from this screen
 * 100% synchronized with web version
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
import { photoGameAPI } from '../services/api';

const { width } = Dimensions.get('window');

export default function GamesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, toggleTheme, isDark } = useTheme();
  const [gameStats, setGameStats] = useState(null);

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

  // Handle Casino card press - navigates to Casino screen
  const handleCasinoPress = () => {
    navigation.navigate('Casino');
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

        {/* Casino Games Teaser Card - PURE REDIRECT, NO NESTED GAMES */}
        <TouchableOpacity
          style={styles.casinoTeaser}
          onPress={handleCasinoPress}
          activeOpacity={0.9}
        >
          <View style={styles.casinoTeaserHeader}>
            <View style={styles.casinoTeaserLeft}>
              <View style={styles.casinoTitleRow}>
                <Text style={styles.casinoLabel}>🎰 CASINO</Text>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonBadgeText}>Coming Soon</Text>
                </View>
              </View>
              <Text style={styles.casinoTitle}>Casino Games</Text>
              <Text style={styles.casinoSubtitle}>Exciting games launching soon!</Text>
            </View>
            <View style={styles.casinoTeaserIcon}>
              <Text style={styles.casinoTeaserEmoji}>🔒</Text>
            </View>
          </View>

          {/* Game Icons Preview */}
          <View style={styles.gameIconsPreview}>
            <View style={styles.gameIconsRow}>
              <View style={[styles.gameIconCircle, { backgroundColor: '#9333EA' }]}>
                <Text style={styles.gameIconEmoji}>🎰</Text>
              </View>
              <View style={[styles.gameIconCircle, { backgroundColor: '#16A34A', marginLeft: -8 }]}>
                <Text style={styles.gameIconEmoji}>🃏</Text>
              </View>
              <View style={[styles.gameIconCircle, { backgroundColor: '#D97706', marginLeft: -8 }]}>
                <Text style={styles.gameIconEmoji}>🎡</Text>
              </View>
              <View style={[styles.gameIconCircle, { backgroundColor: '#2563EB', marginLeft: -8 }]}>
                <Text style={styles.gameIconEmoji}>🎲</Text>
              </View>
              <View style={[styles.gameIconCircle, { backgroundColor: '#E11D48', marginLeft: -8 }]}>
                <Text style={styles.gameIconEmoji}>🎴</Text>
              </View>
            </View>
            <Text style={styles.gameIconsCount}>+7 more games</Text>
          </View>

          <View style={styles.stayTunedTag}>
            <Text style={styles.stayTunedText}>Stay Tuned!</Text>
          </View>

          {/* View Casino Link */}
          <View style={styles.viewCasinoLink}>
            <Text style={styles.viewCasinoText}>View Casino Games →</Text>
          </View>
        </TouchableOpacity>

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

  // Casino Teaser Card - PURE REDIRECT
  casinoTeaser: {
    backgroundColor: '#374151',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  casinoTeaserHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
  },
  casinoTeaserLeft: {
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
  casinoTeaserIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  casinoTeaserEmoji: {
    fontSize: 24,
  },
  gameIconsPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  gameIconsRow: {
    flexDirection: 'row',
    marginRight: 12,
  },
  gameIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#374151',
  },
  gameIconEmoji: {
    fontSize: 16,
  },
  gameIconsCount: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  stayTunedTag: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginLeft: 20,
    marginBottom: 16,
  },
  stayTunedText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  viewCasinoLink: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  viewCasinoText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
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
