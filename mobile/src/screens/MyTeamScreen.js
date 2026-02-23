import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Clipboard,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || '';

const MyTeamScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [genealogy, setGenealogy] = useState([]);
  const [diamondStatus, setDiamondStatus] = useState(null);
  const [withdrawalStatus, setWithdrawalStatus] = useState(null);
  const [nextClaimAt, setNextClaimAt] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [claimLoading, setClaimLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const headers = { Authorization: `Bearer ${token}` };

      const [userRes, genealogyRes, diamondRes, withdrawalRes] = await Promise.all([
        fetch(`${API_BASE}/api/auth/me`, { headers }),
        fetch(`${API_BASE}/api/referral/genealogy`, { headers }),
        fetch(`${API_BASE}/api/diamond/status`, { headers }),
        fetch(`${API_BASE}/api/withdrawal/status`, { headers }),
      ]);

      const userData = await userRes.json();
      const genealogyData = await genealogyRes.json().catch(() => []);
      const diamondData = await diamondRes.json().catch(() => null);
      const withdrawalData = await withdrawalRes.json().catch(() => null);

      setUser(userData);
      setGenealogy(Array.isArray(genealogyData) ? genealogyData : []);
      setDiamondStatus(diamondData);
      setWithdrawalStatus(withdrawalData);

      if (userData?.daily_claim_last) {
        const lastClaim = new Date(userData.daily_claim_last);
        const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
        if (nextClaim > new Date()) {
          setNextClaimAt(nextClaim.toISOString());
        } else {
          setNextClaimAt(null);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Countdown timer
  useEffect(() => {
    if (!nextClaimAt) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const next = new Date(nextClaimAt);
      const diff = next - now;

      if (diff <= 0) {
        setCountdown(null);
        setNextClaimAt(null);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextClaimAt]);

  const handleCopyCode = () => {
    if (user?.referral_code) {
      Clipboard.setString(user.referral_code);
      Alert.alert('Copied!', 'Referral code copied to clipboard');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join Blendlink using my referral code: ${user?.referral_code} and we both get 50,000 BL Coins! Download now: https://blendlink.app`,
      });
    } catch (error) {
      handleCopyCode();
    }
  };

  const [claimStatus, setClaimStatus] = useState(null);

  // Fetch daily claim status from server (single source of truth for claim amount)
  const fetchClaimStatus = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/referral/daily-claim/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setClaimStatus(data);
        if (!data.can_claim && data.next_claim_at) {
          setNextClaimAt(data.next_claim_at);
        } else {
          setNextClaimAt(null);
        }
      }
    } catch (error) {
      console.error('Error fetching claim status:', error);
    }
  }, []);

  useEffect(() => {
    fetchClaimStatus();
  }, [fetchClaimStatus]);

  const handleDailyClaim = async () => {
    setClaimLoading(true);
    try {
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${API_BASE}/api/referral/daily-claim`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (response.ok) {
        Alert.alert('Success!', `Claimed ${result.amount.toLocaleString()} BL Coins!`);
        setNextClaimAt(result.next_claim_at);
        fetchData();
      } else {
        Alert.alert('Error', result.detail || 'Failed to claim');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to claim');
    } finally {
      setClaimLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const level1 = genealogy.filter((m) => m.level === 1);
  const level2 = genealogy.filter((m) => m.level === 2);
  const canClaim = !nextClaimAt;
  const isDiamond = diamondStatus?.is_diamond;
  const claimAmount = isDiamond ? 5000 : 2000;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Team</Text>
          <TouchableOpacity onPress={fetchData}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Referral Code Card - Hidden */}
        {false && (
        <View style={styles.referralCard}>
          <Text style={styles.referralLabel}>Your Referral Code</Text>
          <View style={styles.referralCodeRow}>
            <View style={styles.referralCodeBox}>
              <Text style={styles.referralCode}>{user?.referral_code || '...'}</Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode}>
              <Ionicons name="copy" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
            <Ionicons name="share-social" size={18} color="#3b82f6" />
            <Text style={styles.shareBtnText}>Share & Earn 50K BL</Text>
          </TouchableOpacity>
          <Text style={styles.shareNote}>Both you and your friend receive 50,000 BL coins!</Text>
        </View>
        )}

        {/* Stats Row - Hidden: commission rates don't match current tier structure */}
        {false && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="people" size={20} color="#3b82f6" />
            <Text style={styles.statValue}>{level1.length}</Text>
            <Text style={styles.statLabel}>Direct (L1)</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={20} color="#10b981" />
            <Text style={styles.statValue}>{level2.length}</Text>
            <Text style={styles.statLabel}>Indirect (L2)</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="logo-bitcoin" size={20} color="#eab308" />
            <Text style={styles.statValue}>{(user?.bl_coins || 0).toLocaleString()}</Text>
            <Text style={styles.statLabel}>BL Coins</Text>
          </View>
        </View>
        )}

        {/* Daily Claim */}
        <View style={[styles.claimCard, isDiamond && styles.claimCardDiamond]}>
          <View style={styles.claimHeader}>
            <View style={styles.claimTitleRow}>
              <Ionicons name="gift" size={20} color={isDiamond ? '#eab308' : '#3b82f6'} />
              <Text style={styles.claimTitle}>Daily BL Claim</Text>
              {isDiamond && (
                <View style={styles.diamondBadge}>
                  <Ionicons name="diamond" size={12} color="#000" />
                  <Text style={styles.diamondBadgeText}>Diamond</Text>
                </View>
              )}
            </View>
            <Text style={styles.claimAmount}>{claimAmount.toLocaleString()}</Text>
          </View>

          {canClaim ? (
            <TouchableOpacity
              style={[styles.claimBtn, isDiamond && styles.claimBtnDiamond]}
              onPress={handleDailyClaim}
              disabled={claimLoading}
            >
              {claimLoading ? (
                <ActivityIndicator color={isDiamond ? '#000' : '#fff'} />
              ) : (
                <>
                  <Ionicons name="gift" size={18} color={isDiamond ? '#000' : '#fff'} />
                  <Text style={[styles.claimBtnText, isDiamond && styles.claimBtnTextDiamond]}>
                    Claim {claimAmount.toLocaleString()} BL
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.countdownContainer}>
              <View style={styles.countdownLabel}>
                <Ionicons name="time" size={16} color="#6b7280" />
                <Text style={styles.countdownLabelText}>Next claim in</Text>
              </View>
              <Text style={styles.countdownTimer}>{countdown}</Text>
            </View>
          )}
        </View>

        {/* Diamond Status - Hidden */}
        {false && (
        <View style={[styles.diamondCard, isDiamond && styles.diamondCardActive]}>
          <View style={styles.diamondHeader}>
            <Ionicons name="diamond" size={20} color={isDiamond ? '#eab308' : '#6b7280'} />
            <Text style={styles.diamondTitle}>Diamond Leader</Text>
            <View style={[styles.statusBadge, isDiamond ? styles.statusBadgeActive : styles.statusBadgeInactive]}>
              <Text style={styles.statusBadgeText}>{isDiamond ? 'Active' : 'Not Qualified'}</Text>
            </View>
          </View>

          {isDiamond ? (
            <Text style={styles.diamondInfo}>
              Maintenance check in {diamondStatus?.days_until_check || 0} days
            </Text>
          ) : (
            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>
                Direct Recruits: {diamondStatus?.qualification_progress?.direct_recruits || 0}/100
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        ((diamondStatus?.qualification_progress?.direct_recruits || 0) / 100) * 100,
                        100
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>
        )}

        {/* Withdrawal Section */}
        {withdrawalStatus && (
          <View style={styles.withdrawalCard}>
            <View style={styles.withdrawalHeader}>
              <Ionicons name="wallet" size={20} color="#10b981" />
              <Text style={styles.withdrawalTitle}>Withdraw Earnings</Text>
            </View>
            <View style={styles.withdrawalBalance}>
              <Text style={styles.balanceLabel}>USD Balance</Text>
              <Text style={styles.balanceValue}>${(withdrawalStatus.usd_balance || 0).toFixed(2)}</Text>
            </View>
            <TouchableOpacity
              style={styles.withdrawBtn}
              onPress={() => navigation.navigate('Withdraw')}
              disabled={withdrawalStatus.usd_balance <= 0}
            >
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
              <Text style={styles.withdrawBtnText}>
                {withdrawalStatus.kyc_required ? 'Verify Identity' : 'Withdraw'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Team Tree */}
        <View style={styles.treeCard}>
          <Text style={styles.treeTitle}>My Team Tree</Text>

          {genealogy.length === 0 ? (
            <View style={styles.emptyTree}>
              <Ionicons name="people-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyTreeText}>No team members yet</Text>
              <Text style={styles.emptyTreeSubtext}>Share your referral code to start!</Text>
            </View>
          ) : (
            <>
              {level1.length > 0 && (
                <View style={styles.levelSection}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>Level 1 ({level1.length})</Text>
                  </View>
                  {level1.map((member) => (
                    <View key={member.user_id} style={styles.memberCard}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {member.username?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.username}</Text>
                        <Text style={styles.memberStats}>
                          {member.direct_recruits_count} direct • {member.total_recruits_count} total
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {level2.length > 0 && (
                <View style={styles.levelSection}>
                  <View style={[styles.levelBadge, styles.levelBadgeL2]}>
                    <Text style={styles.levelBadgeText}>Level 2 ({level2.length})</Text>
                  </View>
                  {level2.map((member) => (
                    <View key={member.user_id} style={[styles.memberCard, styles.memberCardL2]}>
                      <View style={[styles.memberAvatar, styles.memberAvatarL2]}>
                        <Text style={styles.memberAvatarText}>
                          {member.username?.[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{member.username}</Text>
                        <Text style={styles.memberStats}>
                          {member.direct_recruits_count} direct • {member.total_recruits_count} total
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Commission Info */}
        <View style={styles.commissionInfo}>
          <Text style={styles.commissionTitle}>Commission Rates</Text>
          <View style={styles.commissionGrid}>
            <View style={styles.commissionCol}>
              <Text style={styles.commissionColTitle}>Regular</Text>
              <Text style={styles.commissionRate}>L1: 3%</Text>
              <Text style={styles.commissionRate}>L2: 1%</Text>
            </View>
            <View style={styles.commissionCol}>
              <Text style={[styles.commissionColTitle, styles.diamondText]}>💎 Diamond</Text>
              <Text style={[styles.commissionRate, styles.diamondText]}>L1: 4%</Text>
              <Text style={[styles.commissionRate, styles.diamondText]}>L2: 2%</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContent: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  referralCard: { backgroundColor: '#3b82f6', borderRadius: 16, padding: 20, marginBottom: 16 },
  referralLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginBottom: 8 },
  referralCodeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  referralCodeBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 12, alignItems: 'center' },
  referralCode: { color: '#fff', fontSize: 24, fontWeight: 'bold', letterSpacing: 4 },
  copyBtn: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 12, justifyContent: 'center' },
  shareBtn: { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareBtnText: { color: '#3b82f6', fontWeight: '600' },
  shareNote: { color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center', marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statItem: { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginTop: 4 },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  claimCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  claimCardDiamond: { borderColor: 'rgba(234,179,8,0.3)', backgroundColor: 'rgba(234,179,8,0.1)' },
  claimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  claimTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  claimTitle: { color: '#fff', fontWeight: '600' },
  diamondBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eab308', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, gap: 4 },
  diamondBadgeText: { color: '#000', fontSize: 10, fontWeight: '600' },
  claimAmount: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  claimBtn: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  claimBtnDiamond: { backgroundColor: '#eab308' },
  claimBtnText: { color: '#fff', fontWeight: '600' },
  claimBtnTextDiamond: { color: '#000' },
  countdownContainer: { alignItems: 'center' },
  countdownLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  countdownLabelText: { color: '#6b7280' },
  countdownTimer: { fontSize: 36, fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' },
  diamondCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  diamondCardActive: { borderColor: 'rgba(234,179,8,0.3)' },
  diamondHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  diamondTitle: { color: '#fff', fontWeight: '600', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeActive: { backgroundColor: '#eab308' },
  statusBadgeInactive: { backgroundColor: '#374151' },
  statusBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  diamondInfo: { color: '#9ca3af', fontSize: 14 },
  progressContainer: { marginTop: 8 },
  progressLabel: { color: '#9ca3af', fontSize: 12, marginBottom: 4 },
  progressBar: { height: 8, backgroundColor: '#374151', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#3b82f6', borderRadius: 4 },
  withdrawalCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  withdrawalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  withdrawalTitle: { color: '#fff', fontWeight: '600' },
  withdrawalBalance: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  balanceLabel: { color: '#6b7280' },
  balanceValue: { fontSize: 24, fontWeight: 'bold', color: '#10b981' },
  withdrawBtn: { backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  withdrawBtnText: { color: '#fff', fontWeight: '600' },
  treeCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#334155' },
  treeTitle: { color: '#fff', fontWeight: '600', fontSize: 16, marginBottom: 16 },
  emptyTree: { alignItems: 'center', paddingVertical: 32 },
  emptyTreeText: { color: '#6b7280', fontSize: 16, marginTop: 8 },
  emptyTreeSubtext: { color: '#6b7280', fontSize: 12, marginTop: 4 },
  levelSection: { marginBottom: 16 },
  levelBadge: { backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 12 },
  levelBadgeL2: { backgroundColor: '#10b981' },
  levelBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  memberCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  memberCardL2: { marginLeft: 24, backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)' },
  memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  memberAvatarL2: { backgroundColor: '#10b981' },
  memberAvatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  memberInfo: { marginLeft: 12, flex: 1 },
  memberName: { color: '#fff', fontWeight: '600' },
  memberStats: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  commissionInfo: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, marginBottom: 16 },
  commissionTitle: { color: '#fff', fontWeight: '600', marginBottom: 12 },
  commissionGrid: { flexDirection: 'row', gap: 16 },
  commissionCol: { flex: 1 },
  commissionColTitle: { color: '#6b7280', fontSize: 12, marginBottom: 4 },
  commissionRate: { color: '#fff', fontSize: 14 },
  diamondText: { color: '#eab308' },
});

export default MyTeamScreen;
