import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, API } from "../App";
import axios from "axios";
import { Button } from "../components/ui/button";
import { 
  Coins, TrendingUp, ArrowUpRight, ArrowDownRight, 
  Gift, Gamepad2, Trophy, Share2, ChevronRight
} from "lucide-react";

export default function Wallet() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const [statsRes, txnRes] = await Promise.all([
        axios.get(`${API}/wallet/stats`, { withCredentials: true }),
        axios.get(`${API}/wallet/transactions`, { withCredentials: true })
      ]);
      setStats(statsRes.data);
      setTransactions(txnRes.data);
      setUser({ ...user, bl_coins: statsRes.data.balance });
    } catch (error) {
      console.error("Wallet error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case "referral": return Share2;
      case "game": return Gamepad2;
      case "raffle": return Trophy;
      case "earn": return Gift;
      default: return Coins;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <h1 className="text-xl font-bold">Wallet</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Balance Card */}
        <div className="bl-coin-gradient rounded-2xl p-6 text-white mb-6 animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/80 text-sm">Total Balance</p>
              <p className="text-4xl font-bold mt-1">
                {loading ? "..." : Math.floor(stats?.balance || 0)}
              </p>
              <p className="text-white/80 text-sm mt-1">BL Coins</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Coins className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => navigate("/games")}
            className="bg-card rounded-xl p-4 border border-border/50 card-hover text-left"
            data-testid="earn-coins-btn"
          >
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <p className="font-semibold">Earn Coins</p>
            <p className="text-xs text-muted-foreground">Play games & tasks</p>
          </button>
          <button
            onClick={() => navigate("/referrals")}
            className="bg-card rounded-xl p-4 border border-border/50 card-hover text-left"
            data-testid="referrals-btn"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
              <Share2 className="w-5 h-5 text-blue-500" />
            </div>
            <p className="font-semibold">Invite Friends</p>
            <p className="text-xs text-muted-foreground">Earn 50 BL each</p>
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="bg-card rounded-xl border border-border/50 p-4 mb-6">
            <h2 className="font-semibold mb-4">Earnings Breakdown</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Referrals</span>
                <span className="font-medium text-green-500">
                  +{stats.earnings?.referrals || 0} BL
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Games</span>
                <span className="font-medium text-green-500">
                  +{stats.earnings?.games || 0} BL
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Daily Rewards</span>
                <span className="font-medium text-green-500">
                  +{stats.earnings?.daily || 0} BL
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Transactions */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="font-semibold">Recent Activity</h2>
          </div>
          <div className="divide-y divide-border/50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full skeleton" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 skeleton rounded" />
                    <div className="h-3 w-1/3 skeleton rounded" />
                  </div>
                </div>
              ))
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No transactions yet
              </div>
            ) : (
              transactions.slice(0, 10).map((txn) => {
                const Icon = getTransactionIcon(txn.type);
                const isPositive = txn.amount > 0;
                return (
                  <div key={txn.transaction_id} className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isPositive ? "bg-green-500/10" : "bg-red-500/10"
                    }`}>
                      <Icon className={`w-5 h-5 ${isPositive ? "text-green-500" : "text-red-500"}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{txn.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(txn.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`font-semibold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                      {isPositive ? "+" : ""}{txn.amount} BL
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
