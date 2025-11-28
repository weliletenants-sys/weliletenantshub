import { useEffect, useRef } from 'react';
import { trackRender } from '@/lib/performanceMonitor';

/**
 * Hook to monitor component render performance
 * Automatically tracks render time for the component
 */
export const usePerformanceMonitor = (componentName: string) => {
  const renderCount = useRef(0);
  const renderStartTime = useRef(performance.now());

  useEffect(() => {
    // Track render completion
    const renderDuration = performance.now() - renderStartTime.current;
    renderCount.current += 1;

    trackRender(componentName, renderDuration, {
      renderCount: renderCount.current,
    });

    // Reset timer for next render
    renderStartTime.current = performance.now();
  });

  return {
    renderCount: renderCount.current,
  };
};
