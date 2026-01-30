/**
 * ProfilePictureEditor Component
 * 
 * Enhanced profile picture editor with:
 * - Drag/slide controls to position image within circular frame
 * - Zoom controls
 * - Preserves original orientation (Landscape/Portrait)
 * - Save Changes button
 * - Preview of circular crop
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Check, Move, ZoomIn, ZoomOut, RotateCcw,
  Loader2, Image as ImageIcon, Maximize2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Slider } from '../components/ui/slider';

const ProfilePictureEditor = ({ 
  photo, // Selected minted photo
  isOpen, 
  onClose, 
  onSave,
  saving = false,
}) => {
  // Position and zoom state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0, isLandscape: true });
  
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  
  // Circle frame size (responsive)
  const FRAME_SIZE = 200;
  
  // Track previous photo for reset
  const [prevPhotoId, setPrevPhotoId] = useState(null);
  
  // Reset position when photo changes - use callback to avoid cascading
  const resetIfPhotoChanged = useCallback(() => {
    if (photo?.mint_id && photo.mint_id !== prevPhotoId) {
      setPrevPhotoId(photo.mint_id);
      setPosition({ x: 0, y: 0 });
      setZoom(1);
      setImageLoaded(false);
    }
  }, [photo?.mint_id, prevPhotoId]);
  
  // Call reset on mount when photo is available
  useEffect(() => {
    resetIfPhotoChanged();
  }, [resetIfPhotoChanged]);
  
  // Handle image load to get dimensions
  const handleImageLoad = (e) => {
    const img = e.target;
    const isLandscape = img.naturalWidth >= img.naturalHeight;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
      isLandscape
    });
    setImageLoaded(true);
    
    // Auto-fit: Calculate initial zoom to fill the circle
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    if (isLandscape) {
      // Landscape: height should match frame
      setZoom(FRAME_SIZE / img.naturalHeight * 1.2);
    } else {
      // Portrait: width should match frame
      setZoom(FRAME_SIZE / img.naturalWidth * 1.2);
    }
  };
  
  // Mouse/touch drag handlers
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  }, [position]);
  
  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Calculate new position with bounds
    const newX = clientX - dragStart.x;
    const newY = clientY - dragStart.y;
    
    // Limit movement based on image size and zoom
    const maxOffset = (imageDimensions.width * zoom - FRAME_SIZE) / 2;
    const maxOffsetY = (imageDimensions.height * zoom - FRAME_SIZE) / 2;
    
    setPosition({
      x: Math.max(-maxOffset, Math.min(maxOffset, newX)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newY))
    });
  }, [isDragging, dragStart, imageDimensions, zoom]);
  
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Zoom handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  };
  
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };
  
  const handleZoomChange = (value) => {
    setZoom(value[0]);
  };
  
  // Reset to center
  const handleReset = () => {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  };
  
  // Save handler
  const handleSave = () => {
    if (onSave) {
      onSave({
        photo,
        position,
        zoom,
        // Pass crop data for backend processing if needed
        cropData: {
          x: position.x,
          y: position.y,
          zoom,
          frameSize: FRAME_SIZE
        }
      });
    }
  };
  
  if (!isOpen || !photo) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md bg-gray-900 rounded-2xl overflow-hidden border border-gray-700"
          data-testid="profile-picture-editor"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Move className="w-5 h-5 text-purple-400" />
              Adjust Profile Picture
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* Editor Area */}
          <div className="p-6 flex flex-col items-center gap-6">
            {/* Circular frame with draggable image */}
            <div 
              ref={containerRef}
              className="relative overflow-hidden rounded-full border-4 border-purple-500 shadow-lg shadow-purple-500/30"
              style={{ 
                width: FRAME_SIZE, 
                height: FRAME_SIZE,
                cursor: isDragging ? 'grabbing' : 'grab'
              }}
              onMouseDown={handleDragStart}
              onMouseMove={handleDragMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              {/* Draggable Image */}
              <img
                ref={imageRef}
                src={photo.image_url}
                alt={photo.name}
                className="absolute select-none"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  left: '50%',
                  top: '50%',
                  marginLeft: `-${imageDimensions.width / 2}px`,
                  marginTop: `-${imageDimensions.height / 2}px`,
                  maxWidth: 'none',
                  maxHeight: 'none',
                }}
                onLoad={handleImageLoad}
                draggable={false}
              />
              
              {/* Loading state */}
              {!imageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </div>
              )}
              
              {/* Drag hint overlay */}
              {imageLoaded && !isDragging && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-black/50 rounded-full p-2 opacity-50">
                    <Move className="w-6 h-6 text-white" />
                  </div>
                </div>
              )}
            </div>
            
            {/* Orientation indicator */}
            {imageLoaded && (
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <Maximize2 className="w-3 h-3" />
                {imageDimensions.isLandscape ? 'Landscape' : 'Portrait'} • 
                {imageDimensions.width} × {imageDimensions.height}px
              </div>
            )}
            
            {/* Zoom Controls */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-sm text-gray-400">
                <span>Zoom</span>
                <span>{(zoom * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-gray-600"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Slider
                  value={[zoom]}
                  min={0.5}
                  max={3}
                  step={0.1}
                  onValueChange={handleZoomChange}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-gray-600"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Reset Button */}
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white"
              onClick={handleReset}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Position
            </Button>
            
            {/* Instructions */}
            <p className="text-xs text-gray-500 text-center">
              Drag to position • Pinch or use slider to zoom
            </p>
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-gray-700 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-gray-600"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              onClick={handleSave}
              disabled={saving || !imageLoaded}
              data-testid="save-profile-picture-btn"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ProfilePictureEditor;
