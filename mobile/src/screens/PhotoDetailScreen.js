/**
 * PhotoDetailScreen - Mobile
 * 
 * Full photo details with Dollar Value breakdown and upgrades
 * 
 * Features:
 * - Photo display with scenery badge
 * - 11-category AI scoring breakdown
 * - Current dollar value with all bonuses
 * - Available upgrades (purchase with BL coins)
 * - Level/XP progress bar
 * - Stamina display
 * - Birthday bonus claim (if eligible)
 * - Battle stats for this photo
 * - Haptic feedback on interactions
 * - Selfie match for Authenticity bonus
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { mintingAPI } from '../services/api';
import SelfieMatchModal from '../components/SelfieMatchModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Selfie match constants
const SELFIE_MATCH_COST = 100;
const MAX_SELFIE_ATTEMPTS = 3;

// Scenery config
const SCENERY_CONFIG = {
  natural: { gradient: ['#22C55E', '#10B981'], emoji: '🌿', label: 'Natural', strong: 'Water', weak: 'Man-made' },
  water: { gradient: ['#3B82F6', '#06B6D4'], emoji: '🌊', label: 'Water', strong: 'Man-made', weak: 'Natural' },
  manmade: { gradient: ['#F97316', '#EF4444'], emoji: '🏙️', label: 'Man-made', strong: 'Natural', weak: 'Water' },
  neutral: { gradient: ['#6B7280', '#4B5563'], emoji: '⬜', label: 'Neutral', strong: 'None', weak: 'All' },
};

// Category icons
const CATEGORY_ICONS = {
  composition: '📐',
  lighting: '💡',
  color: '🎨',
  subject: '👤',
  technical: '📷',
  emotional: '❤️',
  uniqueness: '✨',
  storytelling: '📖',
  context: '🌍',
  timing: '⏰',
  authenticity: '🔐',
};

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
};

// Format large numbers
const formatNumber = (num) => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num?.toLocaleString() || '0';
};

export default function PhotoDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const { user } = useAuth();
  
  const mintId = route.params?.mintId;
  
  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [valueBreakdown, setValueBreakdown] = useState(null);
  const [upgradeOptions, setUpgradeOptions] = useState(null);
  const [purchasing, setPurchasing] = useState(null);
  const [claimingBirthday, setClaimingBirthday] = useState(false);
  const [selfieModalVisible, setSelfieModalVisible] = useState(false);
  
  // Fetch photo data
  const fetchPhotoData = useCallback(async () => {
    if (!mintId) return;
    
    try {
      // Fetch full value breakdown
      const fullValue = await mintingAPI.getPhotoWithValue(mintId);
      setPhoto(fullValue.photo);
      setValueBreakdown(fullValue);
      
      // Fetch upgrade options
      const upgrades = await mintingAPI.getUpgradeOptions(mintId);
      setUpgradeOptions(upgrades);
    } catch (err) {
      console.error('Failed to load photo:', err);
      Alert.alert('Error', 'Failed to load photo details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mintId]);

  useEffect(() => {
    fetchPhotoData();
  }, [fetchPhotoData]);

  // Handle upgrade purchase
  const handlePurchaseUpgrade = async (upgradeAmount, blCost) => {
    Alert.alert(
      'Confirm Purchase',
      `Spend ${formatNumber(blCost)} BL to add ${formatDollarValue(upgradeAmount)} to this photo's value?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Purchase',
          onPress: async () => {
            try {
              setPurchasing(upgradeAmount);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              
              await mintingAPI.purchaseUpgrade(mintId, upgradeAmount);
              
              // Refresh data
              await fetchPhotoData();
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success!', `Added ${formatDollarValue(upgradeAmount)} to your photo's value!`);
            } catch (err) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', err.message || 'Failed to purchase upgrade');
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  };

  // Handle birthday bonus claim
  const handleClaimBirthday = async () => {
    try {
      setClaimingBirthday(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      const result = await mintingAPI.claimBirthdayBonus(mintId);
      
      // Refresh data
      await fetchPhotoData();
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        '🎂 Birthday Bonus!',
        `You received ${formatDollarValue(result.bonus_amount)} + ${formatNumber(result.bl_bonus)} BL coins!`
      );
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', err.message || 'Failed to claim birthday bonus');
    } finally {
      setClaimingBirthday(false);
    }
  };

  // Handle selfie match success
  const handleSelfieMatchSuccess = useCallback(async (result) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Refresh photo data to show updated authenticity
    await fetchPhotoData();
  }, [fetchPhotoData]);

  // Check if can do selfie match
  const canDoSelfieMatch = photo?.has_face && 
    (photo?.selfie_match_attempts || 0) < MAX_SELFIE_ATTEMPTS &&
    !photo?.authenticity_locked;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading photo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!photo) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>Photo not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.backLink, { color: colors.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  const staminaPercent = ((photo?.current_stamina || 24) / (photo?.max_stamina || 24)) * 100;
  const xpPercent = valueBreakdown?.xp_to_next_level 
    ? ((photo?.xp || 0) / valueBreakdown.xp_to_next_level) * 100 
    : 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {photo?.name || 'Photo Details'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchPhotoData();
            }}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Photo Hero */}
        <View style={[styles.heroSection, { backgroundColor: scenery.gradient[0] }]}>
          <Text style={styles.heroEmoji}>{scenery.emoji}</Text>
          
          {/* Scenery Badge */}
          <View style={styles.sceneryInfo}>
            <Text style={styles.sceneryLabel}>{scenery.label}</Text>
            <Text style={styles.sceneryAdvantage}>
              💪 Strong vs {scenery.strong} • 😓 Weak vs {scenery.weak}
            </Text>
          </View>

          {/* Dollar Value Display */}
          <View style={styles.heroValueContainer}>
            <Text style={styles.heroValueLabel}>Dollar Value</Text>
            <Text style={styles.heroValue}>{formatDollarValue(valueBreakdown?.current_total || photo?.dollar_value)}</Text>
          </View>

          {/* Minted By */}
          {photo?.minted_by_username && (
            <View style={styles.mintedByBadge}>
              <Text style={styles.mintedByText}>
                Minted by @{photo.minted_by_username}
              </Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>Lv.{photo?.level || 1}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Level</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.gold }]}>⚡{Math.round(photo?.current_stamina || 24)}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Stamina</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#F97316' }]}>
              {(photo?.win_streak || 0) >= 3 ? `🔥${photo.win_streak}` : photo?.win_streak || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.success }]}>{photo?.battles_won || 0}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Wins</Text>
          </View>
        </View>

        {/* Birthday Bonus */}
        {valueBreakdown?.can_claim_birthday && (
          <TouchableOpacity
            style={[styles.birthdayCard, { backgroundColor: colors.gold }]}
            onPress={handleClaimBirthday}
            disabled={claimingBirthday}
          >
            {claimingBirthday ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.birthdayEmoji}>🎂</Text>
                <View style={styles.birthdayInfo}>
                  <Text style={styles.birthdayTitle}>Birthday Bonus Available!</Text>
                  <Text style={styles.birthdayDesc}>
                    Tap to claim +$1M value + 500 BL coins
                  </Text>
                </View>
                <Text style={styles.birthdayArrow}>→</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Days until birthday */}
        {!valueBreakdown?.can_claim_birthday && valueBreakdown?.days_until_birthday > 0 && (
          <View style={[styles.birthdayCountdown, { backgroundColor: colors.cardSecondary }]}>
            <Text style={styles.birthdayCountdownEmoji}>🎂</Text>
            <Text style={[styles.birthdayCountdownText, { color: colors.textMuted }]}>
              {valueBreakdown.days_until_birthday} days until birthday bonus
            </Text>
          </View>
        )}

        {/* Selfie Match / Authenticity Section */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>🔐 Authenticity</Text>
          
          {/* Current authenticity status */}
          <View style={styles.authenticityStatus}>
            <View style={styles.authenticityRow}>
              <Text style={[styles.authenticityLabel, { color: colors.textMuted }]}>Face Detected:</Text>
              <Text style={[styles.authenticityValue, { color: photo?.has_face ? colors.success : colors.error }]}>
                {photo?.has_face ? `Yes (${photo?.face_detection_score || 0}%)` : 'No'}
              </Text>
            </View>
            <View style={styles.authenticityRow}>
              <Text style={[styles.authenticityLabel, { color: colors.textMuted }]}>Selfie Match:</Text>
              <Text style={[styles.authenticityValue, { color: photo?.selfie_match_score ? colors.success : colors.textMuted }]}>
                {photo?.selfie_match_score ? `${photo.selfie_match_score}% Match` : 'Not verified'}
              </Text>
            </View>
            {photo?.authenticity_bonus > 0 && (
              <View style={styles.authenticityRow}>
                <Text style={[styles.authenticityLabel, { color: colors.textMuted }]}>Total Bonus:</Text>
                <Text style={[styles.authenticityValue, { color: colors.gold }]}>
                  +{photo.authenticity_bonus?.toFixed(1)}%
                </Text>
              </View>
            )}
          </View>

          {/* Selfie match button */}
          {photo?.has_face && !photo?.authenticity_locked && (
            <TouchableOpacity
              style={[
                styles.selfieMatchButton,
                {
                  backgroundColor: canDoSelfieMatch ? colors.primary : colors.cardSecondary,
                  opacity: canDoSelfieMatch ? 1 : 0.6,
                }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setSelfieModalVisible(true);
              }}
              disabled={!canDoSelfieMatch}
            >
              <Text style={styles.selfieMatchIcon}>📸</Text>
              <View style={styles.selfieMatchInfo}>
                <Text style={styles.selfieMatchTitle}>
                  {canDoSelfieMatch ? 'Verify with Selfie' : 'Verification Complete'}
                </Text>
                <Text style={styles.selfieMatchSubtitle}>
                  {canDoSelfieMatch 
                    ? `${SELFIE_MATCH_COST} BL • ${MAX_SELFIE_ATTEMPTS - (photo?.selfie_match_attempts || 0)} attempts left`
                    : `+${photo?.authenticity_bonus?.toFixed(1) || 0}% bonus added`
                  }
                </Text>
              </View>
              {canDoSelfieMatch && <Text style={styles.selfieMatchArrow}>→</Text>}
            </TouchableOpacity>
          )}

          {/* No face detected message */}
          {!photo?.has_face && (
            <View style={[styles.noFaceMessage, { backgroundColor: colors.cardSecondary }]}>
              <Text style={[styles.noFaceText, { color: colors.textMuted }]}>
                This photo doesn't have a detectable face. Only photos with faces can be verified for authenticity bonus.
              </Text>
            </View>
          )}
        </View>

        {/* XP Progress */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>⭐ Level Progress</Text>
          <View style={styles.xpContainer}>
            <View style={[styles.xpBarBg, { backgroundColor: colors.cardSecondary }]}>
              <View style={[styles.xpBarFill, { width: `${xpPercent}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={[styles.xpText, { color: colors.textMuted }]}>
              {photo?.xp || 0} / {valueBreakdown?.xp_to_next_level || 100} XP
            </Text>
          </View>
          {valueBreakdown?.next_level_bonus && (
            <Text style={[styles.nextLevelBonus, { color: colors.gold }]}>
              Next level: +{formatDollarValue(valueBreakdown.next_level_bonus)} bonus!
            </Text>
          )}
        </View>

        {/* Stamina Progress */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>⚡ Stamina</Text>
          <View style={styles.staminaContainer}>
            <View style={[styles.staminaBarBg, { backgroundColor: colors.cardSecondary }]}>
              <View 
                style={[
                  styles.staminaBarFill, 
                  { 
                    width: `${staminaPercent}%`, 
                    backgroundColor: staminaPercent > 20 ? colors.gold : colors.error 
                  }
                ]} 
              />
            </View>
            <Text style={[styles.staminaText, { color: colors.textMuted }]}>
              {Math.round(photo?.current_stamina || 24)} / {photo?.max_stamina || 24}
            </Text>
          </View>
          <Text style={[styles.staminaHint, { color: colors.textMuted }]}>
            Regenerates 1 stamina every hour. Each battle costs 1 stamina.
          </Text>
        </View>

        {/* Value Breakdown */}
        {valueBreakdown?.breakdown && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>💵 Value Breakdown</Text>
            
            {Object.entries(valueBreakdown.breakdown).map(([key, value]) => {
              if (value === 0) return null;
              const labels = {
                base_value: { label: 'Base AI Score', icon: '🤖' },
                scenery_bonus: { label: 'Scenery Bonus', icon: scenery.emoji },
                level_bonus: { label: 'Level Bonus', icon: '⭐' },
                streak_bonus: { label: 'Streak Bonus', icon: '🔥' },
                monthly_growth: { label: 'Monthly Growth', icon: '📈' },
                social_bonus: { label: 'Social Reactions', icon: '❤️' },
                upgrade_value: { label: 'Purchased Upgrades', icon: '💎' },
                birthday_bonus: { label: 'Birthday Bonus', icon: '🎂' },
              };
              const info = labels[key] || { label: key, icon: '📊' };
              
              return (
                <View key={key} style={styles.breakdownRow}>
                  <View style={styles.breakdownLeft}>
                    <Text style={styles.breakdownIcon}>{info.icon}</Text>
                    <Text style={[styles.breakdownLabel, { color: colors.text }]}>{info.label}</Text>
                  </View>
                  <Text style={[styles.breakdownValue, { color: colors.gold }]}>
                    +{formatDollarValue(value)}
                  </Text>
                </View>
              );
            })}
            
            <View style={[styles.breakdownTotal, { borderTopColor: colors.border }]}>
              <Text style={[styles.breakdownTotalLabel, { color: colors.text }]}>Total Value</Text>
              <Text style={[styles.breakdownTotalValue, { color: colors.gold }]}>
                {formatDollarValue(valueBreakdown.current_total)}
              </Text>
            </View>
          </View>
        )}

        {/* Upgrade Options */}
        {upgradeOptions && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>💎 Dollar Value Upgrades</Text>
              <Text style={[styles.balanceBadge, { backgroundColor: colors.gold }]}>
                {formatNumber(upgradeOptions.bl_balance)} BL
              </Text>
            </View>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              Permanently increase this photo's value
            </Text>
            
            <View style={styles.upgradeGrid}>
              {upgradeOptions.options?.map((option) => (
                <TouchableOpacity
                  key={option.upgrade_amount}
                  style={[
                    styles.upgradeCard,
                    {
                      backgroundColor: option.already_purchased 
                        ? colors.success + '20' 
                        : colors.cardSecondary,
                      borderColor: option.already_purchased 
                        ? colors.success 
                        : option.can_afford 
                          ? colors.primary 
                          : colors.border,
                      opacity: option.already_purchased ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => {
                    if (!option.already_purchased && option.can_afford) {
                      handlePurchaseUpgrade(option.upgrade_amount, option.bl_cost);
                    }
                  }}
                  disabled={option.already_purchased || !option.can_afford || purchasing === option.upgrade_amount}
                >
                  {purchasing === option.upgrade_amount ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : option.already_purchased ? (
                    <>
                      <Text style={styles.upgradeCheck}>✓</Text>
                      <Text style={[styles.upgradeAmount, { color: colors.success }]}>
                        +{formatDollarValue(option.upgrade_amount)}
                      </Text>
                      <Text style={[styles.upgradePurchased, { color: colors.success }]}>Owned</Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.upgradeAmount, { color: colors.text }]}>
                        +{formatDollarValue(option.upgrade_amount)}
                      </Text>
                      <Text 
                        style={[
                          styles.upgradeCost, 
                          { color: option.can_afford ? colors.gold : colors.error }
                        ]}
                      >
                        {formatNumber(option.bl_cost)} BL
                      </Text>
                      {!option.can_afford && (
                        <Text style={[styles.upgradeInsufficient, { color: colors.error }]}>
                          Insufficient
                        </Text>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Selfie Match Modal */}
      <SelfieMatchModal
        visible={selfieModalVisible}
        onClose={() => setSelfieModalVisible(false)}
        photo={photo}
        onSuccess={handleSelfieMatchSuccess}
        userBalance={user?.bl_coins || 0}
      />
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 16,
  },
  backLink: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  // Hero section
  heroSection: {
    padding: 24,
    alignItems: 'center',
  },
  heroEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  sceneryInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  sceneryLabel: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sceneryAdvantage: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  heroValueContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  heroValueLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginBottom: 4,
  },
  heroValue: {
    color: '#FFD700',
    fontSize: 32,
    fontWeight: 'bold',
  },
  mintedByBadge: {
    marginTop: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  mintedByText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
  },
  // Stats row
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 8,
  },
  // Birthday
  birthdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
  },
  birthdayEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  birthdayInfo: {
    flex: 1,
  },
  birthdayTitle: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  birthdayDesc: {
    color: 'rgba(0,0,0,0.7)',
    fontSize: 12,
  },
  birthdayArrow: {
    color: '#000',
    fontSize: 24,
    fontWeight: 'bold',
  },
  birthdayCountdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  birthdayCountdownEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  birthdayCountdownText: {
    fontSize: 13,
  },
  // Sections
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: 12,
    marginTop: -8,
  },
  balanceBadge: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  // XP
  xpContainer: {},
  xpBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  xpText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  nextLevelBonus: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  // Stamina
  staminaContainer: {},
  staminaBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  staminaBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  staminaText: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  staminaHint: {
    fontSize: 11,
    marginTop: 8,
  },
  // Breakdown
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  breakdownLabel: {
    fontSize: 14,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  breakdownTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },
  breakdownTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  breakdownTotalValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Upgrades
  upgradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  upgradeCard: {
    width: (SCREEN_WIDTH - 64 - 20) / 3,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  upgradeCheck: {
    fontSize: 20,
    color: '#22C55E',
    marginBottom: 4,
  },
  upgradeAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  upgradeCost: {
    fontSize: 12,
    fontWeight: '600',
  },
  upgradePurchased: {
    fontSize: 10,
    fontWeight: '600',
  },
  upgradeInsufficient: {
    fontSize: 9,
    marginTop: 2,
  },
});
