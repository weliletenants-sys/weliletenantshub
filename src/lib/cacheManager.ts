/**
 * Cache Manager - Utilities for managing service worker caches
 * Provides programmatic cache control for dashboard data with versioning
 */

const CACHE_VERSION = 'v1';

export const CACHE_NAMES = {
  DASHBOARD_DATA: `dashboard-data-cache-${CACHE_VERSION}`,
  PROFILE: `profile-cache-${CACHE_VERSION}`,
  IMAGES: `images-cache-${CACHE_VERSION}`,
  STORAGE_IMAGES: `storage-images-cache-${CACHE_VERSION}`,
  MANAGER_DATA: `manager-data-cache-${CACHE_VERSION}`,
  SUPABASE_API: `supabase-api-cache-${CACHE_VERSION}`,
  GOOGLE_FONTS: `google-fonts-cache-${CACHE_VERSION}`,
} as const;

// App version for cache invalidation
const APP_VERSION = '1.0.0';
const CACHE_VERSION_KEY = 'cache_app_version';

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
 * Check if cache needs invalidation based on app version
 */
export const checkCacheVersion = async (): Promise<boolean> => {
  if (!isCacheAvailable()) return false;

  try {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    
    if (storedVersion !== APP_VERSION) {
      console.log(`App version changed: ${storedVersion} → ${APP_VERSION}. Clearing caches...`);
      await clearAllCaches();
      localStorage.setItem(CACHE_VERSION_KEY, APP_VERSION);
      return true; // Cache was invalidated
    }
    
    return false; // Cache is up to date
  } catch (error) {
    console.error('Error checking cache version:', error);
    return false;
  }
};

/**
 * Clear ALL caches (for version upgrades)
 */
export const clearAllCaches = async () => {
  if (!isCacheAvailable()) return;

  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    console.log('Cleared all caches');
  } catch (error) {
    console.error('Error clearing all caches:', error);
  }
};

/**
 * Clear old cache entries to free up storage
 */
export const clearOldCaches = async () => {
  if (!isCacheAvailable()) return;

  try {
    // First check if we need version-based invalidation
    const wasInvalidated = await checkCacheVersion();
    if (wasInvalidated) {
      console.log('Cache invalidated due to version change');
      return;
    }

    const cacheNames = await caches.keys();
    const currentCaches = Object.values(CACHE_NAMES);
    
    const deletionPromises = cacheNames
      .filter(name => !currentCaches.includes(name as any))
      .map(name => {
        console.log(`Deleting old cache: ${name}`);
        return caches.delete(name);
      });

    await Promise.all(deletionPromises);
    console.log('Cleared old caches');
  } catch (error) {
    console.error('Error clearing old caches:', error);
  }
};

/**
 * Clear specific cache by name
 */
export const clearCache = async (cacheName: string) => {
  if (!isCacheAvailable()) return;

  try {
    await caches.delete(cacheName);
    console.log(`Cleared cache: ${cacheName}`);
  } catch (error) {
    console.error(`Error clearing cache ${cacheName}:`, error);
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
