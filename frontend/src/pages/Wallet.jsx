import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getApiUrl } from "../utils/runtimeConfig";
import { 
  Coins, TrendingUp, ArrowUpRight, ArrowDownRight, 
  Gift, Gamepad2, Trophy, Share2, ChevronRight, RefreshCw,
  Users, DollarSign, Crown, Sparkles, Clock, Eye, EyeOff,
  Wifi, WifiOff, CreditCard, AlertCircle, CheckCircle, ExternalLink,
  Wallet as WalletIcon, Banknote, Shield, Star, Zap, Image, FileText,
  Percent, Info, Minus, Plus
} from "lucide-react";
import { toast } from "sonner";

const API_BASE = getApiUrl();

// Withdrawal fee constant
const WITHDRAWAL_FEE_RATE = 0.03; // 3%

// BL Coin Top-Up Packages
const BL_COIN_PACKAGES = [
  { id: 'starter', price: 4.99, coins: 30000, label: 'Starter Pack' },
  { id: 'popular', price: 9.99, coins: 80000, label: 'Value Pack' },
  { id: 'premium', price: 14.99, coins: 400000, label: 'Pro Pack' },
  { id: 'ultimate', price: 29.99, coins: 1000000, label: 'Premium Pack', allowMultiple: true },
];

// Membership Tiers Configuration
const MEMBERSHIP_TIERS = {
  bronze: {
    name: 'Bronze',
    price: 4.99,
    standardPrice: 9.99,
    color: 'from-amber-600 to-amber-700',
    icon: Shield,
    commission_l1: 3,
    commission_l2: 2,
    daily_mint: 20,
    xp_multiplier: 2,
    daily_bl_bonus: 15000,
    max_pages: 3,
    features: ['3% L1 Commission', '2% L2 Commission', '20 daily mints', 'x2 XP bonus', '15,000 daily BL coins', '3 member pages']
  },
  silver: {
    name: 'Silver',
    price: 9.99,
    standardPrice: 19.99,
    color: 'from-gray-400 to-slate-500',
    icon: Star,
    commission_l1: 3,
    commission_l2: 2,
    daily_mint: 50,
    xp_multiplier: 3,
    daily_bl_bonus: 40000,
    max_pages: 10,
    features: ['3% L1 Commission', '2% L2 Commission', '50 daily mints', 'x3 XP bonus', '40,000 daily BL coins', '10 member pages']
  },
  gold: {
    name: 'Gold',
    price: 14.99,
    standardPrice: 29.99,
    color: 'from-yellow-500 to-amber-500',
    icon: Crown,
    commission_l1: 3,
    commission_l2: 2,
    daily_mint: 150,
    xp_multiplier: 4,
    daily_bl_bonus: 200000,
    max_pages: 25,
    features: ['3% L1 Commission', '2% L2 Commission', '150 daily mints', 'x4 XP bonus', '200,000 daily BL coins', '25 member pages']
  },
  diamond: {
    name: 'Diamond',
    price: 29.99,
    standardPrice: 59.99,
    color: 'from-cyan-400 to-blue-500',
    icon: Sparkles,
    commission_l1: 4,
    commission_l2: 3,
    daily_mint: 999999,
    xp_multiplier: 5,
    daily_bl_bonus: 500000,
    max_pages: 999999,
    features: ['4% L1 Commission', '3% L2 Commission', 'Unlimited mints', 'x5 XP bonus', '500,000 daily BL coins', 'Unlimited pages']
  }
};

