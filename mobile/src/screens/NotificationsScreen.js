/**
 * Notifications Screen for Blendlink Mobile
 * Facebook-style notifications with real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notificationsAPI } from '../services/api';

// Notification type configs (Facebook-style)
const NOTIFICATION_CONFIG = {
  reaction: { emoji: '👍', color: '#F59E0B' },
  comment: { emoji: '💬', color: '#3B82F6' },
  friend_request: { emoji: '👤', color: '#8B5CF6' },
  friend_accepted: { emoji: '✅', color: '#10B981' },
  post_share: { emoji: '↗️', color: '#60A5FA' },
  page_subscribe: { emoji: '📄', color: '#6366F1' },
  group_join: { emoji: '👥', color: '#14B8A6' },
  event_rsvp: { emoji: '📅', color: '#EF4444' },
  bl_coins_earned: { emoji: '🪙', color: '#F59E0B' },
  diamond_status: { emoji: '💎', color: '#06B6D4' },
  system: { emoji: '🔔', color: '#6B7280' },
};

// Time ago helper
const getTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

// Single Notification Item
const NotificationItem = ({ notification, onPress, onMarkRead }) => {
  const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.system;
  const isUnread = !notification.is_read;

  const handlePress = () => {
    if (isUnread) {
      onMarkRead([notification.notification_id]);
    }
    onPress(notification);
  };

  return (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        isUnread && styles.notificationUnread,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: `${config.color}20` }]}>
        <Text style={styles.iconEmoji}>{config.emoji}</Text>
      </View>

      {/* Content */}
      <View style={styles.notificationContent}>
        <Text style={[styles.notificationTitle, isUnread && styles.textBold]}>
          {notification.title}
        </Text>
        <Text style={styles.notificationBody} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.notificationTime}>{getTimeAgo(notification.created_at)}</Text>
      </View>

      {/* Unread indicator */}
      {isUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
};

// Section Header (Today, Yesterday, etc.)
const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
);

// Main Notifications Screen
export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, unread

  const loadNotifications = useCallback(async () => {
    try {
      const unreadOnly = filter === 'unread';
      const data = await notificationsAPI.getNotifications(0, 50, unreadOnly);
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    }
  }, [filter]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadNotifications();
      setIsLoading(false);
    };
    init();
  }, [loadNotifications]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setIsRefreshing(false);
  };

  const handleMarkRead = async (notificationIds) => {
    try {
      await notificationsAPI.markAsRead(notificationIds);
      setNotifications(prev =>
        prev.map(n =>
          notificationIds.includes(n.notification_id)
            ? { ...n, is_read: true }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  const handleNotificationPress = (notification) => {
    const data = notification.data || {};
    if (data.post_id) {
      // Navigate to post (would need to implement this)
      navigation.navigate('SocialFeed');
    } else if (data.user_id || data.from_user_id) {
      navigation.navigate('Profile', { userId: data.user_id || data.from_user_id });
    }
  };

  // Group notifications by date
  const groupNotificationsByDate = (notifications) => {
    const groups = [];
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    let currentGroup = null;

    notifications.forEach(notification => {
      const date = new Date(notification.created_at).toDateString();
      let label;

      if (date === today) {
        label = 'Today';
      } else if (date === yesterday) {
        label = 'Yesterday';
      } else {
        label = new Date(notification.created_at).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        });
      }

      if (currentGroup?.title !== label) {
        currentGroup = { title: label, data: [] };
        groups.push(currentGroup);
      }
      currentGroup.data.push(notification);
    });

    return groups;
  };

  const groupedNotifications = groupNotificationsByDate(notifications);

  const renderItem = ({ item, index }) => {
    // Check if we need to render a section header
    let sectionHeader = null;
    let currentGroup = null;
    let itemIndex = 0;

    for (const group of groupedNotifications) {
      for (let i = 0; i < group.data.length; i++) {
        if (group.data[i].notification_id === item.notification_id) {
          if (i === 0) {
            sectionHeader = group.title;
          }
          break;
        }
        itemIndex++;
      }
      if (sectionHeader !== null || itemIndex > index) break;
    }

    return (
      <>
        {sectionHeader && <SectionHeader title={sectionHeader} />}
        <NotificationItem
          notification={item}
          onPress={handleNotificationPress}
          onMarkRead={handleMarkRead}
        />
      </>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#3B82F6" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllReadText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'unread' && styles.filterTabActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterTabText, filter === 'unread' && styles.filterTabTextActive]}>
            Unread
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptyText}>
            {filter === 'unread'
              ? "You're all caught up!"
              : 'Interact with posts and friends to see updates here.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.notification_id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#3B82F6"
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  markAllReadText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#334155',
  },
  filterTabActive: {
    backgroundColor: '#3B82F6',
  },
  filterTabText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
  },
  sectionHeaderText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '600',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  notificationUnread: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 2,
  },
  textBold: {
    fontWeight: '600',
  },
  notificationBody: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
  notificationTime: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
    marginLeft: 8,
    marginTop: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
});
