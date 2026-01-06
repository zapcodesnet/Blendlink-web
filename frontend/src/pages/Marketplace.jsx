import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, API } from "../App";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { 
  Search, Plus, Filter, Smartphone, Shirt, Home, Car, 
  Dumbbell, Download, Wrench, Package, ChevronRight
} from "lucide-react";

const categoryIcons = {
  electronics: Smartphone,
  fashion: Shirt,
  home: Home,
  vehicles: Car,
  sports: Dumbbell,
  digital: Download,
  services: Wrench,
  other: Package
};

export default function Marketplace() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);

  useEffect(() => {
    fetchCategories();
    fetchListings();
  }, [selectedCategory, search]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/marketplace/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error("Categories error:", error);
    }
  };

  const fetchListings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      if (search) params.append("search", search);
      
      const response = await axios.get(`${API}/marketplace/listings?${params}`);
      setListings(response.data);
    } catch (error) {
      console.error("Listings error:", error);
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
            <Button 
              onClick={() => navigate("/marketplace/create")}
              className="rounded-full"
              data-testid="create-listing-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Sell
            </Button>
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
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No listings found</h3>
            <p className="text-muted-foreground mb-4">Be the first to sell something!</p>
            <Button onClick={() => navigate("/marketplace/create")}>
              <Plus className="w-4 h-4 mr-2" />
              Create Listing
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((listing) => (
              <div
                key={listing.listing_id}
                className="bg-card rounded-xl overflow-hidden card-hover cursor-pointer border border-border/50"
                onClick={() => navigate(`/marketplace/${listing.listing_id}`)}
                data-testid={`listing-${listing.listing_id}`}
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
                    ${listing.price.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {listing.seller?.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
