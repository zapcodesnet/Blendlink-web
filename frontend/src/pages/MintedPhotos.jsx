import React, { useState, useEffect, useCallback, useContext, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Sparkles, Upload, Image, Coins, Trophy, 
  Zap, Lock, Globe, FolderPlus, MoreVertical,
  Edit2, Trash2, Share2, Eye, EyeOff, Grid, List,
  ChevronRight, Star, Swords, TrendingUp, X, User, Maximize2,
  Shield, LayoutGrid, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { AuthContext, NavContext } from '../App';
import { MintAnimation, useMintAnimation } from '../components/MintAnimation';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { SelfieMatchModal } from '../components/minting/SelfieMatchModal';
import { LikeButton } from '../components/game/LikeButton';
import UnifiedPhotoCard from '../components/photo/UnifiedPhotoCard';
import { cn } from '../lib/utils';
import { 
  PhotoGridSkeleton, 
  StatsCardSkeleton, 
  ErrorState, 
  EmptyState,
  LoadingSpinner 
} from '../components/ui/skeleton-loaders';

// Category labels for the back of card
const RATING_LABELS = {
  original: "Original",
  innovative: "Innovative", 
  unique: "Unique",
  rare: "Rare",
  exposure: "Exposure",
  color: "Color",
  clarity: "Clarity",
  composition: "Composition",
  narrative: "Narrative",
  captivating: "Captivating",
  authenticity: "Authenticity"
};

// Format dollar value compactly
const formatValue = (value) => {
  if (!value) return "$0";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

// Full Image Lightbox Modal Component - Clean view with flip-to-back
// MOBILE-FIRST DESIGN - Fixed bottom bar visibility
const ImageLightbox = ({ photo: initialPhoto, isOpen, onClose, onSetProfilePic, onDelete }) => {
  const [showControls, setShowControls] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fullStats, setFullStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const fetchedRef = React.useRef(null);
  
  // Merge initial photo with full stats
  const photo = fullStats?.mint_id === initialPhoto?.mint_id 
    ? { ...initialPhoto, ...fullStats } 
    : initialPhoto;
  
  // Fetch full stats when back is shown (lazy load)
  const handleShowBack = useCallback(async () => {
    setShowBack(true);
    setShowControls(false);
    
    // Only fetch if not already fetched for this photo
    if (initialPhoto?.mint_id && fetchedRef.current !== initialPhoto.mint_id) {
      setLoadingStats(true);
      try {
        const res = await api.get(`/minting/photo/${initialPhoto.mint_id}/full-stats`);
        setFullStats(res.data);
        fetchedRef.current = initialPhoto.mint_id;
      } catch (err) {
        console.error('Failed to fetch full stats:', err);
      } finally {
        setLoadingStats(false);
      }
    }
  }, [initialPhoto?.mint_id]);
  
  if (!isOpen || !photo) return null;
  
  const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
  const ratings = photo.ratings || {};
  const categoryValues = photo.category_values || {};
  
  // Calculate star display
  const stars = photo.stars || 0;
  const hasGoldenFrame = photo.has_golden_frame || (photo.level || 1) >= 60;
  
  // Handle image tap to toggle controls
  const handleImageTap = () => {
    setShowControls(!showControls);
  };
  
  // Handle delete
  const handleDelete = async () => {
    if (onDelete) {
      await onDelete(photo);
      onClose();
    }
  };
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black"
        style={{ touchAction: 'none' }}
      >
        <AnimatePresence mode="wait">
          {!showBack ? (
            /* FRONT: Clean original photo view */
            <motion.div
              key="front"
              initial={{ rotateY: 180 }}
              animate={{ rotateY: 0 }}
              exit={{ rotateY: -180 }}
              transition={{ duration: 0.4 }}
              className="relative w-full h-full flex flex-col"
              onClick={handleImageTap}
            >
              {/* Top bar - FIXED at top with safe area */}
              <AnimatePresence>
                {showControls && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-0 left-0 right-0 z-20 bg-black/70 backdrop-blur-sm px-4 py-3 pt-safe flex items-center justify-center gap-1"
                    style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
                  >
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-7 h-7 ${i < stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-500'}`} 
                      />
                    ))}
                    {hasGoldenFrame && <span className="ml-2 text-yellow-400 text-sm font-bold">MAX</span>}
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Full-size image container - centered */}
              <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                {photo.image_url ? (
                  <img 
                    src={photo.image_url} 
                    alt={photo.name}
                    className={`max-w-full max-h-full object-contain ${hasGoldenFrame ? 'ring-4 ring-yellow-500' : ''}`}
                    style={{ maxHeight: 'calc(100vh - 180px)' }}
                  />
                ) : (
                  <div className={`w-80 h-80 bg-gradient-to-br ${scenery.color} flex items-center justify-center rounded-xl`}>
                    <span className="text-8xl opacity-50">{scenery.icon}</span>
                  </div>
                )}
              </div>
              
              {/* Bottom bar - FIXED at absolute bottom with extra padding for mobile nav */}
              <AnimatePresence>
                {showControls && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute bottom-0 left-0 right-0 z-20 bg-black/80 backdrop-blur-md px-6 py-5 pb-20 md:pb-6"
                  >
                    <div className="flex items-center justify-between max-w-md mx-auto">
                      {/* Left: Delete - Pink/Purple style */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                        className="p-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg active:scale-95"
                      >
                        <Trash2 className="w-6 h-6 text-white" />
                      </button>
                      
                      {/* Center: Flip to back - Pink/Purple style */}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShowBack(); }}
                        className="p-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg active:scale-95"
                      >
                        <ChevronRight className="w-6 h-6 text-white" />
                      </button>
                      
                      {/* Right: Close - Pink/Purple style */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="p-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg active:scale-95"
                      >
                        <X className="w-6 h-6 text-white" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Delete confirmation dialog */}
              <AnimatePresence>
                {confirmDelete && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 bg-black/90 flex items-center justify-center p-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl border border-gray-700">
                      <Trash2 className="w-12 h-12 text-red-400 mx-auto mb-4" />
                      <p className="text-white text-lg font-semibold mb-2">Delete Forever?</p>
                      <p className="text-gray-400 text-sm mb-6">This will delete the minted photo forever</p>
                      <div className="flex gap-3 justify-center">
                        <Button
                          onClick={() => setConfirmDelete(false)}
                          variant="outline"
                          className="flex-1 border-gray-600 text-white"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleDelete}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            /* BACK: Rating stats view - MOBILE OPTIMIZED */
            <motion.div
              key="back"
              initial={{ rotateY: -180 }}
              animate={{ rotateY: 0 }}
              exit={{ rotateY: 180 }}
              transition={{ duration: 0.4 }}
              className="relative w-full h-full flex flex-col bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header - Pink/Purple gradient */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-4 flex items-center justify-between shrink-0"
                   style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
                <h3 className="text-white font-bold text-lg truncate flex-1">{photo.name}</h3>
                {/* Close X button - Same color as Profile Pic */}
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors ml-2"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
              
              {/* Minted by info - Permanent metadata */}
              <div className="px-4 py-2 bg-gray-800/50 text-center text-sm">
                <span className="text-gray-400">Minted by </span>
                <span className="text-purple-400 font-bold">@{photo.minted_by_username || 'Unknown'}</span>
                <span className="text-gray-400"> on </span>
                <span className="text-gray-300">
                  {photo.minted_at ? new Date(photo.minted_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
                  }) : 'Unknown date'}
                </span>
              </div>
              
              {/* Rating categories - Scrollable with extra bottom padding */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-8" style={{ touchAction: 'pan-y' }}>
                {Object.entries(RATING_LABELS).map(([key, label]) => {
                  const score = ratings[key] || 0;
                  const value = categoryValues[key] || 0;
                  return (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-gray-800">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 font-medium text-sm">{label}</span>
                        <span className="text-purple-400 font-bold text-sm">{score}%</span>
                      </div>
                      <span className="text-yellow-400 font-bold text-sm">{formatValue(value)}</span>
                    </div>
                  );
                })}
                
                {/* Total */}
                <div className="flex items-center justify-between py-3 mt-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg px-3">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-sm">Total Core Power</span>
                    <span className="text-purple-400 font-bold">{photo.overall_score?.toFixed(0) || 0}%</span>
                  </div>
                  <span className="text-yellow-400 font-bold text-lg">{formatValue(photo.dollar_value)}</span>
                </div>
                
                {/* Value Breakdown */}
                <div className="mt-3 p-3 bg-gray-800/50 rounded-lg space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Base Value</span>
                    <span className="text-green-400">{formatValue(photo.base_dollar_value || photo.dollar_value)}</span>
                  </div>
                  
                  {/* XP Meter Bar - Below Base Value */}
                  <div className="my-2 p-2 bg-gray-900/50 rounded-lg">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-purple-400 font-bold text-sm">🏆 Lv {photo.level || 1}</span>
                      <span className="text-gray-400 text-xs">{photo.xp || 0} / {photo.xp_progress?.xp_for_next_level || 10} XP</span>
                    </div>
                    <div className="h-3 bg-gray-700 rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                        style={{ width: `${Math.min(photo.xp_progress?.progress_percent || photo.xp_progress_percent || 0, 100)}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">
                        {Math.round(photo.xp_progress?.progress_percent || photo.xp_progress_percent || 0)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] mt-1">
                      <span className="text-gray-500">{photo.xp_progress?.remaining || 10} XP to Lv{(photo.level || 1) + 1}</span>
                      {(photo.level_bonus_percent > 0) && (
                        <span className="text-green-400">+{photo.level_bonus_percent}% boost</span>
                      )}
                    </div>
                  </div>
                  
                  {(photo.level_bonus_percent > 0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Level Bonus (+{photo.level_bonus_percent}%)</span>
                      <span className="text-purple-400">+{formatValue(Math.floor((photo.base_dollar_value || 0) * (photo.level_bonus_percent || 0) / 100))}</span>
                    </div>
                  )}
                  {(photo.monthly_growth_value > 0 || photo.age_bonus_value > 0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Age Bonus ({photo.age_days || 0} days)</span>
                      <span className="text-blue-400">+{formatValue(photo.age_bonus_value || photo.monthly_growth_value || 0)}</span>
                    </div>
                  )}
                  {(photo.star_bonus_value > 0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Star Bonus</span>
                      <span className="text-amber-400">+{formatValue(photo.star_bonus_value)}</span>
                    </div>
                  )}
                  {(photo.reaction_bonus_value > 0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Reaction Bonus</span>
                      <span className="text-pink-400">+{formatValue(photo.reaction_bonus_value)}</span>
                    </div>
                  )}
                  {(photo.total_upgrade_value > 0 || photo.bl_coins_spent > 0) && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">BL Coins Upgrades</span>
                      <span className="text-orange-400">+{formatValue(photo.total_upgrade_value || photo.bl_coins_spent || 0)}</span>
                    </div>
                  )}
                  {(photo.seniority_bonus_value > 0 || photo.seniority_achieved) && (
                    <div className="flex justify-between bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded px-1 py-0.5">
                      <span className="text-yellow-400 font-bold">✨ Seniority MAX</span>
                      <span className="text-yellow-400 font-bold">+{formatValue(photo.seniority_bonus_value || 0)}</span>
                    </div>
                  )}
                </div>
                
                {/* NEW STATS SECTION - Below Authenticity equivalent */}
                <div className="mt-3 p-3 bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-500/20">
                  <h4 className="text-xs font-bold text-gray-300 mb-2 flex items-center gap-1">
                    ✨ Photo Stats & Bonuses
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* Stars */}
                    <div className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1">
                      <span className="text-amber-400">⭐ Stars</span>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className={i < (photo.stars || 0) ? 'text-amber-400' : 'text-gray-600'}>★</span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Level */}
                    <div className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1">
                      <span className="text-purple-400">🏆 Level</span>
                      <span className="text-white font-bold">Lv {photo.level || 1}</span>
                    </div>
                    
                    {/* Age */}
                    <div className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1">
                      <span className="text-blue-400">📅 Age</span>
                      <span className="text-white">{photo.age_days || 0} days</span>
                    </div>
                    
                    {/* Reactions */}
                    <div className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1">
                      <span className="text-pink-400">❤️ Reactions</span>
                      <span className="text-white">{photo.total_reactions || photo.likes_count || 0}</span>
                    </div>
                    
                    {/* BL Coins */}
                    <div className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1">
                      <span className="text-yellow-400">🪙 BL Coins</span>
                      <span className="text-yellow-400">{(photo.bl_coins_spent || photo.total_upgrade_value || 0).toLocaleString()}</span>
                    </div>
                    
                    {/* Seniority */}
                    <div className={`flex items-center justify-between rounded px-2 py-1 ${
                      (photo.seniority_achieved || (photo.level || 1) >= 60) 
                        ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30' 
                        : 'bg-gray-800/50'
                    }`}>
                      <span className={`${(photo.seniority_achieved || (photo.level || 1) >= 60) ? 'text-yellow-400' : 'text-gray-400'}`}>⚡ Seniority</span>
                      {(photo.seniority_achieved || (photo.level || 1) >= 60) ? (
                        <span className="text-yellow-400 font-bold text-[10px]">✨ MAX</span>
                      ) : (
                        <span className="text-gray-500 text-[10px]">{Math.max(0, 60 - (photo.level || 1))} to max</span>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Reactions Counter */}
                <div className="mt-3 flex items-center justify-center gap-2 text-pink-400">
                  <span className="text-2xl">❤️</span>
                  <span className="font-bold text-lg">{photo.total_reactions || photo.likes_count || 0}</span>
                  <span className="text-gray-400 text-sm">reactions</span>
                </div>
              </div>
              
              {/* Action buttons - FIXED at bottom with safe area */}
              <div className="shrink-0 p-4 border-t border-gray-800 bg-gray-900"
                   style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
                {/* Row 1: Main actions */}
                <div className="flex gap-2 mb-2">
                  <Button
                    onClick={() => onSetProfilePic?.(photo)}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm py-3"
                  >
                    <User className="w-4 h-4 mr-1" />
                    Profile Pic
                  </Button>
                  <Button
                    onClick={() => setShowBack(false)}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm py-3"
                  >
                    <Swords className="w-4 h-4 mr-1" />
                    Auction
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm py-3"
                  >
                    <Share2 className="w-4 h-4 mr-1" />
                    Share
                  </Button>
                </div>
                
                {/* Row 2: Back to image */}
                <Button
                  onClick={() => setShowBack(false)}
                  variant="outline"
                  className="w-full border-purple-500 text-purple-400 hover:bg-purple-500/10 py-3"
                >
                  <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
                  Back to Image
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

// Scenery type colors and icons - include neutral
const SCENERY_CONFIG = {
  natural: { color: 'from-green-500 to-emerald-600', icon: '🌿', label: 'Natural' },
  water: { color: 'from-blue-500 to-cyan-600', icon: '🌊', label: 'Water' },
  manmade: { color: 'from-orange-500 to-red-600', icon: '🏙️', label: 'Man-made' },
  neutral: { color: 'from-gray-500 to-gray-600', icon: '⚪', label: 'Neutral' },
};

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return "$0";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value?.toLocaleString() || 0}`;
};

// Photo Card Component - Clean image display, compact stats below
const PhotoCard = ({ photo, onSelect, onUpdate, viewMode, onViewFull, onSelfieMatch, isNewlyMinted, onRemoveHighlight }) => {
  const [showMenu, setShowMenu] = useState(false);
  const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
  const stars = photo.stars || 0;
  const hasGoldenFrame = photo.has_golden_frame || false;
  const hasFaceDetected = photo.face_detected || false;
  const canDoSelfieMatch = hasFaceDetected && (photo.selfie_match_attempts || 0) < 3;
  
  // Handle click on newly minted photo - remove highlight
  const handlePhotoClick = () => {
    if (isNewlyMinted) {
      onRemoveHighlight?.();
    }
    onSelect?.(photo);
  };
  
  const handleRename = async () => {
    const newName = prompt('Enter new name:', photo.name);
    if (newName && newName !== photo.name) {
      try {
        await api.put(`/minting/photo/${photo.mint_id}/rename`, { new_name: newName });
        toast.success('Photo renamed!');
        onUpdate?.();
      } catch (err) {
        toast.error('Failed to rename photo');
      }
    }
  };
  
  const handlePrivacyToggle = async () => {
    try {
      await api.put(`/minting/photo/${photo.mint_id}/privacy`, {
        is_private: !photo.is_private,
        show_in_feed: photo.is_private, // Inverse
      });
      toast.success(photo.is_private ? 'Photo is now public' : 'Photo is now private');
      onUpdate?.();
    } catch (err) {
      toast.error('Failed to update privacy');
    }
  };
  
  if (viewMode === 'list') {
    return (
      <motion.div
        className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50 hover:border-purple-500/50 transition-all"
        whileHover={{ scale: 1.01 }}
        onClick={() => onSelect?.(photo)}
      >
        <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 ${hasGoldenFrame ? 'ring-2 ring-yellow-500' : ''}`}>
          {photo.image_url ? (
            <img 
              src={photo.image_url} 
              alt={photo.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${scenery.color}`} />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{photo.name}</h3>
            {/* Medal Display - 10 Win Streak */}
            {(photo.medals?.ten_win_streak > 0 || photo.ten_win_streak_medals > 0) && (
              <span 
                className="flex items-center gap-0.5 text-yellow-400 text-xs font-bold shrink-0"
                title={`${photo.medals?.ten_win_streak || photo.ten_win_streak_medals} x 10-Win Streak Medal(s)`}
              >
                🏅x{photo.medals?.ten_win_streak || photo.ten_win_streak_medals}
              </span>
            )}
            {photo.is_private ? (
              <Lock className="w-4 h-4 text-gray-500" />
            ) : (
              <Globe className="w-4 h-4 text-green-500" />
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <span>{scenery.icon}</span>
              {scenery.label}
            </span>
            <span className="text-yellow-500 font-bold">
              {formatDollarValue(photo.dollar_value)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-sm text-gray-400">Power</div>
            <div className="font-bold text-purple-400">{photo.power?.toFixed(0) || 100}</div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRename(); }}>
                <Edit2 className="w-4 h-4 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePrivacyToggle(); }}>
                {photo.is_private ? (
                  <><Globe className="w-4 h-4 mr-2" /> Make Public</>
                ) : (
                  <><Lock className="w-4 h-4 mr-2" /> Make Private</>
                )}
              </DropdownMenuItem>
              {canDoSelfieMatch && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSelfieMatch?.(photo); }}>
                  <Shield className="w-4 h-4 mr-2 text-purple-400" /> Selfie Verify
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
    );
  }
  
  // Grid view card - compact bottom section with only essential stats
  return (
    <motion.div
      className={`relative group cursor-pointer ${isNewlyMinted ? 'z-10' : ''}`}
      whileHover={{ scale: 1.02 }}
      onClick={handlePhotoClick}
    >
      {/* Glowing/Sparkling animation for newly minted photos */}
      {isNewlyMinted && (
        <>
          {/* Outer glow pulse */}
          <motion.div
            className="absolute -inset-1 rounded-xl bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 opacity-75 blur-md"
            animate={{
              opacity: [0.5, 0.9, 0.5],
              scale: [0.98, 1.02, 0.98],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          {/* Sparkle particles - fixed positions around corners */}
          {[
            { top: '10%', left: '10%' },
            { top: '10%', left: '90%' },
            { top: '90%', left: '10%' },
            { top: '90%', left: '90%' },
            { top: '50%', left: '5%' },
            { top: '50%', left: '95%' },
            { top: '5%', left: '50%' },
            { top: '95%', left: '50%' },
          ].map((pos, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-white rounded-full pointer-events-none"
              style={pos}
              animate={{
                scale: [0, 1.5, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </>
      )}
      
      {/* Card */}
      <div className={`relative bg-gray-800/80 rounded-xl overflow-hidden border ${
        isNewlyMinted 
          ? 'border-purple-400 ring-2 ring-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.5)]' 
          : hasGoldenFrame 
            ? 'border-yellow-500 ring-2 ring-yellow-500/50' 
            : 'border-gray-700/50 hover:border-purple-500/50'
      } transition-all`}>
        {/* NEW badge for newly minted */}
        {isNewlyMinted && (
          <div className="absolute top-2 right-2 z-20 px-2 py-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full text-xs font-bold text-white shadow-lg animate-bounce">
            ✨ NEW
          </div>
        )}
        {/* Image - Clean, no overlays */}
        <div className="relative aspect-square">
          {photo.image_url ? (
            <img 
              src={photo.image_url} 
              alt={photo.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${scenery.color}`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-6xl opacity-50">{scenery.icon}</span>
              </div>
            </div>
          )}
          
          {/* Stars indicator - below image line */}
          {stars > 0 && (
            <div className="absolute bottom-2 left-2 flex gap-0.5">
              {[...Array(stars)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
          )}
          
          {/* Hover overlay to view full image */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <Maximize2 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        
        {/* COMPACT BOTTOM SECTION - Mobile optimized */}
        <div className="p-2 space-y-1.5">
          {/* Name with Medals */}
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-white text-sm truncate">{photo.name}</h3>
            {/* Medal Display - 10 Win Streak */}
            {(photo.medals?.ten_win_streak > 0 || photo.ten_win_streak_medals > 0) && (
              <span 
                className="flex items-center gap-0.5 text-yellow-400 text-xs font-bold shrink-0"
                title={`${photo.medals?.ten_win_streak || photo.ten_win_streak_medals} x 10-Win Streak Medal(s)`}
              >
                🏅
                <span className="text-[10px]">
                  x{photo.medals?.ten_win_streak || photo.ten_win_streak_medals}
                </span>
              </span>
            )}
          </div>
          
          {/* Dollar Value (Power) + Interactive Like Button */}
          <div className="flex items-center justify-between">
            <span className="text-yellow-400 font-bold text-lg">
              {formatDollarValue(photo.dollar_value)}
            </span>
            {/* Interactive Like Button (❤️) */}
            <LikeButton 
              photoId={photo.mint_id}
              initialLikes={photo.total_reactions || photo.likes_count || 0}
              initialLiked={photo.user_liked || false}
              size="sm"
              showCount={true}
            />
          </div>
          
          {/* Level + Stars above Stamina */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-purple-400 font-bold">Lvl {photo.level || 1}</span>
              {/* Stars Display */}
              {(photo.stars > 0) && (
                <span className="text-yellow-400">
                  {'★'.repeat(photo.stars)}
                </span>
              )}
              {/* Golden Frame indicator */}
              {photo.has_golden_frame && (
                <span className="text-yellow-500" title="Golden Frame">🔶</span>
              )}
            </div>
            {/* Stamina as Battles Left */}
            <div className="flex items-center gap-1 text-green-400">
              <Zap className="w-3.5 h-3.5" />
              <span className="font-bold">{photo.current_stamina || Math.round((photo.stamina || 100) / 100 * 24)}/24</span>
            </div>
          </div>
          
          {/* Strength/Weakness - compact */}
          <div className="flex gap-1 text-xs flex-wrap">
            {photo.strength_vs && (
              <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                +{SCENERY_CONFIG[photo.strength_vs]?.label || 'Water'}
              </span>
            )}
            {photo.weakness_vs && photo.weakness_vs !== 'all' && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                -{SCENERY_CONFIG[photo.weakness_vs]?.label || 'Man-made'}
              </span>
            )}
            {photo.weakness_vs === 'all' && (
              <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                -All
              </span>
            )}
          </div>
          
          {/* Win/Loss record */}
          <div className="flex items-center text-xs text-gray-400">
            <Trophy className="w-3 h-3 mr-1" />
            {photo.battles_won || 0}W/{photo.battles_lost || 0}L
          </div>
          
          {/* ACTION BUTTONS - Auction (center-ish) and Share (right) - Pink/Purple style */}
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={(e) => { e.stopPropagation(); window.location.href = '/photo-game'; }}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-medium transition-all active:scale-95"
            >
              <Swords className="w-3.5 h-3.5" />
              Auction
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); /* Share logic */ toast.info('Share coming soon!'); }}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xs font-medium transition-all active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Mint Photo Dialog
const MintPhotoDialog = ({ isOpen, onClose, onMint, mintStatus, onMintSuccess }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mintCost, setMintCost] = useState(200); // Default 200 BL
  
  // Fetch mint config on dialog open
  useEffect(() => {
    if (isOpen) {
      api.get('/minting/config')
        .then(res => {
          if (res.data?.mint_cost_bl) {
            setMintCost(res.data.mint_cost_bl);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);
  
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image too large. Max 10MB.');
        return;
      }
      setSelectedFile(file);
      // Preserve original image quality - use createObjectURL instead of re-encoding
      setPreview(URL.createObjectURL(file));
    }
  };
  
  const handleSubmit = async () => {
    if (!selectedFile || !name) {
      toast.error('Please select an image and enter a name');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', name);
      formData.append('description', description);
      formData.append('is_private', isPrivate ? 'true' : 'false');
      formData.append('show_in_feed', isPrivate ? 'false' : 'true');
      
      onMint?.({
        photoUrl: preview,
        photoName: name,
      });
      
      console.log('Minting photo with FormData:', {
        name,
        description,
        is_private: isPrivate,
        file: selectedFile?.name,
        fileSize: selectedFile?.size,
        fileType: selectedFile?.type,
      });
      
      const response = await api.post('/minting/photo/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // 2 minute timeout for large files + AI analysis
      });
      
      if (response.data.success) {
        toast.success('Photo minted successfully!');
        // Call success callback with mint_id for highlighting
        onMintSuccess?.(response.data.mint_id || response.data.photo?.mint_id);
        onClose?.();
        // Reset form
        setName('');
        setDescription('');
        setSelectedFile(null);
        setPreview(null);
        setIsPrivate(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Minting failed');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Mint New Photo
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Mint status */}
          {mintStatus && (
            <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">BL Coins</span>
                <span className="text-yellow-400 font-bold">{mintStatus.bl_coins?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-400">Mints Today</span>
                <span className="text-white">{mintStatus.mints_today} / {mintStatus.daily_limit}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-400">Cost</span>
                <span className="text-purple-400 font-bold">{mintCost.toLocaleString()} BL</span>
              </div>
            </div>
          )}
          
          {/* Image upload */}
          <div>
            <Label className="text-gray-300">Photo</Label>
            <div 
              className="mt-2 border-2 border-dashed border-gray-700 rounded-xl p-4 text-center cursor-pointer hover:border-purple-500 transition-colors"
              onClick={() => document.getElementById('photo-upload').click()}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
              ) : (
                <div className="py-8">
                  <Upload className="w-10 h-10 mx-auto text-gray-500 mb-2" />
                  <p className="text-gray-400">Click to upload image</p>
                  <p className="text-xs text-gray-500 mt-1">Max 10MB • JPG, PNG, WebP</p>
                </div>
              )}
            </div>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          
          {/* Name */}
          <div>
            <Label className="text-gray-300">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Epic Photo"
              className="mt-1 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          
          {/* Description */}
          <div>
            <Label className="text-gray-300">Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A beautiful sunset..."
              className="mt-1 bg-gray-800 border-gray-700 text-white"
            />
          </div>
          
          {/* Privacy */}
          <div className="flex items-center justify-between">
            <Label className="text-gray-300">Private (won&apos;t show in feed)</Label>
            <button
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isPrivate ? 'bg-purple-600' : 'bg-gray-700'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                isPrivate ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>
          
          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedFile || !name || (mintStatus && !mintStatus.can_mint)}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {isSubmitting ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                Minting...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Mint Photo ({mintCost.toLocaleString()} BL)
              </>
            )}
          </Button>
          
          {mintStatus && !mintStatus.can_mint && (
            <p className="text-sm text-red-400 text-center">{mintStatus.reason}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Upgrade Dollar Value Modal Component
const UpgradeModal = ({ photo, isOpen, onClose, onSuccess, userBlCoins }) => {
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  
  // Upgrade tiers - $1M = 1M BL, etc.
  const UPGRADE_OPTIONS = [
    { amount: 1_000_000, cost: 1_000_000, label: '+$1M' },
    { amount: 2_000_000, cost: 2_000_000, label: '+$2M' },
    { amount: 5_000_000, cost: 5_000_000, label: '+$5M' },
    { amount: 10_000_000, cost: 10_000_000, label: '+$10M' },
    { amount: 50_000_000, cost: 50_000_000, label: '+$50M' },
    { amount: 100_000_000, cost: 100_000_000, label: '+$100M' },
    { amount: 500_000_000, cost: 500_000_000, label: '+$500M' },
    { amount: 1_000_000_000, cost: 1_000_000_000, label: '+$1B' },
  ];
  
  // Get purchased upgrades for this photo
  const purchasedUpgrades = photo?.upgrades_purchased || [];
  
  const handleUpgrade = async () => {
    if (!selectedUpgrade || !photo) return;
    
    setIsUpgrading(true);
    try {
      const response = await api.post(`/minting/photos/${photo.mint_id}/upgrade`, {
        upgrade_amount: selectedUpgrade.amount
      });
      
      if (response.data.success) {
        toast.success(`Upgraded! New value: ${formatValue(response.data.new_dollar_value)}`);
        onSuccess?.(response.data);
        onClose?.();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upgrade failed');
    } finally {
      setIsUpgrading(false);
    }
  };
  
  if (!photo) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="w-5 h-5 text-yellow-400" />
            Upgrade Dollar Value
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Photo preview */}
          <div className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg">
            <img 
              src={photo.thumbnail_url || photo.image_url} 
              alt={photo.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
            <div>
              <p className="text-white font-semibold">{photo.name}</p>
              <p className="text-gray-400 text-sm">
                Current Value: <span className="text-yellow-400">{formatValue(photo.dollar_value)}</span>
              </p>
            </div>
          </div>
          
          {/* User's BL Coin balance */}
          <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
            <span className="text-gray-400 flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-400" />
              Your BL Coins
            </span>
            <span className="text-yellow-400 font-bold">{(userBlCoins || 0).toLocaleString()} BL</span>
          </div>
          
          {/* Upgrade options */}
          <div className="space-y-2">
            <p className="text-gray-400 text-sm">Select upgrade amount:</p>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {UPGRADE_OPTIONS.map((option) => {
                const isPurchased = purchasedUpgrades.includes(option.amount);
                const canAfford = (userBlCoins || 0) >= option.cost;
                const isSelected = selectedUpgrade?.amount === option.amount;
                
                return (
                  <button
                    key={option.amount}
                    onClick={() => !isPurchased && canAfford && setSelectedUpgrade(option)}
                    disabled={isPurchased || !canAfford}
                    className={`p-3 rounded-lg border transition-all ${
                      isPurchased 
                        ? 'bg-gray-800/30 border-gray-700 text-gray-500 cursor-not-allowed' 
                        : isSelected
                          ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                          : canAfford
                            ? 'bg-gray-800/50 border-gray-700 hover:border-yellow-500/50 text-white cursor-pointer'
                            : 'bg-gray-800/30 border-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                    data-testid={`upgrade-option-${option.amount}`}
                  >
                    <div className="text-lg font-bold">{option.label}</div>
                    <div className="text-xs mt-1">
                      {isPurchased ? (
                        <span className="text-green-400">✓ Purchased</span>
                      ) : (
                        <span className={canAfford ? 'text-gray-400' : 'text-red-400'}>
                          {option.cost.toLocaleString()} BL
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Selected upgrade summary */}
          {selectedUpgrade && (
            <div className="p-3 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/30">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">After upgrade:</span>
                <span className="text-yellow-400 font-bold text-lg">
                  {formatValue((photo.dollar_value || 0) + selectedUpgrade.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1 text-sm">
                <span className="text-gray-400">Cost:</span>
                <span className="text-yellow-400">{selectedUpgrade.cost.toLocaleString()} BL</span>
              </div>
            </div>
          )}
          
          {/* Upgrade button */}
          <Button
            onClick={handleUpgrade}
            disabled={!selectedUpgrade || isUpgrading}
            className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black font-bold"
          >
            {isUpgrading ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                Upgrading...
              </>
            ) : selectedUpgrade ? (
              <>
                <TrendingUp className="w-4 h-4 mr-2" />
                Upgrade for {selectedUpgrade.cost.toLocaleString()} BL
              </>
            ) : (
              'Select an upgrade'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Main Component
const MintedPhotos = () => {
  const { user, setUser } = useContext(AuthContext);
  const { setHideNav } = useContext(NavContext);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Error state for Atlas queries
  // ALWAYS use Card View - Grid View is hidden from UI (code preserved)
  const [viewMode, setViewMode] = useState('card');
  const [mintDialogOpen, setMintDialogOpen] = useState(false);
  const [mintStatus, setMintStatus] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);  // For full image view
  const [upgradePhoto, setUpgradePhoto] = useState(null);    // For upgrade modal
  const [selfieMatchPhoto, setSelfieMatchPhoto] = useState(null); // For selfie match modal
  const [newlyMintedId, setNewlyMintedId] = useState(null); // Track newly minted photo for highlighting
  const [flippedCardId, setFlippedCardId] = useState(null); // Track which card is flipped (for nav hiding)
  
  const { isAnimating, startAnimation, handleComplete, MintAnimationComponent } = useMintAnimation();
  
  // Hide bottom nav when lightbox, selfie modal, upgrade modal is open, OR when a card is flipped
  useEffect(() => {
    const shouldHideNav = !!lightboxPhoto || !!selfieMatchPhoto || !!upgradePhoto || !!flippedCardId;
    setHideNav(shouldHideNav);
    return () => setHideNav(false);
  }, [lightboxPhoto, selfieMatchPhoto, upgradePhoto, flippedCardId, setHideNav]);
  
  // Handle card flip state change - track which card is flipped
  const handleCardFlipChange = useCallback((photoId, isFlipped) => {
    if (isFlipped) {
      setFlippedCardId(photoId);
    } else if (flippedCardId === photoId) {
      setFlippedCardId(null);
    }
  }, [flippedCardId]);
  
  // Handle selfie match success
  const handleSelfieMatchSuccess = (data) => {
    // Refresh photos to get updated authenticity scores
    fetchPhotos();
    fetchMintStatus();
    toast.success(`Authenticity updated! New total: ${data.total_authenticity}%`);
  };
  
  // Handle setting photo as profile picture
  const handleSetProfilePicture = async (photo) => {
    try {
      const response = await api.put('/users/me/profile-picture', { 
        image_url: photo.image_url,
        mint_id: photo.mint_id 
      });
      if (response.data) {
        toast.success('Profile picture updated!');
        // Update local user context with mint_id reference only (not the full base64)
        // The actual image will be fetched from the server when needed
        if (setUser && user) {
          setUser({ 
            ...user, 
            profile_picture_mint_id: photo.mint_id,
            profile_picture_stored: false // Flag to fetch from server
          });
        }
        setLightboxPhoto(null);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update profile picture');
    }
  };
  
  // Handle deleting a photo
  const handleDeletePhoto = async (photo) => {
    try {
      await api.delete(`/minting/photos/${photo.mint_id}`);
      toast.success('Photo permanently deleted');
      fetchPhotos(); // Refresh the list
    } catch (err) {
      toast.error(err.message || 'Failed to delete photo');
    }
  };
  
  const fetchPhotos = async () => {
    try {
      setError(null); // Clear previous errors
      const response = await api.get('/minting/photos');
      setPhotos(response.data.photos || []);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
      setError({
        title: 'Failed to load photos',
        message: err.response?.data?.detail || 'Unable to connect to database. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMintStatus = async () => {
    try {
      const response = await api.get('/minting/status');
      setMintStatus(response.data);
    } catch (err) {
      console.error('Failed to fetch mint status:', err);
      // Don't show error for mint status - it's secondary
    }
  };
  
  // Retry function for error state
  const handleRetry = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchPhotos();
    fetchMintStatus();
  }, []);
  
  // Initial load
  useEffect(() => {
    fetchPhotos();
    fetchMintStatus();
  }, []);
  
  // Real-time stat refresh polling (every 5 seconds)
  // Keeps stats updated after battles
  useEffect(() => {
    const POLL_INTERVAL = 5000; // 5 seconds
    
    const pollStats = async () => {
      try {
        // Silently refresh photos to get latest stats (XP, stamina, level, etc.)
        const response = await api.get('/minting/photos');
        const newPhotos = response.data.photos || [];
        
        // Only update if there are actual changes to avoid unnecessary re-renders
        setPhotos(prevPhotos => {
          // Quick check if any stats changed
          const hasChanges = newPhotos.some((newPhoto, index) => {
            const oldPhoto = prevPhotos[index];
            if (!oldPhoto) return true;
            return (
              newPhoto.xp !== oldPhoto.xp ||
              newPhoto.level !== oldPhoto.level ||
              newPhoto.stamina !== oldPhoto.stamina ||
              newPhoto.dollar_value !== oldPhoto.dollar_value ||
              newPhoto.wins !== oldPhoto.wins ||
              newPhoto.losses !== oldPhoto.losses
            );
          });
          
          return hasChanges ? newPhotos : prevPhotos;
        });
      } catch (err) {
        // Silently fail - don't spam errors for background polling
        console.debug('[StatPoll] Silent refresh failed:', err.message);
      }
    };
    
    // Start polling
    const pollInterval = setInterval(pollStats, POLL_INTERVAL);
    console.log('[MintedPhotos] Started real-time stat polling (every 5s)');
    
    return () => {
      clearInterval(pollInterval);
      console.log('[MintedPhotos] Stopped stat polling');
    };
  }, []);
  
  const handleMint = (data) => {
    startAnimation(data);
    // Refresh after animation
    setTimeout(() => {
      fetchPhotos();
      fetchMintStatus();
    }, 5000);
  };
  
  // Memoize expensive calculations
  const { totalValue, totalBattles } = useMemo(() => ({
    totalValue: photos.reduce((sum, p) => sum + (p.dollar_value || 0), 0),
    totalBattles: photos.reduce((sum, p) => sum + (p.battles_won || 0) + (p.battles_lost || 0), 0)
  }), [photos]);
  
  return (
    <div 
      className="minted-photos-scroll-container min-h-screen pb-24"
      data-testid="minted-photos-page"
      style={{ contain: 'layout style' }}
    >
      {/* Mint Animation Overlay */}
      {MintAnimationComponent}
      
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-b border-gray-700/50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-purple-400" />
                Minted Photos
              </h1>
              <p className="text-gray-400 mt-1">Your digital photo collectibles</p>
            </div>
            <Button
              onClick={() => setMintDialogOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Camera className="w-4 h-4 mr-2" />
              Mint New
            </Button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Image className="w-4 h-4" />
                <span className="text-sm">Total Photos</span>
              </div>
              <p className="text-2xl font-bold text-white">{photos.length}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Portfolio Value</span>
              </div>
              <p className="text-2xl font-bold text-yellow-400">{formatDollarValue(totalValue)}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Swords className="w-4 h-4" />
                <span className="text-sm">Battles</span>
              </div>
              <p className="text-2xl font-bold text-purple-400">{totalBattles}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <div className="flex items-center gap-2 text-gray-400 mb-1">
                <Coins className="w-4 h-4" />
                <span className="text-sm">Mints Today</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {mintStatus?.mints_today || 0}/{mintStatus?.daily_limit || 10}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Toolbar - GRID VIEW HIDDEN (code preserved but UI hidden) */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {/* 
              GRID VIEW BUTTONS HIDDEN - Per user request, only Card View is shown.
              Code preserved for potential future revival.
              
              <button onClick={() => setViewMode('grid')} ... />
              <button onClick={() => setViewMode('list')} ... />
            */}
            {/* Only Card View button shown (always active) */}
            <button
              className="p-2 rounded-lg transition-colors bg-purple-600 text-white"
              title="Card View"
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Photos */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Sparkles className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-20">
            <Camera className="w-16 h-16 mx-auto text-gray-600 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Minted Photos Yet</h3>
            <p className="text-gray-400 mb-6">Mint your first photo to start your collection!</p>
            <Button
              onClick={() => setMintDialogOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Mint Your First Photo
            </Button>
          </div>
        ) : viewMode === 'card' ? (
          // UNIFIED CARD VIEW - SCROLLING ENABLED
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-2">
              {photos.map(photo => (
                <div 
                  key={photo.mint_id}
                  className={cn(
                    "relative",
                    newlyMintedId === photo.mint_id && "animate-pulse ring-2 ring-yellow-400 rounded-xl",
                  )}
                  style={{ zIndex: flippedCardId === photo.mint_id ? 50 : 1 }}
                >
                  <UnifiedPhotoCard
                    photo={photo}
                    onClick={() => {
                      if (flippedCardId !== photo.mint_id) {
                        setLightboxPhoto(photo);
                      }
                    }}
                    showStats={true}
                    showStamina={true}
                    showFaceMatch={photo.has_face && !photo.selfie_match_completed}
                    onFaceMatchClick={setSelfieMatchPhoto}
                    onUpgradeClick={setUpgradePhoto}
                    onFlipStateChange={(isFlipped) => handleCardFlipChange(photo.mint_id, isFlipped)}
                    flipped={flippedCardId === photo.mint_id}
                    size="medium"
                  />
                </div>
              ))}
            </div>
          </>
        ) : null /* Grid and List views hidden - code preserved below but never rendered */ }
        
        {/* 
          GRID VIEW CODE PRESERVED BUT HIDDEN - Per user request
          Grid View and List View code kept for potential future revival
          but never rendered since viewMode is always 'card'
          
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map(photo => (
                <PhotoCard key={photo.mint_id} photo={photo} viewMode="grid" ... />
              ))}
            </div>
          )}
          
          {viewMode === 'list' && (
            <div className="space-y-3">
              {photos.map(photo => (
                <PhotoCard key={photo.mint_id} photo={photo} viewMode="list" ... />
              ))}
            </div>
          )}
        */}
      </div>
      
      {/* Full Image Lightbox Modal */}
      <ImageLightbox
        photo={lightboxPhoto}
        isOpen={!!lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        onSetProfilePic={handleSetProfilePicture}
        onDelete={handleDeletePhoto}
      />
      
      {/* Selfie Match Modal */}
      <SelfieMatchModal
        isOpen={!!selfieMatchPhoto}
        onClose={() => setSelfieMatchPhoto(null)}
        photo={selfieMatchPhoto}
        onSuccess={handleSelfieMatchSuccess}
        userBalance={mintStatus?.bl_coins || 0}
      />
      
      {/* Upgrade Dollar Value Modal */}
      <UpgradeModal
        photo={upgradePhoto}
        isOpen={!!upgradePhoto}
        onClose={() => setUpgradePhoto(null)}
        onSuccess={() => {
          fetchPhotos();
          fetchMintStatus();
        }}
        userBlCoins={user?.bl_coins || mintStatus?.bl_coins || 0}
      />
      
      {/* Mint Dialog */}
      <MintPhotoDialog
        isOpen={mintDialogOpen}
        onClose={() => setMintDialogOpen(false)}
        onMint={handleMint}
        mintStatus={mintStatus}
        onMintSuccess={(mintId) => {
          // Auto-refresh photos and highlight the new one
          setNewlyMintedId(mintId);
          fetchPhotos();
          fetchMintStatus();
        }}
      />
    </div>
  );
};

export default MintedPhotos;
