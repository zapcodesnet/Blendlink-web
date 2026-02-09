/**
 * Point of Sale (POS) Terminal Component
 * Section 4: Full POS system with cart, payments, receipts
 */

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  ShoppingCart, CreditCard, Banknote, Smartphone, Plus, Minus,
  Trash2, Receipt, Loader2, Check, X, User, Phone, Table,
  Percent, DollarSign, Printer, ChevronRight
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

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

  // Process transaction
  const processTransaction = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setProcessing(true);
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

      {/* Receipt Modal */}
      {receipt && (
        <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </div>
  );
}
