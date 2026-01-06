import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { ArrowLeft, Coins, RotateCcw } from "lucide-react";

const SEGMENTS = [
  { label: "0", multiplier: 0, color: "#ef4444" },
  { label: "1x", multiplier: 1, color: "#3b82f6" },
  { label: "2x", multiplier: 2, color: "#22c55e" },
  { label: "3x", multiplier: 3, color: "#f59e0b" },
  { label: "5x", multiplier: 5, color: "#8b5cf6" },
  { label: "10x", multiplier: 10, color: "#ec4899" },
  { label: "0", multiplier: 0, color: "#ef4444" },
  { label: "1x", multiplier: 1, color: "#3b82f6" },
];

export default function SpinWheel({ onComplete, user }) {
  const navigate = useNavigate();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);

  const spin = async () => {
    if (spinning) return;
    if ((user?.bl_coins || 0) < 5) {
      toast.error("Not enough BL Coins");
      return;
    }

    setSpinning(true);
    setResult(null);

    try {
      const response = await api.games.spinWheel();
      const { result: gameResult, winnings, new_balance } = response;

      // Find segment index
      const segmentIndex = SEGMENTS.findIndex(s => s.multiplier === gameResult.multiplier);
      const segmentAngle = 360 / SEGMENTS.length;
      const targetAngle = segmentIndex * segmentAngle;
      const spins = 5 + Math.random() * 3;
      const finalRotation = rotation + (spins * 360) + (360 - targetAngle) + (segmentAngle / 2);

      setRotation(finalRotation);

      setTimeout(() => {
        setSpinning(false);
        setResult({ ...gameResult, winnings, new_balance });
        
        if (winnings > 0) {
          toast.success(`You won ${winnings} BL Coins!`);
        } else {
          toast.error("Better luck next time!");
        }
      }, 4000);
    } catch (error) {
      setSpinning(false);
      toast.error(error.message || "Failed to spin");
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
          <h1 className="font-bold">Spin Wheel</h1>
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-amber-600">
              {Math.floor(result?.new_balance ?? user?.bl_coins ?? 0)}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-8">
        {/* Wheel */}
        <div className="relative w-72 h-72 mx-auto mb-8">
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
            <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-primary" />
          </div>

          {/* Wheel */}
          <div
            className="w-full h-full rounded-full shadow-2xl spin-wheel"
            style={{
              transform: `rotate(${rotation}deg)`,
              background: `conic-gradient(${SEGMENTS.map((s, i) => 
                `${s.color} ${i * (100/SEGMENTS.length)}% ${(i + 1) * (100/SEGMENTS.length)}%`
              ).join(", ")})`
            }}
          >
            {SEGMENTS.map((segment, i) => (
              <div
                key={i}
                className="absolute w-full h-full flex items-center justify-center"
                style={{
                  transform: `rotate(${i * (360/SEGMENTS.length) + (180/SEGMENTS.length)}deg)`
                }}
              >
                <span className="absolute text-white font-bold text-lg" style={{ top: "20%" }}>
                  {segment.label}
                </span>
              </div>
            ))}
          </div>

          {/* Center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center">
              <span className="font-bold text-primary">BL</span>
            </div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className="text-center mb-6 animate-fade-in">
            <p className="text-lg font-medium mb-2">
              {result.winnings > 0 ? (
                <span className="text-green-500">
                  Won {result.winnings} BL Coins!
                </span>
              ) : (
                <span className="text-muted-foreground">No win this time</span>
              )}
            </p>
          </div>
        )}

        {/* Spin Button */}
        <div className="text-center">
          <Button
            size="lg"
            className="rounded-full px-10"
            onClick={spin}
            disabled={spinning}
            data-testid="spin-btn"
          >
            {spinning ? (
              <>
                <RotateCcw className="w-5 h-5 mr-2 animate-spin" />
                Spinning...
              </>
            ) : (
              <>
                <Coins className="w-5 h-5 mr-2" />
                Spin (5 BL)
              </>
            )}
          </Button>
        </div>

        {/* Info */}
        <div className="mt-8 bg-muted/50 rounded-xl p-4">
          <h3 className="font-semibold mb-2">How to Play</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Each spin costs 5 BL Coins</li>
            <li>• Win up to 10x your bet</li>
            <li>• The wheel determines your multiplier</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
