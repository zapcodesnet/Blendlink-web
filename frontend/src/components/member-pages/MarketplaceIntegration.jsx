/**
 * Marketplace Integration Component
 * Enhanced UI for linking marketplace listings to member pages
 * Features:
 * - Drag-and-drop style linking interface
 * - Stats dashboard showing linked listing performance
 * - Quick actions for managing linked listings
 * - Category filtering and sorting
 * - Bulk operations
 */

import React, { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { safeFetch } from "../../services/memberPagesApi";
import {
  Store, Link2, Unlink, Search, Package, Tag, DollarSign,
  ExternalLink, Loader2, Plus, Check, RefreshCw, ShoppingBag,
  Eye, Star, TrendingUp, Filter, ArrowUpDown, Grid3X3, List,
  BarChart3, X, ChevronRight, Sparkles, Image, Clock, AlertCircle
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Listing Card Component
const ListingCard = ({ listing, onAction, actionLabel, actionIcon: ActionIcon, actionLoading, variant = "default" }) => {
  const isLinked = variant === "linked";
  
  return (
    <div
      className={`group bg-white rounded-xl border transition-all duration-200 overflow-hidden ${
        isLinked 
          ? "border-purple-200 hover:border-purple-300 hover:shadow-lg hover:shadow-purple-100" 
          : "border-gray-200 hover:border-cyan-300 hover:shadow-lg hover:shadow-cyan-50"
      }`}
      data-testid={`listing-card-${listing.listing_id}`}
    >
      {/* Image Section */}
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        {listing.images?.[0] ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <Package className="w-12 h-12 text-gray-300" />
          </div>
        )}
        
        {/* Price Badge */}
        <div className="absolute top-2 right-2">
          <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-sm font-bold text-gray-900 shadow-sm">
            ${listing.price?.toFixed(2) || "0.00"}
          </span>
        </div>
        
        {/* Status Badge */}
        {isLinked && (
          <div className="absolute top-2 left-2">
            <span className="px-2 py-1 bg-purple-500 text-white rounded-lg text-xs font-medium flex items-center gap-1">
              <Link2 className="w-3 h-3" />
              Linked
            </span>
          </div>
        )}
        
        {/* Category Badge */}
        {listing.category && (
          <div className="absolute bottom-2 left-2">
            <span className="px-2 py-1 bg-black/50 backdrop-blur-sm text-white rounded-lg text-xs">
              {listing.category}
            </span>
          </div>
        )}
      </div>
      
      {/* Content Section */}
      <div className="p-4">
        <h5 className="font-semibold text-gray-900 truncate mb-1" title={listing.title}>
          {listing.title}
        </h5>
        
        {listing.description && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
            {listing.description}
          </p>
        )}
        
        {/* Stats Row */}
        <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {listing.views || 0}
          </span>
          {listing.rating > 0 && (
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              {listing.rating?.toFixed(1)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ShoppingBag className="w-3.5 h-3.5" />
            {listing.sales_count || 0} sold
          </span>
        </div>
        
        {/* Action Button */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => onAction(listing.listing_id)}
            disabled={actionLoading === listing.listing_id}
            className={`flex-1 rounded-lg ${
              isLinked 
                ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" 
                : "bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:from-purple-600 hover:to-indigo-600"
            }`}
            variant={isLinked ? "ghost" : "default"}
            data-testid={`${isLinked ? "unlink" : "link"}-listing-${listing.listing_id}`}
          >
            {actionLoading === listing.listing_id ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ActionIcon className="w-4 h-4 mr-1.5" />
                {actionLabel}
              </>
            )}
          </Button>
          
          <a
            href={`/marketplace/${listing.listing_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            title="View in Marketplace"
          >
            <ExternalLink className="w-4 h-4 text-gray-500" />
          </a>
        </div>
      </div>
    </div>
  );
};

// Stats Card Component
const StatsCard = ({ icon: Icon, label, value, subValue, color = "purple" }) => {
  const colorClasses = {
    purple: "from-purple-500 to-indigo-500 text-purple-600 bg-purple-50",
    green: "from-green-500 to-emerald-500 text-green-600 bg-green-50",
    blue: "from-blue-500 to-cyan-500 text-blue-600 bg-blue-50",
    orange: "from-orange-500 to-amber-500 text-orange-600 bg-orange-50"
  };
  
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[color].split(' ')[0]} ${colorClasses[color].split(' ')[1]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
          {subValue && <p className="text-xs text-gray-400">{subValue}</p>}
        </div>
      </div>
    </div>
  );
};

export default function MarketplaceIntegration({ pageId, pageType, pageName }) {
  const [linkedListings, setLinkedListings] = useState([]);
  const [availableListings, setAvailableListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAvailable, setShowAvailable] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [sortBy, setSortBy] = useState("recent"); // recent, price, sales
  const [filterCategory, setFilterCategory] = useState("all");

  // Load linked listings
  const loadLinkedListings = async () => {
    try {
      const data = await safeFetch(`${API_URL}/api/marketplace-link/${pageId}/listings`);
      setLinkedListings(data.listings || []);
    } catch (err) {
      console.error("Failed to load linked listings:", err);
    }
  };

  // Load available listings to link
  const loadAvailableListings = async () => {
    try {
      const data = await safeFetch(`${API_URL}/api/marketplace-link/available`);
      // Filter out already linked listings
      const linkedIds = new Set(linkedListings.map(l => l.listing_id));
      const available = (data.listings || []).filter(l => !linkedIds.has(l.listing_id));
      setAvailableListings(available);
    } catch (err) {
      console.error("Failed to load available listings:", err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await loadLinkedListings();
      setLoading(false);
    };
    loadAll();
  }, [pageId]);

  // Load available when modal opens
  useEffect(() => {
    if (showAvailable) {
      loadAvailableListings();
    }
  }, [showAvailable, linkedListings]);

  // Link a listing to this page
  const linkListing = async (listingId) => {
    setLinking(listingId);
    try {
      await safeFetch(`${API_URL}/api/marketplace-link/link`, {
        method: "POST",
        body: JSON.stringify({
          page_id: pageId,
          listing_id: listingId,
          link: true
        })
      });

      toast.success(
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-500" />
          <span>Listing linked to your page!</span>
        </div>
      );
      await loadLinkedListings();
      // Remove from available
      setAvailableListings(prev => prev.filter(l => l.listing_id !== listingId));
    } catch (err) {
      toast.error(err.message || "Failed to link listing");
    }
    setLinking(null);
  };

  // Unlink a listing from this page
  const unlinkListing = async (listingId) => {
    const listing = linkedListings.find(l => l.listing_id === listingId);
    if (!confirm(`Remove "${listing?.title}" from this page?`)) return;
    
    setLinking(listingId);
    try {
      await safeFetch(`${API_URL}/api/marketplace-link/link`, {
        method: "POST",
        body: JSON.stringify({
          page_id: pageId,
          listing_id: listingId,
          link: false
        })
      });

      toast.success("Listing removed from page");
      await loadLinkedListings();
    } catch (err) {
      toast.error("Failed to unlink listing");
    }
    setLinking(null);
  };

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(availableListings.map(l => l.category).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [availableListings]);

  // Filter and sort available listings
  const filteredAvailable = useMemo(() => {
    let result = availableListings;
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(l => 
        l.title?.toLowerCase().includes(query) ||
        l.description?.toLowerCase().includes(query)
      );
    }
    
    // Filter by category
    if (filterCategory !== "all") {
      result = result.filter(l => l.category === filterCategory);
    }
    
    // Sort
    switch (sortBy) {
      case "price":
        result = [...result].sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case "sales":
        result = [...result].sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0));
        break;
      case "recent":
      default:
        result = [...result].sort((a, b) => 
          new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
    }
    
    return result;
  }, [availableListings, searchQuery, filterCategory, sortBy]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalViews = linkedListings.reduce((sum, l) => sum + (l.views || 0), 0);
    const totalSales = linkedListings.reduce((sum, l) => sum + (l.sales_count || 0), 0);
    const totalRevenue = linkedListings.reduce((sum, l) => sum + ((l.price || 0) * (l.sales_count || 0)), 0);
    const avgRating = linkedListings.length > 0 
      ? linkedListings.reduce((sum, l) => sum + (l.rating || 0), 0) / linkedListings.length 
      : 0;
    
    return { totalViews, totalSales, totalRevenue, avgRating };
  }, [linkedListings]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
        <p className="text-gray-500">Loading marketplace integration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="marketplace-integration">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-purple-500 via-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Store className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Marketplace Integration</h3>
              <p className="text-purple-100 text-sm mt-1">
                Connect your marketplace listings to showcase products directly on your page
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowAvailable(true)}
            className="bg-white text-purple-600 hover:bg-purple-50 rounded-xl shadow-lg"
            data-testid="link-listing-button"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Link Listing
          </Button>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-2xl font-bold">{linkedListings.length}</p>
            <p className="text-xs text-purple-200">Linked Listings</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</p>
            <p className="text-xs text-purple-200">Total Views</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-2xl font-bold">{stats.totalSales}</p>
            <p className="text-xs text-purple-200">Total Sales</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(0)}</p>
            <p className="text-xs text-purple-200">Est. Revenue</p>
          </div>
        </div>
      </div>

      {/* Linked Listings Section */}
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-purple-500" />
              <h4 className="font-semibold text-gray-900">Linked Listings</h4>
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                {linkedListings.length}
              </span>
            </div>
            
            {linkedListings.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadLinkedListings()}
                className="text-gray-500 hover:text-gray-700"
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh
              </Button>
            )}
          </div>
        </div>

        <div className="p-5">
          {linkedListings.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mb-4">
                <Package className="w-10 h-10 text-purple-400" />
              </div>
              <h5 className="text-lg font-semibold text-gray-900 mb-2">No Listings Linked Yet</h5>
              <p className="text-gray-500 max-w-sm mx-auto mb-6">
                Link your marketplace listings to display them on your public page and boost visibility
              </p>
              <Button
                onClick={() => setShowAvailable(true)}
                className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Browse Your Listings
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {linkedListings.map((listing) => (
                <ListingCard
                  key={listing.listing_id}
                  listing={listing}
                  onAction={unlinkListing}
                  actionLabel="Unlink"
                  actionIcon={Unlink}
                  actionLoading={linking}
                  variant="linked"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tips Section */}
      {linkedListings.length > 0 && linkedListings.length < 5 && (
        <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-100">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-cyan-900">Pro Tip</p>
              <p className="text-sm text-cyan-700">
                Pages with 5+ linked listings get 3x more engagement. Consider adding more products to increase visibility!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Link Listing Modal */}
      {showAvailable && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            data-testid="link-listing-modal"
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">Link Marketplace Listing</h3>
                  <p className="text-purple-100 text-sm mt-1">
                    Select listings to display on "{pageName}"
                  </p>
                </div>
                <button
                  onClick={() => setShowAvailable(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  data-testid="close-modal-button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search listings..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 rounded-xl bg-white"
                    data-testid="search-listings-input"
                  />
                </div>
                
                {/* Category Filter */}
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  data-testid="category-filter"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === "all" ? "All Categories" : cat}
                    </option>
                  ))}
                </select>
                
                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  data-testid="sort-select"
                >
                  <option value="recent">Most Recent</option>
                  <option value="price">Highest Price</option>
                  <option value="sales">Best Selling</option>
                </select>
                
                {/* View Toggle */}
                <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-2 ${viewMode === "grid" ? "bg-purple-100 text-purple-600" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-2 ${viewMode === "list" ? "bg-purple-100 text-purple-600" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Listings Grid */}
            <div className="p-5 overflow-y-auto" style={{ maxHeight: "calc(90vh - 220px)" }}>
              {filteredAvailable.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <ShoppingBag className="w-8 h-8 text-gray-400" />
                  </div>
                  <h5 className="font-semibold text-gray-900 mb-2">No Listings Available</h5>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    {searchQuery || filterCategory !== "all"
                      ? "No listings match your filters. Try adjusting your search."
                      : "You don't have any listings in the marketplace yet. Create listings first to link them here."}
                  </p>
                  {!searchQuery && filterCategory === "all" && (
                    <Button
                      variant="outline"
                      onClick={() => window.open("/marketplace/create", "_blank")}
                      className="mt-4 rounded-xl"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Create Listing
                    </Button>
                  )}
                </div>
              ) : (
                <div className={viewMode === "grid" 
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  : "space-y-3"
                }>
                  {filteredAvailable.map((listing) => (
                    viewMode === "grid" ? (
                      <ListingCard
                        key={listing.listing_id}
                        listing={listing}
                        onAction={linkListing}
                        actionLabel="Link"
                        actionIcon={Link2}
                        actionLoading={linking}
                        variant="available"
                      />
                    ) : (
                      // List View
                      <div
                        key={listing.listing_id}
                        className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-purple-200 hover:bg-purple-50/30 transition-all"
                      >
                        <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                          {listing.images?.[0] ? (
                            <img
                              src={listing.images[0]}
                              alt={listing.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-gray-900 truncate">{listing.title}</h5>
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                            <span className="font-semibold text-purple-600">${listing.price?.toFixed(2)}</span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {listing.views || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              <ShoppingBag className="w-3 h-3" />
                              {listing.sales_count || 0} sold
                            </span>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => linkListing(listing.listing_id)}
                          disabled={linking === listing.listing_id}
                          className="rounded-xl bg-purple-500 hover:bg-purple-600"
                        >
                          {linking === listing.listing_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Link2 className="w-4 h-4 mr-1" />
                              Link
                            </>
                          )}
                        </Button>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {filteredAvailable.length > 0 && (
              <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                <p className="text-sm text-gray-500 text-center">
                  Showing {filteredAvailable.length} of {availableListings.length} listings
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
