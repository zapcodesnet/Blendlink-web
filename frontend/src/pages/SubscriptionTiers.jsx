import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { getApiUrl } from "../utils/runtimeConfig";
import { 
  Crown, Check, Zap, Target, Trophy, Star, Sparkles, 
  Shield, Rocket, Gift, Clock, TrendingUp, Medal 
} from "lucide-react";

const API_BASE_URL = getApiUrl();

const SubscriptionTiers = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tiers, setTiers] = useState({});
  const [rankedTiers, setRankedTiers] = useState({});
  const [subscription, setSubscription] = useState(null);
  const [rankedProfile, setRankedProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingBonus, setClaimingBonus] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('blendlink_token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [tiersRes, subRes, rankedRes, leaderRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/subscriptions/tiers`).then(r => r.json()),
        token ? fetch(`${API_BASE_URL}/api/subscriptions/my-subscription`, { headers }).then(r => r.ok ? r.json() : null) : null,
        token ? fetch(`${API_BASE_URL}/api/subscriptions/ranked/profile`, { headers }).then(r => r.ok ? r.json() : null) : null,
        fetch(`${API_BASE_URL}/api/subscriptions/ranked/leaderboard?limit=10`).then(r => r.ok ? r.json() : [])
      ]);

      setTiers(tiersRes.tiers || {});
      setRankedTiers(tiersRes.ranked_tiers || {});
      setSubscription(subRes);
      setRankedProfile(rankedRes);
      setLeaderboard(leaderRes);
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tier) => {
    if (!user) {
      toast.error("Please login to subscribe");
      navigate("/login");
      return;
    }

    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(
        `${API_BASE_URL}/api/subscriptions/checkout?tier=${tier}&success_url=${encodeURIComponent(window.location.origin + '/subscription?success=true')}&cancel_url=${encodeURIComponent(window.location.origin + '/subscription')}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create checkout');
      }

      const data = await response.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (error) {
      toast.error(error.message || 'Failed to start checkout');
    }
  };

  const handleClaimBonus = async () => {
    if (!user) return;

    setClaimingBonus(true);
    try {
      const token = localStorage.getItem('blendlink_token');
      const response = await fetch(`${API_BASE_URL}/api/subscriptions/claim-daily-bonus`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`🎁 ${data.message}`);
        fetchData(); // Refresh data
      } else {
        toast.info(data.message);
      }
    } catch (error) {
      toast.error('Failed to claim bonus');
    } finally {
      setClaimingBonus(false);
    }
  };

  const currentTier = subscription?.tier || 'free';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-xl">←</button>
          <h1 className="text-xl font-bold">Subscriptions</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Current Status */}
        {subscription && (
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl p-6 text-white mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Current Plan</p>
                <p className="text-2xl font-bold">{tiers[currentTier]?.name || 'Free'}</p>
                {subscription.bonus_streak > 0 && (
                  <p className="text-sm text-white/90 mt-1">🔥 {subscription.bonus_streak} day bonus streak</p>
                )}
              </div>
              {currentTier !== 'free' && (
                <Button
                  onClick={handleClaimBonus}
                  disabled={claimingBonus}
                  className="bg-white text-violet-600 hover:bg-white/90"
                >
                  {claimingBonus ? 'Claiming...' : '🎁 Claim Daily Bonus'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Subscription Tiers */}
        <h2 className="text-xl font-bold mb-4">Choose Your Plan</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {Object.entries(tiers).map(([tierId, tier]) => {
            // Get tier icon and color
            const tierConfig = {
              free: { icon: <Shield className="w-5 h-5 text-gray-400" />, highlight: false, color: 'border-border' },
              bronze: { icon: <span className="text-xl">🥉</span>, highlight: false, color: 'border-amber-700' },
              silver: { icon: <span className="text-xl">🥈</span>, highlight: false, color: 'border-gray-300' },
              gold: { icon: <span className="text-xl">🥇</span>, highlight: true, color: 'border-yellow-400' },
              platinum: { icon: <Crown className="w-5 h-5 text-purple-400" />, highlight: true, color: 'border-purple-500' },
            };
            const config = tierConfig[tierId] || tierConfig.free;
            
            return (
              <div
                key={tierId}
                className={`rounded-2xl border-2 p-4 transition-all ${
                  tierId === currentTier 
                    ? 'border-violet-500 bg-violet-500/10' 
                    : `${config.color} bg-card`
                }`}
              >
                {(tierId === 'gold' || tierId === 'platinum') && (
                  <div className={`${tierId === 'platinum' ? 'bg-purple-500' : 'bg-yellow-500'} text-white text-xs font-bold px-2 py-1 rounded-full w-fit mb-2`}>
                    {tierId === 'platinum' ? 'ELITE' : 'BEST VALUE'}
                  </div>
                )}
                
                <div className="flex items-center gap-2 mb-2">
                  {config.icon}
                  <h3 className="text-base font-bold">{tier.name}</h3>
                </div>
                
                <div className="mb-3">
                  <span className="text-2xl font-bold">
                    ${tier.price_monthly?.toFixed(2) || '0.00'}
                  </span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
                
                {/* Key benefits */}
                <div className="space-y-1 mb-4 text-xs">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-yellow-400" />
                    <span>{tier.xp_multiplier || 1}x XP</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Gift className="w-3 h-3 text-green-400" />
                    <span>{(tier.daily_bl_bonus || 0).toLocaleString()} BL/day</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Target className="w-3 h-3 text-blue-400" />
                    <span>{tier.daily_mint_limit >= 999999 ? 'Unlimited' : tier.daily_mint_limit} mints/day</span>
                  </div>
                </div>

                {tierId === currentTier ? (
                  <Button disabled className="w-full text-xs py-2" variant="outline" size="sm">
                    Current Plan
                  </Button>
                ) : tierId === 'free' ? (
                  <Button disabled className="w-full text-xs py-2" variant="outline" size="sm">
                    Free
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleUpgrade(tierId)}
                    className={`w-full text-xs py-2 ${
                      tierId === 'platinum' ? 'bg-purple-500 hover:bg-purple-600' : 
                      tierId === 'gold' ? 'bg-yellow-500 hover:bg-yellow-600' : ''
                    }`}
                    size="sm"
                  >
                    Upgrade
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Ranked Profile */}
        {rankedProfile && (
          <>
            <h2 className="text-xl font-bold mb-4">Your Ranked Profile</h2>
            <div className="bg-card rounded-2xl border p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-3xl">
                    {rankedProfile.tier_info?.icon || '🥉'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{rankedProfile.tier_info?.name || 'Bronze'}</h3>
                    <p className="text-muted-foreground">Rating: {rankedProfile.rating}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-500">{rankedProfile.season_wins}W</p>
                  <p className="text-sm text-muted-foreground">{rankedProfile.season_losses}L</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-lg font-bold">{rankedProfile.total_games}</p>
                  <p className="text-xs text-muted-foreground">Games</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-lg font-bold">{rankedProfile.current_streak}</p>
                  <p className="text-xs text-muted-foreground">Streak</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-lg font-bold">{rankedProfile.best_streak}</p>
                  <p className="text-xs text-muted-foreground">Best</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-lg font-bold">{rankedProfile.peak_rating}</p>
                  <p className="text-xs text-muted-foreground">Peak</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Ranked Tiers */}
        <h2 className="text-xl font-bold mb-4">Ranked Tiers</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
          {Object.entries(rankedTiers).map(([tierId, tier]) => (
            <div
              key={tierId}
              className={`rounded-xl p-3 text-center border-2 transition-all ${
                rankedProfile?.tier === tierId 
                  ? 'border-violet-500 bg-violet-500/10' 
                  : 'border-border bg-card'
              }`}
              style={{ borderColor: rankedProfile?.tier === tierId ? tier.color : undefined }}
            >
              <div className="text-3xl mb-1">{tier.icon}</div>
              <p className="font-semibold text-sm">{tier.name}</p>
              <p className="text-xs text-muted-foreground">{tier.min_rating}+</p>
            </div>
          ))}
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <>
            <h2 className="text-xl font-bold mb-4">🏆 Top Players</h2>
            <div className="bg-card rounded-2xl border overflow-hidden">
              {leaderboard.map((player, index) => (
                <div
                  key={player.user_id}
                  className={`flex items-center gap-4 p-4 ${
                    index !== leaderboard.length - 1 ? 'border-b' : ''
                  }`}
                >
                  <div className="w-8 text-center font-bold">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-lg">
                    {player.tier_info?.icon || '🥉'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{player.display_name || player.username || 'Player'}</p>
                    <p className="text-sm text-muted-foreground">{player.tier_info?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{player.rating}</p>
                    <p className="text-xs text-muted-foreground">{player.season_wins}W</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* CTA */}
        <div className="mt-8 text-center">
          <Button
            onClick={() => navigate('/photo-game')}
            className="bg-gradient-to-r from-violet-600 to-purple-600"
            size="lg"
          >
            ⚔️ Enter Battle Arena
          </Button>
        </div>
      </main>
    </div>
  );
};

export default SubscriptionTiers;
