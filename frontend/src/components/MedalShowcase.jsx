/**
 * MedalShowcase Component
 * 
 * Displays a user's decorated photos with medals on their profile.
 * Owner can choose which photos to feature in the showcase.
 * Shows medal count and win streak progress.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Star, Settings, ChevronRight, Loader2, 
  Eye, EyeOff, Plus, X, Check, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import api from '../services/api';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Medal Photo Card
const MedalPhotoCard = ({ photo, showStats = true, size = 'md', onClick }) => {
  const sizeClasses = {
    sm: 'w-20 h-28',
    md: 'w-28 h-40',
    lg: 'w-36 h-48',
  };
  
  const medalCount = photo?.medals?.ten_win_streak || 0;
  const winStreak = photo?.win_streak || 0;
  const progressToNext = winStreak % 10;
  
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`relative ${sizeClasses[size]} rounded-xl overflow-hidden border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/20`}
    >
      <img 
        src={photo?.image_url} 
        alt={photo?.name}
        className="w-full h-full object-cover"
      />
      
      {/* Medal Badge */}
      {medalCount > 0 && (
        <div className="absolute top-1 right-1 bg-gradient-to-r from-yellow-600 to-amber-500 rounded-full px-2 py-0.5 flex items-center gap-1">
          <span className="text-sm">🏅</span>
          <span className="text-white font-bold text-xs">x{medalCount}</span>
        </div>
      )}
      
      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-2">
        <p className="text-white font-bold text-xs truncate">{photo?.name}</p>
        {showStats && (
          <div className="flex items-center gap-1 mt-1">
            <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-yellow-500"
                style={{ width: `${progressToNext * 10}%` }}
              />
            </div>
            <span className="text-yellow-400 text-[10px]">{progressToNext}/10</span>
          </div>
        )}
      </div>
    </motion.button>
  );
};

