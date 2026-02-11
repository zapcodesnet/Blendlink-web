/**
 * Point of Sale (POS) Terminal Component
 * Section 4: Full POS system with cart, payments, receipts
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { safeFetch } from "../../services/memberPagesApi";
import {
  ShoppingCart, CreditCard, Banknote, Smartphone, Plus, Minus,
  Trash2, Receipt, Loader2, Check, X, User, Phone, Table,
  Percent, DollarSign, Printer, ChevronRight, Zap, ScanBarcode,
  ArrowLeft, Volume2, Mail
} from "lucide-react";
import { Textarea } from "../ui/textarea";

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
  const [cashReceived, setCashReceived] = useState(0);
  
  // Manual Entry Mode state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualItem, setManualItem] = useState({ name: "", description: "", price: "" });
  
  // Customer Email & Autofill state
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  
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

  // Quick Sale barcode lookup - PRODUCTION FIX: uses safeFetch
  const lookupBarcode = async (barcode) => {
    if (!barcode.trim()) return;
    
    try {
      const data = await safeFetch(`${API_URL}/api/barcode/search`, {
        method: "POST",
        body: JSON.stringify({ barcode, page_id: pageId })
      });

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
      toast.error("Barcode not found");
      playBeep(false);
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

  // Manual Entry - Add custom item to cart
  const addManualItemToCart = () => {
    if (!manualItem.name || !manualItem.price) {
      toast.error("Name and price are required");
      return;
    }
    
    const price = parseFloat(manualItem.price);
    if (isNaN(price) || price <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    
    const customItem = {
      item_id: `custom_${Date.now()}`,
      name: manualItem.name,
      description: manualItem.description || "",
      price: price,
      quantity: 1,
      is_custom: true // Flag to identify manual entries
    };
    
    setCart([...cart, customItem]);
    setManualItem({ name: "", description: "", price: "" });
    setShowManualEntry(false);
    toast.success(`Added: ${customItem.name}`);
  };

  // Customer Autofill - Search previous customers
  const searchCustomers = async (query) => {
    if (!query || query.length < 2) {
      setCustomerSuggestions([]);
      setShowCustomerSuggestions(false);
      return;
    }
    
    setLoadingCustomers(true);
    try {
      const token = localStorage.getItem("blendlink_token");
      const response = await fetch(`${API_URL}/api/pos/${pageId}/customers/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setCustomerSuggestions(data.customers || []);
        setShowCustomerSuggestions(data.customers?.length > 0);
      }
    } catch (err) {
      console.error("Customer search error:", err);
    }
    setLoadingCustomers(false);
  };

  // Select customer from suggestions
  const selectCustomer = (customer) => {
    setCustomerName(customer.name || "");
    setCustomerPhone(customer.phone || "");
    setCustomerEmail(customer.email || "");
    setShowCustomerSuggestions(false);
    toast.success(`Customer selected: ${customer.name || customer.email || customer.phone}`);
  };

  // Debounced customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (customerName.length >= 2) {
        searchCustomers(customerName);
      } else if (customerEmail.length >= 2) {
        searchCustomers(customerEmail);
      } else if (customerPhone.length >= 2) {
        searchCustomers(customerPhone);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerName, customerEmail, customerPhone]);

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
      const price = quickSaleItem.price || quickSaleItem.daily_rate || 0;
      const subtotal = price * quickSaleQuantity;
      const taxRate = posSettings?.tax_rate || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const total = subtotal + taxAmount;

      // PRODUCTION FIX: uses safeFetch
      const data = await safeFetch(`${API_URL}/api/pos/transaction`, {
        method: "POST",
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
  // Load POS settings - PRODUCTION FIX: uses safeFetch
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await safeFetch(`${API_URL}/api/pos/${pageId}/settings`);
        setPosSettings(data.settings);
      } catch (err) {
        console.error("Failed to load POS settings:", err.message);
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

  // Poll payment status for card payments - PRODUCTION FIX: uses safeFetch
  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 10;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      toast.error("Payment verification timed out. Please check your orders.");
      return;
    }

    try {
      const data = await safeFetch(`${API_URL}/api/pos/checkout/status/${sessionId}`);
      
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
        const data = await safeFetch(`${API_URL}/api/pos/checkout/create`, {
          method: "POST",
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
            customer_email: customerEmail,
            table_number: tableNumber,
            notes,
            origin_url: window.location.origin
          })
        });
        
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
    
    // For cash/digital wallet payments, process directly - PRODUCTION FIX: uses safeFetch
    try {
      const data = await safeFetch(`${API_URL}/api/pos/transaction`, {
        method: "POST",
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
      toast.error(err.message || "Transaction failed");
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
    <div className="space-y-6 pb-28" style={{ touchAction: 'pan-y' }}>
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
          {/* Manual Entry Button */}
          <Button
            onClick={() => setShowManualEntry(true)}
            variant="outline"
            className="h-11 px-4 rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50"
            data-testid="manual-entry-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Custom Item
          </Button>
        </div>

        {/* Manual Entry Modal */}
        {showManualEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowManualEntry(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5 text-orange-500" />
                  Add Custom Item
                </h3>
                <button onClick={() => setShowManualEntry(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-sm text-gray-500 mb-4">
                Add a product or service that's not in your regular list. 8% platform fee will be applied automatically.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Item Name *</label>
                  <Input
                    placeholder="e.g., Special Order, Custom Service"
                    value={manualItem.name}
                    onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                    className="h-12 rounded-xl"
                    data-testid="manual-item-name"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1 block">Description (optional)</label>
                  <Textarea
                    placeholder="Brief description..."
                    value={manualItem.description}
                    onChange={(e) => setManualItem({ ...manualItem, description: e.target.value })}
                    rows={2}
                    className="rounded-xl"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1 block">Price *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={manualItem.price}
                      onChange={(e) => setManualItem({ ...manualItem, price: e.target.value })}
                      className="h-12 pl-10 rounded-xl text-lg font-bold"
                      data-testid="manual-item-price"
                    />
                  </div>
                </div>
                
                {manualItem.price && (
                  <div className="bg-orange-50 rounded-xl p-3 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Item Price:</span>
                      <span>${parseFloat(manualItem.price || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Platform Fee (8%):</span>
                      <span>${(parseFloat(manualItem.price || 0) * 0.08).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowManualEntry(false)} className="flex-1 h-12 rounded-xl">
                  Cancel
                </Button>
                <Button 
                  onClick={addManualItemToCart} 
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                  data-testid="add-manual-item-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
            </div>
          </div>
        )}

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

        {/* Customer Info with Autofill */}
        <div className="relative mb-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Customer name (start typing to search)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onFocus={() => customerSuggestions.length > 0 && setShowCustomerSuggestions(true)}
                className="h-10 pl-10 rounded-xl border-gray-200 bg-white"
                data-testid="customer-name-input"
              />
              {loadingCustomers && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-10 pl-10 rounded-xl border-gray-200 bg-white"
                  data-testid="customer-phone-input"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="email"
                  placeholder="Email (optional)"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="h-10 pl-10 rounded-xl border-gray-200 bg-white"
                  data-testid="customer-email-input"
                />
              </div>
            </div>
          </div>
          
          {/* Customer Suggestions Dropdown */}
          {showCustomerSuggestions && customerSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
              <div className="p-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Previous Customers</span>
                <button 
                  onClick={() => setShowCustomerSuggestions(false)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {customerSuggestions.map((customer, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectCustomer(customer)}
                    className="w-full text-left px-4 py-3 hover:bg-cyan-50 border-b border-gray-50 last:border-b-0 transition-colors"
                    data-testid={`customer-suggestion-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                        {(customer.name || customer.email || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{customer.name || "Guest"}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {customer.email && <span className="truncate">{customer.email}</span>}
                          {customer.phone && <span>{customer.phone}</span>}
                        </div>
                        {customer.last_purchase && (
                          <p className="text-xs text-cyan-600 mt-0.5">Last purchase: {customer.last_purchase}</p>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
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

        {/* Manual Cash Input */}
        {paymentMethod === "cash" && (
          <div className="mb-4 p-4 bg-green-50 rounded-xl border border-green-200">
            <label className="text-sm font-medium text-green-800 mb-2 block">Cash Received</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-600" />
              <Input
                type="number"
                step="0.01"
                placeholder="Enter amount received"
                value={cashReceived || ""}
                onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                className="h-14 pl-10 rounded-xl border-green-300 bg-white text-xl font-bold"
                data-testid="cash-received-input"
              />
            </div>
            {/* Change Due Calculator */}
            {cashReceived > 0 && (
              <div className={`mt-3 p-3 rounded-xl font-bold text-center text-lg ${
                cashReceived >= total 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {cashReceived >= total 
                  ? `Change Due: $${(cashReceived - total).toFixed(2)}`
                  : `Still Owed: $${(total - cashReceived).toFixed(2)}`
                }
              </div>
            )}
            {/* Enhanced Fast Cash Buttons - Using customizable settings */}
            <div className="mt-3 space-y-2">
              {(() => {
                // Get buttons from settings or use defaults
                const fastCashButtons = posSettings?.fast_cash_buttons || [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 5000, 10000];
                const currencySymbol = posSettings?.currency_symbol || "$";
                
                // Split buttons into rows of 4
                const rows = [];
                for (let i = 0; i < fastCashButtons.length; i += 4) {
                  rows.push(fastCashButtons.slice(i, i + 4));
                }
                
                return rows.map((row, rowIdx) => (
                  <div key={rowIdx} className="grid grid-cols-4 gap-2">
                    {row.map(amt => (
                      <button
                        key={amt}
                        onClick={() => setCashReceived(amt)}
                        className={`py-2.5 rounded-lg font-medium transition-colors ${
                          cashReceived === amt 
                            ? 'bg-green-600 text-white' 
                            : 'bg-green-200 text-green-800 hover:bg-green-300'
                        }`}
                        data-testid={`fast-cash-${amt}`}
                      >
                        {currencySymbol}{amt >= 1000 ? `${amt/1000}K` : amt}
                      </button>
                    ))}
                  </div>
                ));
              })()}
              <button
                onClick={() => setCashReceived(Math.ceil(total))}
                className="w-full py-3 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 transition-colors"
                data-testid="fast-cash-exact"
              >
                Exact Amount: {posSettings?.currency_symbol || "$"}{total.toFixed(2)}
              </button>
            </div>
          </div>
        )}

        {/* Manual Card Input with Amount */}
        {paymentMethod === "card" && (
          <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <label className="text-sm font-medium text-blue-800 mb-2 block">Card Payment Amount</label>
            {/* Card Amount Input */}
            <div className="relative mb-3">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600" />
              <Input
                type="number"
                step="0.01"
                placeholder={`Payment amount (Total: $${total.toFixed(2)})`}
                defaultValue={total.toFixed(2)}
                className="h-14 pl-10 rounded-xl border-blue-300 bg-white text-xl font-bold"
                data-testid="card-amount-input"
              />
            </div>
            {/* Card Details */}
            <label className="text-sm font-medium text-blue-800 mb-2 block">Card Details (Optional Manual Entry)</label>
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Card Number"
                maxLength={19}
                className="h-11 rounded-xl border-blue-300 bg-white font-mono"
                onChange={(e) => {
                  // Format card number with spaces
                  const v = e.target.value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim();
                  e.target.value = v;
                }}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="text"
                  placeholder="MM/YY"
                  maxLength={5}
                  className="h-11 rounded-xl border-blue-300 bg-white"
                />
                <Input
                  type="text"
                  placeholder="CVV"
                  maxLength={4}
                  className="h-11 rounded-xl border-blue-300 bg-white"
                />
              </div>
              <Input
                type="text"
                placeholder="Cardholder Name"
                className="h-11 rounded-xl border-blue-300 bg-white"
              />
            </div>
            <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
              <CreditCard className="w-3 h-3" /> Will redirect to Stripe for secure payment
            </p>
          </div>
        )}

        {/* Digital Wallet Manual Input */}
        {paymentMethod === "digital_wallet" && (
          <div className="mb-4 p-4 bg-purple-50 rounded-xl border border-purple-200">
            <label className="text-sm font-medium text-purple-800 mb-2 block">Digital Wallet Payment Amount</label>
            <div className="relative mb-3">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-600" />
              <Input
                type="number"
                step="0.01"
                placeholder={`Payment amount (Total: $${total.toFixed(2)})`}
                defaultValue={total.toFixed(2)}
                className="h-14 pl-10 rounded-xl border-purple-300 bg-white text-xl font-bold"
                data-testid="digital-wallet-amount-input"
              />
            </div>
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Transaction Reference / ID"
                className="h-11 rounded-xl border-purple-300 bg-white"
              />
              <select className="w-full h-11 rounded-xl border border-purple-300 bg-white px-3">
                <option value="">Select Wallet Type</option>
                <option value="apple_pay">Apple Pay</option>
                <option value="google_pay">Google Pay</option>
                <option value="samsung_pay">Samsung Pay</option>
                <option value="venmo">Venmo</option>
                <option value="paypal">PayPal</option>
                <option value="cashapp">Cash App</option>
                <option value="zelle">Zelle</option>
                <option value="gcash">GCash</option>
                <option value="paymaya">PayMaya</option>
                <option value="other">Other</option>
              </select>
            </div>
            <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
              <Smartphone className="w-3 h-3" /> Enter transaction details after customer pays via their wallet app
            </p>
          </div>
        )}

        {/* Platform Fee Notice */}
        <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-sm">
          <div className="flex justify-between text-amber-800">
            <span>Platform Fee (8%)</span>
            <span className="font-bold">${(total * 0.08).toFixed(2)}</span>
          </div>
          <p className="text-xs text-amber-600 mt-1">
            {paymentMethod === "cash" ? "Added to monthly billing" : "Auto-deducted from payout"}
          </p>
        </div>

        {/* Complete Transaction Button */}
        <Button
          onClick={processTransaction}
          disabled={processing || cart.length === 0 || (paymentMethod === "cash" && cashReceived < total)}
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
