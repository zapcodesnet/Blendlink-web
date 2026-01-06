import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { ArrowLeft, Share2, MessageCircle, MapPin, Star, Globe, Laptop } from "lucide-react";

export default function ServiceDetail() {
  const { user } = useContext(AuthContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchService();
  }, [id]);

  const fetchService = async () => {
    try {
      const data = await api.services.getService(id);
      setService(data);
    } catch (error) {
      console.error("Service error:", error);
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

  if (!service) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Laptop className="w-16 h-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground text-center">Service not found or services coming soon</p>
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
          <h1 className="font-bold truncate flex-1">Service Details</h1>
          <Button variant="ghost" size="icon">
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Provider */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar 
            className="w-20 h-20 cursor-pointer"
            onClick={() => navigate(`/profile/${service.provider?.user_id}`)}
          >
            <AvatarImage src={service.provider?.avatar || service.provider?.picture} />
            <AvatarFallback className="text-2xl">{service.provider?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{service.provider?.name}</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>{service.rating?.toFixed(1) || "New"}</span>
              <span>({service.reviews_count || 0} reviews)</span>
            </div>
          </div>
        </div>

        {/* Service Title */}
        <h1 className="text-2xl font-bold">{service.title}</h1>
        
        {/* Category & Location */}
        <div className="flex flex-wrap gap-3 mt-3">
          <span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full capitalize">
            {service.category?.replace('-', ' ')}
          </span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            {service.is_remote ? (
              <>
                <Globe className="w-4 h-4" />
                Remote Available
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" />
                {service.location}
              </>
            )}
          </span>
        </div>

        {/* Price */}
        <div className="mt-6 p-4 bg-muted/50 rounded-xl">
          <p className="text-sm text-muted-foreground">Pricing</p>
          <p className="text-2xl font-bold text-primary">
            {service.hourly_rate 
              ? `$${service.hourly_rate}/hour` 
              : service.fixed_price 
                ? `$${service.fixed_price} fixed` 
                : "Contact for pricing"}
          </p>
        </div>

        {/* Description */}
        <div className="mt-6">
          <h3 className="font-semibold mb-2">About this Service</h3>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {service.description}
          </p>
        </div>

        {/* Actions */}
        {service.provider?.user_id !== user?.user_id && (
          <div className="mt-8 flex gap-3">
            <Button 
              className="flex-1 rounded-full"
              onClick={() => navigate(`/messages/${service.provider?.user_id}`)}
              data-testid="contact-provider"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Contact Provider
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
