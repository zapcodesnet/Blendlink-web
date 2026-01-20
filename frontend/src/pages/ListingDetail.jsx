import React, { useState, useEffect, useContext, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext, CartContext } from "../App";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { toast } from "sonner";
import { 
  ArrowLeft, Heart, Share2, MessageCircle, MapPin, Package, 
  ShoppingCart, CreditCard, Truck, ChevronLeft, ChevronRight,
  ZoomIn, ZoomOut, X, Loader2, MapPinned, Info, AlertCircle
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Photo Gallery Component with Zoom
const PhotoGallery = ({ images, title }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    resetZoom();
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    resetZoom();
  };

  const resetZoom = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
    setIsZoomed(false);
  };

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 0.5, 4));
    setIsZoomed(true);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 0.5, 1);
    setZoomLevel(newZoom);
    if (newZoom === 1) {
      setPanPosition({ x: 0, y: 0 });
      setIsZoomed(false);
    }
  };

  const handleDoubleClick = (e) => {
    if (zoomLevel > 1) {
      resetZoom();
    } else {
      setZoomLevel(2);
      setIsZoomed(true);
    }
  };

  const handleMouseDown = (e) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoomLevel > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (zoomLevel > 1 && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - panPosition.x,
        y: e.touches[0].clientY - panPosition.y
      });
    }
  };

  const handleTouchMove = (e) => {
    if (isDragging && zoomLevel > 1 && e.touches.length === 1) {
      setPanPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  if (!images || images.length === 0) {
    return (
      <div className="aspect-square bg-muted flex items-center justify-center">
        <Package className="w-16 h-16 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main Image with Zoom */}
      <div 
        ref={containerRef}
        className="aspect-square bg-muted relative overflow-hidden cursor-move select-none"
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onWheel={handleWheel}
      >
        <img 
          src={images[selectedIndex]} 
          alt={`${title} - Photo ${selectedIndex + 1}`}
          className="w-full h-full object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
            cursor: zoomLevel > 1 ? 'grab' : 'zoom-in'
          }}
          draggable={false}
        />
        
        {/* Zoom Controls */}
        <div className="absolute bottom-4 right-4 flex gap-2 z-10">
          <button
            onClick={handleZoomOut}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            disabled={zoomLevel <= 1}
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleZoomIn}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            disabled={zoomLevel >= 4}
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          {isZoomed && (
            <button
              onClick={resetZoom}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Image Counter */}
        <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm z-10">
          {selectedIndex + 1} / {images.length}
        </div>

        {/* Zoom Level Indicator */}
        {isZoomed && (
          <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm z-10">
            {Math.round(zoomLevel * 100)}%
          </div>
        )}
      </div>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="flex gap-2 p-4 overflow-x-auto hide-scrollbar">
          {images.map((img, index) => (
            <button
              key={index}
              onClick={() => { setSelectedIndex(index); resetZoom(); }}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                index === selectedIndex 
                  ? 'border-primary ring-2 ring-primary/20' 
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Shipping Estimator Component
const ShippingEstimator = ({ listing }) => {
  const [destinationZip, setDestinationZip] = useState("");
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoDetecting, setAutoDetecting] = useState(false);

  // Auto-detect location on mount
  useEffect(() => {
    autoDetectLocation();
  }, []);

  const autoDetectLocation = async () => {
    setAutoDetecting(true);
    
    // Try browser geolocation first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          // Use reverse geocoding to get ZIP code
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`
            );
            const data = await response.json();
            const zip = data.address?.postcode;
            if (zip) {
              setDestinationZip(zip);
              toast.success("Location detected automatically");
            }
          } catch (err) {
            console.log("Geocoding failed, user can enter manually");
          }
          setAutoDetecting(false);
        },
        () => {
          setAutoDetecting(false);
        },
        { timeout: 5000 }
      );
    } else {
      setAutoDetecting(false);
    }
  };

  const fetchShippingEstimate = async () => {
    if (!destinationZip || destinationZip.length < 5) {
      setError("Please enter a valid ZIP code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/shippo/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin_zip: listing.location || listing.seller_zip || "10001",
          destination_zip: destinationZip,
          weight: listing.weight?.value || null,
          length: listing.dimensions?.length || null,
          width: listing.dimensions?.width || null,
          height: listing.dimensions?.height || null,
          is_digital: listing.is_digital || listing.category === 'digital'
        })
      });

      const data = await response.json();
      
      if (data.is_digital) {
        setRates({ isDigital: true, message: data.message });
      } else if (data.requires_seller_info) {
        setRates({ requiresContact: true, message: data.message });
      } else {
        setRates(data);
      }
    } catch (err) {
      setError("Failed to get shipping estimate. Please try again.");
      console.error("Shipping estimate error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Digital goods don't need shipping
  if (listing.is_digital || listing.category === 'digital') {
    return (
      <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
        <div className="flex items-center gap-2 text-primary">
          <Info className="w-5 h-5" />
          <span className="font-medium">Digital Delivery</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          This is a digital item. No shipping required - you'll receive instant access after purchase.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 p-4 bg-muted/50 rounded-xl">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="w-5 h-5 text-primary" />
        <span className="font-semibold">Shipping Estimate</span>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <MapPinned className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Enter your ZIP code"
            value={destinationZip}
            onChange={(e) => setDestinationZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            className="pl-10"
            maxLength={5}
            data-testid="shipping-zip-input"
          />
        </div>
        <Button 
          onClick={fetchShippingEstimate}
          disabled={loading || autoDetecting}
          data-testid="get-shipping-btn"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Estimate"}
        </Button>
      </div>

      {autoDetecting && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          Detecting your location...
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive mt-2 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}

      {rates && (
        <div className="mt-4">
          {rates.isDigital ? (
            <p className="text-sm text-primary">{rates.message}</p>
          ) : rates.requiresContact ? (
            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {rates.message || "Contact seller for shipping information"}
              </p>
            </div>
          ) : rates.rates?.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">Shipping to {destinationZip}:</p>
              
              {/* Show top 3 options */}
              {rates.rates.slice(0, 3).map((rate, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    index === 0 ? 'border-primary/50 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div>
                    <p className="font-medium text-sm">
                      {rate.carrier} {rate.service}
                      {index === 0 && <span className="text-xs text-primary ml-2">Best Price</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {rate.estimated_days} day{rate.estimated_days !== 1 ? 's' : ''} delivery
                    </p>
                  </div>
                  <span className="font-bold text-primary">${rate.amount.toFixed(2)}</span>
                </div>
              ))}

              {rates.is_estimate && (
                <p className="text-xs text-muted-foreground italic mt-2">
                  * Estimated rates - actual cost calculated at checkout
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No shipping options available for this destination.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default function ListingDetail() {
  const { user } = useContext(AuthContext);
  const { addToCart } = useContext(CartContext) || {};
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    try {
      const data = await api.marketplace.getListing(id);
      setListing(data);
      setLikesCount(data?.likes_count || 0);
      setIsLiked(data?.user_has_liked || false);
    } catch (error) {
      console.error("Listing error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!user) {
      toast.info("Sign up to like this listing!", {
        action: { label: "Sign Up", onClick: () => navigate("/register") }
      });
      return;
    }

    try {
      const response = await api.post(`/marketplace/listings/${id}/like`);
      setIsLiked(response.data?.liked);
      setLikesCount(response.data?.likes_count || likesCount);
    } catch (err) {
      // Toggle locally
      setIsLiked(!isLiked);
      setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/marketplace/${id}`;
    
    // Track share
    try {
      await api.post(`/marketplace/listings/${id}/share`);
    } catch (err) {
      // Silent fail for share tracking
    }

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

  const handleAddToCart = async () => {
    setAddingToCart(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/cart/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': user ? `Bearer ${api.getToken()}` : ''
        },
        body: JSON.stringify({ listing_id: id, quantity: 1 })
      });

      const data = await response.json();

      if (data.guest || !user) {
        // Store in localStorage for guests
        const cart = JSON.parse(localStorage.getItem('blendlink_cart') || '[]');
        const existingIndex = cart.findIndex(item => item.listing_id === id);
        
        if (existingIndex >= 0) {
          cart[existingIndex].quantity += 1;
        } else {
          cart.push({
            listing_id: listing.listing_id,
            title: listing.title,
            price: listing.price,
            image: listing.images?.[0],
            quantity: 1,
            seller_id: listing.seller?.user_id || listing.user_id,
            is_digital: listing.is_digital || listing.category === 'digital',
            weight: listing.weight,
            dimensions: listing.dimensions,
            location: listing.location
          });
        }
        
        localStorage.setItem('blendlink_cart', JSON.stringify(cart));
        window.dispatchEvent(new Event('cart-updated'));
      }

      if (addToCart) {
        addToCart(listing);
      }

      toast.success("Added to cart!", {
        action: { label: "View Cart", onClick: () => navigate("/checkout") }
      });
    } catch (err) {
      toast.error("Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = () => {
    // Add to cart first, then go to checkout
    handleAddToCart().then(() => {
      navigate("/checkout", { state: { buyNow: true, listingId: id } });
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Package className="w-16 h-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">Listing not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  const isOwnListing = listing.seller?.user_id === user?.user_id || listing.user_id === user?.user_id;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold truncate flex-1">{listing.title}</h1>
          <Button variant="ghost" size="icon" onClick={handleShare} data-testid="share-listing-btn">
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* Photo Gallery */}
        <PhotoGallery images={listing.images} title={listing.title} />

        <div className="px-4 py-6">
          {/* Price & Title */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{listing.title}</h1>
              <p className="text-3xl font-bold text-primary mt-2">
                ${listing.price?.toLocaleString()}
              </p>
            </div>
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 px-3 py-2 rounded-full transition-colors ${
                isLiked ? 'bg-red-500/10 text-red-500' : 'bg-muted hover:bg-muted/80'
              }`}
              data-testid="like-listing-btn"
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              <span className="text-sm font-medium">{likesCount}</span>
            </button>
          </div>

          {/* Details */}
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <span className="capitalize">{listing.condition?.replace('_', ' ')}</span>
            <span>•</span>
            <span className="capitalize">{listing.category}</span>
            {listing.location && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {listing.location}
                </span>
              </>
            )}
          </div>

          {/* Description */}
          {listing.description && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {listing.description}
              </p>
            </div>
          )}

          {/* Shipping Estimator */}
          <ShippingEstimator listing={listing} />

          {/* Seller */}
          <div className="mt-6 p-4 bg-muted/50 rounded-xl">
            <p className="text-xs text-muted-foreground mb-3">SELLER</p>
            <div className="flex items-center gap-3">
              <Avatar 
                className="w-12 h-12 cursor-pointer"
                onClick={() => navigate(`/profile/${listing.seller?.user_id}`)}
              >
                <AvatarImage src={listing.seller?.avatar || listing.seller?.picture} />
                <AvatarFallback>{listing.seller?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold">{listing.seller?.name}</p>
                <p className="text-sm text-muted-foreground">@{listing.seller?.username}</p>
              </div>
              {!isOwnListing && (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/messages/${listing.seller?.user_id}`)}
                >
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Message
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      {!isOwnListing && listing.status === 'active' && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 safe-bottom z-50">
          <div className="max-w-2xl mx-auto flex gap-3">
            <Button 
              variant="outline"
              className="flex-1 h-12 rounded-xl"
              onClick={handleAddToCart}
              disabled={addingToCart}
              data-testid="add-to-cart-btn"
            >
              {addingToCart ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  Add to Cart
                </>
              )}
            </Button>
            <Button 
              className="flex-1 h-12 rounded-xl"
              onClick={handleBuyNow}
              data-testid="buy-now-btn"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              Buy Now
            </Button>
          </div>
        </div>
      )}

      {/* Sold Banner */}
      {listing.status === 'sold' && (
        <div className="fixed bottom-0 left-0 right-0 bg-muted border-t border-border p-4 safe-bottom z-50">
          <div className="max-w-2xl mx-auto text-center">
            <p className="font-semibold text-muted-foreground">This item has been sold</p>
          </div>
        </div>
      )}
    </div>
  );
}
