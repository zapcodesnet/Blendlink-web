/**
 * Barcode & AI Scanner Component
 * Section 2: Barcode scanning and AI item recognition
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { safeFetch } from "../../services/memberPagesApi";
import {
  ScanLine, Camera, Upload, Search, Loader2, Package, Check,
  ShoppingCart, X, Sparkles, QrCode
} from "lucide-react";
import { getApiUrl } from "../../utils/runtimeConfig";

const API_URL = getApiUrl();

export default function ScannerTools({ pageId, pageType, onItemFound }) {
  const [activeTab, setActiveTab] = useState("barcode"); // barcode, ai
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Barcode search - PRODUCTION FIX: uses safeFetch
  const searchByBarcode = async (barcode) => {
    if (!barcode.trim()) return;
    
    setScanning(true);
    setResult(null);
    
    try {
      const data = await safeFetch(`${API_URL}/api/barcode/search`, {
        method: "POST",
        body: JSON.stringify({ barcode: barcode.trim(), page_id: pageId })
      });
      setResult(data);
      
      if (data.found && onItemFound) {
        onItemFound(data.item, data.item_type);
      }
    } catch (err) {
      toast.error("Failed to search barcode");
    }
    setScanning(false);
  };

  // AI Scan with image - PRODUCTION FIX: uses safeFetch
  const scanWithAI = async (imageBase64) => {
    setScanning(true);
    setResult(null);
    
    try {
      // Remove data URL prefix if present
      const base64Data = imageBase64.includes(',') 
        ? imageBase64.split(',')[1] 
        : imageBase64;
      
      const data = await safeFetch(`${API_URL}/api/ai-scan/scan`, {
        method: "POST",
        body: JSON.stringify({
          image_base64: base64Data,
          page_id: pageId,
          scan_type: "identify"
        })
      });
      setResult(data);
      
      if (data.success && data.matched && data.item && onItemFound) {
        onItemFound(data.item, data.item.type);
        toast.success(`Found: ${data.item.name}`);
      } else if (data.success && !data.matched) {
        toast.info("No matching item found in your inventory");
      }
    } catch (err) {
      toast.error("AI scan failed");
    }
    setScanning(false);
  };

  // Start camera for AI scan
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      toast.error("Could not access camera");
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Capture photo from camera
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    stopCamera();
    scanWithAI(imageData);
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      scanWithAI(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="space-y-6">
      {/* Tab Selector */}
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setActiveTab("barcode")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
            activeTab === "barcode" ? "bg-background shadow-sm" : "hover:bg-background/50"
          }`}
        >
          <QrCode className="w-4 h-4" />
          Barcode Scan
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors ${
            activeTab === "ai" ? "bg-background shadow-sm" : "hover:bg-background/50"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          AI Scan
        </button>
      </div>

      {/* Barcode Tab */}
      {activeTab === "barcode" && (
        <div className="space-y-4">
          <div className="text-center p-6 bg-muted/30 rounded-xl border border-dashed border-border">
            <ScanLine className="w-12 h-12 text-primary mx-auto mb-3" />
            <p className="font-medium mb-2">Enter or Scan Barcode</p>
            <p className="text-sm text-muted-foreground mb-4">
              Type the barcode number or use a scanner
            </p>
            
            <div className="flex gap-2 max-w-sm mx-auto">
              <Input
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Enter barcode..."
                onKeyDown={(e) => e.key === "Enter" && searchByBarcode(barcodeInput)}
                className="text-center font-mono"
                data-testid="barcode-input"
              />
              <Button onClick={() => searchByBarcode(barcodeInput)} disabled={scanning}>
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Scan Tab */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          {!cameraActive ? (
            <div className="text-center p-6 bg-muted/30 rounded-xl border border-dashed border-border">
              <Sparkles className="w-12 h-12 text-primary mx-auto mb-3" />
              <p className="font-medium mb-2">AI Item Recognition</p>
              <p className="text-sm text-muted-foreground mb-4">
                Take a photo or upload an image to identify items in your inventory
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={startCamera}>
                  <Camera className="w-4 h-4 mr-2" /> Use Camera
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" /> Upload Image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-h-80 object-contain"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Camera overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border-2 border-white/50 rounded-lg">
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-primary" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-primary" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-primary" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-primary" />
                </div>
              </div>
              
              {/* Camera controls */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                <Button variant="secondary" onClick={stopCamera}>
                  <X className="w-4 h-4 mr-2" /> Cancel
                </Button>
                <Button onClick={capturePhoto} disabled={scanning}>
                  {scanning ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Camera className="w-4 h-4 mr-2" />
                  )}
                  Capture
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result Display */}
      {scanning && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary mr-3" />
          <span>Searching...</span>
        </div>
      )}

      {result && !scanning && (
        <div className={`rounded-xl border p-4 ${
          (result.found || result.matched) 
            ? "bg-green-50 border-green-200" 
            : "bg-amber-50 border-amber-200"
        }`}>
          {(result.found || result.matched) ? (
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-green-800">Item Found!</p>
                <p className="text-lg font-medium mt-1">
                  {result.item?.name}
                </p>
                <p className="text-sm text-green-700">
                  ${result.item?.price?.toFixed(2)} • {result.item_type || result.item?.type}
                </p>
                {result.confidence && (
                  <p className="text-xs text-green-600 mt-1">
                    Confidence: {(result.confidence * 100).toFixed(0)}%
                  </p>
                )}
                {result.ai_description && (
                  <p className="text-sm text-muted-foreground mt-2 italic">
                    "{result.ai_description}"
                  </p>
                )}
              </div>
              <Button size="sm" className="bg-green-600 hover:bg-green-700">
                <ShoppingCart className="w-4 h-4 mr-1" /> Add to Cart
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-800">No Match Found</p>
                <p className="text-sm text-amber-700 mt-1">
                  {result.message || result.ai_description || "This item is not in your inventory"}
                </p>
                {result.ai_description && activeTab === "ai" && (
                  <p className="text-sm text-muted-foreground mt-2 italic">
                    AI saw: "{result.ai_description}"
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
