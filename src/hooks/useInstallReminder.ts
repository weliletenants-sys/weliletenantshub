import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Hook that reminds users to install the PWA every minute
 * Only shows reminders when app is not installed and install prompt is available
 */
export const useInstallReminder = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed (running in standalone mode)
    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      return isStandalone || isIOSStandalone;
    };

    setIsInstalled(checkIfInstalled());

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success('🎉 App Installed!', {
        description: 'You can now use Welile from your home screen',
      });
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    // Only set up reminder if app is not installed and we have an install prompt
    if (isInstalled || !deferredPrompt) {
      return;
    }

    // Show reminder every minute (60000ms)
    const reminderInterval = setInterval(() => {
      showInstallReminder();
    }, 60000); // 1 minute

    // Show initial reminder after 10 seconds of page load
    const initialTimeout = setTimeout(() => {
      showInstallReminder();
    }, 10000);

    return () => {
      clearInterval(reminderInterval);
      clearTimeout(initialTimeout);
    };
  }, [isInstalled, deferredPrompt]);

  const showInstallReminder = () => {
    if (isInstalled || !deferredPrompt) return;

    toast('📲 Install Welile App', {
      description: 'Add to home screen for faster access and offline use',
      duration: 10000,
      action: {
        label: 'Install',
        onClick: handleInstall,
      },
    });
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // For iOS, show manual instructions
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        toast.info('📱 Install on iOS', {
          description: 'Tap the Share button, then "Add to Home Screen"',
          duration: 15000,
        });
      } else {
        toast.info('Install from browser menu', {
          description: 'Look for "Install" or "Add to Home Screen" in your browser menu',
          duration: 10000,
        });
      }
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        toast.success('Installing app...', {
          description: 'App will be added to your home screen',
        });
      }

      setDeferredPrompt(null);
    } catch (error) {
      console.error('Install prompt error:', error);
    }
  };

  return {
    canInstall: !isInstalled && !!deferredPrompt,
    isInstalled,
    handleInstall,
  };
};
