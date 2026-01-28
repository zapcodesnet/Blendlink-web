/**
 * MatchHistory Component
 * 
 * Comprehensive match history with:
 * - Battle history dashboard with filters
 * - Full animated replay (all 5 rounds step-by-step)
 * - Shareable battle card with all 10 photos + detailed stats
 * - Social sharing to Facebook Group
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Swords, Clock, Calendar, ChevronRight, ChevronLeft,
  Play, Pause, SkipForward, RotateCcw, Share2, Facebook, Twitter,
  Link2, X, Filter, TrendingUp, TrendingDown, Zap, Shield, Flame,
  Eye, Download, Users, Crown, Target, Loader2, Copy, Check,
  Hand, FileText // Rock, Paper, Scissors icons
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import api from '../../services/api';

// Constants
const FACEBOOK_GROUP_URL = "https://www.facebook.com/groups/938837402074960";
const ROUND_SEQUENCE = [
  { type: 'auction', name: 'Tapping Battle', round: 1 },
  { type: 'rps', name: 'RPS Bidding', round: 2 },
  { type: 'auction', name: 'Tapping Battle', round: 3 },
  { type: 'rps', name: 'RPS Bidding', round: 4 },
  { type: 'auction', name: 'Final Tapping Battle', round: 5 },
];

const RPS_ICONS = {
  rock: { icon: '🪨', label: 'Rock' },
  paper: { icon: '📄', label: 'Paper' },
  scissors: { icon: '✂️', label: 'Scissors' },
};

const SCENERY_CONFIG = {
  natural: { color: 'from-green-600 to-emerald-800', icon: '🌿', label: 'Natural' },
  urban: { color: 'from-gray-600 to-slate-800', icon: '🏙️', label: 'Urban' },
  artistic: { color: 'from-purple-600 to-indigo-800', icon: '🎨', label: 'Artistic' },
  minimal: { color: 'from-slate-500 to-gray-700', icon: '⬜', label: 'Minimal' },
  vintage: { color: 'from-amber-700 to-orange-900', icon: '📷', label: 'Vintage' },
  default: { color: 'from-purple-600 to-pink-600', icon: '📷', label: 'Photo' }
};

// Format helpers
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Photo Card Component
const PhotoCard = ({ photo, size = 'md', showStats = false }) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.default;
  const sizeClasses = {
    sm: 'w-12 h-16',
    md: 'w-20 h-28',
    lg: 'w-28 h-40',
  };
  
  return (
    <div className={`relative ${sizeClasses[size]} rounded-lg overflow-hidden border border-gray-600`}>
      {photo?.image_url ? (
        <img 
          src={photo.image_url} 
          alt={photo.name || 'Photo'}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
          <span className="text-2xl">{scenery.icon}</span>
        </div>
      )}
      {showStats && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1 text-center">
          <p className="text-yellow-400 text-xs font-bold">{formatDollarValue(photo?.dollar_value)}</p>
        </div>
      )}
    </div>
  );
};

// Match Card Component (for history list)
const MatchCard = ({ match, currentUserId, onClick }) => {
  const isWinner = match.winner_id === currentUserId;
  const isPlayer1 = match.player1_id === currentUserId;
  const opponent = isPlayer1 ? match.player2_info : match.player1_info;
  const myScore = isPlayer1 ? match.player1_wins : match.player2_wins;
  const opponentScore = isPlayer1 ? match.player2_wins : match.player1_wins;
  
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`w-full p-4 rounded-xl border transition-all ${
        isWinner 
          ? 'bg-green-500/10 border-green-500/30 hover:border-green-500/50' 
          : 'bg-red-500/10 border-red-500/30 hover:border-red-500/50'
      }`}
      data-testid={`match-card-${match.session_id}`}
    >
      <div className="flex items-center justify-between">
        {/* Result badge */}
        <div className={`flex items-center gap-2 ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
          {isWinner ? <Trophy className="w-5 h-5" /> : <Target className="w-5 h-5" />}
          <span className="font-bold">{isWinner ? 'VICTORY' : 'DEFEAT'}</span>
        </div>
        
        {/* Score */}
        <div className="text-center">
          <p className="text-2xl font-bold text-white">{myScore} - {opponentScore}</p>
          <p className="text-xs text-gray-400">Score</p>
        </div>
        
        {/* Opponent */}
        <div className="text-right">
          <p className="text-gray-300 font-medium">vs {opponent?.username || 'Opponent'}</p>
          <p className="text-xs text-gray-500">{formatDate(match.completed_at)}</p>
        </div>
        
        <ChevronRight className="w-5 h-5 text-gray-500" />
      </div>
      
      {/* BL Coins change */}
      {match.bet_amount > 0 && (
        <div className={`mt-2 text-sm font-bold ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
          {isWinner ? '+' : '-'}{match.bet_amount} BL Coins
        </div>
      )}
    </motion.button>
  );
};

