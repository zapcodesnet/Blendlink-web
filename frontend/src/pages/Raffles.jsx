import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import ComingSoonPlaceholder from "../components/ComingSoonPlaceholder";
import { 
  ArrowLeft, Trophy, Clock, Users, Coins, Ticket
} from "lucide-react";

export default function Raffles() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [raffles, setRaffles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRaffles();
  }, []);

  const fetchRaffles = async () => {
    try {
      const data = await api.raffles.getRaffles();
      setRaffles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Raffles error:", error);
      setRaffles([]);
    } finally {
      setLoading(false);
    }
  };

  const enterRaffle = async (raffleId) => {
    try {
      const response = await api.raffles.enterRaffle(raffleId);
      toast.success("Entered raffle successfully!");
      if (response.new_balance !== undefined) {
        setUser({ ...user, bl_coins: response.new_balance });
      }
      fetchRaffles();
    } catch (error) {
      toast.error(error.message || "Failed to enter raffle");
    }
  };

  const getTimeRemaining = (endDate) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end - now;
    
    if (diff <= 0) return "Ended";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">Raffles & Contests</h1>
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-amber-600">{Math.floor(user?.bl_coins || 0).toLocaleString()}</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-4 border border-border/50">
                <div className="h-6 w-1/2 skeleton rounded mb-2" />
                <div className="h-4 w-3/4 skeleton rounded mb-4" />
                <div className="h-10 skeleton rounded" />
              </div>
            ))}
          </div>
        ) : raffles.length === 0 ? (
          <ComingSoonPlaceholder
            icon={Trophy}
            title="Raffles & Contests Coming Soon"
            description="Enter raffles and contests to win amazing prizes"
          />
        ) : (
          <div className="space-y-4">
            {raffles.map((raffle) => (
              <div 
                key={raffle.raffle_id}
                className="bg-card rounded-xl border border-border/50 overflow-hidden"
                data-testid={`raffle-${raffle.raffle_id}`}
              >
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-5 h-5" />
                    <span className="font-semibold">{raffle.title}</span>
                  </div>
                  <p className="text-2xl font-bold">{raffle.prize}</p>
                </div>
                
                <div className="p-4">
                  <p className="text-muted-foreground text-sm mb-4">
                    {raffle.description}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm mb-4">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {getTimeRemaining(raffle.end_date)}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {raffle.current_entries}/{raffle.max_entries}
                    </div>
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-amber-500" />
                      {raffle.entry_cost} BL
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-muted rounded-full mb-4">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${(raffle.current_entries / raffle.max_entries) * 100}%` }}
                    />
                  </div>

                  <Button
                    className="w-full rounded-full"
                    disabled={raffle.current_entries >= raffle.max_entries}
                    onClick={() => enterRaffle(raffle.raffle_id)}
                    data-testid={`enter-${raffle.raffle_id}`}
                  >
                    <Ticket className="w-4 h-4 mr-2" />
                    Enter Raffle ({raffle.entry_cost} BL)
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sync Notice */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          🔄 Synced with Blendlink mobile app
        </p>
      </main>
    </div>
  );
}
