import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
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
      const statsData = await api.referrals.getStats();
      setStats(statsData);
    } catch (error) {
      console.error("Referral stats error:", error);
      // Use user data as fallback
      setStats({
        referral_code: user?.referral_code,
        level1_count: user?.direct_recruits_count || 0,
        level2_count: user?.total_downline_count || 0,
        total_earned: user?.downline_commissions_total || 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = () => {
    navigator.clipboard.writeText(stats?.referral_code || user?.referral_code || "");
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferral = async () => {
    const code = stats?.referral_code || user?.referral_code;
    const shareData = {
      title: "Join Blendlink!",
      text: `Join Blendlink using my referral code: ${code} and get 50,000 BL Coins!`,
      url: `https://blendlink.app/register?ref=${code}`
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
              {loading ? "..." : (stats?.referral_code || user?.referral_code || "N/A")}
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
            <p className="text-xs text-muted-foreground">Direct Referrals</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border/50 text-center">
            <p className="text-2xl font-bold">{stats?.level2_count || 0}</p>
            <p className="text-xs text-muted-foreground">Total Network</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border/50 text-center">
            <p className="text-2xl font-bold bl-coin-text">{(stats?.total_earned || 0).toLocaleString()}</p>
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
                  Earn commissions from your network's activity
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Commission Info */}
        <div className="bg-muted/50 rounded-xl p-4">
          <h3 className="font-semibold mb-3">Commission Structure</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Level 1 (Direct)</span>
              <span className="font-medium">10% commission</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Level 2</span>
              <span className="font-medium">5% commission</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Level 3+</span>
              <span className="font-medium">2% commission</span>
            </div>
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
