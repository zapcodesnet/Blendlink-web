/**
 * BL Coins Purchase Success Page
 * Shows after successful Stripe checkout for BL coins
 * Credits coins and redirects user back to their previous action
 */

import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { 
  Coins, Check, Loader2, ArrowRight, Sparkles, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "../utils/runtimeConfig";

const API_URL = getApiUrl();

export default function CoinsPurchaseSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authContext = useContext(AuthContext);
  const user = authContext?.user;
  const setUser = authContext?.setUser;
  
  const [status, setStatus] = useState("loading"); // loading, success, error
  const [purchaseData, setPurchaseData] = useState(null);
  const [returnUrl, setReturnUrl] = useState(null);
  const [returnState, setReturnState] = useState(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    // Get return info from session storage
    const storedReturnUrl = sessionStorage.getItem("bl_coins_return_url");
    const storedReturnState = sessionStorage.getItem("bl_coins_return_state");
    
    if (storedReturnUrl) {
      setReturnUrl(storedReturnUrl);
      sessionStorage.removeItem("bl_coins_return_url");
    }
    if (storedReturnState) {
      try {
        setReturnState(JSON.parse(storedReturnState));
        sessionStorage.removeItem("bl_coins_return_state");
      } catch (e) {
        console.error("Failed to parse return state:", e);
      }
    }

    // Verify the purchase
    if (sessionId) {
      verifyPurchase();
    } else {
      setStatus("error");
    }
  }, [sessionId]);

  const verifyPurchase = async () => {
    const token = localStorage.getItem("blendlink_token");
    
    try {
      const response = await fetch(`${API_URL}/api/payments/stripe/bl-coins/status/${sessionId}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to verify purchase");
      }

      const data = await response.json();
      
      if (data.status === "completed") {
        setPurchaseData(data);
        setStatus("success");
        
        // Update user context with new balance
        if (data.new_balance && setUser) {
          setUser(prev => ({ ...prev, bl_coins: data.new_balance }));
        }
        
        toast.success(`${data.coins_credited?.toLocaleString()} BL coins added to your wallet!`);
      } else if (data.status === "paid") {
        // Payment received but coins not yet credited - retry
        setTimeout(verifyPurchase, 2000);
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setStatus("error");
    }
  };

  const handleContinue = () => {
    if (returnUrl) {
      // Navigate back with state if available
      navigate(returnUrl, { state: returnState || { coinsAdded: true } });
    } else {
      navigate("/wallet");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {status === "loading" && (
          <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-xl">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Processing Your Purchase</h1>
            <p className="text-muted-foreground">
              Please wait while we verify your payment and credit your coins...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden" data-testid="purchase-success">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">Purchase Complete!</h1>
              <p className="text-white/80">Your coins have been added to your wallet</p>
            </div>

            {/* Purchase Details */}
            <div className="p-6">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-6 mb-6 border border-amber-200">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Coins className="w-8 h-8 text-amber-500" />
                  <span className="text-3xl font-bold text-amber-600">
                    +{purchaseData?.coins_credited?.toLocaleString() || "0"}
                  </span>
                  <span className="text-xl text-amber-500">BL</span>
                </div>
                
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">New Balance</p>
                  <p className="text-2xl font-bold text-foreground">
                    {purchaseData?.new_balance?.toLocaleString() || user?.bl_coins?.toLocaleString() || "0"} BL
                  </p>
                </div>
              </div>

              {/* Benefits Reminder */}
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl mb-6">
                <Sparkles className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-green-800">Ready to use!</p>
                  <p className="text-green-600">
                    {returnUrl 
                      ? "Click continue to go back and complete your listing."
                      : "Your coins are ready. Visit the marketplace to create listings!"}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <Button
                  onClick={handleContinue}
                  className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  data-testid="continue-btn"
                >
                  {returnUrl ? (
                    <>
                      Continue Creating Listing
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  ) : (
                    <>
                      Go to Wallet
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
                
                {returnUrl && (
                  <Button
                    variant="outline"
                    onClick={() => navigate("/wallet")}
                    className="w-full"
                  >
                    View Wallet Instead
                  </Button>
                )}
              </div>

              <p className="text-xs text-center text-muted-foreground mt-4">
                A receipt has been sent to your email address.
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-xl" data-testid="purchase-error">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Something Went Wrong</h1>
            <p className="text-muted-foreground mb-6">
              We couldn't verify your purchase. If you were charged, please contact support.
            </p>
            <div className="space-y-3">
              <Button onClick={() => verifyPurchase()} variant="outline" className="w-full">
                <Loader2 className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={() => navigate("/wallet")} className="w-full">
                Go to Wallet
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
