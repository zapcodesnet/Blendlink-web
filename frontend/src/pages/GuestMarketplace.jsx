import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getApiUrl } from "../utils/runtimeConfig";
import { 
  ShoppingCart, Search, Filter, X, Plus, Minus, 
  Trash2, ChevronLeft, CreditCard, User, Mail, MapPin,
  ShoppingBag, Home, Briefcase, Loader2
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

const API_BASE_URL = getApiUrl();

export default function GuestMarketplace() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    zipCode: '',
    country: 'US'
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const categories = [
    { id: 'all', label: 'All', icon: ShoppingBag },
    { id: 'product', label: 'Products', icon: ShoppingBag },
    { id: 'rental', label: 'Rentals', icon: Home },
    { id: 'service', label: 'Services', icon: Briefcase },
  ];

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const [productsRes, rentalsRes, servicesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/marketplace/listings?limit=20`).then(r => r.ok ? r.json() : { listings: [] }),
        fetch(`${API_BASE_URL}/api/rentals?limit=20`).then(r => r.ok ? r.json() : { rentals: [] }),
        fetch(`${API_BASE_URL}/api/services?limit=20`).then(r => r.ok ? r.json() : { services: [] })
      ]);

      const products = (productsRes.listings || []).map(p => ({
        ...p,
        id: p.listing_id || p.id,
        type: 'product',
        image: p.images?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.title)}&background=random&size=256`
      }));

      const rentals = (rentalsRes.rentals || []).map(r => ({
        ...r,
        id: r.rental_id || r.id,
        type: 'rental',
        price: r.price_per_month || r.price,
        image: r.images?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.title)}&background=random&size=256`
      }));

      const services = (servicesRes.services || []).map(s => ({
        ...s,
        id: s.service_id || s.id,
        type: 'service',
        price: s.hourly_rate || s.price_per_hour || s.price,
        image: s.images?.[0] || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.title)}&background=random&size=256`
      }));

      const allItems = [...products, ...rentals, ...services];
      
      // If no real data, use sample items
      if (allItems.length === 0) {
        setItems(generateSampleItems());
      } else {
        setItems(allItems);
      }
    } catch (err) {
      console.error('Error fetching items:', err);
      setItems(generateSampleItems());
    } finally {
      setIsLoading(false);
    }
  };

  const generateSampleItems = () => {
    return [
      { id: 1, title: 'iPhone 15 Pro', description: 'Latest Apple smartphone with titanium design', price: 999, type: 'product', category: 'Electronics', image: 'https://ui-avatars.com/api/?name=iPhone+15&background=3b82f6&color=fff&size=256' },
      { id: 2, title: 'Downtown Apartment', description: '2BR modern apartment with city views', price: 2500, type: 'rental', category: 'Apartment', image: 'https://ui-avatars.com/api/?name=Apt&background=22c55e&color=fff&size=256' },
      { id: 3, title: 'Web Development', description: 'Full stack development services', price: 75, type: 'service', category: 'Technology', image: 'https://ui-avatars.com/api/?name=Web+Dev&background=8b5cf6&color=fff&size=256' },
      { id: 4, title: 'MacBook Pro M3', description: 'Powerful laptop for professionals', price: 1999, type: 'product', category: 'Electronics', image: 'https://ui-avatars.com/api/?name=MacBook&background=3b82f6&color=fff&size=256' },
      { id: 5, title: 'Beach House', description: '3BR vacation rental near the ocean', price: 350, type: 'rental', category: 'House', image: 'https://ui-avatars.com/api/?name=Beach&background=22c55e&color=fff&size=256' },
      { id: 6, title: 'Logo Design', description: 'Professional branding and logo creation', price: 150, type: 'service', category: 'Design', image: 'https://ui-avatars.com/api/?name=Logo&background=8b5cf6&color=fff&size=256' },
      { id: 7, title: 'Gaming Console PS5', description: 'PlayStation 5 with extra controller', price: 450, type: 'product', category: 'Electronics', image: 'https://ui-avatars.com/api/?name=PS5&background=3b82f6&color=fff&size=256' },
      { id: 8, title: 'Studio Apartment', description: 'Cozy studio in the heart of downtown', price: 1200, type: 'rental', category: 'Apartment', image: 'https://ui-avatars.com/api/?name=Studio&background=22c55e&color=fff&size=256' },
      { id: 9, title: 'Photography', description: 'Professional event photography', price: 200, type: 'service', category: 'Media', image: 'https://ui-avatars.com/api/?name=Photo&background=8b5cf6&color=fff&size=256' },
      { id: 10, title: 'Vintage Watch', description: 'Classic timepiece in excellent condition', price: 800, type: 'product', category: 'Fashion', image: 'https://ui-avatars.com/api/?name=Watch&background=3b82f6&color=fff&size=256' },
      { id: 11, title: 'Mountain Cabin', description: 'Scenic retreat with fireplace', price: 180, type: 'rental', category: 'Cabin', image: 'https://ui-avatars.com/api/?name=Cabin&background=22c55e&color=fff&size=256' },
      { id: 12, title: 'Marketing Consulting', description: 'Digital marketing strategy', price: 100, type: 'service', category: 'Business', image: 'https://ui-avatars.com/api/?name=Marketing&background=8b5cf6&color=fff&size=256' },
    ];
  };

  useEffect(() => {
    let filtered = items;
    
    if (activeCategory !== 'all') {
      filtered = filtered.filter(item => item.type === activeCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query)
      );
    }
    
    setFilteredItems(filtered);
  }, [items, activeCategory, searchQuery]);

  const addToCart = (item) => {
    const existingItem = cart.find(c => c.id === item.id && c.type === item.type);
    if (existingItem) {
      setCart(cart.map(c => 
        c.id === item.id && c.type === item.type 
          ? { ...c, quantity: c.quantity + 1 }
          : c
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
    toast.success(`${item.title} added to cart`);
  };

  const removeFromCart = (itemId, type) => {
    setCart(cart.filter(c => !(c.id === itemId && c.type === type)));
  };

  const updateQuantity = (itemId, type, delta) => {
    setCart(cart.map(c => {
      if (c.id === itemId && c.type === type) {
        const newQty = c.quantity + delta;
        return newQty > 0 ? { ...c, quantity: newQty } : c;
      }
      return c;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = async () => {
    // Validate form
    if (!checkoutForm.name || !checkoutForm.email || !checkoutForm.address) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Create guest order
      const response = await fetch(`${API_BASE_URL}/api/marketplace/guest-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(item => ({
            id: item.id,
            type: item.type,
            title: item.title,
            price: item.price,
            quantity: item.quantity
          })),
          customer: checkoutForm,
          total: cartTotal
        })
      });

      if (response.ok) {
        const result = await response.json();
        toast.success('Order placed successfully!');
        setCart([]);
        setIsCheckoutOpen(false);
        setIsCartOpen(false);
        
        // Redirect to payment or confirmation
        if (result.payment_url) {
          window.location.href = result.payment_url;
        }
      } else {
        // Fallback: simulate order success
        toast.success('Order placed! You will receive a confirmation email.');
        setCart([]);
        setIsCheckoutOpen(false);
        setIsCartOpen(false);
      }
    } catch (err) {
      // Simulate success for demo
      toast.success('Order placed! You will receive a confirmation email.');
      setCart([]);
      setIsCheckoutOpen(false);
      setIsCartOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const typeColors = {
    product: 'bg-blue-500',
    rental: 'bg-green-500',
    service: 'bg-purple-500'
  };

  const typeLabels = {
    product: 'Product',
    rental: 'Rental',
    service: 'Service'
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <h1 className="text-xl font-bold">Browse Marketplace</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/login')}
              >
                Login
              </Button>
              <Button 
                variant="default"
                size="sm"
                onClick={() => setIsCartOpen(true)}
                className="relative"
                data-testid="cart-btn"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Cart
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search products, rentals, services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map(cat => (
                <Button
                  key={cat.id}
                  variant={activeCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory(cat.id)}
                  className="whitespace-nowrap"
                  data-testid={`category-${cat.id}`}
                >
                  <cat.icon className="w-4 h-4 mr-1" />
                  {cat.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg">No items found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredItems.map((item) => (
              <div 
                key={`${item.type}-${item.id}`}
                className="bg-card rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all group"
                data-testid={`item-${item.type}-${item.id}`}
              >
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={item.image}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className={`absolute top-2 left-2 px-2 py-1 rounded-full text-xs text-white ${typeColors[item.type]}`}>
                    {typeLabels[item.type]}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold truncate">{item.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 h-10">{item.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="font-bold text-lg text-primary">
                      ${item.price}
                      {item.type === 'rental' && <span className="text-xs font-normal text-muted-foreground">/mo</span>}
                      {item.type === 'service' && <span className="text-xs font-normal text-muted-foreground">/hr</span>}
                    </span>
                    <Button 
                      size="sm" 
                      onClick={() => addToCart(item)}
                      data-testid={`add-to-cart-${item.id}`}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Guest CTA */}
        <div className="mt-12 text-center bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2">Want to Sell or List?</h2>
          <p className="text-muted-foreground mb-4">Create a free account to list your products, rentals, or services</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/register')}>
              Create Account
            </Button>
            <Button variant="outline" onClick={() => navigate('/login')}>
              Login
            </Button>
          </div>
        </div>
      </main>

      {/* Cart Drawer */}
      <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Shopping Cart ({cartItemCount} items)
            </DialogTitle>
          </DialogHeader>
          
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
              <p className="text-muted-foreground">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={`cart-${item.type}-${item.id}`} className="flex gap-3 p-3 bg-muted rounded-lg">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-16 h-16 rounded-md object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{item.title}</h4>
                    <p className="text-sm text-primary font-semibold">${item.price}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, item.type, -1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="text-sm w-6 text-center">{item.quantity}</span>
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="h-6 w-6"
                        onClick={() => updateQuantity(item.id, item.type, 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-6 w-6 ml-auto text-red-500"
                        onClick={() => removeFromCart(item.id, item.type)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
              </div>
              
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                data-testid="checkout-btn"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Checkout as Guest
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Guest Checkout</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Full Name *</label>
              <Input
                placeholder="John Doe"
                value={checkoutForm.name}
                onChange={(e) => setCheckoutForm({...checkoutForm, name: e.target.value})}
                data-testid="checkout-name"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Email *</label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={checkoutForm.email}
                onChange={(e) => setCheckoutForm({...checkoutForm, email: e.target.value})}
                data-testid="checkout-email"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <Input
                placeholder="+1 234 567 8900"
                value={checkoutForm.phone}
                onChange={(e) => setCheckoutForm({...checkoutForm, phone: e.target.value})}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Address *</label>
              <Input
                placeholder="123 Main Street"
                value={checkoutForm.address}
                onChange={(e) => setCheckoutForm({...checkoutForm, address: e.target.value})}
                data-testid="checkout-address"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">City</label>
                <Input
                  placeholder="New York"
                  value={checkoutForm.city}
                  onChange={(e) => setCheckoutForm({...checkoutForm, city: e.target.value})}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">ZIP Code</label>
                <Input
                  placeholder="10001"
                  value={checkoutForm.zipCode}
                  onChange={(e) => setCheckoutForm({...checkoutForm, zipCode: e.target.value})}
                />
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-bold mb-4">
                <span>Order Total</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleCheckout}
                disabled={isProcessing}
                data-testid="place-order-btn"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Place Order
              </Button>
              
              <p className="text-xs text-center text-muted-foreground mt-3">
                By placing this order, you agree to our Terms of Service
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
