/**
 * Member Pages - Business Pages Management
 * Lists all member-owned business pages with creation modal
 */

import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../App";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Store, UtensilsCrossed, Briefcase, Home, FileText, Plus, Search,
  ChevronLeft, Loader2, Sparkles, TrendingUp
} from "lucide-react";
import { 
  CreateMemberPageModal, 
  MemberPageCard, 
  memberPagesAPI, 
  PAGE_TYPES 
} from "./MemberPagesSystem";

export default function MemberPagesListing() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoading(true);
    try {
      const data = await memberPagesAPI.getMyPages();
      setPages(data.pages || []);
    } catch (err) {
      toast.error("Failed to load pages");
    }
    setLoading(false);
  };

  const handleCreatePage = async (data) => {
    const result = await memberPagesAPI.createPage(data);
    await loadPages();
    return result;
  };

  const handleManagePage = (page) => {
    navigate(`/member-pages/${page.page_id}`);
  };

  const handleViewPage = (page) => {
    window.open(`${window.location.origin}/${page.slug}`, '_blank');
  };

  // Filter pages
  let filteredPages = pages;
  if (searchQuery) {
    filteredPages = filteredPages.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }
  if (selectedType) {
    filteredPages = filteredPages.filter(p => p.page_type === selectedType);
  }

  // Calculate stats
  const totalViews = pages.reduce((sum, p) => sum + (p.total_views || 0), 0);
  const totalOrders = pages.reduce((sum, p) => sum + (p.total_orders || 0), 0);
  const totalRevenue = pages.reduce((sum, p) => sum + (p.total_revenue || 0), 0);

  return (
    <div className="min-h-screen bg-background" data-testid="member-pages">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-muted rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" /> My Business Pages
          </h1>
          <Button 
            size="sm" 
            className="ml-auto gap-1" 
            onClick={() => setShowCreateModal(true)}
            data-testid="create-page-btn"
          >
            <Plus className="w-4 h-4" /> Create Page
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Overview */}
        {pages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Total Pages</p>
              <p className="text-2xl font-bold">{pages.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Total Views</p>
              <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{totalOrders.toLocaleString()}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedType(null)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                !selectedType ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"
              }`}
            >
              All Types
            </button>
            {Object.values(PAGE_TYPES).map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(selectedType === type.id ? null : type.id)}
                  className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap flex items-center gap-1 transition-colors ${
                    selectedType === type.id ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <Icon className="w-3 h-3" /> {type.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pages Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="text-center py-12">
            <Store className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            {pages.length === 0 ? (
              <>
                <h3 className="text-lg font-semibold mb-2">Create Your First Business Page</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Launch a store, restaurant, services page, or rental listing. 
                  Each page gets its own URL and dashboard.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground mb-6">No pages match your filters</p>
            )}
            <Button onClick={() => setShowCreateModal(true)} size="lg">
              <Plus className="w-4 h-4 mr-2" /> Create Business Page
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPages.map((page) => (
              <MemberPageCard
                key={page.page_id}
                page={page}
                onManage={handleManagePage}
                onView={handleViewPage}
              />
            ))}
          </div>
        )}

        {/* Create Page CTA */}
        {pages.length > 0 && (
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-6 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Grow Your Business</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Create unlimited business pages. Each page earns you 40 BL Coins 
                  and has its own custom URL, dashboard, and analytics.
                </p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Create Another Page
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateMemberPageModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreatePage}
        />
      )}
    </div>
  );
}
