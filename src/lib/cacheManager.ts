/**
 * Cache Manager - Utilities for managing service worker caches
 * Provides programmatic cache control for dashboard data
 */

export const CACHE_NAMES = {
  DASHBOARD_DATA: 'dashboard-data-cache',
  PROFILE: 'profile-cache',
  IMAGES: 'images-cache',
  SUPABASE_API: 'supabase-api-cache',
} as const;

/**
 * Check if service worker and caching is available
 */
export const isCacheAvailable = (): boolean => {
  return 'serviceWorker' in navigator && 'caches' in window;
};

/**
 * Get cache statistics for monitoring
 */
export const getCacheStats = async () => {
  if (!isCacheAvailable()) return null;

  try {
    const cacheNames = await caches.keys();
    const stats = await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        return {
          name,
          entries: keys.length,
        };
      })
    );

    return {
      totalCaches: cacheNames.length,
      caches: stats,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
};

/**
 * Manually cache important dashboard URLs for instant loading
 */
export const preCacheDashboardData = async (agentId: string) => {
  if (!isCacheAvailable()) return;

  const dashboardUrls = [
    `/rest/v1/agents?user_id=eq.${agentId}`,
    `/rest/v1/tenants?agent_id=eq.${agentId}`,
    `/rest/v1/collections?agent_id=eq.${agentId}`,
  ];

  try {
    const cache = await caches.open(CACHE_NAMES.DASHBOARD_DATA);
    
    // Note: This is a simplified version. In production, you'd want to
    // make actual fetch requests with proper auth headers
    console.log('Pre-caching dashboard data for agent:', agentId);
  } catch (error) {
    console.error('Error pre-caching dashboard data:', error);
  }
};

/**
 * Clear old cache entries to free up storage
 */
export const clearOldCaches = async () => {
  if (!isCacheAvailable()) return;

  try {
    const cacheNames = await caches.keys();
    const currentCaches = Object.values(CACHE_NAMES);
    
    const deletionPromises = cacheNames
      .filter(name => !currentCaches.includes(name as any))
      .map(name => caches.delete(name));

    await Promise.all(deletionPromises);
    console.log('Cleared old caches');
  } catch (error) {
    console.error('Error clearing old caches:', error);
  }
};

/**
 * Force update the service worker
 */
export const updateServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating service worker:', error);
    return false;
  }
};

/**
 * Get current cache size estimate (if available)
 */
export const getCacheSize = async (): Promise<{
  usage: number;
  quota: number;
  percentage: number;
} | null> => {
  if (!('storage' in navigator && 'estimate' in navigator.storage)) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? (usage / quota) * 100 : 0;

    return {
      usage,
      quota,
      percentage,
    };
  } catch (error) {
    console.error('Error getting cache size:', error);
    return null;
  }
};
