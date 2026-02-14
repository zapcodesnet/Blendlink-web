import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { 
  ArrowLeft, Image, X, Plus, DollarSign 
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

export default function CreateListing() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showFeeConfirmation, setShowFeeConfirmation] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "new",
    images: [],
    is_digital: false
  });

  const LISTING_FEE = 200; // BL coins

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const cats = await api.marketplace.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Categories error:", error);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    
    if (!form.title || !form.price || !form.category) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    // Show fee confirmation dialog
    setShowFeeConfirmation(true);
  };

  const executeSubmit = async () => {
    setShowFeeConfirmation(false);
    setLoading(true);
    try {
      await api.marketplace.createListing({ 
        ...form, 
        price: parseFloat(form.price) 
      });
      toast.success("Listing created! 200 BL coins have been deducted.");
      navigate("/marketplace");
    } catch (error) {
      toast.error(error.message || "Failed to create listing");
    } finally {
      setLoading(false);
    }
  };

  const addImageUrl = () => {
    const url = prompt("Enter image URL:");
    if (url) {
      setForm({ ...form, images: [...form.images, url] });
    }
  };

  const removeImage = (index) => {
    setForm({ ...form, images: form.images.filter((_, i) => i !== index) });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Fee Confirmation Modal */}
      {showFeeConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-sm border border-border animate-in zoom-in-95">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold mb-2">Confirm Listing Fee</h3>
              <p className="text-muted-foreground mb-4">
                Creating this listing requires a fee of <strong className="text-foreground">{LISTING_FEE} BL coins</strong>.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
                This fee will be deducted from your BL coins wallet.
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowFeeConfirmation(false)} 
                  className="flex-1"
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={executeSubmit} 
                  className="flex-1 bg-amber-500 hover:bg-amber-600"
                  disabled={loading}
                  data-testid="confirm-fee-btn"
                >
                  {loading ? "Processing..." : `Pay ${LISTING_FEE} BL & Create`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">Create Listing</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleFormSubmit} className="space-y-6">
          {/* Images */}
          <div>
            <Label>Photos</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {form.images.map((img, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addImageUrl}
                className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center hover:border-primary transition-colors"
              >
                <Plus className="w-6 h-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mt-1">Add Photo</span>
              </button>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="What are you selling?"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              data-testid="listing-title"
            />
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Label htmlFor="price">Price *</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="price"
                type="number"
                placeholder="0.00"
                className="pl-10"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                data-testid="listing-price"
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger data-testid="listing-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condition */}
          <div className="space-y-2">
            <Label>Condition</Label>
            <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="like_new">Like New</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your item..."
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              data-testid="listing-description"
            />
          </div>

          {/* Listing Fee Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Listing Fee: {LISTING_FEE} BL coins</p>
                <p className="text-xs text-amber-600">This fee will be charged when you create your listing</p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <Button 
            type="submit" 
            className="w-full rounded-full" 
            disabled={loading}
            data-testid="create-listing-submit"
          >
            {loading ? "Creating..." : `Create Listing (${LISTING_FEE} BL)`}
          </Button>

          {/* Note */}
          <p className="text-xs text-muted-foreground text-center">
            Your BL coins will be deducted upon listing creation
          </p>
        </form>
      </main>
    </div>
  );
}
