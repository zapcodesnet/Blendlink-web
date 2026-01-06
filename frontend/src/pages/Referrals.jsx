import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, API } from "../App";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { 
  ArrowLeft, Share2, Copy, Users, Coins, ChevronRight,
  Check
} from "lucide-react";

export default function Referrals() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralStats();
  }, []);

  const fetchReferralStats = async () => {
    try {
      const response = await axios.get(`${API}/referrals/stats`, { withCredentials: true });
      setStats(response.data);
    } catch (error) {
      console.error("Referral stats error:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(stats?.referral_code || "");
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferral = async () => {
    const shareData = {
      title: "Join Blendlink!",
      text: `Join Blendlink using my referral code: ${stats?.referral_code} and get 100 BL Coins!`,
      url: `${window.location.origin}/register?ref=${stats?.referral_code}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        copyReferralCode();
      }
    } else {
      copyReferralCode();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">Referrals</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Referral Code Card */}
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white mb-6">
          <h2 className="text-lg font-medium mb-4">Your Referral Code</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/20 rounded-xl px-4 py-3 font-mono text-xl tracking-wider">
              {loading ? "..." : stats?.referral_code}
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 bg-white/20 hover:bg-white/30 text-white"
              onClick={copyReferralCode}
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </Button>
          </div>
          <Button 
            className="w-full mt-4 bg-white text-blue-600 hover:bg-white/90"
            onClick={shareReferral}
            data-testid="share-referral"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share & Earn
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-xl p-4 border border-border/50 text-center">
            <p className="text-2xl font-bold">{stats?.level1_count || 0}</p>
            <p className="text-xs text-muted-foreground">Level 1</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border/50 text-center">
            <p className="text-2xl font-bold">{stats?.level2_count || 0}</p>
            <p className="text-xs text-muted-foreground">Level 2</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border/50 text-center">
            <p className="text-2xl font-bold bl-coin-text">{stats?.total_earned || 0}</p>
            <p className="text-xs text-muted-foreground">BL Earned</p>
          </div>
        </div>

        {/* How it Works */}
        <div className="bg-card rounded-xl border border-border/50 p-4 mb-6">
          <h3 className="font-semibold mb-4">How it Works</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">1</span>
              </div>
              <div>
                <p className="font-medium">Share Your Code</p>
                <p className="text-sm text-muted-foreground">
                  Invite friends using your unique referral code
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-bold">2</span>
              </div>
              <div>
                <p className="font-medium">They Sign Up</p>
                <p className="text-sm text-muted-foreground">
                  Your friend creates an account with your code
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Coins className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="font-medium">You Both Earn!</p>
                <p className="text-sm text-muted-foreground">
                  You get 50 BL Coins, they get 100 BL welcome bonus
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Level 1 Referrals */}
        {stats?.level1_referrals?.length > 0 && (
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <h3 className="font-semibold">Level 1 Referrals</h3>
              <p className="text-sm text-muted-foreground">Direct referrals - 50 BL each</p>
            </div>
            <div className="divide-y divide-border/50">
              {stats.level1_referrals.map((ref) => (
                <div key={ref.user_id} className="p-4 flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={ref.avatar} />
                    <AvatarFallback>{ref.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{ref.name}</p>
                    <p className="text-xs text-muted-foreground">@{ref.username}</p>
                  </div>
                  <span className="text-green-500 font-medium">+50 BL</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Level 2 Referrals */}
        {stats?.level2_referrals?.length > 0 && (
          <div className="bg-card rounded-xl border border-border/50 overflow-hidden mt-4">
            <div className="p-4 border-b border-border/50">
              <h3 className="font-semibold">Level 2 Referrals</h3>
              <p className="text-sm text-muted-foreground">Indirect referrals - 25 BL each</p>
            </div>
            <div className="divide-y divide-border/50">
              {stats.level2_referrals.map((ref) => (
                <div key={ref.user_id} className="p-4 flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={ref.avatar} />
                    <AvatarFallback>{ref.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{ref.name}</p>
                    <p className="text-xs text-muted-foreground">@{ref.username}</p>
                  </div>
                  <span className="text-green-500 font-medium">+25 BL</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
