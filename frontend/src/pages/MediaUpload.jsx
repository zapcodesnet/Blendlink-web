import React, { useState, useRef, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { 
  Upload, Image, Video, ArrowLeft, Plus, Check, 
  Eye, Lock, Globe, Folder, DollarSign
} from "lucide-react";
import { watermarkAPI, mediaAPI } from "../services/mediaSalesApi";
import WatermarkCreator from "../components/WatermarkCreator";

export default function MediaUploadPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [step, setStep] = useState(1); // 1: select file, 2: configure watermark, 3: details
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [watermarkedPreview, setWatermarkedPreview] = useState(null);
  const [watermarks, setWatermarks] = useState([]);
  const [selectedWatermark, setSelectedWatermark] = useState(null);
  const [showWatermarkCreator, setShowWatermarkCreator] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [mediaData, setMediaData] = useState({
    title: "",
    description: "",
    privacy: "public",
    album_id: null,
    fixed_price: null, // null = no price (just offers), number = marketplace price
  });

  // Load watermark templates
  useEffect(() => {
    loadWatermarks();
  }, []);

  const loadWatermarks = async () => {
    try {
      const templates = await watermarkAPI.getTemplates();
      setWatermarks(templates);
      // Select default if available
      const defaultWm = templates.find(w => w.is_default);
      if (defaultWm) setSelectedWatermark(defaultWm);
      else if (templates.length > 0) setSelectedWatermark(templates[0]);
    } catch (error) {
      console.error("Failed to load watermarks:", error);
    }
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    // Validate file type
    const isImage = selected.type.startsWith("image/");
    const isVideo = selected.type.startsWith("video/");
    
    if (!isImage && !isVideo) {
      toast.error("Please select an image or video file");
      return;
    }

    setFile(selected);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
      setStep(2);
    };
    reader.readAsDataURL(selected);
  };

  // Apply watermark to image
  useEffect(() => {
    if (!preview || !selectedWatermark || !file?.type.startsWith("image/")) {
      setWatermarkedPreview(preview);
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw original image
      ctx.drawImage(img, 0, 0);
      
      // Apply watermark
      const wm = selectedWatermark;
      const x = (wm.position_x / 100) * canvas.width;
      const y = (wm.position_y / 100) * canvas.height;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((wm.rotation * Math.PI) / 180);
      
      ctx.font = `${wm.font_size}px ${wm.font_family}`;
      ctx.fillStyle = wm.color;
      ctx.globalAlpha = wm.opacity;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      ctx.fillText(wm.text, 0, 0);
      ctx.restore();
      
      setWatermarkedPreview(canvas.toDataURL("image/jpeg", 0.9));
    };
    
    img.src = preview;
  }, [preview, selectedWatermark, file]);

  const handleUpload = async () => {
    if (!file || !selectedWatermark) {
      toast.error("Please select a file and watermark");
      return;
    }

    if (!mediaData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setUploading(true);
    try {
      // In a real app, you'd upload the files to cloud storage
      // For now, we'll use the data URLs as placeholders
      const uploadData = {
        title: mediaData.title,
        description: mediaData.description,
        media_type: file.type.startsWith("image/") ? "photo" : "video",
        original_url: preview, // Would be cloud storage URL
        watermarked_url: watermarkedPreview || preview, // Would be cloud storage URL
        thumbnail_url: watermarkedPreview || preview,
        watermark_id: selectedWatermark.watermark_id,
        watermark_config: selectedWatermark,
        privacy: mediaData.privacy,
        album_id: mediaData.album_id,
        fixed_price: mediaData.fixed_price,
      };

      const result = await mediaAPI.upload(uploadData);
      
      toast.success(
        result.is_for_sale 
          ? "Media uploaded and listed for sale!" 
          : "Media uploaded successfully!"
      );
      
      navigate("/my-media");
    } catch (error) {
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-bold">Upload Media</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div className={`w-16 h-1 mx-2 rounded ${step > s ? "bg-primary" : "bg-muted"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: Select File */}
        {step === 1 && (
          <div className="text-center py-12">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div 
              className="border-2 border-dashed border-border rounded-2xl p-12 cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="file-dropzone"
            >
              <Upload className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold text-lg mb-2">Select Photo or Video</h3>
              <p className="text-muted-foreground mb-4">
                Click to browse or drag and drop
              </p>
              <div className="flex gap-4 justify-center">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Image className="w-4 h-4" />
                  Photos
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Video className="w-4 h-4" />
                  Videos
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Configure Watermark */}
        {step === 2 && (
          <div className="space-y-6">
            {showWatermarkCreator ? (
              <WatermarkCreator
                onSave={() => {
                  setShowWatermarkCreator(false);
                  loadWatermarks();
                }}
                onClose={() => setShowWatermarkCreator(false)}
              />
            ) : (
              <>
                {/* Preview */}
                <div className="bg-card rounded-xl border border-border p-4">
                  <Label className="mb-3 block">Preview with Watermark</Label>
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    {file?.type.startsWith("image/") ? (
                      <img 
                        src={watermarkedPreview || preview} 
                        alt="Preview" 
                        className="w-full max-h-[400px] object-contain mx-auto"
                      />
                    ) : (
                      <video 
                        src={preview} 
                        controls 
                        className="w-full max-h-[400px] mx-auto"
                      />
                    )}
                  </div>
                </div>

                {/* Watermark Selection */}
                <div className="bg-card rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-4">
                    <Label>Select Watermark</Label>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowWatermarkCreator(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      New Watermark
                    </Button>
                  </div>
                  
                  {watermarks.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No watermarks yet</p>
                      <Button onClick={() => setShowWatermarkCreator(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Watermark
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {watermarks.map((wm) => (
                        <button
                          key={wm.watermark_id}
                          onClick={() => setSelectedWatermark(wm)}
                          className={`p-4 rounded-lg border text-left transition-all ${
                            selectedWatermark?.watermark_id === wm.watermark_id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          data-testid={`watermark-${wm.watermark_id}`}
                        >
                          <p className="font-medium text-sm truncate">{wm.name}</p>
                          <p className="text-xs text-muted-foreground truncate mt-1">
                            "{wm.text}"
                          </p>
                          {wm.is_default && (
                            <span className="text-xs text-primary">Default</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button 
                    className="flex-1" 
                    onClick={() => setStep(3)}
                    disabled={!selectedWatermark}
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Details */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Preview */}
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="relative rounded-lg overflow-hidden bg-muted max-h-[200px]">
                <img 
                  src={watermarkedPreview || preview} 
                  alt="Preview" 
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Form */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={mediaData.title}
                  onChange={(e) => setMediaData({ ...mediaData, title: e.target.value })}
                  placeholder="Give your media a title"
                  data-testid="media-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={mediaData.description}
                  onChange={(e) => setMediaData({ ...mediaData, description: e.target.value })}
                  placeholder="Describe your photo or video..."
                  rows={3}
                  data-testid="media-description"
                />
              </div>

              {/* Privacy */}
              <div className="space-y-2">
                <Label>Privacy</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMediaData({ ...mediaData, privacy: "public" })}
                    className={`p-4 rounded-lg border flex items-center gap-3 ${
                      mediaData.privacy === "public"
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    data-testid="privacy-public"
                  >
                    <Globe className="w-5 h-5 text-green-500" />
                    <div className="text-left">
                      <p className="font-medium text-sm">Public</p>
                      <p className="text-xs text-muted-foreground">Listed for sale</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setMediaData({ ...mediaData, privacy: "private" })}
                    className={`p-4 rounded-lg border flex items-center gap-3 ${
                      mediaData.privacy === "private"
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                    data-testid="privacy-private"
                  >
                    <Lock className="w-5 h-5 text-orange-500" />
                    <div className="text-left">
                      <p className="font-medium text-sm">Private</p>
                      <p className="text-xs text-muted-foreground">Only you can see</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Fixed Price (optional) */}
              {mediaData.privacy === "public" && (
                <div className="space-y-2">
                  <Label htmlFor="price">
                    Fixed Price (Optional)
                    <span className="text-xs text-muted-foreground ml-2">
                      Leave empty to accept offers only
                    </span>
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="price"
                      type="number"
                      min="0"
                      step="0.01"
                      className="pl-8"
                      value={mediaData.fixed_price || ""}
                      onChange={(e) => setMediaData({ 
                        ...mediaData, 
                        fixed_price: e.target.value ? parseFloat(e.target.value) : null 
                      })}
                      placeholder="0.00"
                      data-testid="media-price"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {mediaData.fixed_price 
                      ? "Buyers can purchase at this price or make offers"
                      : "Anyone can make an offer to purchase your media"}
                  </p>
                </div>
              )}
            </div>

            {/* Info Banner */}
            {mediaData.privacy === "public" && (
              <div className="bg-amber-500/10 rounded-xl p-4 flex items-start gap-3">
                <Eye className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">
                    Public watermarked media is automatically listed for sale
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Other users can make offers to buy your original unwatermarked media.
                    When you accept an offer and the buyer completes payment, you'll both
                    e-sign a copyright transfer contract.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleUpload}
                disabled={uploading || !mediaData.title.trim()}
                data-testid="upload-btn"
              >
                {uploading ? "Uploading..." : "Upload Media"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
