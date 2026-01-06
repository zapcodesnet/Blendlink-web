import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, API } from "../App";
import axios from "axios";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "../components/ui/avatar";
import { 
  Search, Star, Heart, GraduationCap, Laptop, Sparkles, 
  Car, Scale, Palette, Plus, MapPin
} from "lucide-react";

const categoryIcons = {
  healthcare: Heart,
  "home-services": Home,
  education: GraduationCap,
  tech: Laptop,
  beauty: Sparkles,
  transport: Car,
  legal: Scale,
  creative: Palette
};

import { Home } from "lucide-react";

export default function Services() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCategories();
    fetchServices();
  }, [selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API}/services/categories/list`);
      setCategories(response.data);
    } catch (error) {
      console.error("Categories error:", error);
    }
  };

  const fetchServices = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      if (search) params.append("location", search);
      
      const response = await axios.get(`${API}/services?${params}`);
      setServices(response.data);
    } catch (error) {
      console.error("Services error:", error);
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
            <h1 className="text-xl font-bold">Services</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search services..."
              className="pl-10 h-11 rounded-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchServices()}
              data-testid="search-services"
            />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* Categories */}
        <div className="mb-6">
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            <button
              onClick={() => setSelectedCategory("")}
              className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                !selectedCategory 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              All
            </button>
            {categories.map((cat) => {
              const Icon = categoryIcons[cat.id] || Home;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted hover:bg-muted/80"
                  }`}
                  data-testid={`cat-${cat.id}`}
                >
                  <Icon className="w-4 h-4" />
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Services List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl p-4 flex gap-4">
                <div className="w-16 h-16 rounded-full skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-1/2 skeleton rounded" />
                  <div className="h-4 w-3/4 skeleton rounded" />
                  <div className="h-4 w-1/4 skeleton rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-12">
            <Laptop className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No services found</h3>
            <p className="text-muted-foreground">Be the first to offer a service!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {services.map((service) => (
              <div
                key={service.service_id}
                className="bg-card rounded-xl p-4 card-hover cursor-pointer border border-border/50"
                onClick={() => navigate(`/services/${service.service_id}`)}
                data-testid={`service-${service.service_id}`}
              >
                <div className="flex gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={service.provider?.avatar} />
                    <AvatarFallback>{service.provider?.name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="font-semibold">{service.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="flex items-center gap-1 text-sm text-amber-500">
                        <Star className="w-4 h-4 fill-current" />
                        {service.rating?.toFixed(1) || "New"}
                      </span>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {service.is_remote ? "Remote" : service.location}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-primary mt-2">
                      {service.hourly_rate 
                        ? `$${service.hourly_rate}/hr` 
                        : service.fixed_price 
                          ? `$${service.fixed_price}` 
                          : "Contact for price"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
