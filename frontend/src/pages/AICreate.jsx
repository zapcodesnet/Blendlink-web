import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { getApiUrl } from "../utils/runtimeConfig";
import {
  Sparkles,
  Image,
  Video,
  Music,
  Coins,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Wand2,
  Clock,
} from "lucide-react";

const API_BASE_URL = getApiUrl();

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

// Media type options
const MEDIA_TYPES = [
  { 
    type: 'image', 
    icon: Image, 
    label: 'AI Image', 
    cost: '200', 
    description: 'Generate stunning AI images from text',
    time: '~30 seconds'
  },
  { 
    type: 'video', 
    icon: Video, 
    label: 'AI Video', 
    cost: '400+', 
    description: 'Create short AI videos (4-12 seconds)',
    time: '~2-5 minutes'
  },
  { 
    type: 'music', 
    icon: Music, 
    label: 'AI Music', 
    cost: '300', 
    description: 'Coming soon',
    disabled: true
  },
];

const DURATION_OPTIONS = [4, 8, 12];

export default function AICreate() {
  const [prompt, setPrompt] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [duration, setDuration] = useState(4);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [generatedResult, setGeneratedResult] = useState(null);

  const handleEstimateCost = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a description for your content');
      return;
    }

    setIsEstimating(true);
    setEstimate(null);

    try {
      const result = await apiRequest('/ai-media/estimate-cost', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          media_type: mediaType,
          duration: mediaType === 'video' ? duration : null,
        }),
      });
      setEstimate(result);
    } catch (error) {
      toast.error(error.message || 'Failed to estimate cost');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleGenerate = async () => {
    if (!estimate?.can_afford) {
      toast.error('Insufficient BL coins. Post content to earn more!');
      return;
    }

    setIsGenerating(true);

    try {
      const result = await apiRequest('/ai-media/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          media_type: mediaType,
          duration: mediaType === 'video' ? duration : null,
        }),
      });
      setGeneratedResult(result);
      toast.success(`Your ${mediaType} has been generated! ${result.cost_deducted} BL coins deducted.`);
    } catch (error) {
      const message = error.message || 'Generation failed';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNewGeneration = () => {
    setPrompt('');
    setEstimate(null);
    setGeneratedResult(null);
  };

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="ai-create-page">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/feed">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <h1 className="text-2xl font-bold">AI Create</h1>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="mb-6 border-purple-500/30 bg-purple-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Wand2 className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Create unique images and videos using cutting-edge AI. Content costs BL coins to generate - post regularly to earn more!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Media Type Selection */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3">What do you want to create?</h2>
          <div className="grid grid-cols-3 gap-3">
            {MEDIA_TYPES.map((item) => {
              const Icon = item.icon;
              const isSelected = mediaType === item.type;
              return (
                <button
                  key={item.type}
                  onClick={() => !item.disabled && setMediaType(item.type)}
                  disabled={item.disabled}
                  className={`relative p-4 rounded-xl border-2 transition-all text-center ${
                    item.disabled 
                      ? 'opacity-50 cursor-not-allowed border-muted' 
                      : isSelected 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Icon className={`w-7 h-7 mx-auto mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className={`font-medium text-sm ${isSelected ? 'text-primary' : ''}`}>{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.cost} BL</p>
                  {item.disabled && (
                    <span className="absolute -top-2 -right-2 bg-amber-500 text-amber-950 text-xs font-bold px-2 py-0.5 rounded-full">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration Selection (Video only) */}
        {mediaType === 'video' && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold mb-3">Video Duration</h2>
            <div className="flex gap-3">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-3 px-4 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                    duration === d 
                      ? 'border-primary bg-primary text-primary-foreground' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">{d}s</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt Input */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold mb-3">Describe your creation</h2>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setEstimate(null);
            }}
            placeholder={`e.g., "A beautiful sunset over mountains with golden light reflecting on a calm lake, cinematic style"`}
            className="w-full min-h-[120px] p-4 rounded-xl border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Cost Estimate */}
        {!estimate ? (
          <Button
            onClick={handleEstimateCost}
            disabled={!prompt.trim() || isEstimating}
            className="w-full py-6 text-base"
            variant="secondary"
          >
            {isEstimating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                <Coins className="w-5 h-5 mr-2" />
                Estimate Cost
              </>
            )}
          </Button>
        ) : (
          <Card className={`mb-4 ${estimate.can_afford ? 'border-green-500/50 bg-green-500/5' : 'border-destructive/50 bg-destructive/5'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted-foreground">Estimated Cost:</span>
                <span className="flex items-center gap-1 font-bold text-lg text-amber-500">
                  <Coins className="w-5 h-5" />
                  {estimate.estimated_cost} BL
                </span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted-foreground">Your Balance:</span>
                <span className="font-medium">{estimate.current_balance?.toLocaleString()} BL</span>
              </div>
              {estimate.can_afford ? (
                <div className="flex items-center gap-2 text-green-500 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>You can afford this generation!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Not enough BL coins. Post content to earn more!</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Generate Button */}
        {estimate && (
          <Button
            onClick={handleGenerate}
            disabled={!estimate.can_afford || isGenerating}
            className="w-full py-6 text-base bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Generating ({mediaType === 'video' ? '2-5 min' : '~30s'})...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate {mediaType === 'image' ? 'Image' : 'Video'}
              </>
            )}
          </Button>
        )}

        {/* Generated Result Preview */}
        {generatedResult && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Your Creation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {generatedResult.media_type === 'image' && generatedResult.result?.base64 && (
                <img
                  src={`data:image/png;base64,${generatedResult.result.base64}`}
                  alt="AI Generated"
                  className="w-full rounded-lg border"
                />
              )}
              {generatedResult.media_type === 'video' && (
                <div className="bg-muted rounded-lg p-8 text-center">
                  <Video className="w-16 h-16 mx-auto text-muted-foreground mb-3" />
                  <p className="font-semibold">Video Generated!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Duration: {generatedResult.result?.duration}s
                  </p>
                  {generatedResult.result?.video_url && (
                    <a 
                      href={generatedResult.result.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-4"
                    >
                      <Button variant="outline">View Video</Button>
                    </a>
                  )}
                </div>
              )}
              <Button
                onClick={handleNewGeneration}
                variant="outline"
                className="w-full mt-4"
              >
                Create Another
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground text-center mt-6">
          AI-generated content is royalty-free for personal use. By generating content, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
