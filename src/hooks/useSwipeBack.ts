import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { haptics } from '@/utils/haptics';

interface SwipeBackOptions {
  enabled?: boolean;
  threshold?: number;
}

/**
 * iOS-style swipe-back gesture navigation
 * Swipe from left edge to navigate back
 */
export const useSwipeBack = (options: SwipeBackOptions = {}) => {
  const { enabled = true, threshold = 100 } = options;
  const navigate = useNavigate();
  const [swipeProgress, setSwipeProgress] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      
      // Only start swipe if touch begins near left edge (within 50px)
      if (touch.clientX < 50) {
        isSwiping.current = true;
        haptics.light();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping.current) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartX.current;
      const deltaY = touch.clientY - touchStartY.current;

      // Cancel if vertical swipe
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        isSwiping.current = false;
        setSwipeProgress(0);
        return;
      }

      // Only proceed with right swipe (back gesture)
      if (deltaX > 0) {
        e.preventDefault();
        const progress = Math.min(deltaX / threshold, 1);
        setSwipeProgress(progress);
        
        // Haptic feedback at halfway point
        if (progress >= 0.5 && progress < 0.55) {
          haptics.medium();
        }
      }
    };

    const handleTouchEnd = () => {
      if (!isSwiping.current) return;

      if (swipeProgress >= 0.6) {
        // Navigate back with success haptic
        haptics.success();
        navigate(-1);
      } else {
        // Cancel swipe with light haptic
        haptics.light();
      }

      isSwiping.current = false;
      setSwipeProgress(0);
    };

    // Add listeners with passive: false to allow preventDefault
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, threshold, swipeProgress, navigate]);

  return { swipeProgress, isSwiping: isSwiping.current };
};
