import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { 
  ArrowLeft, DollarSign, Check, X, Clock, 
  CreditCard, FileText, Image, Video, User,
  ChevronRight
} from "lucide-react";
import { offersAPI, paymentsAPI } from "../services/mediaSalesApi";

export default function OffersPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [tab, setTab] = useState("received"); // received, sent
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOffers();
  }, [tab]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const data = tab === "received" 
        ? await offersAPI.getReceived() 
        : await offersAPI.getSent();
      setOffers(data);
    } catch (error) {
      console.error("Failed to load offers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (offerId) => {
    try {
      await offersAPI.accept(offerId);
      toast.success("Offer accepted! Buyer can now proceed with payment.");
      fetchOffers();
    } catch (error) {
      toast.error(error.message || "Failed to accept offer");
    }
  };

  const handleReject = async (offerId) => {
    if (!confirm("Are you sure you want to reject this offer?")) return;
    
    try {
      await offersAPI.reject(offerId);
      toast.success("Offer rejected");
      fetchOffers();
    } catch (error) {
      toast.error(error.message || "Failed to reject offer");
    }
  };

  const handlePay = async (offerId) => {
    try {
      const { checkout_url } = await paymentsAPI.createCheckout(offerId);
      window.location.href = checkout_url;
    } catch (error) {
      toast.error(error.message || "Failed to initiate payment");
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: "bg-yellow-500/10 text-yellow-600", icon: Clock, label: "Pending" },
      accepted: { color: "bg-blue-500/10 text-blue-600", icon: Check, label: "Accepted" },
      rejected: { color: "bg-red-500/10 text-red-600", icon: X, label: "Rejected" },
      paid: { color: "bg-green-500/10 text-green-600", icon: CreditCard, label: "Paid" },
      completed: { color: "bg-purple-500/10 text-purple-600", icon: FileText, label: "Completed" },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4 mb-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Offers</h1>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2">
            <Button
              variant={tab === "received" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("received")}
            >
              Received
            </Button>
            <Button
              variant={tab === "sent" ? "default" : "outline"}
              size="sm"
              onClick={() => setTab("sent")}
            >
              Sent
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-4 border border-border">
                <div className="flex gap-4">
                  <div className="w-20 h-20 skeleton rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-1/2 skeleton rounded" />
                    <div className="h-4 w-1/4 skeleton rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No offers yet</h3>
            <p className="text-muted-foreground">
              {tab === "received" 
                ? "Offers on your media will appear here"
                : "Offers you've made will appear here"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => (
              <div
                key={offer.offer_id}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex gap-4">
                    {/* Media thumbnail */}
                    {offer.media && (
                      <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        <img
                          src={offer.media.watermarked_url || offer.media.thumbnail_url}
                          alt={offer.media.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold truncate">
                            {offer.media?.title || "Media"}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {offer.media?.media_type === "photo" ? (
                              <Image className="w-3 h-3 text-muted-foreground" />
                            ) : (
                              <Video className="w-3 h-3 text-muted-foreground" />
                            )}
                            <span className="text-xs text-muted-foreground capitalize">
                              {offer.media?.media_type}
                            </span>
                          </div>
                        </div>
                        {getStatusBadge(offer.status)}
                      </div>

                      {/* Offer details */}
                      <div className="mt-3 flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span className="font-bold text-lg text-green-600">
                            ${offer.amount.toFixed(2)}
                          </span>
                        </div>
                        
                        {tab === "received" ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="w-4 h-4" />
                            {offer.buyer_name} ({offer.buyer_email})
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {new Date(offer.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {offer.message && (
                        <p className="mt-2 text-sm text-muted-foreground bg-muted rounded p-2">
                          "{offer.message}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 py-3 bg-muted/50 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {new Date(offer.created_at).toLocaleDateString()}
                  </span>
                  
                  <div className="flex gap-2">
                    {/* Received offers - Accept/Reject */}
                    {tab === "received" && offer.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(offer.offer_id)}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleAccept(offer.offer_id)}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Accept
                        </Button>
                      </>
                    )}

                    {/* Sent offers - Pay if accepted */}
                    {tab === "sent" && offer.status === "accepted" && (
                      <Button
                        size="sm"
                        onClick={() => handlePay(offer.offer_id)}
                      >
                        <CreditCard className="w-4 h-4 mr-1" />
                        Pay Now
                      </Button>
                    )}

                    {/* View contract if paid or completed */}
                    {(offer.status === "paid" || offer.status === "completed") && offer.contract_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/contract/${offer.contract_id}`)}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View Contract
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
