/**
 * AIPhotoTransform Component
 * 
 * Optional step during minting to transform photos using AI.
 * - Text input for transformation description
 * - Generates 2-4 AI variations
 * - User selects one or keeps original
 * - Max 3 generations per mint session
 */

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wand2, Sparkles, RefreshCw, Check, X, 
  ChevronLeft, ChevronRight, Loader2, AlertCircle,
  SkipForward, Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import api from '../../services/api';

// Example prompts for inspiration
const EXAMPLE_PROMPTS = [
  "Add a starry night sky background",
  "Make it look like a vintage photograph",
  "Add sunglasses to the person",
  "Turn into cartoon style with bright colors",
  "Change background to tropical beach",
  "Apply dreamy, ethereal glow effect",
  "Make it black and white with high contrast",
  "Add autumn leaves falling around"
];

// Transform card component
const TransformCard = ({ image, isOriginal, isSelected, onClick, index }) => (
  <motion.button
    onClick={onClick}
    className={`relative aspect-[3/4] rounded-xl overflow-hidden flex-shrink-0 transition-all ${
      isSelected 
        ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-gray-900 scale-[1.02]' 
        : 'hover:scale-[1.02] opacity-80 hover:opacity-100'
    }`}
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: index * 0.1 }}
    whileHover={{ y: -4 }}
    data-testid={isOriginal ? "original-photo-card" : `variation-card-${index}`}
  >
    <img 
      src={image.startsWith('data:') ? image : `data:image/png;base64,${image}`}
      alt={isOriginal ? "Original" : `Variation ${index}`}
      className="w-full h-full object-cover"
    />
    
    {/* Selection indicator */}
    {isSelected && (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-purple-500/30 flex items-center justify-center"
      >
        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center shadow-lg">
          <Check className="w-5 h-5 text-white" />
        </div>
      </motion.div>
    )}
    
    {/* Label */}
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
      <p className="text-white text-xs font-medium text-center">
        {isOriginal ? '📷 Original' : `✨ Variation ${index}`}
      </p>
    </div>
  </motion.button>
);

