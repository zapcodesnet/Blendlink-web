/**
 * PVPRoundReady Component
 * 
 * Per-round ready screen for PVP matches:
 * - Shows current score
 * - Both players' 5 locked photos
 * - Photo selection for upcoming round
 * - Ready button after selection
 * - Transparent 10s countdown when both ready
 * - Real-time sync via WebSocket
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, Clock, Zap, Trophy, Shield,
  Loader2, Image, ChevronRight, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import api from '../../services/api';

// Constants
const COUNTDOWN_SECONDS = 10;
const READY_TIMEOUT_SECONDS = 30;

// Scenery config
const SCENERY_CONFIG = {
  natural: { name: 'Natural', color: 'from-green-500 to-emerald-600', icon: '🌿' },
  water: { name: 'Water', color: 'from-blue-500 to-cyan-600', icon: '🌊' },
  manmade: { name: 'Man-made', color: 'from-orange-500 to-red-600', icon: '🏙️' },
  neutral: { name: 'Neutral', color: 'from-gray-500 to-gray-600', icon: '⬜' },
};

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value?.toLocaleString()}`;
};

// Photo Card for selection
const PhotoSelectCard = ({ photo, selected, used, onSelect, disabled }) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  const hasLowStamina = (photo?.current_stamina || 0) < 1;
  
  return (
    <motion.button
      onClick={() => !disabled && !used && !hasLowStamina && onSelect(photo)}
      disabled={disabled || used || hasLowStamina}
      className={`relative w-24 h-32 rounded-xl overflow-hidden transition-all ${
        used || hasLowStamina
          ? 'opacity-40 grayscale cursor-not-allowed' 
          : selected 
            ? 'ring-4 ring-green-500 ring-offset-2 ring-offset-gray-900 scale-105' 
            : 'hover:scale-105 cursor-pointer border-2 border-gray-700'
      }`}
      whileHover={!disabled && !used && !hasLowStamina ? { y: -4 } : {}}
      data-testid={`pvp-photo-select-${photo?.mint_id}`}
    >
      {/* Photo Image */}
      <div className="w-full h-20 bg-gray-800">
        {photo?.image_url ? (
          <img src={photo.image_url} alt={photo.name} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
            <span className="text-2xl opacity-60">{scenery.icon}</span>
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="p-1 bg-gray-900">
        <p className="text-[10px] text-white font-bold truncate">{photo?.name || 'Photo'}</p>
        <p className="text-[10px] text-yellow-400">{formatDollarValue(photo?.dollar_value)}</p>
      </div>
      
      {/* Scenery badge */}
      <div className="absolute top-1 left-1">
        <span className={`px-1 py-0.5 rounded text-[8px] font-bold bg-gradient-to-r ${scenery.color} text-white`}>
          {scenery.icon}
        </span>
      </div>
      
      {/* Used overlay */}
      {used && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">USED</span>
        </div>
      )}
      
      {/* Low stamina overlay */}
      {hasLowStamina && !used && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="text-red-400 text-[10px] font-bold">NO STAMINA</span>
        </div>
      )}
      
      {/* Selected checkmark */}
      {selected && !used && (
        <motion.div 
          className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <Check className="w-3 h-3 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
};

// Score Display
const ScoreDisplay = ({ player1Wins, player2Wins, player1Name, player2Name }) => {
  const WINS_NEEDED = 3;
  
  return (
    <div className="flex items-center justify-center gap-8 py-3 bg-gray-800/50 rounded-xl mb-4">
      {/* Player 1 */}
      <div className="text-center">
        <p className="text-xs text-purple-400 mb-1">{player1Name || 'You'}</p>
        <div className="flex gap-1">
          {[...Array(WINS_NEEDED)].map((_, i) => (
            <div
              key={i}
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                i < player1Wins ? 'bg-green-500' : 'bg-gray-700'
              }`}
            >
              {i < player1Wins && <span className="text-white text-xs">✓</span>}
            </div>
          ))}
        </div>
      </div>
      
      <div className="text-2xl font-bold text-gray-500">VS</div>
      
      {/* Player 2 */}
      <div className="text-center">
        <p className="text-xs text-red-400 mb-1">{player2Name || 'Opponent'}</p>
        <div className="flex gap-1">
          {[...Array(WINS_NEEDED)].map((_, i) => (
            <div
              key={i}
              className={`w-6 h-6 rounded-full flex items-center justify-center ${
                i < player2Wins ? 'bg-red-500' : 'bg-gray-700'
              }`}
            >
              {i < player2Wins && <span className="text-white text-xs">✓</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Countdown Overlay
const CountdownOverlay = ({ seconds, serverTime }) => {
  // Calculate initial count based on server time
  const getInitialCount = useCallback(() => {
    if (serverTime) {
      const serverStart = new Date(serverTime).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - serverStart) / 1000);
      return Math.max(0, seconds - elapsed);
    }
    return seconds;
  }, [serverTime, seconds]);
  
  const [count, setCount] = useState(() => getInitialCount());
  
  // Use a ref to track the latest getInitialCount to avoid calling setState directly
  const getInitialCountRef = useRef(getInitialCount);
  useEffect(() => {
    getInitialCountRef.current = getInitialCount;
  }, [getInitialCount]);
  
  useEffect(() => {
    // Calculate initial count once at mount or when serverTime changes
    const initialCount = getInitialCountRef.current();
    
    // Use a timer to update the count
    let currentCount = initialCount;
    setCount(currentCount);
    
    const timer = setInterval(() => {
      currentCount = Math.max(0, currentCount - 1);
      setCount(currentCount);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [serverTime, seconds]); // Only re-run when these change
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
    >
      <motion.div className="text-center">
        <motion.div
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative"
        >
          <span className="text-[120px] sm:text-[180px] font-bold text-white drop-shadow-[0_0_50px_rgba(168,85,247,0.8)]">
            {count}
          </span>
        </motion.div>
        <motion.p
          className="text-3xl font-bold text-purple-300 mt-4"
          animate={{ opacity: [0.5, 1, 0.5], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          Get Ready!
        </motion.p>
      </motion.div>
    </motion.div>
  );
};

// Main Component
export const PVPRoundReady = ({
  websocket,
  currentUserId,
  currentRound,
  roundType,
  player1,  // { userId, username, photos, selectedPhotoId, isReady }
  player2,
  player1Wins,
  player2Wins,
  usedPhotoIds = [],  // Photos already used in previous rounds
  selectionTimeRemaining = 30, // Time left for selection
  opponentHasSelected = false, // Whether opponent has selected
  onRoundStart,
  onPhotoSelect,
  onReady,
  sessionId, // Add sessionId prop for API calls
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [phase, setPhase] = useState('selecting'); // selecting, ready, countdown
  const [countdown, setCountdown] = useState(null);
  const [serverTime, setServerTime] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [localOpponentSelected, setLocalOpponentSelected] = useState(opponentHasSelected);
  const [localTimeRemaining, setLocalTimeRemaining] = useState(selectionTimeRemaining);
  
  // Update local state when props change
  useEffect(() => {
    setLocalOpponentSelected(opponentHasSelected);
  }, [opponentHasSelected]);
  
  useEffect(() => {
    setLocalTimeRemaining(selectionTimeRemaining);
  }, [selectionTimeRemaining]);
  
  // Determine if current user is player 1 or 2
  const isPlayer1 = player1?.userId === currentUserId;
  const myData = isPlayer1 ? player1 : player2;
  const opponentData = isPlayer1 ? player2 : player1;
  
  // Handle WebSocket messages
  useEffect(() => {
    if (!websocket) return;
    
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'player_selected_photo':
            // Opponent selected (don't know which)
            if (data.user_id !== currentUserId) {
              setLocalOpponentSelected(true);
              toast.info(`${opponentData?.username || 'Opponent'} selected their photo`);
            }
            break;
          
          case 'selection_timeout_tick':
            // Update countdown and opponent selection status
            setLocalTimeRemaining(data.seconds_remaining);
            const oppSelected = isPlayer1 ? data.player2_selected : data.player1_selected;
            setLocalOpponentSelected(oppSelected);
            break;
            
          case 'round_ready':
            // Both selected, show photos and ready buttons
            setPhase('ready');
            break;
            
          case 'player_ready':
            if (data.user_id !== currentUserId) {
              toast.info(`${opponentData?.username || 'Opponent'} is ready!`);
            }
            break;
            
          case 'countdown_start':
            setPhase('countdown');
            setCountdown(data.seconds);
            setServerTime(data.server_timestamp);
            toast.success('🔥 Both players ready! Starting...');
            break;
            
          case 'countdown_tick':
            setCountdown(data.seconds_remaining);
            setServerTime(data.server_timestamp);
            break;
            
          case 'round_start':
            // Round starting - pass data to parent
            onRoundStart?.(data);
            break;
            
          case 'auto_selected':
            if (data.user_id === currentUserId) {
              toast.warning('Time ran out - photo auto-selected');
            } else {
              setLocalOpponentSelected(true);
            }
            break;
            
          case 'auto_ready':
            if (data.user_id === currentUserId) {
              toast.warning('Time ran out - auto-ready');
            }
            break;
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    };
    
    websocket.addEventListener('message', handleMessage);
    
    return () => {
      websocket.removeEventListener('message', handleMessage);
    };
  }, [websocket, currentUserId, opponentData?.username, onRoundStart, isPlayer1]);
  
  // Update connection status
  useEffect(() => {
    if (websocket) {
      setWsConnected(websocket.readyState === WebSocket.OPEN);
    }
  }, [websocket]);
  
  // Handle photo selection
  const handleSelectPhoto = useCallback((photo) => {
    setSelectedPhoto(photo);
  }, []);
  
  // Confirm selection - use WebSocket if available, fallback to API
  const handleConfirmSelection = useCallback(async () => {
    if (!selectedPhoto) return;
    
    let wsSuccess = false;
    
    // Try WebSocket first
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      try {
        websocket.send(JSON.stringify({
          type: 'select_photo',
          photo_id: selectedPhoto.mint_id,
        }));
        wsSuccess = true;
      } catch (err) {
        console.log('[PVPRoundReady] WebSocket send failed, falling back to API');
      }
    }
    
    // Always send via API as primary method (WebSocket is unreliable)
    try {
      // Use sessionId prop, or fallback to URL/localStorage
      const effectiveSessionId = sessionId || 
                                 window.location.pathname.split('/').pop() || 
                                 localStorage.getItem('current_pvp_session');
      
      console.log('[PVPRoundReady] Sending selection via API:', { effectiveSessionId, photoId: selectedPhoto.mint_id });
      
      if (effectiveSessionId) {
        const response = await api.post('/photo-game/pvp/select-photo', {
          session_id: effectiveSessionId,
          photo_id: selectedPhoto.mint_id
        });
        
        if (response.data.success) {
          console.log('[PVPRoundReady] Selection confirmed via API:', response.data);
          
          // If both players have selected, the API returns the round result
          if (response.data.both_selected && response.data.round_result) {
            // Notify parent component about the round result
            console.log('[PVPRoundReady] Both players selected! Round result:', response.data.round_result);
          }
        }
      } else {
        console.error('[PVPRoundReady] No sessionId available for API call');
      }
    } catch (err) {
      console.error('[PVPRoundReady] API selection failed:', err);
    }
    
    onPhotoSelect?.(selectedPhoto);
    toast.success(`Selected ${selectedPhoto.name}`);
  }, [selectedPhoto, websocket, onPhotoSelect, sessionId]);
  
  // Handle ready
  const handleReady = useCallback(() => {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({ type: 'ready' }));
    }
    onReady?.();
  }, [websocket, onReady]);
  
  const roundTypeLabel = roundType === 'auction' ? 'Photo Auction Bidding (Tapping)' : 'Rock Paper Scissors Bidding';
  
  return (
    <div className="space-y-4 relative" data-testid="pvp-round-ready">
      {/* Countdown overlay */}
      <AnimatePresence>
        {phase === 'countdown' && countdown !== null && (
          <CountdownOverlay seconds={countdown} serverTime={serverTime} />
        )}
      </AnimatePresence>
      
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-white flex items-center justify-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          Round {currentRound}
          {/* Connection status */}
          <span 
            className={`ml-2 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              wsConnected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}
          >
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {wsConnected ? 'Live' : 'Sync'}
          </span>
        </h2>
        <p className="text-gray-400 text-sm mt-1">{roundTypeLabel}</p>
      </div>
      
      {/* Score display */}
      <ScoreDisplay 
        player1Wins={player1Wins}
        player2Wins={player2Wins}
        player1Name={isPlayer1 ? 'You' : player1?.username}
        player2Name={isPlayer1 ? player2?.username : 'You'}
      />
      
      {/* Photo selection phase */}
      {phase === 'selecting' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
        >
          <h3 className="text-white font-bold text-center mb-3">
            Select Your Photo for This Round
          </h3>
          
          {/* My photos */}
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Your Photos:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {(myData?.photos || []).map((photo) => (
                <PhotoSelectCard
                  key={photo.mint_id}
                  photo={photo}
                  selected={selectedPhoto?.mint_id === photo.mint_id}
                  used={usedPhotoIds.includes(photo.mint_id)}
                  onSelect={handleSelectPhoto}
                  disabled={myData?.selectedPhotoId}
                />
              ))}
            </div>
          </div>
          
          {/* Opponent status with countdown */}
          <div className="flex items-center justify-center gap-2 text-sm mb-4">
            {localOpponentSelected || opponentData?.selectedPhotoId ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Opponent has selected</span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Waiting for opponent to select...</span>
                </div>
                {localTimeRemaining > 0 && (
                  <span className={`text-xs font-bold ${localTimeRemaining <= 10 ? 'text-red-400' : 'text-yellow-400'}`}>
                    Auto-select in {localTimeRemaining}s
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* Confirm button */}
          {!myData?.selectedPhotoId && (
            <Button
              onClick={handleConfirmSelection}
              disabled={!selectedPhoto}
              className={`w-full py-4 font-bold ${
                selectedPhoto 
                  ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-red-600' 
                  : 'bg-gray-700'
              }`}
              data-testid="confirm-selection-btn"
            >
              {selectedPhoto ? (
                <>Confirm {selectedPhoto.name} <ChevronRight className="w-5 h-5 ml-2" /></>
              ) : (
                'Select a Photo'
              )}
            </Button>
          )}
          
          {myData?.selectedPhotoId && (
            <div className="text-center py-2">
              <div className="text-green-400 font-bold">✓ Photo selected</div>
              {!localOpponentSelected && localTimeRemaining > 0 && (
                <div className={`text-xs mt-1 ${localTimeRemaining <= 10 ? 'text-red-400' : 'text-yellow-400'}`}>
                  Opponent selecting... ({localTimeRemaining}s remaining)
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
      
      {/* Ready phase - both photos revealed */}
      {phase === 'ready' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
        >
          <h3 className="text-white font-bold text-center mb-4">
            Both Photos Selected - Ready Up!
          </h3>
          
          {/* Photo matchup display */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {/* My photo */}
            <div className="text-center">
              <p className="text-xs text-purple-400 mb-1">Your Photo</p>
              <div className="w-28 h-36 rounded-xl overflow-hidden border-2 border-purple-500 bg-gray-800">
                {myData?.selectedPhoto?.image_url ? (
                  <img 
                    src={myData.selectedPhoto.image_url} 
                    alt="Your selection"
                    className="w-full h-24 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-purple-500/20 flex items-center justify-center">
                    <Image className="w-8 h-8 text-purple-400" />
                  </div>
                )}
                <div className="p-1 text-center">
                  <p className="text-xs text-white font-bold truncate">
                    {myData?.selectedPhoto?.name || 'Selected'}
                  </p>
                  <p className="text-xs text-yellow-400">
                    {formatDollarValue(myData?.selectedPhoto?.dollar_value)}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-2xl font-bold text-gray-500">VS</div>
            
            {/* Opponent photo */}
            <div className="text-center">
              <p className="text-xs text-red-400 mb-1">Opponent&apos;s Photo</p>
              <div className="w-28 h-36 rounded-xl overflow-hidden border-2 border-red-500 bg-gray-800">
                {opponentData?.selectedPhoto?.image_url ? (
                  <img 
                    src={opponentData.selectedPhoto.image_url} 
                    alt="Opponent selection"
                    className="w-full h-24 object-cover"
                  />
                ) : (
                  <div className="w-full h-24 bg-red-500/20 flex items-center justify-center">
                    <Image className="w-8 h-8 text-red-400" />
                  </div>
                )}
                <div className="p-1 text-center">
                  <p className="text-xs text-white font-bold truncate">
                    {opponentData?.selectedPhoto?.name || 'Selected'}
                  </p>
                  <p className="text-xs text-yellow-400">
                    {formatDollarValue(opponentData?.selectedPhoto?.dollar_value)}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Ready status */}
          <div className="flex justify-center gap-4 mb-4">
            <div className={`px-4 py-2 rounded-full ${myData?.isReady ? 'bg-green-500/20 border border-green-500' : 'bg-gray-700'}`}>
              {myData?.isReady ? (
                <span className="text-green-400 font-bold flex items-center gap-1">
                  <Check className="w-4 h-4" /> You&apos;re Ready
                </span>
              ) : (
                <span className="text-gray-400">Not Ready</span>
              )}
            </div>
            
            <div className={`px-4 py-2 rounded-full ${opponentData?.isReady ? 'bg-green-500/20 border border-green-500' : 'bg-gray-700'}`}>
              {opponentData?.isReady ? (
                <span className="text-green-400 font-bold flex items-center gap-1">
                  <Check className="w-4 h-4" /> Opponent Ready
                </span>
              ) : (
                <span className="text-gray-400 flex items-center gap-1">
                  <Loader2 className="w-4 h-4 animate-spin" /> Waiting...
                </span>
              )}
            </div>
          </div>
          
          {/* Ready button */}
          {!myData?.isReady && (
            <Button
              onClick={handleReady}
              className="w-full py-4 font-bold bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"
              data-testid="ready-btn"
            >
              <Zap className="w-5 h-5 mr-2" />
              Ready to Battle!
            </Button>
          )}
        </motion.div>
      )}
      
      {/* Timeout warning */}
      <p className="text-xs text-gray-500 text-center">
        Auto-{phase === 'selecting' ? 'select' : 'ready'} in {READY_TIMEOUT_SECONDS}s if no action
      </p>
    </div>
  );
};

export default PVPRoundReady;
