import React, { useState, useRef, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../App";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { 
  Camera, Upload, Sparkles, DollarSign, Tag, FileText, 
  ChevronRight, ChevronLeft, Check, Loader2, Image as ImageIcon,
  RefreshCw, ShoppingBag, AlertCircle, Wand2, Globe, X, Package,
  MapPin, Truck, Scale, Ruler, Edit2, Save, Printer, Navigation
} from "lucide-react";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Unit conversion utilities
const convertWeight = (value, from, to) => {
  const toKg = { lbs: 0.453592, kg: 1, oz: 0.0283495, g: 0.001 };
  const fromKg = { lbs: 2.20462, kg: 1, oz: 35.274, g: 1000 };
  return value * toKg[from] * fromKg[to];
};

const convertLength = (value, from, to) => {
  const toCm = { in: 2.54, cm: 1, ft: 30.48, m: 100 };
  const fromCm = { in: 0.393701, cm: 1, ft: 0.0328084, m: 0.01 };
  return value * toCm[from] * fromCm[to];
};

// Step Indicator Component
const StepIndicator = ({ currentStep, steps }) => (
  <div className="flex items-center justify-center gap-1 mb-6 overflow-x-auto py-2">
    {steps.map((step, i) => (
      <div key={i} className="flex items-center">
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
          i < currentStep ? 'bg-green-500/20 text-green-500' : 
          i === currentStep ? 'bg-primary text-primary-foreground' : 
          'bg-muted text-muted-foreground'
        }`}>
          {i < currentStep ? <Check className="w-3 h-3" /> : <step.icon className="w-3 h-3" />}
          <span className="hidden sm:inline">{step.title}</span>
        </div>
        {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />}
      </div>
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

// Weight & Dimensions Editor
const WeightDimensionsEditor = ({ weight, dimensions, onWeightChange, onDimensionsChange }) => {
  const [weightUnit, setWeightUnit] = useState(weight?.unit || 'lbs');
  const [dimUnit, setDimUnit] = useState(dimensions?.unit || 'in');
  
  const handleWeightUnitChange = (newUnit) => {
    const converted = convertWeight(weight?.value || 0, weightUnit, newUnit);
    setWeightUnit(newUnit);
    onWeightChange({ ...weight, value: parseFloat(converted.toFixed(2)), unit: newUnit });
  };
  
  const handleDimUnitChange = (newUnit) => {
    const converted = {
      length: convertLength(dimensions?.length || 0, dimUnit, newUnit),
      width: convertLength(dimensions?.width || 0, dimUnit, newUnit),
      height: convertLength(dimensions?.height || 0, dimUnit, newUnit),
      unit: newUnit
    };
    setDimUnit(newUnit);
    onDimensionsChange({
      length: parseFloat(converted.length.toFixed(2)),
      width: parseFloat(converted.width.toFixed(2)),
      height: parseFloat(converted.height.toFixed(2)),
      unit: newUnit
    });
  };
  
  return (
    <div className="space-y-4 bg-card rounded-xl p-4 border">
      <div className="flex items-center gap-2 text-blue-500 mb-2">
        <Scale className="w-5 h-5" />
        <span className="font-semibold">Weight & Dimensions</span>
        <span className="text-xs text-muted-foreground ml-auto">AI Estimated</span>
      </div>
      
      {/* Weight */}
      <div>
        <label className="text-sm text-muted-foreground flex items-center gap-2">
          <Scale className="w-4 h-4" /> Weight
        </label>
        <div className="flex gap-2 mt-1">
          <Input 
            type="number"
            step="0.1"
            min="0"
            value={weight?.value || ''}
            onChange={(e) => onWeightChange({ ...weight, value: parseFloat(e.target.value) || 0, unit: weightUnit })}
            className="flex-1"
            placeholder="Weight"
          />
          <select
            value={weightUnit}
            onChange={(e) => handleWeightUnitChange(e.target.value)}
            className="px-3 py-2 rounded-lg border bg-background text-sm"
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
            <option value="oz">oz</option>
            <option value="g">g</option>
          </select>
        </div>
      </div>
      
      {/* Dimensions */}
      <div>
        <label className="text-sm text-muted-foreground flex items-center gap-2">
          <Ruler className="w-4 h-4" /> Dimensions (L × W × H)
        </label>
        <div className="grid grid-cols-4 gap-2 mt-1">
          <Input 
            type="number"
            step="0.1"
            min="0"
            value={dimensions?.length || ''}
            onChange={(e) => onDimensionsChange({ ...dimensions, length: parseFloat(e.target.value) || 0 })}
            placeholder="L"
          />
          <Input 
            type="number"
            step="0.1"
            min="0"
            value={dimensions?.width || ''}
            onChange={(e) => onDimensionsChange({ ...dimensions, width: parseFloat(e.target.value) || 0 })}
            placeholder="W"
          />
          <Input 
            type="number"
            step="0.1"
            min="0"
            value={dimensions?.height || ''}
            onChange={(e) => onDimensionsChange({ ...dimensions, height: parseFloat(e.target.value) || 0 })}
            placeholder="H"
          />
          <select
            value={dimUnit}
            onChange={(e) => handleDimUnitChange(e.target.value)}
            className="px-2 py-2 rounded-lg border bg-background text-sm"
          >
            <option value="in">in</option>
            <option value="cm">cm</option>
            <option value="ft">ft</option>
          </select>
        </div>
      </div>
    </div>
  );
};

// AI Generated Content Preview with Edit
const AIContentPreview = ({ data, onEdit }) => (
  <div className="space-y-4 bg-card rounded-xl p-6 border">
    <div className="flex items-center gap-2 text-primary mb-4">
      <Sparkles className="w-5 h-5" />
      <span className="font-semibold">AI Generated Content</span>
      <Edit2 className="w-4 h-4 ml-auto text-muted-foreground" />
    </div>
    
    <div>
      <label className="text-sm text-muted-foreground">Title</label>
      <Input 
        value={data.title || ''}
        onChange={(e) => onEdit({ ...data, title: e.target.value })}
        className="mt-1"
        maxLength={80}
      />
      <p className="text-xs text-muted-foreground mt-1">{(data.title || '').length}/80 characters</p>
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
        <select
          value={data.condition || 'used'}
          onChange={(e) => onEdit({ ...data, condition: e.target.value })}
          className="w-full mt-1 p-2 rounded-lg border bg-background"
        >
          <option value="new">New</option>
          <option value="like_new">Like New</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
        </select>
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
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
        <label className="text-sm text-amber-500 flex items-center gap-1 font-medium">
          <AlertCircle className="w-4 h-4" /> Detected Flaws
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

// Price Suggestion Component with AI suggestions
const PriceSuggestion = ({ priceData, onPriceChange, currentPrice }) => (
  <div className="space-y-4 bg-card rounded-xl p-6 border">
    <div className="flex items-center gap-2 text-green-500 mb-4">
      <DollarSign className="w-5 h-5" />
      <span className="font-semibold">AI Price Suggestions</span>
    </div>
    
    {/* Price Range Display */}
    <div className="grid grid-cols-3 gap-3 text-center">
      <button 
        onClick={() => onPriceChange(String(priceData?.lowest || 0))}
        className="p-3 rounded-lg border hover:border-primary transition-colors"
      >
        <p className="text-xs text-muted-foreground">Low</p>
        <p className="text-lg font-bold text-amber-500">${priceData?.lowest?.toFixed(2) || '0.00'}</p>
        <p className="text-xs text-muted-foreground">Quick sale</p>
      </button>
      <button 
        onClick={() => onPriceChange(String(priceData?.recommended || priceData?.average || 0))}
        className="p-3 rounded-lg border-2 border-green-500 bg-green-500/5"
      >
        <p className="text-xs text-green-500">Recommended</p>
        <p className="text-2xl font-bold text-green-500">${priceData?.recommended?.toFixed(2) || priceData?.average?.toFixed(2) || '0.00'}</p>
        <p className="text-xs text-muted-foreground">Best value</p>
      </button>
      <button 
        onClick={() => onPriceChange(String(priceData?.highest || 0))}
        className="p-3 rounded-lg border hover:border-primary transition-colors"
      >
        <p className="text-xs text-muted-foreground">High</p>
        <p className="text-lg font-bold text-blue-500">${priceData?.highest?.toFixed(2) || '0.00'}</p>
        <p className="text-xs text-muted-foreground">Premium</p>
      </button>
    </div>
    
    {/* Custom Price Input */}
    <div>
      <label className="text-sm font-medium">Your Price (USD)</label>
      <div className="relative mt-1">
        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          type="number"
          step="0.01"
          min="0"
          value={currentPrice}
          onChange={(e) => onPriceChange(e.target.value)}
          className="pl-8 text-lg font-semibold"
          placeholder="Enter your price"
        />
      </div>
    </div>
    
    {priceData?.pricing_advice && (
      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
        <Sparkles className="w-4 h-4 inline mr-1 text-primary" />
        {priceData.pricing_advice}
      </p>
    )}
  </div>
);

// Location & Shipping Section
const LocationShippingSection = ({ location, setLocation, shippingData, setShippingData, weight, dimensions }) => {
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isLoadingShipping, setIsLoadingShipping] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  
  const detectLocation = () => {
    setIsLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            detected: true,
            zip: '' // Would need reverse geocoding API
          });
          setIsLoadingLocation(false);
          toast.success('Location detected!');
        },
        (error) => {
          toast.error('Could not detect location. Please enter manually.');
          setIsLoadingLocation(false);
        }
      );
    } else {
      toast.error('Geolocation not supported. Please enter manually.');
      setIsLoadingLocation(false);
    }
  };
  
  const fetchShippingEstimates = async () => {
    if (!location?.zip) {
      toast.error('Please enter your ZIP code');
      return;
    }
    
    setIsLoadingShipping(true);
    const token = localStorage.getItem('blendlink_token');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/shipping/estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          origin_zip: location.zip,
          origin_location: location.lat ? { lat: location.lat, lng: location.lng } : null,
          manual_weight: weight?.value || 2,
          manual_dimensions: {
            length: dimensions?.length || 12,
            width: dimensions?.width || 9,
            height: dimensions?.height || 6
          },
          destination_country: 'US'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setShippingData(data);
        if (data.shipping_options?.length > 0) {
          setSelectedProvider(data.shipping_options[0]);
        }
        toast.success('Shipping estimates loaded!');
      }
    } catch (err) {
      toast.error('Failed to get shipping estimates');
    } finally {
      setIsLoadingShipping(false);
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Location Input */}
      <div className="bg-card rounded-xl p-4 border">
        <div className="flex items-center gap-2 text-orange-500 mb-3">
          <MapPin className="w-5 h-5" />
          <span className="font-semibold">Item Location</span>
        </div>
        
        <div className="flex gap-2">
          <Input 
            value={location?.zip || ''}
            onChange={(e) => setLocation({ ...location, zip: e.target.value })}
            placeholder="Enter ZIP code"
            className="flex-1"
          />
          <Button variant="outline" onClick={detectLocation} disabled={isLoadingLocation}>
            {isLoadingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
          </Button>
        </div>
        
        {location?.detected && (
          <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
            <Check className="w-3 h-3" /> Location detected automatically
          </p>
        )}
        
        <Button 
          onClick={fetchShippingEstimates} 
          disabled={isLoadingShipping || !location?.zip}
          className="w-full mt-3"
        >
          {isLoadingShipping ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Calculating...</>
          ) : (
            <><Truck className="w-4 h-4 mr-2" /> Get Shipping Estimates</>
          )}
        </Button>
      </div>
      
      {/* Shipping Estimates */}
      {shippingData && (
        <div className="bg-card rounded-xl p-4 border">
          <div className="flex items-center gap-2 text-purple-500 mb-3">
            <Package className="w-5 h-5" />
            <span className="font-semibold">Shipping Options</span>
          </div>
          
          {/* Cost Breakdown */}
          <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm">
            <p className="font-medium mb-2">Cost Breakdown (Estimated)</p>
            <div className="grid grid-cols-2 gap-1 text-muted-foreground">
              <span>Packaging materials:</span>
              <span className="text-right">${shippingData.packaging_materials_cost?.toFixed(2)}</span>
              <span>Travel to drop-off:</span>
              <span className="text-right">${shippingData.travel_cost_estimate?.toFixed(2)}</span>
              <span>Recommended box:</span>
              <span className="text-right capitalize">{shippingData.box_size_recommended}</span>
            </div>
          </div>
          
          {/* Provider Options */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {shippingData.shipping_options?.map((option, i) => (
              <button
                key={i}
                onClick={() => setSelectedProvider(option)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  selectedProvider?.service === option.service 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:border-primary/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{option.service}</p>
                    <p className="text-xs text-muted-foreground">{option.delivery_days} days delivery</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">${option.total_estimated_cost?.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Total est.</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          {/* Nearby Locations */}
          {shippingData.provider_locations?.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-2">Nearby Drop-off Locations</p>
              <div className="space-y-2">
                {shippingData.provider_locations.slice(0, 3).map((loc, i) => (
                  <div key={i} className="text-sm p-2 bg-muted/50 rounded-lg">
                    <p className="font-medium">{loc.name}</p>
                    <p className="text-xs text-muted-foreground">{loc.address} • {loc.distance_miles} mi</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Main AI Listing Creator Component
export default function AIListingCreator() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  
  const [step, setStep] = useState(0);
  const [images, setImages] = useState([]);
  const [condition, setCondition] = useState('used');
  const [targetCountry, setTargetCountry] = useState('US');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [priceData, setPriceData] = useState(null);
  const [userPrice, setUserPrice] = useState('');
  const [weight, setWeight] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [userLocation, setUserLocation] = useState({ zip: '', lat: null, lng: null });
  const [shippingData, setShippingData] = useState(null);
  const [selectedShipping, setSelectedShipping] = useState(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState(null);
  
  // Handle photos passed from Photo Editor
  useEffect(() => {
    if (location.state?.fromPhotoEditor && location.state?.photos) {
      const photosFromEditor = location.state.photos;
      const newImages = photosFromEditor.map((photoUrl, index) => ({
        id: `photo-editor-${Date.now()}-${index}`,
        base64: photoUrl,
        preview: photoUrl
      }));
      setImages(newImages);
      toast.success(`Loaded ${newImages.length} photo(s) from Photo Editor`);
      // Clear state to prevent re-loading on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  
  const steps = [
    { title: 'Photos', icon: Camera },
    { title: 'Details', icon: Sparkles },
    { title: 'Price', icon: DollarSign },
    { title: 'Shipping', icon: Truck },
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
        condition: result.detected_condition || condition,
        tags: result.suggested_tags || [],
        flaws: result.flaws_detected || [],
        specs: result.specifications || {}
      });
      
      // Set weight and dimensions from AI
      setWeight(result.weight || { value: 1, unit: 'lbs' });
      setDimensions(result.dimensions || { length: 6, width: 4, height: 2, unit: 'in' });
      
      // Get price suggestions
      const priceResponse = await fetch(`${API_BASE_URL}/api/ai-tools/price-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: result.title,
          description: result.description,
          condition: condition,
          target_countries: [targetCountry]
        })
      });
      
      if (priceResponse.ok) {
        const priceResult = await priceResponse.json();
        setPriceData({
          lowest: priceResult.lowest_price,
          average: priceResult.average_price,
          highest: priceResult.highest_price,
          recommended: priceResult.recommended_price,
          pricing_advice: priceResult.pricing_advice
        });
        setUserPrice(String(priceResult.recommended_price || priceResult.average_price || ''));
      }
      
      setStep(1);
      toast.success('AI analysis complete!');
      
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
      
      // Fallback demo data
      setAiData({
        title: 'Sample Product Listing',
        description: 'This is a demo listing. In production, this would be AI-generated based on your photos.',
        category: 'General',
        condition: condition,
        tags: ['sample', 'demo'],
        flaws: condition === 'used' ? ['Minor wear visible'] : []
      });
      setWeight({ value: 2, unit: 'lbs' });
      setDimensions({ length: 10, width: 6, height: 4, unit: 'in' });
      setPriceData({ lowest: 25, average: 50, highest: 75, recommended: 50, pricing_advice: 'Demo pricing data' });
      setUserPrice('50');
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
    
    if (!location?.zip) {
      toast.error('Please enter your location ZIP code');
      setStep(3);
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
          location: userLocation.zip,
          weight: weight,
          dimensions: dimensions,
          shipping_method: selectedShipping || shippingData?.shipping_options?.[0] || null
        })
      });
      
      if (!listingResponse.ok) {
        throw new Error('Failed to create listing');
      }
      
      const listing = await listingResponse.json();
      
      toast.success('Listing published successfully!');
      setStep(4);
      
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
        <StepIndicator currentStep={step} steps={steps} />
      </div>
      
      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Step 0: Upload Photos */}
        {step === 0 && (
          <div className="space-y-6">
            <ImageUploader images={images} setImages={setImages} maxImages={10} />
            
            {images.length > 0 && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Item Condition</label>
                  <div className="flex flex-wrap gap-2">
                    {['new', 'like_new', 'good', 'fair', 'poor'].map(c => (
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
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Target Market</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { code: 'US', name: 'USA' },
                      { code: 'CA', name: 'Canada' },
                      { code: 'UK', name: 'UK' },
                      { code: 'EU', name: 'Europe' }
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
                
                <Button 
                  onClick={analyzeWithAI}
                  disabled={isAnalyzing}
                  className="w-full h-12"
                  data-testid="analyze-with-ai-btn"
                >
                  {isAnalyzing ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Analyzing with AI...</>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" /> Analyze with AI</>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
        
        {/* Step 1: AI Analysis Results */}
        {step === 1 && aiData && (
          <div className="space-y-6">
            <AIContentPreview data={aiData} onEdit={setAiData} />
            <WeightDimensionsEditor 
              weight={weight}
              dimensions={dimensions}
              onWeightChange={setWeight}
              onDimensionsChange={setDimensions}
            />
            
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
        
        {/* Step 2: Pricing */}
        {step === 2 && (
          <div className="space-y-6">
            <PriceSuggestion 
              priceData={priceData}
              onPriceChange={setUserPrice}
              currentPrice={userPrice}
            />
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1" disabled={!userPrice}>
                Continue <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: Location & Shipping */}
        {step === 3 && (
          <div className="space-y-6">
            <LocationShippingSection 
              location={userLocation}
              setLocation={setUserLocation}
              shippingData={shippingData}
              setShippingData={setShippingData}
              weight={weight}
              dimensions={dimensions}
            />
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
              <Button onClick={() => setStep(4)} className="flex-1">
                Review & Publish <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 4: Review & Publish */}
        {step === 4 && (
          <div className="space-y-6">
            {/* Preview Card */}
            <div className="bg-card rounded-xl border overflow-hidden">
              {images[0] && (
                <img src={images[0].preview} alt="" className="w-full h-48 object-cover" />
              )}
              <div className="p-4">
                <h3 className="font-bold text-lg">{aiData?.title}</h3>
                <p className="text-2xl font-bold text-primary mt-1">${parseFloat(userPrice).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{aiData?.description}</p>
                
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs bg-muted px-2 py-1 rounded">{aiData?.category}</span>
                  <span className="text-xs bg-muted px-2 py-1 rounded capitalize">{aiData?.condition?.replace('_', ' ')}</span>
                  {weight && <span className="text-xs bg-muted px-2 py-1 rounded">{weight.value} {weight.unit}</span>}
                </div>
                
                {shippingData?.shipping_options?.[0] && (
                  <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm">
                    <Truck className="w-4 h-4 text-muted-foreground" />
                    <span>Shipping from ~${shippingData.shipping_options[0].total_estimated_cost?.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
            
            <Button 
              onClick={publishListing}
              disabled={isPublishing}
              className="w-full h-12"
              data-testid="publish-listing-btn"
            >
              {isPublishing ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Publishing...</>
              ) : (
                <><ShoppingBag className="w-5 h-5 mr-2" /> Publish Listing</>
              )}
            </Button>
            
            <Button variant="outline" onClick={() => setStep(3)} className="w-full">
              <ChevronLeft className="w-4 h-4 mr-2" /> Back to Edit
            </Button>
          </div>
        )}
        
        {/* Success Step */}
        {step === 5 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Listing Published!</h2>
            <p className="text-muted-foreground mb-6">Your item is now live in the marketplace.</p>
            <Button onClick={() => navigate('/seller/dashboard')}>
              Go to Seller Dashboard
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
