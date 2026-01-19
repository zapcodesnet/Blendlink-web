import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Slider } from "../components/ui/slider";
import { toast } from "sonner";
import {
  X,
  Upload,
  Image as ImageIcon,
  Wand2,
  Palette,
  Sun,
  Contrast,
  Droplets,
  Focus,
  RotateCcw,
  Undo2,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Download,
  Sparkles,
  Grid,
  Layers,
  ZoomIn,
  ZoomOut,
  Move,
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

// Background presets - matches backend BACKGROUND_PATTERNS
const BACKGROUND_PRESETS = {
  solid: [
    { id: "solid_white", name: "White", color: "#FFFFFF" },
    { id: "solid_black", name: "Black", color: "#000000" },
    { id: "solid_gray", name: "Light Gray", color: "#F5F5F5" },
    { id: "solid_cream", name: "Cream", color: "#FFFDD0" },
    { id: "solid_blue", name: "Sky Blue", color: "#87CEEB" },
    { id: "solid_pink", name: "Soft Pink", color: "#FFB6C1" },
    { id: "solid_mint", name: "Mint", color: "#98FF98" },
    { id: "solid_lavender", name: "Lavender", color: "#E6E6FA" },
  ],
  gradient: [
    { id: "gradient_sunset", name: "Sunset", colors: ["#FF6B6B", "#FFA07A"] },
    { id: "gradient_ocean", name: "Ocean", colors: ["#667eea", "#764ba2"] },
    { id: "gradient_forest", name: "Forest", colors: ["#11998e", "#38ef7d"] },
    { id: "gradient_purple", name: "Purple Haze", colors: ["#DA22FF", "#9733EE"] },
    { id: "gradient_peach", name: "Peach", colors: ["#FFECD2", "#FCB69F"] },
  ],
  pattern: [
    { id: "pattern_dots", name: "Polka Dots", pattern: "dots" },
    { id: "pattern_lines", name: "Lines", pattern: "lines" },
    { id: "pattern_grid", name: "Grid", pattern: "grid" },
    { id: "pattern_chevron", name: "Chevron", pattern: "chevron" },
  ],
};

// Photo thumbnail component
const PhotoThumbnail = ({ photo, isSelected, onClick, onDelete }) => (
  <div
    className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${
      isSelected ? 'ring-2 ring-primary scale-105' : 'hover:ring-1 ring-primary/50'
    }`}
    onClick={onClick}
    data-testid={`photo-thumb-${photo.photo_id}`}
  >
    <img
      src={photo.thumbnail_url || photo.current_url}
      alt="Photo"
      className="w-full h-full object-cover"
    />
    {photo.has_background_removed && (
      <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
        <Check className="w-3 h-3" />
      </div>
    )}
    <button
      onClick={(e) => { e.stopPropagation(); onDelete(photo.photo_id); }}
      className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      data-testid={`delete-photo-${photo.photo_id}`}
    >
      <Trash2 className="w-3 h-3" />
    </button>
  </div>
);

// Main Photo Editor Modal Component
export default function PhotoEditorModal({ isOpen, onClose, onComplete }) {
  // State
  const [photos, setPhotos] = useState([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [activeTab, setActiveTab] = useState('edit'); // edit, background, ai-listing
  const [processingAction, setProcessingAction] = useState('');
  
  // Adjustment sliders
  const [brightness, setBrightness] = useState(1.0);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const [sharpness, setSharpness] = useState(1.0);
  
  // Background customization
  const [selectedBackground, setSelectedBackground] = useState(null);
  const [customBackground, setCustomBackground] = useState(null);
  const [backgroundScale, setBackgroundScale] = useState(1.0);
  const [backgroundOffsetX, setBackgroundOffsetX] = useState(0);
  const [backgroundOffsetY, setBackgroundOffsetY] = useState(0);
  
  // Refs
  const fileInputRef = useRef(null);
  const customBgInputRef = useRef(null);
  
  const selectedPhoto = photos[selectedPhotoIndex];
  
  // Load existing photos on mount
  useEffect(() => {
    if (isOpen) {
      loadPhotos();
    }
  }, [isOpen]);
  
  const loadPhotos = async () => {
    try {
      const response = await apiRequest('/photo-editor/photos?limit=10');
      setPhotos(response.photos || []);
    } catch (error) {
      console.error('Failed to load photos:', error);
    }
  };
  
  // File upload handler
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    if (photos.length + files.length > 10) {
      toast.error("Maximum 10 photos allowed per session");
      return;
    }
    
    setIsUploading(true);
    const newPhotos = [];
    
    for (const file of files) {
      if (file.size > 60 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 60MB limit`);
        continue;
      }
      
      try {
        // Convert to base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        newPhotos.push(base64);
      } catch (err) {
        toast.error(`Failed to read ${file.name}`);
      }
    }
    
    if (newPhotos.length > 0) {
      try {
        const response = await apiRequest('/photo-editor/upload', {
          method: 'POST',
          body: JSON.stringify({ photos: newPhotos }),
        });
        
        toast.success(`Uploaded ${response.length} photo(s)`);
        await loadPhotos();
        setActiveTab('edit');
      } catch (error) {
        toast.error(error.message || "Upload failed");
      }
    }
    
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Remove background (single photo)
  const handleRemoveBackground = async () => {
    if (!selectedPhoto) return;
    
    setIsProcessing(true);
    setProcessingAction('Removing background...');
    
    try {
      const response = await apiRequest('/photo-editor/remove-background', {
        method: 'POST',
        body: JSON.stringify({ photo_id: selectedPhoto.photo_id }),
      });
      
      toast.success(`Background removed in ${response.processing_time_ms}ms`);
      await loadPhotos();
      setActiveTab('background');
    } catch (error) {
      toast.error(error.message || "Background removal failed");
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };
  
  // Batch remove backgrounds from ALL photos
  const handleBatchRemoveBackgrounds = async () => {
    const photosToProcess = photos.filter(p => !p.has_background_removed);
    
    if (photosToProcess.length === 0) {
      toast.info("All photos already have backgrounds removed");
      return;
    }
    
    setIsBatchProcessing(true);
    setBatchProgress({ current: 0, total: photosToProcess.length });
    setProcessingAction(`Removing backgrounds (0/${photosToProcess.length})...`);
    
    try {
      const response = await apiRequest('/photo-editor/remove-background-batch', {
        method: 'POST',
        body: JSON.stringify({ 
          photo_ids: photosToProcess.map(p => p.photo_id) 
        }),
      });
      
      const { total_processed, total_failed, total_time_ms } = response;
      
      if (total_failed === 0) {
        toast.success(`All ${total_processed} backgrounds removed in ${(total_time_ms / 1000).toFixed(1)}s`);
      } else {
        toast.warning(`${total_processed} succeeded, ${total_failed} failed`);
      }
      
      await loadPhotos();
      setActiveTab('background');
    } catch (error) {
      toast.error(error.message || "Batch processing failed");
    } finally {
      setIsBatchProcessing(false);
      setBatchProgress({ current: 0, total: 0 });
      setProcessingAction('');
    }
  };
  
  // AI Auto-Enhance (single photo)
  const handleAutoEnhance = async () => {
    if (!selectedPhoto) return;
    
    setIsProcessing(true);
    setProcessingAction('AI analyzing and enhancing...');
    
    try {
      const response = await apiRequest('/photo-editor/auto-enhance', {
        method: 'POST',
        body: JSON.stringify({ photo_id: selectedPhoto.photo_id }),
      });
      
      // Update sliders to show applied values
      setBrightness(response.adjustments_applied.brightness);
      setContrast(response.adjustments_applied.contrast);
      setSaturation(response.adjustments_applied.saturation);
      setSharpness(response.adjustments_applied.sharpness);
      
      toast.success(`Auto-enhanced in ${response.processing_time_ms}ms`);
      await loadPhotos();
    } catch (error) {
      toast.error(error.message || "Auto-enhance failed");
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };
  
  // Batch AI Auto-Enhance
  const handleBatchAutoEnhance = async () => {
    const photosToEnhance = photos.filter(p => !p.auto_enhanced);
    
    if (photosToEnhance.length === 0) {
      toast.info("All photos already enhanced");
      return;
    }
    
    setIsBatchProcessing(true);
    setProcessingAction(`Auto-enhancing ${photosToEnhance.length} photos...`);
    
    try {
      const response = await apiRequest('/photo-editor/auto-enhance-batch', {
        method: 'POST',
        body: JSON.stringify({
          photo_ids: photosToEnhance.map(p => p.photo_id),
        }),
      });
      
      const { total_processed, total_failed, total_time_ms } = response;
      
      if (total_failed === 0) {
        toast.success(`All ${total_processed} photos enhanced in ${(total_time_ms / 1000).toFixed(1)}s`);
      } else {
        toast.warning(`${total_processed} enhanced, ${total_failed} failed`);
      }
      
      await loadPhotos();
    } catch (error) {
      toast.error(error.message || "Batch auto-enhance failed");
    } finally {
      setIsBatchProcessing(false);
      setProcessingAction('');
    }
  };
  
  // Apply adjustments
  const handleApplyAdjustments = async () => {
    if (!selectedPhoto) return;
    
    setIsProcessing(true);
    setProcessingAction('Applying adjustments...');
    
    try {
      await apiRequest('/photo-editor/adjust', {
        method: 'POST',
        body: JSON.stringify({
          photo_id: selectedPhoto.photo_id,
          brightness,
          contrast,
          saturation,
          sharpness,
        }),
      });
      
      toast.success("Adjustments applied");
      await loadPhotos();
    } catch (error) {
      toast.error(error.message || "Failed to apply adjustments");
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };
  
  // Apply background
  const handleApplyBackground = async (bgType, bgValue) => {
    if (!selectedPhoto || !selectedPhoto.has_background_removed) {
      toast.error("Remove background first");
      return;
    }
    
    setIsProcessing(true);
    setProcessingAction('Applying background...');
    
    try {
      await apiRequest('/photo-editor/apply-background', {
        method: 'POST',
        body: JSON.stringify({
          photo_id: selectedPhoto.photo_id,
          background_type: bgType,
          background_value: bgValue,
          background_scale: backgroundScale,
          background_offset_x: backgroundOffsetX,
          background_offset_y: backgroundOffsetY,
        }),
      });
      
      toast.success("Background applied");
      await loadPhotos();
      setSelectedBackground({ type: bgType, value: bgValue });
    } catch (error) {
      toast.error(error.message || "Failed to apply background");
    } finally {
      setIsProcessing(false);
      setProcessingAction('');
    }
  };
  
  // Custom background upload
  const handleCustomBackgroundUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target.result;
      setCustomBackground(base64);
      await handleApplyBackground('custom', base64);
    };
    reader.readAsDataURL(file);
  };
  
  // Reset photo
  const handleReset = async () => {
    if (!selectedPhoto) return;
    
    setIsProcessing(true);
    try {
      await apiRequest(`/photo-editor/reset/${selectedPhoto.photo_id}`, {
        method: 'POST',
      });
      
      toast.success("Photo reset to original");
      await loadPhotos();
      
      // Reset sliders
      setBrightness(1.0);
      setContrast(1.0);
      setSaturation(1.0);
      setSharpness(1.0);
      setSelectedBackground(null);
    } catch (error) {
      toast.error(error.message || "Reset failed");
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Undo last edit
  const handleUndo = async () => {
    if (!selectedPhoto) return;
    
    setIsProcessing(true);
    try {
      await apiRequest(`/photo-editor/undo/${selectedPhoto.photo_id}`, {
        method: 'POST',
      });
      
      toast.success("Last edit undone");
      await loadPhotos();
    } catch (error) {
      toast.error(error.message || "Undo failed");
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Delete photo
  const handleDeletePhoto = async (photoId) => {
    try {
      await apiRequest(`/photo-editor/photos/${photoId}`, {
        method: 'DELETE',
      });
      
      toast.success("Photo deleted");
      await loadPhotos();
      
      if (selectedPhotoIndex >= photos.length - 1) {
        setSelectedPhotoIndex(Math.max(0, photos.length - 2));
      }
    } catch (error) {
      toast.error(error.message || "Delete failed");
    }
  };
  
  // Finalize and complete
  const handleComplete = async () => {
    if (photos.length === 0) {
      toast.error("No photos to finalize");
      return;
    }
    
    setIsProcessing(true);
    try {
      const response = await apiRequest('/photo-editor/finalize', {
        method: 'POST',
        body: JSON.stringify({
          photo_ids: photos.map(p => p.photo_id),
        }),
      });
      
      toast.success(`${response.count} photo(s) ready for listing`);
      
      if (onComplete) {
        onComplete(response.finalized_photos);
      }
      
      onClose();
    } catch (error) {
      toast.error(error.message || "Finalization failed");
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Generate AI Listing from photos
  const [aiListingResult, setAiListingResult] = useState(null);
  const [isGeneratingListing, setIsGeneratingListing] = useState(false);
  
  const handleGenerateAIListing = async () => {
    if (photos.length === 0) {
      toast.error("Upload photos first");
      return;
    }
    
    setIsGeneratingListing(true);
    setProcessingAction('Generating AI Listing...');
    
    try {
      const response = await apiRequest('/photo-editor/generate-ai-listing', {
        method: 'POST',
        body: JSON.stringify({
          photo_ids: photos.map(p => p.photo_id),
          condition: 'like_new',
        }),
      });
      
      setAiListingResult(response.listing_data);
      toast.success("AI Listing generated!");
    } catch (error) {
      toast.error(error.message || "Failed to generate AI listing");
    } finally {
      setIsGeneratingListing(false);
      setProcessingAction('');
    }
  };
  
  // Save background preference
  const handleSavePreference = async () => {
    if (!selectedBackground) return;
    
    try {
      await apiRequest('/photo-editor/save-preference', {
        method: 'POST',
        body: JSON.stringify({
          background_type: selectedBackground.type,
          background_value: selectedBackground.value,
        }),
      });
      
      toast.success("Background preference saved");
    } catch (error) {
      toast.error("Failed to save preference");
    }
  };
  
  // Calculate stats for batch processing
  const photosWithBgRemoved = photos.filter(p => p.has_background_removed).length;
  const photosNeedingBgRemoval = photos.length - photosWithBgRemoved;
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" data-testid="photo-editor-modal">
      <div className="bg-background rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Palette className="w-6 h-6 text-pink-500" />
            <div>
              <h2 className="text-xl font-bold">Photo Editor</h2>
              <p className="text-sm text-muted-foreground">
                {photos.length}/10 photos • {photosWithBgRemoved} backgrounds removed
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="close-editor">
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Processing overlay */}
        {(isProcessing || isBatchProcessing) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background p-6 rounded-xl flex flex-col items-center gap-3 min-w-[300px]">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">{processingAction}</p>
              {isBatchProcessing && batchProgress.total > 0 && (
                <div className="w-full">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    {batchProgress.current} of {batchProgress.total}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Main content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left sidebar - Photo thumbnails */}
          <div className="w-32 border-r border-border p-2 overflow-y-auto">
            <div className="space-y-2">
              {photos.map((photo, index) => (
                <div key={photo.photo_id} className="group">
                  <PhotoThumbnail
                    photo={photo}
                    isSelected={selectedPhotoIndex === index}
                    onClick={() => setSelectedPhotoIndex(index)}
                    onDelete={handleDeletePhoto}
                  />
                </div>
              ))}
              
              {/* Add more photos button */}
              {photos.length < 10 && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary cursor-pointer flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                  <Upload className="w-5 h-5 mb-1" />
                  <span className="text-xs">Add</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    ref={fileInputRef}
                  />
                </label>
              )}
            </div>
          </div>
          
          {/* Center - Main preview */}
          <div className="flex-1 flex flex-col p-4">
            {selectedPhoto ? (
              <>
                {/* Preview area */}
                <div className="flex-1 flex items-center justify-center bg-muted/30 rounded-xl relative overflow-hidden">
                  <img
                    src={selectedPhoto.current_url}
                    alt="Preview"
                    className="max-w-full max-h-full object-contain"
                    style={{
                      background: selectedPhoto.has_background_removed 
                        ? 'repeating-conic-gradient(#80808040 0% 25%, transparent 0% 50%) 50% / 20px 20px'
                        : 'transparent'
                    }}
                    data-testid="photo-preview"
                  />
                </div>
                
                {/* Photo navigation */}
                {photos.length > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSelectedPhotoIndex(Math.max(0, selectedPhotoIndex - 1))}
                      disabled={selectedPhotoIndex === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {selectedPhotoIndex + 1} / {photos.length}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSelectedPhotoIndex(Math.min(photos.length - 1, selectedPhotoIndex + 1))}
                      disabled={selectedPhotoIndex === photos.length - 1}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              /* Upload area when no photos */
              <div className="flex-1 flex flex-col items-center justify-center">
                <label className="cursor-pointer w-full max-w-md">
                  <div className="border-2 border-dashed border-border hover:border-primary rounded-xl p-12 text-center transition-colors">
                    <Upload className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Upload Product Photos</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Drag & drop or click to upload up to 10 photos (max 60MB each)
                    </p>
                    <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Select Photos
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    ref={fileInputRef}
                  />
                </label>
              </div>
            )}
          </div>
          
          {/* Right sidebar - Tools */}
          <div className="w-80 border-l border-border overflow-y-auto">
            {/* Tabs */}
            <div className="flex border-b border-border">
              {[
                { id: 'edit', label: 'Edit', icon: Wand2 },
                { id: 'background', label: 'Background', icon: Layers },
                { id: 'ai-listing', label: 'AI Listing', icon: Sparkles },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                    activeTab === tab.id 
                      ? 'text-primary border-b-2 border-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Tab content */}
            <div className="p-4 space-y-6">
              {activeTab === 'edit' && !selectedPhoto && (
                <div className="text-center py-8">
                  <Wand2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h4 className="font-semibold mb-2">No Photo Selected</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload photos to start editing
                  </p>
                  <label className="cursor-pointer inline-block">
                    <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Photos
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              )}
              {activeTab === 'edit' && selectedPhoto && (
                <>
                  {/* Background Removal */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Wand2 className="w-4 h-4 text-purple-500" />

                      AI Background Removal
                    </h4>
                    
                    {/* Single photo removal */}
                    <Button
                      onClick={handleRemoveBackground}
                      disabled={isProcessing || isBatchProcessing || selectedPhoto?.has_background_removed}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      data-testid="remove-bg-btn"
                    >
                      {selectedPhoto?.has_background_removed ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Background Removed
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Remove Background
                        </>
                      )}
                    </Button>
                    
                    {/* Batch removal - show if multiple photos */}
                    {photos.length > 1 && (
                      <div className="mt-3 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-purple-300">
                            Batch Process All Photos
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {photosNeedingBgRemoval} remaining
                          </span>
                        </div>
                        <Button
                          onClick={handleBatchRemoveBackgrounds}
                          disabled={isProcessing || isBatchProcessing || photosNeedingBgRemoval === 0}
                          variant="outline"
                          className="w-full border-purple-500/50 hover:bg-purple-500/20"
                          data-testid="batch-remove-bg-btn"
                        >
                          {isBatchProcessing ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : photosNeedingBgRemoval === 0 ? (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              All Done!
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Remove All Backgrounds ({photosNeedingBgRemoval})
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2 text-center">
                          One click to process all photos
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* AI Auto-Enhance Section */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      AI Auto-Enhance
                    </h4>
                    
                    <div className="p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/20 mb-3">
                      <p className="text-xs text-muted-foreground mb-3">
                        Let AI analyze your photo and automatically optimize brightness, contrast, saturation, and sharpness for product photography.
                      </p>
                      
                      <Button
                        onClick={handleAutoEnhance}
                        disabled={isProcessing || isBatchProcessing || !selectedPhoto || selectedPhoto?.auto_enhanced}
                        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                        data-testid="auto-enhance-btn"
                      >
                        {selectedPhoto?.auto_enhanced ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Already Enhanced
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Auto-Enhance This Photo
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Batch Auto-Enhance */}
                    {photos.length > 1 && (
                      <Button
                        onClick={handleBatchAutoEnhance}
                        disabled={isProcessing || isBatchProcessing}
                        variant="outline"
                        className="w-full border-amber-500/50 hover:bg-amber-500/20"
                        data-testid="batch-auto-enhance-btn"
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Auto-Enhance All Photos ({photos.filter(p => !p.auto_enhanced).length})
                      </Button>
                    )}
                  </div>
                  
                  {/* Manual Adjustments */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Sun className="w-4 h-4 text-yellow-500" />
                      Manual Adjustments
                    </h4>
                    
                    <div className="space-y-4">
                      {/* Brightness */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Sun className="w-3 h-3" /> Brightness
                          </label>
                          <span className="text-xs font-mono">{brightness.toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[brightness]}
                          onValueChange={([v]) => setBrightness(v)}
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          data-testid="brightness-slider"
                        />
                      </div>
                      
                      {/* Contrast */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Contrast className="w-3 h-3" /> Contrast
                          </label>
                          <span className="text-xs font-mono">{contrast.toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[contrast]}
                          onValueChange={([v]) => setContrast(v)}
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          data-testid="contrast-slider"
                        />
                      </div>
                      
                      {/* Saturation */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Droplets className="w-3 h-3" /> Saturation
                          </label>
                          <span className="text-xs font-mono">{saturation.toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[saturation]}
                          onValueChange={([v]) => setSaturation(v)}
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          data-testid="saturation-slider"
                        />
                      </div>
                      
                      {/* Sharpness */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Focus className="w-3 h-3" /> Sharpness
                          </label>
                          <span className="text-xs font-mono">{sharpness.toFixed(1)}</span>
                        </div>
                        <Slider
                          value={[sharpness]}
                          onValueChange={([v]) => setSharpness(v)}
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          data-testid="sharpness-slider"
                        />
                      </div>
                      
                      <Button
                        onClick={handleApplyAdjustments}
                        disabled={isProcessing}
                        className="w-full"
                        variant="outline"
                        data-testid="apply-adjustments-btn"
                      >
                        Apply Adjustments
                      </Button>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={handleUndo} disabled={isProcessing}>
                      <Undo2 className="w-4 h-4 mr-1" /> Undo
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={handleReset} disabled={isProcessing}>
                      <RotateCcw className="w-4 h-4 mr-1" /> Reset
                    </Button>
                  </div>
                </>
              )}
              
              {activeTab === 'background' && selectedPhoto && (
                <>
                  {!selectedPhoto.has_background_removed && (
                    <Card className="bg-amber-500/10 border-amber-500/30">
                      <CardContent className="p-4 text-center">
                        <Wand2 className="w-8 h-8 mx-auto text-amber-500 mb-2" />
                        <p className="text-sm text-amber-500">
                          Remove the background first to apply a custom background
                        </p>
                        <Button
                          onClick={handleRemoveBackground}
                          className="mt-3"
                          size="sm"
                        >
                          Remove Background
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                  
                  {selectedPhoto.has_background_removed && (
                    <>
                      {/* Solid Colors */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Solid Colors</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {BACKGROUND_PRESETS.solid.map(bg => (
                            <button
                              key={bg.id}
                              onClick={() => handleApplyBackground('solid', bg.color)}
                              className={`aspect-square rounded-lg transition-transform hover:scale-105 ${
                                selectedBackground?.value === bg.color ? 'ring-2 ring-primary' : ''
                              }`}
                              style={{ backgroundColor: bg.color }}
                              title={bg.name}
                              data-testid={`bg-${bg.id}`}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* Gradients */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Gradients</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {BACKGROUND_PRESETS.gradient.map(bg => (
                            <button
                              key={bg.id}
                              onClick={() => handleApplyBackground('gradient', bg.id)}
                              className={`aspect-square rounded-lg transition-transform hover:scale-105 ${
                                selectedBackground?.value === bg.id ? 'ring-2 ring-primary' : ''
                              }`}
                              style={{
                                background: `linear-gradient(135deg, ${bg.colors[0]}, ${bg.colors[1]})`
                              }}
                              title={bg.name}
                              data-testid={`bg-${bg.id}`}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* Patterns */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Patterns</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {BACKGROUND_PRESETS.pattern.map(bg => (
                            <button
                              key={bg.id}
                              onClick={() => handleApplyBackground('pattern', bg.id)}
                              className={`aspect-square rounded-lg bg-muted flex items-center justify-center transition-transform hover:scale-105 ${
                                selectedBackground?.value === bg.id ? 'ring-2 ring-primary' : ''
                              }`}
                              title={bg.name}
                              data-testid={`bg-${bg.id}`}
                            >
                              <Grid className="w-4 h-4 text-muted-foreground" />
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      {/* Custom upload */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Custom Background</h4>
                        <label className="cursor-pointer">
                          <div className="border-2 border-dashed border-border hover:border-primary rounded-lg p-4 text-center transition-colors">
                            <Upload className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                            <span className="text-sm text-muted-foreground">Upload custom image</span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleCustomBackgroundUpload}
                            ref={customBgInputRef}
                          />
                        </label>
                      </div>
                      
                      {/* Background positioning */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Move className="w-4 h-4" /> Position & Scale
                        </h4>
                        
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs text-muted-foreground">Scale</label>
                              <span className="text-xs font-mono">{backgroundScale.toFixed(1)}x</span>
                            </div>
                            <Slider
                              value={[backgroundScale]}
                              onValueChange={([v]) => setBackgroundScale(v)}
                              min={0.5}
                              max={2.0}
                              step={0.1}
                            />
                          </div>
                        </div>
                      </div>
                      
                      {/* Save preference */}
                      {selectedBackground && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={handleSavePreference}
                        >
                          Save as Default Background
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
              
              {/* AI Listing Tab */}
              {activeTab === 'ai-listing' && (
                <div className="space-y-4">
                  <div className="text-center p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/20">
                    <Sparkles className="w-10 h-10 mx-auto text-amber-500 mb-3" />
                    <h4 className="font-semibold mb-2">AI Listing Generator</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Let AI analyze your photos and generate a complete listing with title, description, dimensions, and price suggestions
                    </p>
                    
                    <Button
                      onClick={handleGenerateAIListing}
                      disabled={photos.length === 0 || isGeneratingListing || isProcessing}
                      className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
                      data-testid="generate-ai-listing-btn"
                    >
                      {isGeneratingListing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing Photos...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate AI Listing ({photos.length} photo{photos.length !== 1 ? 's' : ''})
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {/* AI Result Display */}
                  {aiListingResult && (
                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                      <h5 className="font-semibold text-sm flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500" />
                        AI Generated Listing
                      </h5>
                      
                      {aiListingResult.title && (
                        <div>
                          <label className="text-xs text-muted-foreground">Title</label>
                          <p className="font-medium text-sm">{aiListingResult.title}</p>
                        </div>
                      )}
                      
                      {aiListingResult.description && (
                        <div>
                          <label className="text-xs text-muted-foreground">Description</label>
                          <p className="text-sm whitespace-pre-wrap">{aiListingResult.description}</p>
                        </div>
                      )}
                      
                      {aiListingResult.price_suggestion && (
                        <div>
                          <label className="text-xs text-muted-foreground">Suggested Price</label>
                          <p className="font-bold text-green-500">{aiListingResult.price_suggestion}</p>
                        </div>
                      )}
                      
                      {aiListingResult.dimensions && (
                        <div>
                          <label className="text-xs text-muted-foreground">Dimensions</label>
                          <p className="text-sm">{aiListingResult.dimensions}</p>
                        </div>
                      )}
                      
                      {aiListingResult.weight && (
                        <div>
                          <label className="text-xs text-muted-foreground">Weight</label>
                          <p className="text-sm">{aiListingResult.weight}</p>
                        </div>
                      )}
                      
                      {aiListingResult.category && (
                        <div>
                          <label className="text-xs text-muted-foreground">Category</label>
                          <p className="text-sm">{aiListingResult.category}</p>
                        </div>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => {
                          // Copy to clipboard
                          const text = `Title: ${aiListingResult.title || ''}\n\nDescription: ${aiListingResult.description || ''}\n\nPrice: ${aiListingResult.price_suggestion || ''}\n\nDimensions: ${aiListingResult.dimensions || ''}\nWeight: ${aiListingResult.weight || ''}`;
                          navigator.clipboard.writeText(text);
                          toast.success("Listing copied to clipboard!");
                        }}
                      >
                        Copy to Clipboard
                      </Button>
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground text-center">
                    AI analysis uses GPT-4o Vision for accurate product detection
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {photos.length > 0 ? (
              <span>{photos.filter(p => p.has_background_removed).length} of {photos.length} backgrounds removed</span>
            ) : (
              <span>Upload photos to get started</span>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={photos.length === 0 || isProcessing}
              className="bg-gradient-to-r from-green-600 to-emerald-600"
              data-testid="finalize-photos-btn"
            >
              <Check className="w-4 h-4 mr-2" />
              Use {photos.length} Photo{photos.length !== 1 ? 's' : ''} for Listing
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
