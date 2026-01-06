import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, API } from "../App";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Coins, Gamepad2, Trophy, Sparkles, Play, CircleDot } from "lucide-react";

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
      cost: 5,
      icon: CircleDot,
      color: "from-purple-500 to-pink-500"
    },
    {
      id: "scratch_card",
      name: "Scratch Card",
      description: "Match 3 symbols to win big!",
      cost: 10,
      icon: Sparkles,
      color: "from-emerald-500 to-teal-500"
    },
    {
      id: "memory_match",
      name: "Memory Match",
      description: "Free to play! Earn coins for matching pairs",
      cost: 0,
      icon: Gamepad2,
      color: "from-blue-500 to-indigo-500"
    }
  ];

  const handleGameComplete = (result) => {
    if (result.new_balance !== undefined) {
      setUser({ ...user, bl_coins: result.new_balance });
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
            <span className="font-semibold text-amber-600">{Math.floor(user?.bl_coins || 0)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Balance Card */}
        <div className="bl-coin-gradient rounded-2xl p-6 text-white mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Your Balance</p>
              <p className="text-3xl font-bold">{Math.floor(user?.bl_coins || 0)} BL</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <Coins className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Games List */}
        <h2 className="font-semibold text-lg mb-4">Play & Win</h2>
        <div className="space-y-4">
          {games.map((game) => (
            <div
              key={game.id}
              className="bg-card rounded-2xl border border-border/50 overflow-hidden card-hover"
              data-testid={`game-${game.id}`}
            >
              <div className={`h-2 bg-gradient-to-r ${game.color}`} />
              <div className="p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${game.color} flex items-center justify-center`}>
                    <game.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{game.name}</h3>
                    <p className="text-sm text-muted-foreground">{game.description}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Coins className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium">
                        {game.cost === 0 ? "Free" : `${game.cost} BL to play`}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      if (game.cost > 0 && (user?.bl_coins || 0) < game.cost) {
                        toast.error(`You need ${game.cost} BL Coins to play`);
                        return;
                      }
                      setActiveGame(game.id);
                    }}
                    className="rounded-full"
                    data-testid={`play-${game.id}`}
                  >
                    <Play className="w-4 h-4 mr-1" />
                    Play
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
      </main>
    </div>
  );
}
