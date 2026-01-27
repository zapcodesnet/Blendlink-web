import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Facebook, ExternalLink, ChevronLeft, ChevronRight, 
  Share2, DollarSign, Star, Zap, Loader2, ImageIcon
} from 'lucide-react';
import { Button } from './ui/button';
import api from '../services/api';

const FACEBOOK_GROUP_URL = "https://www.facebook.com/groups/938837402074960?ref=blendlink";

// Scenery configuration for photo backgrounds
const SCENERY_CONFIG = {
  natural: { color: 'from-green-600 to-emerald-800', icon: '🌿', label: 'Natural' },
  urban: { color: 'from-gray-600 to-slate-800', icon: '🏙️', label: 'Urban' },
  portrait: { color: 'from-amber-600 to-orange-800', icon: '👤', label: 'Portrait' },
  abstract: { color: 'from-purple-600 to-indigo-800', icon: '🎨', label: 'Abstract' },
  wildlife: { color: 'from-amber-700 to-yellow-900', icon: '🦁', label: 'Wildlife' },
  architecture: { color: 'from-slate-600 to-zinc-800', icon: '🏛️', label: 'Architecture' },
  food: { color: 'from-orange-500 to-red-700', icon: '🍕', label: 'Food' },
  travel: { color: 'from-sky-500 to-blue-700', icon: '✈️', label: 'Travel' },
  sports: { color: 'from-red-600 to-rose-800', icon: '⚽', label: 'Sports' },
  fashion: { color: 'from-pink-500 to-fuchsia-700', icon: '👗', label: 'Fashion' },
  default: { color: 'from-purple-600 to-pink-600', icon: '📷', label: 'Photo' }
};

