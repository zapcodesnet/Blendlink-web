/**
 * BattleReplayViewer Component
 * 
 * Plays back bot battle replays with:
 * - Round-by-round animation
 * - Tap counts and dollar values
 * - Win/loss effects
 * - Video recording for social sharing
 * - Quick share to blendlink.net/feed
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipForward, SkipBack, Share2, Download,
  Trophy, Skull, Clock, Eye, Heart, MessageCircle,
  Twitter, Facebook, Link2, Check, Loader2, X
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import api from '../../api';

// Scenery config
const SCENERY_CONFIG = {
  water: { emoji: '🌊', label: 'Water', color: 'from-blue-500 to-cyan-500' },
  natural: { emoji: '🌿', label: 'Natural', color: 'from-green-500 to-emerald-500' },
  man_made: { emoji: '🏙️', label: 'Man-made', color: 'from-gray-500 to-slate-500' },
  neutral: { emoji: '⚪', label: 'Neutral', color: 'from-gray-400 to-gray-500' },
};

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
};

// Photo Card for replay
const ReplayPhotoCard = ({ photo, isPlayer, effectiveValue, taps, progress, isWinner }) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.neutral;
  
  return (
    <motion.div 
      className={`relative rounded-xl overflow-hidden border-2 ${
        isWinner 
          ? 'border-green-500 shadow-lg shadow-green-500/50' 
          : 'border-gray-600'
      } ${isPlayer ? 'bg-purple-900/30' : 'bg-red-900/30'}`}
      animate={isWinner ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.5 }}
    >
      {/* Winner badge */}
      {isWinner && (
        <div className="absolute top-2 right-2 z-20 bg-green-500 rounded-full p-1">
          <Trophy className="w-4 h-4 text-white" />
        </div>
      )}
      
      {/* Photo */}
      <div className="relative aspect-square w-28 sm:w-36">
        {photo?.image_url ? (
          <img 
            src={photo.image_url} 
            alt={photo.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
            <span className="text-4xl opacity-50">{scenery.emoji}</span>
          </div>
        )}
        
        {/* Level badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 rounded text-xs">
          <span className="text-yellow-400 font-bold">Lv{photo?.level || 1}</span>
        </div>
      </div>
      
      {/* Stats */}
      <div className="p-2 space-y-1">
        <p className="text-xs text-white font-semibold truncate">{photo?.name || 'Photo'}</p>
        
        {/* Dollar value */}
        <div className="text-center py-1 bg-yellow-500/20 rounded">
          <span className="text-lg font-bold text-yellow-400">{formatDollarValue(effectiveValue)}</span>
        </div>
        
        {/* Progress bar */}
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <motion.div 
            className={`h-full ${isPlayer ? 'bg-purple-500' : 'bg-red-500'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        
        {/* Taps */}
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Taps:</span>
          <span className="text-white font-bold">{taps}</span>
        </div>
      </div>
    </motion.div>
  );
};

// RPS Display
const RPSDisplay = ({ playerChoice, opponentChoice, winner }) => {
  const RPS_EMOJIS = { rock: '🪨', paper: '📄', scissors: '✂️' };
  
  return (
    <div className="flex items-center justify-center gap-8 py-4">
      <div className={`text-center ${winner === 'player' ? 'ring-2 ring-green-500 rounded-xl p-2' : ''}`}>
        <p className="text-xs text-purple-400 mb-1">You</p>
        <span className="text-5xl">{RPS_EMOJIS[playerChoice] || '❓'}</span>
      </div>
      <span className="text-2xl text-gray-500">VS</span>
      <div className={`text-center ${winner === 'opponent' ? 'ring-2 ring-green-500 rounded-xl p-2' : ''}`}>
        <p className="text-xs text-red-400 mb-1">Bot</p>
        <span className="text-5xl">{RPS_EMOJIS[opponentChoice] || '❓'}</span>
      </div>
    </div>
  );
};

// Share Modal
const ShareModal = ({ isOpen, onClose, replayId, replayData, onShareToFeed }) => {
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const shareUrl = `${window.location.origin}/replay/${replayId}`;
  
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };
  
  const shareToTwitter = () => {
    const text = `🎮 I ${replayData?.winner === 'player' ? 'WON' : 'battled'} against ${replayData?.difficulty} Bot! Score: ${replayData?.final_score_player}-${replayData?.final_score_opponent} 🏆`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };
  
  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };
  
  const handleShareToFeed = async () => {
    setIsSharing(true);
    try {
      await onShareToFeed();
      toast.success('🎉 Shared to Blendlink Feed!');
    } catch (err) {
      toast.error('Failed to share to feed');
    } finally {
      setIsSharing(false);
    }
  };
  
  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Bot Battle Replay - ${replayData?.winner === 'player' ? 'Victory!' : 'Battle'}`,
          text: `Check out my bot battle! Score: ${replayData?.final_score_player}-${replayData?.final_score_opponent}`,
          url: shareUrl
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          toast.error('Failed to share');
        }
      }
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-gray-900 rounded-2xl p-6 max-w-md w-full border border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-purple-400" />
            Share Replay
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* Quick Share to Blendlink Feed */}
        <Button
          onClick={handleShareToFeed}
          disabled={isSharing}
          className="w-full mb-4 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
        >
          {isSharing ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <span className="text-xl mr-2">🚀</span>
          )}
          Quick Share to Blendlink Feed
        </Button>
        
        {/* Social buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Button
            onClick={shareToTwitter}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Twitter className="w-4 h-4 text-blue-400" />
            Twitter/X
          </Button>
          <Button
            onClick={shareToFacebook}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Facebook className="w-4 h-4 text-blue-600" />
            Facebook
          </Button>
        </div>
        
        {/* Native share */}
        {typeof navigator !== 'undefined' && navigator.share && (
          <Button
            onClick={shareNative}
            variant="outline"
            className="w-full mb-4"
          >
            <Share2 className="w-4 h-4 mr-2" />
            More Options...
          </Button>
        )}
        
        {/* Copy link */}
        <div className="flex gap-2">
          <input
            type="text"
            value={shareUrl}
            readOnly
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300"
          />
          <Button onClick={copyLink} variant="outline">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Link2 className="w-4 h-4" />}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Main Replay Viewer Component
