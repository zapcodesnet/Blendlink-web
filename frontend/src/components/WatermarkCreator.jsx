import React, { useState, useRef, useEffect } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { 
  Type, Move, RotateCw, Eye, Save, Trash2, 
  Plus, Check, X
} from "lucide-react";
import { toast } from "sonner";
import { watermarkAPI } from "../services/mediaSalesApi";

const FONTS = [
  { value: "Arial", label: "Arial" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Georgia", label: "Georgia" },
  { value: "Verdana", label: "Verdana" },
  { value: "Courier New", label: "Courier New" },
  { value: "Impact", label: "Impact" },
  { value: "Comic Sans MS", label: "Comic Sans" },
];

const SAMPLE_IMAGE = "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop";

export default function WatermarkCreator({ onSave, editTemplate = null, onClose }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const [template, setTemplate] = useState({
    name: editTemplate?.name || "My Watermark",
    text: editTemplate?.text || "© Your Name",
    font_family: editTemplate?.font_family || "Arial",
    font_size: editTemplate?.font_size || 32,
    color: editTemplate?.color || "#ffffff",
    opacity: editTemplate?.opacity || 0.2,
    position_x: editTemplate?.position_x || 50,
    position_y: editTemplate?.position_y || 90,
    rotation: editTemplate?.rotation || 0,
    is_default: editTemplate?.is_default || false,
  });
  
  const [saving, setSaving] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Draw watermark on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;

    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image
      ctx.drawImage(img, 0, 0);
      
      // Draw watermark
      ctx.save();
      
      // Calculate position
      const x = (template.position_x / 100) * canvas.width;
      const y = (template.position_y / 100) * canvas.height;
      
      // Apply transformations
      ctx.translate(x, y);
      ctx.rotate((template.rotation * Math.PI) / 180);
      
      // Set text style
      ctx.font = `${template.font_size}px ${template.font_family}`;
      ctx.fillStyle = template.color;
      ctx.globalAlpha = template.opacity;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // Add shadow for visibility
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      
      // Draw text
      ctx.fillText(template.text, 0, 0);
      
      ctx.restore();
    };
    
    img.src = SAMPLE_IMAGE;
  }, [template, imageLoaded]);

  // Load image initially
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImageLoaded(true);
    img.src = SAMPLE_IMAGE;
  }, []);

  // Handle drag
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const wmX = (template.position_x / 100) * canvas.width;
    const wmY = (template.position_y / 100) * canvas.height;
    
    // Check if click is near watermark
    const distance = Math.sqrt((x - wmX) ** 2 + (y - wmY) ** 2);
    if (distance < 100) {
      setIsDragging(true);
      setDragOffset({ x: x - wmX, y: y - wmY });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX - dragOffset.x;
    const y = (e.clientY - rect.top) * scaleY - dragOffset.y;
    
    setTemplate(prev => ({
      ...prev,
      position_x: Math.max(0, Math.min(100, (x / canvas.width) * 100)),
      position_y: Math.max(0, Math.min(100, (y / canvas.height) * 100)),
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleSave = async () => {
    if (!template.text.trim()) {
      toast.error("Please enter watermark text");
      return;
    }
    
    setSaving(true);
    try {
      if (editTemplate?.watermark_id) {
        await watermarkAPI.updateTemplate(editTemplate.watermark_id, template);
        toast.success("Watermark updated!");
      } else {
        const result = await watermarkAPI.createTemplate(template);
        toast.success("Watermark created!");
        if (onSave) onSave(result);
      }
      if (onClose) onClose();
    } catch (error) {
      toast.error(error.message || "Failed to save watermark");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-lg">
          {editTemplate ? "Edit Watermark" : "Create Watermark"}
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        )}
      </div>
      
      <div className="grid md:grid-cols-2 gap-6 p-4">
        {/* Preview */}
        <div className="space-y-4">
          <Label>Preview (Drag to position)</Label>
          <div 
            ref={containerRef}
            className="relative rounded-lg overflow-hidden bg-muted cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <canvas 
              ref={canvasRef}
              className="w-full h-auto"
              style={{ maxHeight: "400px", objectFit: "contain" }}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Click and drag the watermark to reposition it
          </p>
        </div>

        {/* Controls */}
        <div className="space-y-5">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              placeholder="My Watermark"
              data-testid="watermark-name"
            />
          </div>

          {/* Watermark Text */}
          <div className="space-y-2">
            <Label htmlFor="text">Watermark Text</Label>
            <Input
              id="text"
              value={template.text}
              onChange={(e) => setTemplate({ ...template, text: e.target.value })}
              placeholder="© Your Name 2026"
              data-testid="watermark-text"
            />
          </div>

          {/* Font */}
          <div className="space-y-2">
            <Label>Font</Label>
            <select
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
              value={template.font_family}
              onChange={(e) => setTemplate({ ...template, font_family: e.target.value })}
              data-testid="watermark-font"
            >
              {FONTS.map(font => (
                <option key={font.value} value={font.value} style={{ fontFamily: font.value }}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <Label>Size: {template.font_size}px</Label>
            <Slider
              value={[template.font_size]}
              onValueChange={([value]) => setTemplate({ ...template, font_size: value })}
              min={12}
              max={72}
              step={1}
              data-testid="watermark-size"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={template.color}
                onChange={(e) => setTemplate({ ...template, color: e.target.value })}
                className="w-12 h-10 rounded border border-input cursor-pointer"
                data-testid="watermark-color"
              />
              <Input
                value={template.color}
                onChange={(e) => setTemplate({ ...template, color: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>

          {/* Opacity (Transparency) */}
          <div className="space-y-2">
            <Label>
              Transparency: {Math.round((1 - template.opacity) * 100)}%
              <span className="text-xs text-muted-foreground ml-2">(70-90% recommended)</span>
            </Label>
            <Slider
              value={[template.opacity]}
              onValueChange={([value]) => setTemplate({ ...template, opacity: value })}
              min={0.1}
              max={0.3}
              step={0.01}
              data-testid="watermark-opacity"
            />
          </div>

          {/* Rotation */}
          <div className="space-y-2">
            <Label>Rotation: {template.rotation}°</Label>
            <Slider
              value={[template.rotation]}
              onValueChange={([value]) => setTemplate({ ...template, rotation: value })}
              min={-45}
              max={45}
              step={1}
              data-testid="watermark-rotation"
            />
          </div>

          {/* Default Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              checked={template.is_default}
              onChange={(e) => setTemplate({ ...template, is_default: e.target.checked })}
              className="w-4 h-4 rounded border-input"
              data-testid="watermark-default"
            />
            <Label htmlFor="is_default" className="cursor-pointer">
              Set as default watermark
            </Label>
          </div>

          {/* Save Button */}
          <Button 
            className="w-full" 
            onClick={handleSave} 
            disabled={saving}
            data-testid="save-watermark-btn"
          >
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Watermark
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
