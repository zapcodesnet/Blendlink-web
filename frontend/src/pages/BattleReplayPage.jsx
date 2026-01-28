/**
 * BattleReplayPage - Public page for viewing shared battle replays
 * Accessible via /battle/:sessionId
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Swords, Clock, ChevronRight, ChevronLeft,
  Play, Pause, SkipForward, RotateCcw, Share2, Facebook, Twitter,
  Link2, X, ArrowLeft, Loader2, Copy, Check, Crown, Target
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import api from '../services/api';

// Constants
const FACEBOOK_GROUP_URL = "https://www.facebook.com/groups/938837402074960";

const RPS_ICONS = {
  rock: { icon: '🪨', label: 'Rock' },
  paper: { icon: '📄', label: 'Paper' },
  scissors: { icon: '✂️', label: 'Scissors' },
};

const SCENERY_CONFIG = {
  natural: { color: 'from-green-600 to-emerald-800', icon: '🌿' },
  urban: { color: 'from-gray-600 to-slate-800', icon: '🏙️' },
  artistic: { color: 'from-purple-600 to-indigo-800', icon: '🎨' },
  minimal: { color: 'from-slate-500 to-gray-700', icon: '⬜' },
  vintage: { color: 'from-amber-700 to-orange-900', icon: '📷' },
  default: { color: 'from-purple-600 to-pink-600', icon: '📷' }
};

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
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Photo Card Component
const PhotoCard = ({ photo, size = 'md' }) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.default;
  const sizeClasses = {
    sm: 'w-14 h-20',
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
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-1 text-center">
        <p className="text-yellow-400 text-xs font-bold">{formatDollarValue(photo?.dollar_value)}</p>
      </div>
    </div>
  );
};

// Main Battle Replay Page
const BattleReplayPage = () => {
  const { sessionId } = useParams();
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef(null);
  
  // Fetch battle data
  useEffect(() => {
    const fetchBattle = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/photo-game/battle/${sessionId}`);
        setBattle(res.data);
      } catch (err) {
        console.error('Failed to fetch battle:', err);
        setError(err.response?.data?.detail || 'Battle not found');
      } finally {
        setLoading(false);
      }
    };
    
    if (sessionId) {
      fetchBattle();
    }
  }, [sessionId]);
  
  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && battle?.rounds?.length > 0) {
      intervalRef.current = setInterval(() => {
        setCurrentRoundIndex(prev => {
          if (prev >= battle.rounds.length - 1) {
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
  }, [isPlaying, battle?.rounds?.length]);
  
  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleRestart = () => {
    setCurrentRoundIndex(0);
    setIsPlaying(true);
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShareFacebook = () => {
    const shareText = `⚔️ Epic Photo Battle on Blendlink!\n${battle.player1_info?.username || 'Player 1'} vs ${battle.player2_info?.username || 'Player 2'}\nScore: ${battle.player1_wins}-${battle.player2_wins}\n\nWatch the replay: ${window.location.href}\n\n#Blendlink #PhotoBattle`;
    navigator.clipboard.writeText(shareText);
    toast.success('Caption copied! Paste it in your Facebook post.');
    window.open(FACEBOOK_GROUP_URL, '_blank');
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
      </div>
    );
  }
  
  if (error || !battle) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Swords className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Battle Not Found</h1>
          <p className="text-gray-400 mb-6">{error || 'This battle replay is no longer available.'}</p>
          <Link to="/photo-game">
            <Button className="bg-purple-600 hover:bg-purple-500">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go to Battle Arena
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  
  const { player1_photos, player2_photos, player1_wins, player2_wins, player1_info, player2_info, winner_id, rounds, completed_at } = battle;
  const currentRound = rounds?.[currentRoundIndex];
  
  const totalP1Value = player1_photos?.reduce((sum, p) => sum + (p?.dollar_value || 0), 0) || 0;
  const totalP2Value = player2_photos?.reduce((sum, p) => sum + (p?.dollar_value || 0), 0) || 0;
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/photo-game" className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Battle Arena</span>
          </Link>
          
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Play className="w-5 h-5 text-purple-400" />
            Battle Replay
          </h1>
          
          <Button
            onClick={handleShareFacebook}
            size="sm"
            className="bg-[#1877F2] hover:bg-[#166FE5]"
          >
            <Share2 className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Battle Info */}
        <div className="text-center">
          <p className="text-gray-400 text-sm">{formatDate(completed_at)}</p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="text-right">
              <p className="text-white font-bold">{player1_info?.username || 'Player 1'}</p>
              <p className="text-yellow-400 text-sm">{formatDollarValue(totalP1Value)}</p>
            </div>
            <div className="text-4xl font-bold">
              <span className={player1_wins > player2_wins ? 'text-green-400' : 'text-gray-400'}>{player1_wins}</span>
              <span className="text-gray-500 mx-2">-</span>
              <span className={player2_wins > player1_wins ? 'text-green-400' : 'text-gray-400'}>{player2_wins}</span>
            </div>
            <div className="text-left">
              <p className="text-white font-bold">{player2_info?.username || 'Player 2'}</p>
              <p className="text-yellow-400 text-sm">{formatDollarValue(totalP2Value)}</p>
            </div>
          </div>
        </div>
        
        {/* Teams Display */}
        <div className="grid grid-cols-2 gap-4">
          {/* Player 1 Team */}
          <div className={`p-4 rounded-xl border ${winner_id === player1_info?.user_id ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
            <div className="flex items-center gap-2 mb-3">
              {winner_id === player1_info?.user_id && <Crown className="w-5 h-5 text-yellow-400" />}
              <p className="font-bold text-white">{player1_info?.username || 'Player 1'}</p>
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              {player1_photos?.map((photo, idx) => (
                <PhotoCard key={photo?.mint_id || idx} photo={photo} size="sm" />
              ))}
            </div>
          </div>
          
          {/* Player 2 Team */}
          <div className={`p-4 rounded-xl border ${winner_id === player2_info?.user_id ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-800/50 border-gray-700'}`}>
            <div className="flex items-center gap-2 mb-3 justify-end">
              <p className="font-bold text-white">{player2_info?.username || 'Player 2'}</p>
              {winner_id === player2_info?.user_id && <Crown className="w-5 h-5 text-yellow-400" />}
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              {player2_photos?.map((photo, idx) => (
                <PhotoCard key={photo?.mint_id || idx} photo={photo} size="sm" />
              ))}
            </div>
          </div>
        </div>
        
        {/* Round Progress Bar */}
        {rounds?.length > 0 && (
          <div className="flex gap-2">
            {rounds.map((round, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentRoundIndex(idx)}
                className={`flex-1 h-3 rounded-full transition-all ${
                  idx === currentRoundIndex 
                    ? 'bg-purple-500 scale-y-125' 
                    : idx < currentRoundIndex
                      ? round.winner === 'player1' ? 'bg-green-500' : 'bg-red-500'
                      : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        )}
        
        {/* Current Round Display */}
        {currentRound && (
          <motion.div
            key={currentRoundIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6"
          >
            <div className="text-center mb-4">
              <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-bold">
                Round {currentRoundIndex + 1} • {currentRound.type === 'rps' ? 'RPS Bidding' : 'Tapping Battle'}
              </span>
            </div>
            
            {currentRound.type === 'rps' ? (
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="text-6xl mb-2"
                  >
                    {RPS_ICONS[currentRound.player1_choice]?.icon || '❓'}
                  </motion.div>
                  <p className="text-white font-bold">{RPS_ICONS[currentRound.player1_choice]?.label || 'Unknown'}</p>
                  <p className="text-yellow-400 text-sm">Bid: {formatDollarValue(currentRound.player1_bid)}</p>
                </div>
                <div className="text-3xl font-bold text-gray-500">VS</div>
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0, rotate: 180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    className="text-6xl mb-2"
                  >
                    {RPS_ICONS[currentRound.player2_choice]?.icon || '❓'}
                  </motion.div>
                  <p className="text-white font-bold">{RPS_ICONS[currentRound.player2_choice]?.label || 'Unknown'}</p>
                  <p className="text-yellow-400 text-sm">Bid: {formatDollarValue(currentRound.player2_bid)}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <PhotoCard photo={currentRound.player1_photo} size="md" />
                  <p className="text-white font-bold text-2xl mt-2">{currentRound.player1_taps || 0} taps</p>
                </div>
                <Swords className="w-8 h-8 text-purple-400" />
                <div className="text-center">
                  <PhotoCard photo={currentRound.player2_photo} size="md" />
                  <p className="text-white font-bold text-2xl mt-2">{currentRound.player2_taps || 0} taps</p>
                </div>
              </div>
            )}
            
            {/* Round Winner */}
            <div className="text-center mt-4">
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                currentRound.winner === 'player1' 
                  ? 'bg-green-500/20 text-green-400'
                  : currentRound.winner === 'player2'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-gray-500/20 text-gray-400'
              }`}>
                {currentRound.winner === 'player1' ? (
                  <><Trophy className="w-5 h-5" /> {player1_info?.username || 'Player 1'} wins!</>
                ) : currentRound.winner === 'player2' ? (
                  <><Trophy className="w-5 h-5" /> {player2_info?.username || 'Player 2'} wins!</>
                ) : (
                  <>Draw</>
                )}
              </span>
            </div>
          </motion.div>
        )}
        
        {/* Playback Controls */}
        {rounds?.length > 0 && (
          <div className="flex items-center justify-center gap-4">
            <Button onClick={handleRestart} variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              <RotateCcw className="w-5 h-5" />
            </Button>
            <Button
              onClick={() => currentRoundIndex > 0 && setCurrentRoundIndex(prev => prev - 1)}
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
              onClick={() => currentRoundIndex < rounds.length - 1 && setCurrentRoundIndex(prev => prev + 1)}
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
        )}
        
        {/* Share Buttons */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-center text-gray-400 text-sm">Share this battle</p>
          
          <Button
            onClick={handleShareFacebook}
            className="w-full py-3 bg-[#1877F2] hover:bg-[#166FE5]"
          >
            <Facebook className="w-5 h-5 mr-2" />
            Share to Community Group
          </Button>
          
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`⚔️ Watch this epic Photo Battle on Blendlink!\n${player1_info?.username} vs ${player2_info?.username}\nScore: ${player1_wins}-${player2_wins}\n\n${window.location.href}\n\n#Blendlink #PhotoBattle`)}`;
                window.open(twitterUrl, '_blank');
              }}
              variant="outline"
              className="flex-1 border-gray-600"
            >
              <Twitter className="w-5 h-5 mr-2 text-[#1DA1F2]" />
              Twitter
            </Button>
            
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="flex-1 border-gray-600"
            >
              {copied ? <Check className="w-5 h-5 mr-2 text-green-400" /> : <Link2 className="w-5 h-5 mr-2" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>
        </div>
        
        {/* CTA */}
        <div className="text-center py-8">
          <p className="text-gray-400 mb-4">Ready to battle?</p>
          <Link to="/photo-game">
            <Button className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 px-8 py-4 text-lg font-bold">
              <Swords className="w-6 h-6 mr-2" />
              Start Your Own Battle
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BattleReplayPage;
