import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  X, DollarSign, MessageSquare, Loader2, Check, AlertCircle,
  ArrowRight, ArrowLeft, Shield, Clock, Gavel, Send
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Load Stripe
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51SkM67RyuUJLCAOO8G4RFhwbRR1w5cpt8NWlyV6jc5cvxOEkujPX57f6jSV2dsLwwiFYAvGqG6PhRQsHT1KDlwCq00FBFT1zsX');

// Deposit Payment Form Component
const DepositPaymentForm = ({ clientSecret, onSuccess, onCancel }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) return;
    
    setProcessing(true);
    setError(null);

    const { error: paymentError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements.getElement(CardElement)
      }
    });

    if (paymentError) {
      setError(paymentError.message);
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === "requires_capture") {
      // Payment authorized but not captured (as intended for deposits)
      onSuccess();
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      onSuccess();
    } else {
      setError("Unexpected payment status. Please try again.");
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Refundable Deposit</span>
        </div>
        <p className="text-xs text-muted-foreground">
          This $1.00 deposit will be held until the offer is resolved. If your offer is rejected or expires, 
          you&apos;ll receive a full refund. If accepted, this amount is applied to your purchase.
        </p>
      </div>

      <div className="p-4 border rounded-lg">
        <label className="text-sm text-muted-foreground mb-2 block">Card Details</label>
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': { color: '#aab7c4' }
              },
              invalid: { color: '#9e2146' }
            }
          }}
        />
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={!stripe || processing}>
          {processing ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
          ) : (
            <>Pay $1.00 Deposit</>
          )}
        </Button>
      </div>
    </form>
  );
};

