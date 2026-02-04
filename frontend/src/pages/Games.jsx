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

  // Casino games that are locked for regular users
  const casinoGames = [
    {
      id: "spin_wheel",
      name: "Spin Wheel",
      description: "Spin to win up to 10x your bet!",
      cost: 5000,
      icon: CircleDot,
      color: "from-purple-500 to-pink-500",
    },
    {
      id: "scratch_card",
      name: "Scratch Card",
      description: "Match 3 symbols to win big!",
      cost: 10000,
      icon: Sparkles,
      color: "from-emerald-500 to-teal-500",
    },
    {
      id: "memory_match",
      name: "Memory Match",
      description: "Free to play! Earn coins for matching pairs",
      cost: 0,
      icon: Gamepad2,
      color: "from-blue-500 to-indigo-500",
    }
  ];

  const handleGameComplete = async (result) => {
    if (result.new_balance !== undefined) {
      setUser({ ...user, bl_coins: result.new_balance });
    } else {
      // Refresh balance from API
      try {
        const balance = await api.wallet.getBalance();
        setUser({ ...user, bl_coins: balance.balance });
      } catch (e) {
        // Ignore
      }
    }
    setActiveGame(null);
  };

  // Handle casino game click (only for admin)
  const handleCasinoGameClick = (game) => {
    if (!isAdmin) {
      toast.info("Casino Games coming soon! Stay tuned.");
      return;
    }
    
    if (game.cost > 0 && (user?.bl_coins || 0) < game.cost) {
      toast.error(`You need ${game.cost.toLocaleString()} BL Coins to play`);
      return;
    }
    setActiveGame(game.id);
  };

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
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-bold">Games</h1>
          {/* Balance display removed from Games page */}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Photo Battle Arena CTA - FEATURED */}
        <button
          onClick={() => navigate("/photo-game")}
          className="w-full bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 rounded-2xl p-6 text-white mb-4 text-left hover:scale-[1.02] transition-transform shadow-lg relative overflow-hidden"
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
        <div className="grid grid-cols-2 gap-4 mb-6">
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

        {/* Casino CTA Banner - Admin Only Full Access */}
        {isAdmin ? (
          <button
            onClick={() => navigate("/casino")}
            className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-2xl p-6 text-white mb-6 text-left hover:scale-[1.02] transition-transform shadow-lg"
            data-testid="casino-cta"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">🎰 CASINO</p>
                <p className="text-2xl font-bold mt-1">Casino Games</p>
                <p className="text-sm text-white/90 mt-1">Blackjack • Slots • Roulette • Poker & More!</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <Spade className="w-8 h-8" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="px-3 py-1 bg-white/20 rounded-full">Bet 10-10,000 BL</span>
              <span className="px-3 py-1 bg-white/20 rounded-full">Provably Fair</span>
            </div>
          </button>
        ) : (
          <div
            className="w-full bg-gradient-to-r from-gray-600 via-gray-700 to-gray-600 rounded-2xl p-6 text-white mb-6 text-left opacity-70 cursor-not-allowed"
            data-testid="casino-cta-coming-soon"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">🎰 CASINO</p>
                <p className="text-2xl font-bold mt-1">Casino Games</p>
                <p className="text-lg text-amber-400 mt-2 font-bold">🚧 Coming Soon</p>
              </div>
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <Spade className="w-8 h-8" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="px-3 py-1 bg-white/20 rounded-full">Stay Tuned!</span>
            </div>
          </div>
        )}

        {/* Casino Games Section - Locked/Coming Soon for Regular Users */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              🎰 Casino Games
              {!isAdmin && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 text-xs rounded-full flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Coming Soon
                </span>
              )}
            </h2>
          </div>

          <div className={`space-y-4 ${!isAdmin ? 'relative' : ''}`}>
            {/* Overlay for non-admin users */}
            {!isAdmin && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 rounded-2xl flex items-center justify-center">
                <div className="text-center p-6">
                  <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center mb-3">
                    <Lock className="w-8 h-8 text-amber-500" />
                  </div>
                  <p className="text-lg font-bold text-white">Coming Soon</p>
                  <p className="text-sm text-muted-foreground mt-1">These games are currently in development</p>
                </div>
              </div>
            )}

            {casinoGames.map((game) => (
              <div
                key={game.id}
                className={`bg-card rounded-2xl border border-border/50 overflow-hidden ${
                  isAdmin ? 'card-hover cursor-pointer' : 'opacity-60 grayscale'
                }`}
                onClick={() => isAdmin && handleCasinoGameClick(game)}
                data-testid={`casino-game-${game.id}`}
              >
                <div className={`h-2 bg-gradient-to-r ${game.color}`} />
                <div className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center relative`}>
                      <game.icon className="w-7 h-7 text-white" />
                      {!isAdmin && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-700">
                          <Lock className="w-3 h-3 text-amber-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{game.name}</h3>
                        {!isAdmin && (
                          <span className="px-2 py-0.5 bg-muted text-xs rounded-full">Locked</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{game.description}</p>
                    </div>
                    <Button
                      className="rounded-full"
                      variant={isAdmin ? "default" : "outline"}
                      disabled={!isAdmin}
                      data-testid={`play-casino-${game.id}`}
                    >
                      {isAdmin ? (
                        <>
                          <Play className="w-4 h-4 mr-1" />
                          Play
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-1" />
                          Locked
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Raffles Link */}
        <div className="mt-8">
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
        <p className="text-center text-xs text-muted-foreground mt-8">
          🔄 Synced with Blendlink mobile app
        </p>
      </main>
    </div>
  );
}
