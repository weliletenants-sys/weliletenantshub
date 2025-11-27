import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Hook to manage service worker lifecycle and updates
 */
export const useServiceWorker = () => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Get the registration
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        setRegistration(reg);

        // Check for updates every 30 minutes
        const intervalId = setInterval(() => {
          reg.update();
        }, 30 * 60 * 1000);

        // Listen for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setIsUpdateAvailable(true);
                toast.info('App update available', {
                  description: 'A new version is ready. Reload to update.',
                  duration: 10000,
                  action: {
                    label: 'Reload',
                    onClick: () => window.location.reload(),
                  },
                });
              }
            });
          }
        });

        return () => clearInterval(intervalId);
      }
    });

    // Listen for service worker controller changes
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, []);

  const updateApp = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  return {
    isUpdateAvailable,
    updateApp,
    registration,
  };
};