// Battle Replay Component
const BattleReplay = ({ match, currentUserId, onClose }) => {
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const intervalRef = useRef(null);
  
  const isPlayer1 = match.player1_id === currentUserId;
  const myPhotos = isPlayer1 ? match.player1_photos : match.player2_photos;
  const opponentPhotos = isPlayer1 ? match.player2_photos : match.player1_photos;
  const rounds = match.rounds || [];
  const currentRound = rounds[currentRoundIndex];
  
  // Auto-play functionality
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentRoundIndex(prev => {
          if (prev >= rounds.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 3000);
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, rounds.length]);
  
  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleRestart = () => {
    setCurrentRoundIndex(0);
    setIsPlaying(true);
  };
  const handleNext = () => {
    if (currentRoundIndex < rounds.length - 1) {
      setCurrentRoundIndex(prev => prev + 1);
    }
  };
  const handlePrev = () => {
    if (currentRoundIndex > 0) {
      setCurrentRoundIndex(prev => prev - 1);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 overflow-y-auto"
      data-testid="battle-replay"
    >
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
          
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Play className="w-5 h-5 text-purple-400" />
            Battle Replay
          </h2>
          
          <Button
            onClick={() => setShowShareModal(true)}
            variant="outline"
            className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
            data-testid="share-replay-btn"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
        </div>
        
        {/* Photos Display - All 5 from each player */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* My Photos */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <p className="text-green-400 font-bold mb-3 text-center">Your Team</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {myPhotos?.map((photo, idx) => (
                <PhotoCard 
                  key={photo?.mint_id || idx} 
                  photo={photo} 
                  size="sm" 
                  showStats 
                />
              ))}
            </div>
          </div>
          
          {/* Opponent Photos */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <p className="text-red-400 font-bold mb-3 text-center">Opponent's Team</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {opponentPhotos?.map((photo, idx) => (
                <PhotoCard 
                  key={photo?.mint_id || idx} 
                  photo={photo} 
                  size="sm" 
                  showStats 
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Round Progress Bar */}
        <div className="flex gap-2 mb-6">
          {rounds.map((round, idx) => {
            const isMyWin = isPlayer1 ? round.winner === 'player1' : round.winner === 'player2';
            return (
              <button
                key={idx}
                onClick={() => setCurrentRoundIndex(idx)}
                className={`flex-1 h-2 rounded-full transition-all ${
                  idx === currentRoundIndex 
                    ? 'bg-purple-500 scale-y-150' 
                    : idx < currentRoundIndex
                      ? isMyWin ? 'bg-green-500' : 'bg-red-500'
                      : 'bg-gray-700'
                }`}
              />
            );
          })}
        </div>
        
        {/* Current Round Display */}
        {currentRound && (
          <motion.div
            key={currentRoundIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-6"
          >
            <div className="text-center mb-4">
              <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-bold">
                Round {currentRoundIndex + 1} • {ROUND_SEQUENCE[currentRoundIndex]?.name || 'Battle'}
              </span>
            </div>
            
            {/* Round Type Display */}
            {currentRound.type === 'rps' ? (
              <RPSRoundDisplay 
                round={currentRound} 
                isPlayer1={isPlayer1} 
              />
            ) : (
              <TappingRoundDisplay 
                round={currentRound} 
                isPlayer1={isPlayer1} 
              />
            )}
            
            {/* Round Result */}
            <div className="text-center mt-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                  (isPlayer1 ? currentRound.winner === 'player1' : currentRound.winner === 'player2')
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {(isPlayer1 ? currentRound.winner === 'player1' : currentRound.winner === 'player2') 
                  ? <Trophy className="w-5 h-5" /> 
                  : <Target className="w-5 h-5" />
                }
                <span className="font-bold">
                  {(isPlayer1 ? currentRound.winner === 'player1' : currentRound.winner === 'player2') 
                    ? 'Round Won!' 
                    : 'Round Lost'
                  }
                </span>
              </motion.div>
            </div>
          </motion.div>
        )}
        
        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <Button
            onClick={handleRestart}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
          
          <Button
            onClick={handlePrev}
            variant="ghost"
            size="sm"
            disabled={currentRoundIndex === 0}
            className="text-gray-400 hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          
          <Button
            onClick={handlePlayPause}
            className="w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500"
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </Button>
          
          <Button
            onClick={handleNext}
            variant="ghost"
            size="sm"
            disabled={currentRoundIndex >= rounds.length - 1}
            className="text-gray-400 hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
          
          <Button
            onClick={() => setCurrentRoundIndex(rounds.length - 1)}
            variant="ghost"
            size="sm"
            className="text-gray-400 hover:text-white"
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Final Result */}
        <div className="text-center">
          <p className="text-gray-400 mb-2">Final Score</p>
          <p className={`text-4xl font-bold ${
            match.winner_id === currentUserId ? 'text-green-400' : 'text-red-400'
          }`}>
            {isPlayer1 ? match.player1_wins : match.player2_wins} - {isPlayer1 ? match.player2_wins : match.player1_wins}
          </p>
          <p className={`text-xl font-bold mt-2 ${
            match.winner_id === currentUserId ? 'text-green-400' : 'text-red-400'
          }`}>
            {match.winner_id === currentUserId ? '🏆 VICTORY!' : '💔 DEFEAT'}
          </p>
        </div>
      </div>
      
      {/* Share Modal */}
      <AnimatePresence>
        {showShareModal && (
          <ShareBattleModal 
            match={match} 
            currentUserId={currentUserId}
            onClose={() => setShowShareModal(false)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// RPS Round Display
const RPSRoundDisplay = ({ round, isPlayer1 }) => {
  const myChoice = isPlayer1 ? round.player1_choice : round.player2_choice;
  const opponentChoice = isPlayer1 ? round.player2_choice : round.player1_choice;
  const myBid = isPlayer1 ? round.player1_bid : round.player2_bid;
  const opponentBid = isPlayer1 ? round.player2_bid : round.player1_bid;
  
  return (
    <div className="flex items-center justify-around">
      {/* My Choice */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          className="text-6xl mb-2"
        >
          {RPS_ICONS[myChoice]?.icon || '❓'}
        </motion.div>
        <p className="text-green-400 font-bold">{RPS_ICONS[myChoice]?.label || 'Unknown'}</p>
        <p className="text-yellow-400 text-sm">Bid: {formatDollarValue(myBid)}</p>
      </div>
      
      {/* VS */}
      <div className="text-3xl font-bold text-gray-500">VS</div>
      
      {/* Opponent Choice */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0, rotate: 180 }}
          animate={{ scale: 1, rotate: 0 }}
          className="text-6xl mb-2"
        >
          {RPS_ICONS[opponentChoice]?.icon || '❓'}
        </motion.div>
        <p className="text-red-400 font-bold">{RPS_ICONS[opponentChoice]?.label || 'Unknown'}</p>
        <p className="text-yellow-400 text-sm">Bid: {formatDollarValue(opponentBid)}</p>
      </div>
    </div>
  );
};

// Tapping Round Display
const TappingRoundDisplay = ({ round, isPlayer1 }) => {
  const myTaps = isPlayer1 ? round.player1_taps : round.player2_taps;
  const opponentTaps = isPlayer1 ? round.player2_taps : round.player1_taps;
  const myPhoto = isPlayer1 ? round.player1_photo : round.player2_photo;
  const opponentPhoto = isPlayer1 ? round.player2_photo : round.player1_photo;
  
  return (
    <div className="flex items-center justify-around">
      {/* My Side */}
      <div className="text-center">
        <PhotoCard photo={myPhoto} size="md" showStats />
        <motion.p
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-green-400 font-bold text-2xl mt-2"
        >
          {myTaps || 0} taps
        </motion.p>
      </div>
      
      {/* VS */}
      <div className="flex flex-col items-center">
        <Swords className="w-8 h-8 text-purple-400 mb-2" />
        <span className="text-gray-500 font-bold">VS</span>
      </div>
      
      {/* Opponent Side */}
      <div className="text-center">
        <PhotoCard photo={opponentPhoto} size="md" showStats />
        <motion.p
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-red-400 font-bold text-2xl mt-2"
        >
          {opponentTaps || 0} taps
        </motion.p>
      </div>
    </div>
  );
};

// Share Battle Modal
const ShareBattleModal = ({ match, currentUserId, onClose }) => {
  const [copied, setCopied] = useState(false);
  const isWinner = match.winner_id === currentUserId;
  const isPlayer1 = match.player1_id === currentUserId;
  const myPhotos = isPlayer1 ? match.player1_photos : match.player2_photos;
  const opponentPhotos = isPlayer1 ? match.player2_photos : match.player1_photos;
  const myScore = isPlayer1 ? match.player1_wins : match.player2_wins;
  const opponentScore = isPlayer1 ? match.player2_wins : match.player1_wins;
  const opponent = isPlayer1 ? match.player2_info : match.player1_info;
  
  const totalMyValue = myPhotos?.reduce((sum, p) => sum + (p?.dollar_value || 0), 0) || 0;
  const totalOpponentValue = opponentPhotos?.reduce((sum, p) => sum + (p?.dollar_value || 0), 0) || 0;
  
  const shareUrl = `${window.location.origin}/battle/${match.session_id}`;
  const shareText = isWinner 
    ? `🏆 I WON a Photo Battle on Blendlink! ${myScore}-${opponentScore} vs @${opponent?.username || 'opponent'}\n\n💰 My Team: ${formatDollarValue(totalMyValue)}\n⚔️ Come challenge me!\n\n${shareUrl}\n\n#Blendlink #PhotoBattle #Victory`
    : `⚔️ Epic Photo Battle on Blendlink! Lost ${myScore}-${opponentScore} vs @${opponent?.username || 'opponent'}\n\n💪 Ready for a rematch!\n\n${shareUrl}\n\n#Blendlink #PhotoBattle`;
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShareFacebook = () => {
    // Copy share text first
    navigator.clipboard.writeText(shareText);
    toast.success('Caption copied! Paste it in your Facebook post.');
    
    // Open Facebook group
    window.open(FACEBOOK_GROUP_URL, '_blank');
  };
  
  const handleShareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(twitterUrl, '_blank');
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80" />
      
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-lg bg-gray-900 rounded-2xl overflow-hidden border border-gray-700"
        data-testid="share-battle-modal"
      >
        {/* Header */}
        <div className={`p-6 text-center ${isWinner ? 'bg-gradient-to-r from-green-600/20 to-emerald-600/20' : 'bg-gradient-to-r from-red-600/20 to-orange-600/20'}`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-gray-800 rounded-full"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
          
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-6xl mb-2"
          >
            {isWinner ? '🏆' : '⚔️'}
          </motion.div>
          <h3 className={`text-2xl font-bold ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
            {isWinner ? 'VICTORY!' : 'Good Fight!'}
          </h3>
          <p className="text-4xl font-bold text-white mt-2">{myScore} - {opponentScore}</p>
          <p className="text-gray-400">vs {opponent?.username || 'Opponent'}</p>
        </div>
        
        {/* Battle Card Preview - All 10 Photos */}
        <div className="p-4">
          <p className="text-gray-400 text-sm text-center mb-3">Battle Card Preview</p>
          
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            {/* My Team */}
            <div className="mb-4">
              <p className="text-green-400 text-xs font-bold mb-2 flex items-center gap-1">
                <Crown className="w-3 h-3" /> Your Team ({formatDollarValue(totalMyValue)})
              </p>
              <div className="flex justify-center gap-1">
                {myPhotos?.slice(0, 5).map((photo, idx) => (
                  <div key={idx} className="w-12 h-16 rounded overflow-hidden border border-green-500/30">
                    {photo?.image_url ? (
                      <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${SCENERY_CONFIG[photo?.scenery_type]?.color || 'from-gray-600 to-gray-800'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Opponent Team */}
            <div>
              <p className="text-red-400 text-xs font-bold mb-2 flex items-center gap-1">
                <Target className="w-3 h-3" /> Opponent ({formatDollarValue(totalOpponentValue)})
              </p>
              <div className="flex justify-center gap-1">
                {opponentPhotos?.slice(0, 5).map((photo, idx) => (
                  <div key={idx} className="w-12 h-16 rounded overflow-hidden border border-red-500/30">
                    {photo?.image_url ? (
                      <img src={photo.image_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${SCENERY_CONFIG[photo?.scenery_type]?.color || 'from-gray-600 to-gray-800'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Share Buttons */}
        <div className="p-4 space-y-3">
          {/* Facebook Group - Primary */}
          <Button
            onClick={handleShareFacebook}
            className="w-full py-4 bg-[#1877F2] hover:bg-[#166FE5] text-white font-bold"
            data-testid="share-facebook-btn"
          >
            <Facebook className="w-5 h-5 mr-2" />
            Share to Community Group
          </Button>
          
          {/* Twitter */}
          <Button
            onClick={handleShareTwitter}
            variant="outline"
            className="w-full py-3 border-gray-600 hover:bg-gray-800"
          >
            <Twitter className="w-5 h-5 mr-2 text-[#1DA1F2]" />
            Share on Twitter
          </Button>
          
          {/* Copy Link */}
          <Button
            onClick={handleCopyLink}
            variant="ghost"
            className="w-full py-3 text-gray-400 hover:text-white"
          >
            {copied ? <Check className="w-5 h-5 mr-2 text-green-400" /> : <Link2 className="w-5 h-5 mr-2" />}
            {copied ? 'Copied!' : 'Copy Battle Link'}
          </Button>
        </div>
        
        {/* Bonus Info */}
        <div className="px-4 pb-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center">
            <p className="text-yellow-400 text-sm font-bold">🎁 Earn +500 BL Coins</p>
            <p className="text-gray-400 text-xs">for each battle shared in the community group!</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Main Match History Component
export const MatchHistory = ({ currentUserId }) => {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, wins, losses
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [stats, setStats] = useState(null);
  
  // Fetch match history
  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const [historyRes, statsRes] = await Promise.all([
        api.get('/photo-game/match-history?limit=50'),
        api.get('/photo-game/stats'),
      ]);
      
      setMatches(historyRes.data.matches || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to fetch match history:', err);
      toast.error('Failed to load match history');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);
  
  // Filter matches
  const filteredMatches = matches.filter(match => {
    if (filter === 'all') return true;
    const isWinner = match.winner_id === currentUserId;
    if (filter === 'wins') return isWinner;
    if (filter === 'losses') return !isWinner;
    return true;
  });
  
  // Calculate win rate
  const winCount = matches.filter(m => m.winner_id === currentUserId).length;
  const winRate = matches.length > 0 ? Math.round((winCount / matches.length) * 100) : 0;
  
  return (
    <div className="space-y-6" data-testid="match-history">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
          <Trophy className="w-6 h-6 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-400">{stats?.wins || 0}</p>
          <p className="text-xs text-gray-400">Victories</p>
        </div>
        
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
          <Target className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-400">{stats?.losses || 0}</p>
          <p className="text-xs text-gray-400">Defeats</p>
        </div>
        
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-center">
          <TrendingUp className="w-6 h-6 text-purple-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-purple-400">{winRate}%</p>
          <p className="text-xs text-gray-400">Win Rate</p>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'wins', 'losses'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === f 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {f === 'all' ? 'All' : f === 'wins' ? '🏆 Wins' : '⚔️ Losses'}
          </button>
        ))}
      </div>
      
      {/* Match List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="text-center py-12">
          <Swords className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No battles yet</p>
          <p className="text-gray-500 text-sm">Start a battle to see your history here!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMatches.map(match => (
            <MatchCard
              key={match.session_id}
              match={match}
              currentUserId={currentUserId}
              onClick={() => setSelectedMatch(match)}
            />
          ))}
        </div>
      )}
      
      {/* Battle Replay Modal */}
      <AnimatePresence>
        {selectedMatch && (
          <BattleReplay
            match={selectedMatch}
            currentUserId={currentUserId}
            onClose={() => setSelectedMatch(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MatchHistory;
