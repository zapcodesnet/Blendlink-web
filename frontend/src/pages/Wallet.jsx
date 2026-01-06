import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { 
  Coins, TrendingUp, ArrowUpRight, ArrowDownRight, 
  Gift, Gamepad2, Trophy, Share2, ChevronRight, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

export default function Wallet() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const [balanceData, txnData] = await Promise.all([
        api.wallet.getBalance(),
        api.wallet.getTransactions()
      ]);
      setBalance(balanceData);
      setTransactions(txnData.transactions || []);
      setUser({ ...user, bl_coins: balanceData.balance });
    } catch (error) {
      console.error("Wallet error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimDaily = async () => {
    setClaiming(true);
    try {
      const result = await api.wallet.claimDaily();
      toast.success(`Claimed ${result.coins_earned?.toLocaleString()} BL Coins!`);
      setBalance(prev => ({ ...prev, balance: result.new_balance }));
      setUser({ ...user, bl_coins: result.new_balance });
      fetchWalletData(); // Refresh transactions
    } catch (error) {
      toast.error(error.message || "Already claimed today");
    } finally {
      setClaiming(false);
    }
  };

  const getTransactionIcon = (type) => {
    if (type?.includes('referral')) return Share2;
    if (type?.includes('game')) return Gamepad2;
    if (type?.includes('raffle')) return Trophy;
    if (type?.includes('daily') || type?.includes('login') || type?.includes('bonus')) return Gift;
    return Coins;
  };

  const getTransactionColor = (amount) => {
    return amount >= 0 ? "text-green-500" : "text-red-500";
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
                {loading ? "..." : (balance?.balance || 0).toLocaleString()}
              </p>
              <p className="text-white/80 text-sm mt-1">BL Coins</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Coins className="w-8 h-8" />
            </div>
          </div>
          
          {/* Daily Claim */}
          <Button 
            className="w-full mt-4 bg-white/20 hover:bg-white/30 text-white"
            onClick={handleClaimDaily}
            disabled={claiming}
            data-testid="claim-daily"
          >
            {claiming ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Gift className="w-4 h-4 mr-2" />
            )}
            Claim Daily 10,000 BL
          </Button>
        </div>

        {/* Stats */}
        {balance && (
          <div className="bg-card rounded-xl border border-border/50 p-4 mb-6">
            <h2 className="font-semibold mb-4">Account Stats</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Earned</span>
                <span className="font-medium text-green-500">
                  +{(balance.total_earned || 0).toLocaleString()} BL
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total Spent</span>
                <span className="font-medium text-red-500">
                  -{(balance.total_spent || 0).toLocaleString()} BL
                </span>
              </div>
              {balance.has_subscription && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subscription</span>
                  <span className="font-medium text-primary">
                    {balance.subscription_tier || 'Active'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

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
            <p className="text-xs text-muted-foreground">Earn referral bonus</p>
          </button>
        </div>

        {/* Transactions */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="font-semibold">Transaction History</h2>
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
              transactions.slice(0, 20).map((txn) => {
                const Icon = getTransactionIcon(txn.transaction_type);
                const isPositive = txn.amount >= 0;
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
                    <span className={`font-semibold ${getTransactionColor(txn.amount)}`}>
                      {isPositive ? "+" : ""}{txn.amount?.toLocaleString()} BL
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sync Notice */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          🔄 Synced with Blendlink mobile app
        </p>
      </main>
    </div>
  );
}
