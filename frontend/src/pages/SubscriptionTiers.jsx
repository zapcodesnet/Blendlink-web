import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../App";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { getApiUrl } from "../utils/runtimeConfig";
import api from "../services/api";
import { 
  Crown, Check, Zap, Target, Trophy, Star, Sparkles, 
  Shield, Rocket, Gift, Clock, TrendingUp, Medal, 
  ChevronDown, ChevronUp, Image, FileText, Percent,
  CreditCard, Users, DollarSign, ArrowLeft, RefreshCw,
  AlertCircle, CheckCircle
} from "lucide-react";

const API_BASE_URL = getApiUrl();

// Membership tier configurations matching user requirements exactly
const MEMBERSHIP_TIERS = {
  bronze: {
    id: "bronze",
    name: "Bronze Member",
    price: 4.99,
    standardPrice: 9.99,
    color: "from-amber-600 to-amber-800",
    bgColor: "bg-amber-900/20",
    borderColor: "border-amber-600",
    textColor: "text-amber-400",
    icon: Shield,
    commission_l1: 3,
    commission_l2: 2,
    daily_mint: 20,
    xp_multiplier: 2,
    daily_bl_bonus: 20000,
    max_pages: 3,
    monthly_listings: 2000,
    monthly_transactions: 500,
    description: "Earn 3% commission from direct recruits (level 1 downlines) and 2% from indirect recruits (level 2 downlines) on each successful sale of products, services, digital goods, rentals, foods, etc., listed by downlines in the marketplace (blendlink.net/marketplace) or on member's pages (blendlink.net/[slug]).",
    benefits: [
      "Mint up to 20 photos per day",
      "Gain x2 experience (XP) per round of the minted photo game",
      "Claim 20,000 free BL coins daily",
      "Create a maximum of 3 member's pages (blendlink.net/[slug])",
      "2,000 listings per month (marketplace + pages)",
      "500 sales transactions per month"
    ],
    idealFor: "Ideal for users looking to moderately boost referral earnings and daily rewards."
  },
  silver: {
    id: "silver",
    name: "Silver Member",
    price: 9.99,
    standardPrice: 19.99,
    color: "from-gray-400 to-slate-600",
    bgColor: "bg-slate-800/30",
    borderColor: "border-slate-400",
    textColor: "text-slate-300",
    icon: Star,
    commission_l1: 3,
    commission_l2: 2,
    daily_mint: 50,
    xp_multiplier: 3,
    daily_bl_bonus: 80000,
    max_pages: 10,
    monthly_listings: 10000,
    description: "Earn 3% commission from direct recruits (level 1) and 2% from indirect recruits (level 2) on each successful sale by downlines.",
    benefits: [
      "Mint up to 50 photos per day",
      "Gain x3 experience (XP) per round of the minted photo game",
      "Claim 80,000 free BL coins daily",
      "Create a maximum of 10 member's pages (blendlink.net/[slug])",
      "10,000 listings per month (marketplace + pages)"
    ],
    idealFor: "Perfect for active users who want significantly higher minting capacity and stronger daily coin rewards."
  },
  gold: {
    id: "gold",
    name: "Gold Member",
    price: 14.99,
    standardPrice: 29.99,
    color: "from-yellow-500 to-amber-600",
    bgColor: "bg-yellow-900/20",
    borderColor: "border-yellow-500",
    textColor: "text-yellow-400",
    icon: Crown,
    commission_l1: 3,
    commission_l2: 2,
    daily_mint: 150,
    xp_multiplier: 4,
    daily_bl_bonus: 200000,
    max_pages: 25,
    monthly_listings: 25000,
    description: "Earn 3% commission from direct recruits (level 1) and 2% from indirect recruits (level 2) on each successful sale by downlines.",
    benefits: [
      "Mint up to 150 photos per day",
      "Gain x4 experience (XP) per round of the minted photo game",
      "Claim 200,000 free BL coins daily",
      "Create a maximum of 25 member's pages (blendlink.net/[slug])",
      "25,000 listings per month (marketplace + pages)"
    ],
    idealFor: "Designed for serious creators and referrers who want to maximize volume and rewards."
  },
  diamond: {
    id: "diamond",
    name: "Diamond Member",
    price: 29.99,
    standardPrice: 59.99,
    color: "from-cyan-400 to-blue-600",
    bgColor: "bg-cyan-900/20",
    borderColor: "border-cyan-400",
    textColor: "text-cyan-400",
    icon: Sparkles,
    commission_l1: 4,
    commission_l2: 3,
    daily_mint: "Unlimited",
    xp_multiplier: 5,
    daily_bl_bonus: 500000,
    max_pages: "Unlimited",
    monthly_listings: "Unlimited",
    description: "Earn 4% commission from direct recruits (level 1) and 3% from indirect recruits (level 2) on each successful sale by downlines.",
    benefits: [
      "Unlimited photo minting per day",
      "Gain x5 experience (XP) per round of the minted photo game",
      "Claim 500,000 free BL coins daily",
      "Create unlimited member's pages (blendlink.net/[slug])",
      "Unlimited listings per month"
    ],
    idealFor: "The premium tier for top performers seeking maximum earnings, unlimited creation power, and elite benefits."
  }
};

