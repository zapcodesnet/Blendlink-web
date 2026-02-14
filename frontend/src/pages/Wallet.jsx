import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { 
  Coins, TrendingUp, ArrowUpRight, ArrowDownRight, 
  Gift, Gamepad2, Trophy, Share2, ChevronRight, RefreshCw,
  Users, DollarSign, Crown, Sparkles, Clock, Eye, EyeOff,
  Wifi, WifiOff, CreditCard, AlertCircle, CheckCircle, ExternalLink,
  Wallet as WalletIcon, Banknote
} from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

// Withdrawal fee constant
const WITHDRAWAL_FEE_RATE = 0.03; // 3%

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

  // Start Stripe onboarding
  const handleStripeOnboarding = async () => {
    try {
      const response = await api.post("/payments/stripe/connect/onboard");
      const data = response.data;
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error("Failed to start Stripe onboarding");
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

  const isDiamond = dailyClaimStatus?.is_diamond || user?.is_diamond_leader;
  const claimAmount = isDiamond ? 5000 : 2000;
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
              isDiamond 
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
                {isDiamond ? <Crown className="w-4 h-4 mr-2" /> : <Gift className="w-4 h-4 mr-2" />}
              </>
            )}
            {canClaim ? (
              <>Claim Daily {claimAmount.toLocaleString()} BL</>
            ) : (
              <>Next claim in {Math.ceil((dailyClaimStatus?.seconds_remaining || 0) / 3600)}h</>
            )}
          </Button>
          
          {isDiamond && (
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
