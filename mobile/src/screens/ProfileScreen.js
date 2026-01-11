/**
 * Profile Screen for Blendlink Mobile
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { walletAPI, referralAPI, socialAPI } from '../services/api';

const Icons = {
  coin: '🪙',
  edit: '✏️',
  logout: '🚪',
  settings: '⚙️',
  earnings: '💰',
  friends: '👥',
  photos: '🖼️',
  share: '↗️',
  copy: '📋',
};

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [balance, setBalance] = useState(0);
  const [referralStats, setReferralStats] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [walletData, networkData, postsData] = await Promise.all([
        walletAPI.getBalance(),
        referralAPI.getMyNetwork().catch(() => null),
        socialAPI.getUserPosts(user?.user_id, 0, 6).catch(() => []),
      ]);
      setBalance(walletData.balance);
      setReferralStats(networkData);
      setPosts(postsData);
    } catch (error) {
      console.error('Failed to load profile data:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  const copyReferralCode = () => {
    // In production, use Clipboard.setStringAsync from expo-clipboard
    Alert.alert('Copied!', `Referral code: ${user?.referral_code || 'N/A'}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => { setIsRefreshing(true); loadData(); }} tintColor="#2563EB" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{user?.name?.[0] || '?'}</Text>
            )}
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userHandle}>@{user?.username}</Text>

          {/* BL Coins Balance */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>BL Coins Balance</Text>
            <Text style={styles.balanceValue}>{Icons.coin} {balance.toLocaleString()}</Text>
          </View>

          {/* Referral Code */}
          <TouchableOpacity style={styles.referralCard} onPress={copyReferralCode}>
            <View>
              <Text style={styles.referralLabel}>Your Referral Code</Text>
              <Text style={styles.referralCode}>{user?.referral_code || 'N/A'}</Text>
            </View>
            <Text style={styles.copyIcon}>{Icons.copy}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{referralStats?.level_1_count || 0}</Text>
            <Text style={styles.statLabel}>L1 Referrals</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{referralStats?.level_2_count || 0}</Text>
            <Text style={styles.statLabel}>L2 Referrals</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{posts.length}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsGrid}>
          {/* Admin Panel Button - Only visible to admins */}
          {(user?.is_admin || user?.admin_role) && (
            <TouchableOpacity 
              style={[styles.actionCard, styles.adminActionCard]} 
              onPress={() => navigation.navigate('Admin')}
            >
              <Text style={styles.actionIcon}>🛡️</Text>
              <Text style={[styles.actionLabel, styles.adminLabel]}>Admin Panel</Text>
              <Text style={styles.adminRole}>
                {user?.admin_role?.replace('_', ' ') || 'Admin'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Earnings')}>
            <Text style={styles.actionIcon}>{Icons.earnings}</Text>
            <Text style={styles.actionLabel}>Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Friends')}>
            <Text style={styles.actionIcon}>{Icons.friends}</Text>
            <Text style={styles.actionLabel}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => Alert.alert('Coming Soon')}>
            <Text style={styles.actionIcon}>{Icons.photos}</Text>
            <Text style={styles.actionLabel}>Albums</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.actionIcon}>{Icons.settings}</Text>
            <Text style={styles.actionLabel}>Settings</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Posts */}
        {posts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Posts</Text>
            <View style={styles.postsGrid}>
              {posts.slice(0, 6).map((post, i) => (
                <View key={post.post_id} style={styles.postThumb}>
                  {post.media_urls?.length > 0 ? (
                    <Image source={{ uri: post.media_urls[0] }} style={styles.postThumbImage} />
                  ) : (
                    <View style={styles.postThumbText}>
                      <Text style={styles.postThumbContent} numberOfLines={3}>{post.content}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>{Icons.logout}</Text>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1E293B',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 100,
    height: 100,
  },
  avatarText: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  userName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userHandle: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 4,
  },
  balanceCard: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  balanceValue: {
    color: '#F59E0B',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  referralCard: {
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  referralLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  referralCode: {
    color: '#2563EB',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 2,
  },
  copyIcon: {
    fontSize: 20,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    marginTop: 8,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    marginTop: 8,
  },
  actionCard: {
    width: '50%',
    padding: 8,
  },
  actionCardInner: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    textAlign: 'center',
    overflow: 'hidden',
  },
  actionLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: -12,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  postThumb: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 4,
  },
  postThumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  postThumbText: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#334155',
    padding: 8,
    justifyContent: 'center',
  },
  postThumbContent: {
    color: '#9CA3AF',
    fontSize: 10,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 12,
    padding: 16,
  },
  logoutIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
