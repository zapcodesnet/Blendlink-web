import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { useTranslation } from "react-i18next";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import ComingSoonPlaceholder from "../components/ComingSoonPlaceholder";
import CartIcon from "../components/CartIcon";
import BottomNav from "../components/BottomNav";
import BackToGroupFAB from "../components/BackToGroupFAB";
import { toast } from "sonner";
import { 
  Search, Plus, Filter, Smartphone, Shirt, Home, Car, 
  Dumbbell, Download, Wrench, Package, ChevronRight, ShoppingBag,
  Sparkles, Store, Watch, Palette, Heart, Gamepad2, Building2,
  PawPrint, Baby, Gift, Ticket, ThumbsUp, Share2, ShoppingCart,
  CreditCard, Loader2, ArrowLeft
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

const categoryIcons = {
  electronics: Smartphone,
  fashion: Shirt,
  home: Home,
  vehicles: Car,
  sports: Dumbbell,
  digital: Download,
  services: Wrench,
  jewelry: Watch,
  collectibles: Palette,
  health: Heart,
  toys: Gamepad2,
  business: Building2,
  pets: PawPrint,
  baby: Baby,
  giftcards: Gift,
  tickets: Ticket,
  general: Package,
  other: Package
};

// Social interaction component for listings
const ListingSocialActions = ({ listing, user, onLike }) => {
  const [likes, setLikes] = useState(listing.likes_count || 0);
  const [isLiked, setIsLiked] = useState(listing.user_has_liked || false);
  const [isLiking, setIsLiking] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const handleLike = async (e) => {
    e.stopPropagation(); // Prevent navigation to listing detail
    
    if (!user) {
      toast.info("Sign up to like this listing!", {
        action: {
          label: "Sign Up",
          onClick: () => window.location.href = "/register"
        }
      });
      return;
    }
    
    setIsLiking(true);
    try {
      const response = await api.post(`/marketplace/listings/${listing.listing_id}/like`);
      setIsLiked(response.data?.liked ?? !isLiked);
      setLikes(prev => response.data?.liked ? prev + 1 : prev - 1);
      if (onLike) onLike(listing.listing_id, response.data?.liked);
    } catch (err) {
      // Toggle locally if API doesn't exist yet
      setIsLiked(!isLiked);
      setLikes(prev => !isLiked ? prev + 1 : prev - 1);
    } finally {
      setIsLiking(false);
    }
  };

  const handleShare = (e) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/marketplace/${listing.listing_id}`;
    
    if (navigator.share) {
      navigator.share({
        title: listing.title,
        text: `Check out ${listing.title} for $${listing.price?.toLocaleString()}!`,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    }
  };

  const handleAddToCart = async (e) => {
    e.stopPropagation(); // Prevent navigation to listing detail
    
    setAddingToCart(true);
    try {
      // Store in localStorage for cart functionality
      const cart = JSON.parse(localStorage.getItem('blendlink_cart') || '[]');
      const existingIndex = cart.findIndex(item => item.listing_id === listing.listing_id);
      
      if (existingIndex >= 0) {
        cart[existingIndex].quantity += 1;
      } else {
        cart.push({
          listing_id: listing.listing_id,
          title: listing.title,
          price: listing.price,
          image: listing.images?.[0] || null,
          seller: listing.seller,
          quantity: 1,
          is_digital: listing.is_digital || false
        });
      }
      
      localStorage.setItem('blendlink_cart', JSON.stringify(cart));
      window.dispatchEvent(new Event('cart-updated'));
      
      toast.success("Added to cart!", {
        action: { 
          label: "View Cart", 
          onClick: () => window.location.href = "/checkout" 
        }
      });
    } catch (err) {
      toast.error("Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pt-2 border-t border-border/50 mt-2">
        <button
          onClick={handleLike}
          disabled={isLiking}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
            isLiked 
              ? "bg-primary/10 text-primary" 
              : "bg-muted hover:bg-muted/80 text-muted-foreground"
          }`}
          data-testid={`like-btn-${listing.listing_id}`}
        >
          <ThumbsUp className={`w-3 h-3 ${isLiked ? "fill-current" : ""}`} />
          <span>{likes}</span>
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
          data-testid={`share-btn-${listing.listing_id}`}
        >
          <Share2 className="w-3 h-3" />
          <span>Share</span>
        </button>
      </div>
      <button
        onClick={handleAddToCart}
        disabled={addingToCart}
        className="w-full flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        data-testid={`add-to-cart-btn-${listing.listing_id}`}
      >
        {addingToCart ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <>
            <ShoppingCart className="w-3 h-3" />
            <span>Add to Cart</span>
          </>
        )}
      </button>
    </div>
  );
};

