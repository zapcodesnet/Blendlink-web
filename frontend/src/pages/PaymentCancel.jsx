import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { XCircle, ArrowLeft, ShoppingCart } from "lucide-react";

export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const offerId = searchParams.get("offer_id");
  const orderId = searchParams.get("order_id");

  // Check if this is a marketplace order cancellation
  const isMarketplaceOrder = !!orderId;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-amber-600" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Payment Cancelled</h1>
        <p className="text-muted-foreground mb-6">
          {isMarketplaceOrder 
            ? "Your order was not completed. Your cart items are still saved and you can try again when you're ready."
            : "Your payment was cancelled. The offer is still active and you can try again when you're ready."
          }
        </p>

        <div className="bg-muted rounded-xl p-4 mb-6 text-sm text-muted-foreground">
          <p>
            {isMarketplaceOrder
              ? "No charges have been made to your card. Return to checkout to complete your purchase."
              : "The seller has already accepted your offer. You can return to complete the payment at any time before the offer expires."
            }
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
          <Button
            className="flex-1"
            onClick={() => navigate(isMarketplaceOrder ? "/checkout" : "/offers")}
          >
            {isMarketplaceOrder ? (
              <>
                <ShoppingCart className="w-4 h-4 mr-2" />
                Return to Checkout
              </>
            ) : (
              "Back to Offers"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