// Showcase Settings Modal
const ShowcaseSettingsModal = ({ isOpen, onClose, userId, currentShowcase, onSave }) => {
  const [allPhotos, setAllPhotos] = useState([]);
  const [selectedIds, setSelectedIds] = useState(currentShowcase || []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      fetchPhotosWithMedals();
      setSelectedIds(currentShowcase || []);
    }
  }, [isOpen, currentShowcase]);
  
  const fetchPhotosWithMedals = async () => {
    try {
      setLoading(true);
      const res = await api.get('/photo-game/battle-photos');
      // Filter to only photos with medals
      const photosWithMedals = (res.data.photos || []).filter(
        p => (p.medals?.ten_win_streak || 0) > 0
      );
      setAllPhotos(photosWithMedals);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const togglePhoto = (mintId) => {
    if (selectedIds.includes(mintId)) {
      setSelectedIds(selectedIds.filter(id => id !== mintId));
    } else if (selectedIds.length < 5) {
      setSelectedIds([...selectedIds, mintId]);
    } else {
      toast.error('Maximum 5 photos in showcase');
    }
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE_URL}/api/users/me/medal-showcase`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ showcase_photo_ids: selectedIds })
      });
      
      if (response.ok) {
        toast.success('Showcase updated!');
        onSave(selectedIds);
        onClose();
      } else {
        const data = await response.json();
        toast.error(data.detail || 'Failed to update showcase');
      }
    } catch (err) {
      toast.error('Failed to update showcase');
    } finally {
      setSaving(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg max-h-[80vh] bg-gray-900 rounded-2xl overflow-hidden border border-gray-700"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Edit Medal Showcase
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Instructions */}
        <div className="px-4 py-2 bg-yellow-500/10 text-yellow-400 text-sm">
          Select up to 5 photos to feature in your showcase ({selectedIds.length}/5 selected)
        </div>
        
        {/* Photo Grid */}
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          ) : allPhotos.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No photos with medals yet</p>
              <p className="text-gray-500 text-sm">Win 10 rounds without losing to earn your first medal!</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {allPhotos.map((photo) => (
                <button
                  key={photo.mint_id}
                  onClick={() => togglePhoto(photo.mint_id)}
                  className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all ${
                    selectedIds.includes(photo.mint_id)
                      ? 'border-yellow-500 ring-2 ring-yellow-500/50'
                      : 'border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <img 
                    src={photo.image_url} 
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                  {selectedIds.includes(photo.mint_id) && (
                    <div className="absolute inset-0 bg-yellow-500/30 flex items-center justify-center">
                      <Check className="w-8 h-8 text-white" />
                    </div>
                  )}
                  <div className="absolute top-1 right-1 bg-black/70 rounded-full px-1.5 py-0.5 text-xs">
                    🏅x{photo.medals?.ten_win_streak || 0}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1">
                    <p className="text-white text-xs truncate">{photo.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-gray-600"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-yellow-600 hover:bg-yellow-500"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save Showcase
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Main Medal Showcase Component
export const MedalShowcase = ({ userId, isOwnProfile = false }) => {
  const [showcasePhotos, setShowcasePhotos] = useState([]);
  const [allMedalPhotos, setAllMedalPhotos] = useState([]);
  const [showcaseIds, setShowcaseIds] = useState([]);
  const [totalMedals, setTotalMedals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  
  const fetchShowcase = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch user's showcase settings
      const token = localStorage.getItem('blendlink_token');
      const showcaseRes = await fetch(`${API_BASE_URL}/api/users/${userId}/medal-showcase`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      if (showcaseRes.ok) {
        const data = await showcaseRes.json();
        setShowcaseIds(data.showcase_photo_ids || []);
        setShowcasePhotos(data.showcase_photos || []);
        setAllMedalPhotos(data.all_medal_photos || []);
        setTotalMedals(data.total_medals || 0);
      }
    } catch (err) {
      console.error('Failed to fetch showcase:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);
  
  useEffect(() => {
    if (userId) {
      fetchShowcase();
    }
  }, [userId, fetchShowcase]);
  
  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
      </div>
    );
  }
  
  // Don't show if no medals
  if (totalMedals === 0 && !isOwnProfile) {
    return null;
  }
  
  return (
    <div className="bg-gradient-to-r from-yellow-900/20 via-amber-900/20 to-orange-900/20 rounded-2xl p-4 border border-yellow-500/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Medal Showcase</h3>
          {totalMedals > 0 && (
            <span className="px-2 py-0.5 bg-yellow-500 text-black text-sm font-bold rounded-full">
              🏅 {totalMedals} total
            </span>
          )}
        </div>
        
        {isOwnProfile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="text-yellow-400 hover:text-yellow-300"
          >
            <Settings className="w-4 h-4 mr-1" />
            Edit
          </Button>
        )}
      </div>
      
      {/* Showcase Photos */}
      {showcasePhotos.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {showcasePhotos.map((photo) => (
            <MedalPhotoCard key={photo.mint_id} photo={photo} size="md" />
          ))}
        </div>
      ) : totalMedals > 0 ? (
        <div className="text-center py-6">
          <Sparkles className="w-10 h-10 text-yellow-500/50 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">
            {isOwnProfile 
              ? 'Select photos to feature in your showcase!' 
              : 'No photos featured in showcase yet'
            }
          </p>
          {isOwnProfile && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="mt-3 border-yellow-500/50 text-yellow-400"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Photos
            </Button>
          )}
        </div>
      ) : (
        <div className="text-center py-6">
          <Trophy className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400 text-sm">No medals earned yet</p>
          <p className="text-gray-500 text-xs">Win 10 consecutive rounds to earn your first medal!</p>
        </div>
      )}
      
      {/* All Medal Photos (expandable) */}
      {allMedalPhotos.length > showcasePhotos.length && (
        <div className="mt-4">
          <button
            onClick={() => setShowAllPhotos(!showAllPhotos)}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm"
          >
            {showAllPhotos ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showAllPhotos ? 'Hide' : 'Show'} all {allMedalPhotos.length} photos with medals
            <ChevronRight className={`w-4 h-4 transition-transform ${showAllPhotos ? 'rotate-90' : ''}`} />
          </button>
          
          <AnimatePresence>
            {showAllPhotos && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 grid grid-cols-4 sm:grid-cols-5 gap-2"
              >
                {allMedalPhotos.map((photo) => (
                  <MedalPhotoCard key={photo.mint_id} photo={photo} size="sm" showStats={false} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      
      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <ShowcaseSettingsModal
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            userId={userId}
            currentShowcase={showcaseIds}
            onSave={(newIds) => {
              setShowcaseIds(newIds);
              fetchShowcase();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MedalShowcase;
