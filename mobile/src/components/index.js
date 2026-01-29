/**
 * Shared Components Index
 * 
 * Export all reusable components for easy importing
 */

// Photo display components
export { default as PhotoCard, SCENERY_CONFIG, formatDollarValue } from './PhotoCard';

// Game-specific components
export { default as StreakIndicator, StreakDots } from './StreakIndicator';
export { default as MobileTappingArena } from './MobileTappingArena';

// Loading states
export {
  default as SkeletonBase,
  PhotoCardSkeleton,
  PhotoGridSkeleton,
  ListItemSkeleton,
  StatsBarSkeleton,
  FeedPostSkeleton,
  GameLobbySkeleton,
  FullScreenSkeleton,
} from './LoadingSkeletons';
