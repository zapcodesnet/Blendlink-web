/**
 * PVPBattleArena Component
 * 
 * Real-time synchronized PVP gameplay with:
 * - Per-round photo selection
 * - Ready button BEFORE every round
 * - WebSocket-synced countdown
 * - Proper opponent photo display
 * - Disconnect handling
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Wifi, WifiOff, X, RefreshCw, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { PVPRoundReady } from './PVPRoundReady';
import { TappingArena } from './TappingArena';
import { RPSBidding } from './RPSBidding';
import MedalCelebration from '../MedalCelebration';
import api from '../../services/api';

// Constants
const STARTING_RPS_MONEY = 5_000_000;
const WINS_NEEDED = 3;

// Round types
const ROUND_TYPES = ['auction', 'rps', 'auction', 'rps', 'auction'];

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value?.toLocaleString()}`;
};

// Game Result Screen
const GameResultScreen = ({ winner, player1Wins, player2Wins, betAmount, onPlayAgain, onExit }) => {
  const isWinner = winner === 'player1';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-b from-gray-800/50 to-gray-900/50 rounded-2xl p-8 border border-gray-700/50 text-center"
    >
      <div className="relative z-10">
        {isWinner ? (
          <>
            <motion.div
              animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 5 }}
              className="text-8xl mb-4"
            >
              🏆
            </motion.div>
            <h2 className="text-4xl font-bold text-green-400 mb-4">Victory!</h2>
            <p className="text-gray-400 mb-2">You won {player1Wins} - {player2Wins}</p>
            {betAmount > 0 && (
              <motion.p className="text-yellow-400 text-2xl mb-6" animate={{ scale: [1, 1.2, 1] }}>
                +{betAmount * 2} BL Coins 💰
              </motion.p>
            )}
          </>
        ) : (
          <>
            <div className="text-8xl mb-4">😢</div>
            <h2 className="text-4xl font-bold text-red-400 mb-4">Defeat</h2>
            <p className="text-gray-400 mb-2">You lost {player1Wins} - {player2Wins}</p>
            {betAmount > 0 && (
              <p className="text-gray-400 text-2xl mb-6">-{betAmount} BL Coins</p>
            )}
          </>
        )}
        
        <div className="flex gap-4 justify-center">
          <Button onClick={onPlayAgain} className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 px-8 py-4">
            <RefreshCw className="w-5 h-5 mr-2" /> Play Again
          </Button>
          <Button onClick={onExit} variant="outline" className="border-gray-600">
            <X className="w-5 h-5 mr-2" /> Exit
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

// Main Component
export const PVPBattleArena = ({
  gameId,
  session,
  currentUserId,
  currentUsername,
  playerPhotos,  // Current user's 5 photos
  opponentPhotos, // Opponent's 5 photos
  opponentId,
  opponentUsername,
  betAmount = 0,
  pvpRoomId,
  onGameComplete,
  onExit,
}) => {
  // WebSocket connection
  const wsRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);
  const reconnectAttempts = useRef(0);
  
  // Game state
  const [gamePhase, setGamePhase] = useState('ready'); // ready, playing, result
  const [currentRound, setCurrentRound] = useState(1);
  const [roundType, setRoundType] = useState('auction');
  
  // Scores
  const [player1Wins, setPlayer1Wins] = useState(0);
  const [player2Wins, setPlayer2Wins] = useState(0);
  
  // Photo selections
  const [mySelectedPhoto, setMySelectedPhoto] = useState(null);
  const [opponentSelectedPhoto, setOpponentSelectedPhoto] = useState(null);
  const [usedPhotoIds, setUsedPhotoIds] = useState([]);
  
  // Ready states
  const [myReady, setMyReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  
  // RPS money
  const [playerRPSMoney, setPlayerRPSMoney] = useState(STARTING_RPS_MONEY);
  const [opponentRPSMoney, setOpponentRPSMoney] = useState(STARTING_RPS_MONEY);
  
  // Stats for streak calculations
  const [playerStats, setPlayerStats] = useState({ current_win_streak: 0, current_lose_streak: 0 });
  const [opponentStats, setOpponentStats] = useState({ current_win_streak: 0, current_lose_streak: 0 });
  
  // Game winner
  const [gameWinner, setGameWinner] = useState(null);
  
  // Medal celebration
  const [showMedalCelebration, setShowMedalCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);
  
  // Determine if we're player1 (creator) or player2 (joiner)
  const isPlayer1 = session?.player1_id === currentUserId;
  
  // Get WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    if (!pvpRoomId) return null;
    
    const token = localStorage.getItem('blendlink_token');
    if (!token) return null;
    
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = backendUrl.replace(/^https?:\/\//, '');
    
    return `${wsProtocol}://${wsHost}/ws/pvp-game/${pvpRoomId}/${token}`;
  }, [pvpRoomId]);
  
  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('PVP WS message:', data.type, data);
      
      switch (data.type) {
        case 'join_result':
          if (data.success) {
            toast.success('Connected to game room');
          }
          break;
          
        case 'player_connected':
          toast.success(`${data.username} connected`);
          break;
          
        case 'player_disconnected':
          toast.warning(`${data.user_id === opponentId ? 'Opponent' : 'Player'} disconnected`);
          break;
          
        case 'game_forfeit':
          setGameWinner(data.winner_id === currentUserId ? 'player1' : 'player2');
          setGamePhase('result');
          toast.info(`Game ended - ${data.reason}`);
          break;
          
        case 'round_selecting':
        case 'game_state':
          setCurrentRound(data.round || data.current_round || 1);
          setRoundType(data.round_type || ROUND_TYPES[(data.round || 1) - 1]);
          setPlayer1Wins(data.player1_wins || data.player1_score || 0);
          setPlayer2Wins(data.player2_wins || data.player2_score || 0);
          setGamePhase('ready');
          // Reset ready states for new round
          setMyReady(false);
          setOpponentReady(false);
          setMySelectedPhoto(null);
          setOpponentSelectedPhoto(null);
          break;
          
        case 'player_selected_photo':
          if (data.user_id !== currentUserId) {
            // Opponent selected
          }
          break;
          
        case 'photo_selection_confirmed':
          // Our selection confirmed
          break;
          
        case 'round_ready':
          // Both selected - show photos and ready buttons
          if (data.player1_photo && data.player2_photo) {
            if (isPlayer1) {
              setMySelectedPhoto(data.player1_photo);
              setOpponentSelectedPhoto(data.player2_photo);
            } else {
              setMySelectedPhoto(data.player2_photo);
              setOpponentSelectedPhoto(data.player1_photo);
            }
          }
          break;
          
        case 'player_ready':
          if (data.user_id === currentUserId) {
            setMyReady(true);
          } else {
            setOpponentReady(true);
            toast.info(`${opponentUsername || 'Opponent'} is ready!`);
          }
          break;
          
        case 'countdown_start':
          toast.success('🔥 Both ready! Starting countdown...');
          break;
          
        case 'round_start':
          // Transition to playing phase with correct photos
          const myPhoto = isPlayer1 ? data.player1?.photo : data.player2?.photo;
          const oppPhoto = isPlayer1 ? data.player2?.photo : data.player1?.photo;
          
          setMySelectedPhoto(myPhoto);
          setOpponentSelectedPhoto(oppPhoto);
          setGamePhase('playing');
          break;
          
        case 'round_result':
          // Round ended
          setPlayer1Wins(data.player1_wins);
          setPlayer2Wins(data.player2_wins);
          
          // Add used photos
          if (mySelectedPhoto?.mint_id) {
            setUsedPhotoIds(prev => [...prev, mySelectedPhoto.mint_id]);
          }
          break;
          
        case 'game_end':
          setGameWinner(data.winner_user_id === currentUserId ? 'player1' : 'player2');
          setPlayer1Wins(data.player1_wins);
          setPlayer2Wins(data.player2_wins);
          setGamePhase('result');
          break;
          
        case 'auto_selected':
        case 'auto_ready':
          if (data.user_id === currentUserId) {
            toast.warning(`Auto-${data.type === 'auto_selected' ? 'selected' : 'readied'} due to timeout`);
          }
          break;
          
        case 'pong':
          break;
          
        default:
          console.log('Unknown PVP message:', data);
      }
    } catch (err) {
      console.error('Failed to parse PVP WebSocket message:', err);
    }
  }, [currentUserId, opponentId, opponentUsername, isPlayer1, mySelectedPhoto]);
  
  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    const wsUrl = getWebSocketUrl();
    if (!wsUrl) {
      console.log('No WebSocket URL available');
      return;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('PVP WebSocket connected');
        setWsConnected(true);
        reconnectAttempts.current = 0;
        
        // Join the room
        ws.send(JSON.stringify({
          type: 'join',
          username: currentUsername,
          photos: playerPhotos,
          is_creator: isPlayer1,
        }));
      };
      
      ws.onmessage = handleWebSocketMessage;
      
      ws.onerror = (error) => {
        console.error('PVP WebSocket error:', error);
        setWsConnected(false);
      };
      
      ws.onclose = () => {
        console.log('PVP WebSocket closed');
        setWsConnected(false);
        
        // Reconnect
        if (reconnectAttempts.current < 5 && gamePhase !== 'result') {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          setTimeout(connectWebSocket, delay);
        }
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create PVP WebSocket:', err);
      setWsConnected(false);
    }
  }, [getWebSocketUrl, handleWebSocketMessage, currentUsername, playerPhotos, isPlayer1, gamePhase]);
  
  // Connect on mount
  useEffect(() => {
    connectWebSocket();
    
    // Heartbeat
    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    
    return () => {
      clearInterval(heartbeat);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);
  
  // Handle photo selection
  const handlePhotoSelect = useCallback((photo) => {
    setMySelectedPhoto(photo);
  }, []);
  
  // Handle ready
  const handleReady = useCallback(() => {
    setMyReady(true);
  }, []);
  
  // Handle round start (from PVPRoundReady)
  const handleRoundStart = useCallback((data) => {
    const myPhoto = isPlayer1 ? data.player1?.photo : data.player2?.photo;
    const oppPhoto = isPlayer1 ? data.player2?.photo : data.player1?.photo;
    
    setMySelectedPhoto(myPhoto);
    setOpponentSelectedPhoto(oppPhoto);
    setGamePhase('playing');
  }, [isPlayer1]);
  
  // Handle round completion (from TappingArena or RPSBidding)
  const handleRoundComplete = useCallback(async (winner) => {
    // Record round result for medal tracking
    if (mySelectedPhoto?.mint_id) {
      try {
        const res = await api.post('/photo-game/record-round-result', {
          photo_id: mySelectedPhoto.mint_id,
          round_won: winner === 'player',
        });
        
        if (res.data.medal_earned) {
          setCelebrationData({
            photoName: mySelectedPhoto.name || 'Your Photo',
            totalMedals: res.data.total_medals || 1,
            bonusCoins: res.data.bonus_coins || 10000,
          });
          setShowMedalCelebration(true);
        }
      } catch (err) {
        console.error('Failed to record round result:', err);
      }
    }
    
    // Send result to WebSocket for sync
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const winnerUserId = winner === 'player' ? currentUserId : opponentId;
      
      wsRef.current.send(JSON.stringify({
        type: 'round_result',
        winner_user_id: winnerUserId,
        player1_score: isPlayer1 ? (winner === 'player' ? player1Wins + 1 : player1Wins) : (winner === 'player' ? player1Wins : player1Wins + 1),
        player2_score: isPlayer1 ? (winner === 'player' ? player2Wins : player2Wins + 1) : (winner === 'player' ? player2Wins + 1 : player2Wins),
        round_data: {
          round: currentRound,
          type: roundType,
          winner,
        },
      }));
    }
    
    // Update local scores
    if (winner === 'player') {
      const newWins = (isPlayer1 ? player1Wins : player2Wins) + 1;
      if (isPlayer1) {
        setPlayer1Wins(newWins);
      } else {
        setPlayer2Wins(newWins);
      }
      
      // Check for game win
      if (newWins >= WINS_NEEDED) {
        setGameWinner('player1');
        setGamePhase('result');
        return;
      }
    } else {
      const newWins = (isPlayer1 ? player2Wins : player1Wins) + 1;
      if (isPlayer1) {
        setPlayer2Wins(newWins);
      } else {
        setPlayer1Wins(newWins);
      }
      
      // Check for game loss
      if (newWins >= WINS_NEEDED) {
        setGameWinner('player2');
        setGamePhase('result');
        return;
      }
    }
    
    // Add used photo
    if (mySelectedPhoto?.mint_id) {
      setUsedPhotoIds(prev => [...prev, mySelectedPhoto.mint_id]);
    }
    
    // Move to next round (WebSocket will trigger the transition)
  }, [mySelectedPhoto, currentUserId, opponentId, isPlayer1, player1Wins, player2Wins, currentRound, roundType]);
  
  // Handle RPS round complete
  const handleRPSRoundComplete = useCallback((winner, newPlayerMoney, newOpponentMoney) => {
    setPlayerRPSMoney(newPlayerMoney);
    setOpponentRPSMoney(newOpponentMoney);
    handleRoundComplete(winner);
  }, [handleRoundComplete]);
  
  // Handle play again
  const handlePlayAgain = useCallback(() => {
    onGameComplete?.(gameWinner);
  }, [gameWinner, onGameComplete]);
  
  // Build player data for PVPRoundReady
  const player1Data = {
    userId: session?.player1_id,
    username: isPlayer1 ? currentUsername : opponentUsername,
    photos: isPlayer1 ? playerPhotos : opponentPhotos,
    selectedPhotoId: isPlayer1 ? mySelectedPhoto?.mint_id : opponentSelectedPhoto?.mint_id,
    selectedPhoto: isPlayer1 ? mySelectedPhoto : opponentSelectedPhoto,
    isReady: isPlayer1 ? myReady : opponentReady,
  };
  
  const player2Data = {
    userId: session?.player2_id,
    username: isPlayer1 ? opponentUsername : currentUsername,
    photos: isPlayer1 ? opponentPhotos : playerPhotos,
    selectedPhotoId: isPlayer1 ? opponentSelectedPhoto?.mint_id : mySelectedPhoto?.mint_id,
    selectedPhoto: isPlayer1 ? opponentSelectedPhoto : mySelectedPhoto,
    isReady: isPlayer1 ? opponentReady : myReady,
  };
  
  return (
    <div className="min-h-[70vh]" data-testid="pvp-battle-arena">
      {/* Connection status header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          <span className="text-white font-bold">{opponentUsername || 'Opponent'}</span>
        </div>
        <span 
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            wsConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}
        >
          {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {wsConnected ? 'Connected' : 'Reconnecting...'}
        </span>
      </div>
      
      <AnimatePresence mode="wait">
        {/* Ready phase - photo selection and ready buttons */}
        {gamePhase === 'ready' && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <PVPRoundReady
              websocket={wsRef.current}
              currentUserId={currentUserId}
              currentRound={currentRound}
              roundType={roundType}
              player1={player1Data}
              player2={player2Data}
              player1Wins={player1Wins}
              player2Wins={player2Wins}
              usedPhotoIds={usedPhotoIds}
              onRoundStart={handleRoundStart}
              onPhotoSelect={handlePhotoSelect}
              onReady={handleReady}
            />
          </motion.div>
        )}
        
        {/* Playing phase - Tapping Arena */}
        {gamePhase === 'playing' && roundType === 'auction' && (
          <motion.div
            key={`auction-${currentRound}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <TappingArena
              playerPhoto={mySelectedPhoto}
              opponentPhoto={opponentSelectedPhoto}
              playerStats={playerStats}
              opponentStats={opponentStats}
              roundNumber={currentRound}
              onRoundComplete={handleRoundComplete}
              websocket={wsRef.current}
              isBot={false}
              soundEnabled={true}
            />
          </motion.div>
        )}
        
        {/* Playing phase - RPS Bidding */}
        {gamePhase === 'playing' && roundType === 'rps' && (
          <motion.div
            key={`rps-${currentRound}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <RPSBidding
              roundNumber={currentRound}
              playerMoney={playerRPSMoney}
              opponentMoney={opponentRPSMoney}
              playerWins={isPlayer1 ? player1Wins : player2Wins}
              opponentWins={isPlayer1 ? player2Wins : player1Wins}
              onRoundComplete={handleRPSRoundComplete}
              isBot={false}
              soundEnabled={true}
              playerPhoto={mySelectedPhoto}
              opponentPhoto={opponentSelectedPhoto}
            />
          </motion.div>
        )}
        
        {/* Game Result */}
        {gamePhase === 'result' && gameWinner && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <GameResultScreen
              winner={gameWinner}
              player1Wins={isPlayer1 ? player1Wins : player2Wins}
              player2Wins={isPlayer1 ? player2Wins : player1Wins}
              betAmount={betAmount}
              onPlayAgain={handlePlayAgain}
              onExit={onExit}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Medal Celebration */}
      <MedalCelebration
        isVisible={showMedalCelebration}
        photoName={celebrationData?.photoName || 'Photo'}
        totalMedals={celebrationData?.totalMedals || 1}
        bonusCoins={celebrationData?.bonusCoins || 10000}
        onComplete={() => setShowMedalCelebration(false)}
      />
    </div>
  );
};

export default PVPBattleArena;
