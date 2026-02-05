/**
 * Skeleton Loaders for improved perceived performance
 * These components show placeholder content while data loads from Atlas
 */

import React from 'react';
import { cn } from '../../lib/utils';

// Base skeleton with shimmer animation
export const Skeleton = ({ className, ...props }) => (
  <div
    className={cn(
      "animate-pulse rounded-md bg-muted/50",
      className
    )}
    {...props}
  />
);

// Photo card skeleton
export const PhotoCardSkeleton = ({ size = 'medium' }) => {
  const sizeConfig = {
    small: { width: 'w-[132px]', height: 'h-[214px]' },
    medium: { width: 'w-[165px]', height: 'h-[264px]' },
    large: { width: 'w-[214px]', height: 'h-[330px]' },
  };
  const config = sizeConfig[size] || sizeConfig.medium;

  return (
    <div className={cn(config.width, config.height, "rounded-xl overflow-hidden bg-gray-800 border border-gray-700")}>
      {/* Image skeleton - 70% */}
      <Skeleton className="w-full h-[70%] rounded-none bg-gray-700" />
      
      {/* Stats skeleton - 30% */}
      <div className="p-2 space-y-2 h-[30%] bg-gray-900/50">
        <Skeleton className="h-3 w-3/4 mx-auto bg-gray-700" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-16 bg-gray-700" />
          <Skeleton className="h-3 w-10 bg-gray-700" />
        </div>
        <Skeleton className="h-2 w-full bg-gray-700" />
        <Skeleton className="h-4 w-20 mx-auto bg-gray-700" />
      </div>
    </div>
  );
};

// Grid of photo card skeletons
export const PhotoGridSkeleton = ({ count = 6, size = 'medium' }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-2">
    {Array.from({ length: count }).map((_, i) => (
      <PhotoCardSkeleton key={i} size={size} />
    ))}
  </div>
);

// Stats card skeleton
export const StatsCardSkeleton = () => (
  <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
    <Skeleton className="h-4 w-20 bg-gray-700" />
    <Skeleton className="h-8 w-24 bg-gray-700" />
  </div>
);

// Stats row skeleton
export const StatsRowSkeleton = ({ count = 3 }) => (
  <div className={cn("grid gap-3", `grid-cols-${Math.min(count, 4)}`)}>
    {Array.from({ length: count }).map((_, i) => (
      <StatsCardSkeleton key={i} />
    ))}
  </div>
);

// Feed post skeleton
export const PostSkeleton = () => (
  <div className="bg-card rounded-xl p-4 space-y-3 border border-border">
    {/* Header */}
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="space-y-1 flex-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
    
    {/* Content */}
    <div className="space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
    
    {/* Image placeholder */}
    <Skeleton className="h-48 w-full rounded-lg" />
    
    {/* Actions */}
    <div className="flex gap-4 pt-2">
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-8 w-16" />
    </div>
  </div>
);

// Feed skeleton
export const FeedSkeleton = ({ count = 3 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <PostSkeleton key={i} />
    ))}
  </div>
);

// Story bar skeleton
export const StoryBarSkeleton = ({ count = 5 }) => (
  <div className="flex gap-3 overflow-x-hidden p-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
        <Skeleton className="w-16 h-16 rounded-full" />
        <Skeleton className="h-3 w-12" />
      </div>
    ))}
  </div>
);

// Full page loading skeleton for minted photos
export const MintedPhotosPageSkeleton = () => (
  <div className="min-h-screen bg-gray-900 p-4 space-y-4">
    {/* Header stats */}
    <div className="grid grid-cols-3 gap-3">
      <StatsCardSkeleton />
      <StatsCardSkeleton />
      <StatsCardSkeleton />
    </div>
    
    {/* Action buttons */}
    <div className="flex gap-2">
      <Skeleton className="h-10 w-24 rounded-lg" />
      <Skeleton className="h-10 w-24 rounded-lg" />
    </div>
    
    {/* Photo grid */}
    <PhotoGridSkeleton count={6} />
  </div>
);

// Full page loading skeleton for feed
export const FeedPageSkeleton = () => (
  <div className="min-h-screen bg-background p-4 space-y-4">
    {/* Story bar */}
    <StoryBarSkeleton />
    
    {/* Create post */}
    <Skeleton className="h-20 w-full rounded-xl" />
    
    {/* Posts */}
    <FeedSkeleton count={2} />
  </div>
);

// Error state component
export const ErrorState = ({ 
  title = "Something went wrong", 
  message = "Failed to load data. Please try again.",
  onRetry,
  className 
}) => (
  <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground mb-4">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
      >
        Try Again
      </button>
    )}
  </div>
);

// Empty state component
export const EmptyState = ({ 
  icon,
  title = "No data found", 
  message = "There's nothing here yet.",
  action,
  className 
}) => (
  <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
    {icon && (
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        {icon}
      </div>
    )}
    <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
    <p className="text-sm text-muted-foreground mb-4">{message}</p>
    {action}
  </div>
);

// Inline loading spinner
export const LoadingSpinner = ({ size = 'md', className }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };
  
  return (
    <svg 
      className={cn("animate-spin text-primary", sizeClasses[size], className)} 
      fill="none" 
      viewBox="0 0 24 24"
    >
      <circle 
        className="opacity-25" 
        cx="12" 
        cy="12" 
        r="10" 
        stroke="currentColor" 
        strokeWidth="4"
      />
      <path 
        className="opacity-75" 
        fill="currentColor" 
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

// Full page loading overlay
export const LoadingOverlay = ({ message = "Loading..." }) => (
  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="flex flex-col items-center gap-3">
      <LoadingSpinner size="xl" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  </div>
);

export default {
  Skeleton,
  PhotoCardSkeleton,
  PhotoGridSkeleton,
  StatsCardSkeleton,
  StatsRowSkeleton,
  PostSkeleton,
  FeedSkeleton,
  StoryBarSkeleton,
  MintedPhotosPageSkeleton,
  FeedPageSkeleton,
  ErrorState,
  EmptyState,
  LoadingSpinner,
  LoadingOverlay,
};
