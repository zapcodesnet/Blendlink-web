import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { OfferNegotiationModal } from "../components/MakeOfferModal";
import {
  ArrowLeft, Gavel, Package, Clock, Check, X, AlertCircle,
  Loader2, DollarSign, MessageSquare, Filter, ChevronRight
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

const OfferStatusBadge = ({ status }) => {
  const statusConfig = {
    pending: { color: "bg-blue-500/10 text-blue-600", label: "Pending" },
    pending_deposit: { color: "bg-amber-500/10 text-amber-600", label: "Awaiting Deposit" },
    counter_pending: { color: "bg-purple-500/10 text-purple-600", label: "Counter-Offer" },
    accepted: { color: "bg-green-500/10 text-green-600", label: "Accepted" },
    rejected: { color: "bg-red-500/10 text-red-600", label: "Rejected" },
    expired: { color: "bg-gray-500/10 text-gray-600", label: "Expired" },
    completed: { color: "bg-emerald-500/10 text-emerald-600", label: "Completed" }
  };

  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
};

const OfferCard = ({ offer, onClick }) => {
  const isBuyer = offer.is_buyer;
  const lastAction = offer.negotiation_history?.[offer.negotiation_history.length - 1];
  const waitingOn = lastAction?.by === 'buyer' ? 'seller' : 'buyer';
  const isYourTurn = (isBuyer && waitingOn === 'buyer') || (!isBuyer && waitingOn === 'seller');

  return (
    <div 
      className="bg-card rounded-xl border p-4 cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onClick}
      data-testid={`offer-card-${offer.offer_id}`}
    >
      <div className="flex gap-4">
        {/* Listing Image */}
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          {offer.listing_image ? (
            <img src={offer.listing_image} alt={offer.listing_title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium truncate">{offer.listing_title}</h3>
            <OfferStatusBadge status={offer.status} />
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-muted-foreground">
              {isBuyer ? "You offered" : "Buyer offered"}
            </span>
            <span className="font-bold text-primary">${offer.current_amount?.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>
              {new Date(offer.updated_at).toLocaleDateString()}
            </span>
            {(offer.status === 'pending' || offer.status === 'counter_pending') && (
              <>
                <span>•</span>
                <span className={isYourTurn ? 'text-amber-500 font-medium' : ''}>
                  {isYourTurn ? "Your turn to respond" : `Waiting on ${waitingOn}`}
                </span>
              </>
            )}
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 self-center" />
      </div>

      {/* Quick Info */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs">
        <span className="text-muted-foreground">
          Listed at ${offer.listing_price?.toLocaleString()}
        </span>
        <span className={offer.current_amount < offer.listing_price ? 'text-green-600' : 'text-muted-foreground'}>
          {offer.current_amount < offer.listing_price 
            ? `${Math.round((1 - offer.current_amount / offer.listing_price) * 100)}% off`
            : 'At list price'
          }
        </span>
      </div>
    </div>
  );
};

export default function MarketplaceOffers() {
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const navigate = useNavigate();
  
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, buyer, seller
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [showOfferModal, setShowOfferModal] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchOffers();
  }, [user, filter, statusFilter]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.append("role", filter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`${API_BASE_URL}/api/offers/my-offers?${params}`, {
        headers: { 'Authorization': `Bearer ${api.getToken()}` }
      });

      if (response.ok) {
        const data = await response.json();
        setOffers(data.offers || []);
      } else {
        toast.error("Failed to load offers");
      }
    } catch (err) {
      console.error("Error fetching offers:", err);
      toast.error("Failed to load offers");
    } finally {
      setLoading(false);
    }
  };

  const handleOfferClick = async (offer) => {
    // Fetch full offer details
    try {
      const response = await fetch(`${API_BASE_URL}/api/offers/${offer.offer_id}`, {
        headers: { 'Authorization': `Bearer ${api.getToken()}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedOffer(data);
        setShowOfferModal(true);
      }
    } catch (err) {
      toast.error("Failed to load offer details");
    }
  };

  const pendingOffers = offers.filter(o => ['pending', 'counter_pending'].includes(o.status));
  const completedOffers = offers.filter(o => !['pending', 'counter_pending'].includes(o.status));

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold flex items-center gap-2">
            <Gavel className="w-5 h-5 text-primary" />
            My Offers
          </h1>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "buyer" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("buyer")}
          >
            Offers I Made
          </Button>
          <Button
            variant={filter === "seller" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("seller")}
          >
            Offers Received
          </Button>
        </div>

        <div className="flex gap-2 mt-2 overflow-x-auto hide-scrollbar">
          {["all", "pending", "accepted", "rejected", "expired"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "secondary" : "ghost"}
              size="sm"
              className="capitalize"
              onClick={() => setStatusFilter(status)}
            >
              {status === "all" ? "All Status" : status}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-12">
            <Gavel className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Offers Yet</h2>
            <p className="text-muted-foreground mb-6">
              {filter === "buyer" 
                ? "You haven't made any offers yet. Browse the marketplace to find items!"
                : filter === "seller"
                ? "You haven't received any offers yet."
                : "No offers found."
              }
            </p>
            <Button onClick={() => navigate("/marketplace")}>
              Browse Marketplace
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Offers Section */}
            {pendingOffers.length > 0 && (
              <div>
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Active Negotiations ({pendingOffers.length})
                </h2>
                <div className="space-y-3">
                  {pendingOffers.map((offer) => (
                    <OfferCard 
                      key={offer.offer_id} 
                      offer={offer} 
                      onClick={() => handleOfferClick(offer)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Past Offers Section */}
            {completedOffers.length > 0 && (
              <div>
                <h2 className="font-semibold mb-3 text-muted-foreground">
                  Past Offers ({completedOffers.length})
                </h2>
                <div className="space-y-3">
                  {completedOffers.map((offer) => (
                    <OfferCard 
                      key={offer.offer_id} 
                      offer={offer} 
                      onClick={() => handleOfferClick(offer)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Offer Negotiation Modal */}
      <OfferNegotiationModal
        isOpen={showOfferModal}
        onClose={() => {
          setShowOfferModal(false);
          setSelectedOffer(null);
        }}
        offer={selectedOffer}
        user={user}
        token={api.getToken()}
        onUpdate={() => {
          fetchOffers();
          setShowOfferModal(false);
          setSelectedOffer(null);
        }}
      />
    </div>
  );
}
