/**
 * Top Up BL Coins Modal
 * Displays when user has insufficient balance for listing creation
 * Integrates with Stripe checkout for coin purchases
 */

import React, { useState } from "react";
import { Button } from "./ui/button";
import { 
  Coins, Sparkles, Check, Loader2, X, Zap, Crown, Star, Rocket
} from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "../utils/runtimeConfig";

const API_URL = getApiUrl();

// Pricing tiers for BL coin purchases
const PRICING_TIERS = [
  { 
    id: "starter",
    price: 4.99, 
    coins: 30000, 
    icon: Coins,
    label: "Starter Pack",
    highlight: false,
    description: "150 listings"
  },
  { 
    id: "popular",
    price: 9.99, 
    coins: 80000, 
    icon: Zap,
    label: "Popular",
    highlight: true,
    description: "400 listings",
    badge: "Best Value"
  },
  { 
    id: "premium",
    price: 14.99, 
    coins: 400000, 
    icon: Crown,
    label: "Premium",
    highlight: false,
    description: "2,000 listings"
  },
  { 
    id: "ultimate",
    price: 29.99, 
    coins: 1000000, 
    icon: Rocket,
    label: "Ultimate",
    highlight: false,
    description: "5,000 listings"
  }
];

export default function TopUpCoinsModal({ 
  isOpen, 
  onClose, 
  currentBalance = 0,
  requiredAmount = 200,
  returnUrl = null,  // URL to return to after successful purchase
  returnState = null // State to pass back (e.g., form data)
}) {
  const [selectedTier, setSelectedTier] = useState("popular");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const deficit = Math.max(0, requiredAmount - currentBalance);

  const handlePurchase = async () => {
    const tier = PRICING_TIERS.find(t => t.id === selectedTier);
    if (!tier) {
      toast.error("Please select a package");
      return;
    }

    setLoading(true);
    const token = localStorage.getItem("blendlink_token");

    try {
      // Store return info in session storage for after checkout
      if (returnUrl || returnState) {
        sessionStorage.setItem("bl_coins_return_url", returnUrl || window.location.pathname);
        if (returnState) {
          sessionStorage.setItem("bl_coins_return_state", JSON.stringify(returnState));
        }
      }

      const response = await fetch(`${API_URL}/api/payments/stripe/bl-coins/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          tier_id: tier.id,
          amount_usd: tier.price,
          coins_amount: tier.coins,
          origin_url: window.location.origin
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create checkout session");
      }

      const data = await response.json();
      
      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error(err.message || "Failed to start checkout. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4" data-testid="topup-coins-modal">
      <div className="bg-card rounded-2xl w-full max-w-lg border border-border shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-amber-500 to-orange-500 p-6 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            disabled={loading}
          >
            <X className="w-4 h-4 text-white" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <Coins className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Top Up BL Coins</h2>
              <p className="text-white/80 text-sm">Get more coins to create listings</p>
            </div>
          </div>
        </div>

        {/* Balance Info */}
        <div className="px-6 py-4 bg-red-50 border-b border-red-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Insufficient Balance</p>
              <p className="text-xs text-red-500">
                You need <strong>{requiredAmount.toLocaleString()}</strong> BL coins, but only have <strong>{currentBalance.toLocaleString()}</strong>
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-red-600">-{deficit.toLocaleString()}</p>
              <p className="text-xs text-red-500">coins needed</p>
            </div>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="p-6">
          <p className="text-sm font-medium text-muted-foreground mb-4">Select a package:</p>
          
          <div className="space-y-3">
            {PRICING_TIERS.map((tier) => {
              const TierIcon = tier.icon;
              const isSelected = selectedTier === tier.id;
              const coinsPerDollar = Math.round(tier.coins / tier.price);
              
              return (
                <button
                  key={tier.id}
                  onClick={() => setSelectedTier(tier.id)}
                  disabled={loading}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left relative ${
                    isSelected 
                      ? "border-amber-500 bg-amber-50 shadow-lg scale-[1.02]" 
                      : "border-border hover:border-amber-300 hover:bg-amber-50/50"
                  } ${tier.highlight ? "ring-2 ring-amber-200" : ""}`}
                  data-testid={`tier-${tier.id}`}
                >
                  {/* Badge */}
                  {tier.badge && (
                    <span className="absolute -top-2 right-4 px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                      {tier.badge}
                    </span>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isSelected ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        <TierIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{tier.label}</p>
                          {isSelected && <Check className="w-4 h-4 text-amber-500" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {tier.coins.toLocaleString()} BL coins • ~{tier.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">${tier.price.toFixed(2)}</p>
                      <p className="text-xs text-green-600">{coinsPerDollar.toLocaleString()} BL/$</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Benefits */}
          <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800">What you get:</p>
                <ul className="mt-1 space-y-1 text-amber-700">
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3" /> Instant delivery to your wallet
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3" /> Receipt sent to your email
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3 h-3" /> Continue your listing after purchase
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 p-6 border-t bg-card rounded-b-2xl">
          <Button
            onClick={handlePurchase}
            disabled={loading || !selectedTier}
            className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl"
            data-testid="purchase-coins-btn"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Coins className="w-5 h-5 mr-2" />
                Purchase {PRICING_TIERS.find(t => t.id === selectedTier)?.coins.toLocaleString()} BL Coins
              </>
            )}
          </Button>
          
          <p className="text-xs text-center text-muted-foreground mt-3">
            Secure payment powered by Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

// Export pricing tiers for use in other components
export { PRICING_TIERS };
