import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { toast } from "sonner";
import { 
  ArrowLeft, Users, DollarSign, TrendingUp, Award, 
  Copy, Share2, ChevronRight, RefreshCw, Crown,
  Wallet, Clock, CheckCircle2, Gift
} from "lucide-react";
import referralApi from "../services/referralApi";

export default function EarningsDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [network, setNetwork] = useState(null);
  const [commissions, setCommissions] = useState(null);
  const [diamondStatus, setDiamondStatus] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Use the available APIs from referralApi
      const [genealogyData, diamondData] = await Promise.all([
        referralApi.referral.getGenealogy().catch(() => []),
        referralApi.diamond.getStatus().catch(() => null)
      ]);
      
      // Transform genealogy data to network format
      const level1 = genealogyData.filter(m => m.level === 1);
      const level2 = genealogyData.filter(m => m.level === 2);
      
      setNetwork({
        referral_code: user?.referral_code,
        level_1_count: level1.length,
        level_2_count: level2.length,
        total_network_size: genealogyData.length,
        level_1_members: level1.map(m => ({
          user_id: m.user_id,
          name: m.username,
          email: ''
        }))
      });
      
      // Set commissions from diamond status if available
      setCommissions({
        commissions: [],
        totals: {
          total: 0,
          pending: 0
        }
      });
      
      setDiamondStatus(diamondData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/register?ref=${network?.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success("Referral link copied!");
  };

  const shareReferralLink = async () => {
    const link = `${window.location.origin}/register?ref=${network?.referral_code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Blendlink',
          text: 'Join me on Blendlink and earn together!',
          url: link
        });
      } catch (err) {
        copyReferralLink();
      }
    } else {
      copyReferralLink();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold text-lg">Earnings Dashboard</h1>
          <Button variant="ghost" size="icon" className="ml-auto" onClick={loadData}>
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Earnings Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-2xl p-4 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-sm text-muted-foreground">Total Earned</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              ${commissions?.totals?.total?.toFixed(2) || '0.00'}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-2xl p-4 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              ${commissions?.totals?.pending?.toFixed(2) || '0.00'}
            </p>
          </div>
        </div>

        {/* Referral Code Card - Hidden: content managed elsewhere */}
        {false && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Your Referral Code
            </h3>
          </div>
          <div className="p-4">
            <div className="bg-muted rounded-xl p-4 flex items-center justify-between mb-4">
              <span className="font-mono text-2xl font-bold tracking-wider">
                {network?.referral_code}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={copyReferralLink}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={shareReferralLink}>
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Share your code to earn <span className="text-green-600 font-semibold">3%</span> commission 
              from Level 1 referrals and <span className="text-blue-600 font-semibold">1%</span> from Level 2!
            </p>
          </div>
        </div>
        )}

        {/* Network Stats - Hidden: commission rates displayed here don't match current tier structure */}
        {false && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Your Network
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{network?.level_1_count || 0}</p>
                <p className="text-sm text-muted-foreground">Level 1</p>
                <p className="text-xs text-green-600">3% rate</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-500">{network?.level_2_count || 0}</p>
                <p className="text-sm text-muted-foreground">Level 2</p>
                <p className="text-xs text-blue-600">1% rate</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{network?.total_network_size || 0}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
            
            {/* Recent Members */}
            {network?.level_1_members?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm font-medium mb-2">Recent Level 1 Members</p>
                <div className="space-y-2">
                  {network.level_1_members.slice(0, 3).map((member) => (
                    <div key={member.user_id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Diamond Leader Progress */}
        <div className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 rounded-2xl border border-amber-500/20 overflow-hidden">
          <div className="p-4 border-b border-amber-500/20 bg-amber-500/5">
            <h3 className="font-semibold flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              Diamond Leader Status
              {diamondStatus?.is_qualified && (
                <span className="ml-auto px-2 py-1 bg-amber-500 text-white text-xs rounded-full">
                  ACHIEVED
                </span>
              )}
            </h3>
          </div>
          <div className="p-4">
            {diamondStatus?.is_qualified ? (
              <div className="text-center py-4">
                <Crown className="w-16 h-16 text-amber-500 mx-auto mb-3" />
                <p className="text-lg font-semibold text-amber-600">You're a Diamond Leader!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Enjoy enhanced commission rates: 4% L1, 2% L2
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Direct Recruits (30 days)</span>
                    <span>{diamondStatus?.direct_recruits_count || 0}/100</span>
                  </div>
                  <Progress value={diamondStatus?.progress?.direct_recruits || 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Downline Commissions</span>
                    <span>${diamondStatus?.downline_commissions?.toFixed(2) || '0.00'}/$1,000</span>
                  </div>
                  <Progress value={diamondStatus?.progress?.downline_commissions || 0} className="h-2" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Personal Sales</span>
                    <span>${diamondStatus?.personal_sales?.toFixed(2) || '0.00'}/$1,000</span>
                  </div>
                  <Progress value={diamondStatus?.progress?.personal_sales || 0} className="h-2" />
                </div>
                <div className="text-center pt-2">
                  <p className="text-sm text-muted-foreground">
                    Overall Progress: <span className="font-semibold">{diamondStatus?.overall_progress?.toFixed(0) || 0}%</span>
                  </p>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-3 mt-2">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>Diamond Benefits:</strong> $100 bonus, 4% L1 rate, 2% L2 rate, 2% platform fee
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Commissions */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Recent Commissions
            </h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/commissions')}>
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          <div className="divide-y divide-border">
            {commissions?.commissions?.length > 0 ? (
              commissions.commissions.slice(0, 5).map((comm) => (
                <div key={comm.commission_id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      Level {comm.level} Commission
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {comm.commission_type.replace('_', ' ')} • {comm.rate * 100}% rate
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      +${comm.commission_amount.toFixed(2)}
                    </p>
                    <p className={`text-xs ${
                      comm.status === 'paid' ? 'text-green-600' : 'text-amber-600'
                    }`}>
                      {comm.status}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No commissions yet</p>
                <p className="text-sm">Share your referral code to start earning!</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate('/withdraw')}
          >
            <Wallet className="w-6 h-6" />
            <span>Withdraw</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate('/commissions')}
          >
            <TrendingUp className="w-6 h-6" />
            <span>All Commissions</span>
          </Button>
        </div>
      </main>
    </div>
  );
}
