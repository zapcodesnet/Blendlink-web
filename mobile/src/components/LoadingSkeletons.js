/**
 * LoadingSkeletons Components for Mobile
 * 
 * Optimized skeleton loading states for various UI elements
 * Used for smooth perceived loading performance
 */

import React, { memo, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Base skeleton component with shimmer animation
const SkeletonBase = memo(function SkeletonBase({ 
  width, 
  height, 
  borderRadius = 4,
  style 
}) {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <View 
      style={[
        styles.skeleton,
        { 
          width, 
          height, 
          borderRadius,
          backgroundColor: colors.cardSecondary,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
            backgroundColor: colors.border,
          },
        ]}
      />
    </View>
  );
});

// Photo card skeleton
export const PhotoCardSkeleton = memo(function PhotoCardSkeleton({ 
  size = 'medium',
  style 
}) {
  const sizeConfig = {
    small: { width: 80, height: 100 },
    medium: { width: 120, height: 150 },
    large: { width: 160, height: 200 },
  };
  const config = sizeConfig[size] || sizeConfig.medium;

  return (
    <View style={[styles.photoCardSkeleton, { width: config.width }, style]}>
      <SkeletonBase width={config.width} height={config.width} borderRadius={8} />
      <View style={styles.photoCardInfo}>
        <SkeletonBase width={config.width - 16} height={14} style={styles.mb4} />
        <SkeletonBase width={config.width * 0.6} height={12} />
      </View>
    </View>
  );
});

// Photo grid skeleton (multiple cards)
export const PhotoGridSkeleton = memo(function PhotoGridSkeleton({ 
  count = 6,
  columns = 3,
}) {
  const { colors } = useTheme();
  const cardWidth = (SCREEN_WIDTH - 48 - (columns - 1) * 8) / columns;

  return (
    <View style={styles.gridContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <View 
          key={index} 
          style={[
            styles.gridItem,
            { 
              width: cardWidth,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <SkeletonBase width={cardWidth} height={cardWidth} borderRadius={8} />
          <View style={styles.gridItemInfo}>
            <SkeletonBase width={cardWidth - 16} height={12} style={styles.mb4} />
            <SkeletonBase width={cardWidth * 0.5} height={10} />
          </View>
        </View>
      ))}
    </View>
  );
});

// List item skeleton
export const ListItemSkeleton = memo(function ListItemSkeleton({ style }) {
  const { colors } = useTheme();
  
  return (
    <View 
      style={[
        styles.listItem, 
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      <SkeletonBase width={50} height={50} borderRadius={8} />
      <View style={styles.listItemContent}>
        <SkeletonBase width="70%" height={16} style={styles.mb4} />
        <SkeletonBase width="50%" height={12} style={styles.mb4} />
        <SkeletonBase width="30%" height={10} />
      </View>
    </View>
  );
});

// Stats bar skeleton
export const StatsBarSkeleton = memo(function StatsBarSkeleton() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.statsBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.statItem}>
          <SkeletonBase width={40} height={24} style={styles.mb4} />
          <SkeletonBase width={50} height={12} />
        </View>
      ))}
    </View>
  );
});

// Feed post skeleton
export const FeedPostSkeleton = memo(function FeedPostSkeleton() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.feedPost, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.feedHeader}>
        <SkeletonBase width={40} height={40} borderRadius={20} />
        <View style={styles.feedHeaderText}>
          <SkeletonBase width={120} height={14} style={styles.mb4} />
          <SkeletonBase width={80} height={10} />
        </View>
      </View>
      
      {/* Content */}
      <SkeletonBase width="100%" height={200} borderRadius={8} style={styles.mv12} />
      
      {/* Actions */}
      <View style={styles.feedActions}>
        <SkeletonBase width={60} height={24} borderRadius={12} />
        <SkeletonBase width={60} height={24} borderRadius={12} />
        <SkeletonBase width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
});

// Game lobby item skeleton
export const GameLobbySkeleton = memo(function GameLobbySkeleton() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.lobbyItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.lobbyHeader}>
        <SkeletonBase width={100} height={16} />
        <SkeletonBase width={60} height={24} borderRadius={12} />
      </View>
      
      <View style={styles.lobbyPhotos}>
        <SkeletonBase width={80} height={80} borderRadius={8} />
        <SkeletonBase width={80} height={80} borderRadius={8} />
        <SkeletonBase width={80} height={80} borderRadius={8} />
        <SkeletonBase width={80} height={80} borderRadius={8} />
        <SkeletonBase width={80} height={80} borderRadius={8} />
      </View>
      
      <View style={styles.lobbyFooter}>
        <SkeletonBase width={80} height={12} />
        <SkeletonBase width={100} height={36} borderRadius={8} />
      </View>
    </View>
  );
});

// Full screen loading skeleton
export const FullScreenSkeleton = memo(function FullScreenSkeleton({ 
  type = 'default' // 'default' | 'grid' | 'list' | 'feed'
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.fullScreen, { backgroundColor: colors.background }]}>
      {/* Header skeleton */}
      <View style={[styles.headerSkeleton, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <SkeletonBase width={32} height={32} borderRadius={8} />
        <SkeletonBase width={150} height={20} />
        <SkeletonBase width={32} height={32} borderRadius={8} />
      </View>

      {type === 'grid' && <PhotoGridSkeleton count={9} />}
      {type === 'list' && (
        <>
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
          <ListItemSkeleton />
        </>
      )}
      {type === 'feed' && (
        <>
          <FeedPostSkeleton />
          <FeedPostSkeleton />
        </>
      )}
      {type === 'default' && (
        <View style={styles.defaultContent}>
          <StatsBarSkeleton />
          <View style={styles.mt16}>
            <SkeletonBase width="60%" height={24} style={styles.mb12} />
            <SkeletonBase width="100%" height={200} borderRadius={12} />
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '30%',
    opacity: 0.3,
  },
  mb4: {
    marginBottom: 4,
  },
  mb12: {
    marginBottom: 12,
  },
  mv12: {
    marginVertical: 12,
  },
  mt16: {
    marginTop: 16,
  },
  // Photo card
  photoCardSkeleton: {
    overflow: 'hidden',
  },
  photoCardInfo: {
    padding: 8,
  },
  // Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 8,
  },
  gridItem: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  gridItemInfo: {
    padding: 8,
  },
  // List item
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  // Stats bar
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statItem: {
    alignItems: 'center',
  },
  // Feed post
  feedPost: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedHeaderText: {
    marginLeft: 12,
  },
  feedActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  // Lobby item
  lobbyItem: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  lobbyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  lobbyPhotos: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  lobbyFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Full screen
  fullScreen: {
    flex: 1,
  },
  headerSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  defaultContent: {
    padding: 16,
  },
});

export default SkeletonBase;
