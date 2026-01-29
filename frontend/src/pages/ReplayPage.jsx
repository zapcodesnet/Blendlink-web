/**
 * ReplayPage - Public Battle Replay Viewer
 * 
 * Accessible at /replay/:replay_id
 * Shows battle replay with sharing options
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, AlertCircle, Film } from 'lucide-react';
import { Button } from '../components/ui/button';
import { BattleReplayViewer } from '../components/game/BattleReplayViewer';
import api from '../api';

const ReplayPage = () => {
  const { replayId } = useParams();
  const navigate = useNavigate();
  const [replay, setReplay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchReplay = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/photo-game/battle-replay/${replayId}`);
        setReplay(response.data);
      } catch (err) {
        console.error('Failed to fetch replay:', err);
        setError(err.response?.data?.detail || 'Replay not found');
      } finally {
        setLoading(false);
      }
    };
    
    if (replayId) {
      fetchReplay();
    }
  }, [replayId]);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading replay...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 rounded-2xl p-8 max-w-md w-full text-center border border-red-500/30"
        >
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Replay Not Found</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Button onClick={() => navigate('/photo-game')} className="bg-purple-600">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go to Photo Game
          </Button>
        </motion.div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800/50 border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link 
            to="/photo-game" 
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Photo Game</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-white">Battle Replay</span>
          </div>
          
          <Link 
            to="/feed" 
            className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            View Feed →
          </Link>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {replay && (
          <BattleReplayViewer 
            replay={replay}
            autoPlay={true}
          />
        )}
        
        {/* Related replays or CTA */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 mb-4">Want to play your own battles?</p>
          <Link to="/photo-game">
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
              🎮 Play Bot Battle
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default ReplayPage;