const SubscriptionTiers = () => {
  const { user, refreshUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTier, setExpandedTier] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
    
    // Check for success callback from Stripe - verify and activate subscription
    if (searchParams.get("success") === "true") {
      verifyAndActivateSubscription();
    }
  }, [searchParams]);

  const verifyAndActivateSubscription = async () => {
    try {
      const response = await api.get("/subscriptions/verify-latest");
      const result = response.data;
      
      if (result.status === 'activated') {
        toast.success(result.message || "Subscription activated successfully!", { duration: 5000 });
        if (refreshUser) refreshUser();
        fetchSubscriptionData();
      } else if (result.status === 'already_active') {
        toast.success(result.message || "Your membership is active!", { duration: 3000 });
        fetchSubscriptionData();
      } else {
        toast.success("Payment received! Your subscription is being activated.");
        if (refreshUser) refreshUser();
      }
      // Clean URL
      window.history.replaceState({}, '', '/subscriptions');
    } catch (error) {
      console.error("Subscription verification error:", error);
      toast.info("Payment received. Your subscription will be activated shortly.");
    }
  };

  const fetchSubscriptionData = async () => {
    try {
      const response = await api.get("/subscriptions/my-subscription");
      setCurrentSubscription(response.data);
    } catch (error) {
      // No active subscription or error
      setCurrentSubscription(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tierId) => {
    if (!user) {
      toast.error("Please login to subscribe");
      navigate("/login");
      return;
    }

    setSubscribing(true);

    try {
      const token = localStorage.getItem('blendlink_token');
      if (!token) {
        toast.error("Please login to subscribe");
        navigate("/login");
        return;
      }
      
      const successUrl = `${window.location.origin}/subscriptions?success=true`;
      const cancelUrl = `${window.location.origin}/subscriptions`;

      // Use GET redirect endpoint - browser follows 302 redirect natively, no JSON parsing needed
      window.location.href = `${API_BASE_URL}/api/subscriptions/checkout-redirect?tier=${tierId}&success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}&token=${encodeURIComponent(token)}`;
      return; // Don't reset subscribing since we're navigating away
    } catch (error) {
      console.error("Subscription error:", error);
      toast.error(error.message || "Failed to start subscription process. Please try again.");
      setSubscribing(false);
    }
  };

  const handleDowngrade = async (tierId) => {
    // For downgrade, we still need to go through checkout for the new tier
    // This will create a new subscription (Stripe handles proration)
    await handleUpgrade(tierId);
  };

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel your subscription? You will lose access to premium benefits at the end of your current billing period.")) {
      return;
    }

    setCanceling(true);
    try {
      await api.post("/subscriptions/cancel");
      toast.success("Subscription cancelled. You'll retain access until the end of your billing period.");
      fetchSubscriptionData();
      if (refreshUser) refreshUser();
    } catch (error) {
      toast.error(error.message || "Failed to cancel subscription");
    } finally {
      setCanceling(false);
    }
  };

  const getCurrentTier = () => {
    return user?.subscription_tier || currentSubscription?.tier || "free";
  };

  const currentTierKey = getCurrentTier();

  const TierCard = ({ tier, tierKey }) => {
    const TierIcon = tier.icon;
    const isCurrentTier = currentTierKey === tierKey;
    const isExpanded = expandedTier === tierKey;
    const canUpgrade = !isCurrentTier && (currentTierKey === "free" || MEMBERSHIP_TIERS[currentTierKey]?.price < tier.price);
    const canDowngrade = !isCurrentTier && currentTierKey !== "free" && MEMBERSHIP_TIERS[currentTierKey]?.price > tier.price;

    return (
      <div
        data-testid={`tier-card-${tierKey}`}
        className={`rounded-2xl border-2 overflow-hidden transition-all duration-300 ${
          isCurrentTier
            ? `${tier.borderColor} ${tier.bgColor} ring-2 ring-offset-2 ring-offset-gray-950 ring-${tierKey === 'diamond' ? 'cyan' : tierKey === 'gold' ? 'yellow' : tierKey === 'silver' ? 'slate' : 'amber'}-500/50`
            : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
        }`}
      >
        {/* Header */}
        <div
          className={`p-6 bg-gradient-to-r ${tier.color} cursor-pointer`}
          onClick={() => setExpandedTier(isExpanded ? null : tierKey)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <TierIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  {tier.name}
                  {isCurrentTier && (
                    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Current</span>
                  )}
                </h3>
                <p className="text-white/90 text-lg font-semibold">
                  ${tier.price.toFixed(2)}/month{' '}
                  <span className="line-through opacity-60 text-sm">${tier.standardPrice.toFixed(2)}/month</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronUp className="w-6 h-6 text-white" />
              ) : (
                <ChevronDown className="w-6 h-6 text-white" />
              )}
            </div>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="p-6 space-y-6">
            {/* Commission Rates */}
            <div className="bg-gray-800/50 rounded-xl p-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-white">
                <Percent className="w-4 h-4 text-green-400" />
                Commission Rates
              </h4>
              <p className="text-gray-300 text-sm leading-relaxed">
                {tier.description}
              </p>
              <div className="mt-3 flex gap-4">
                <div className="bg-green-500/10 px-3 py-2 rounded-lg">
                  <span className="text-green-400 font-bold">{tier.commission_l1}%</span>
                  <span className="text-gray-400 text-sm ml-1">L1 Commission</span>
                </div>
                <div className="bg-green-500/10 px-3 py-2 rounded-lg">
                  <span className="text-green-400 font-bold">{tier.commission_l2}%</span>
                  <span className="text-gray-400 text-sm ml-1">L2 Commission</span>
                </div>
              </div>
            </div>

            {/* Benefits Grid */}
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2 text-white">
                <Gift className="w-4 h-4 text-purple-400" />
                Benefits
              </h4>
              <div className="space-y-2">
                {tier.benefits.map((benefit, idx) => (
                  <div key={idx} className="flex items-start gap-3 text-sm text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <Image className="w-5 h-5 mx-auto mb-1 text-blue-400" />
                <p className="text-lg font-bold text-white">
                  {tier.daily_mint === "Unlimited" ? "∞" : tier.daily_mint}
                </p>
                <p className="text-xs text-gray-400">Daily Mints</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <Zap className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
                <p className="text-lg font-bold text-white">x{tier.xp_multiplier}</p>
                <p className="text-xs text-gray-400">XP Multiplier</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <DollarSign className="w-5 h-5 mx-auto mb-1 text-amber-400" />
                <p className="text-lg font-bold text-white">{tier.daily_bl_bonus.toLocaleString()}</p>
                <p className="text-xs text-gray-400">Daily BL Coins</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <FileText className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                <p className="text-lg font-bold text-white">
                  {tier.max_pages === "Unlimited" ? "∞" : tier.max_pages}
                </p>
                <p className="text-xs text-gray-400">Member Pages</p>
              </div>
            </div>

            {/* Ideal For */}
            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
              <p className="text-sm text-gray-300 italic">{tier.idealFor}</p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {isCurrentTier ? (
                <>
                  <div className="bg-green-500/10 rounded-lg p-3 flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">This is your current plan</span>
                  </div>
                  <Button
                    onClick={handleCancel}
                    disabled={canceling}
                    variant="outline"
                    className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                    data-testid={`cancel-${tierKey}-btn`}
                  >
                    {canceling ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <AlertCircle className="w-4 h-4 mr-2" />
                    )}
                    Cancel Subscription
                  </Button>
                </>
              ) : canUpgrade ? (
                <Button
                  onClick={() => handleUpgrade(tierKey)}
                  disabled={subscribing}
                  className={`w-full bg-gradient-to-r ${tier.color} text-white font-semibold py-3`}
                  data-testid={`upgrade-${tierKey}-btn`}
                >
                  {subscribing ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Upgrade to {tier.name} - ${tier.price.toFixed(2)}/mo <span className="line-through opacity-60 ml-1">${tier.standardPrice.toFixed(2)}</span>
                </Button>
              ) : canDowngrade ? (
                <Button
                  onClick={() => handleDowngrade(tierKey)}
                  disabled={subscribing}
                  variant="outline"
                  className="w-full border-gray-600"
                  data-testid={`downgrade-${tierKey}-btn`}
                >
                  {subscribing ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Downgrade to {tier.name}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-xl font-bold text-white">Memberships</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-400 px-4 py-2 rounded-full mb-4">
            <Crown className="w-5 h-5" />
            <span className="text-sm font-medium">BlendLink Memberships</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Unlock More Earnings & Perks
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Choose the membership tier that suits your needs. Earn commissions from your team's sales, 
            get more daily rewards, and unlock premium features.
          </p>
          <div className="mt-4 max-w-2xl mx-auto bg-gradient-to-r from-purple-500/10 to-amber-500/10 border border-purple-500/30 rounded-lg p-4">
            <p className="text-sm font-semibold text-purple-400">
              Founding members who join during the pre-launch/launch period will have their subscription rate locked at 50% off the standard price for as long as they remain active members. Available for a Limited Time Only!
            </p>
          </div>
        </div>

        {/* Current Status */}
        {currentTierKey !== "free" && (
          <div className="bg-gradient-to-r from-purple-600 to-violet-600 rounded-2xl p-6 text-white mb-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {MEMBERSHIP_TIERS[currentTierKey] && React.createElement(MEMBERSHIP_TIERS[currentTierKey].icon, { className: "w-10 h-10" })}
                <div>
                  <p className="text-white/80 text-sm">Your Current Plan</p>
                  <p className="text-2xl font-bold">
                    {MEMBERSHIP_TIERS[currentTierKey]?.name || currentTierKey}
                  </p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <p className="text-white/80 text-sm">Monthly Rate</p>
                <p className="text-2xl font-bold">
                  ${MEMBERSHIP_TIERS[currentTierKey]?.price.toFixed(2)}/mo
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tier Cards */}
        <div className="space-y-4">
          {Object.entries(MEMBERSHIP_TIERS).map(([tierKey, tier]) => (
            <TierCard key={tierKey} tier={tier} tierKey={tierKey} />
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-10 bg-gray-900/50 rounded-2xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-400" />
            How Subscriptions Work
          </h3>
          <ul className="space-y-3 text-sm text-gray-400">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>All subscriptions are billed monthly and auto-renew until cancelled.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>You can upgrade, downgrade, or cancel your subscription at any time.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>When upgrading, you'll be charged the prorated difference immediately.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>Cancellations take effect at the end of your current billing period.</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>Secure payments powered by Stripe - we never store your card details.</span>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            Need help? Contact support at{" "}
            <a href="mailto:virtual@blendlink.net" className="text-purple-400 hover:underline">
              virtual@blendlink.net
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default SubscriptionTiers;
