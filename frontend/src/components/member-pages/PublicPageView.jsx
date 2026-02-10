/**
 * Public Page View Component
 * Displays a member's public page accessible via custom slug (e.g., blendlink.net/my-store)
 * Customer-facing view with products, reviews, Google Maps, and referral code
 * NO management UI shown to customers - only shown to owner/authorized users
 */
import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { AuthContext } from "../../App";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { toast } from "sonner";
import { memberPagesApi, safeFetch } from "../../services/memberPagesApi";
import PageCheckout from "./PageCheckout";
import {
  Store, Utensils, Briefcase, Home, MapPin, Phone, Globe, Clock,
  Heart, Share2, Star, ShoppingCart, ChevronLeft, ExternalLink,
  Package, Search, Plus, Minus, Truck, Navigation, Copy, Mail,
  Settings, Users, MessageSquare, StarHalf, ChevronRight, Zap
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

// Star Rating Component
const StarRating = ({ rating, count, size = "sm" }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  const starSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  
  return (
    <div className="flex items-center gap-1">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} className={`${starSize} fill-yellow-400 text-yellow-400`} />
      ))}
      {hasHalfStar && <StarHalf className={`${starSize} fill-yellow-400 text-yellow-400`} />}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className={`${starSize} text-gray-300`} />
      ))}
      {count !== undefined && (
        <span className="text-sm text-gray-500 ml-1">({count})</span>
      )}
    </div>
  );
};

// Google Maps Embed Component (no API key required)
const GoogleMapsEmbed = ({ address, name }) => {
  const encodedAddress = encodeURIComponent(`${name} ${address}`);
  const mapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodedAddress}`;
  const fallbackUrl = `https://maps.google.com/maps?q=${encodedAddress}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  
  return (
    <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-100">
      <iframe
        title={`Map of ${name}`}
        src={fallbackUrl}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen=""
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
};

