import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { 
  Search, MapPin, Bed, Bath, Home, Building2, Hotel,
  Filter, ChevronRight
} from "lucide-react";

export default function Rentals() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    property_type: "",
    min_price: "",
    max_price: "",
    bedrooms: "",
    location: ""
  });

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const data = await api.rentals.getProperties(filters);
      setProperties(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Properties error:", error);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const propertyTypes = [
    { id: "", label: "All", icon: Home },
    { id: "apartment", label: "Apartment", icon: Building2 },
    { id: "house", label: "House", icon: Home },
    { id: "room", label: "Room", icon: Hotel },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold">Property Rentals</h1>
            <Button variant="outline" size="sm" onClick={fetchProperties}>
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search by location..."
              className="pl-10 h-11 rounded-full"
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && fetchProperties()}
              data-testid="location-search"
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* Property Types */}
        <div className="mb-6">
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {propertyTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setFilters({ ...filters, property_type: type.id });
                  setTimeout(fetchProperties, 100);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                  filters.property_type === type.id 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted hover:bg-muted/80"
                }`}
                data-testid={`type-${type.id || 'all'}`}
              >
                <type.icon className="w-4 h-4" />
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Properties Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl overflow-hidden">
                <div className="aspect-video skeleton" />
                <div className="p-4 space-y-2">
                  <div className="h-5 skeleton rounded" />
                  <div className="h-4 w-3/4 skeleton rounded" />
                  <div className="h-4 w-1/2 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-12">
            <Home className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Rentals Coming Soon</h3>
            <p className="text-muted-foreground">This feature is being added to the mobile API</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.map((property) => (
              <div
                key={property.property_id}
                className="bg-card rounded-xl overflow-hidden card-hover cursor-pointer border border-border/50"
                onClick={() => navigate(`/rentals/${property.property_id}`)}
                data-testid={`property-${property.property_id}`}
              >
                <div className="aspect-video bg-muted relative">
                  {property.images?.[0] ? (
                    <img 
                      src={property.images[0]} 
                      alt={property.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <span className="absolute top-2 left-2 px-2 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full">
                    {property.property_type}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold truncate">{property.title}</h3>
                  <p className="text-2xl font-bold text-primary mt-1">
                    ${property.price?.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Bed className="w-4 h-4" />
                      {property.bedrooms}
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="w-4 h-4" />
                      {property.bathrooms}
                    </span>
                  </div>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground mt-2 truncate">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    {property.location}
                  </p>
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