export default function Marketplace() {
  const { t } = useTranslation();
  const authContext = useContext(AuthContext);
  const user = authContext?.user; // Null-safe for guests
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sortBy, setSortBy] = useState("newest"); // Add sorting state
  
  // Check if user is logged in (for nav display when outside ProtectedRoute)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  useEffect(() => {
    // Check localStorage for auth token
    const token = localStorage.getItem('blendlink_token');
    setIsLoggedIn(!!token);
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchListings();
  }, [selectedCategory, search, sortBy]);

  const fetchCategories = async () => {
    try {
      // Use fetch for public access (no auth needed)
      const response = await fetch(`${API_BASE_URL}/api/marketplace/categories`);
      if (response.ok) {
        const cats = await response.json();
        setCategories(cats);
      }
    } catch (error) {
      console.error("Categories error:", error);
    }
  };

  const fetchListings = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (search) params.append('search', search);
      if (sortBy) params.append('sort', sortBy);
      
      // Use fetch for public access (no auth needed)
      const response = await fetch(`${API_BASE_URL}/api/marketplace/listings?${params}`);
      if (response.ok) {
        let data = await response.json();
        
        // Client-side sorting if needed
        if (sortBy === 'price_low') {
          data = data.sort((a, b) => (a.price || 0) - (b.price || 0));
        } else if (sortBy === 'price_high') {
          data = data.sort((a, b) => (b.price || 0) - (a.price || 0));
        }
        
        setListings(Array.isArray(data) ? data : []);
      } else {
        setListings([]);
      }
    } catch (error) {
      console.error("Listings error:", error);
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="marketplace-scroll-container"
      data-testid="marketplace-page"
    >
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate(-1)}
                data-testid="marketplace-back-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-bold">{t('marketplace.title')}</h1>
            </div>
            <div className="flex items-center gap-2">
              <CartIcon />
              {user ? (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => navigate("/seller-dashboard")}
                    className="rounded-full"
                    data-testid="seller-tools-btn"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">AI Seller Tools</span>
                    <span className="sm:hidden">AI Tools</span>
                  </Button>
                  <Button 
                    onClick={() => navigate("/marketplace/create")}
                    className="rounded-full"
                    data-testid="create-listing-btn"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Sell
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={() => navigate("/register")}
                  className="rounded-full"
                  data-testid="signup-to-sell-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Sign Up to Sell
                </Button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                className="pl-10 h-11 rounded-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="search-input"
              />
            </div>
            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-11 px-3 rounded-full border border-input bg-background text-sm min-w-[140px]"
              data-testid="sort-dropdown"
            >
              <option value="newest">Newest</option>
              <option value="price_low">Price: Low to High</option>
              <option value="price_high">Price: High to Low</option>
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* Categories */}
        <div className="mb-6">
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                !selectedCategory 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80"
              }`}
              data-testid="category-all"
            >
              All
            </button>
            {categories.map((cat) => {
              const Icon = categoryIcons[cat.id] || Package;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80"
                  }`}
                  data-testid={`category-${cat.id}`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl overflow-hidden">
                <div className="aspect-square skeleton" />
                <div className="p-3 space-y-2">
                  <div className="h-4 skeleton rounded" />
                  <div className="h-4 w-1/2 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <ComingSoonPlaceholder
            icon={ShoppingBag}
            title="Marketplace Coming Soon"
            description="Buy and sell items on the marketplace"
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((listing) => (
              <div
                key={listing.listing_id}
                className="bg-card rounded-xl overflow-hidden card-hover border border-border/50"
                data-testid={`listing-${listing.listing_id}`}
              >
                <div 
                  className="cursor-pointer"
                  onClick={() => navigate(`/marketplace/${listing.listing_id}`)}
                >
                  <div className="aspect-square bg-muted">
                    {listing.images?.[0] ? (
                      <img 
                        src={listing.images[0]} 
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm truncate">{listing.title}</h3>
                    <p className="text-lg font-bold text-primary mt-1">
                      ${listing.price?.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      @{listing.seller?.username || listing.seller?.name?.split(' ')[0] || 'Seller'}
                    </p>
                  </div>
                </div>
                {/* Social Actions - Like & Share (visible to all, comments hidden) */}
                <div className="px-3 pb-3">
                  <ListingSocialActions listing={listing} user={user} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sync Notice */}
        <p className="text-center text-xs text-muted-foreground mt-8 pb-4">
          🔄 Synced with Blendlink mobile app
        </p>
      </main>
      
      {/* Show nav for logged-in users only (check token directly since outside ProtectedRoute) */}
      {(user || isLoggedIn) && (
        <>
          <BottomNav />
          <BackToGroupFAB />
        </>
      )}
    </div>
  );
}
