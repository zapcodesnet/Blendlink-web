/**
 * LikeButton Component - Heart reaction for photos
 * 
 * Mock engagement service for social interactions.
 * Can be replaced with real Facebook/Instagram API later.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';

export const LikeButton = ({ 
  photoId, 
  initialLikes = 0, 
  initialLiked = false,
  size = 'md', // 'sm', 'md', 'lg'
  showCount = true,
  onLikeChange,
}) => {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [isLoading, setIsLoading] = useState(false);
  const [showBurst, setShowBurst] = useState(false);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const buttonSizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2',
  };

  const textSizeClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  const handleLike = useCallback(async (e) => {
    e.stopPropagation(); // Prevent triggering parent click events
    
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (isLiked) {
        // Unlike
        await api.delete(`/photo-game/engagement/unlike/${photoId}`);
        setLikes(prev => Math.max(0, prev - 1));
        setIsLiked(false);
        onLikeChange?.({ liked: false, count: likes - 1 });
      } else {
        // Like
        const response = await api.post('/photo-game/engagement/like', {
          photo_id: photoId,
          reaction_type: 'heart'
        });
        
        setLikes(response.data.total_reactions || likes + 1);
        setIsLiked(true);
        setShowBurst(true);
        setTimeout(() => setShowBurst(false), 600);
        onLikeChange?.({ liked: true, count: response.data.total_reactions });
      }
    } catch (err) {
      console.error('Like error:', err);
      // Optimistic UI - revert on error
      if (!isLiked) {
        toast.error('Failed to like photo');
      }
    } finally {
      setIsLoading(false);
    }
  }, [photoId, isLiked, isLoading, likes, onLikeChange]);

  return (
    <motion.button
      onClick={handleLike}
      disabled={isLoading}
      className={`relative flex items-center gap-0.5 ${buttonSizeClasses[size]} transition-all ${
        isLiked 
          ? 'text-red-500' 
          : 'text-gray-400 hover:text-red-400'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      data-testid={`like-button-${photoId}`}
    >
      {/* Heart burst animation */}
      <AnimatePresence>
        {showBurst && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute text-red-500"
                initial={{ 
                  scale: 0.5, 
                  opacity: 1,
                  x: 0, 
                  y: 0 
                }}
                animate={{ 
                  scale: 0,
                  opacity: 0,
                  x: Math.cos((i / 6) * Math.PI * 2) * 20,
                  y: Math.sin((i / 6) * Math.PI * 2) * 20,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                ❤️
              </motion.span>
            ))}
          </>
        )}
      </AnimatePresence>

      <motion.div
        animate={isLiked ? { scale: [1, 1.3, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <Heart 
          className={`${sizeClasses[size]} ${isLiked ? 'fill-current' : ''}`}
        />
      </motion.div>
      
      {showCount && (
        <span className={`${textSizeClasses[size]} font-medium`}>
          {likes > 0 ? likes : ''}
        </span>
      )}
    </motion.button>
  );
};

// Compact version for photo cards in grids
export const LikeButtonCompact = ({ photoId, initialLikes = 0, initialLiked = false }) => {
  return (
    <LikeButton 
      photoId={photoId}
      initialLikes={initialLikes}
      initialLiked={initialLiked}
      size="sm"
      showCount={true}
    />
  );
};

export default LikeButton;
