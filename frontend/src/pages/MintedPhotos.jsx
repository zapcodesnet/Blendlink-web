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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black"
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
              className="relative w-full h-full flex items-center justify-center"
              onClick={handleImageTap}
            >
              {/* Full-size image - absolutely clean, no overlays */}
              {photo.image_url ? (
                <img 
                  src={photo.image_url} 
                  alt={photo.name}
                  className={`max-w-full max-h-full object-contain ${hasGoldenFrame ? 'ring-4 ring-yellow-500' : ''}`}
                />
              ) : (
                <div className={`w-96 h-96 bg-gradient-to-br ${scenery.color} flex items-center justify-center rounded-xl`}>
                  <span className="text-9xl opacity-50">{scenery.icon}</span>
                </div>
              )}
              
              {/* Controls - only show on tap */}
              <AnimatePresence>
                {showControls && (
                  <>
                    {/* Top bar - stars */}
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="absolute top-0 left-0 right-0 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center gap-1"
                    >
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`w-6 h-6 ${i < stars ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} 
                        />
                      ))}
                      {hasGoldenFrame && <span className="ml-2 text-yellow-400 text-sm font-bold">MAX LEVEL</span>}
                    </motion.div>
                    
                    {/* Bottom bar */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-between"
                    >
                      {/* Left: Delete */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                        className="p-3 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors"
                      >
                        <Trash2 className="w-6 h-6 text-red-400" />
                      </button>
                      
                      {/* Center: Flip to back */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowBack(true); setShowControls(false); }}
                        className="p-3 rounded-full bg-purple-500/20 hover:bg-purple-500/40 transition-colors"
                      >
                        <ChevronRight className="w-6 h-6 text-purple-400" />
                      </button>
                      
                      {/* Right: Close */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="p-3 rounded-full bg-gray-500/20 hover:bg-gray-500/40 transition-colors"
                      >
                        <X className="w-6 h-6 text-white" />
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
              
              {/* Delete confirmation dialog */}
              <AnimatePresence>
                {confirmDelete && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-gray-900 rounded-xl p-6 max-w-sm mx-4 text-center">
                      <p className="text-white text-lg mb-4">This will delete the minted photo forever</p>
                      <div className="flex gap-3 justify-center">
                        <Button
                          onClick={() => setConfirmDelete(false)}
                          variant="outline"
                          className="border-gray-600"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleDelete}
                          className="bg-red-600 hover:bg-red-700"
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
            /* BACK: Rating stats view */
            <motion.div
              key="back"
              initial={{ rotateY: -180 }}
              animate={{ rotateY: 0 }}
              exit={{ rotateY: 180 }}
              transition={{ duration: 0.4 }}
              className="relative w-full max-w-lg mx-4 bg-gray-900 rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 flex items-center justify-between">
                <h3 className="text-white font-bold text-lg">{photo.name} - Stats</h3>
                <button
                  onClick={() => setShowBack(false)}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-white rotate-180" />
                </button>
              </div>
              
              {/* Rating categories */}
              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {Object.entries(RATING_LABELS).map(([key, label]) => {
                  const score = ratings[key] || 0;
                  const value = categoryValues[key] || 0;
                  return (
                    <div key={key} className="flex items-center justify-between py-2 border-b border-gray-800">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-300 font-medium">{label}</span>
                        <span className="text-purple-400 font-bold">{score}%</span>
                      </div>
                      <span className="text-yellow-400 font-bold">{formatValue(value)}</span>
                    </div>
                  );
                })}
                
                {/* Total */}
                <div className="flex items-center justify-between py-3 mt-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg px-3">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold">Total Core Power</span>
                    <span className="text-purple-400 font-bold">{photo.overall_score?.toFixed(0) || 0}%</span>
                  </div>
                  <span className="text-yellow-400 font-bold text-xl">{formatValue(photo.dollar_value)}</span>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="p-4 border-t border-gray-800 flex flex-wrap gap-2">
                <Button
                  onClick={() => onSetProfilePic?.(photo)}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  <User className="w-4 h-4 mr-2" />
                  Profile Pic
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-gray-600"
                  onClick={() => setShowBack(false)}
                >
                  <Swords className="w-4 h-4 mr-2" />
                  Auction
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-gray-600"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
              
              {/* Close */}
              <div className="p-4 border-t border-gray-800">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="w-full border-gray-600"
                >
                  <X className="w-4 h-4 mr-2" />
                  Close
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};
                {photo.is_private ? (
                  <span className="flex items-center gap-1 text-gray-400 text-sm">
                    <Lock className="w-4 h-4" /> Private
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-green-400 text-sm">
                    <Globe className="w-4 h-4" /> Public
                  </span>
                )}
              </div>
            </div>
            
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Dollar Value</p>
                <p className="text-xl font-bold text-yellow-400">{formatDollarValue(photo.dollar_value)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Type</p>
                <p className={`text-lg font-bold bg-gradient-to-r ${scenery.color} bg-clip-text text-transparent`}>
                  {scenery.label}
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Power</p>
                <p className="text-xl font-bold text-purple-400">{photo.power?.toFixed(0) || 100}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Level</p>
                <p className="text-xl font-bold text-white">{photo.level || 1}</p>
              </div>
            </div>
            
            {/* Strength/Weakness */}
            <div className="flex flex-wrap gap-3">
              <span className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-sm font-medium">
                +25% vs {SCENERY_CONFIG[photo.strength_vs]?.label || 'Water'}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium">
                -25% vs {SCENERY_CONFIG[photo.weakness_vs]?.label || 'Man-made'}
              </span>
            </div>
            
            {/* Battle stats */}
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Trophy className="w-4 h-4" />
                {photo.battles_won || 0}W / {photo.battles_lost || 0}L
              </span>
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={() => onSetProfilePic?.(photo)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <User className="w-4 h-4 mr-2" />
                Use as Profile Picture
              </Button>
              <Button variant="outline" className="border-gray-600">
                <Swords className="w-4 h-4 mr-2" />
                Battle
              </Button>
              <Button variant="outline" className="border-gray-600">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Scenery type colors and icons
const SCENERY_CONFIG = {
  natural: { color: 'from-green-500 to-emerald-600', icon: '🌿', label: 'Natural' },
  water: { color: 'from-blue-500 to-cyan-600', icon: '🌊', label: 'Water' },
  manmade: { color: 'from-orange-500 to-red-600', icon: '🏙️', label: 'Man-made' },
};

// Format dollar value
const formatDollarValue = (value) => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
};

// Photo Card Component - Clean image display, all stats below
const PhotoCard = ({ photo, onSelect, onUpdate, viewMode, onViewFull }) => {
  const [showMenu, setShowMenu] = useState(false);
  const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
  
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
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
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
  
  return (
    <motion.div
      className="relative group cursor-pointer"
      whileHover={{ scale: 1.02 }}
      onClick={() => onSelect?.(photo)}
    >
      {/* Card */}
      <div className="bg-gray-800/80 rounded-2xl overflow-hidden border border-gray-700/50 hover:border-purple-500/50 transition-all">
        {/* Image */}
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
          
          {/* Click to view full image icon - only shows on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <Maximize2 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        
        {/* ALL INFO BELOW THE IMAGE - Clean, no overlays on photo */}
        <div className="p-3 space-y-2">
          {/* Name and privacy */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white truncate flex-1">{photo.name}</h3>
            {photo.is_private ? (
              <Lock className="w-4 h-4 text-gray-500 ml-2" />
            ) : (
              <Globe className="w-4 h-4 text-green-500 ml-2" />
            )}
          </div>
          
          {/* Dollar value and type */}
          <div className="flex items-center justify-between">
            <span className="text-yellow-400 font-bold text-lg">
              {formatDollarValue(photo.dollar_value)}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r ${scenery.color} text-white`}>
              {scenery.label}
            </span>
          </div>
          
          {/* Power and Level */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-purple-400">
              <Zap className="w-4 h-4" />
              <span className="font-bold">{photo.power?.toFixed(0) || 100}</span>
            </div>
            <span className="text-gray-400">Lvl {photo.level || 1}</span>
            <span className="flex items-center gap-1 text-gray-400">
              <Trophy className="w-3 h-3" />
              {photo.battles_won || 0}W/{photo.battles_lost || 0}L
            </span>
          </div>
          
          {/* Strength/Weakness */}
          <div className="flex gap-2 text-xs flex-wrap">
            <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-400">
              +25% {SCENERY_CONFIG[photo.strength_vs]?.label || 'Water'}
            </span>
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400">
              -25% {SCENERY_CONFIG[photo.weakness_vs]?.label || 'Man-made'}
            </span>
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
