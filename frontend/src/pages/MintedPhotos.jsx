import React, { useState, useEffect, useCallback, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Sparkles, Upload, Image, Coins, Trophy, 
  Zap, Lock, Globe, FolderPlus, MoreVertical,
  Edit2, Trash2, Share2, Eye, EyeOff, Grid, List,
  ChevronRight, Star, Swords, TrendingUp, X, User, Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { AuthContext } from '../App';
import { MintAnimation, useMintAnimation } from '../components/MintAnimation';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

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
const ImageLightbox = ({ photo, isOpen, onClose, onSetProfilePic, onDelete }) => {
  const [showControls, setShowControls] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  
  if (!isOpen || !photo) return null;
  
  const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
  const ratings = photo.ratings || {};
  const categoryValues = photo.category_values || {};
  
  // Calculate star display
  const stars = photo.stars || 0;
  const hasGoldenFrame = photo.has_golden_frame || false;
  
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
        className="fixed inset-0 z-50 bg-black"
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
              
              {/* Bottom bar - FIXED at absolute bottom with safe area - ALWAYS VISIBLE AREA */}
              <AnimatePresence>
                {showControls && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="absolute bottom-0 left-0 right-0 z-20 bg-black/70 backdrop-blur-sm px-6 py-4"
                    style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
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
                        onClick={(e) => { e.stopPropagation(); setShowBack(true); setShowControls(false); }}
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
              
              {/* Rating categories - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
const PhotoCard = ({ photo, onSelect, onUpdate, viewMode, onViewFull }) => {
  const [showMenu, setShowMenu] = useState(false);
  const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
  const stars = photo.stars || 0;
  const hasGoldenFrame = photo.has_golden_frame || false;
  
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
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>
    );
  }
  
  // Grid view card - compact bottom section with only essential stats
  return (
    <motion.div
      className="relative group cursor-pointer"
      whileHover={{ scale: 1.02 }}
      onClick={() => onSelect?.(photo)}
    >
      {/* Card */}
      <div className={`bg-gray-800/80 rounded-xl overflow-hidden border ${hasGoldenFrame ? 'border-yellow-500 ring-2 ring-yellow-500/50' : 'border-gray-700/50 hover:border-purple-500/50'} transition-all`}>
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
          {/* Name */}
          <h3 className="font-semibold text-white text-sm truncate">{photo.name}</h3>
          
          {/* Dollar Value (Power) */}
          <div className="text-yellow-400 font-bold text-lg">
            {formatDollarValue(photo.dollar_value)}
          </div>
          
          {/* Level above Stamina */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-purple-400 font-bold">Lvl {photo.level || 1}</span>
            </div>
            <div className="flex items-center gap-1 text-green-400">
              <Zap className="w-3.5 h-3.5" />
              <span className="font-bold">{Math.round(photo.stamina || 100)}%</span>
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
const MintPhotoDialog = ({ isOpen, onClose, onMint, mintStatus }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image too large. Max 10MB.');
        return;
      }
      setSelectedFile(file);
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
                <span className="text-purple-400 font-bold">500 BL</span>
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
            <Label className="text-gray-300">Private (won't show in feed)</Label>
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
                Mint Photo (500 BL)
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

// Main Component
const MintedPhotos = () => {
  const { user, setUser } = useContext(AuthContext);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [mintDialogOpen, setMintDialogOpen] = useState(false);
  const [mintStatus, setMintStatus] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);  // For full image view
  
  const { isAnimating, startAnimation, handleComplete, MintAnimationComponent } = useMintAnimation();
  
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
      const response = await api.get('/minting/photos');
      setPhotos(response.data.photos || []);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
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
    }
  };
  
  useEffect(() => {
    fetchPhotos();
    fetchMintStatus();
  }, []);
  
  const handleMint = (data) => {
    startAnimation(data);
    // Refresh after animation
    setTimeout(() => {
      fetchPhotos();
      fetchMintStatus();
    }, 5000);
  };
  
  const totalValue = photos.reduce((sum, p) => sum + (p.dollar_value || 0), 0);
  const totalBattles = photos.reduce((sum, p) => sum + (p.battles_won || 0) + (p.battles_lost || 0), 0);
  
  return (
    <div className="min-h-screen bg-gray-900 pb-24">
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
                {mintStatus?.mints_today || 0}/{mintStatus?.daily_limit || 3}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${
                viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <List className="w-5 h-5" />
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
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map(photo => (
              <PhotoCard
                key={photo.mint_id}
                photo={photo}
                viewMode="grid"
                onSelect={() => setLightboxPhoto(photo)}
                onUpdate={fetchPhotos}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {photos.map(photo => (
              <PhotoCard
                key={photo.mint_id}
                photo={photo}
                viewMode="list"
                onSelect={() => setLightboxPhoto(photo)}
                onUpdate={fetchPhotos}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Full Image Lightbox Modal */}
      <ImageLightbox
        photo={lightboxPhoto}
        isOpen={!!lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
        onSetProfilePic={handleSetProfilePicture}
        onDelete={handleDeletePhoto}
      />
      
      {/* Mint Dialog */}
      <MintPhotoDialog
        isOpen={mintDialogOpen}
        onClose={() => setMintDialogOpen(false)}
        onMint={handleMint}
        mintStatus={mintStatus}
      />
    </div>
  );
};

export default MintedPhotos;