// Format dollar value
const formatValue = (value) => {
  if (!value) return "$0";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

// Photo Thumbnail Component
const PhotoThumbnail = ({ photo, isSelected, onClick }) => {
  const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.default;
  
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`relative flex-shrink-0 w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${
        isSelected 
          ? 'border-pink-500 ring-2 ring-pink-500/50' 
          : 'border-gray-600 hover:border-pink-400'
      }`}
      data-testid={`photo-thumbnail-${photo.mint_id}`}
    >
      {photo.photo_url ? (
        <img 
          src={photo.photo_url} 
          alt={photo.name || 'Minted photo'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
          <span className="text-xl">{scenery.icon}</span>
        </div>
      )}
      {/* Value badge */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-black/80 px-1.5 py-0.5 rounded text-[10px] text-yellow-400 font-bold whitespace-nowrap">
        {formatValue(photo.dollar_value)}
      </div>
    </motion.button>
  );
};

// Photo Preview Modal (inside overlay)
const PhotoPreviewModal = ({ photo, onClose, onShare }) => {
  if (!photo) return null;
  
  const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.default;
  const stars = photo.stars || 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/80" />
      
      {/* Modal content */}
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl"
        data-testid="photo-preview-modal"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        
        {/* Photo */}
        <div className="aspect-square relative">
          {photo.photo_url ? (
            <img 
              src={photo.photo_url} 
              alt={photo.name || 'Minted photo'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
              <span className="text-8xl opacity-50">{scenery.icon}</span>
            </div>
          )}
          
          {/* Stars overlay */}
          {stars > 0 && (
            <div className="absolute top-3 left-3 flex gap-0.5">
              {[...Array(Math.min(stars, 5))].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
          )}
        </div>
        
        {/* Stats */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white truncate">
              {photo.name || 'Unnamed Photo'}
            </h3>
            <div className="flex items-center gap-1 text-yellow-400">
              <DollarSign className="w-4 h-4" />
              <span className="font-bold">{formatValue(photo.dollar_value)}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {/* Scenery */}
            <div className={`px-3 py-1.5 rounded-full bg-gradient-to-r ${scenery.color} text-white text-sm font-medium flex items-center gap-1`}>
              <span>{scenery.icon}</span>
              {scenery.label}
            </div>
            
            {/* Level */}
            <div className="px-3 py-1.5 rounded-full bg-purple-600/30 text-purple-300 text-sm font-medium flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              Level {photo.level || 1}
            </div>
            
            {/* Stars */}
            {stars > 0 && (
              <div className="px-3 py-1.5 rounded-full bg-yellow-600/30 text-yellow-300 text-sm font-medium flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-current" />
                {stars} Star{stars > 1 ? 's' : ''}
              </div>
            )}
          </div>
          
          {/* Share button */}
          <Button
            onClick={() => onShare(photo)}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium"
            data-testid="share-to-group-btn"
          >
            <Facebook className="w-4 h-4 mr-2" />
            Share to Blendlink Community Group
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Main Facebook Share Overlay Component
export const FacebookShareOverlay = ({ isOpen, onClose, onVisitGroup }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const scrollRef = useRef(null);
  
  // Fetch user's minted photos
  useEffect(() => {
    if (isOpen) {
      fetchPhotos();
    }
  }, [isOpen]);
  
  const fetchPhotos = async () => {
    setLoading(true);
    try {
      const response = await api.get('/minting/photos');
      // Sort by most recently minted (created_at descending) and get top 5
      const allPhotos = response.data || [];
      const sortedPhotos = allPhotos.sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA; // Most recent first
      });
      // Get the 5 most recent photos
      const recentPhotos = sortedPhotos.slice(0, 5);
      setPhotos(recentPhotos);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePhotoClick = (photo) => {
    setSelectedPhoto(photo);
    setShowPreview(true);
  };
  
  const handleShare = (photo) => {
    // Create share text
    const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.default;
    const shareText = encodeURIComponent(
      `Check out my minted ${formatValue(photo.dollar_value)} ${scenery.label} card! 🎴✨ #Blendlink #MintedPhoto`
    );
    
    // Open Facebook Group with pre-filled post (limited functionality)
    // Facebook doesn't support pre-filled posts for groups, so we'll just open the group
    window.open(FACEBOOK_GROUP_URL, '_blank');
    
    // Mark as visited for contextual FAB
    sessionStorage.setItem('visited_fb_group', 'true');
    
    setShowPreview(false);
    onClose();
    
    if (onVisitGroup) {
      onVisitGroup();
    }
  };
  
  const handleGoToGroup = () => {
    window.open(FACEBOOK_GROUP_URL, '_blank');
    
    // Mark as visited for contextual FAB
    sessionStorage.setItem('visited_fb_group', 'true');
    
    onClose();
    
    if (onVisitGroup) {
      onVisitGroup();
    }
  };
  
  const scrollThumbnails = (direction) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction * 80, behavior: 'smooth' });
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center"
        onClick={onClose}
        data-testid="facebook-share-overlay"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        
        {/* Overlay Panel */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md mx-4 mb-20 sm:mb-0 bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl border border-pink-500/30 shadow-2xl shadow-pink-500/20 overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Facebook className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">Share to Community</h3>
                  <p className="text-xs text-gray-400">Blendlink Facebook Group</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Info text */}
            <div className="text-center">
              <p className="text-sm font-medium text-white mb-1">
                Share Your Latest Minted Photos
              </p>
              <p className="text-xs text-gray-400">
                Tap a photo to preview & share to the community
              </p>
            </div>
            
            {/* Photo thumbnails carousel */}
            <div className="relative">
              <div className="flex items-center gap-2">
                {photos.length > 3 && (
                  <button
                    onClick={() => scrollThumbnails(-1)}
                    className="flex-shrink-0 p-1 hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-400" />
                  </button>
                )}
                
                <div 
                  ref={scrollRef}
                  className="flex gap-3 overflow-x-auto scrollbar-hide py-2 px-1 flex-1"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center w-full py-4">
                      <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                    </div>
                  ) : photos.length > 0 ? (
                    photos.map((photo) => (
                      <PhotoThumbnail
                        key={photo.mint_id}
                        photo={photo}
                        isSelected={selectedPhoto?.mint_id === photo.mint_id}
                        onClick={() => handlePhotoClick(photo)}
                      />
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center w-full py-4 text-gray-500">
                      <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                      <p className="text-sm">No minted photos yet</p>
                    </div>
                  )}
                </div>
                
                {photos.length > 3 && (
                  <button
                    onClick={() => scrollThumbnails(1)}
                    className="flex-shrink-0 p-1 hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Go to Group button */}
            <Button
              onClick={handleGoToGroup}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium h-12"
              data-testid="go-to-group-btn"
            >
              <Facebook className="w-5 h-5 mr-2" />
              Go to Blendlink Community Group
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
            
            {/* Earn info */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full">
                +25 BL
              </span>
              <span>for each post shared in the group</span>
            </div>
          </div>
        </motion.div>
        
        {/* Photo Preview Modal */}
        <AnimatePresence>
          {showPreview && selectedPhoto && (
            <PhotoPreviewModal
              photo={selectedPhoto}
              onClose={() => setShowPreview(false)}
              onShare={handleShare}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export default FacebookShareOverlay;
