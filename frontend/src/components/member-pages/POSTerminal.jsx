/**
 * Point of Sale (POS) Terminal Component
 * Section 4: Full POS system with cart, payments, receipts
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  ShoppingCart, CreditCard, Banknote, Smartphone, Plus, Minus,
  Trash2, Receipt, Loader2, Check, X, User, Phone, Table,
  Percent, DollarSign, Printer, ChevronRight, Zap, ScanBarcode,
  ArrowLeft, Volume2
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Receipt Modal Component
const ReceiptModal = ({ receipt, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Transaction Complete!</h3>
          <p className="text-sm text-gray-500">Order #{receipt.order_id}</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-4 font-mono text-sm">
          <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
            <p className="font-bold">{receipt.page_name || 'BlendLink Store'}</p>
            <p className="text-xs text-gray-500">{new Date(receipt.timestamp).toLocaleString()}</p>
          </div>

          {receipt.items?.map((item, i) => (
            <div key={i} className="flex justify-between py-1">
              <span>{item.quantity}x {item.name}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}

          <div className="border-t border-dashed border-gray-300 mt-3 pt-3 space-y-1">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${receipt.subtotal?.toFixed(2)}</span>
            </div>
            {receipt.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-${receipt.discount?.toFixed(2)}</span>
              </div>
            )}
            {receipt.tax > 0 && (
              <div className="flex justify-between">
                <span>Tax</span>
                <span>${receipt.tax?.toFixed(2)}</span>
              </div>
            )}
            {receipt.tip > 0 && (
              <div className="flex justify-between">
                <span>Tip</span>
                <span>${receipt.tip?.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-300">
              <span>Total</span>
              <span>${receipt.total?.toFixed(2)}</span>
            </div>
          </div>

          <div className="text-center mt-4 pt-3 border-t border-dashed border-gray-300">
            <p className="text-xs text-gray-500">Payment: {receipt.payment_method}</p>
            <p className="text-xs text-gray-500">Order Type: {receipt.order_type}</p>
            {receipt.customer_name && (
              <p className="text-xs text-gray-500">Customer: {receipt.customer_name}</p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="flex-1 h-11 rounded-xl"
          >
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function POSTerminal({ pageId, pageType, pageName, items = [] }) {
  const [cart, setCart] = useState([]);
  const [posSettings, setPosSettings] = useState(null);
  const [orderType, setOrderType] = useState("pickup");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [tipAmount, setTipAmount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Quick Sale Mode state
  const [quickSaleMode, setQuickSaleMode] = useState(false);
  const [quickSaleBarcode, setQuickSaleBarcode] = useState("");
  const [quickSaleItem, setQuickSaleItem] = useState(null);
  const [quickSaleQuantity, setQuickSaleQuantity] = useState(1);
  const [quickSaleProcessing, setQuickSaleProcessing] = useState(false);
  const [quickSaleTotal, setQuickSaleTotal] = useState(0);
  const barcodeInputRef = useRef(null);

  // Focus barcode input when entering Quick Sale mode
  useEffect(() => {
    if (quickSaleMode && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [quickSaleMode]);

  // Auto-calculate Quick Sale total
  useEffect(() => {
    if (quickSaleItem) {
      const price = quickSaleItem.price || quickSaleItem.daily_rate || 0;
      const taxRate = posSettings?.tax_rate || 0;
      const subtotal = price * quickSaleQuantity;
      const tax = subtotal * (taxRate / 100);
      setQuickSaleTotal(subtotal + tax);
    }
  }, [quickSaleItem, quickSaleQuantity, posSettings]);

  // Quick Sale barcode lookup
  const lookupBarcode = async (barcode) => {
    if (!barcode.trim()) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/barcode/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ barcode, page_id: pageId })
      });

      if (!res.ok) {
        toast.error("Barcode not found");
        setQuickSaleItem(null);
        return;
      }

      const data = await res.json();
      if (data.found && data.item) {
        setQuickSaleItem(data.item);
        setQuickSaleQuantity(1);
        // Play success beep sound
        playBeep(true);
        toast.success(`Found: ${data.item.name}`);
      } else {
        toast.error("Item not found for this barcode");
        playBeep(false);
        setQuickSaleItem(null);
      }
    } catch (err) {
      toast.error("Barcode lookup failed");
      setQuickSaleItem(null);
    }
  };

  // Play beep sound for scanner feedback
  const playBeep = (success) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = success ? 1000 : 300;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
      
      oscillator.start();
      setTimeout(() => oscillator.stop(), success ? 100 : 300);
    } catch (e) {
      // Audio not available
    }
  };

  // Handle barcode input (for scanner or manual entry)
  const handleBarcodeInput = (e) => {
    const value = e.target.value;
    setQuickSaleBarcode(value);
    
    // Auto-lookup when barcode reaches standard length (typically 8-14 digits)
    if (value.length >= 8 && /^\d+$/.test(value)) {
      lookupBarcode(value);
    }
  };

  // Handle barcode key press (Enter key triggers lookup)
  const handleBarcodeKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookupBarcode(quickSaleBarcode);
    }
  };

  // Quick Sale - One-tap cash payment
  const processQuickSale = async () => {
    if (!quickSaleItem) {
      toast.error("Scan an item first");
      return;
    }

    setQuickSaleProcessing(true);
    
    try {
      const token = localStorage.getItem("token");
      const price = quickSaleItem.price || quickSaleItem.daily_rate || 0;
      const subtotal = price * quickSaleQuantity;
      const taxRate = posSettings?.tax_rate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      const res = await fetch(`${API_URL}/api/pos/transaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          page_id: pageId,
          items: [{
            item_id: quickSaleItem.product_id || quickSaleItem.item_id || quickSaleItem.rental_id || quickSaleItem.service_id,
            name: quickSaleItem.name,
            price: price,
            quantity: quickSaleQuantity
          }],
          order_type: "pickup",
          payment_method: "cash",
          subtotal,
          tax: taxAmount,
          discount: 0,
          tip: 0,
          total,
          customer_name: "",
          notes: "Quick Sale"
        })
      });

      if (!res.ok) throw new Error("Transaction failed");
      
      const data = await res.json();
      
      // Show mini receipt toast
      toast.success(
        <div className="text-sm">
          <p className="font-bold">Sale Complete!</p>
          <p>{quickSaleQuantity}x {quickSaleItem.name}</p>
          <p className="text-green-600 font-bold">${total.toFixed(2)} CASH</p>
        </div>,
        { duration: 3000 }
      );
      
      playBeep(true);
      
      // Reset for next scan
      setQuickSaleBarcode("");
      setQuickSaleItem(null);
      setQuickSaleQuantity(1);
      
      // Focus back on barcode input
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
      
    } catch (err) {
      toast.error("Quick sale failed");
      playBeep(false);
    }
    
    setQuickSaleProcessing(false);
  };

  // Exit Quick Sale mode
  const exitQuickSale = () => {
    setQuickSaleMode(false);
    setQuickSaleBarcode("");
    setQuickSaleItem(null);
    setQuickSaleQuantity(1);
  };

  // Load POS settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/pos/${pageId}/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPosSettings(data.settings);
        }
      } catch (err) {
        console.error("Failed to load POS settings");
      }
    };
    loadSettings();
  }, [pageId]);

  // Add item to cart
  const addToCart = useCallback((item) => {
    setCart(prev => {
      const existing = prev.find(i => i.item_id === (item.product_id || item.item_id || item.rental_id || item.service_id));
      if (existing) {
        return prev.map(i => 
          i.item_id === existing.item_id 
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, {
        item_id: item.product_id || item.item_id || item.rental_id || item.service_id,
        name: item.name,
        price: item.price || item.daily_rate || 0,
        quantity: 1,
        options: []
      }];
    });
  }, []);

  // Update quantity
  const updateQuantity = (itemId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.item_id === itemId) {
        const newQty = Math.max(0, item.quantity + delta);
        return newQty === 0 ? null : { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  // Remove from cart
  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(i => i.item_id !== itemId));
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxRate = posSettings?.tax_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal + taxAmount - discountAmount + tipAmount;

  // Check URL for payment status on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const sessionId = urlParams.get('session_id');
    const orderId = urlParams.get('order_id');
    
    if (paymentStatus === 'success' && sessionId) {
      // Poll for payment confirmation
      pollPaymentStatus(sessionId);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
      toast.error("Payment was cancelled");
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Poll payment status for card payments
  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 10;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      toast.error("Payment verification timed out. Please check your orders.");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/pos/checkout/status/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to check status");
      
      const data = await res.json();
      
      if (data.payment_status === "paid") {
        toast.success("Payment successful! Order completed.");
        setReceipt({
          order_id: "Payment confirmed",
          timestamp: new Date().toISOString(),
          items: cart,
          subtotal,
          tax: taxAmount,
          discount: discountAmount,
          tip: tipAmount,
          total,
          payment_method: "Card (Stripe)",
          order_type: orderType,
          customer_name: customerName,
          page_name: pageName
        });
        setCart([]);
        return;
      } else if (data.status === "expired") {
        toast.error("Payment session expired");
        return;
      }

      // Continue polling
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    } catch (err) {
      console.error("Payment status check error:", err);
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), pollInterval);
    }
  };

  // Process transaction
  const processTransaction = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setProcessing(true);
    
    // For card payments, create Stripe checkout session
    if (paymentMethod === "card") {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/pos/checkout/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            page_id: pageId,
            items: cart,
            order_type: orderType,
            subtotal,
            tax: taxAmount,
            discount: discountAmount,
            tip: tipAmount,
            total,
            customer_name: customerName,
            customer_phone: customerPhone,
            table_number: tableNumber,
            notes,
            origin_url: window.location.origin
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Failed to create checkout");
        }
        
        const data = await res.json();
        
        // Redirect to Stripe Checkout
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
          return;
        }
      } catch (err) {
        toast.error(err.message || "Card payment failed");
        setProcessing(false);
        return;
      }
    }
    
    // For cash/digital wallet payments, process directly
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/pos/transaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          page_id: pageId,
          items: cart,
          order_type: orderType,
          payment_method: paymentMethod,
          subtotal,
          tax: taxAmount,
          discount: discountAmount,
          tip: tipAmount,
          total,
          customer_name: customerName,
          customer_phone: customerPhone,
          table_number: tableNumber,
          notes
        })
      });

      if (!res.ok) throw new Error("Transaction failed");
      
      const data = await res.json();
      setReceipt(data.receipt);
      toast.success("Transaction completed!");
      
      // Clear cart
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setTableNumber("");
      setNotes("");
      setTipAmount(0);
      setDiscountPercent(0);
    } catch (err) {
      toast.error("Transaction failed");
    }
    setProcessing(false);
  };

  // Filter items by search
  const filteredItems = items.filter(item =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Order types config
  const orderTypes = [
    { id: "pickup", label: "Pickup", icon: ShoppingCart },
    { id: "dine_in", label: "Dine In", icon: Table },
    { id: "delivery", label: "Delivery", icon: ShoppingCart },
  ];

  // Payment methods
  const paymentMethods = [
    { id: "cash", label: "Cash", icon: Banknote },
    { id: "card", label: "Card", icon: CreditCard },
    { id: "digital_wallet", label: "Digital", icon: Smartphone },
  ];

  return (
    <div className="space-y-6" style={{ touchAction: 'pan-y' }}>
      {/* Quick Sale Mode Toggle */}
      {!quickSaleMode ? (
        <button
          onClick={() => setQuickSaleMode(true)}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl p-4 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all"
          data-testid="quick-sale-toggle"
        >
          <Zap className="w-6 h-6" />
          <span className="text-lg font-bold">Quick Sale Mode</span>
          <span className="text-sm opacity-90">Scan & Pay Instantly</span>
        </button>
      ) : (
        /* Quick Sale Mode UI */
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200 p-6 space-y-4" data-testid="quick-sale-panel">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Quick Sale Mode</h3>
                <p className="text-sm text-gray-500">Scan barcode → One-tap cash payment</p>
              </div>
            </div>
            <button
              onClick={exitQuickSale}
              className="p-2 hover:bg-amber-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Barcode Scanner Input */}
          <div className="relative">
            <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500" />
            <Input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan or enter barcode..."
              value={quickSaleBarcode}
              onChange={handleBarcodeInput}
              onKeyPress={handleBarcodeKeyPress}
              className="pl-12 h-14 text-lg font-mono rounded-xl border-amber-200 bg-white focus:border-amber-400 focus:ring-amber-400"
              autoFocus
              data-testid="quick-sale-barcode-input"
            />
            {quickSaleBarcode && (
              <button
                onClick={() => {
                  setQuickSaleBarcode("");
                  setQuickSaleItem(null);
                  barcodeInputRef.current?.focus();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Scanned Item Display */}
          {quickSaleItem ? (
            <div className="bg-white rounded-xl border border-amber-200 p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center overflow-hidden">
                  {quickSaleItem.images?.[0] ? (
                    <img src={quickSaleItem.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingCart className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-lg text-gray-900">{quickSaleItem.name}</p>
                  <p className="text-2xl font-bold text-amber-600">
                    ${(quickSaleItem.price || quickSaleItem.daily_rate || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setQuickSaleQuantity(Math.max(1, quickSaleQuantity - 1))}
                  className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="text-3xl font-bold w-16 text-center">{quickSaleQuantity}</span>
                <button
                  onClick={() => setQuickSaleQuantity(quickSaleQuantity + 1)}
                  className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Total & Pay Button */}
              <div className="pt-4 border-t border-gray-100">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-500">Total (incl. tax)</p>
                  <p className="text-4xl font-bold text-gray-900">${quickSaleTotal.toFixed(2)}</p>
                </div>
                
                <button
                  onClick={processQuickSale}
                  disabled={quickSaleProcessing}
                  className="w-full h-16 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-3 text-xl font-bold shadow-lg hover:shadow-xl transition-all"
                  data-testid="quick-sale-pay-btn"
                >
                  {quickSaleProcessing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Banknote className="w-6 h-6" />
                      Cash Payment
                      <ChevronRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ScanBarcode className="w-16 h-16 mx-auto mb-3 text-amber-300" />
              <p className="font-medium">Ready to scan</p>
              <p className="text-sm">Point your barcode scanner at a product</p>
            </div>
          )}

          {/* Quick Sale Instructions */}
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">1</div>
              <span>Scan item</span>
            </div>
            <ChevronRight className="w-4 h-4" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xs">2</div>
              <span>Set qty</span>
            </div>
            <ChevronRight className="w-4 h-4" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-xs">3</div>
              <span>Tap to pay</span>
            </div>
          </div>
        </div>
      )}

      {/* Regular POS UI (hidden in Quick Sale mode) */}
      {!quickSaleMode && (
        <>
      {/* Items Search Section */}
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-11 rounded-xl border-gray-200 bg-white/80"
          />
        </div>

        {/* Items Grid - Horizontal scrollable on mobile */}
        {filteredItems.length > 0 ? (
          <div 
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4 max-h-[300px] overflow-y-auto"
            style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
          >
            {filteredItems.map((item) => {
              const itemId = item.product_id || item.item_id || item.rental_id || item.service_id;
              return (
                <button
                  key={itemId}
                  onClick={() => addToCart(item)}
                  className="bg-white rounded-xl border border-gray-100 p-3 text-left hover:border-cyan-400 hover:shadow-lg transition-all"
                  data-testid={`pos-item-${itemId}`}
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                    {item.images?.[0] ? (
                      <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingCart className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <p className="font-medium text-sm truncate text-gray-800">{item.name}</p>
                  <p className="text-cyan-600 font-bold">${(item.price || item.daily_rate || 0).toFixed(2)}</p>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No items found</p>
            <p className="text-sm">Add items to your page first</p>
          </div>
        )}
      </div>

      {/* Current Order Section */}
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-cyan-600" />
          Current Order
        </h3>

        {/* Order Type Selector */}
        <div className="flex gap-2 mb-4">
          {orderTypes.map(type => {
            const TypeIcon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => setOrderType(type.id)}
                className={`flex-1 py-2.5 px-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                  orderType === type.id 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <TypeIcon className="w-4 h-4" />
                {type.label}
              </button>
            );
          })}
        </div>

        {/* Cart Items */}
        <div 
          className="space-y-2 max-h-[200px] overflow-y-auto mb-4"
          style={{ touchAction: 'pan-y' }}
        >
          {cart.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Cart is empty</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.item_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{item.name}</p>
                  <p className="text-sm text-gray-500">${item.price.toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => updateQuantity(item.item_id, -1)}
                    className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-bold">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.item_id, 1)}
                    className="w-8 h-8 rounded-lg bg-cyan-100 hover:bg-cyan-200 text-cyan-700 flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => removeFromCart(item.item_id)}
                    className="w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Customer Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Input
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="h-10 rounded-xl border-gray-200 bg-white"
          />
          <Input
            placeholder="Phone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="h-10 rounded-xl border-gray-200 bg-white"
          />
        </div>

        {/* Discount and Tip */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="relative">
            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="number"
              placeholder="Discount %"
              value={discountPercent || ""}
              onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
              className="h-10 pl-10 rounded-xl border-gray-200 bg-white"
            />
          </div>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="number"
              placeholder="Tip"
              value={tipAmount || ""}
              onChange={(e) => setTipAmount(parseFloat(e.target.value) || 0)}
              className="h-10 pl-10 rounded-xl border-gray-200 bg-white"
            />
          </div>
        </div>

        {/* Quick Tip Buttons */}
        <div className="flex gap-2 mb-4">
          {[15, 18, 20, 25].map(pct => (
            <button
              key={pct}
              onClick={() => setTipAmount(subtotal * (pct / 100))}
              className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Totals */}
        <div className="space-y-2 py-3 border-t border-gray-200">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount ({discountPercent}%)</span>
              <span>-${discountAmount.toFixed(2)}</span>
            </div>
          )}
          {taxAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax ({taxRate}%)</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
          )}
          {tipAmount > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tip</span>
              <span>${tipAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-gray-900 pt-2 border-t border-gray-200">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="flex gap-2 mb-4">
          {paymentMethods.map(method => {
            const MethodIcon = method.icon;
            return (
              <button
                key={method.id}
                onClick={() => setPaymentMethod(method.id)}
                className={`flex-1 py-3 px-3 rounded-xl font-medium text-sm flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === method.id 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <MethodIcon className="w-5 h-5" />
                {method.label}
              </button>
            );
          })}
        </div>

        {/* Complete Transaction Button */}
        <Button
          onClick={processTransaction}
          disabled={processing || cart.length === 0}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-lg shadow-lg shadow-green-500/25 disabled:opacity-50"
        >
          {processing ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Check className="w-5 h-5 mr-2" />
          )}
          Complete ${total.toFixed(2)}
        </Button>
      </div>
        </>
      )}

      {/* Receipt Modal */}
      {receipt && (
        <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}
