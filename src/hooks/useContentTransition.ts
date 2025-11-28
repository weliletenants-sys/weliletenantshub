import { useState, useEffect } from 'react';

/**
 * Hook for managing content transitions between loading and loaded states
 * Provides smooth transitions with proper timing
 */
export const useContentTransition = (isLoading: boolean, delay: number = 150) => {
  const [showSkeleton, setShowSkeleton] = useState(isLoading);
  const [showContent, setShowContent] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setShowSkeleton(true);
      setShowContent(false);
      setIsTransitioning(false);
    } else {
      setIsTransitioning(true);
      
      // Start fade out skeleton
      setShowSkeleton(false);
      
      // Then fade in content after delay
      const timer = setTimeout(() => {
        setShowContent(true);
        setIsTransitioning(false);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [isLoading, delay]);

  return {
    showSkeleton,
    showContent,
    isTransitioning,
  };
};

/**
 * Hook for staggered list item animations
 * Returns visibility state for each item with delay
 */
export const useStaggeredTransition = (
  itemCount: number,
  isLoading: boolean,
  staggerDelay: number = 50
) => {
  const [visibleItems, setVisibleItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isLoading) {
      setVisibleItems(new Set());
      return;
    }

    // Reveal items one by one
    const timers: NodeJS.Timeout[] = [];
    
    for (let i = 0; i < itemCount; i++) {
      const timer = setTimeout(() => {
        setVisibleItems((prev) => new Set([...prev, i]));
      }, i * staggerDelay);
      
      timers.push(timer);
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [itemCount, isLoading, staggerDelay]);

  return {
    isItemVisible: (index: number) => visibleItems.has(index),
    allVisible: visibleItems.size === itemCount,
  };
};

/**
 * Hook for fade transitions between two states
 */
export const useFadeTransition = (show: boolean, duration: number = 300) => {
  const [isVisible, setIsVisible] = useState(show);
  const [shouldRender, setShouldRender] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  return {
    shouldRender,
    isVisible,
  };
};