export default function PublicPageView() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);
  const user = authContext?.user || null;
  
  const [page, setPage] = useState(null);
  const [items, setItems] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [ownerReferralCode, setOwnerReferralCode] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Track referral if present
  const refCode = searchParams.get('ref');

  useEffect(() => {
    loadPage();
    if (refCode) {
      trackReferralClick();
    }
  }, [slug]);

  // Check if current user can manage this page
  useEffect(() => {
    if (user && page) {
      checkAuthorization();
    }
  }, [user, page]);

  const loadPage = async () => {
    try {
      const data = await memberPagesApi.getPublicPage(slug);
      setPage(data.page);
      setItems(data.items || []);
      setReviews(data.reviews || []);
      setOwnerReferralCode(data.owner_referral_code);
      setIsFollowing(data.is_following || false);
      setNotFound(false);
    } catch (err) {
      console.error("Failed to load public page:", err);
      if (err.message?.includes("not found") || err.message?.includes("404")) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      toast.error("Failed to load page");
    }
    setLoading(false);
  };

  const checkAuthorization = async () => {
    if (!user || !page) return;
    try {
      const token = localStorage.getItem('blendlink_token');
      if (!token) return;
      
      const data = await safeFetch(`${API_URL}/api/member-pages/${page.page_id}/authorization`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCanManage(data.can_manage || false);
    } catch (err) {
      setCanManage(false);
    }
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
      await memberPagesApi.followPage(page.page_id);
      setIsFollowing(true);
      toast.success("Following! +10 BL Coins");
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUnfollow = async () => {
    try {
      await memberPagesApi.unfollowPage(page.page_id);
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

  const copyReferralLink = () => {
    if (ownerReferralCode) {
      const referralUrl = `${window.location.origin}/register?ref=${ownerReferralCode}`;
      navigator.clipboard.writeText(referralUrl);
      toast.success("Referral link copied!");
    }
  };

  const goToReferralSignup = () => {
    if (ownerReferralCode) {
      navigate(`/register?ref=${ownerReferralCode}`);
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

  // Page not found - redirect to home or show 404
  if (notFound || !page) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F0F5FF] via-white to-[#F0F8FF] flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Store className="w-10 h-10 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-500 mb-6">
            The page you're looking for doesn't exist or may have been removed.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  const type = PAGE_TYPES[page.page_type] || PAGE_TYPES.general;
  const TypeIcon = type.icon;
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const filteredItems = items.filter(item => 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const currencySymbol = page.currency_symbol || "$";
  const primaryLocation = page.locations?.find(l => l.is_primary) || page.locations?.[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F5FF] via-white to-[#F0F8FF] pb-24" style={{ touchAction: 'pan-y' }}>
      {/* Checkout Modal */}
      {showCheckout && (
        <PageCheckout
          pageId={page.page_id}
          pageName={page.name}
          cart={cart}
          currencySymbol={currencySymbol}
          onUpdateCart={setCart}
          onClose={() => setShowCheckout(false)}
          pageLocations={page.locations || []}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-white/50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 hover:bg-white/80 rounded-xl transition-all"
            data-testid="back-button"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 truncate">{page.name}</h1>
          </div>

          {/* Manage Button - Only visible to owner/authorized users */}
          {canManage && (
            <Button
              onClick={() => navigate(`/pages?manage=${page.page_id}`)}
              size="sm"
              className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl"
              data-testid="manage-button"
            >
              <Settings className="w-4 h-4 mr-1" /> Manage
            </Button>
          )}

          <button
            onClick={handleShare}
            className="p-2 hover:bg-white/80 rounded-xl transition-all"
            data-testid="share-button"
          >
            <Share2 className="w-5 h-5 text-gray-600" />
          </button>

          {cart.length > 0 && (
            <button
              onClick={() => setShowCart(true)}
              className="relative p-2 bg-cyan-100 hover:bg-cyan-200 rounded-xl transition-all"
              data-testid="cart-button"
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
                {page.rating_count > 0 && (
                  <>
                    <span>•</span>
                    <StarRating rating={page.rating_average} count={page.rating_count} />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {page.description && (
            <p className="text-gray-600 mt-4">{page.description}</p>
          )}

          {/* Contact Info - Public Display */}
          <div className="flex flex-wrap gap-4 mt-4">
            {page.phone && (
              <a 
                href={`tel:${page.phone}`} 
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-cyan-600 bg-gray-50 px-3 py-2 rounded-xl"
                data-testid="phone-link"
              >
                <Phone className="w-4 h-4" /> {page.phone}
              </a>
            )}
            {page.email && (
              <a 
                href={`mailto:${page.email}`} 
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-cyan-600 bg-gray-50 px-3 py-2 rounded-xl"
                data-testid="email-link"
              >
                <Mail className="w-4 h-4" /> {page.email}
              </a>
            )}
            {page.website && (
              <a 
                href={page.website} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-cyan-600 bg-gray-50 px-3 py-2 rounded-xl"
                data-testid="website-link"
              >
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
                data-testid="unfollow-button"
              >
                <Heart className="w-4 h-4 mr-2 fill-red-500 text-red-500" /> Following
              </Button>
            ) : (
              <Button
                onClick={handleFollow}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                data-testid="follow-button"
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

      {/* Referral Code Section - Links to OWNER's Blendlink account */}
      {ownerReferralCode && page.settings?.show_referral_link !== false && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800">Join BlendLink with this referral</p>
                <p className="text-lg font-bold text-amber-900 mt-1">
                  Code: <span className="font-mono">{ownerReferralCode}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={copyReferralLink}
                  variant="outline"
                  size="sm"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100 rounded-xl"
                  data-testid="copy-referral-button"
                >
                  <Copy className="w-4 h-4 mr-1" /> Copy
                </Button>
                <Button
                  onClick={goToReferralSignup}
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl"
                  data-testid="signup-referral-button"
                >
                  Sign Up <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              data-testid="search-items-input"
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
                  data-testid={`item-card-${itemId}`}
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
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                    )}
                    {item.rating_average > 0 && (
                      <div className="mt-1">
                        <StarRating rating={item.rating_average} count={item.rating_count} />
                      </div>
                    )}
                    <p className="text-cyan-600 font-bold mt-2">
                      {currencySymbol}{(item.price || item.daily_rate || 0).toFixed(2)}
                      {item.daily_rate && <span className="text-xs text-gray-400">/day</span>}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        onClick={() => addToCart(item)}
                        className="flex-1 h-9 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm"
                        data-testid={`add-to-cart-${itemId}`}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          // Add to cart and open checkout
                          addToCart(item);
                          setTimeout(() => setShowCheckout(true), 100);
                        }}
                        variant="outline"
                        className="h-9 px-3 rounded-xl border-green-300 text-green-600 hover:bg-green-50 text-sm"
                        data-testid={`buy-now-${itemId}`}
                      >
                        <Zap className="w-4 h-4" />
                      </Button>
                    </div>
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

      {/* Reviews Section */}
      {reviews.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-cyan-600" />
            Reviews ({reviews.length})
          </h3>
          <div className="space-y-4">
            {reviews.map((review, i) => (
              <div key={review.review_id || i} className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-bold">
                    {(review.reviewer_name || "A").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-800">{review.reviewer_name || "Anonymous"}</p>
                      <StarRating rating={review.rating} />
                    </div>
                    {review.title && (
                      <p className="font-medium text-gray-700 mt-1">{review.title}</p>
                    )}
                    <p className="text-gray-600 text-sm mt-2">{review.content}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(review.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locations Section with Google Maps */}
      {page.locations?.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 mt-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-600" />
            Locations
          </h3>
          <div className="space-y-4">
            {page.locations.map((loc, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Google Maps Embed */}
                <GoogleMapsEmbed 
                  address={`${loc.address}, ${loc.city}, ${loc.state || ''} ${loc.country}`}
                  name={loc.name || page.name}
                />
                
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800">{loc.name || `Location ${i + 1}`}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {loc.address}, {loc.city}, {loc.state || ''} {loc.country}
                      </p>
                      {loc.phone && (
                        <a href={`tel:${loc.phone}`} className="text-sm text-cyan-600 flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3" /> {loc.phone}
                        </a>
                      )}
                      {loc.operating_hours && Object.keys(loc.operating_hours).length > 0 && (
                        <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" /> 
                          {Object.entries(loc.operating_hours).slice(0, 2).map(([day, hours]) => (
                            <span key={day}>{day}: {hours.open}-{hours.close}</span>
                          )).join(', ')}
                        </div>
                      )}
                    </div>
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(`${loc.address}, ${loc.city}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-cyan-100 hover:bg-cyan-200 rounded-xl transition-colors"
                      data-testid={`directions-${i}`}
                    >
                      <Navigation className="w-5 h-5 text-cyan-600" />
                    </a>
                  </div>
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
                        <p className="text-sm text-gray-500">{currencySymbol}{item.price.toFixed(2)}</p>
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
                    <span>{currencySymbol}{cartTotal.toFixed(2)}</span>
                  </div>
                  <Button
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold"
                    onClick={() => {
                      setShowCart(false);
                      setShowCheckout(true);
                    }}
                    data-testid="checkout-button"
                  >
                    <Zap className="w-5 h-5 mr-2" /> Checkout {currencySymbol}{cartTotal.toFixed(2)}
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
