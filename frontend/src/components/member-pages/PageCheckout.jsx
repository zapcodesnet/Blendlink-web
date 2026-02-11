/**
 * Page Checkout Component
 * Handles checkout and payment processing for public page cart
 * Allows guest checkout without registration
 */
import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { safeFetch } from "../../services/memberPagesApi";
import {
  CreditCard, Banknote, ShoppingBag, MapPin, Phone, Mail, User,
  ArrowLeft, Check, Loader2, Shield, Lock, Package, Truck,
  ChevronRight, X, Minus, Plus
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Payment method options
const PAYMENT_METHODS = [
  { id: "card", label: "Credit/Debit Card", icon: CreditCard, description: "Pay securely with card" },
  { id: "cash", label: "Cash on Delivery", icon: Banknote, description: "Pay when you receive" },
];

// Order type options
const ORDER_TYPES = [
  { id: "delivery", label: "Delivery", icon: Truck, description: "Delivered to your address" },
  { id: "pickup", label: "Pickup", icon: Package, description: "Pick up at store" },
];

export default function PageCheckout({ 
  pageId, 
  pageName, 
  cart, 
  currencySymbol = "$", 
  onUpdateCart, 
  onClose,
  pageLocations = []
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Review, 2: Customer Info, 3: Payment
  const [loading, setLoading] = useState(false);
  const [orderType, setOrderType] = useState("delivery");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [selectedLocation, setSelectedLocation] = useState(pageLocations[0] || null);
  
  // Customer info (guest checkout)
  const [customerInfo, setCustomerInfo] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    notes: ""
  });

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = orderType === "delivery" ? 5.00 : 0; // Flat delivery fee
  const tax = subtotal * 0.08; // 8% tax
  const total = subtotal + deliveryFee + tax;

  const updateQuantity = (itemId, delta) => {
    onUpdateCart(cart.map(item => {
      if (item.item_id === itemId) {
        const newQty = Math.max(0, item.quantity + delta);
        return newQty === 0 ? null : { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean));
  };

  const removeItem = (itemId) => {
    onUpdateCart(cart.filter(item => item.item_id !== itemId));
  };

  const validateCustomerInfo = () => {
    if (!customerInfo.name.trim()) {
      toast.error("Please enter your name");
      return false;
    }
    if (!customerInfo.phone.trim()) {
      toast.error("Please enter your phone number");
      return false;
    }
    if (orderType === "delivery" && !customerInfo.address.trim()) {
      toast.error("Please enter your delivery address");
      return false;
    }
    return true;
  };

  const handlePlaceOrder = async () => {
    if (!validateCustomerInfo()) return;
    
    setLoading(true);
    try {
      const orderData = {
        page_id: pageId,
        customer_name: customerInfo.name,
        customer_email: customerInfo.email || null,
        customer_phone: customerInfo.phone,
        delivery_address: orderType === "delivery" ? customerInfo.address : null,
        delivery_city: customerInfo.city || null,
        pickup_location_id: orderType === "pickup" && selectedLocation ? selectedLocation.location_id : null,
        order_type: orderType,
        payment_method: paymentMethod,
        items: cart.map(item => ({
          item_id: item.item_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        subtotal: subtotal,
        delivery_fee: deliveryFee,
        tax: tax,
        total: total,
        notes: customerInfo.notes || null,
        is_guest_order: true
      };

      const response = await safeFetch(`${API_URL}/api/page-orders/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });

      if (paymentMethod === "card") {
        // Create Stripe checkout session
        const origin = window.location.origin;
        const checkoutResponse = await safeFetch(`${API_URL}/api/payments/stripe/checkout/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order_id: response.order_id,
            origin_url: origin
          })
        });

        if (checkoutResponse.url || checkoutResponse.checkout_url) {
          // Redirect to Stripe Checkout (live mode)
          window.location.href = checkoutResponse.url || checkoutResponse.checkout_url;
        } else {
          throw new Error("Failed to create payment session");
        }
      } else {
        // Cash on delivery - order placed
        toast.success("Order placed successfully!");
        onClose();
        // Show order confirmation
        navigate(`/order-confirmation/${response.order_id}`);
      }
    } catch (err) {
      console.error("Order error:", err);
      toast.error(err.message || "Failed to place order");
    }
    setLoading(false);
  };

  if (cart.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full text-center">
          <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-500 mb-6">Add items to your cart to continue</p>
          <Button onClick={onClose} className="rounded-xl">
            Continue Shopping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto" data-testid="page-checkout">
      <div className="min-h-screen flex items-start justify-center p-4 py-8">
        <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-5 text-white">
            <div className="flex items-center justify-between">
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold">Checkout - {pageName}</h2>
              <div className="w-9" /> {/* Spacer */}
            </div>
            
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mt-4">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step >= s ? 'bg-white text-cyan-600' : 'bg-white/30 text-white'
                  }`}>
                    {step > s ? <Check className="w-4 h-4" /> : s}
                  </div>
                  {s < 3 && <div className={`w-8 h-0.5 ${step > s ? 'bg-white' : 'bg-white/30'}`} />}
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-8 mt-2 text-xs">
              <span className={step >= 1 ? 'text-white' : 'text-white/60'}>Review</span>
              <span className={step >= 2 ? 'text-white' : 'text-white/60'}>Details</span>
              <span className={step >= 3 ? 'text-white' : 'text-white/60'}>Payment</span>
            </div>
          </div>

          <div className="p-5 max-h-[70vh] overflow-y-auto">
            {/* Step 1: Review Cart */}
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900">Review Your Order</h3>
                
                {/* Cart Items */}
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.item_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                        {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate">{item.name}</p>
                        <p className="text-cyan-600 font-bold">{currencySymbol}{item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => updateQuantity(item.item_id, -1)}
                          className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-bold">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.item_id, 1)}
                          className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center hover:bg-cyan-200"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button 
                        onClick={() => removeItem(item.item_id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Order Type Selection */}
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="font-medium text-gray-700 mb-3">How would you like to receive your order?</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {ORDER_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isSelected = orderType === type.id;
                      return (
                        <button
                          key={type.id}
                          onClick={() => setOrderType(type.id)}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            isSelected 
                              ? 'border-cyan-500 bg-cyan-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          data-testid={`order-type-${type.id}`}
                        >
                          <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? 'text-cyan-600' : 'text-gray-400'}`} />
                          <p className={`font-medium ${isSelected ? 'text-cyan-700' : 'text-gray-700'}`}>{type.label}</p>
                          <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Pickup Location Selection */}
                {orderType === "pickup" && pageLocations.length > 0 && (
                  <div className="pt-4">
                    <h4 className="font-medium text-gray-700 mb-3">Select Pickup Location</h4>
                    <div className="space-y-2">
                      {pageLocations.map((loc, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedLocation(loc)}
                          className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                            selectedLocation === loc 
                              ? 'border-cyan-500 bg-cyan-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <p className="font-medium text-gray-800">{loc.name || `Location ${i + 1}`}</p>
                          <p className="text-sm text-gray-500">{loc.address}, {loc.city}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Order Summary */}
                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                  </div>
                  {orderType === "delivery" && (
                    <div className="flex justify-between text-gray-600">
                      <span>Delivery Fee</span>
                      <span>{currencySymbol}{deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Tax (8%)</span>
                    <span>{currencySymbol}{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-100">
                    <span>Total</span>
                    <span>{currencySymbol}{total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  onClick={() => setStep(2)}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold"
                  data-testid="continue-to-details"
                >
                  Continue <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              </div>
            )}

            {/* Step 2: Customer Details */}
            {step === 2 && (
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900">Your Details</h3>
                <p className="text-sm text-gray-500">No account needed - checkout as guest</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Full Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        placeholder="John Doe"
                        value={customerInfo.name}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                        className="pl-11 h-12 rounded-xl"
                        data-testid="customer-name-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        placeholder="+1 (555) 123-4567"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                        className="pl-11 h-12 rounded-xl"
                        data-testid="customer-phone-input"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Email (optional)</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        value={customerInfo.email}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                        className="pl-11 h-12 rounded-xl"
                        data-testid="customer-email-input"
                      />
                    </div>
                  </div>

                  {orderType === "delivery" && (
                    <>
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">Delivery Address *</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            placeholder="123 Main St, Apt 4B"
                            value={customerInfo.address}
                            onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                            className="pl-11 h-12 rounded-xl"
                            data-testid="customer-address-input"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-1 block">City</label>
                        <Input
                          placeholder="New York"
                          value={customerInfo.city}
                          onChange={(e) => setCustomerInfo({ ...customerInfo, city: e.target.value })}
                          className="h-12 rounded-xl"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Order Notes (optional)</label>
                    <textarea
                      placeholder="Special instructions..."
                      value={customerInfo.notes}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                      className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setStep(1)}
                    variant="outline"
                    className="flex-1 h-12 rounded-xl"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button
                    onClick={() => {
                      if (validateCustomerInfo()) setStep(3);
                    }}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold"
                    data-testid="continue-to-payment"
                  >
                    Continue <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900">Payment Method</h3>
                
                {/* Payment Methods */}
                <div className="space-y-3">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon;
                    const isSelected = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`w-full p-4 rounded-xl border-2 flex items-center gap-4 transition-all ${
                          isSelected 
                            ? 'border-cyan-500 bg-cyan-50' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        data-testid={`payment-method-${method.id}`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          isSelected ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`font-medium ${isSelected ? 'text-cyan-700' : 'text-gray-700'}`}>
                            {method.label}
                          </p>
                          <p className="text-sm text-gray-500">{method.description}</p>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-cyan-500 bg-cyan-500' : 'border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Order Summary */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <h4 className="font-medium text-gray-700">Order Summary</h4>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Items ({cart.reduce((sum, i) => sum + i.quantity, 0)})</span>
                      <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                    </div>
                    {orderType === "delivery" && (
                      <div className="flex justify-between text-gray-600">
                        <span>Delivery</span>
                        <span>{currencySymbol}{deliveryFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>Tax</span>
                      <span>{currencySymbol}{tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                      <span>Total</span>
                      <span>{currencySymbol}{total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Security Badge */}
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Lock className="w-4 h-4" />
                  <span>Secure checkout powered by BlendLink</span>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => setStep(2)}
                    variant="outline"
                    className="flex-1 h-12 rounded-xl"
                    disabled={loading}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back
                  </Button>
                  <Button
                    onClick={handlePlaceOrder}
                    disabled={loading}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold"
                    data-testid="place-order-button"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {paymentMethod === "card" ? "Pay" : "Place Order"} {currencySymbol}{total.toFixed(2)}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
