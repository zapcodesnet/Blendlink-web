import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { toast } from "sonner";
import { Gamepad2, Trophy, Swords, Image, Store, Lock } from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Admin email for full access
const ADMIN_EMAIL = "blendlinknet@gmail.com";

export default function Games() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [gameStats, setGameStats] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);

  // Fetch game stats and queue status
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('blendlink_token');
        if (!token) return;

        const [statsRes, queueRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/photo-game/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }).then(r => r.ok ? r.json() : null),
          fetch(`${API_BASE_URL}/api/photo-game/pvp/queue-status`).then(r => r.ok ? r.json() : null)
        ]);

        setGameStats(statsRes);
        setQueueStatus(queueRes);
      } catch (e) {
        console.error('Failed to fetch game data:', e);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle Casino card click - navigates to Casino screen
  const handleCasinoClick = () => {
    navigate("/casino");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - BL Coins balance REMOVED */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <h1 className="text-xl font-bold">Games</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Photo Battle Arena CTA - FEATURED */}
        <button
          onClick={() => navigate("/photo-game")}
          className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 rounded-2xl p-6 text-white text-left hover:scale-[1.02] transition-transform shadow-lg relative overflow-hidden"
          data-testid="photo-battle-cta"
        >
          <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500 text-xs font-bold rounded-full animate-pulse">
            ⚡ NEW
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">⚔️ PvP BATTLES</p>
              <p className="text-2xl font-bold mt-1">Photo Battle Arena</p>
              <p className="text-sm text-white/90 mt-1">Rock-Paper-Scissors • Photo Auctions • Win BL Coins!</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <Swords className="w-8 h-8" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm flex-wrap">
            {gameStats && (
              <>
                <span className="px-3 py-1 bg-white/20 rounded-full">🏆 {gameStats.battles_won || 0} Wins</span>
                <span className="px-3 py-1 bg-white/20 rounded-full">🔥 {gameStats.current_win_streak || 0} Streak</span>
              </>
            )}
            {queueStatus && (
              <span className="px-3 py-1 bg-emerald-500/30 rounded-full">👥 {queueStatus.players_waiting} Searching</span>
            )}
          </div>
        </button>

        {/* Minted Photos & Marketplace Row */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate("/minted-photos")}
            className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white text-left hover:scale-[1.02] transition-transform shadow-lg"
            data-testid="minted-photos-cta"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
              <Image className="w-5 h-5" />
            </div>
            <p className="font-bold">✨ Minted Photos</p>
            <p className="text-xs text-white/80 mt-1">Mint collectibles</p>
          </button>

          <button
            onClick={() => navigate("/marketplace")}
            className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white text-left hover:scale-[1.02] transition-transform shadow-lg"
            data-testid="photo-marketplace-cta"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-3">
              <Store className="w-5 h-5" />
            </div>
            <p className="font-bold">🏪 Marketplace</p>
            <p className="text-xs text-white/80 mt-1">Buy & Sell Photos</p>
          </button>
        </div>

        {/* Casino Games Teaser Card - PURE REDIRECT, NO NESTED GAMES */}
        <button
          onClick={handleCasinoClick}
          className="w-full rounded-2xl overflow-hidden shadow-lg text-left hover:scale-[1.01] transition-transform bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900"
          data-testid="casino-games-teaser"
        >
          <div className="p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium opacity-80">🎰 CASINO</span>
                  <span className="px-2 py-0.5 bg-amber-500 text-xs font-bold rounded-full">Coming Soon</span>
                </div>
                <h2 className="text-2xl font-bold">Casino Games</h2>
                <p className="text-sm opacity-80 mt-1">Exciting games launching soon!</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                <Lock className="w-7 h-7 opacity-60" />
              </div>
            </div>

            {/* Teaser Preview - Game icons */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex -space-x-2">
                <span className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-lg border-2 border-gray-800">🎰</span>
                <span className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-lg border-2 border-gray-800">🃏</span>
                <span className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-lg border-2 border-gray-800">🎡</span>
                <span className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-lg border-2 border-gray-800">🎲</span>
                <span className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center text-lg border-2 border-gray-800">🎴</span>
              </div>
              <span className="text-sm text-gray-400">+4 more games</span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="px-3 py-1 bg-white/10 rounded-full opacity-70">Stay Tuned!</span>
            </div>
          </div>

          {/* View Casino Link */}
          <div className="px-6 py-3 bg-black/30 text-center">
            <span className="text-white/70 text-sm font-medium">View Casino Games →</span>
          </div>
        </button>

        {/* Raffles Link */}
        <div>
          <h2 className="font-semibold text-lg mb-4">Contests</h2>
          <button
            onClick={() => navigate("/raffles")}
            className="w-full bg-card rounded-2xl border border-border/50 p-4 card-hover text-left"
            data-testid="raffles-link"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Trophy className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Raffles & Contests</h3>
                <p className="text-sm text-muted-foreground">Enter for a chance to win big prizes!</p>
              </div>
            </div>
          </button>
        </div>

        {/* Sync Notice */}
        <p className="text-center text-xs text-muted-foreground pt-4">
          🔄 Synced with Blendlink mobile app
        </p>
      </main>
    </div>
  );
}
