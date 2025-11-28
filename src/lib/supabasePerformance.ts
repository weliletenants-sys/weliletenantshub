import { supabase } from '@/integrations/supabase/client';
import { trackApi } from './performanceMonitor';

/**
 * Wrapper functions for Supabase operations with performance tracking
 */

type QueryResult<T> = {
  data: T | null;
  error: any;
  count?: number | null;
  status: number;
  statusText: string;
};

/**
 * Execute a Supabase query with performance tracking
 */
export async function executeWithTracking<T>(
  operationName: string,
  queryPromise: Promise<QueryResult<T>>,
  metadata?: Record<string, any>
): Promise<QueryResult<T>> {
  const startTime = performance.now();
  
  try {
    const result = await queryPromise;
    const duration = performance.now() - startTime;
    
    trackApi(operationName, duration, {
      ...metadata,
      rowCount: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0,
      hasError: !!result.error,
      status: result.status,
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    trackApi(operationName, duration, {
      ...metadata,
      error: error instanceof Error ? error.message : 'Unknown error',
      hasError: true,
    });
    throw error;
  }
}

/**
 * Helper to track Supabase auth operations
 */
export async function trackAuthOperation<T>(
  operationName: string,
  authPromise: Promise<T>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await authPromise;
    const duration = performance.now() - startTime;
    trackApi(`Auth: ${operationName}`, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    trackApi(`Auth: ${operationName}`, duration, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Export wrapped supabase client
export { supabase };
