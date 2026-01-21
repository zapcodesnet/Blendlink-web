import React, { useState, useEffect, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { 
  Gavel, Clock, DollarSign, Users, Zap, TrendingUp,
  Loader2, AlertCircle, Check, ChevronDown, ChevronUp,
  Shield, Trophy
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Format time remaining
const formatTimeRemaining = (timeObj) => {
  if (!timeObj || timeObj.ended) return "Ended";
  return timeObj.display;
};

export default function AuctionBidPanel({ listing, onBidPlaced }) {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const navigate = useNavigate();
  
  const [bidAmount, setBidAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [auctionStatus, setAuctionStatus] = useState(null);
  const [bids, setBids] = useState([]);
  const [showBidHistory, setShowBidHistory] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  const auction = listing?.auction;
  const isOwner = user?.user_id === listing?.user_id;

  // Initialize auction status
  useEffect(() => {
    if (auction) {
      fetchAuctionStatus();
      fetchBidHistory();
      connectWebSocket();
      startTimer();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [listing?.listing_id]);

  const fetchAuctionStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auctions/listing/${listing.listing_id}/status`);
      if (response.ok) {
        const data = await response.json();
        setAuctionStatus(data);
        setTimeRemaining(data.time_remaining);
      }
    } catch (err) {
      console.error("Failed to fetch auction status:", err);
    }
  };

  const fetchBidHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auctions/listing/${listing.listing_id}/bids`);
      if (response.ok) {
        const data = await response.json();
        setBids(data.bids || []);
      }
    } catch (err) {
      console.error("Failed to fetch bids:", err);
    }
  };

  const connectWebSocket = () => {
    const wsUrl = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    wsRef.current = new WebSocket(`${wsUrl}/api/auctions/ws/${listing.listing_id}`);

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "new_bid") {
          // Update current bid
          setAuctionStatus(prev => ({
            ...prev,
            current_bid: data.amount,
            bid_count: data.bid_count,
            current_bidder_name: data.bidder_name
          }));
          setTimeRemaining(data.time_remaining);
          
          // Refresh bid history
          fetchBidHistory();
          
          // Notify if outbid
          if (user && data.bidder_id !== user.user_id && auctionStatus?.current_bidder_id === user.user_id) {
            toast.warning(`You&apos;ve been outbid! New bid: $${data.amount}`);
          }
          
          // Notify if extended
          if (data.extended) {
            toast.info("Auction extended by 5 minutes!");
          }
        } else if (data.type === "auction_ended") {
          setAuctionStatus(prev => ({
            ...prev,
            status: data.status
          }));
          fetchAuctionStatus();
          
          if (data.winner_id === user?.user_id) {
            toast.success("Congratulations! You won the auction!");
          }
        }
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    };

    // Keepalive ping
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 30000);

    wsRef.current.onclose = () => {
      clearInterval(pingInterval);
      // Reconnect after 3 seconds if auction is still active
      if (auctionStatus?.status === "active") {
        setTimeout(connectWebSocket, 3000);
      }
    };
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (!prev || prev.seconds <= 0) return prev;
        
        const newSeconds = prev.seconds - 1;
        if (newSeconds <= 0) {
          fetchAuctionStatus(); // Refresh when timer ends
          return { ...prev, seconds: 0, ended: true, display: "Ended" };
        }
        
        // Recalculate display
        const days = Math.floor(newSeconds / 86400);
        const hours = Math.floor((newSeconds % 86400) / 3600);
        const minutes = Math.floor((newSeconds % 3600) / 60);
        const seconds = newSeconds % 60;
        
        let display;
        if (days > 0) display = `${days}d ${hours}h`;
        else if (hours > 0) display = `${hours}h ${minutes}m`;
        else if (minutes > 0) display = `${minutes}m ${seconds}s`;
        else display = `${seconds}s`;
        
        return {
          ...prev,
          seconds: newSeconds,
          days, hours, minutes, remaining_seconds: seconds,
          display
        };
      });
    }, 1000);
  };

  const handlePlaceBid = async () => {
    if (!user) {
      toast.info("Please sign in to place a bid", {
        action: { label: "Sign In", onClick: () => navigate("/login") }
      });
      return;
    }

    const amount = parseFloat(bidAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid bid amount");
      return;
    }

    const minBid = getMinBid();
    if (amount < minBid) {
      toast.error(`Minimum bid is $${minBid.toFixed(2)}`);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auctions/listing/${listing.listing_id}/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`
        },
        body: JSON.stringify({ amount })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || "Bid placed successfully!");
        setBidAmount("");
        fetchAuctionStatus();
        fetchBidHistory();
        if (onBidPlaced) onBidPlaced(data);
      } else {
        toast.error(data.detail || "Failed to place bid");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleBuyItNow = async () => {
    if (!user) {
      toast.info("Please sign in to purchase", {
        action: { label: "Sign In", onClick: () => navigate("/login") }
      });
      return;
    }

    const buyNowPrice = auction.buy_it_now_price;
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auctions/listing/${listing.listing_id}/bid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api.getToken()}`
        },
        body: JSON.stringify({ amount: buyNowPrice })
      });

      const data = await response.json();

      if (response.ok && data.type === "buy_it_now") {
        toast.success("Congratulations! You won with Buy It Now!");
        navigate(`/checkout?listing=${listing.listing_id}&type=auction`);
      } else if (!response.ok) {
        toast.error(data.detail || "Failed to purchase");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const getMinBid = () => {
    const currentBid = auctionStatus?.current_bid || auction?.starting_bid || 0;
    const bidCount = auctionStatus?.bid_count || 0;
    
    if (bidCount === 0) {
      return auction?.starting_bid || 1;
    }
    
    // 5% or $1 minimum increment
    const increment = Math.max(1, currentBid * 0.05);
    return currentBid + increment;
  };

  const reserveMet = auctionStatus?.reserve_met || (
    (auctionStatus?.current_bid || 0) >= (auction?.reserve_price || 0)
  );

  const isEnded = timeRemaining?.ended || auctionStatus?.status !== "active";
  const isWinning = user && auctionStatus?.current_bidder_id === user.user_id;

  if (!auction || !auction.is_auction) return null;

  return (
    <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gavel className="w-5 h-5 text-amber-600" />
          <span className="font-bold text-amber-700 dark:text-amber-400">Live Auction</span>
        </div>
        {!isEnded && (
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
            timeRemaining?.seconds < 300 ? 'bg-red-500/20 text-red-600 animate-pulse' :
            timeRemaining?.seconds < 3600 ? 'bg-amber-500/20 text-amber-600' :
            'bg-green-500/20 text-green-600'
          }`}>
            <Clock className="w-4 h-4" />
            {formatTimeRemaining(timeRemaining)}
          </div>
        )}
        {isEnded && (
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-500/20 text-gray-600">
            Ended
          </span>
        )}
      </div>

      {/* Current Bid Display */}
      <div className="text-center py-4 bg-background/50 rounded-xl">
        <p className="text-sm text-muted-foreground mb-1">
          {(auctionStatus?.bid_count || 0) > 0 ? "Current Bid" : "Starting Bid"}
        </p>
        <p className="text-4xl font-bold text-primary">
          ${(auctionStatus?.current_bid || auction.starting_bid || 0).toLocaleString()}
        </p>
        <div className="flex items-center justify-center gap-4 mt-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {auctionStatus?.bid_count || 0} bid{(auctionStatus?.bid_count || 0) !== 1 ? 's' : ''}
          </span>
          {auction.reserve_price && (
            <span className={`flex items-center gap-1 ${reserveMet ? 'text-green-600' : 'text-amber-600'}`}>
              <Shield className="w-4 h-4" />
              Reserve {reserveMet ? 'met' : 'not met'}
            </span>
          )}
        </div>
        {isWinning && !isEnded && (
          <div className="mt-2 px-3 py-1 bg-green-500/20 text-green-600 rounded-full inline-flex items-center gap-1 text-sm font-medium">
            <Trophy className="w-4 h-4" />
            You&apos;re winning!
          </div>
        )}
      </div>

      {/* Bidding Section */}
      {!isEnded && !isOwner && (
        <div className="space-y-3">
          {/* Bid Input */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">
              Your Bid (min ${getMinBid().toFixed(2)})
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  min={getMinBid()}
                  placeholder={getMinBid().toFixed(2)}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="pl-9"
                  data-testid="bid-amount-input"
                />
              </div>
              <Button 
                onClick={handlePlaceBid}
                disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 text-white"
                data-testid="place-bid-btn"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Gavel className="w-4 h-4 mr-2" />
                    Bid
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quick Bid Buttons */}
          <div className="flex gap-2">
            {[1, 5, 10].map(increment => (
              <Button
                key={increment}
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setBidAmount((getMinBid() + increment).toFixed(2))}
              >
                +${increment}
              </Button>
            ))}
          </div>

          {/* Buy It Now */}
          {auction.buy_it_now_price && (
            <Button
              variant="outline"
              className="w-full h-12 border-primary text-primary hover:bg-primary/10"
              onClick={handleBuyItNow}
              disabled={loading}
              data-testid="buy-it-now-btn"
            >
              <Zap className="w-5 h-5 mr-2" />
              Buy It Now - ${auction.buy_it_now_price.toLocaleString()}
            </Button>
          )}
        </div>
      )}

      {/* Owner View */}
      {isOwner && !isEnded && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            This is your auction. You cannot bid on your own listing.
          </p>
        </div>
      )}

      {/* Ended Message */}
      {isEnded && (
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          {auctionStatus?.status === "sold" ? (
            <div>
              <Trophy className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="font-medium">Auction Ended - Item Sold!</p>
              <p className="text-sm text-muted-foreground">
                Final price: ${auctionStatus?.current_bid?.toLocaleString()}
              </p>
            </div>
          ) : auctionStatus?.status === "reserve_not_met" ? (
            <div>
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <p className="font-medium">Reserve Price Not Met</p>
              <p className="text-sm text-muted-foreground">
                The seller may contact top bidders with a special offer.
              </p>
            </div>
          ) : (
            <div>
              <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="font-medium">Auction Ended</p>
              <p className="text-sm text-muted-foreground">
                This auction has concluded.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Bid History */}
      <div>
        <button
          onClick={() => setShowBidHistory(!showBidHistory)}
          className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors"
        >
          <span className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Bid History ({bids.length})
          </span>
          {showBidHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {showBidHistory && (
          <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
            {bids.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No bids yet. Be the first!
              </p>
            ) : (
              bids.map((bid, idx) => (
                <div 
                  key={bid.bid_id} 
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    idx === 0 ? 'bg-amber-500/10' : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {idx === 0 && <Trophy className="w-4 h-4 text-amber-500" />}
                    <span className="text-sm font-medium">
                      @{bid.bidder_username || bid.bidder_name?.split(' ')[0] || 'Anonymous'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold">${bid.amount.toLocaleString()}</span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(bid.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
