import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Coins, Gamepad2, Trophy, Sparkles, Play, CircleDot, AlertCircle, Spade } from "lucide-react";

// Games Components
import SpinWheel from "../components/games/SpinWheel";
import ScratchCard from "../components/games/ScratchCard";
import MemoryMatch from "../components/games/MemoryMatch";

export default function Games() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeGame, setActiveGame] = useState(null);

  const games = [
    {
      id: "spin_wheel",
      name: "Spin Wheel",
      description: "Spin to win up to 10x your bet!",
      cost: 5000,
      icon: CircleDot,
      color: "from-purple-500 to-pink-500",
      comingSoon: true
    },
    {
      id: "scratch_card",
      name: "Scratch Card",
      description: "Match 3 symbols to win big!",
      cost: 10000,
      icon: Sparkles,
      color: "from-emerald-500 to-teal-500",
      comingSoon: true
    },
    {
      id: "memory_match",
      name: "Memory Match",
      description: "Free to play! Earn coins for matching pairs",
      cost: 0,
      icon: Gamepad2,
      color: "from-blue-500 to-indigo-500",
      comingSoon: false  // This can work offline
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
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-bold">Games</h1>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-amber-600">{Math.floor(user?.bl_coins || 0).toLocaleString()}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Casino CTA Banner */}
        <button
          onClick={() => navigate("/casino")}
          className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-2xl p-6 text-white mb-6 text-left hover:scale-[1.02] transition-transform shadow-lg"
          data-testid="casino-cta"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">🎰 NEW!</p>
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

        {/* Balance Card */}
        <div className="bl-coin-gradient rounded-2xl p-6 text-white mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Your Balance</p>
              <p className="text-3xl font-bold">{Math.floor(user?.bl_coins || 0).toLocaleString()} BL</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <Coins className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Mini Games List */}
        <h2 className="font-semibold text-lg mb-4">Mini Games</h2>
        <div className="space-y-4">
          {games.map((game) => (
            <div
              key={game.id}
              className={`bg-card rounded-2xl border border-border/50 overflow-hidden card-hover ${game.comingSoon ? 'opacity-75' : ''}`}
              data-testid={`game-${game.id}`}
            >
              <div className={`h-2 bg-gradient-to-r ${game.color}`} />
              <div className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center`}>
                    <game.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{game.name}</h3>
                      {game.comingSoon && (
                        <span className="px-2 py-0.5 bg-muted text-xs rounded-full">Coming Soon</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{game.description}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Coins className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium">
                        {game.cost === 0 ? "Free" : `${game.cost.toLocaleString()} BL to play`}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      if (game.comingSoon) {
                        toast.info(`${game.name} coming soon to mobile API!`);
                        return;
                      }
                      if (game.cost > 0 && (user?.bl_coins || 0) < game.cost) {
                        toast.error(`You need ${game.cost.toLocaleString()} BL Coins to play`);
                        return;
                      }
                      setActiveGame(game.id);
                    }}
                    className="rounded-full"
                    variant={game.comingSoon ? "outline" : "default"}
                    data-testid={`play-${game.id}`}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    {game.comingSoon ? "Soon" : "Play"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
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
