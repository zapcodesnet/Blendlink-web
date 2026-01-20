import React, { useState, useEffect, useContext, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { AuthContext } from "../App";
import PhotoEditorModal from "../components/PhotoEditorModal";
import {
  Store,
  Package,
  TrendingUp,
  DollarSign,
  Eye,
  Heart,
  MessageCircle,
  Star,
  Coins,
  Sparkles,
  Camera,
  ImagePlus,
  Wand2,
  Truck,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Upload,
  X,
  ChevronRight,
  Loader2,
  Globe,
  Tag,
  FileText,
  Palette,
  Box,
  RotateCcw,
  ArrowLeft,
  Image,
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// API helper
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('blendlink_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_BASE_URL}/api${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  return response.json();
};

// Country options for targeting
const COUNTRIES = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UK", name: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "CN", name: "China", flag: "🇨🇳" },
];

// Stats Card Component
const StatCard = ({ title, value, icon: Icon, color = "text-primary", subtitle, trend }) => (
  <Card className="bg-card hover:shadow-lg transition-shadow">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-full bg-muted ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
          <span>{Math.abs(trend)}% from last week</span>
        </div>
      )}
    </CardContent>
  </Card>
);

// Listing Performance Card
const ListingCard = ({ listing, onImprove, onEdit }) => {
  const scoreColor = listing.performance_score >= 70 ? 'text-green-500' : 
                     listing.performance_score >= 40 ? 'text-yellow-500' : 'text-red-500';
  
  return (
    <Card className="bg-card hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {listing.image ? (
            <img src={listing.image} alt={listing.title} className="w-20 h-20 rounded-lg object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{listing.title}</h4>
            <p className="text-lg font-bold text-primary">${listing.price}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {listing.views}</span>
              <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {listing.favorites}</span>
              <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {listing.inquiries}</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${scoreColor}`}>{listing.performance_score}</div>
            <p className="text-xs text-muted-foreground">Score</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              listing.status === 'active' ? 'bg-green-500/10 text-green-500' : 
              listing.status === 'sold' ? 'bg-blue-500/10 text-blue-500' : 'bg-gray-500/10'
            }`}>
              {listing.status}
            </span>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="mt-3 pt-3 border-t border-border flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs h-8" 
            onClick={() => onEdit(listing)}
            data-testid={`edit-listing-${listing.listing_id}`}
          >
            <FileText className="w-3 h-3 mr-1" /> Edit Listing
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="flex-1 text-xs h-8" 
            onClick={() => onImprove(listing.listing_id)}
          >
            <Wand2 className="w-3 h-3 mr-1" /> AI Improve
          </Button>
        </div>
        
        {listing.ai_recommendations && listing.ai_recommendations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs font-medium text-amber-500 mb-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI Recommendations
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {listing.ai_recommendations.slice(0, 2).map((rec, i) => (
                <li key={i} className="flex items-start gap-1">
                  <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Edit Listing Modal Component
const EditListingModal = ({ listing, isOpen, onClose, onSave, isUploading, setIsUploading }) => {
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'new',
    images: [],
    status: 'active'
  });
  const [newImages, setNewImages] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const fileInputRef = React.useRef(null);

  // Initialize form when listing changes
  useEffect(() => {
    if (listing) {
      setEditData({
        title: listing.title || '',
        description: listing.description || '',
        price: listing.price?.toString() || '',
        category: listing.category || '',
        condition: listing.condition || 'new',
        images: listing.images || (listing.image ? [listing.image] : []),
        status: listing.status || 'active'
      });
      setNewImages([]);
    }
  }, [listing]);

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (editData.images.length + newImages.length + files.length > 10) {
      toast.error("Maximum 10 images allowed");
      return;
    }

    setIsUploading(true);
    
    // Convert files to base64 for preview and upload
    const newImagePromises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            preview: event.target.result,
            file: file,
            isNew: true
          });
        };
        reader.readAsDataURL(file);
      });
    });

    const uploadedImages = await Promise.all(newImagePromises);
    setNewImages(prev => [...prev, ...uploadedImages]);
    setIsUploading(false);
    toast.success(`${files.length} photo(s) added`);
  };

  const removeImage = (index, isNew) => {
    if (isNew) {
      setNewImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setEditData(prev => ({
        ...prev,
        images: prev.images.filter((_, i) => i !== index)
      }));
    }
  };

  const handleSave = async () => {
    if (!editData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!editData.price || parseFloat(editData.price) <= 0) {
      toast.error("Valid price is required");
      return;
    }

    setIsSaving(true);
    try {
      // Combine existing and new images
      const allImages = [
        ...editData.images,
        ...newImages.map(img => img.preview)
      ];

      const updatePayload = {
        title: editData.title,
        description: editData.description,
        price: parseFloat(editData.price),
        category: editData.category,
        condition: editData.condition,
        images: allImages,
        status: editData.status
      };

      await onSave(listing.listing_id, updatePayload);
      toast.success("Listing updated successfully!");
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to update listing");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !listing) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Edit Listing
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-6">
          {/* Images Section */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Photos ({editData.images.length + newImages.length}/10)</Label>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {/* Existing images */}
              {editData.images.map((img, i) => (
                <div key={`existing-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-muted group">
                  <img src={img} alt={`Photo ${i+1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i, false)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              {/* New images */}
              {newImages.map((img, i) => (
                <div key={`new-${i}`} className="relative aspect-square rounded-lg overflow-hidden bg-muted group border-2 border-primary">
                  <img src={img.preview} alt={`New photo ${i+1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 text-xs bg-primary text-white px-1 rounded">New</span>
                  <button
                    onClick={() => removeImage(i, true)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              
              {/* Add more button */}
              {editData.images.length + newImages.length < 10 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary cursor-pointer flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                  {isUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <ImagePlus className="w-6 h-6 mb-1" />
                      <span className="text-xs">Add</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={isUploading}
                    ref={fileInputRef}
                  />
                </label>
              )}
            </div>
            
            {/* Photo Editor Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPhotoEditor(true)}
              className="text-xs"
            >
              <Wand2 className="w-3 h-3 mr-1" /> Edit Photos with AI
            </Button>
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="edit-title">Title *</Label>
            <Input
              id="edit-title"
              value={editData.title}
              onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Product title"
              data-testid="edit-listing-title"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={editData.description}
              onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your item..."
              rows={4}
              data-testid="edit-listing-description"
            />
          </div>

          {/* Price */}
          <div>
            <Label htmlFor="edit-price">Price ($) *</Label>
            <Input
              id="edit-price"
              type="number"
              step="0.01"
              min="0"
              value={editData.price}
              onChange={(e) => setEditData(prev => ({ ...prev, price: e.target.value }))}
              placeholder="0.00"
              data-testid="edit-listing-price"
            />
          </div>

          {/* Condition */}
          <div>
            <Label>Condition</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {['new', 'like_new', 'good', 'fair', 'poor'].map(cond => (
                <button
                  key={cond}
                  onClick={() => setEditData(prev => ({ ...prev, condition: cond }))}
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
                    editData.condition === cond ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {cond.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <Label>Status</Label>
            <div className="flex gap-2 mt-2">
              {['active', 'paused', 'sold'].map(status => (
                <button
                  key={status}
                  onClick={() => setEditData(prev => ({ ...prev, status }))}
                  className={`px-4 py-2 rounded-lg text-sm capitalize ${
                    editData.status === status 
                      ? status === 'active' ? 'bg-green-500 text-white'
                        : status === 'sold' ? 'bg-blue-500 text-white'
                        : 'bg-amber-500 text-white'
                      : 'bg-muted'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t p-4 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="flex-1">
            {isSaving ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
            ) : (
              <><CheckCircle2 className="w-4 h-4 mr-2" /> Save Changes</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// AI Listing Generator Component
const AIListingGenerator = ({ onComplete }) => {
  const [images, setImages] = useState([]);
  const [condition, setCondition] = useState("new");
  const [targetCountries, setTargetCountries] = useState(["US"]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [priceData, setPriceData] = useState(null);
  const [isPricingLoading, setIsPricingLoading] = useState(false);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 20) {
      toast.error("Maximum 20 images allowed");
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleCountry = (code) => {
    setTargetCountries(prev => 
      prev.includes(code) 
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const handleAnalyze = async () => {
    if (images.length === 0) {
      toast.error("Please upload at least one image");
      return;
    }

    setIsAnalyzing(true);
    setResult(null);

    try {
      const response = await apiRequest('/ai-tools/analyze-listing', {
        method: 'POST',
        body: JSON.stringify({
          images,
          condition,
          target_countries: targetCountries,
        }),
      });
      setResult(response);
      toast.success("AI analysis complete!");

      // Auto-fetch pricing
      setIsPricingLoading(true);
      try {
        const priceResponse = await apiRequest('/ai-tools/price-suggestions', {
          method: 'POST',
          body: JSON.stringify({
            title: response.title,
            description: response.description,
            condition,
            target_countries: targetCountries,
            category: response.category,
          }),
        });
        setPriceData(priceResponse);
      } catch (e) {
        console.error("Price fetch failed:", e);
      } finally {
        setIsPricingLoading(false);
      }
    } catch (error) {
      toast.error(error.message || "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateListing = () => {
    if (result) {
      onComplete({
        ...result,
        images,
        condition,
        price: priceData?.recommended_price || 0,
        priceData,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Image Upload */}
      <div>
        <Label className="text-base font-semibold flex items-center gap-2 mb-3">
          <Camera className="w-5 h-5" />
          Upload Product Photos (up to 20)
        </Label>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
          {images.map((img, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
              <img src={img} alt={`Product ${i+1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {images.length < 20 && (
            <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors">
              <ImagePlus className="w-6 h-6 mb-1" />
              <span className="text-xs">Add Photo</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{images.length}/20 photos uploaded</p>
      </div>

      {/* Condition Selection */}
      <div>
        <Label className="text-base font-semibold flex items-center gap-2 mb-3">
          <Tag className="w-5 h-5" />
          Item Condition
        </Label>
        <div className="flex gap-3">
          <Button
            variant={condition === "new" ? "default" : "outline"}
            onClick={() => setCondition("new")}
            className="flex-1"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            New
          </Button>
          <Button
            variant={condition === "used" ? "default" : "outline"}
            onClick={() => setCondition("used")}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Used
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {condition === "new" 
            ? "AI will highlight premium features and value" 
            : "AI will honestly describe all visible flaws and wear"}
        </p>
      </div>

      {/* Target Countries */}
      <div>
        <Label className="text-base font-semibold flex items-center gap-2 mb-3">
          <Globe className="w-5 h-5" />
          Target Countries (for pricing research)
        </Label>
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.map(country => (
            <button
              key={country.code}
              onClick={() => toggleCountry(country.code)}
              className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1 transition-colors ${
                targetCountries.includes(country.code)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              <span>{country.flag}</span>
              <span>{country.code}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Analyze Button */}
      <Button
        onClick={handleAnalyze}
        disabled={images.length === 0 || isAnalyzing}
        className="w-full py-6 text-lg bg-gradient-to-r from-purple-600 to-blue-600"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            AI Analyzing Images...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Generate Listing with AI
          </>
        )}
      </Button>

      {/* Results */}
      {result && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI-Generated Listing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div>
              <Label className="text-sm text-muted-foreground">Title</Label>
              <p className="font-semibold text-lg">{result.title}</p>
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm text-muted-foreground">Description</Label>
              <p className="text-sm whitespace-pre-wrap">{result.description}</p>
            </div>

            {/* Category & Tags */}
            <div className="flex gap-4">
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">Category</Label>
                <p className="font-medium">{result.category}</p>
              </div>
              <div className="flex-1">
                <Label className="text-sm text-muted-foreground">Tags</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {result.suggested_tags?.slice(0, 5).map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 bg-muted rounded-full text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Specifications */}
            {result.specifications && (
              <div>
                <Label className="text-sm text-muted-foreground">Specifications</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {Object.entries(result.specifications).filter(([_, v]) => v).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <span className="text-muted-foreground">{key}: </span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Condition Details */}
            <div>
              <Label className="text-sm text-muted-foreground">Condition Assessment</Label>
              <p className="text-sm mt-1">
                <span className={`font-medium ${
                  result.detected_condition === 'new' || result.detected_condition === 'like_new' 
                    ? 'text-green-500' 
                    : result.detected_condition === 'good' 
                      ? 'text-yellow-500' 
                      : 'text-red-500'
                }`}>
                  {result.detected_condition?.replace('_', ' ')}
                </span>
                {' - '}{result.condition_details}
              </p>
              {result.flaws_detected?.length > 0 && (
                <div className="mt-2 p-2 bg-red-500/10 rounded-lg text-sm">
                  <p className="font-medium text-red-500 mb-1">Flaws Detected:</p>
                  <ul className="list-disc list-inside text-red-400">
                    {result.flaws_detected.map((flaw, i) => (
                      <li key={i}>{flaw}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Pricing */}
            {isPricingLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Researching market prices...</span>
              </div>
            ) : priceData && (
              <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                <Label className="text-sm text-amber-500 font-medium flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  AI Price Suggestions
                </Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <div className="text-center p-2 bg-background/50 rounded">
                    <p className="text-xs text-muted-foreground">Lowest</p>
                    <p className="font-bold text-green-500">${priceData.lowest_price}</p>
                  </div>
                  <div className="text-center p-2 bg-background/50 rounded">
                    <p className="text-xs text-muted-foreground">Average</p>
                    <p className="font-bold">${priceData.average_price}</p>
                  </div>
                  <div className="text-center p-2 bg-background/50 rounded">
                    <p className="text-xs text-muted-foreground">Highest</p>
                    <p className="font-bold text-red-500">${priceData.highest_price}</p>
                  </div>
                  <div className="text-center p-2 bg-primary/20 rounded border-2 border-primary">
                    <p className="text-xs text-primary font-medium">Recommended</p>
                    <p className="font-bold text-primary">${priceData.recommended_price}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{priceData.pricing_advice}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1">
                Edit Details
              </Button>
              <Button onClick={handleCreateListing} className="flex-1">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Create Listing
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// AI Background Removal Component
const AIBackgroundRemoval = () => {
  const [image, setImage] = useState(null);
  const [backgroundType, setBackgroundType] = useState("white");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handleProcess = async () => {
    if (!image) return;

    setIsProcessing(true);
    try {
      const response = await apiRequest('/ai-tools/remove-background', {
        method: 'POST',
        body: JSON.stringify({
          image_base64: image,
          background_type: backgroundType,
        }),
      });
      setResult(response);
      toast.success("Image analyzed!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
        {image ? (
          <div className="space-y-4">
            <img src={image} alt="Upload" className="max-h-64 mx-auto rounded-lg" />
            <Button variant="outline" onClick={() => setImage(null)}>
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          </div>
        ) : (
          <label className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Click to upload an image</p>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        )}
      </div>

      {image && (
        <>
          <div>
            <Label className="mb-2 block">Background Type</Label>
            <div className="flex gap-2">
              {[
                { id: "white", label: "White", color: "bg-white" },
                { id: "gray", label: "Gray", color: "bg-gray-200" },
                { id: "gradient", label: "Gradient", color: "bg-gradient-to-br from-white to-gray-200" },
              ].map(bg => (
                <button
                  key={bg.id}
                  onClick={() => setBackgroundType(bg.id)}
                  className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                    backgroundType === bg.id ? 'border-primary' : 'border-border'
                  }`}
                >
                  <div className={`w-full h-8 rounded ${bg.color} mb-2`} />
                  <span className="text-sm">{bg.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleProcess} disabled={isProcessing} className="w-full">
            {isProcessing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
            ) : (
              <><Palette className="w-4 h-4 mr-2" /> Remove Background</>
            )}
          </Button>

          {result && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <h4 className="font-medium mb-2">AI Analysis</h4>
                <p className="text-sm text-muted-foreground">{result.improvement_notes}</p>
                <p className="text-sm text-amber-500 mt-2">💡 {result.tip}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

// AI Shipping Estimator Component
const AIShippingEstimator = () => {
  const [originZip, setOriginZip] = useState("");
  const [destZip, setDestZip] = useState("");
  const [destCountry, setDestCountry] = useState("US");
  const [dimensions, setDimensions] = useState({ length: "", width: "", height: "" });
  const [weight, setWeight] = useState("");
  const [isEstimating, setIsEstimating] = useState(false);
  const [result, setResult] = useState(null);

  const handleEstimate = async () => {
    if (!originZip || !destZip) {
      toast.error("Please enter origin and destination ZIP codes");
      return;
    }

    setIsEstimating(true);
    try {
      const response = await apiRequest('/ai-tools/shipping-estimate', {
        method: 'POST',
        body: JSON.stringify({
          origin_zip: originZip,
          destination_zip: destZip,
          destination_country: destCountry,
          manual_dimensions: dimensions.length ? {
            length: parseFloat(dimensions.length) || 12,
            width: parseFloat(dimensions.width) || 9,
            height: parseFloat(dimensions.height) || 6,
          } : null,
          manual_weight: weight ? parseFloat(weight) : null,
        }),
      });
      setResult(response);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsEstimating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Origin ZIP Code</Label>
          <Input
            placeholder="e.g., 90210"
            value={originZip}
            onChange={(e) => setOriginZip(e.target.value)}
          />
        </div>
        <div>
          <Label>Destination ZIP</Label>
          <Input
            placeholder="e.g., 10001"
            value={destZip}
            onChange={(e) => setDestZip(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>Destination Country</Label>
        <select
          value={destCountry}
          onChange={(e) => setDestCountry(e.target.value)}
          className="w-full p-2 rounded-lg border border-border bg-background"
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <Label>Package Dimensions (inches) - Optional</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input placeholder="Length" value={dimensions.length} onChange={(e) => setDimensions(prev => ({ ...prev, length: e.target.value }))} />
          <Input placeholder="Width" value={dimensions.width} onChange={(e) => setDimensions(prev => ({ ...prev, width: e.target.value }))} />
          <Input placeholder="Height" value={dimensions.height} onChange={(e) => setDimensions(prev => ({ ...prev, height: e.target.value }))} />
        </div>
      </div>

      <div>
        <Label>Weight (lbs) - Optional</Label>
        <Input placeholder="e.g., 2.5" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </div>

      <Button onClick={handleEstimate} disabled={isEstimating} className="w-full">
        {isEstimating ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Calculating...</>
        ) : (
          <><Truck className="w-4 h-4 mr-2" /> Get Shipping Estimates</>
        )}
      </Button>

      {result && (
        <div className="space-y-4">
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Box className="w-4 h-4" /> Package Details
              </h4>
              <div className="text-sm text-muted-foreground">
                <p>Dimensions: {result.estimated_dimensions.length}&quot; × {result.estimated_dimensions.width}&quot; × {result.estimated_dimensions.height}&quot;</p>
                <p>Weight: {result.estimated_weight} lbs</p>
                <p className="text-primary mt-2">📦 {result.packaging_advice}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <h4 className="font-medium">Shipping Options</h4>
            {result.shipping_options.map((option, i) => (
              <Card key={i} className={`cursor-pointer hover:shadow-md transition-shadow ${i === 0 ? 'border-primary' : ''}`}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{option.provider}</p>
                    <p className="text-xs text-muted-foreground">{option.delivery_days} days</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">${option.estimated_cost}</p>
                    {i === 0 && <span className="text-xs text-green-500">Recommended</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Main Seller Dashboard Component
export default function SellerDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [listings, setListings] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPhotoEditorOpen, setIsPhotoEditorOpen] = useState(false);
  const [editedPhotos, setEditedPhotos] = useState([]);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState(null);
  
  // Edit listing state
  const [editingListing, setEditingListing] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsData, performanceData] = await Promise.all([
        apiRequest('/seller/stats'),
        apiRequest('/seller/performance?days=30'),
      ]);
      setStats(statsData);
      setPerformance(performanceData);
      setListings(performanceData.listings || []);
    } catch (error) {
      console.error("Failed to load seller data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const data = await apiRequest('/orders/seller/list');
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load orders:", error);
      // Don't show error if no orders endpoint yet
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === "orders") {
      loadOrders();
    }
  }, [activeTab, loadOrders]);

  const handlePrintLabel = async (order) => {
    setGeneratingLabel(order.order_id);
    try {
      // Get seller's address (mock - should come from user profile)
      const sellerAddress = {
        name: user?.name || "Seller",
        street1: "123 Seller Street",
        city: "Los Angeles",
        state: "CA",
        zip: user?.zip || "90001",
        country: "US"
      };

      const response = await fetch(`${API_BASE_URL}/api/shippo/create-label`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('blendlink_token')}`
        },
        body: JSON.stringify({
          from_address: sellerAddress,
          to_address: order.shipping_address,
          parcel: {
            length: 6,
            width: 4,
            height: 2,
            weight: 1,
            distance_unit: "in",
            mass_unit: "lb"
          },
          carrier: order.shipping_option?.carrier?.toLowerCase() || "usps",
          service_level: order.shipping_option?.service_token || "usps_priority",
          order_id: order.order_id
        })
      });

      const data = await response.json();
      
      if (data.label_url) {
        // Open label PDF in new tab
        window.open(data.label_url, '_blank');
        toast.success("Shipping label generated! Check your new tab to print.");
        
        // Refresh orders to show updated tracking
        loadOrders();
      } else {
        throw new Error(data.detail || "Failed to generate label");
      }
    } catch (error) {
      console.error("Label generation error:", error);
      toast.error(error.message || "Failed to generate shipping label");
    } finally {
      setGeneratingLabel(null);
    }
  };

  const handleImprove = async (listingId) => {
    try {
      const result = await apiRequest(`/ai-tools/improve-listing?listing_id=${listingId}`, {
        method: 'POST',
      });
      toast.success("AI analysis complete!");
      // Show results in a modal or expand the listing
      console.log(result);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handlePhotoEditorComplete = (photos) => {
    setEditedPhotos(photos);
    toast.success(`${photos.length} edited photo(s) ready for AI listing!`);
    // Optionally switch to AI Create tab or show them in the listing creator
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "orders", label: "Orders", icon: Package },
    { id: "create", label: "AI Create Listing", icon: Sparkles, externalLink: "https://blendlink.net/ai-listing-creator" },
    { id: "listings", label: "My Listings", icon: Package },
    { id: "photo-editor", label: "Photo Editor", icon: Image },
    { id: "shipping", label: "Shipping", icon: Truck },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Photo Editor Modal */}
      <PhotoEditorModal
        isOpen={isPhotoEditorOpen}
        onClose={() => setIsPhotoEditorOpen(false)}
        onComplete={handlePhotoEditorComplete}
      />
      
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/feed">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Store className="w-6 h-6 text-primary" />
                Seller Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">Manage your listings with AI-powered tools</p>
            </div>
          </div>
          {/* Create button hidden as per user request */}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {tabs.map(tab => (
            tab.externalLink ? (
              <a
                key={tab.id}
                href={tab.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0"
              >
                <Button variant="outline" className="flex items-center">
                  <tab.icon className="w-4 h-4 mr-2" />
                  {tab.label}
                </Button>
              </a>
            ) : (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "outline"}
                onClick={() => setActiveTab(tab.id)}
                className="flex-shrink-0"
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </Button>
            )
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Active Listings" value={stats?.active_listings || 0} icon={Package} />
              <StatCard title="Total Sales" value={`$${stats?.total_revenue || 0}`} icon={DollarSign} color="text-green-500" />
              <StatCard title="Total Views" value={stats?.total_views || 0} icon={Eye} />
              <StatCard title="BL Coins" value={Math.floor(stats?.bl_coins_earned || 0)} icon={Coins} color="text-amber-500" />
            </div>

            {/* Performance Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Performance Summary
                </CardTitle>
                <CardDescription>
                  Average score: {performance?.average_score || 0}/100
                </CardDescription>
              </CardHeader>
              <CardContent>
                {performance?.underperforming?.length > 0 && (
                  <div className="mb-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                    <h4 className="font-medium text-amber-500 flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      Underperforming Listings
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      These listings need attention to improve sales
                    </p>
                    <div className="space-y-2">
                      {performance.underperforming.map(listing => (
                        <div key={listing.listing_id} className="flex items-center justify-between bg-background/50 p-2 rounded">
                          <span className="text-sm truncate">{listing.title}</span>
                          <Button variant="ghost" size="sm" onClick={() => handleImprove(listing.listing_id)}>
                            <Wand2 className="w-3 h-3 mr-1" /> Improve
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {listings.slice(0, 4).map(listing => (
                    <ListingCard key={listing.listing_id} listing={listing} onImprove={handleImprove} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Your Orders
                </CardTitle>
                <CardDescription>
                  Manage orders and print shipping labels
                </CardDescription>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No orders yet</p>
                    <p className="text-sm text-muted-foreground mt-1">When customers purchase your items, they'll appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <Card key={order.order_id} className="border-border/50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-medium">Order #{order.order_id}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(order.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              order.order_status === 'confirmed' ? 'bg-green-500/10 text-green-500' :
                              order.order_status === 'shipped' ? 'bg-blue-500/10 text-blue-500' :
                              'bg-yellow-500/10 text-yellow-500'
                            }`}>
                              {order.order_status}
                            </span>
                          </div>

                          {/* Items */}
                          <div className="border-t border-b border-border/50 py-3 mb-3">
                            {order.items?.filter(item => item.seller_id === user?.user_id).map((item, idx) => (
                              <div key={idx} className="flex items-center gap-3">
                                {item.image && (
                                  <img src={item.image} alt={item.title} className="w-12 h-12 rounded object-cover" />
                                )}
                                <div>
                                  <p className="text-sm font-medium">{item.title}</p>
                                  <p className="text-sm text-primary">${item.price}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Buyer Info */}
                          <div className="text-sm mb-3">
                            <p className="text-muted-foreground">Ship to:</p>
                            <p className="font-medium">{order.shipping_address?.name || order.customer_name}</p>
                            <p>{order.shipping_address?.street1}</p>
                            <p>{order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.zip}</p>
                          </div>

                          {/* Tracking Info */}
                          {order.tracking_number && (
                            <div className="bg-green-500/10 p-2 rounded mb-3">
                              <p className="text-xs text-green-500">
                                Tracking: {order.tracking_number}
                                {order.tracking_url && (
                                  <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="ml-2 underline">
                                    Track Package
                                  </a>
                                )}
                              </p>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2">
                            {!order.tracking_number && !order.items?.every(i => i.is_digital) && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handlePrintLabel(order)}
                                disabled={generatingLabel === order.order_id}
                                data-testid={`print-label-${order.order_id}`}
                              >
                                {generatingLabel === order.order_id ? (
                                  <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating...</>
                                ) : (
                                  <><Truck className="w-4 h-4 mr-1" /> Print Shipping Label</>
                                )}
                              </Button>
                            )}
                            {order.label_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(order.label_url, '_blank')}
                              >
                                <Truck className="w-4 h-4 mr-1" /> View Label
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "create" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI-Powered Listing Creator
              </CardTitle>
              <CardDescription>
                Upload photos and let AI generate a complete, optimized listing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIListingGenerator 
                onComplete={(data) => {
                  console.log("Listing data:", data);
                  toast.success("Listing ready! Redirecting to create page...");
                  // In production, navigate to listing creation form with pre-filled data
                }}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === "listings" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Your Listings ({listings.length})</h3>
              <Button variant="outline" onClick={loadData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {listings.map(listing => (
                <ListingCard key={listing.listing_id} listing={listing} onImprove={handleImprove} />
              ))}
            </div>
            {listings.length === 0 && (
              <Card className="p-8 text-center">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">No listings yet</h3>
                <p className="text-muted-foreground mb-4">Create your first listing with AI</p>
                <Button onClick={() => setActiveTab("create")}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Create Listing
                </Button>
              </Card>
            )}
          </div>
        )}

        {activeTab === "photo-editor" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5 text-pink-500" />
                Professional Photo Editor
              </CardTitle>
              <CardDescription>
                Upload photos, remove backgrounds with AI, apply custom backgrounds, and enhance your product images
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Feature highlights */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <Upload className="w-8 h-8 mx-auto text-blue-500 mb-2" />
                  <h4 className="text-sm font-medium">Multi Upload</h4>
                  <p className="text-xs text-muted-foreground">Up to 10 photos</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <Wand2 className="w-8 h-8 mx-auto text-purple-500 mb-2" />
                  <h4 className="text-sm font-medium">AI Background</h4>
                  <p className="text-xs text-muted-foreground">Auto removal</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <Palette className="w-8 h-8 mx-auto text-pink-500 mb-2" />
                  <h4 className="text-sm font-medium">Custom BG</h4>
                  <p className="text-xs text-muted-foreground">Colors & patterns</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg text-center">
                  <Sparkles className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                  <h4 className="text-sm font-medium">Enhance</h4>
                  <p className="text-xs text-muted-foreground">Brightness & more</p>
                </div>
              </div>

              {/* Edited photos preview */}
              {editedPhotos.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Edited Photos Ready</h4>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {editedPhotos.map((photo, i) => (
                      <div key={i} className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-muted">
                        <img src={photo.thumbnail_url || photo.final_url} alt={`Edited ${i+1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      // Navigate to AI Listing Creator with photos
                      navigate('/ai-listing-creator', { 
                        state: { 
                          photos: editedPhotos.map(p => p.final_url || p.thumbnail_url),
                          fromPhotoEditor: true 
                        }
                      });
                    }}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate AI Listing from These Photos
                  </Button>
                </div>
              )}

              {/* Open Editor Button */}
              <Button
                onClick={() => setIsPhotoEditorOpen(true)}
                className="w-full py-8 text-lg bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700"
                data-testid="open-photo-editor-btn"
              >
                <Image className="w-6 h-6 mr-3" />
                Open Photo Editor
              </Button>

              {/* Quick tips */}
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Tips for Best Results
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Use high-quality photos with good lighting</li>
                  <li>• Products on plain backgrounds work best for AI removal</li>
                  <li>• White/light gray backgrounds are most professional for marketplace</li>
                  <li>• Your background preference is saved for future sessions</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "shipping" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-500" />
                AI Shipping Assistant
              </CardTitle>
              <CardDescription>
                Get shipping estimates and find the best carriers for your items
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIShippingEstimator />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
