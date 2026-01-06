import React, { useState, useEffect, useRef } from "react";
import { API } from "../../App";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { ArrowLeft, Coins, Trophy, RotateCcw } from "lucide-react";

const CARD_ICONS = ["🎮", "🎯", "🎨", "🎭", "🎪", "🎬", "🎸", "🎺"];

export default function MemoryMatch({ onComplete, user }) {
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    initGame();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (startTime && !gameOver) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTime, gameOver]);

  const initGame = () => {
    const shuffled = [...CARD_ICONS, ...CARD_ICONS]
      .map((icon, index) => ({ id: index, icon, matched: false }))
      .sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setGameOver(false);
    setStartTime(null);
    setElapsedTime(0);
  };

  const handleCardClick = (index) => {
    if (!startTime) setStartTime(Date.now());
    if (flipped.length === 2 || flipped.includes(index) || matched.includes(index)) return;

    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves(moves + 1);
      const [first, second] = newFlipped;
      
      if (cards[first].icon === cards[second].icon) {
        const newMatched = [...matched, first, second];
        setMatched(newMatched);
        setFlipped([]);
        
        if (newMatched.length === cards.length) {
          handleGameComplete();
        }
      } else {
        setTimeout(() => setFlipped([]), 1000);
      }
    }
  };

  const handleGameComplete = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameOver(true);
    
    const finalTime = Math.floor((Date.now() - startTime) / 1000);
    
    try {
      const response = await axios.post(
        `${API}/games/memory-match`,
        { moves: moves + 1, time_seconds: finalTime },
        { withCredentials: true }
      );
      
      toast.success(`Completed! You earned ${response.data.reward} BL Coins!`);
      setTimeout(() => onComplete(response.data), 2000);
    } catch (error) {
      toast.error("Failed to save game result");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => onComplete({})}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">Memory Match</h1>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Moves: {moves}</span>
            <span className="text-muted-foreground">Time: {elapsedTime}s</span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        {/* Info */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl p-4 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Free to play!</p>
              <p className="font-semibold">Match all pairs to earn coins</p>
            </div>
            <Trophy className="w-8 h-8" />
          </div>
        </div>

        {/* Game Board */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {cards.map((card, index) => {
            const isFlipped = flipped.includes(index) || matched.includes(index);
            return (
              <button
                key={card.id}
                onClick={() => handleCardClick(index)}
                className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all duration-300 ${
                  isFlipped 
                    ? "bg-white shadow-lg" 
                    : "bg-primary hover:bg-primary/90"
                } ${matched.includes(index) ? "ring-2 ring-green-500" : ""}`}
                disabled={gameOver}
                data-testid={`card-${index}`}
              >
                {isFlipped ? card.icon : "?"}
              </button>
            );
          })}
        </div>

        {/* Game Over */}
        {gameOver && (
          <div className="text-center animate-fade-in">
            <div className="bg-green-500/10 rounded-xl p-6 mb-4">
              <Trophy className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <h2 className="text-xl font-bold text-green-500">Congratulations!</h2>
              <p className="text-muted-foreground">
                Completed in {moves} moves and {elapsedTime} seconds
              </p>
            </div>
          </div>
        )}

        {/* Reset Button */}
        <div className="text-center">
          <Button
            variant="outline"
            onClick={initGame}
            className="rounded-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            New Game
          </Button>
        </div>

        {/* Rewards Info */}
        <div className="mt-8 bg-muted/50 rounded-xl p-4">
          <h3 className="font-semibold mb-2">Earn More Coins</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Base reward: 5 BL Coins</li>
            <li>• Under 12 moves: +10 bonus</li>
            <li>• Under 30 seconds: +5 bonus</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
