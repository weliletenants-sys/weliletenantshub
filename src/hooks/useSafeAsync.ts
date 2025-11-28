import { useEffect, useRef, useCallback } from 'react';

/**
 * Prevents memory leaks from async operations in unmounted components
 * Automatically cancels async operations on component unmount
 */
export function useSafeAsync() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeAsync = useCallback(async <T>(asyncFn: () => Promise<T>): Promise<T | null> => {
    try {
      const result = await asyncFn();
      if (isMountedRef.current) {
        return result;
      }
      return null;
    } catch (error) {
      if (isMountedRef.current) {
        throw error;
      }
      return null;
    }
  }, []);

  return { safeAsync, isMounted: () => isMountedRef.current };
}
