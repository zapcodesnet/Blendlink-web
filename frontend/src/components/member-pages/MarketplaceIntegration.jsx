/**
 * Marketplace Integration Component
 * Links member pages to marketplace listings
 */

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { safeFetch } from "../../services/memberPagesApi";
import {
  Store, Link2, Unlink, Search, Package, Tag, DollarSign,
  ExternalLink, Loader2, Plus, Check, RefreshCw, ShoppingBag,
  Eye, Star, TrendingUp
} from "lucide-react";

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function MarketplaceIntegration({ pageId, pageType, pageName }) {
  const [linkedListings, setLinkedListings] = useState([]);
  const [availableListings, setAvailableListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAvailable, setShowAvailable] = useState(false);

  // Load linked listings - PRODUCTION FIX: uses safeFetch
  const loadLinkedListings = async () => {
    try {
      const data = await safeFetch(`${API_URL}/api/marketplace-link/${pageId}/listings`);
      setLinkedListings(data.listings || []);
    } catch (err) {
      console.error("Failed to load linked listings:", err);
    }
  };

  // Load available listings to link - PRODUCTION FIX: uses safeFetch
  const loadAvailableListings = async () => {
    try {
      const data = await safeFetch(`${API_URL}/api/marketplace-link/available`);
      setAvailableListings(data.listings || []);
    } catch (err) {
      console.error("Failed to load available listings:", err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadLinkedListings(), loadAvailableListings()]);
      setLoading(false);
    };
    loadAll();
  }, [pageId]);

  // Link a listing to this page - PRODUCTION FIX: uses safeFetch
  const linkListing = async (listingId) => {
    setLinking(listingId);
    try {
      await safeFetch(`${API_URL}/api/marketplace-link/link`, {
        method: "POST",
        body: JSON.stringify({
          page_id: pageId,
          listing_id: listingId
        })
      });

      toast.success("Listing linked to page!");
      await Promise.all([loadLinkedListings(), loadAvailableListings()]);
      setShowAvailable(false);
    } catch (err) {
      toast.error(err.message || "Failed to link listing");
    }
    setLinking(null);
  };

  // Unlink a listing from this page - PRODUCTION FIX: uses safeFetch
  const unlinkListing = async (listingId) => {
    if (!confirm("Remove this listing from your page?")) return;
    
    setLinking(listingId);
    try {
      await safeFetch(`${API_URL}/api/marketplace-link/link`, {
        method: "POST",
        body: JSON.stringify({
          page_id: pageId,
          listing_id: listingId,
          unlink: true
        })
      });

      toast.success("Listing removed from page");
      await Promise.all([loadLinkedListings(), loadAvailableListings()]);
    } catch (err) {
      toast.error("Failed to unlink listing");
    }
    setLinking(null);
  };

  // Filter available listings
  const filteredAvailable = availableListings.filter(listing =>
    listing.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    listing.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="marketplace-integration">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Marketplace Integration</h3>
              <p className="text-sm text-gray-500">
                {linkedListings.length} listing{linkedListings.length !== 1 ? 's' : ''} linked
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowAvailable(!showAvailable)}
            className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Link Listing
          </Button>
        </div>

        <p className="text-sm text-gray-600 bg-purple-50 rounded-xl p-3">
          Connect your marketplace listings to this page. Linked listings will appear on your public page
          and customers can purchase directly through your store dashboard.
        </p>
      </div>

      {/* Linked Listings */}
      <div className="bg-white/70 backdrop-blur-lg rounded-2xl border border-white/50 p-5">
        <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Link2 className="w-5 h-5 text-purple-500" />
          Linked Listings
        </h4>

        {linkedListings.length === 0 ? (
          <div className="text-center py-8">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No listings linked yet</p>
            <p className="text-sm text-gray-400 mb-4">
              Link your marketplace listings to display them on this page
            </p>
            <Button
              variant="outline"
              onClick={() => setShowAvailable(true)}
              className="rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1" />
              Browse Available Listings
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {linkedListings.map((listing) => (
              <div
                key={listing.listing_id}
                className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Listing Image */}
                  <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                    {listing.images?.[0] ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Listing Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-semibold text-gray-900 truncate">{listing.title}</h5>
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                          {listing.description}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-purple-600 whitespace-nowrap ml-3">
                        ${listing.price?.toFixed(2)}
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {listing.views || 0} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500" />
                        {listing.rating?.toFixed(1) || "N/A"}
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        {listing.sales_count || 0} sold
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <a
                      href={`/marketplace/${listing.listing_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-500" />
                    </a>
                    <button
                      onClick={() => unlinkListing(listing.listing_id)}
                      disabled={linking === listing.listing_id}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      {linking === listing.listing_id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      ) : (
                        <Unlink className="w-4 h-4 text-red-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available Listings Modal */}
      {showAvailable && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Link Marketplace Listing</h3>
                  <p className="text-sm opacity-90">Select a listing to link to {pageName}</p>
                </div>
                <button
                  onClick={() => setShowAvailable(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search your listings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>

            {/* Listings List */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {filteredAvailable.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">No available listings</p>
                  <p className="text-sm text-gray-400">
                    {searchQuery 
                      ? "No listings match your search" 
                      : "Create listings in the marketplace first"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAvailable.map((listing) => (
                    <div
                      key={listing.listing_id}
                      className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50/30 transition-all"
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
                        <p className="text-sm text-gray-500">${listing.price?.toFixed(2)}</p>
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
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
