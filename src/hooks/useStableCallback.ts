import { useCallback, useRef, useEffect } from 'react';

/**
 * Creates a stable callback reference that doesn't change between renders
 * but always calls the latest version of the function
 * Prevents unnecessary re-renders and subscription re-establishments
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: any[]) => {
    return callbackRef.current(...args);
  }, []) as T;
}
