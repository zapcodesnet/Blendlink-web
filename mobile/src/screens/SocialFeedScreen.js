/**
 * Social Feed Screen for Blendlink Mobile
 * Facebook-style feed with posts, reactions, comments
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { socialAPI, walletAPI } from '../services/api';

// Icons (using text emoji as placeholder - in production use @expo/vector-icons)
const Icons = {
  thumbsUp: '👍',
  thumbsUpGold: '⭐',
  thumbsDown: '👎',
  comment: '💬',
  share: '↗️',
  image: '🖼️',
  video: '🎬',
  ai: '✨',
  coin: '🪙',
  more: '⋯',
  close: '✕',
  send: '➤',
};

// Post Card Component
const PostCard = ({ post, onReact, onComment, onShare, currentUserId }) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const isOwnPost = post.user_id === currentUserId;
  const hasReacted = !!post.user_reaction;

  const loadComments = async () => {
    if (comments.length > 0) return;
    setIsLoadingComments(true);
    try {
      const data = await socialAPI.getComments(post.post_id);
      setComments(data);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleToggleComments = () => {
    setShowComments(!showComments);
    if (!showComments) loadComments();
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    try {
      const result = await socialAPI.createComment(post.post_id, newComment);
      setComments([...comments, result.comment]);
      setNewComment('');
      if (result.bl_coins_earned > 0) {
        Alert.alert('BL Coins', `+${result.bl_coins_earned} BL coins for commenting!`);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add comment');
    }
  };

  const handleReaction = (type) => {
    onReact(post.post_id, type);
    setShowReactionPicker(false);
  };

  const handleLongPress = () => {
    if (!isOwnPost && !hasReacted) {
      setShowReactionPicker(true);
    }
  };

  const handleQuickReact = () => {
    if (!isOwnPost && !hasReacted) {
      onReact(post.post_id, 'golden_thumbs_up');
    }
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            {post.user?.avatar ? (
              <Image source={{ uri: post.user.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{post.user?.name?.[0] || '?'}</Text>
            )}
          </View>
          <View>
            <Text style={styles.userName}>{post.user?.name || 'Unknown'}</Text>
            <Text style={styles.postTime}>{getTimeAgo(post.created_at)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.moreButton}>
          <Text style={styles.moreIcon}>{Icons.more}</Text>
        </TouchableOpacity>
      </View>

      {/* Post Content */}
      <Text style={styles.postContent}>{post.content}</Text>

      {/* Post Media */}
      {post.media_urls?.length > 0 && (
        <View style={styles.mediaContainer}>
          {post.media_urls.map((url, i) => (
            <Image key={i} source={{ uri: url }} style={styles.mediaImage} resizeMode="cover" />
          ))}
        </View>
      )}

      {/* Reaction Counts */}
      <View style={styles.reactionCounts}>
        <View style={styles.reactionCountLeft}>
          {post.golden_thumbs_up_count > 0 && (
            <Text style={styles.countText}>
              {Icons.thumbsUpGold} {post.golden_thumbs_up_count}
            </Text>
          )}
          {post.silver_thumbs_down_count > 0 && (
            <Text style={[styles.countText, { marginLeft: 12 }]}>
              {Icons.thumbsDown} {post.silver_thumbs_down_count}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={handleToggleComments}>
          <Text style={styles.commentCount}>
            {post.comments_count > 0 ? `${post.comments_count} comments` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Pressable
          style={[
            styles.actionButton,
            isOwnPost && styles.actionButtonDisabled,
            post.user_reaction === 'golden_thumbs_up' && styles.actionButtonActive,
          ]}
          onPress={handleQuickReact}
          onLongPress={handleLongPress}
          disabled={isOwnPost}
        >
          <Text style={[
            styles.actionIcon,
            post.user_reaction === 'golden_thumbs_up' && styles.goldReaction,
            post.user_reaction === 'silver_thumbs_down' && styles.silverReaction,
          ]}>
            {post.user_reaction === 'golden_thumbs_up' ? Icons.thumbsUpGold : 
             post.user_reaction === 'silver_thumbs_down' ? Icons.thumbsDown : Icons.thumbsUp}
          </Text>
          <Text style={[
            styles.actionText,
            post.user_reaction && styles.actionTextActive,
          ]}>
            {hasReacted ? (post.user_reaction === 'golden_thumbs_up' ? 'Liked' : 'Disliked') : 'Like'}
          </Text>
        </Pressable>

        <TouchableOpacity style={styles.actionButton} onPress={handleToggleComments}>
          <Text style={styles.actionIcon}>{Icons.comment}</Text>
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => onShare(post)}>
          <Text style={styles.actionIcon}>{Icons.share}</Text>
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </View>

      {/* Reaction Picker Modal */}
      <Modal
        visible={showReactionPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReactionPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowReactionPicker(false)}>
          <View style={styles.reactionPicker}>
            <TouchableOpacity
              style={styles.reactionOption}
              onPress={() => handleReaction('golden_thumbs_up')}
            >
              <Text style={styles.reactionEmoji}>{Icons.thumbsUpGold}</Text>
              <Text style={styles.reactionLabel}>+10 BL each</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reactionOption}
              onPress={() => handleReaction('silver_thumbs_down')}
            >
              <Text style={styles.reactionEmoji}>{Icons.thumbsDown}</Text>
              <Text style={styles.reactionLabel}>+10 BL (you)</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Comments Section */}
      {showComments && (
        <View style={styles.commentsSection}>
          {/* Comment Input */}
          <View style={styles.commentInput}>
            <TextInput
              style={styles.commentTextInput}
              placeholder="Write a comment..."
              placeholderTextColor="#9CA3AF"
              value={newComment}
              onChangeText={setNewComment}
            />
            <TouchableOpacity onPress={handleSubmitComment} disabled={!newComment.trim()}>
              <Text style={[styles.sendIcon, !newComment.trim() && { opacity: 0.5 }]}>
                {Icons.send}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {isLoadingComments ? (
            <ActivityIndicator style={{ marginTop: 12 }} color="#2563EB" />
          ) : (
            comments.map((comment) => (
              <View key={comment.comment_id} style={styles.commentItem}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>{comment.user?.name?.[0] || '?'}</Text>
                </View>
                <View style={styles.commentContent}>
                  <Text style={styles.commentUserName}>{comment.user?.name}</Text>
                  <Text style={styles.commentText}>{comment.content}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
};

// Stories Bar Component
const StoriesBar = ({ stories, onAddStory }) => (
  <View style={styles.storiesBar}>
    <TouchableOpacity style={styles.storyItem} onPress={onAddStory}>
      <View style={styles.storyAddButton}>
        <Text style={styles.storyAddIcon}>+</Text>
      </View>
      <Text style={styles.storyLabel}>Your Story</Text>
    </TouchableOpacity>
    {stories.map((story, i) => (
      <TouchableOpacity key={i} style={styles.storyItem}>
        <View style={[styles.storyRing, story.has_unviewed && styles.storyRingActive]}>
          <View style={styles.storyAvatar}>
            <Text style={styles.storyAvatarText}>{story.user?.name?.[0] || '?'}</Text>
          </View>
        </View>
        <Text style={styles.storyLabel} numberOfLines={1}>{story.user?.name?.split(' ')[0]}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

// Create Post Button Component
const CreatePostButton = ({ user, onPress }) => (
  <TouchableOpacity style={styles.createPostButton} onPress={onPress}>
    <View style={styles.createPostAvatar}>
      <Text style={styles.createPostAvatarText}>{user?.name?.[0] || '?'}</Text>
    </View>
    <Text style={styles.createPostText}>What's on your mind?</Text>
  </TouchableOpacity>
);

// Main Social Feed Screen
export default function SocialFeedScreen({ navigation }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [balance, setBalance] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [feedData, storiesData, walletData] = await Promise.all([
        socialAPI.getFeed(0, 20),
        socialAPI.getStories(),
        walletAPI.getBalance(),
      ]);
      setPosts(feedData);
      setStories(storiesData);
      setBalance(walletData.balance);
    } catch (error) {
      console.error('Failed to load feed:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleReact = async (postId, reactionType) => {
    try {
      const result = await socialAPI.reactToPost(postId, reactionType);
      
      // Update post in state
      setPosts(prev => prev.map(post => {
        if (post.post_id === postId) {
          return {
            ...post,
            golden_thumbs_up_count: result.golden_thumbs_up_count,
            silver_thumbs_down_count: result.silver_thumbs_down_count,
            user_reaction: reactionType,
          };
        }
        return post;
      }));

      if (result.reactor_bl_coins_earned > 0) {
        Alert.alert('BL Coins', `+${result.reactor_bl_coins_earned} BL coins for reacting!`);
        setBalance(prev => prev + result.reactor_bl_coins_earned);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to react');
    }
  };

  const handleShare = async (post) => {
    try {
      const result = await socialAPI.sharePost(post.post_id);
      setPosts(prev => [result.post, ...prev]);
      if (result.bl_coins_earned > 0) {
        Alert.alert('Shared!', `+${result.bl_coins_earned} BL coins`);
        setBalance(prev => prev + result.bl_coins_earned);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to share');
    }
  };

  const renderHeader = () => (
    <View>
      {/* Balance Header */}
      <View style={styles.balanceHeader}>
        <Text style={styles.balanceLabel}>BL Coins</Text>
        <Text style={styles.balanceValue}>{Icons.coin} {balance.toLocaleString()}</Text>
      </View>

      {/* Stories */}
      <StoriesBar stories={stories} onAddStory={() => Alert.alert('Coming Soon', 'Story creation coming soon!')} />

      {/* Create Post */}
      <CreatePostButton user={user} onPress={() => navigation.navigate('CreatePost')} />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2563EB" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.post_id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onReact={handleReact}
            onShare={handleShare}
            currentUserId={user?.user_id}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📱</Text>
            <Text style={styles.emptyTitle}>No posts yet</Text>
            <Text style={styles.emptyText}>Be the first to share something!</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#2563EB" />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        // Performance optimizations
        removeClippedSubviews={true}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        onEndReachedThreshold={0.5}
      />

      {/* AI Create FAB */}
      <TouchableOpacity
        style={styles.aiFab}
        onPress={() => navigation.navigate('AICreate')}
      >
        <Text style={styles.aiFabIcon}>{Icons.ai}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  listContent: {
    paddingBottom: 100,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    marginBottom: 8,
  },
  balanceLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  balanceValue: {
    color: '#F59E0B',
    fontSize: 18,
    fontWeight: 'bold',
  },
  storiesBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    marginBottom: 8,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 6,
    width: 70,
  },
  storyAddButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  storyAddIcon: {
    color: '#2563EB',
    fontSize: 24,
    fontWeight: 'bold',
  },
  storyRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2,
    backgroundColor: '#334155',
  },
  storyRingActive: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  storyAvatar: {
    flex: 1,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  storyLabel: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    marginBottom: 8,
  },
  createPostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  createPostAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createPostText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  postCard: {
    backgroundColor: '#1E293B',
    marginBottom: 8,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  postTime: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  moreButton: {
    padding: 8,
  },
  moreIcon: {
    color: '#9CA3AF',
    fontSize: 20,
  },
  postContent: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 1,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  reactionCounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reactionCountLeft: {
    flexDirection: 'row',
  },
  countText: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  commentCount: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  actionButtons: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
  },
  actionIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  actionText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '500',
  },
  actionTextActive: {
    color: '#F59E0B',
  },
  goldReaction: {
    color: '#F59E0B',
  },
  silverReaction: {
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPicker: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 12,
  },
  reactionOption: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  reactionEmoji: {
    fontSize: 32,
  },
  reactionLabel: {
    color: '#9CA3AF',
    fontSize: 10,
    marginTop: 4,
  },
  commentsSection: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    padding: 12,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentTextInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  sendIcon: {
    fontSize: 18,
    color: '#2563EB',
    marginLeft: 8,
  },
  commentItem: {
    flexDirection: 'row',
    marginTop: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  commentAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  commentContent: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    padding: 8,
  },
  commentUserName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  commentText: {
    color: '#E5E7EB',
    fontSize: 13,
    marginTop: 2,
  },
  emptyState: {
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
  },
  aiFab: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  aiFabIcon: {
    fontSize: 24,
  },
});
