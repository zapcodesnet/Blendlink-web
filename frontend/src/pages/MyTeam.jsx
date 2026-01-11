import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import referralApi from "../services/referralApi";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { 
  ArrowLeft, Share2, Copy, Users, Coins, ChevronRight, ChevronDown,
  Check, Crown, Clock, AlertTriangle, Shield, RefreshCw, Gift,
  Wallet, ZoomIn, ZoomOut, Move
} from "lucide-react";

// Disclaimer Modal Component
const DisclaimerModal = ({ open, onAccept, onClose, disclaimer }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Important Legal Disclaimer
          </h2>
        </div>
        <div className="p-4 overflow-y-auto max-h-[50vh]">
          <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans">
            {disclaimer}
          </pre>
        </div>
        <div className="p-4 border-t border-border flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onAccept} className="flex-1">
            I Accept
          </Button>
        </div>
      </div>
    </div>
  );
};

// Genealogy Tree Node Component
const TreeNode = ({ member, level = 1, expanded, onToggle }) => {
  const levelColors = {
    1: 'border-blue-500 bg-blue-500/10',
    2: 'border-emerald-500 bg-emerald-500/10',
  };
  
  return (
    <div className={`relative ${level === 2 ? 'ml-8' : ''}`}>
      {level === 2 && (
        <div className="absolute left-[-20px] top-1/2 w-5 h-px bg-border" />
      )}
      <div 
        className={`flex items-center gap-3 p-3 rounded-xl border-2 ${levelColors[level]} cursor-pointer hover:opacity-80 transition-opacity ${member.is_blocked ? 'opacity-50 grayscale' : ''}`}
        onClick={() => onToggle && onToggle(member.user_id)}
        data-testid={`tree-node-${member.user_id}`}
      >
        <Avatar className="w-10 h-10">
          <AvatarImage src={member.avatar} />
          <AvatarFallback>{member.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{member.username}</span>
            {member.is_blocked && (
              <Badge variant="outline" className="text-xs">Blocked</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {member.direct_recruits_count} direct • {member.total_recruits_count} total
          </div>
        </div>
        <Badge variant={level === 1 ? 'default' : 'secondary'} className="text-xs">
          L{level}
        </Badge>
      </div>
    </div>
  );
};

// Daily Claim Section Component
const DailyClaimSection = ({ onClaim, nextClaimAt, isDiamond, loading }) => {
  const [countdown, setCountdown] = useState(null);
  const [canClaim, setCanClaim] = useState(false);
  
  useEffect(() => {
    if (!nextClaimAt) {
      setCanClaim(true);
      return;
    }
    
    const updateCountdown = () => {
      const now = new Date();
      const next = new Date(nextClaimAt);
      const diff = next - now;
      
      if (diff <= 0) {
        setCanClaim(true);
        setCountdown(null);
        return;
      }
      
      setCanClaim(false);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextClaimAt]);
  
  const claimAmount = isDiamond ? '5,000' : '2,000';
  
  return (
    <div className={`rounded-2xl p-5 ${isDiamond ? 'bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border-2 border-yellow-500/30' : 'bg-gradient-to-br from-primary/10 to-primary/5 border border-border'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gift className={`w-5 h-5 ${isDiamond ? 'text-yellow-500' : 'text-primary'}`} />
          <span className="font-semibold">Daily BL Claim</span>
          {isDiamond && (
            <Badge className="bg-yellow-500 text-black text-xs">
              <Crown className="w-3 h-3 mr-1" />
              Diamond
            </Badge>
          )}
        </div>
        <span className="text-2xl font-bold">{claimAmount}</span>
      </div>
      
      {canClaim ? (
        <Button 
          onClick={onClaim} 
          disabled={loading}
          className={`w-full ${isDiamond ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : ''}`}
          data-testid="daily-claim-btn"
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Gift className="w-4 h-4 mr-2" />
          )}
          Claim {claimAmount} BL Coins
        </Button>
      ) : (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
            <Clock className="w-4 h-4" />
            <span>Next claim in</span>
          </div>
          <div className="font-mono text-3xl font-bold tracking-wider">
            {countdown}
          </div>
        </div>
      )}
    </div>
  );
};

// Diamond Status Section Component
const DiamondStatusSection = ({ diamondStatus, onCheckQualification, loading }) => {
  if (!diamondStatus) return null;
  
  const { is_diamond, qualification_progress, maintenance_progress, days_until_check } = diamondStatus;
  
  return (
    <div className={`rounded-2xl p-5 border ${is_diamond ? 'bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border-yellow-500/30' : 'bg-card border-border'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Crown className={`w-5 h-5 ${is_diamond ? 'text-yellow-500' : 'text-muted-foreground'}`} />
          <span className="font-semibold">Diamond Leader</span>
        </div>
        {is_diamond ? (
          <Badge className="bg-yellow-500 text-black">Active</Badge>
        ) : (
          <Badge variant="outline">Not Qualified</Badge>
        )}
      </div>
      
      {is_diamond ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Maintenance check in <span className="font-bold text-foreground">{days_until_check}</span> days
          </p>
          
          {maintenance_progress && Object.keys(maintenance_progress).length > 0 && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>New Recruits</span>
                <span>{maintenance_progress.new_recruits || 0}/{maintenance_progress.new_recruits_required || 1}</span>
              </div>
              <div className="flex justify-between">
                <span>Personal Sales</span>
                <span>${maintenance_progress.personal_sales?.toFixed(2) || '0.00'}/${maintenance_progress.personal_sales_required || 10}</span>
              </div>
              <div className="flex justify-between">
                <span>Commissions</span>
                <span>${maintenance_progress.commissions?.toFixed(2) || '0.00'}/${maintenance_progress.commissions_required || 10}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-3">
            Qualify to unlock enhanced commission rates and daily claim bonus!
          </p>
          
          {qualification_progress && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Direct Recruits</span>
                  <span>{qualification_progress.direct_recruits || 0}/{qualification_progress.direct_recruits_required || 100}</span>
                </div>
                <Progress value={(qualification_progress.direct_recruits / (qualification_progress.direct_recruits_required || 100)) * 100} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Downline Commissions</span>
                  <span>${qualification_progress.downline_commissions?.toFixed(2) || '0.00'}/${qualification_progress.downline_commissions_required || 1000}</span>
                </div>
                <Progress value={(qualification_progress.downline_commissions / (qualification_progress.downline_commissions_required || 1000)) * 100} className="h-2" />
              </div>
              
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Personal Sales</span>
                  <span>${qualification_progress.personal_sales?.toFixed(2) || '0.00'}/${qualification_progress.personal_sales_required || 1000}</span>
                </div>
                <Progress value={(qualification_progress.personal_sales / (qualification_progress.personal_sales_required || 1000)) * 100} className="h-2" />
              </div>
            </div>
          )}
          
          <Button 
            variant="outline" 
            className="w-full mt-2" 
            onClick={onCheckQualification}
            disabled={loading}
            data-testid="check-diamond-btn"
          >
            {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Crown className="w-4 h-4 mr-2" />}
            Check Qualification
          </Button>
        </div>
      )}
    </div>
  );
};

// Main Component
export default function MyTeam() {
  const { user, refreshUser } = useContext(AuthContext);
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [genealogy, setGenealogy] = useState([]);
  const [diamondStatus, setDiamondStatus] = useState(null);
  const [withdrawalStatus, setWithdrawalStatus] = useState(null);
  const [nextClaimAt, setNextClaimAt] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerText, setDisclaimerText] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [diamondLoading, setDiamondLoading] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [zoom, setZoom] = useState(100);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [genealogyData, diamondData, withdrawalData, disclaimerData] = await Promise.all([
        referralApi.referral.getGenealogy().catch(() => []),
        referralApi.diamond.getStatus().catch(() => null),
        referralApi.withdrawal.getStatus().catch(() => null),
        referralApi.referral.getDisclaimer().catch(() => ({ disclaimer: '' })),
      ]);
      
      setGenealogy(genealogyData);
      setDiamondStatus(diamondData);
      setWithdrawalStatus(withdrawalData);
      setDisclaimerText(disclaimerData.disclaimer);
      
      // Check if daily claim is available from user data
      if (user?.daily_claim_last) {
        const lastClaim = new Date(user.daily_claim_last);
        const nextClaim = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
        if (nextClaim > new Date()) {
          setNextClaimAt(nextClaim.toISOString());
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
  const handleCopyCode = () => {
    navigator.clipboard.writeText(user?.referral_code || '');
    setCopied(true);
    toast.success('Referral code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const code = user?.referral_code;
    const shareData = {
      title: 'Join Blendlink!',
      text: `Join Blendlink using my referral code: ${code} and we both get 50,000 BL Coins!`,
      url: `${window.location.origin}/register?ref=${code}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        handleCopyCode();
      }
    } else {
      handleCopyCode();
    }
  };

  const handleDailyClaim = async () => {
    setClaimLoading(true);
    try {
      const result = await referralApi.referral.claimDaily();
      toast.success(`Claimed ${result.amount.toLocaleString()} BL Coins!`);
      setNextClaimAt(result.next_claim_at);
      if (refreshUser) refreshUser();
    } catch (error) {
      toast.error(error.message || 'Failed to claim');
    } finally {
      setClaimLoading(false);
    }
  };

  const handleCheckDiamond = async () => {
    setDiamondLoading(true);
    try {
      const result = await referralApi.diamond.checkQualification();
      if (result.promoted) {
        toast.success('Congratulations! You are now a Diamond Leader!');
        if (refreshUser) refreshUser();
      } else {
        toast.info('Not yet qualified. Keep building your team!');
      }
      setDiamondStatus(await referralApi.diamond.getStatus());
    } catch (error) {
      toast.error(error.message || 'Failed to check qualification');
    } finally {
      setDiamondLoading(false);
    }
  };

  const handleWithdraw = () => {
    if (withdrawalStatus?.kyc_required) {
      setShowDisclaimer(true);
    } else {
      navigate('/withdraw');
    }
  };

  const handleAcceptDisclaimer = async () => {
    setShowDisclaimer(false);
    try {
      const result = await referralApi.kyc.initVerification(window.location.origin + '/withdraw?kyc=complete');
      if (result.verification_url) {
        window.location.href = result.verification_url;
      } else {
        toast.info(result.message || 'KYC verification initiated');
        navigate('/withdraw');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to start KYC');
    }
  };

  const toggleNode = (userId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Group genealogy by level
  const level1 = genealogy.filter(m => m.level === 1);
  const level2 = genealogy.filter(m => m.level === 2);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold flex-1">My Team</h1>
          <Button variant="ghost" size="icon" onClick={fetchData}>
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Referral Code Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white">
          <h2 className="text-sm font-medium opacity-90 mb-2">Your Referral Code</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/20 rounded-xl px-4 py-3 font-mono text-2xl tracking-widest text-center">
              {user?.referral_code || '...'}
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="h-12 w-12 bg-white/20 hover:bg-white/30 text-white"
              onClick={handleCopyCode}
              data-testid="copy-referral-code"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </Button>
          </div>
          <div className="flex gap-3 mt-4">
            <Button 
              className="flex-1 bg-white text-blue-600 hover:bg-white/90"
              onClick={handleShare}
              data-testid="share-referral-btn"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share & Earn 50K BL
            </Button>
          </div>
          <p className="text-xs text-white/70 text-center mt-3">
            Both you and your friend receive 50,000 BL coins on signup!
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border/50 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{level1.length}</p>
            <p className="text-xs text-muted-foreground">Direct (L1)</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border/50 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
            <p className="text-2xl font-bold">{level2.length}</p>
            <p className="text-xs text-muted-foreground">Indirect (L2)</p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border/50 text-center">
            <Coins className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold">{(user?.bl_coins || 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">BL Coins</p>
          </div>
        </div>

        {/* Daily Claim */}
        <DailyClaimSection 
          onClaim={handleDailyClaim}
          nextClaimAt={nextClaimAt}
          isDiamond={diamondStatus?.is_diamond}
          loading={claimLoading}
        />

        {/* Diamond Status */}
        <DiamondStatusSection 
          diamondStatus={diamondStatus}
          onCheckQualification={handleCheckDiamond}
          loading={diamondLoading}
        />

        {/* Withdrawal Section */}
        {withdrawalStatus && (
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-500" />
                <span className="font-semibold">Withdraw Earnings</span>
              </div>
              <Badge variant={withdrawalStatus.kyc_status === 'verified' ? 'default' : 'outline'}>
                {withdrawalStatus.kyc_status === 'verified' ? (
                  <><Shield className="w-3 h-3 mr-1" /> Verified</>
                ) : (
                  'KYC Required'
                )}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground">USD Balance</span>
              <span className="text-2xl font-bold text-green-500">
                ${(withdrawalStatus.usd_balance || 0).toFixed(2)}
              </span>
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleWithdraw}
              disabled={withdrawalStatus.usd_balance <= 0}
              data-testid="withdraw-btn"
            >
              {withdrawalStatus.kyc_required ? (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Verify Identity to Withdraw
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 mr-2" />
                  Withdraw Funds
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground text-center mt-2">
              {withdrawalStatus.withdrawal_fee_rate}% platform fee • Min ${withdrawalStatus.min_withdrawal}
            </p>
          </div>
        )}

        {/* Genealogy Tree */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              My Team Tree
            </h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(50, z - 10))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground w-12 text-center">{zoom}%</span>
              <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(150, z + 10))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div 
            className="p-4 overflow-auto max-h-[400px]"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
          >
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading team...
              </div>
            ) : genealogy.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No team members yet</p>
                <p className="text-sm">Share your referral code to start building your team!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Level 1 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-blue-500">Level 1</Badge>
                    <span className="text-sm text-muted-foreground">Direct Referrals ({level1.length})</span>
                  </div>
                  {level1.map(member => (
                    <TreeNode 
                      key={member.user_id} 
                      member={member} 
                      level={1}
                      expanded={expandedNodes.has(member.user_id)}
                      onToggle={toggleNode}
                    />
                  ))}
                </div>
                
                {/* Level 2 */}
                {level2.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-emerald-500">Level 2</Badge>
                      <span className="text-sm text-muted-foreground">Indirect Referrals ({level2.length})</span>
                    </div>
                    {level2.map(member => (
                      <TreeNode 
                        key={member.user_id} 
                        member={member} 
                        level={2}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Privacy Notice */}
          <div className="px-4 py-3 bg-muted/30 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              🔒 Privacy: You can only see usernames and profile pictures. No earnings or activity data is shared.
            </p>
          </div>
        </div>

        {/* Commission Info */}
        <div className="bg-muted/30 rounded-xl p-4">
          <h3 className="font-semibold mb-3">Commission Structure</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Regular Members</p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Level 1</span>
                  <span className="font-medium">3%</span>
                </div>
                <div className="flex justify-between">
                  <span>Level 2</span>
                  <span className="font-medium">1%</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 flex items-center gap-1">
                <Crown className="w-3 h-3 text-yellow-500" />
                Diamond Leaders
              </p>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Level 1</span>
                  <span className="font-medium text-yellow-600">4%</span>
                </div>
                <div className="flex justify-between">
                  <span>Level 2</span>
                  <span className="font-medium text-yellow-600">2%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sync Notice */}
        <p className="text-center text-xs text-muted-foreground">
          🔄 Real-time sync with Blendlink mobile app
        </p>
      </main>

      {/* Disclaimer Modal */}
      <DisclaimerModal 
        open={showDisclaimer}
        disclaimer={disclaimerText}
        onAccept={handleAcceptDisclaimer}
        onClose={() => setShowDisclaimer(false)}
      />
    </div>
  );
}
