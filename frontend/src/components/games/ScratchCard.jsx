import React, { useState, useContext } from "react";
import api from "../../services/api";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { ArrowLeft, Coins, Sparkles } from "lucide-react";

const SYMBOLS = {
  coin: "🪙",
  star: "⭐",
  diamond: "💎",
  seven: "7️⃣",
  cherry: "🍒",
  bell: "🔔"
};

export default function ScratchCard({ onComplete, user }) {
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState(null);
  const [scratched, setScratched] = useState(Array(9).fill(false));

  const startGame = async () => {
    if ((user?.bl_coins || 0) < 10) {
      toast.error("Not enough BL Coins");
      return;
    }

    setPlaying(true);
    setRevealed(false);
    setScratched(Array(9).fill(false));
    setResult(null);

    try {
      const response = await api.games.scratchCard();
      setResult(response);
    } catch (error) {
      setPlaying(false);
      toast.error(error.message || "Failed to get scratch card");
    }
  };

  const scratchCell = (index) => {
    if (!playing || !result) return;
    
    const newScratched = [...scratched];
    newScratched[index] = true;
    setScratched(newScratched);

    if (newScratched.every(s => s)) {
      setRevealed(true);
      if (result.winnings > 0) {
        toast.success(`You won ${result.winnings} BL Coins!`);
      } else {
        toast.error("No match this time!");
      }
    }
  };

  const revealAll = () => {
    if (!result) return;
    setScratched(Array(9).fill(true));
    setRevealed(true);
    if (result.winnings > 0) {
      toast.success(`You won ${result.winnings} BL Coins!`);
    } else {
      toast.error("No match this time!");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => onComplete(result || {})}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">Scratch Card</h1>
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-amber-600">
              {Math.floor(result?.new_balance ?? user?.bl_coins ?? 0)}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8">
        {/* Scratch Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-6 mb-6">
          <h2 className="text-white font-bold text-xl text-center mb-4">
            {playing ? "Scratch to reveal!" : "Match 3 to WIN!"}
          </h2>
          
          <div className="grid grid-cols-3 gap-2 bg-white/20 rounded-xl p-2">
            {Array(9).fill(0).map((_, i) => {
              const row = Math.floor(i / 3);
              const col = i % 3;
              const symbol = result?.card?.[row]?.[col];
              
              return (
                <button
                  key={i}
                  onClick={() => scratchCell(i)}
                  disabled={!playing || scratched[i]}
                  className={`aspect-square rounded-xl text-3xl flex items-center justify-center transition-all ${
                    scratched[i] 
                      ? "bg-white shadow-inner" 
                      : "bg-gray-300 hover:bg-gray-200 cursor-pointer"
                  } ${result?.winning_lines?.some(l => 
                    (l === `row_${row}`) || 
                    (l === 'diagonal_1' && i === 0 || i === 4 || i === 8) ||
                    (l === 'diagonal_2' && i === 2 || i === 4 || i === 6)
                  ) ? 'ring-4 ring-amber-400' : ''}`}
                  data-testid={`cell-${i}`}
                >
                  {scratched[i] && symbol ? SYMBOLS[symbol] : "?"}
                </button>
              );
            })}
          </div>

          {playing && !revealed && (
            <Button 
              variant="secondary" 
              className="w-full mt-4"
              onClick={revealAll}
            >
              Reveal All
            </Button>
          )}
        </div>

        {/* Result */}
        {revealed && result && (
          <div className="text-center mb-6 animate-fade-in">
            <p className="text-lg font-medium">
              {result.winnings > 0 ? (
                <span className="text-green-500">
                  You won {result.winnings} BL Coins! 🎉
                </span>
              ) : (
                <span className="text-muted-foreground">
                  No matching lines. Try again!
                </span>
              )}
            </p>
          </div>
        )}

        {/* Play Button */}
        <div className="text-center">
          <Button
            size="lg"
            className="rounded-full px-10"
            onClick={startGame}
            disabled={playing && !revealed}
            data-testid="new-card-btn"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {playing && !revealed ? "Scratching..." : "New Card (10 BL)"}
          </Button>
        </div>

        {/* Info */}
        <div className="mt-8 bg-muted/50 rounded-xl p-4">
          <h3 className="font-semibold mb-2">How to Win</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Match 3 in a row horizontally</li>
            <li>• Match 3 diagonally</li>
            <li>• 💎 Diamond row = 10x</li>
            <li>• 7️⃣ Seven row = 5x</li>
            <li>• Other matches = 2-3x</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
