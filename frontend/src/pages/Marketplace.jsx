import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import ComingSoonPlaceholder from "../components/ComingSoonPlaceholder";
import CartIcon from "../components/CartIcon";
import { toast } from "sonner";
import { 
  Search, Plus, Filter, Smartphone, Shirt, Home, Car, 
  Dumbbell, Download, Wrench, Package, ChevronRight, ShoppingBag,
  Sparkles, Store, Watch, Palette, Heart, Gamepad2, Building2,
  PawPrint, Baby, Gift, Ticket, ThumbsUp, Share2, ShoppingCart,
  CreditCard, Loader2
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
  const authContext = useContext(AuthContext);
  const user = authContext?.user; // Null-safe for guests
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sortBy, setSortBy] = useState("newest"); // Add sorting state

  useEffect(() => {
    fetchCategories();
    fetchListings();
  }, [selectedCategory, search]);

  const fetchCategories = async () => {
    try {
      const cats = await api.marketplace.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Categories error:", error);
    }
  };

  const fetchListings = async () => {
    setLoading(true);
    try {
      const data = await api.marketplace.getListings(selectedCategory, search);
      setListings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Listings error:", error);
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">Marketplace</h1>
            <div className="flex items-center gap-2">
              <CartIcon />
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
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              className="pl-10 h-11 rounded-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="search-input"
            />
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
                      {listing.seller?.name}
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
        <p className="text-center text-xs text-muted-foreground mt-8">
          🔄 Synced with Blendlink mobile app
        </p>
      </main>
    </div>
  );
}