const AIPhotoTransform = ({ 
  originalImage,  // base64 or data URL
  onSelectPhoto,  // callback with selected image (base64)
  onSkip,         // callback to skip transformation
  onCancel        // callback to go back
}) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [variations, setVariations] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1); // -1 = original selected
  const [generationsRemaining, setGenerationsRemaining] = useState(3);
  const [error, setError] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  
  // Fetch current generation status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await api.get('/ai-transform/status');
        setGenerationsRemaining(res.data.generations_remaining);
      } catch (err) {
        console.error('Failed to fetch transform status:', err);
      }
    };
    fetchStatus();
  }, []);
  
  // Clean original image to base64
  const getCleanBase64 = useCallback((img) => {
    if (!img) return '';
    if (img.startsWith('data:')) {
      return img.split(',')[1] || img;
    }
    return img;
  }, []);
  
  // Generate AI transformations
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a transformation description');
      return;
    }
    
    if (generationsRemaining <= 0) {
      toast.error('No generations remaining. Complete minting to reset.');
      return;
    }
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await api.post('/ai-transform/generate', {
        image_base64: getCleanBase64(originalImage),
        prompt: prompt.trim(),
        num_variations: 2  // Generate 2 variations per request
      }, {
        timeout: 120000  // 2 minute timeout for AI generation
      });
      
      if (response.data.success && response.data.variations?.length > 0) {
        setVariations(prev => [...prev, ...response.data.variations]);
        setGenerationsRemaining(response.data.generations_remaining);
        toast.success(`Generated ${response.data.variations.length} variations!`);
        
        // Auto-select first generated variation
        if (variations.length === 0 && response.data.variations.length > 0) {
          setSelectedIndex(0);
        }
      } else {
        setError(response.data.error || 'Failed to generate. Try a different description.');
        toast.error(response.data.error || 'Generation failed');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to generate transformations';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Select a photo (original or variation)
  const handleSelectPhoto = (index) => {
    setSelectedIndex(index);
  };
  
  // Confirm selection and proceed
  const handleConfirm = () => {
    if (selectedIndex === -1) {
      // Original selected
      onSelectPhoto(originalImage);
    } else {
      // Variation selected
      const selectedBase64 = variations[selectedIndex];
      // Return as data URL
      onSelectPhoto(`data:image/png;base64,${selectedBase64}`);
    }
  };
  
  // Set example prompt
  const setExamplePrompt = (example) => {
    setPrompt(example);
  };
  
  // Carousel navigation
  const allImages = [originalImage, ...variations.map(v => `data:image/png;base64,${v}`)];
  const canGoLeft = carouselIndex > 0;
  const canGoRight = carouselIndex < allImages.length - 3; // Show 3 at a time on desktop
  
  return (
    <div className="space-y-4" data-testid="ai-photo-transform">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Wand2 className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-white">Transform Your Photo with AI</h3>
        </div>
        <p className="text-sm text-gray-400">
          Optional: Describe changes to create AI-edited versions
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {generationsRemaining} generation{generationsRemaining !== 1 ? 's' : ''} remaining this session
        </p>
      </div>
      
      {/* Prompt input */}
      <div className="space-y-2">
        <div className="relative">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe changes (e.g., 'add red hat and beach background')"
            className="bg-gray-800 border-gray-700 text-white pr-24"
            disabled={isGenerating}
            onKeyPress={(e) => e.key === 'Enter' && !isGenerating && handleGenerate()}
            data-testid="transform-prompt-input"
          />
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim() || generationsRemaining <= 0}
            className="absolute right-1 top-1 h-8 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            data-testid="generate-edits-btn"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1" />
                Generate
              </>
            )}
          </Button>
        </div>
        
        {/* Example prompts */}
        <div className="flex flex-wrap gap-1">
          {EXAMPLE_PROMPTS.slice(0, 4).map((example, idx) => (
            <button
              key={idx}
              onClick={() => useExamplePrompt(example)}
              className="text-xs px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full transition-colors"
              disabled={isGenerating}
            >
              {example.length > 25 ? example.slice(0, 25) + '...' : example}
            </button>
          ))}
        </div>
      </div>
      
      {/* Loading state */}
      {isGenerating && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gray-800/50 rounded-xl p-6 text-center"
        >
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-purple-500/30 animate-pulse" />
            <div className="absolute inset-2 rounded-full border-4 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <Wand2 className="absolute inset-0 m-auto w-6 h-6 text-purple-400" />
          </div>
          <p className="text-white font-medium">Generating AI transformations...</p>
          <p className="text-sm text-gray-400 mt-1">This may take 10-30 seconds</p>
        </motion.div>
      )}
      
      {/* Error state */}
      {error && !isGenerating && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-900/20 border border-red-800 rounded-xl p-4 flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Generation failed</p>
            <p className="text-sm text-red-300/70 mt-1">{error}</p>
            <Button
              onClick={() => setError(null)}
              variant="ghost"
              size="sm"
              className="mt-2 text-red-400 hover:text-red-300"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Try again
            </Button>
          </div>
        </motion.div>
      )}
      
      {/* Photo preview carousel/grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {variations.length > 0 
              ? `Select a photo (${variations.length} variation${variations.length !== 1 ? 's' : ''} generated)` 
              : 'Original photo'
            }
          </p>
          {variations.length > 0 && (
            <p className="text-xs text-purple-400">
              {selectedIndex === -1 ? 'Original selected' : `Variation ${selectedIndex + 1} selected`}
            </p>
          )}
        </div>
        
        {/* Mobile: Horizontal scroll, Desktop: Grid */}
        <div className="relative">
          {/* Carousel navigation for desktop */}
          {allImages.length > 3 && (
            <>
              <button
                onClick={() => setCarouselIndex(Math.max(0, carouselIndex - 1))}
                disabled={!canGoLeft}
                className={`hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-8 h-8 rounded-full bg-gray-800 items-center justify-center ${canGoLeft ? 'hover:bg-gray-700' : 'opacity-50'}`}
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => setCarouselIndex(Math.min(allImages.length - 3, carouselIndex + 1))}
                disabled={!canGoRight}
                className={`hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-8 h-8 rounded-full bg-gray-800 items-center justify-center ${canGoRight ? 'hover:bg-gray-700' : 'opacity-50'}`}
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </>
          )}
          
          {/* Image grid/carousel */}
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:overflow-visible md:grid md:grid-cols-3 lg:grid-cols-4">
            {/* Original photo */}
            <div className="w-28 md:w-auto flex-shrink-0 snap-start">
              <TransformCard
                image={originalImage}
                isOriginal={true}
                isSelected={selectedIndex === -1}
                onClick={() => handleSelectPhoto(-1)}
                index={0}
              />
            </div>
            
            {/* Generated variations */}
            {variations.map((variation, idx) => (
              <div key={idx} className="w-28 md:w-auto flex-shrink-0 snap-start">
                <TransformCard
                  image={variation}
                  isOriginal={false}
                  isSelected={selectedIndex === idx}
                  onClick={() => handleSelectPhoto(idx)}
                  index={idx + 1}
                />
              </div>
            ))}
            
            {/* Placeholder for generating */}
            {isGenerating && (
              <div className="w-28 md:w-auto flex-shrink-0 snap-start aspect-[3/4] rounded-xl bg-gray-800 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button
          onClick={onSkip}
          variant="outline"
          className="flex-1 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
          data-testid="skip-transform-btn"
        >
          <SkipForward className="w-4 h-4 mr-2" />
          Skip Transformation
        </Button>
        
        <Button
          onClick={handleConfirm}
          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          data-testid="use-selected-btn"
        >
          <Check className="w-4 h-4 mr-2" />
          {selectedIndex === -1 ? 'Mint Original' : 'Use Selected → Mint'}
        </Button>
      </div>
      
      {/* Info note */}
      <p className="text-xs text-gray-500 text-center">
        <ImageIcon className="w-3 h-3 inline mr-1" />
        AI edits are optional — original photo will be minted if skipped.
      </p>
    </div>
  );
};

export default AIPhotoTransform;
