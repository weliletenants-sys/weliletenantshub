import { useState } from 'react';

interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoff?: boolean;
}

/**
 * Hook to retry failed async operations with exponential backoff
 * Improves reliability for network requests and critical operations
 */
export const useRetry = () => {
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = async <T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> => {
    const { maxAttempts = 3, delayMs = 1000, backoff = true } = options;
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setIsRetrying(attempt > 1);
        const result = await fn();
        setIsRetrying(false);
        return result;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, error);
        
        if (attempt < maxAttempts) {
          const delay = backoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    setIsRetrying(false);
    throw lastError;
  };

  return { retry, isRetrying };
};
