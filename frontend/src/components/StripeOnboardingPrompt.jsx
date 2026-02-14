import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import api from "../services/api";
import { getApiUrl } from "../utils/runtimeConfig";
import {
  CreditCard, ExternalLink, CheckCircle, AlertCircle,
  X, ArrowRight, Shield, DollarSign, Loader2
} from "lucide-react";

const API_BASE = getApiUrl();

/**
 * Stripe Onboarding Prompt Component
 * 
 * Shows a prompt when users create their first listing to connect their Stripe account.
 * Required for receiving payouts from sales.
 */
export default function StripeOnboardingPrompt({ 
  isOpen, 
  onClose, 
  onComplete, 
  isFirstListing = false 
}) {
  const [loading, setLoading] = useState(false);
  const [stripeStatus, setStripeStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    if (isOpen) {
      checkStripeStatus();
    }
  }, [isOpen]);

  const checkStripeStatus = async () => {
    setCheckingStatus(true);
    try {
      const response = await api.get("/payments/stripe/connect/status");
      setStripeStatus(response.data);
    } catch (error) {
      setStripeStatus({ connected: false });
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnectStripe = async () => {
    setLoading(true);
    try {
      const response = await api.post("/stripe/create-connect-account");
      
      if (response.data?.url) {
        // Redirect to Stripe onboarding
        window.location.href = response.data.url;
      } else if (response.data?.already_connected) {
        toast.success("Your Stripe account is already connected!");
        onComplete?.();
        onClose();
      }
    } catch (error) {
      const msg = error.response?.data?.detail || "Failed to start Stripe connection";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (isFirstListing) {
      toast.info("You can connect Stripe later from your Wallet page");
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Connect Stripe</h2>
                <p className="text-sm opacity-90">Enable payouts for your sales</p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {checkingStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
          ) : stripeStatus?.connected ? (
            /* Already Connected */
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Stripe Connected!</h3>
              <p className="text-muted-foreground text-sm">
                Your Stripe account is connected and ready to receive payouts.
              </p>
              <Button
                onClick={() => {
                  onComplete?.();
                  onClose();
                }}
                className="mt-4 w-full"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : (
            /* Not Connected */
            <>
              {isFirstListing && (
                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                        First Listing Detected
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300/80 mt-1">
                        Connect your Stripe account now to receive payments when your items sell.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <Shield className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Secure Payments</p>
                    <p className="text-xs text-muted-foreground">
                      Stripe handles all payment processing securely
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <DollarSign className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Direct Payouts</p>
                    <p className="text-xs text-muted-foreground">
                      Receive earnings directly to your bank account
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                  <CreditCard className="w-5 h-5 text-purple-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Easy Setup</p>
                    <p className="text-xs text-muted-foreground">
                      Connect in minutes - we'll guide you through the process
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  onClick={handleConnectStripe}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Connect Stripe Account
                </Button>

                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="w-full"
                >
                  {isFirstListing ? "Skip for Now" : "Cancel"}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                By connecting, you agree to Stripe's{" "}
                <a
                  href="https://stripe.com/legal"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline"
                >
                  Terms of Service
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage Stripe onboarding prompt
 */
export function useStripeOnboarding() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isFirstListing, setIsFirstListing] = useState(false);

  const checkAndPrompt = async (forceFirstListing = false) => {
    try {
      // Check if user has Stripe connected
      const response = await api.get("/payments/stripe/connect/status");
      
      if (!response.data?.connected) {
        // Check if this is user's first listing
        const listingsResponse = await api.get("/marketplace/my-listings?limit=1");
        const hasListings = listingsResponse.data?.listings?.length > 0;
        
        setIsFirstListing(!hasListings || forceFirstListing);
        setShowPrompt(true);
        return false; // Stripe not connected
      }
      return true; // Stripe connected
    } catch (error) {
      console.error("Error checking Stripe status:", error);
      return true; // Allow proceeding on error
    }
  };

  const closePrompt = () => {
    setShowPrompt(false);
  };

  return {
    showPrompt,
    isFirstListing,
    checkAndPrompt,
    closePrompt,
    setShowPrompt
  };
}

/**
 * Wrapper component to check Stripe status before withdrawal
 */
export function WithdrawalStripeCheck({ children, onStripeRequired }) {
  const checkStripeBeforeWithdraw = async () => {
    try {
      const response = await api.get("/payments/stripe/connect/status");
      
      if (!response.data?.connected) {
        onStripeRequired?.();
        return false;
      }
      return true;
    } catch (error) {
      toast.error("Unable to verify Stripe status. Please try again.");
      return false;
    }
  };

  return typeof children === "function"
    ? children({ checkStripeBeforeWithdraw })
    : children;
}
