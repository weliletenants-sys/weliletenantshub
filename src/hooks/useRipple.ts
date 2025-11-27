import { useCallback } from 'react';

/**
 * Hook to add ripple effect to interactive elements
 * Returns a handler to be attached to onClick
 * Optimized for iOS Safari compatibility
 */
export const useRipple = () => {
  const createRipple = useCallback((event: React.MouseEvent<HTMLElement> | React.TouchEvent<HTMLElement>) => {
    const button = event.currentTarget;
    
    // Add ripple container class if not already present
    if (!button.classList.contains('ripple-container')) {
      button.classList.add('ripple-container');
    }

    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    // Handle both mouse and touch events for iOS
    let clientX: number, clientY: number;
    if ('touches' in event && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else if ('clientX' in event) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else {
      // Fallback to center if no coordinates available
      clientX = rect.left + rect.width / 2;
      clientY = rect.top + rect.height / 2;
    }
    
    const x = clientX - rect.left - size / 2;
    const y = clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.classList.add('ripple');

    // Remove previous ripples
    const existingRipples = button.getElementsByClassName('ripple');
    Array.from(existingRipples).forEach((r) => r.remove());

    button.appendChild(ripple);

    // Remove ripple after animation
    setTimeout(() => {
      ripple.remove();
    }, 600);
  }, []);

  return createRipple;
};
