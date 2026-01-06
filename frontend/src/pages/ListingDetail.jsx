import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { ArrowLeft, Heart, Share2, MessageCircle, MapPin, Package } from "lucide-react";

export default function ListingDetail() {
  const { user } = useContext(AuthContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    try {
      const data = await api.marketplace.getListing(id);
      setListing(data);
    } catch (error) {
      console.error("Listing error:", error);
    } finally {
      setLoading(false);
    }
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
        <p className="text-muted-foreground text-center">Listing not found or marketplace coming soon</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold truncate flex-1">{listing.title}</h1>
          <Button variant="ghost" size="icon">
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* Images */}
        <div className="aspect-square bg-muted">
          {listing.images?.[0] ? (
            <img 
              src={listing.images[0]} 
              alt={listing.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="px-4 py-6">
          {/* Price & Title */}
          <h1 className="text-2xl font-bold">{listing.title}</h1>
          <p className="text-3xl font-bold text-primary mt-2">
            ${listing.price?.toLocaleString()}
          </p>

          {/* Details */}
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            <span className="capitalize">{listing.condition?.replace('_', ' ')}</span>
            <span>•</span>
            <span className="capitalize">{listing.category}</span>
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

          {/* Seller */}
          <div className="mt-6 p-4 bg-muted/50 rounded-xl">
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
            </div>
          </div>

          {/* Actions */}
          {listing.seller?.user_id !== user?.user_id && (
            <div className="mt-6 flex gap-3">
              <Button 
                className="flex-1 rounded-full"
                onClick={() => navigate(`/messages/${listing.seller?.user_id}`)}
                data-testid="contact-seller"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Contact Seller
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
