import React, { useState, useEffect } from 'react';
import { ExternalLink, Loader2, Globe } from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Extract URLs from text
export const extractUrls = (text) => {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map(url => url.startsWith('http') ? url : `https://${url}`);
};

// LinkPreview component - displays a preview card for URLs
export default function LinkPreview({ url, className = "" }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPreview = async () => {
      if (!url) return;
      
      setLoading(true);
      setError(false);
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/utils/url-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        if (data.success) {
          setPreview(data);
        } else {
          // Still show basic preview even if fetch failed
          setPreview({
            url,
            title: data.title || new URL(url).hostname,
            description: data.description,
            image: data.image,
            siteName: data.siteName || new URL(url).hostname
          });
        }
      } catch (err) {
        console.error('Link preview error:', err);
        setError(true);
        // Fallback preview
        try {
          const hostname = new URL(url).hostname;
          setPreview({
            url,
            title: hostname,
            description: null,
            image: null,
            siteName: hostname
          });
        } catch {
          setError(true);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [url]);

  if (loading) {
    return (
      <div className={`border border-border rounded-xl p-4 bg-muted/30 ${className}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading preview...</span>
        </div>
      </div>
    );
  }

  if (error && !preview) {
    return null;
  }

  if (!preview) return null;

  return (
    <a 
      href={preview.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`block border border-border rounded-xl overflow-hidden bg-card hover:bg-muted/30 transition-colors ${className}`}
      data-testid="link-preview"
    >
      {/* Image */}
      {preview.image && (
        <div className="relative w-full h-40 bg-muted">
          <img 
            src={preview.image} 
            alt={preview.title || 'Link preview'} 
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}
      
      {/* Content */}
      <div className="p-3">
        {/* Site name */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <Globe className="w-3 h-3" />
          <span className="truncate">{preview.siteName}</span>
          <ExternalLink className="w-3 h-3 ml-auto flex-shrink-0" />
        </div>
        
        {/* Title */}
        {preview.title && (
          <h4 className="font-medium text-sm line-clamp-2 text-foreground">
            {preview.title}
          </h4>
        )}
        
        {/* Description */}
        {preview.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}