// Main Make Offer Modal Component
export default function MakeOfferModal({ isOpen, onClose, listing, user, token }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Enter offer, 2: Pay deposit, 3: Success
  const [offerAmount, setOfferAmount] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [offerId, setOfferId] = useState(null);
  const [depositClientSecret, setDepositClientSecret] = useState(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setOfferAmount("");
      setMessage("");
      setOfferId(null);
      setDepositClientSecret(null);
    }
  }, [isOpen]);

  const handleSubmitOffer = async () => {
    if (!offerAmount || parseFloat(offerAmount) <= 0) {
      toast.error("Please enter a valid offer amount");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          listing_id: listing.listing_id,
          offer_amount: parseFloat(offerAmount),
          message: message || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        setOfferId(data.offer_id);
        setDepositClientSecret(data.deposit_client_secret);
        setStep(2);
      } else {
        toast.error(data.detail || "Failed to create offer");
      }
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDepositSuccess = async () => {
    // Confirm deposit with backend
    try {
      const response = await fetch(`${API_BASE_URL}/api/offers/${offerId}/confirm-deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setStep(3);
        toast.success("Offer submitted successfully!");
      } else {
        const data = await response.json();
        toast.error(data.detail || "Failed to confirm deposit");
      }
    } catch (err) {
      toast.error("Failed to confirm deposit");
    }
  };

  const listingPrice = listing?.price || 0;
  const suggestedOffer = Math.round(listingPrice * 0.85); // 15% off suggested

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-background rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">Make an Offer</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Listing Preview */}
          <div className="flex gap-3 p-3 bg-muted/50 rounded-lg mb-6">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {listing.images?.[0] ? (
                <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{listing.title}</h3>
              <p className="text-lg font-bold text-primary">${listingPrice.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Listed by @{listing.seller?.username}</p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-primary' : 'bg-muted'}`} />}
              </React.Fragment>
            ))}
          </div>

          {/* Step 1: Enter Offer */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Your Offer Amount</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    className="pl-10 text-lg h-12"
                    min="1"
                    step="0.01"
                    data-testid="offer-amount-input"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setOfferAmount(suggestedOffer.toString())}
                  >
                    ${suggestedOffer} (15% off)
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setOfferAmount(Math.round(listingPrice * 0.9).toString())}
                  >
                    ${Math.round(listingPrice * 0.9)} (10% off)
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Message (Optional)</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <textarea
                    placeholder="Add a message to the seller..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg resize-none h-24 bg-background"
                    data-testid="offer-message-input"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>Refundable $1 deposit required.</strong> This is held to ensure serious offers. 
                    If rejected or expired, you&apos;ll be fully refunded. If accepted, it&apos;s applied to your purchase.
                  </div>
                </div>
              </div>

              <Button 
                className="w-full h-12" 
                onClick={handleSubmitOffer}
                disabled={loading || !offerAmount}
                data-testid="submit-offer-btn"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating Offer...</>
                ) : (
                  <>Continue to Deposit <ArrowRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: Pay Deposit */}
          {step === 2 && depositClientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret: depositClientSecret }}>
              <DepositPaymentForm
                clientSecret={depositClientSecret}
                onSuccess={handleDepositSuccess}
                onCancel={() => {
                  setStep(1);
                  setDepositClientSecret(null);
                }}
              />
            </Elements>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">Offer Submitted!</h3>
              <p className="text-muted-foreground mb-6">
                Your offer of <span className="font-bold text-primary">${parseFloat(offerAmount).toLocaleString()}</span> has been sent to the seller.
                You&apos;ll be notified when they respond.
              </p>
              
              <div className="p-4 bg-muted/50 rounded-lg mb-6 text-left">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> What happens next?
                </h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    The seller will review your offer
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    They can accept, reject, or counter-offer
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">•</span>
                    You&apos;ll get a notification with their response
                  </li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={onClose}>
                  Continue Browsing
                </Button>
                <Button className="flex-1" onClick={() => navigate('/marketplace-offers')}>
                  View My Offers
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Offer Negotiation Modal - for viewing and responding to offers
export function OfferNegotiationModal({ isOpen, onClose, offer, user, token, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [counterAmount, setCounterAmount] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [showCounterForm, setShowCounterForm] = useState(false);

  const isBuyer = offer?.buyer_id === user?.user_id;
  const isSeller = offer?.seller_id === user?.user_id;
  const remainingTurns = offer?.remaining_turns || { buyer_remaining: 2, seller_remaining: 2 };
  const myRemainingTurns = isBuyer ? remainingTurns.buyer_remaining : remainingTurns.seller_remaining;

  const handleRespond = async (action, amount = null) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/offers/${offer.offer_id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          counter_amount: amount ? parseFloat(amount) : null,
          message: responseMessage || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(
          action === 'accept' ? 'Offer accepted!' :
          action === 'reject' ? 'Offer rejected' :
          'Counter-offer sent!'
        );
        if (onUpdate) onUpdate();
        if (action !== 'counter') onClose();
      } else {
        toast.error(data.detail || "Failed to respond");
      }
    } catch (err) {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
      setShowCounterForm(false);
    }
  };

  if (!isOpen || !offer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-background rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between z-10">
          <h2 className="font-bold text-lg">Offer Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Listing Info */}
          <div className="flex gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              {offer.listing_image && (
                <img src={offer.listing_image} alt={offer.listing_title} className="w-full h-full object-cover" />
              )}
            </div>
            <div>
              <h3 className="font-medium">{offer.listing_title}</h3>
              <p className="text-sm text-muted-foreground">Listed at ${offer.listing_price?.toLocaleString()}</p>
            </div>
          </div>

          {/* Current Offer Amount */}
          <div className="text-center py-4 bg-primary/5 rounded-xl">
            <p className="text-sm text-muted-foreground mb-1">Current Offer</p>
            <p className="text-3xl font-bold text-primary">${offer.current_amount?.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {offer.status === 'counter_pending' ? 'Counter-offer' : 'Initial offer'}
            </p>
          </div>

          {/* Negotiation History */}
          <div>
            <h4 className="font-medium mb-3">Negotiation History</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {offer.negotiation_history?.map((event, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-lg text-sm ${
                    event.by === 'buyer' ? 'bg-blue-500/10 ml-4' : 'bg-green-500/10 mr-4'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium capitalize">
                      {event.by === 'buyer' ? 'Buyer' : 'Seller'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="capitalize">{event.action.replace('_', ' ')}</p>
                  {event.amount && <p className="font-bold">${event.amount.toLocaleString()}</p>}
                  {event.message && <p className="text-muted-foreground mt-1 italic">"{event.message}"</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Remaining Turns Indicator */}
          <div className="flex justify-between text-sm p-3 bg-muted/50 rounded-lg">
            <span>Your counter-offers remaining:</span>
            <span className="font-bold">{myRemainingTurns} / 2</span>
          </div>

          {/* Actions */}
          {offer.status === 'pending' || offer.status === 'counter_pending' ? (
            <div className="space-y-3">
              {showCounterForm ? (
                <div className="space-y-3 p-4 border rounded-lg">
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Counter amount"
                      value={counterAmount}
                      onChange={(e) => setCounterAmount(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <textarea
                    placeholder="Optional message..."
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    className="w-full p-2 border rounded-lg resize-none h-20 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowCounterForm(false)}>
                      Cancel
                    </Button>
                    <Button 
                      className="flex-1" 
                      onClick={() => handleRespond('counter', counterAmount)}
                      disabled={loading || !counterAmount}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Counter'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                    onClick={() => handleRespond('reject')}
                    disabled={loading}
                  >
                    Reject
                  </Button>
                  {myRemainingTurns > 0 && (
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowCounterForm(true)}
                      disabled={loading}
                    >
                      Counter
                    </Button>
                  )}
                  <Button 
                    className="flex-1"
                    onClick={() => handleRespond('accept')}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Accept'}
                  </Button>
                </div>
              )}
            </div>
          ) : offer.status === 'accepted' && isBuyer ? (
            <Button 
              className="w-full" 
              onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE_URL}/api/offers/${offer.offer_id}/complete-purchase`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  const data = await res.json();
                  if (data.payment_url) {
                    window.location.href = data.payment_url;
                  }
                } catch (err) {
                  toast.error("Failed to proceed to payment");
                }
              }}
            >
              Complete Purchase
            </Button>
          ) : (
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="font-medium capitalize">{offer.status.replace('_', ' ')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
