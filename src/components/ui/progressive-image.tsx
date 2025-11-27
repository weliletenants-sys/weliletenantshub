import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface ProgressiveImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  lowQualitySrc?: string;
  eager?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Progressive image component with blur-up effect
 * Displays a blurred placeholder while the full image loads
 * Uses native lazy loading for better performance
 */
export const ProgressiveImage = ({
  src,
  alt,
  className,
  placeholderClassName,
  lowQualitySrc,
  eager = false,
  onLoad,
  onError,
}: ProgressiveImageProps) => {
  const [imgSrc, setImgSrc] = useState(lowQualitySrc || src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Preload the high-quality image
    const img = new Image();
    img.src = src;
    
    img.onload = () => {
      setImgSrc(src);
      setIsLoading(false);
      onLoad?.();
    };
    
    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
      onError?.();
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src, onLoad, onError]);

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          className
        )}
      >
        <span className="text-sm">Image unavailable</span>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <img
        src={imgSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={cn(
          'w-full h-full object-cover transition-all duration-500',
          isLoading && 'blur-lg scale-110',
          !isLoading && 'blur-0 scale-100',
          placeholderClassName
        )}
      />
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted animate-pulse" />
      )}
    </div>
  );
};
