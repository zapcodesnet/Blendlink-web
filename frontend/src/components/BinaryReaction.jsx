import React, { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';

/**
 * BinaryReaction Component
 * 
 * Implements the golden thumbs up / silver thumbs down reaction system
 * - Golden thumbs up: Earns poster 10 BL coins
 * - Silver thumbs down: No reward
 * - Only one reaction per user per item
 * - Real-time sync across web and mobile
 */
export default function BinaryReaction({
  itemType = 'post', // 'post', 'listing', 'comment', etc.
  itemId,
  initialUpvotes = 0,
  initialDownvotes = 0,
  initialUserReaction = null, // 'up', 'down', or null
  ownerId = null, // Owner of the content (receives BL for upvotes)
  disabled = false,
  size = 'default', // 'small', 'default', 'large'
  showCounts = true,
  onReactionChange = () => {},
  className = ''
}) {
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [userReaction, setUserReaction] = useState(initialUserReaction);
  const [isLoading, setIsLoading] = useState(false);
  const [animating, setAnimating] = useState(null); // 'up' or 'down'

  const sizeClasses = {
    small: 'w-4 h-4',
    default: 'w-5 h-5',
    large: 'w-6 h-6'
  };

  const buttonSizes = {
    small: 'px-2 py-1 text-xs gap-1',
    default: 'px-3 py-1.5 text-sm gap-1.5',
    large: 'px-4 py-2 text-base gap-2'
  };

  const handleReaction = useCallback(async (type) => {
    if (disabled || isLoading) return;

    // Optimistic update
    const previousReaction = userReaction;
    const previousUpvotes = upvotes;
    const previousDownvotes = downvotes;

    // Calculate new state
    let newUpvotes = upvotes;
    let newDownvotes = downvotes;
    let newUserReaction = type;

    // If clicking same reaction, toggle off
    if (previousReaction === type) {
      newUserReaction = null;
      if (type === 'up') newUpvotes--;
      else newDownvotes--;
    } else {
      // If switching from opposite reaction
      if (previousReaction === 'up') newUpvotes--;
      else if (previousReaction === 'down') newDownvotes--;
      
      // Add new reaction
      if (type === 'up') newUpvotes++;
      else newDownvotes++;
    }

    // Animate
    setAnimating(type);
    setTimeout(() => setAnimating(null), 300);

    // Apply optimistic update
    setUpvotes(newUpvotes);
    setDownvotes(newDownvotes);
    setUserReaction(newUserReaction);
    onReactionChange({ upvotes: newUpvotes, downvotes: newDownvotes, userReaction: newUserReaction });

    setIsLoading(true);
    try {
      const response = await api.post('/reactions/react', {
        item_type: itemType,
        item_id: itemId,
        reaction_type: type,
        is_toggle: previousReaction === type
      });

      // Update with server response if available
      if (response.data) {
        if (response.data.upvotes !== undefined) setUpvotes(response.data.upvotes);
        if (response.data.downvotes !== undefined) setDownvotes(response.data.downvotes);
        if (response.data.user_reaction !== undefined) setUserReaction(response.data.user_reaction);
        
        // Show reward notification for upvotes
        if (type === 'up' && previousReaction !== 'up' && response.data.reward_given) {
          toast.success(
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">👍</span>
              <span>+10 BL sent to creator!</span>
            </div>,
            { duration: 2000 }
          );
        }
      }
    } catch (error) {
      // Revert on error
      setUpvotes(previousUpvotes);
      setDownvotes(previousDownvotes);
      setUserReaction(previousReaction);
      onReactionChange({ upvotes: previousUpvotes, downvotes: previousDownvotes, userReaction: previousReaction });
      
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      }
    } finally {
      setIsLoading(false);
    }
  }, [itemType, itemId, userReaction, upvotes, downvotes, disabled, isLoading, onReactionChange]);

  const formatCount = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Upvote Button - Golden */}
      <button
        onClick={() => handleReaction('up')}
        disabled={disabled || isLoading}
        className={`
          flex items-center ${buttonSizes[size]} rounded-full transition-all duration-200
          ${userReaction === 'up'
            ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-lg shadow-yellow-500/30 scale-105'
            : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-yellow-400'
          }
          ${animating === 'up' ? 'animate-bounce' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        title="Give golden thumbs up (+10 BL to creator)"
        data-testid={`reaction-up-${itemId}`}
      >
        <ThumbsUp 
          className={`${sizeClasses[size]} ${userReaction === 'up' ? 'fill-current' : ''}`}
        />
        {showCounts && (
          <span className="font-medium">{formatCount(upvotes)}</span>
        )}
      </button>

      {/* Downvote Button - Silver */}
      <button
        onClick={() => handleReaction('down')}
        disabled={disabled || isLoading}
        className={`
          flex items-center ${buttonSizes[size]} rounded-full transition-all duration-200
          ${userReaction === 'down'
            ? 'bg-gradient-to-r from-slate-400 to-slate-500 text-white shadow-lg shadow-slate-500/30 scale-105'
            : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
          }
          ${animating === 'down' ? 'animate-bounce' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        title="Give silver thumbs down"
        data-testid={`reaction-down-${itemId}`}
      >
        <ThumbsDown 
          className={`${sizeClasses[size]} ${userReaction === 'down' ? 'fill-current' : ''}`}
        />
        {showCounts && (
          <span className="font-medium">{formatCount(downvotes)}</span>
        )}
      </button>
    </div>
  );
}

/**
 * InlineReaction - Compact version for comments/lists
 */
export function InlineReaction({
  itemType,
  itemId,
  initialUpvotes = 0,
  initialDownvotes = 0,
  initialUserReaction = null,
  className = ''
}) {
  return (
    <BinaryReaction
      itemType={itemType}
      itemId={itemId}
      initialUpvotes={initialUpvotes}
      initialDownvotes={initialDownvotes}
      initialUserReaction={initialUserReaction}
      size="small"
      showCounts={true}
      className={className}
    />
  );
}

/**
 * ReactionSummary - Display-only reaction counts
 */
export function ReactionSummary({ upvotes = 0, downvotes = 0, className = '' }) {
  const total = upvotes + downvotes;
  const ratio = total > 0 ? (upvotes / total * 100).toFixed(0) : 0;
  
  return (
    <div className={`flex items-center gap-3 text-sm ${className}`}>
      <div className="flex items-center gap-1 text-yellow-400">
        <ThumbsUp className="w-4 h-4" />
        <span>{upvotes}</span>
      </div>
      <div className="flex items-center gap-1 text-slate-400">
        <ThumbsDown className="w-4 h-4" />
        <span>{downvotes}</span>
      </div>
      {total > 0 && (
        <div className="text-xs text-slate-500">
          ({ratio}% positive)
        </div>
      )}
    </div>
  );
}
