/**
 * OptimizedImage Component
 * 
 * Performance-optimized image component with:
 * - Lazy loading with IntersectionObserver
 * - Blur placeholder during load
 * - GPU-accelerated transitions
 * - Error fallback handling
 * - Aspect ratio preservation
 */

import React, { useState, useRef, useEffect, memo } from 'react';

const OptimizedImage = memo(function OptimizedImage({
  src,
  alt = '',
  className = '',
  containerClassName = '',
  width,
  height,
  aspectRatio = '1/1',
  placeholderColor = 'bg-gray-800',
  fallbackIcon = '🖼️',
  onLoad,
  onError,
  priority = false,
  ...props
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  // Use IntersectionObserver for lazy loading
  useEffect(() => {
    if (priority || !containerRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0,
      }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = (e) => {
    setIsLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e) => {
    setHasError(true);
    onError?.(e);
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${placeholderColor} ${containerClassName}`}
      style={{ aspectRatio }}
    >
      {/* Skeleton placeholder */}
      {!isLoaded && !hasError && (
        <div 
          className="absolute inset-0 skeleton-optimized"
          aria-hidden="true"
        />
      )}

      {/* Actual image - only render src when in view */}
      {isInView && !hasError && src && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={`
            w-full h-full object-cover
            transition-opacity duration-300 ease-out
            ${isLoaded ? 'opacity-100' : 'opacity-0'}
            ${className}
          `}
          style={{
            transform: 'translateZ(0)',
            willChange: isLoaded ? 'auto' : 'opacity',
          }}
          {...props}
        />
      )}

      {/* Error fallback */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <span className="text-4xl opacity-50">{fallbackIcon}</span>
        </div>
      )}
    </div>
  );
});

export default OptimizedImage;

/**
 * PhotoThumbnail - Specialized for photo grid/game use
 */
export const PhotoThumbnail = memo(function PhotoThumbnail({
  photo,
  onClick,
  selected = false,
  className = '',
  showOverlay = false,
  overlayContent,
}) {
  const sceneryColors = {
    natural: 'from-green-500 to-emerald-600',
    water: 'from-blue-500 to-cyan-600',
    manmade: 'from-orange-500 to-red-600',
    neutral: 'from-gray-500 to-gray-600',
  };

  const sceneryIcons = {
    natural: '🌿',
    water: '🌊',
    manmade: '🏙️',
    neutral: '⬜',
  };

  const hasImage = photo?.image_url;
  const sceneryType = photo?.scenery_type || 'natural';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-lg
        transform-gpu transition-transform duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500
        ${selected ? 'ring-2 ring-purple-500 scale-[1.02]' : 'hover:scale-[1.02]'}
        ${className}
      `}
      style={{ touchAction: 'manipulation' }}
    >
      {hasImage ? (
        <OptimizedImage
          src={photo.image_url}
          alt={photo.name || 'Photo'}
          aspectRatio="1/1"
          placeholderColor={`bg-gradient-to-br ${sceneryColors[sceneryType]}`}
          fallbackIcon={sceneryIcons[sceneryType]}
        />
      ) : (
        <div 
          className={`aspect-square bg-gradient-to-br ${sceneryColors[sceneryType]} flex items-center justify-center`}
        >
          <span className="text-4xl opacity-60">{sceneryIcons[sceneryType]}</span>
        </div>
      )}

      {/* Optional overlay */}
      {showOverlay && overlayContent && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          {overlayContent}
        </div>
      )}

      {/* Selection indicator */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
    </button>
  );
});

/**
 * LazyImageGrid - Virtualized-like image grid for large photo lists
 */
export const LazyImageGrid = memo(function LazyImageGrid({
  photos = [],
  onPhotoClick,
  selectedIds = [],
  columns = 3,
  gap = 'gap-2',
  className = '',
}) {
  return (
    <div 
      className={`grid grid-cols-${columns} ${gap} photo-grid ${className}`}
      role="list"
    >
      {photos.map((photo, index) => (
        <div 
          key={photo.mint_id || photo.id || index} 
          className="photo-grid-item"
          role="listitem"
        >
          <PhotoThumbnail
            photo={photo}
            onClick={() => onPhotoClick?.(photo, index)}
            selected={selectedIds.includes(photo.mint_id || photo.id)}
          />
        </div>
      ))}
    </div>
  );
});
