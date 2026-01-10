import React, { useState, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { 
  Camera, Upload, Sparkles, DollarSign, Tag, FileText, 
  ChevronRight, ChevronLeft, Check, Loader2, Image as ImageIcon,
  RefreshCw, ShoppingBag, AlertCircle, Wand2, Globe, X
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Step Indicator Component
const StepIndicator = ({ currentStep, totalSteps }) => (
  <div className="flex items-center justify-center gap-2 mb-6">
    {Array.from({ length: totalSteps }, (_, i) => (
      <div 
        key={i}
        className={`w-3 h-3 rounded-full transition-all ${
          i < currentStep ? 'bg-primary' : 
          i === currentStep ? 'bg-primary w-8' : 
          'bg-muted'
        }`}
      />
    ))}
  </div>
);

// Image Upload Component with Preview
const ImageUploader = ({ images, setImages, maxImages = 10 }) => {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const handleFiles = async (files) => {
    const newImages = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (images.length + newImages.length >= maxImages) break;
      
      const reader = new FileReader();
      const base64 = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      
      newImages.push({
        id: Date.now() + Math.random(),
        file,
        preview: base64,
        base64: base64.split(',')[1]
      });
    }
    setImages([...images, ...newImages]);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(e.dataTransfer.files));
  };
  
  const removeImage = (id) => {
    setImages(images.filter(img => img.id !== id));
  };
  
  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          className="hidden"
        />
        
        <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <p className="text-lg font-medium mb-2">Drag photos here or click to upload</p>
        <p className="text-sm text-muted-foreground mb-4">
          Upload up to {maxImages} photos of your item
        </p>
        <Button onClick={() => fileInputRef.current?.click()}>
          <Upload className="w-4 h-4 mr-2" /> Choose Photos
        </Button>
      </div>
      
      {/* Image Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((img, i) => (
            <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden group">
              <img src={img.preview} alt="" className="w-full h-full object-cover" />
              {i === 0 && (
                <div className="absolute top-1 left-1 bg-primary text-xs text-white px-2 py-0.5 rounded">
                  Cover
                </div>
              )}
              <button
                onClick={() => removeImage(img.id)}
                className="absolute top-1 right-1 bg-black/50 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// AI Generated Content Preview
const AIContentPreview = ({ data, onEdit }) => (
  <div className="space-y-4 bg-card rounded-xl p-6 border">
    <div className="flex items-center gap-2 text-primary mb-4">
      <Sparkles className="w-5 h-5" />
      <span className="font-semibold">AI Generated Content</span>
    </div>
    
    <div>
      <label className="text-sm text-muted-foreground">Title</label>
      <Input 
        value={data.title || ''}
        onChange={(e) => onEdit({ ...data, title: e.target.value })}
        className="mt-1"
      />
    </div>
    
    <div>
      <label className="text-sm text-muted-foreground">Description</label>
      <textarea
        value={data.description || ''}
        onChange={(e) => onEdit({ ...data, description: e.target.value })}
        className="w-full mt-1 p-3 rounded-lg border bg-background min-h-[120px] resize-none"
      />
    </div>
    
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="text-sm text-muted-foreground">Category</label>
        <Input 
          value={data.category || ''}
          onChange={(e) => onEdit({ ...data, category: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-sm text-muted-foreground">Condition</label>
        <Input 
          value={data.condition || ''}
          onChange={(e) => onEdit({ ...data, condition: e.target.value })}
          className="mt-1"
        />
      </div>
    </div>
    
    {data.tags && data.tags.length > 0 && (
      <div>
        <label className="text-sm text-muted-foreground">Tags</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {data.tags.map((tag, i) => (
            <span key={i} className="bg-muted px-2 py-1 rounded text-sm">
              {tag}
            </span>
          ))}
        </div>
      </div>
    )}
    
    {data.flaws && data.flaws.length > 0 && (
      <div>
        <label className="text-sm text-muted-foreground flex items-center gap-1">
          <AlertCircle className="w-4 h-4 text-amber-500" /> Detected Flaws
        </label>
        <ul className="list-disc list-inside mt-1 text-sm text-muted-foreground">
          {data.flaws.map((flaw, i) => (
            <li key={i}>{flaw}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

// Price Suggestion Component
const PriceSuggestion = ({ suggestedPrice, marketData, onPriceChange, currentPrice }) => (
  <div className="space-y-4 bg-card rounded-xl p-6 border">
    <div className="flex items-center gap-2 text-green-500 mb-4">
      <DollarSign className="w-5 h-5" />
      <span className="font-semibold">AI Price Suggestion</span>
    </div>
    
    <div className="text-center py-6">
      <p className="text-sm text-muted-foreground mb-2">Suggested Price Range</p>
      <p className="text-4xl font-bold text-primary">
        ${suggestedPrice?.min || 0} - ${suggestedPrice?.max || 0}
      </p>
      <p className="text-sm text-muted-foreground mt-2">
        Based on {marketData?.comparisons || 0} similar items
      </p>
    </div>
    
    <div>
      <label className="text-sm font-medium">Your Price</label>
      <div className="relative mt-1">
        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          type="number"
          value={currentPrice}
          onChange={(e) => onPriceChange(e.target.value)}
          className="pl-8"
          placeholder="Enter your price"
        />
      </div>
    </div>
    
    {marketData?.sources && (
      <div className="text-xs text-muted-foreground">
        <p>Data from: {marketData.sources.join(', ')}</p>
      </div>
    )}
  </div>
);

// Main AI Listing Creator Component
export default function AIListingCreator() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  
  const [step, setStep] = useState(0);
  const [images, setImages] = useState([]);
  const [condition, setCondition] = useState('used');
  const [targetCountry, setTargetCountry] = useState('US');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [priceData, setPriceData] = useState(null);
  const [userPrice, setUserPrice] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState(null);
  
  const steps = [
    { title: 'Upload Photos', icon: Camera },
    { title: 'AI Analysis', icon: Sparkles },
    { title: 'Set Price', icon: DollarSign },
    { title: 'Publish', icon: ShoppingBag }
  ];
  
  const analyzeWithAI = async () => {
    if (images.length === 0) {
      toast.error('Please upload at least one photo');
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    
    const token = localStorage.getItem('blendlink_token');
    
    try {
      // Call AI analysis endpoint
      const response = await fetch(`${API_BASE_URL}/api/ai-tools/analyze-listing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          images: images.map(img => img.base64),
          condition: condition,
          target_countries: [targetCountry]
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'AI analysis failed');
      }
      
      const result = await response.json();
      
      setAiData({
        title: result.title,
        description: result.description,
        category: result.category,
        condition: result.condition || condition,
        tags: result.tags || [],
        flaws: result.flaws || [],
        specs: result.specs || {}
      });
      
      // Also get price suggestion
      const priceResponse = await fetch(`${API_BASE_URL}/api/ai-tools/price-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: result.title,
          description: result.description,
          category: result.category,
          condition: condition,
          target_country: targetCountry
        })
      });
      
      if (priceResponse.ok) {
        const priceResult = await priceResponse.json();
        setPriceData({
          min: priceResult.suggested_price_range?.min || priceResult.average_price * 0.8,
          max: priceResult.suggested_price_range?.max || priceResult.average_price * 1.2,
          average: priceResult.average_price,
          comparisons: priceResult.market_research?.length || 0,
          sources: priceResult.sources || ['Market Analysis']
        });
        setUserPrice(String(priceResult.average_price || ''));
      }
      
      setStep(1);
      toast.success('AI analysis complete!');
      
    } catch (err) {
      setError(err.message);
      
      // If it's a budget error, show helpful message
      if (err.message.includes('budget') || err.message.includes('exceeded')) {
        toast.error('AI budget exceeded. Please add balance to Universal Key.');
      } else {
        toast.error(err.message);
      }
      
      // Fallback: Use mock data for demo
      setAiData({
        title: 'Sample Product Listing',
        description: 'This is a demo listing created when AI analysis is unavailable. In production, this would be AI-generated based on your photos.',
        category: 'Electronics',
        condition: condition,
        tags: ['sample', 'demo', 'product'],
        flaws: condition === 'used' ? ['Minor wear visible'] : []
      });
      
      setPriceData({
        min: 50,
        max: 150,
        average: 100,
        comparisons: 10,
        sources: ['Demo Data']
      });
      setUserPrice('100');
      
      setStep(1);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const publishListing = async () => {
    if (!aiData || !userPrice) {
      toast.error('Please complete all steps');
      return;
    }
    
    setIsPublishing(true);
    const token = localStorage.getItem('blendlink_token');
    
    try {
      // Upload images first
      const uploadedImages = [];
      for (const img of images) {
        const formData = new FormData();
        formData.append('file', img.file);
        
        const uploadResponse = await fetch(`${API_BASE_URL}/api/upload/file`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json();
          uploadedImages.push(uploadResult.data_url || uploadResult.file_url);
        }
      }
      
      // Create listing
      const listingResponse = await fetch(`${API_BASE_URL}/api/marketplace/listings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: aiData.title,
          description: aiData.description,
          price: parseFloat(userPrice),
          category: aiData.category?.toLowerCase() || 'other',
          condition: aiData.condition,
          images: uploadedImages.length > 0 ? uploadedImages : images.map(i => i.preview),
          tags: aiData.tags,
          location: targetCountry
        })
      });
      
      if (!listingResponse.ok) {
        throw new Error('Failed to create listing');
      }
      
      const listing = await listingResponse.json();
      
      toast.success('Listing published successfully!');
      setStep(3);
      
      // Navigate to the listing after a delay
      setTimeout(() => {
        navigate(`/marketplace/${listing.listing_id || listing.id}`);
      }, 2000);
      
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsPublishing(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-primary" />
                  AI Listing Creator
                </h1>
                <p className="text-xs text-muted-foreground">{steps[step].title}</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Step Indicator */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <StepIndicator currentStep={step} totalSteps={steps.length} />
      </div>
      
      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Step 0: Upload Photos */}
        {step === 0 && (
          <div className="space-y-6">
            <ImageUploader images={images} setImages={setImages} maxImages={10} />
            
            {images.length > 0 && (
              <>
                {/* Condition Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Item Condition</label>
                  <div className="flex gap-2">
                    {['new', 'like_new', 'used', 'fair'].map(c => (
                      <button
                        key={c}
                        onClick={() => setCondition(c)}
                        className={`px-4 py-2 rounded-lg text-sm capitalize ${
                          condition === c ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}
                      >
                        {c.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Target Country */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Target Market</label>
                  <div className="flex gap-2">
                    {[
                      { code: 'US', name: 'USA' },
                      { code: 'UK', name: 'UK' },
                      { code: 'EU', name: 'Europe' },
                      { code: 'CA', name: 'Canada' }
                    ].map(country => (
                      <button
                        key={country.code}
                        onClick={() => setTargetCountry(country.code)}
                        className={`px-4 py-2 rounded-lg text-sm flex items-center gap-1 ${
                          targetCountry === country.code ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        }`}
                      >
                        <Globe className="w-4 h-4" />
                        {country.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Analyze Button */}
                <Button 
                  onClick={analyzeWithAI}
                  disabled={isAnalyzing}
                  className="w-full h-12"
                  data-testid="analyze-with-ai-btn"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Analyzing with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Analyze with AI
                    </>
                  )}
                </Button>
                
                {error && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm">
                    <p className="text-amber-500 font-medium">AI Analysis Note:</p>
                    <p className="text-muted-foreground">{error}</p>
                    <p className="text-muted-foreground mt-2">Using demo data to continue the flow.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {/* Step 1: AI Analysis Results */}
        {step === 1 && aiData && (
          <div className="space-y-6">
            <AIContentPreview data={aiData} onEdit={setAiData} />
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setStep(2)} className="flex-1">
                Continue <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 2: Price Setting */}
        {step === 2 && priceData && (
          <div className="space-y-6">
            <PriceSuggestion 
              suggestedPrice={priceData}
              marketData={priceData}
              currentPrice={userPrice}
              onPriceChange={setUserPrice}
            />
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button 
                onClick={publishListing}
                disabled={isPublishing || !userPrice}
                className="flex-1"
                data-testid="publish-listing-btn"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Publish Listing
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: Success */}
        {step === 3 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Listing Published!</h2>
            <p className="text-muted-foreground mb-6">
              Your item is now live on the marketplace
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/marketplace')}>
                View Marketplace
              </Button>
              <Button onClick={() => {
                setStep(0);
                setImages([]);
                setAiData(null);
                setPriceData(null);
                setUserPrice('');
              }}>
                Create Another
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
