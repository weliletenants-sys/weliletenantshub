import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { clearOldCaches } from '@/lib/cacheManager';

/**
 * Hook to manage service worker lifecycle, updates, and cache management
 * Includes error handling and retry logic for improved stability
 */
export const useServiceWorker = () => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [cacheCleared, setCacheCleared] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Clear old caches on mount with error handling
    if (!cacheCleared) {
      clearOldCaches()
        .then(() => {
          setCacheCleared(true);
          console.log('Cache cleanup completed');
        })
        .catch((error) => {
          console.error('Cache cleanup failed:', error);
          setCacheCleared(true); // Continue anyway
        });
    }

    // Get the registration with error handling
    navigator.serviceWorker.getRegistration()
      .then((reg) => {
        if (reg) {
          setRegistration(reg);

          // Check for updates every 2 minutes (more aggressive)
          const intervalId = setInterval(() => {
            console.log('Checking for service worker updates...');
            reg.update().catch((error) => {
              console.error('Service worker update check failed:', error);
            });
          }, 2 * 60 * 1000);

          // Listen for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setIsUpdateAvailable(true);
                  
                  // Auto-update after 3 seconds
                  toast.success('🔄 Update Available', {
                    description: 'New version detected. Updating in 3 seconds...',
                    duration: 3000,
                  });
                  
                  setTimeout(() => {
                    // Clear caches and force reload
                    clearOldCaches()
                      .then(() => {
                        newWorker.postMessage({ type: 'SKIP_WAITING' });
                        window.location.reload();
                      })
                      .catch((error) => {
                        console.error('Cache clear failed, reloading anyway:', error);
                        window.location.reload();
                      });
                  }, 3000);
                }
              });
            }
          });

          return () => clearInterval(intervalId);
        }
      })
      .catch((error) => {
        console.error('Service worker registration check failed:', error);
      });

    // Listen for service worker controller changes
    const handleControllerChange = () => {
      console.log('Service worker controller changed, reloading...');
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [cacheCleared]);

  const updateApp = async () => {
    if (registration?.waiting) {
      // Clear caches before updating
      await clearOldCaches();
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  const checkForUpdates = async () => {
    if (registration) {
      await registration.update();
    }
  };

  return {
    isUpdateAvailable,
    updateApp,
    checkForUpdates,
    registration,
    cacheCleared,
  };
};