export const BattleReplayViewer = ({ 
  replay, 
  isModal = false, 
  onClose,
  autoPlay = false 
}) => {
  const [currentRound, setCurrentRound] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  
  const rounds = replay?.rounds || [];
  const totalRounds = rounds.length;
  const currentRoundData = rounds[currentRound];
  
  // Auto-play through rounds
  useEffect(() => {
    if (!isPlaying || currentRound >= totalRounds - 1) return;
    
    const duration = (currentRoundData?.duration_ms || 3000) / playbackSpeed;
    const timer = setTimeout(() => {
      setCurrentRound(prev => Math.min(prev + 1, totalRounds - 1));
    }, duration);
    
    return () => clearTimeout(timer);
  }, [isPlaying, currentRound, totalRounds, currentRoundData, playbackSpeed]);
  
  // Stop playing at the end
  useEffect(() => {
    if (currentRound >= totalRounds - 1) {
      setIsPlaying(false);
    }
  }, [currentRound, totalRounds]);
  
  const handlePlayPause = () => setIsPlaying(!isPlaying);
  
  const handlePrevRound = () => {
    setCurrentRound(prev => Math.max(prev - 1, 0));
    setIsPlaying(false);
  };
  
  const handleNextRound = () => {
    setCurrentRound(prev => Math.min(prev + 1, totalRounds - 1));
    setIsPlaying(false);
  };
  
  const handleSpeedChange = () => {
    const speeds = [0.5, 1, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    setPlaybackSpeed(speeds[(currentIndex + 1) % speeds.length]);
  };
  
  // Share to feed
  const handleShareToFeed = async () => {
    try {
      const response = await api.post(`/photo-game/battle-replay/${replay.replay_id}/share-to-feed`);
      return response.data;
    } catch (err) {
      throw err;
    }
  };
  
  // Download options - now with backend-generated exports
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  
  // Download summary image (PNG)
  const handleDownloadImage = async () => {
    setIsRecording(true);
    toast.info('Generating image...');
    
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/photo-game/battle-replay/${replay.replay_id}/export-video?quality=high`,
        { method: 'GET' }
      );
      
      if (!response.ok) throw new Error('Failed to generate image');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `battle_replay_${replay.replay_id}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Battle summary downloaded!');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download image');
    } finally {
      setIsRecording(false);
      setShowDownloadOptions(false);
    }
  };
  
  // Download animated GIF
  const handleDownloadGif = async () => {
    setIsRecording(true);
    toast.info('Generating animated GIF... This may take a moment.');
    
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/photo-game/battle-replay/${replay.replay_id}/generate-gif`,
        { 
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (!response.ok) throw new Error('Failed to generate GIF');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `battle_replay_${replay.replay_id}.gif`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Animated replay GIF downloaded!');
    } catch (err) {
      console.error('GIF error:', err);
      toast.error('Failed to generate GIF');
    } finally {
      setIsRecording(false);
      setShowDownloadOptions(false);
    }
  };
  
  // Legacy canvas-based download (fallback)
  const handleDownloadVideo = async () => {
    setIsRecording(true);
    toast.info('Preparing video... This may take a moment.');
    
    try {
      // Create a summary image instead of full video (video recording requires more complex setup)
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 600;
      const ctx = canvas.getContext('2d');
      
      // Draw background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, 800, 600);
      
      // Draw title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`🎮 Bot Battle Replay`, 400, 50);
      
      // Draw result
      const resultColor = replay.winner === 'player' ? '#22c55e' : '#ef4444';
      ctx.fillStyle = resultColor;
      ctx.font = 'bold 48px Arial';
      ctx.fillText(replay.winner === 'player' ? '🏆 VICTORY!' : '💀 DEFEAT', 400, 120);
      
      // Draw score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px Arial';
      ctx.fillText(`${replay.final_score_player} - ${replay.final_score_opponent}`, 400, 200);
      
      // Draw difficulty
      ctx.fillStyle = '#a78bfa';
      ctx.font = '24px Arial';
      ctx.fillText(`vs ${replay.difficulty?.toUpperCase()} BOT`, 400, 250);
      
      // Draw bet info
      ctx.fillStyle = '#fbbf24';
      ctx.font = '20px Arial';
      ctx.fillText(`Bet: ${replay.bet_amount} BL | Won: ${replay.winnings} BL`, 400, 290);
      
      // Draw rounds summary
      ctx.fillStyle = '#9ca3af';
      ctx.font = '18px Arial';
      ctx.fillText(`${rounds.length} Rounds Played`, 400, 340);
      
      // Draw watermark
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px Arial';
      ctx.fillText('blendlink.net', 400, 580);
      
      // Convert to blob and download
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `battle_replay_${replay.replay_id}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Battle summary downloaded!');
      }, 'image/png');
      
    } catch (err) {
      toast.error('Failed to create video');
    } finally {
      setIsRecording(false);
    }
  };
  
  if (!replay) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }
  
  const content = (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            {replay.winner === 'player' ? (
              <Trophy className="w-5 h-5 text-white" />
            ) : (
              <Skull className="w-5 h-5 text-white" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-white">
              {replay.winner === 'player' ? '🏆 Victory!' : '💀 Defeat'} vs {replay.difficulty?.toUpperCase()} Bot
            </h3>
            <p className="text-xs text-gray-400">
              {replay.username} • {new Date(replay.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm font-bold">
            {replay.final_score_player} - {replay.final_score_opponent}
          </span>
          {isModal && onClose && (
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>
      </div>
      
      {/* Battle stats bar */}
      <div className="px-4 py-2 bg-gray-800/50 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            <Eye className="w-4 h-4 inline mr-1" />
            {replay.views || 0}
          </span>
          <span className="text-gray-400">
            <Heart className="w-4 h-4 inline mr-1" />
            {replay.likes || 0}
          </span>
        </div>
        <div className="text-yellow-400 font-bold">
          {replay.winner === 'player' ? `+${replay.winnings}` : `-${replay.bet_amount}`} BL
        </div>
      </div>
      
      {/* Round display */}
      <div className="p-4" ref={canvasRef}>
        <div className="text-center mb-4">
          <span className="px-4 py-2 bg-gray-800 rounded-full text-white font-bold">
            Round {currentRound + 1} of {totalRounds}
          </span>
          {currentRoundData?.round_type === 'rps' && (
            <span className="ml-2 px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm">
              RPS Bidding
            </span>
          )}
        </div>
        
        {/* Round content */}
        {currentRoundData?.round_type === 'rps' ? (
          <RPSDisplay
            playerChoice={currentRoundData.rps_choice_player}
            opponentChoice={currentRoundData.rps_choice_opponent}
            winner={currentRoundData.winner}
          />
        ) : (
          <div className="flex items-center justify-center gap-4 sm:gap-8">
            <ReplayPhotoCard
              photo={currentRoundData?.player_photo}
              isPlayer={true}
              effectiveValue={currentRoundData?.player_effective_value}
              taps={currentRoundData?.player_taps || 0}
              progress={currentRoundData?.player_progress || 0}
              isWinner={currentRoundData?.winner === 'player'}
            />
            
            <div className="text-4xl">⚔️</div>
            
            <ReplayPhotoCard
              photo={currentRoundData?.opponent_photo}
              isPlayer={false}
              effectiveValue={currentRoundData?.opponent_effective_value}
              taps={currentRoundData?.opponent_taps || 0}
              progress={currentRoundData?.opponent_progress || 0}
              isWinner={currentRoundData?.winner === 'opponent'}
            />
          </div>
        )}
        
        {/* Round result */}
        <AnimatePresence>
          <motion.div
            key={currentRound}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mt-4"
          >
            <span className={`px-4 py-2 rounded-full font-bold ${
              currentRoundData?.winner === 'player'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {currentRoundData?.winner === 'player' ? '✓ Round Won!' : '✗ Round Lost'}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Playback controls */}
      <div className="p-4 border-t border-gray-800">
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Round {currentRound + 1}</span>
            <span>{totalRounds} rounds</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
              style={{ width: `${((currentRound + 1) / totalRounds) * 100}%` }}
            />
          </div>
        </div>
        
        {/* Control buttons */}
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={handlePrevRound}
            disabled={currentRound === 0}
            variant="outline"
            size="sm"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          
          <Button
            onClick={handlePlayPause}
            className="px-6 bg-purple-600 hover:bg-purple-700"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          
          <Button
            onClick={handleNextRound}
            disabled={currentRound >= totalRounds - 1}
            variant="outline"
            size="sm"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
          
          <Button
            onClick={handleSpeedChange}
            variant="outline"
            size="sm"
            className="w-16"
          >
            {playbackSpeed}x
          </Button>
        </div>
        
        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => setShowShareModal(true)}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          
          {/* Download dropdown */}
          <div className="relative flex-1">
            <Button
              onClick={() => setShowDownloadOptions(!showDownloadOptions)}
              disabled={isRecording}
              variant="outline"
              className="w-full"
            >
              {isRecording ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export
            </Button>
            
            {/* Dropdown options */}
            <AnimatePresence>
              {showDownloadOptions && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-full mb-2 left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-20"
                >
                  <button
                    onClick={handleDownloadGif}
                    disabled={isRecording}
                    className="w-full px-4 py-3 text-left hover:bg-gray-700 flex items-center gap-3 text-sm"
                  >
                    <span className="text-xl">🎬</span>
                    <div>
                      <p className="text-white font-medium">Animated GIF</p>
                      <p className="text-gray-400 text-xs">Animated replay summary</p>
                    </div>
                  </button>
                  <button
                    onClick={handleDownloadImage}
                    disabled={isRecording}
                    className="w-full px-4 py-3 text-left hover:bg-gray-700 flex items-center gap-3 text-sm border-t border-gray-700"
                  >
                    <span className="text-xl">🖼️</span>
                    <div>
                      <p className="text-white font-medium">HD Image (PNG)</p>
                      <p className="text-gray-400 text-xs">High quality summary card</p>
                    </div>
                  </button>
                  <button
                    onClick={handleDownloadVideo}
                    disabled={isRecording}
                    className="w-full px-4 py-3 text-left hover:bg-gray-700 flex items-center gap-3 text-sm border-t border-gray-700"
                  >
                    <span className="text-xl">📷</span>
                    <div>
                      <p className="text-white font-medium">Quick Image</p>
                      <p className="text-gray-400 text-xs">Browser-generated (fast)</p>
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <ShareModal
            isOpen={showShareModal}
            onClose={() => setShowShareModal(false)}
            replayId={replay.replay_id}
            replayData={replay}
            onShareToFeed={handleShareToFeed}
          />
        )}
      </AnimatePresence>
    </div>
  );
  
  if (isModal) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {content}
        </motion.div>
      </motion.div>
    );
  }
  
  return content;
};

export default BattleReplayViewer;
