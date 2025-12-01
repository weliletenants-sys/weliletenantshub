import { useEffect, useState } from 'react';
import { toast } from 'sonner';

// Version is based on build timestamp
const CURRENT_VERSION = import.meta.env.VITE_BUILD_TIME || Date.now().toString();
const VERSION_CHECK_INTERVAL = 2 * 60 * 1000; // Check every 2 minutes
const VERSION_STORAGE_KEY = 'app_version';
const LAST_SEEN_VERSION_KEY = 'last_seen_version';
const CHANGELOG_SHOWN_KEY = 'changelog_shown_for_version';

/**
 * Hook to check for new app versions and force updates
 * Ensures all devices always run the latest version
 */
export const useVersionCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);

  const checkVersion = async () => {
    try {
      setIsChecking(true);
      
      // Dispatch event for UI indicator
      window.dispatchEvent(new Event('version-check-start'));
      
      // Fetch version.json with cache-busting
      const response = await fetch(`/version.json?v=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch version');
      }

      const versionData = await response.json();
      const serverVersion = versionData.version || versionData.buildTime;

      // Get stored version
      const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);

      if (storedVersion && serverVersion && storedVersion !== serverVersion) {
        console.log('🔄 New version detected!', {
          server: serverVersion,
          current: storedVersion
        });
        setNewVersion(serverVersion);
        setUpdateRequired(true);
        
        // Show update notification with more info
        toast.success('🎉 New Update Available!', {
          description: 'Applying latest version in 3 seconds...',
          duration: 3000,
        });

        // Auto-update after 3 seconds
        setTimeout(() => {
          forceUpdate(serverVersion);
        }, 3000);
      } else if (serverVersion && !storedVersion) {
        // First time visit, store version
        console.log('📦 First load - storing version:', serverVersion);
        localStorage.setItem(VERSION_STORAGE_KEY, serverVersion);
      } else {
        console.log('✅ App is up to date:', serverVersion);
      }
      
      // Dispatch completion event
      window.dispatchEvent(new Event('version-check-complete'));
    } catch (error) {
      console.error('❌ Version check failed:', error);
      window.dispatchEvent(new Event('version-check-complete'));
    } finally {
      setIsChecking(false);
    }
  };

  const forceUpdate = async (newVersionId?: string) => {
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('All caches cleared for update');
      }

      // Update stored version
      if (newVersionId) {
        localStorage.setItem(VERSION_STORAGE_KEY, newVersionId);
        // Mark that we should show changelog after reload
        localStorage.setItem('show_changelog_on_load', 'true');
      }

      // Force reload with cache bypass
      window.location.reload();
    } catch (error) {
      console.error('Force update failed:', error);
      // Fallback: regular reload
      window.location.reload();
    }
  };

  // Check if we should show changelog on load (after update)
  useEffect(() => {
    const shouldShowChangelog = localStorage.getItem('show_changelog_on_load');
    if (shouldShowChangelog === 'true') {
      localStorage.removeItem('show_changelog_on_load');
      // Show changelog after a short delay to let the app load
      setTimeout(() => {
        setShowChangelog(true);
      }, 1000);
    }
  }, []);

  useEffect(() => {
    // Initial version check on mount
    checkVersion();

    // Periodic version checks
    const intervalId = setInterval(() => {
      checkVersion();
    }, VERSION_CHECK_INTERVAL);

    // Check on window focus (user returns to app)
    const handleFocus = () => {
      checkVersion();
    };
    window.addEventListener('focus', handleFocus);

    // Check on online event (network reconnects)
    const handleOnline = () => {
      checkVersion();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return {
    isChecking,
    updateRequired,
    checkVersion,
    forceUpdate,
    currentVersion: CURRENT_VERSION,
    showChangelog,
    setShowChangelog,
    newVersion,
  };
};
