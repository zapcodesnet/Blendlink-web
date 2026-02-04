import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Gamepad2, Trophy, Sparkles, Play, CircleDot, Spade, Swords, Image, Store, Lock } from "lucide-react";

// Games Components
import SpinWheel from "../components/games/SpinWheel";
import ScratchCard from "../components/games/ScratchCard";
import MemoryMatch from "../components/games/MemoryMatch";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Admin email for full access
const ADMIN_EMAIL = "blendlinknet@gmail.com";

export default function Games() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeGame, setActiveGame] = useState(null);
  const [gameStats, setGameStats] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);

  // Check if current user is admin
  const isAdmin = user?.email === ADMIN_EMAIL || user?.role === 'admin' || user?.is_admin === true;

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

  // Casino mini-games (nested inside Casino Games section)
  const casinoMiniGames = [
    {
      id: "spin_wheel",
      name: "Spin Wheel",
      description: "Spin to win up to 5x your bet!",
      icon: CircleDot,
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500",
    },
    {
      id: "scratch_card",
      name: "Scratch Card",
      description: "Match 3 symbols to win big!",
      icon: Sparkles,
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-500",
    },
    {
      id: "memory_match",
      name: "Memory Match",
      description: "Free to play! Earn coins for matching pairs",
      icon: Gamepad2,
      color: "from-blue-500 to-indigo-500",
      bgColor: "bg-blue-500",
    }
  ];

  const handleGameComplete = async (result) => {
    if (result.new_balance !== undefined) {
      setUser({ ...user, bl_coins: result.new_balance });
    } else {
      try {
        const balance = await api.wallet.getBalance();
        setUser({ ...user, bl_coins: balance.balance });
      } catch (e) {}
    }
    setActiveGame(null);
  };

  const handleCasinoGameClick = (game) => {
    if (!isAdmin) {
      toast.info("Casino Games coming soon! Stay tuned.");
      return;
    }
    setActiveGame(game.id);
  };

  // Render active game
  if (activeGame === "spin_wheel") {
    return <SpinWheel onComplete={handleGameComplete} user={user} />;
  }
  if (activeGame === "scratch_card") {
    return <ScratchCard onComplete={handleGameComplete} user={user} />;
  }
  if (activeGame === "memory_match") {
    return <MemoryMatch onComplete={handleGameComplete} user={user} />;
  }

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

        {/* SINGLE Casino Games Section - Contains ALL mini-games */}
        <div 
          className={`rounded-2xl overflow-hidden shadow-lg ${
            isAdmin 
              ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-red-500' 
              : 'bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800'
          }`}
          data-testid="casino-games-section"
        >
          {/* Casino Header */}
          <div className="p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium opacity-80">🎰 CASINO</span>
                  {!isAdmin && (
                    <span className="px-2 py-0.5 bg-amber-500 text-xs font-bold rounded-full">Coming Soon</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold">Casino Games</h2>
                {!isAdmin && (
                  <p className="text-sm opacity-80 mt-1">Exciting games launching soon!</p>
                )}
              </div>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isAdmin ? 'bg-white/20' : 'bg-white/10'}`}>
                {isAdmin ? (
                  <Spade className="w-7 h-7" />
                ) : (
                  <Lock className="w-7 h-7 opacity-60" />
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2 text-sm">
              {isAdmin ? (
                <>
                  <span className="px-3 py-1 bg-white/20 rounded-full">Bet 10-10,000 BL</span>
                  <span className="px-3 py-1 bg-white/20 rounded-full">Provably Fair</span>
                </>
              ) : (
                <span className="px-3 py-1 bg-white/10 rounded-full opacity-70">Stay Tuned!</span>
              )}
            </div>
          </div>

          {/* Mini-Games Grid - NESTED INSIDE */}
          <div className={`p-4 ${isAdmin ? 'bg-black/10' : 'bg-black/20'}`}>
            <div className="grid gap-3">
              {casinoMiniGames.map((game) => (
                <div
                  key={game.id}
                  onClick={() => handleCasinoGameClick(game)}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                    isAdmin 
                      ? 'bg-white/10 hover:bg-white/20 cursor-pointer' 
                      : 'bg-white/5 cursor-not-allowed'
                  }`}
                  data-testid={`casino-game-${game.id}`}
                >
                  {/* Game Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center relative ${
                    isAdmin ? game.bgColor : 'bg-gray-600'
                  }`}>
                    <game.icon className={`w-6 h-6 ${isAdmin ? 'text-white' : 'text-gray-400'}`} />
                    {!isAdmin && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-800 rounded-full flex items-center justify-center border border-gray-600">
                        <Lock className="w-3 h-3 text-amber-500" />
                      </div>
                    )}
                  </div>

                  {/* Game Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-semibold ${isAdmin ? 'text-white' : 'text-gray-300'}`}>
                      {game.name}
                    </h3>
                    <p className={`text-sm ${isAdmin ? 'text-white/70' : 'text-gray-500'}`}>
                      {game.description}
                    </p>
                  </div>

                  {/* Action Button */}
                  {isAdmin ? (
                    <Button size="sm" className="rounded-full bg-white/20 hover:bg-white/30 text-white">
                      <Play className="w-4 h-4 mr-1" />
                      Play
                    </Button>
                  ) : (
                    <span className="px-3 py-1 bg-gray-700/50 text-gray-400 text-xs rounded-full">
                      Locked
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer CTA */}
          {isAdmin && (
            <button
              onClick={() => navigate("/casino")}
              className="w-full py-3 bg-black/20 text-white text-sm font-medium hover:bg-black/30 transition-colors"
            >
              View All Casino Games →
            </button>
          )}
        </div>

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
