import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { CheckCircle2, FileText, Loader2, Package, ShoppingBag, UserPlus } from "lucide-react";
import { paymentsAPI } from "../services/mediaSalesApi";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Support both media sales (session_id) and marketplace orders (order_id)
  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order_id");
  
  const [status, setStatus] = useState("checking"); // checking, success, error
  const [order, setOrder] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (orderId) {
      // Marketplace order flow
      confirmMarketplaceOrder();
    } else if (sessionId) {
      // Media sales flow
      pollPaymentStatus();
    } else {
      // No identifier - show success anyway
      setStatus("success");
    }
  }, [sessionId, orderId]);

  // Marketplace order confirmation
  const confirmMarketplaceOrder = async () => {
    try {
      // Confirm the order (this triggers emails and notifications)
      const confirmRes = await fetch(`${API_BASE_URL}/api/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (confirmRes.ok) {
        // Get order details
        const orderRes = await fetch(`${API_BASE_URL}/api/orders/${orderId}`);
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          setOrder(orderData);
        }
        setStatus("success");
      } else {
        // Order might already be confirmed
        const orderRes = await fetch(`${API_BASE_URL}/api/orders/${orderId}`);
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          setOrder(orderData);
          setStatus("success");
        } else {
          setStatus("error");
        }
      }
    } catch (error) {
      console.error("Order confirmation error:", error);
      setStatus("success"); // Show success anyway - payment went through
    }
  };

  // Media sales payment polling
  const pollPaymentStatus = async () => {
    if (pollCount >= 10) {
      setStatus("success"); // Assume success after max polls
      return;
    }

    try {
      const result = await paymentsAPI.getStatus(sessionId);
      
      if (result.payment_status === "paid") {
        setStatus("success");
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

  // Marketplace order success view
  const renderMarketplaceSuccess = () => (
    <>
      <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
        <CheckCircle2 className="w-10 h-10 text-green-600" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Order Confirmed! 🎉</h1>
      <p className="text-muted-foreground mb-6">
        Thank you for your purchase! A confirmation email has been sent to{' '}
        <span className="font-medium text-foreground">{order?.customer_email}</span>
      </p>
      
      {order && (
        <div className="bg-muted rounded-xl p-4 mb-6 text-left">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Order Details
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order ID</span>
              <span className="font-mono">{order.order_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items</span>
              <span>{order.items?.length || 0} item(s)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-bold text-primary">${order.total?.toFixed(2)}</span>
            </div>
          </div>
          
          {order.items && order.items.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2">
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded bg-muted-foreground/10 flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.title}</p>
                    <p className="text-sm text-muted-foreground">${item.price}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {order?.is_guest_order && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 text-left">
          <h3 className="font-semibold mb-2 flex items-center gap-2 text-primary">
            <UserPlus className="w-4 h-4" />
            Create an Account
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Join Blendlink to track orders, earn BL coins, and get exclusive member discounts!
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => navigate('/register')}
          >
            Create Free Account
          </Button>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => navigate("/marketplace")}
        >
          <ShoppingBag className="w-4 h-4 mr-2" />
          Continue Shopping
        </Button>
        <Button
          className="flex-1"
          onClick={() => navigate("/")}
        >
          Back to Home
        </Button>
      </div>
    </>
  );

  // Media sales success view
  const renderMediaSalesSuccess = () => (
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
  );

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
          orderId ? renderMarketplaceSuccess() : renderMediaSalesSuccess()
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">❌</span>
            </div>
            <h1 className="text-2xl font-bold mb-2">Payment Failed</h1>
            <p className="text-muted-foreground mb-6">
              There was an issue processing your payment. Please try again.
            </p>
            <Button onClick={() => navigate("/marketplace")}>
              Back to Marketplace
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
