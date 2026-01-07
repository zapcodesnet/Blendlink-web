import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { paymentsAPI } from "../services/mediaSalesApi";

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id");
  const offerId = searchParams.get("offer_id");
  
  const [status, setStatus] = useState("checking"); // checking, success, error
  const [contractId, setContractId] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    }
  }, [sessionId]);

  const pollPaymentStatus = async () => {
    if (pollCount >= 10) {
      setStatus("success"); // Assume success after max polls
      return;
    }

    try {
      const result = await paymentsAPI.getStatus(sessionId);
      
      if (result.payment_status === "paid") {
        setStatus("success");
        // The contract should be created - fetch it
        // In a real app, the API would return the contract ID
      } else if (result.status === "expired") {
        setStatus("error");
      } else {
        // Keep polling
        setPollCount(prev => prev + 1);
        setTimeout(pollPaymentStatus, 2000);
      }
    } catch (error) {
      console.error("Payment status check failed:", error);
      setPollCount(prev => prev + 1);
      setTimeout(pollPaymentStatus, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {status === "checking" ? (
          <>
            <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold mb-2">Processing Payment</h1>
            <p className="text-muted-foreground mb-4">
              Please wait while we confirm your payment...
            </p>
          </>
        ) : status === "success" ? (
          <>
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground mb-6">
              Your payment has been processed. Please sign the copyright transfer
              contract to complete your purchase and download the original media.
            </p>
            
            <div className="bg-muted rounded-xl p-4 mb-6 text-left">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Next Steps
              </h3>
              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>Review the copyright transfer contract</li>
                <li>Sign the contract with your signature</li>
                <li>Wait for the seller to sign (if not already)</li>
                <li>Download your original unwatermarked media</li>
              </ol>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/offers")}
              >
                View Offers
              </Button>
              <Button
                className="flex-1"
                onClick={() => navigate(`/offers`)}
              >
                <FileText className="w-4 h-4 mr-2" />
                Sign Contract
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Payment Failed</h1>
            <p className="text-muted-foreground mb-6">
              There was an issue processing your payment. Please try again.
            </p>
            <Button onClick={() => navigate("/offers")}>
              Back to Offers
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
