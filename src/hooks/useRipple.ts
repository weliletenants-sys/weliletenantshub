import { useCallback } from 'react';

/**
 * Hook to add ripple effect to interactive elements
 * Returns a handler to be attached to onClick
 */
export const useRipple = () => {
  const createRipple = useCallback((event: React.MouseEvent<HTMLElement>) => {
    const button = event.currentTarget;
    
    // Add ripple container class if not already present
    if (!button.classList.contains('ripple-container')) {
      button.classList.add('ripple-container');
    }

    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

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
