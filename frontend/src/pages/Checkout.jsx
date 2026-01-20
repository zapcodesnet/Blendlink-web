import React, { useState, useEffect, useContext, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { 
  ArrowLeft, ShoppingCart, CreditCard, Truck, Trash2, Package,
  Loader2, MapPin, User, Phone, Mail, Home, Check, AlertCircle, Globe, Info
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Comprehensive list of countries
const ALL_COUNTRIES = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "HK", name: "Hong Kong", flag: "🇭🇰" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "RU", name: "Russia", flag: "🇷🇺" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
];

export default function Checkout() {
  const { user } = useContext(AuthContext) || {};
  const navigate = useNavigate();
  const location = useLocation();
  
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shippingRates, setShippingRates] = useState({});
  const [selectedShipping, setSelectedShipping] = useState({});
  const [loadingShipping, setLoadingShipping] = useState({});
  
  // Customer info (for guests and logged-in users)
  const [customer, setCustomer] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: ""
  });
  
  // Shipping address
  const [shippingAddress, setShippingAddress] = useState({
    name: user?.name || "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
    country: "US"
  });

  const [step, setStep] = useState(1); // 1: Cart, 2: Shipping, 3: Payment

  // Calculate allowed countries from seller's target markets
  const allowedCountries = useMemo(() => {
    // Get all target_countries from all items in cart
    const allTargetCountries = new Set();
    cart.forEach(item => {
      const targets = item.target_countries || item.target_market_countries || ["US"];
      targets.forEach(c => allTargetCountries.add(c));
    });
    
    // If no specific targets, allow all countries
    if (allTargetCountries.size === 0) {
      return ALL_COUNTRIES;
    }
    
    // Find intersection of all items' target countries
    let intersection = null;
    cart.forEach(item => {
      const targets = new Set(item.target_countries || item.target_market_countries || ["US"]);
      if (intersection === null) {
        intersection = targets;
      } else {
        intersection = new Set([...intersection].filter(c => targets.has(c)));
      }
    });
    
    // Filter to only allowed countries
    const allowed = ALL_COUNTRIES.filter(c => intersection?.has(c.code));
    return allowed.length > 0 ? allowed : ALL_COUNTRIES;
  }, [cart]);

  // Load cart on mount
  useEffect(() => {
    loadCart();
  }, []);

  // Pre-fill user info if logged in
  useEffect(() => {
    if (user) {
      setCustomer({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || ""
      });
      setShippingAddress(prev => ({
        ...prev,
        name: user.name || ""
      }));
    }
  }, [user]);

  const loadCart = () => {
    // Load from localStorage
    const savedCart = JSON.parse(localStorage.getItem('blendlink_cart') || '[]');
    setCart(savedCart);
    setLoading(false);

    // If buyNow mode, filter to just that item
    if (location.state?.buyNow && location.state?.listingId) {
      const buyNowItem = savedCart.find(item => item.listing_id === location.state.listingId);
      if (buyNowItem) {
        setCart([buyNowItem]);
      }
    }
  };

  const removeItem = (listingId) => {
    const newCart = cart.filter(item => item.listing_id !== listingId);
    setCart(newCart);
    localStorage.setItem('blendlink_cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('cart-updated'));
    
    if (newCart.length === 0) {
      toast.info("Cart is empty");
    }
  };

  const updateQuantity = (listingId, quantity) => {
    if (quantity < 1) return;
    const newCart = cart.map(item => 
      item.listing_id === listingId ? { ...item, quantity } : item
    );
    setCart(newCart);
    localStorage.setItem('blendlink_cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('cart-updated'));
  };

  // Get shipping estimate for an item
  const getShippingEstimate = async (item) => {
    if (item.is_digital) return;
    if (!shippingAddress.zip || shippingAddress.zip.length < 5) return;

    setLoadingShipping(prev => ({ ...prev, [item.listing_id]: true }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/shippo/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_zip: item.location || "10001",
          destination_zip: shippingAddress.zip,
          weight: item.weight?.value || null,
          length: item.dimensions?.length || null,
          width: item.dimensions?.width || null,
          height: item.dimensions?.height || null,
          is_digital: item.is_digital
        })
      });

      const data = await response.json();
      
      setShippingRates(prev => ({ ...prev, [item.listing_id]: data }));
      
      // Auto-select cheapest option
      if (data.rates?.length > 0) {
        setSelectedShipping(prev => ({
          ...prev,
          [item.listing_id]: data.rates[0]
        }));
      }
    } catch (err) {
      console.error("Shipping estimate error:", err);
    } finally {
      setLoadingShipping(prev => ({ ...prev, [item.listing_id]: false }));
    }
  };

  // Fetch shipping for all physical items when ZIP changes
  useEffect(() => {
    if (shippingAddress.zip?.length === 5 && step === 2) {
      cart.forEach(item => {
        if (!item.is_digital) {
          getShippingEstimate(item);
        }
      });
    }
  }, [shippingAddress.zip, step]);

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  
  const shippingTotal = cart.reduce((sum, item) => {
    if (item.is_digital) return sum;
    const selected = selectedShipping[item.listing_id];
    return sum + (selected?.amount || 0);
  }, 0);

  const total = subtotal + shippingTotal;

  // Check if all physical items have shipping selected
  const allShippingSelected = cart.every(item => 
    item.is_digital || selectedShipping[item.listing_id]
  );

  const validateCustomerInfo = () => {
    if (!customer.name.trim()) {
      toast.error("Please enter your name");
      return false;
    }
    if (!customer.email.trim() || !customer.email.includes('@')) {
      toast.error("Please enter a valid email");
      return false;
    }
    return true;
  };

  const validateShippingAddress = () => {
    const hasPhysicalItems = cart.some(item => !item.is_digital);
    if (!hasPhysicalItems) return true;

    if (!shippingAddress.street1.trim()) {
      toast.error("Please enter street address");
      return false;
    }
    if (!shippingAddress.city.trim()) {
      toast.error("Please enter city");
      return false;
    }
    if (!shippingAddress.state.trim()) {
      toast.error("Please enter state");
      return false;
    }
    if (!shippingAddress.zip.trim() || shippingAddress.zip.length < 5) {
      toast.error("Please enter a valid ZIP code");
      return false;
    }
    if (!allShippingSelected) {
      toast.error("Please select shipping option for all items");
      return false;
    }
    return true;
  };

  const handleProceedToShipping = () => {
    if (!validateCustomerInfo()) return;
    setStep(2);
  };

  const handleProceedToPayment = () => {
    if (!validateShippingAddress()) return;
    setStep(3);
  };

  const handleCheckout = async () => {
    setSubmitting(true);

    try {
      const orderItems = cart.map(item => ({
        listing_id: item.listing_id,
        title: item.title,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image,
        seller_id: item.seller_id,
        is_digital: item.is_digital
      }));

      // Get selected shipping option for the order
      const shippingOption = cart.find(item => !item.is_digital)
        ? selectedShipping[cart.find(item => !item.is_digital)?.listing_id]
        : null;

      const response = await fetch(`${API_BASE_URL}/api/orders/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user ? `Bearer ${api.getToken()}` : ''
        },
        body: JSON.stringify({
          items: orderItems,
          customer: customer,
          shipping_address: shippingAddress,
          shipping_option: shippingOption,
          total_items: subtotal,
          shipping_cost: shippingTotal,
          total: total,
          payment_method: "card"
        })
      });

      const data = await response.json();

      if (data.payment_url) {
        // Clear cart before redirecting
        localStorage.setItem('blendlink_cart', '[]');
        window.dispatchEvent(new Event('cart-updated'));
        
        // Redirect to Stripe
        window.location.href = data.payment_url;
      } else if (data.order_id) {
        // Clear cart
        localStorage.setItem('blendlink_cart', '[]');
        window.dispatchEvent(new Event('cart-updated'));
        
        toast.success("Order placed successfully!");
        navigate(`/payment/success?order_id=${data.order_id}`);
      } else {
        throw new Error("Failed to create order");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error("Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold">Checkout</h1>
          </div>
        </header>
        
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
          <p className="text-muted-foreground mb-6">Browse the marketplace to find items</p>
          <Button onClick={() => navigate("/marketplace")}>
            Browse Marketplace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">Checkout</h1>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-6">
          {[
            { num: 1, label: "Cart", icon: ShoppingCart },
            { num: 2, label: "Shipping", icon: Truck },
            { num: 3, label: "Payment", icon: CreditCard }
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div className={`flex items-center gap-2 ${step >= s.num ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step > s.num ? 'bg-primary text-primary-foreground' :
                  step === s.num ? 'bg-primary/20 border-2 border-primary' :
                  'bg-muted'
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                </div>
                <span className="text-sm font-medium hidden sm:block">{s.label}</span>
              </div>
              {i < 2 && <div className={`w-12 h-0.5 mx-2 ${step > s.num ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4">
        {/* Step 1: Cart Review */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Review Your Cart</h2>
            
            {cart.map((item) => (
              <div key={item.listing_id} className="bg-card rounded-xl border p-4">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{item.title}</h3>
                    <p className="text-lg font-bold text-primary">${item.price.toLocaleString()}</p>
                    {item.is_digital && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Digital</span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => removeItem(item.listing_id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            {/* Customer Info */}
            <div className="bg-card rounded-xl border p-4 mt-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Contact Information
              </h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-muted-foreground">Full Name *</label>
                  <Input
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    placeholder="John Doe"
                    data-testid="customer-name"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground">Email Address *</label>
                  <Input
                    type="email"
                    value={customer.email}
                    onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                    placeholder="john@example.com"
                    data-testid="customer-email"
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground">Phone Number</label>
                  <Input
                    type="tel"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                    data-testid="customer-phone"
                  />
                </div>
              </div>
            </div>

            {/* Subtotal */}
            <div className="bg-muted/50 rounded-xl p-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>Subtotal ({cart.length} item{cart.length !== 1 ? 's' : ''})</span>
                <span>${subtotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Shipping */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Shipping Address</h2>
            
            {cart.every(item => item.is_digital) ? (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-primary font-medium">Digital items only - no shipping required!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You'll receive instant access after payment.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-card rounded-xl border p-4">
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-muted-foreground">Recipient Name</label>
                      <Input
                        value={shippingAddress.name}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-muted-foreground">Street Address *</label>
                      <Input
                        value={shippingAddress.street1}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, street1: e.target.value })}
                        placeholder="123 Main St"
                        data-testid="shipping-street"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-muted-foreground">Apt, Suite, etc.</label>
                      <Input
                        value={shippingAddress.street2}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, street2: e.target.value })}
                        placeholder="Apt 4B"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-muted-foreground">City *</label>
                        <Input
                          value={shippingAddress.city}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                          placeholder="New York"
                          data-testid="shipping-city"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">State *</label>
                        <Input
                          value={shippingAddress.state}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                          placeholder="NY"
                          maxLength={2}
                          data-testid="shipping-state"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm text-muted-foreground">ZIP Code *</label>
                        <Input
                          value={shippingAddress.zip}
                          onChange={(e) => setShippingAddress({ ...shippingAddress, zip: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                          placeholder="10001"
                          maxLength={5}
                          data-testid="shipping-zip"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-muted-foreground">Country</label>
                        <Input
                          value={shippingAddress.country}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shipping Options */}
                {shippingAddress.zip?.length === 5 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Select Shipping</h3>
                    
                    {cart.filter(item => !item.is_digital).map((item) => (
                      <div key={item.listing_id} className="bg-card rounded-xl border p-4">
                        <p className="font-medium text-sm mb-3">{item.title}</p>
                        
                        {loadingShipping[item.listing_id] ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Loading shipping options...</span>
                          </div>
                        ) : shippingRates[item.listing_id]?.rates?.length > 0 ? (
                          <div className="space-y-2">
                            {shippingRates[item.listing_id].rates.slice(0, 4).map((rate, idx) => (
                              <label
                                key={idx}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                                  selectedShipping[item.listing_id]?.rate_id === rate.rate_id
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="radio"
                                    name={`shipping-${item.listing_id}`}
                                    checked={selectedShipping[item.listing_id]?.rate_id === rate.rate_id}
                                    onChange={() => setSelectedShipping({ ...selectedShipping, [item.listing_id]: rate })}
                                    className="w-4 h-4"
                                  />
                                  <div>
                                    <p className="font-medium text-sm">{rate.carrier} {rate.service}</p>
                                    <p className="text-xs text-muted-foreground">{rate.estimated_days} day delivery</p>
                                  </div>
                                </div>
                                <span className="font-bold">${rate.amount.toFixed(2)}</span>
                              </label>
                            ))}
                          </div>
                        ) : shippingRates[item.listing_id]?.requires_seller_info ? (
                          <div className="p-3 bg-amber-500/10 rounded-lg">
                            <p className="text-sm text-amber-600">Contact seller for shipping</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Enter ZIP code to see shipping options</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Payment Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Review & Pay</h2>
            
            {/* Order Summary */}
            <div className="bg-card rounded-xl border p-4">
              <h3 className="font-semibold mb-3">Order Summary</h3>
              
              {cart.map((item) => (
                <div key={item.listing_id} className="flex justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm truncate flex-1">{item.title}</span>
                  <span className="font-medium">${(item.price * (item.quantity || 1)).toLocaleString()}</span>
                </div>
              ))}
              
              <div className="flex justify-between py-2 mt-2">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${subtotal.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Shipping</span>
                <span>{shippingTotal > 0 ? `$${shippingTotal.toFixed(2)}` : 'Free'}</span>
              </div>
              
              <div className="flex justify-between py-2 text-lg font-bold border-t border-border mt-2 pt-2">
                <span>Total</span>
                <span className="text-primary">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Shipping To */}
            {cart.some(item => !item.is_digital) && (
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-sm text-muted-foreground mb-1">Shipping to:</p>
                <p className="font-medium">{shippingAddress.name || customer.name}</p>
                <p className="text-sm">{shippingAddress.street1}</p>
                {shippingAddress.street2 && <p className="text-sm">{shippingAddress.street2}</p>}
                <p className="text-sm">{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}</p>
              </div>
            )}

            {/* Contact Info */}
            <div className="bg-muted/50 rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-1">Confirmation email to:</p>
              <p className="font-medium">{customer.email}</p>
            </div>

            {!user && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-sm">
                  <span className="font-medium text-primary">Guest Checkout</span> - Create an account after purchase to track your orders and earn rewards!
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 safe-bottom z-50">
        <div className="max-w-2xl mx-auto">
          {step === 1 && (
            <Button 
              className="w-full h-12 rounded-xl"
              onClick={handleProceedToShipping}
              data-testid="proceed-to-shipping"
            >
              Continue to Shipping
            </Button>
          )}
          
          {step === 2 && (
            <Button 
              className="w-full h-12 rounded-xl"
              onClick={handleProceedToPayment}
              disabled={!cart.every(item => item.is_digital) && !allShippingSelected}
              data-testid="proceed-to-payment"
            >
              Continue to Payment
            </Button>
          )}
          
          {step === 3 && (
            <Button 
              className="w-full h-12 rounded-xl"
              onClick={handleCheckout}
              disabled={submitting}
              data-testid="place-order"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</>
              ) : (
                <><CreditCard className="w-5 h-5 mr-2" /> Pay ${total.toFixed(2)}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
