import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { ArrowLeft, Share2, MessageCircle, MapPin, Bed, Bath, Home, Check } from "lucide-react";

export default function PropertyDetail() {
  const { user } = useContext(AuthContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProperty();
  }, [id]);

  const fetchProperty = async () => {
    try {
      const data = await api.rentals.getProperty(id);
      setProperty(data);
    } catch (error) {
      console.error("Property error:", error);
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

  if (!property) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Home className="w-16 h-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">Property not found or rentals coming soon</p>
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
          <h1 className="font-bold truncate flex-1">{property.title}</h1>
          <Button variant="ghost" size="icon">
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {/* Images */}
        <div className="aspect-video bg-muted">
          {property.images?.[0] ? (
            <img 
              src={property.images[0]} 
              alt={property.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Home className="w-16 h-16 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="px-4 py-6">
          {/* Price & Title */}
          <span className="px-2 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full capitalize">
            {property.property_type}
          </span>
          <h1 className="text-2xl font-bold mt-2">{property.title}</h1>
          <p className="text-3xl font-bold text-primary mt-2">
            ${property.price?.toLocaleString()}<span className="text-lg font-normal text-muted-foreground">/mo</span>
          </p>

          {/* Location */}
          <p className="flex items-center gap-1 text-muted-foreground mt-2">
            <MapPin className="w-4 h-4" />
            {property.location}
          </p>

          {/* Features */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <Bed className="w-5 h-5 text-muted-foreground" />
              <span>{property.bedrooms} Beds</span>
            </div>
            <div className="flex items-center gap-2">
              <Bath className="w-5 h-5 text-muted-foreground" />
              <span>{property.bathrooms} Baths</span>
            </div>
          </div>

          {/* Description */}
          {property.description && (
            <div className="mt-6">
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {property.description}
              </p>
            </div>
          )}

          {/* Amenities */}
          {property.amenities?.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Amenities</h3>
              <div className="grid grid-cols-2 gap-2">
                {property.amenities.map((amenity, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{amenity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Owner */}
          <div className="mt-6 p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-3">
              <Avatar 
                className="w-12 h-12 cursor-pointer"
                onClick={() => navigate(`/profile/${property.owner?.user_id}`)}
              >
                <AvatarImage src={property.owner?.avatar || property.owner?.picture} />
                <AvatarFallback>{property.owner?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold">{property.owner?.name}</p>
                <p className="text-sm text-muted-foreground">Property Owner</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {property.owner?.user_id !== user?.user_id && (
            <div className="mt-6 flex gap-3">
              <Button 
                className="flex-1 rounded-full"
                onClick={() => navigate(`/messages/${property.owner?.user_id}`)}
                data-testid="contact-owner"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Contact Owner
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