export default function Wallet() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [dailyClaimStatus, setDailyClaimStatus] = useState(null);
  
  // Withdrawal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeOnboardingUrl, setStripeOnboardingUrl] = useState(null);
  const [loadingStripeStatus, setLoadingStripeStatus] = useState(true);
  
  // Top Up BL Coins state
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [packageQuantity, setPackageQuantity] = useState(1);
  const [purchasingCoins, setPurchasingCoins] = useState(false);
  const [useBalanceForCoins, setUseBalanceForCoins] = useState(false);
  
  // Membership Subscription state
  const [selectedTier, setSelectedTier] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [useBalanceForSubscription, setUseBalanceForSubscription] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [expandedTier, setExpandedTier] = useState(null);
  
  // Real-time feeds
  const [teamEarnings, setTeamEarnings] = useState([]);
  const [personalEarnings, setPersonalEarnings] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [teamPage, setTeamPage] = useState(0);
  const [personalPage, setPersonalPage] = useState(0);
  const [hasMoreTeam, setHasMoreTeam] = useState(true);
  const [hasMorePersonal, setHasMorePersonal] = useState(true);
  const [newTeamEarning, setNewTeamEarning] = useState(null);
  const [newPersonalEarning, setNewPersonalEarning] = useState(null);
  const [activeTab, setActiveTab] = useState('team'); // 'team' or 'personal'
  
  // WebSocket state
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Refs for infinite scroll
  const teamFeedRef = useRef(null);
  const personalFeedRef = useRef(null);

  // WebSocket connection for real-time earnings
  useEffect(() => {
    if (!user?.user_id) return;
    
    const connectWebSocket = () => {
      const token = localStorage.getItem('blendlink_token');
      if (!token) return;
      
      // Construct WebSocket URL
      const wsUrl = API_BASE.replace('https://', 'wss://').replace('http://', 'ws://');
      const wsEndpoint = `${wsUrl}/api/referral/ws/earnings/${user.user_id}?token=${token}`;
      
      console.log('Connecting to wallet WebSocket...');
      
      try {
        wsRef.current = new WebSocket(wsEndpoint);
        
        wsRef.current.onopen = () => {
          console.log('Wallet WebSocket connected');
          setWsConnected(true);
        };
        
        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('Wallet WS message:', data.type);
            
            if (data.type === 'connected') {
              // Initial connection confirmed
              toast.success('Real-time notifications active', { duration: 2000 });
            } else if (data.type === 'balance_update') {
              // Update balances in real-time
              setBalance(prev => ({
                ...prev,
                balance: data.bl_balance,
                usd_balance: data.usd_balance
              }));
              setUser(prev => ({ ...prev, bl_coins: data.bl_balance }));
            } else if (data.type === 'new_earning') {
              // New earning notification
              const earning = data.data;
              toast.success(
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span>
                    +{earning.amount?.toLocaleString()} {earning.currency || 'BL'}
                    <span className="text-sm opacity-70 ml-1">({earning.description || earning.type})</span>
                  </span>
                </div>,
                { duration: 5000 }
              );
              
              // Add to appropriate feed
              if (earning.type?.includes('commission')) {
                setNewTeamEarning(earning);
                fetchTeamEarnings(0); // Refresh team earnings
                setTimeout(() => setNewTeamEarning(null), 3000);
              } else {
                setNewPersonalEarning(earning);
                fetchPersonalEarnings(0); // Refresh personal earnings
                setTimeout(() => setNewPersonalEarning(null), 3000);
              }
              
              // Also refresh wallet data
              fetchWalletData();
            }
          } catch (e) {
            console.error('WebSocket message parse error:', e);
          }
        };
        
        wsRef.current.onclose = () => {
          console.log('Wallet WebSocket disconnected');
          setWsConnected(false);
          
          // Attempt reconnection after 5 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            if (user?.user_id) {
              connectWebSocket();
            }
          }, 5000);
        };
        
        wsRef.current.onerror = (error) => {
          console.error('Wallet WebSocket error:', error);
          setWsConnected(false);
        };
        
      } catch (e) {
        console.error('WebSocket connection error:', e);
      }
    };
    
    // Initial connection
    connectWebSocket();
    
    // Ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
    
    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user?.user_id]);

  useEffect(() => {
    fetchWalletData();
    fetchDailyClaimStatus();
    fetchTeamEarnings(0);
    fetchPersonalEarnings(0);
    fetchStripeStatus();
    
    // Fallback polling for new earnings (every 60 seconds) when WebSocket not connected
    const interval = setInterval(() => {
      if (!wsConnected) {
        pollNewEarnings();
      }
    }, 60000);
    
    return () => clearInterval(interval);
  }, [wsConnected]);

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

  // Stripe Connect status check
  const fetchStripeStatus = async () => {
    setLoadingStripeStatus(true);
    try {
      const response = await api.get("/payments/stripe/connect/status");
      const data = response.data;
      setStripeConnected(data.is_connected && data.charges_enabled);
      if (!data.is_connected && data.onboarding_url) {
        setStripeOnboardingUrl(data.onboarding_url);
      }
    } catch (error) {
      console.error("Stripe status error:", error);
      setStripeConnected(false);
    } finally {
      setLoadingStripeStatus(false);
    }
  };

  // Start Stripe onboarding - uses GET redirect to bypass body parsing issues
  const handleStripeOnboarding = async () => {
    try {
      const token = localStorage.getItem('blendlink_token');
      if (!token) {
        toast.error("Please log in to connect your Stripe account.");
        return;
      }
      // Use GET redirect endpoint - browser follows 302 redirect natively, no JSON parsing needed
      window.location.href = `${API_BASE}/api/payments/stripe/connect/onboard-redirect?token=${encodeURIComponent(token)}`;
    } catch (error) {
      toast.error("Failed to start Stripe onboarding. Please try again.");
    }
  };

  // Handle withdrawal
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const availableBalance = balance?.usd_balance || 0;
    if (amount > availableBalance) {
      toast.error(`Insufficient balance. Available: $${availableBalance.toFixed(2)}`);
      return;
    }

    if (amount < 10) {
      toast.error("Minimum withdrawal is $10.00");
      return;
    }

    if (!stripeConnected) {
      toast.error("Please connect your Stripe account first");
      return;
    }

    setWithdrawing(true);
    try {
      const response = await api.post("/payments/stripe/withdraw", {
        amount: amount
      });
      const data = response.data;
      
      toast.success(
        <div>
          <p className="font-medium">Withdrawal Submitted!</p>
          <p className="text-sm">Amount: ${data.amount.toFixed(2)}</p>
          <p className="text-sm">Fee (3%): ${data.fee.toFixed(2)}</p>
          <p className="text-sm">Net: ${data.net_amount.toFixed(2)}</p>
        </div>
      );
      
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      fetchWalletData();
    } catch (error) {
      const msg = error.response?.data?.detail || "Withdrawal failed";
      toast.error(msg);
    } finally {
      setWithdrawing(false);
    }
  };

  // Purchase BL Coins
  const handlePurchaseCoins = async (pkg) => {
    setPurchasingCoins(true);
    const quantity = pkg.allowMultiple ? packageQuantity : 1;
    const totalPrice = pkg.price * quantity;
    const totalCoins = pkg.coins * quantity;
    
    try {
      // Check if using balance
      if (useBalanceForCoins) {
        const availableBalance = balance?.usd_balance || 0;
        if (availableBalance < totalPrice) {
          toast.error(`Insufficient balance. You have $${availableBalance.toFixed(2)} available.`);
          setPurchasingCoins(false);
          return;
        }
        
        // Purchase from balance - correct endpoint
        const response = await api.post("/payments/stripe/bl-coins/purchase-from-balance", {
          package_id: pkg.id,
          quantity: quantity,
          amount: totalPrice,
          coins: totalCoins
        });
        
        toast.success(`Successfully purchased ${totalCoins.toLocaleString()} BL coins!`);
        fetchWalletData();
      } else {
        // Use Stripe checkout for BL coins - correct endpoint
        const response = await api.post("/payments/stripe/bl-coins/checkout", {
          tier_id: pkg.id,
          amount_usd: totalPrice,
          coins_amount: totalCoins,
          quantity: quantity,
          origin_url: window.location.origin
        });
        
        if (response.data?.url) {
          window.location.href = response.data.url;
        } else {
          throw new Error('No checkout URL received');
        }
      }
    } catch (error) {
      const msg = error.response?.data?.detail || "Failed to process purchase";
      toast.error(msg);
    } finally {
      setPurchasingCoins(false);
      setSelectedPackage(null);
      setPackageQuantity(1);
    }
  };

  // Subscribe to Membership Tier
  const handleSubscribe = async (tierId) => {
    setSubscribing(true);
    const tier = MEMBERSHIP_TIERS[tierId];
    
    try {
      // Check if using balance
      if (useBalanceForSubscription) {
        const availableBalance = balance?.usd_balance || 0;
        if (availableBalance < tier.price) {
          toast.error(`Insufficient balance. You have $${availableBalance.toFixed(2)} available.`);
          setSubscribing(false);
          return;
        }
        
        // Subscribe from balance - use correct endpoint
        const response = await api.post("/payments/stripe/subscriptions/subscribe-from-balance", {
          tier: tierId,
          amount: tier.price
        });
        
        toast.success(`Successfully subscribed to ${tier.name} membership!`);
        setCurrentSubscription(response.data.subscription);
        fetchWalletData();
        fetchDailyClaimStatus();
        
        // Update user context
        if (user) {
          setUser({ ...user, subscription_tier: tierId });
        }
      } else {
        // Use Stripe checkout for subscription via api service (handles body stream issues)
        const successUrl = `${window.location.origin}/wallet?subscription_success=true`;
        const cancelUrl = `${window.location.origin}/wallet`;
        
        const response = await api.post(
          `/subscriptions/checkout?tier=${tierId}&success_url=${encodeURIComponent(successUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`
        );
        const data = response.data;
        
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
        } else if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No checkout URL received');
        }
      }
    } catch (error) {
      const msg = error.message || error.response?.data?.detail || "Failed to process subscription";
      toast.error(msg);
    } finally {
      setSubscribing(false);
      setSelectedTier(null);
    }
  };

  // Cancel subscription
  const handleCancelSubscription = async () => {
    if (!window.confirm("Are you sure you want to cancel your subscription? You'll lose access to premium features at the end of your billing period.")) {
      return;
    }
    
    try {
      await api.post("/subscriptions/cancel");
      toast.success("Subscription cancelled. Access will end at the end of your billing period.");
      fetchWalletData();
    } catch (error) {
      toast.error("Failed to cancel subscription");
    }
  };

  // Get current subscription status
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await api.get("/subscriptions/current");
        setCurrentSubscription(response.data);
      } catch (error) {
        // No active subscription
        setCurrentSubscription(null);
      }
    };
    fetchSubscription();
  }, []);

  const fetchDailyClaimStatus = async () => {
    try {
      const response = await api.get("/referral/daily-claim/status");
      setDailyClaimStatus(response.data);
    } catch (error) {
      console.error("Daily claim status error:", error);
    }
  };

  const fetchTeamEarnings = async (page = 0, append = false) => {
    if (loadingTeam) return;
    setLoadingTeam(true);
    try {
      const response = await api.get(`/referral/commission-history?skip=${page * 20}&limit=20`);
      const commissions = response.data.commissions || [];
      
      if (append) {
        setTeamEarnings(prev => [...prev, ...commissions]);
      } else {
        setTeamEarnings(commissions);
      }
      setHasMoreTeam(commissions.length === 20);
      setTeamPage(page);
    } catch (error) {
      console.error("Team earnings error:", error);
    } finally {
      setLoadingTeam(false);
    }
  };

  const fetchPersonalEarnings = async (page = 0, append = false) => {
    if (loadingPersonal) return;
    setLoadingPersonal(true);
    try {
      const response = await api.get(`/referral/transaction-history?skip=${page * 20}&limit=20&transaction_type=sale_earnings`);
      const sales = response.data.transactions || [];
      
      if (append) {
        setPersonalEarnings(prev => [...prev, ...sales]);
      } else {
        setPersonalEarnings(sales);
      }
      setHasMorePersonal(sales.length === 20);
      setPersonalPage(page);
    } catch (error) {
      console.error("Personal earnings error:", error);
    } finally {
      setLoadingPersonal(false);
    }
  };

  const pollNewEarnings = async () => {
    try {
      // Check for new team earnings
      const teamResponse = await api.get("/referral/commission-history?skip=0&limit=1");
      const latestTeam = teamResponse.data.commissions?.[0];
      if (latestTeam && teamEarnings[0]?.commission_id !== latestTeam.commission_id) {
        setNewTeamEarning(latestTeam);
        setTeamEarnings(prev => [latestTeam, ...prev]);
        // Animate balance update
        fetchWalletData();
        setTimeout(() => setNewTeamEarning(null), 3000);
      }
      
      // Check for new personal sales
      const personalResponse = await api.get("/referral/transaction-history?skip=0&limit=1&transaction_type=sale_earnings");
      const latestPersonal = personalResponse.data.transactions?.[0];
      if (latestPersonal && personalEarnings[0]?.transaction_id !== latestPersonal.transaction_id) {
        setNewPersonalEarning(latestPersonal);
        setPersonalEarnings(prev => [latestPersonal, ...prev]);
        fetchWalletData();
        setTimeout(() => setNewPersonalEarning(null), 3000);
      }
    } catch (error) {
      console.error("Poll error:", error);
    }
  };

  const handleClaimDaily = async () => {
    setClaiming(true);
    try {
      const result = await api.post("/referral/daily-claim");
      const data = result.data;
      const claimedAmount = data.amount || 0;
      const isDiamond = data.is_diamond;
      
      toast.success(
        <div className="flex items-center gap-2">
          {isDiamond && <Crown className="w-5 h-5 text-yellow-400" />}
          <span>Claimed {claimedAmount.toLocaleString()} BL Coins!</span>
        </div>
      );
      
      setBalance(prev => ({ ...prev, balance: data.new_balance }));
      setUser({ ...user, bl_coins: data.new_balance });
      fetchDailyClaimStatus();
      fetchWalletData();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message || "Already claimed today";
      if (typeof errorMsg === 'object') {
        toast.error(`Daily claim not ready. Try again in ${Math.ceil(errorMsg.seconds_remaining / 3600)} hours.`);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setClaiming(false);
    }
  };

  // Infinite scroll handler
  const handleScroll = useCallback((e, type) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
      if (type === 'team' && hasMoreTeam && !loadingTeam) {
        fetchTeamEarnings(teamPage + 1, true);
      } else if (type === 'personal' && hasMorePersonal && !loadingPersonal) {
        fetchPersonalEarnings(personalPage + 1, true);
      }
    }
  }, [hasMoreTeam, hasMorePersonal, loadingTeam, loadingPersonal, teamPage, personalPage]);

  const getTransactionIcon = (type) => {
    if (type?.includes('referral') || type?.includes('commission')) return Share2;
    if (type?.includes('game')) return Gamepad2;
    if (type?.includes('raffle')) return Trophy;
    if (type?.includes('daily') || type?.includes('login') || type?.includes('bonus')) return Gift;
    if (type?.includes('sale')) return DollarSign;
    return Coins;
  };

  const formatTimeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const isDiamond = dailyClaimStatus?.is_diamond || user?.is_diamond_leader || user?.subscription_tier === 'diamond';
  
  // Calculate claim amount based on subscription tier
  const getTierClaimAmount = () => {
    const tier = user?.subscription_tier;
    if (tier === 'diamond') return 500000;
    if (tier === 'gold') return 200000;
    if (tier === 'silver') return 40000;
    if (tier === 'bronze') return 15000;
    return isDiamond ? 5000 : 2000; // Legacy diamond leader or free tier
  };
  
  const claimAmount = getTierClaimAmount();
  const canClaim = dailyClaimStatus?.can_claim !== false;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-bold">Wallet</h1>
          {/* WebSocket connection status */}
          <div className="flex items-center gap-2" data-testid="wallet-ws-status">
            {wsConnected ? (
              <div className="flex items-center gap-1 text-green-500 text-sm">
                <Wifi className="w-4 h-4" />
                <span className="hidden sm:inline">Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-yellow-500 text-sm">
                <WifiOff className="w-4 h-4" />
                <span className="hidden sm:inline">Polling</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Balance Card with Daily Claim */}
        <div className={`rounded-2xl p-6 text-white mb-6 animate-fade-in ${
          isDiamond 
            ? 'bg-gradient-to-br from-yellow-600 via-amber-500 to-yellow-700' 
            : 'bl-coin-gradient'
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/80 text-sm flex items-center gap-1">
                Total Balance
                {isDiamond && <Crown className="w-4 h-4 text-yellow-200" />}
              </p>
              <p className="text-4xl font-bold mt-1">
                {loading ? "..." : (balance?.balance || 0).toLocaleString()}
              </p>
              <p className="text-white/80 text-sm mt-1">BL Coins</p>
            </div>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isDiamond ? 'bg-yellow-400/30' : 'bg-white/20'
            }`}>
              {isDiamond ? <Crown className="w-8 h-8" /> : <Coins className="w-8 h-8" />}
            </div>
          </div>
          
          {/* Enhanced Daily Claim Button */}
          <Button 
            className={`w-full mt-4 ${
              user?.subscription_tier === 'diamond'
                ? 'bg-cyan-400/30 hover:bg-cyan-400/40 text-white border border-cyan-300/30'
                : user?.subscription_tier === 'gold'
                ? 'bg-yellow-400/30 hover:bg-yellow-400/40 text-white border border-yellow-300/30'
                : user?.subscription_tier === 'silver'
                ? 'bg-gray-400/30 hover:bg-gray-400/40 text-white border border-gray-300/30'
                : user?.subscription_tier === 'bronze'
                ? 'bg-amber-400/30 hover:bg-amber-400/40 text-white border border-amber-300/30'
                : isDiamond 
                ? 'bg-yellow-400/30 hover:bg-yellow-400/40 text-white border border-yellow-300/30' 
                : 'bg-white/20 hover:bg-white/30 text-white'
            }`}
            onClick={handleClaimDaily}
            disabled={claiming || !canClaim}
            data-testid="claim-daily-btn"
          >
            {claiming ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <>
                {user?.subscription_tier && user?.subscription_tier !== 'free' ? (
                  MEMBERSHIP_TIERS[user.subscription_tier] ? 
                    React.createElement(MEMBERSHIP_TIERS[user.subscription_tier].icon, { className: "w-4 h-4 mr-2" }) :
                    <Gift className="w-4 h-4 mr-2" />
                ) : isDiamond ? (
                  <Crown className="w-4 h-4 mr-2" />
                ) : (
                  <Gift className="w-4 h-4 mr-2" />
                )}
              </>
            )}
            {canClaim ? (
              <>Claim Daily {claimAmount.toLocaleString()} BL</>
            ) : (
              <>Next claim in {Math.ceil((dailyClaimStatus?.seconds_remaining || 0) / 3600)}h</>
            )}
          </Button>
          
          {/* Subscription tier bonus indicator */}
          {user?.subscription_tier && user?.subscription_tier !== 'free' && (
            <p className="text-center text-white/70 text-xs mt-2 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" />
              {user.subscription_tier.charAt(0).toUpperCase() + user.subscription_tier.slice(1)} Member: {claimAmount.toLocaleString()} BL daily
            </p>
          )}
          
          {isDiamond && !user?.subscription_tier && (
            <p className="text-center text-yellow-200/70 text-xs mt-2 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" />
              Diamond Leader Bonus: +3,000 BL daily
            </p>
          )}
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
              {isDiamond && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-yellow-500 flex items-center gap-1">
                    <Crown className="w-4 h-4" /> Diamond Leader
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
            onClick={() => navigate("/my-team")}
            className="bg-card rounded-xl p-4 border border-border/50 card-hover text-left"
            data-testid="referrals-btn"
          >
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-2">
              <Share2 className="w-5 h-5 text-blue-500" />
            </div>
            <p className="font-semibold">My Team</p>
            <p className="text-xs text-muted-foreground">Referrals & commissions</p>
          </button>
        </div>

        {/* Real-Time Earnings Feeds */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden mb-6">
          {/* Tab Headers */}
          <div className="flex border-b border-border/50">
            <button
              onClick={() => setActiveTab('team')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'team' 
                  ? 'text-primary border-b-2 border-primary bg-primary/5' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="team-earnings-tab"
            >
              <Users className="w-4 h-4 inline mr-2" />
              Team Commissions
            </button>
            <button
              onClick={() => setActiveTab('personal')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'personal' 
                  ? 'text-primary border-b-2 border-primary bg-primary/5' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid="personal-earnings-tab"
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Personal Sales
            </button>
          </div>

          {/* Team Earnings Feed */}
          {activeTab === 'team' && (
            <div 
              ref={teamFeedRef}
              className="max-h-80 overflow-y-auto"
              onScroll={(e) => handleScroll(e, 'team')}
            >
              {teamEarnings.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No team commissions yet</p>
                  <p className="text-xs mt-1">Earn when your team makes sales!</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {teamEarnings.map((earning, index) => (
                    <div 
                      key={earning.commission_id || index}
                      className={`p-4 flex items-center gap-3 transition-all ${
                        newTeamEarning?.commission_id === earning.commission_id 
                          ? 'bg-green-500/10 animate-pulse' 
                          : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          L{earning.level} Commission
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(earning.created_at)}
                          <span className="mx-1">•</span>
                          <span className="flex items-center gap-1">
                            <EyeOff className="w-3 h-3" /> Anonymous
                          </span>
                        </p>
                      </div>
                      <span className="font-semibold text-green-500">
                        +${earning.amount_usd?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  ))}
                  {loadingTeam && (
                    <div className="p-4 text-center">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Personal Sales Feed */}
          {activeTab === 'personal' && (
            <div 
              ref={personalFeedRef}
              className="max-h-80 overflow-y-auto"
              onScroll={(e) => handleScroll(e, 'personal')}
            >
              {personalEarnings.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No sales earnings yet</p>
                  <p className="text-xs mt-1">Start selling to earn!</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {personalEarnings.map((earning, index) => (
                    <div 
                      key={earning.transaction_id || index}
                      className={`p-4 flex items-center gap-3 transition-all ${
                        newPersonalEarning?.transaction_id === earning.transaction_id 
                          ? 'bg-green-500/10 animate-pulse' 
                          : ''
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {earning.description || 'Sale Earnings'}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(earning.created_at)}
                          {earning.details?.item_name && (
                            <>
                              <span className="mx-1">•</span>
                              {earning.details.item_name}
                            </>
                          )}
                        </p>
                      </div>
                      <span className="font-semibold text-green-500">
                        +${earning.amount?.toFixed(2) || '0.00'}
                      </span>
                    </div>
                  ))}
                  {loadingPersonal && (
                    <div className="p-4 text-center">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/50">
            <h2 className="font-semibold">All Transactions</h2>
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
                    <span className={`font-semibold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                      {isPositive ? "+" : ""}{txn.amount?.toLocaleString()} BL
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Withdraw Earnings Section */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden mt-6" data-testid="withdraw-section">
          <div className="p-4 border-b border-border/50">
            <h2 className="font-semibold flex items-center gap-2">
              <Banknote className="w-5 h-5 text-green-500" />
              Withdraw Earnings
            </h2>
          </div>
          
          <div className="p-4">
            {/* USD Balance Display */}
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-xl p-4 mb-4">
              <p className="text-sm text-muted-foreground">Available for Withdrawal</p>
              <p className="text-3xl font-bold text-green-600">
                ${(balance?.usd_balance || 0).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Team commissions + Personal sales earnings
              </p>
            </div>

            {/* Stripe Connection Status */}
            {loadingStripeStatus ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : stripeConnected ? (
              <div className="bg-green-500/10 rounded-lg p-3 mb-4 flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-700">Stripe Connected</p>
                  <p className="text-xs text-green-600">Ready to receive payouts</p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-500/10 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-amber-700">Connect Stripe Account</p>
                    <p className="text-xs text-amber-600">Required to withdraw earnings</p>
                  </div>
                </div>
                <Button 
                  onClick={handleStripeOnboarding}
                  className="w-full mt-2 bg-amber-500 hover:bg-amber-600"
                  data-testid="stripe-onboard-btn"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Connect Stripe Account
                </Button>
              </div>
            )}

            {/* Withdrawal Info */}
            <div className="bg-muted/30 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Withdrawal Fee</span>
                <span className="font-medium">3%</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Minimum Withdrawal</span>
                <span className="font-medium">$10.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing Time</span>
                <span className="font-medium">48h - 7 days</span>
              </div>
            </div>

            {/* Withdraw Button */}
            <Button
              onClick={() => setShowWithdrawModal(true)}
              disabled={!stripeConnected || (balance?.usd_balance || 0) < 10}
              className="w-full bg-green-600 hover:bg-green-700"
              data-testid="withdraw-btn"
            >
              <Banknote className="w-4 h-4 mr-2" />
              Withdraw to Stripe
            </Button>

            {!stripeConnected && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Connect your Stripe account to enable withdrawals
              </p>
            )}
          </div>
        </div>

        {/* Top Up BL Coins Section */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden mt-6" data-testid="topup-coins-section">
          <div className="p-4 border-b border-border/50">
            <h2 className="font-semibold flex items-center gap-2">
              <Coins className="w-5 h-5 text-amber-500" />
              Top Up Your BL Coins Balance
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Purchase BL coins instantly using your real cash earnings balance or connected payment method. More coins mean more fun in games, minting, using app features, and listing more in the marketplace or member's page.
            </p>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Payment Method Toggle */}
            <div className="bg-muted/30 rounded-lg p-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm flex items-center gap-2">
                  <WalletIcon className="w-4 h-4" />
                  Pay from Real Cash Balance (${(balance?.usd_balance || 0).toFixed(2)})
                </span>
                <input
                  type="checkbox"
                  checked={useBalanceForCoins}
                  onChange={(e) => setUseBalanceForCoins(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
              </label>
              {!useBalanceForCoins && (
                <p className="text-xs text-muted-foreground mt-1">
                  Payment will be processed via Stripe
                </p>
              )}
            </div>
            
            {/* Package Cards */}
            <div className="grid grid-cols-2 gap-3">
              {BL_COIN_PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`relative rounded-xl border-2 p-4 cursor-pointer transition-all ${
                    selectedPackage?.id === pkg.id
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-border/50 hover:border-amber-500/50"
                  }`}
                  onClick={() => {
                    setSelectedPackage(pkg);
                    setPackageQuantity(1);
                  }}
                >
                  <div className="text-center">
                    <Coins className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                    <p className="text-xl font-bold">{pkg.coins.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">BL Coins</p>
                    <p className="text-lg font-semibold text-amber-600 mt-2">${pkg.price.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{pkg.label}</p>
                  </div>
                  
                  {pkg.allowMultiple && selectedPackage?.id === pkg.id && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Quantity</p>
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPackageQuantity(Math.max(1, packageQuantity - 1));
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={packageQuantity}
                          onChange={(e) => setPackageQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                          className="w-16 h-8 text-center"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPackageQuantity(Math.min(100, packageQuantity + 1));
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-center mt-2 text-sm font-medium">
                        Total: ${(pkg.price * packageQuantity).toFixed(2)} → {(pkg.coins * packageQuantity).toLocaleString()} BL
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Purchase Button */}
            {selectedPackage && (
              <Button
                onClick={() => handlePurchaseCoins(selectedPackage)}
                disabled={purchasingCoins || (useBalanceForCoins && (balance?.usd_balance || 0) < selectedPackage.price * (selectedPackage.allowMultiple ? packageQuantity : 1))}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                data-testid="purchase-coins-btn"
              >
                {purchasingCoins ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Coins className="w-4 h-4 mr-2" />
                )}
                Purchase {((selectedPackage.coins * (selectedPackage.allowMultiple ? packageQuantity : 1))).toLocaleString()} BL Coins
              </Button>
            )}
          </div>
        </div>

        {/* Membership Subscriptions Section */}
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden mt-6" data-testid="membership-section">
          <div className="p-4 border-b border-border/50">
            <h2 className="font-semibold flex items-center gap-2">
              <Crown className="w-5 h-5 text-purple-500" />
              Upgrade Your Membership for More Earnings & Perks
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Subscriptions are recurring monthly. Payments are deducted from your preferred payment method. If deductions fail from your BlendLink earnings balance, we automatically attempt your connected Stripe account, credit/debit card, or bank account.
            </p>
            <div className="mt-3 bg-gradient-to-r from-purple-500/10 to-amber-500/10 border border-purple-500/30 rounded-lg p-3">
              <p className="text-sm font-semibold text-purple-400">
                Founding members who join during the pre-launch/launch period will have their subscription rate locked at 50% off the standard price for as long as they remain active members. Available for a Limited Time Only!
              </p>
            </div>
          </div>
          
          <div className="p-4 space-y-4">
            {/* Current Subscription Status */}
            {(user?.subscription_tier && user.subscription_tier !== 'free') && (
              <div className={`bg-gradient-to-r ${MEMBERSHIP_TIERS[user.subscription_tier]?.color || 'from-gray-500 to-gray-600'} rounded-xl p-4 text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {MEMBERSHIP_TIERS[user.subscription_tier] && 
                      React.createElement(MEMBERSHIP_TIERS[user.subscription_tier].icon, { className: "w-8 h-8" })}
                    <div>
                      <p className="font-bold text-lg">Current: {MEMBERSHIP_TIERS[user.subscription_tier]?.name || user.subscription_tier}</p>
                      <p className="text-sm opacity-90">Active subscription</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelSubscription}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Payment Method Toggle */}
            <div className="bg-muted/30 rounded-lg p-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm flex items-center gap-2">
                  <WalletIcon className="w-4 h-4" />
                  Pay from Real Cash Balance (${(balance?.usd_balance || 0).toFixed(2)})
                </span>
                <input
                  type="checkbox"
                  checked={useBalanceForSubscription}
                  onChange={(e) => setUseBalanceForSubscription(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
              </label>
              <div className="mt-2 text-xs text-muted-foreground flex items-start gap-2">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  Payment priority: BlendLink earnings → Connected Stripe → Linked Card → Bank Account. 
                  Failed payments will retry up to 3 times.
                </span>
              </div>
            </div>
            
            {/* Tier Cards */}
            <div className="space-y-3">
              {Object.entries(MEMBERSHIP_TIERS).map(([tierId, tier]) => {
                const TierIcon = tier.icon;
                const isCurrentTier = user?.subscription_tier === tierId;
                const isExpanded = expandedTier === tierId;
                
                return (
                  <div
                    key={tierId}
                    className={`rounded-xl border-2 overflow-hidden transition-all ${
                      isCurrentTier
                        ? "border-green-500 bg-green-500/5"
                        : selectedTier === tierId
                        ? "border-purple-500 bg-purple-500/5"
                        : "border-border/50 hover:border-purple-500/50"
                    }`}
                  >
                    {/* Tier Header */}
                    <div
                      className={`p-4 cursor-pointer bg-gradient-to-r ${tier.color}`}
                      onClick={() => setExpandedTier(isExpanded ? null : tierId)}
                    >
                      <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <TierIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold flex items-center gap-2">
                              {tier.name} Member
                              {isCurrentTier && (
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">Current</span>
                              )}
                            </h3>
                            <p className="text-sm opacity-90">
                              ${tier.price.toFixed(2)}/month{' '}
                              <span className="line-through opacity-60">${tier.standardPrice.toFixed(2)}/month</span>
                            </p>
                          </div>
                        </div>
                        <ChevronRight className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                    
                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="p-4 space-y-4">
                        {/* Commission Rates */}
                        <div className="bg-muted/30 rounded-lg p-3">
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Percent className="w-4 h-4 text-green-500" />
                            Commission Rates
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Earn <span className="font-bold text-green-600">{tier.commission_l1}% commission</span> from direct recruits (Level 1) and <span className="font-bold text-green-600">{tier.commission_l2}%</span> from indirect recruits (Level 2) on each successful sale of products, services, digital goods, rentals, foods, etc.
                          </p>
                        </div>
                        
                        {/* Benefits Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-muted/30 rounded-lg p-3 text-center">
                            <Image className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                            <p className="text-lg font-bold">
                              {tier.daily_mint >= 999999 ? '∞' : tier.daily_mint}
                            </p>
                            <p className="text-xs text-muted-foreground">Daily Mints</p>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3 text-center">
                            <Zap className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
                            <p className="text-lg font-bold">x{tier.xp_multiplier}</p>
                            <p className="text-xs text-muted-foreground">XP Multiplier</p>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3 text-center">
                            <Coins className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                            <p className="text-lg font-bold">{tier.daily_bl_bonus.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Daily BL Coins</p>
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3 text-center">
                            <FileText className="w-5 h-5 mx-auto mb-1 text-purple-500" />
                            <p className="text-lg font-bold">
                              {tier.max_pages >= 999999 ? '∞' : tier.max_pages}
                            </p>
                            <p className="text-xs text-muted-foreground">Member Pages</p>
                          </div>
                        </div>
                        
                        {/* Feature List */}
                        <div className="space-y-2">
                          {tier.features.map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Subscribe Button */}
                        {!isCurrentTier && (
                          <Button
                            onClick={() => handleSubscribe(tierId)}
                            disabled={subscribing || (useBalanceForSubscription && (balance?.usd_balance || 0) < tier.price)}
                            className={`w-full bg-gradient-to-r ${tier.color} text-white font-semibold`}
                            data-testid={`subscribe-${tierId}-btn`}
                          >
                            {subscribing && selectedTier === tierId ? (
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <TierIcon className="w-4 h-4 mr-2" />
                            )}
                            Subscribe to {tier.name} - ${tier.price.toFixed(2)}/mo <span className="line-through opacity-60 ml-1">${tier.standardPrice.toFixed(2)}</span>
                          </Button>
                        )}
                        
                        {isCurrentTier && (
                          <div className="bg-green-500/10 rounded-lg p-3 flex items-center gap-2 text-green-700">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-medium">This is your current plan</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sync Notice */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          🔄 Synced with Blendlink mobile app
        </p>
      </main>

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl max-w-md w-full p-6 border border-border">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-green-500" />
              Withdraw Earnings
            </h3>

            <div className="mb-4">
              <label className="text-sm text-muted-foreground">Amount (USD)</label>
              <Input
                type="number"
                placeholder="Enter amount"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                min="10"
                max={balance?.usd_balance || 0}
                className="mt-1"
                data-testid="withdraw-amount-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: ${(balance?.usd_balance || 0).toFixed(2)}
              </p>
            </div>

            {/* Fee Calculation */}
            {withdrawAmount && parseFloat(withdrawAmount) > 0 && (
              <div className="bg-muted/30 rounded-lg p-3 mb-4 text-sm">
                <div className="flex justify-between mb-1">
                  <span>Amount</span>
                  <span>${parseFloat(withdrawAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-1 text-amber-600">
                  <span>Fee (3%)</span>
                  <span>-${(parseFloat(withdrawAmount) * 0.03).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-1 mt-1">
                  <span>You'll Receive</span>
                  <span className="text-green-600">
                    ${(parseFloat(withdrawAmount) * 0.97).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Processing Notice */}
            <div className="bg-blue-500/10 rounded-lg p-3 mb-4 text-sm">
              <p className="text-blue-700 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Processing takes 48 hours to 7 days
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) < 10}
                className="flex-1 bg-green-600 hover:bg-green-700"
                data-testid="confirm-withdraw-btn"
              >
                {withdrawing ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Confirm Withdrawal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
