import { useCallback } from 'react';
import { measureAsync } from '@/lib/performanceMonitor';

/**
 * Hook to wrap API calls with performance tracking
 */
export const useApiPerformance = () => {
  const trackApiCall = useCallback(
    async <T>(
      operationName: string,
      apiCall: () => Promise<T>,
      metadata?: Record<string, any>
    ): Promise<T> => {
      return measureAsync(operationName, 'api', apiCall, metadata);
    },
    []
  );

  return { trackApiCall };
};
