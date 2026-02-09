/**
 * Public Page View Component
 * Displays a member's public page accessible via custom slug (e.g., blendlink.net/my-store)
 */
import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../../App";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { memberPagesApi } from "../../services/memberPagesApi";
import {
  Store, Utensils, Briefcase, Home, MapPin, Phone, Globe, Clock,
  Heart, Share2, Star, ShoppingCart, ChevronLeft, ExternalLink,
  Package, Search, Plus, Minus, Truck, Navigation, Copy
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Page type configurations
const PAGE_TYPES = {
  store: { icon: Store, label: "Store", color: "from-blue-500 to-indigo-600" },
  restaurant: { icon: Utensils, label: "Restaurant", color: "from-orange-500 to-red-500" },
  services: { icon: Briefcase, label: "Services", color: "from-purple-500 to-pink-500" },
  rental: { icon: Home, label: "Rentals", color: "from-green-500 to-teal-500" },
  general: { icon: Store, label: "Page", color: "from-cyan-500 to-blue-500" }
};

export default function PublicPageView() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const [page, setPage] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Track referral if present
  const refCode = searchParams.get('ref');

  useEffect(() => {
    loadPage();
    if (refCode) {
      trackReferralClick();
    }
  }, [slug]);

  const loadPage = async () => {
    try {
      const res = await fetch(`${API_URL}/api/member-pages/public/${slug}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Page not found");
          navigate("/pages");
          return;
        }
        throw new Error("Failed to load page");
      }
      const data = await res.json();
      setPage(data.page);
      setItems(data.items || []);
      setIsFollowing(data.is_following || false);
    } catch (err) {
      console.error("Failed to load public page:", err);
      toast.error("Failed to load page");
    }
    setLoading(false);
  };

  const trackReferralClick = async () => {
    try {
      await fetch(`${API_URL}/api/page-referrals/track-click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referral_code: refCode, page_slug: slug })
      });
    } catch (err) {
      console.error("Failed to track referral click:", err);
    }
  };

  const handleFollow = async () => {
    if (!user) {
      toast.error("Please login to follow this page");
      navigate("/login");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/member-pages/${page.page_id}/subscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to follow");
      setIsFollowing(true);
      toast.success("Following! +10 BL Coins");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUnfollow = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/member-pages/${page.page_id}/unsubscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to unfollow");
      setIsFollowing(false);
      toast.success("Unfollowed");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const addToCart = (item) => {
    const itemId = item.product_id || item.item_id || item.service_id || item.rental_id;
    setCart(prev => {
      const existing = prev.find(i => i.item_id === itemId);
      if (existing) {
        return prev.map(i => i.item_id === itemId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { 
        item_id: itemId, 
        name: item.name, 
        price: item.price || item.daily_rate || 0, 
        quantity: 1,
        image: item.images?.[0]
      }];
    });
    toast.success(`Added ${item.name} to cart`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: page.name,
          text: page.description || `Check out ${page.name} on BlendLink!`,
          url: url
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0F5FF] via-white to-[#F0F8FF] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-200 border-t-cyan-500 animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading page...</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return null;
  }

  const type = PAGE_TYPES[page.page_type] || PAGE_TYPES.general;
  const TypeIcon = type.icon;
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const filteredItems = items.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F5FF] via-white to-[#F0F8FF] pb-24" style={{ touchAction: 'pan-y' }}>
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-white/50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 hover:bg-white/80 rounded-xl transition-all"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{page.name}</h1>
          </div>

          <button
            onClick={handleShare}
            className="p-2 hover:bg-white/80 rounded-xl transition-all"
          >
            <Share2 className="w-5 h-5 text-gray-600" />
          </button>

          {cart.length > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="relative p-2 bg-cyan-100 hover:bg-cyan-200 rounded-xl transition-all"
            >
              <ShoppingCart className="w-5 h-5 text-cyan-600" />
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {cart.reduce((sum, i) => sum + i.quantity, 0)}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Cover Image & Page Info */}
      <div className={`h-40 bg-gradient-to-br ${type.color} relative`}>
        {page.cover_image && (
          <img src={page.cover_image} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      {/* Page Info Card */}
      <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-10">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-5 shadow-xl border border-white/50">
          <div className="flex items-start gap-4">
            {/* Logo/Icon */}
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${type.color} flex items-center justify-center shadow-lg -mt-12 border-4 border-white overflow-hidden`}>
              {page.logo_image ? (
                <img src={page.logo_image} alt="" className="w-full h-full object-cover" />
              ) : (
                <TypeIcon className="w-10 h-10 text-white" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-2">
              <h2 className="text-xl font-bold text-gray-900">{page.name}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <span className="capitalize">{page.page_type}</span>
                <span>•</span>
                <span>{page.subscriber_count || 0} followers</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {page.description && (
            <p className="text-gray-600 mt-4">{page.description}</p>
          )}

          {/* Contact Info */}
          <div className="flex flex-wrap gap-3 mt-4">
            {page.phone && (
              <a href={`tel:${page.phone}`} className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-cyan-600">
                <Phone className="w-4 h-4" /> {page.phone}
              </a>
            )}
            {page.website && (
              <a href={page.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-cyan-600">
                <Globe className="w-4 h-4" /> Website
              </a>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-5">
            {isFollowing ? (
              <Button
                onClick={handleUnfollow}
                variant="outline"
                className="flex-1 h-11 rounded-xl border-gray-200"
              >
                <Heart className="w-4 h-4 mr-2 fill-red-500 text-red-500" /> Following
              </Button>
            ) : (
              <Button
                onClick={handleFollow}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
              >
                <Heart className="w-4 h-4 mr-2" /> Follow
              </Button>
            )}
            <Button
              onClick={handleShare}
              variant="outline"
              className="h-11 rounded-xl border-gray-200 px-4"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">
            {page.page_type === 'restaurant' ? 'Menu' : 
             page.page_type === 'services' ? 'Services' : 
             page.page_type === 'rental' ? 'Rentals' : 'Products'}
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-40 rounded-xl border-gray-200 text-sm"
            />
          </div>
        </div>

        {/* Items Grid */}
        {filteredItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" style={{ touchAction: 'pan-y' }}>
            {filteredItems.map((item) => {
              const itemId = item.product_id || item.item_id || item.service_id || item.rental_id;
              return (
                <div 
                  key={itemId}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 flex items-center justify-center">
                    {item.images?.[0] ? (
                      <img src={item.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-10 h-10 text-gray-300" />
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="font-medium text-gray-800 truncate">{item.name}</h4>
                    <p className="text-cyan-600 font-bold mt-1">
                      ${(item.price || item.daily_rate || 0).toFixed(2)}
                      {item.daily_rate && <span className="text-xs text-gray-400">/day</span>}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => addToCart(item)}
                      className="w-full mt-2 h-9 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm"
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No items available yet</p>
          </div>
        )}
      </div>

      {/* Locations Section */}
      {page.locations?.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Locations</h3>
          <div className="space-y-3">
            {page.locations.map((loc, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-800">{loc.name || `Location ${i + 1}`}</h4>
                    <p className="text-sm text-gray-500 mt-1">{loc.address}</p>
                    {loc.hours && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" /> {loc.hours}
                      </p>
                    )}
                  </div>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(loc.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-cyan-100 hover:bg-cyan-200 rounded-xl transition-colors"
                  >
                    <Navigation className="w-5 h-5 text-cyan-600" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowCart(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Your Cart ({cart.length})</h3>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <ChevronLeft className="w-5 h-5 rotate-90" />
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-center py-8 text-gray-500">Cart is empty</p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {cart.map(item => (
                    <div key={item.item_id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-14 h-14 rounded-lg bg-gray-200 overflow-hidden">
                        {item.image && <img src={item.image} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-500">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            if (item.quantity === 1) {
                              setCart(prev => prev.filter(i => i.item_id !== item.item_id));
                            } else {
                              setCart(prev => prev.map(i => 
                                i.item_id === item.item_id ? {...i, quantity: i.quantity - 1} : i
                              ));
                            }
                          }}
                          className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-6 text-center font-bold">{item.quantity}</span>
                        <button 
                          onClick={() => setCart(prev => prev.map(i => 
                            i.item_id === item.item_id ? {...i, quantity: i.quantity + 1} : i
                          ))}
                          className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-lg font-bold mb-4">
                    <span>Total</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                  <Button
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold"
                    onClick={() => {
                      toast.success("Checkout coming soon!");
                    }}
                  >
                    Checkout ${cartTotal.toFixed(2)}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
