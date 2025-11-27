import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const SNOOZE_KEY = 'install_reminder_snooze';

type SnoozeDuration = '5min' | '1hour' | '1day' | 'forever';

/**
 * Hook that reminds users to install the PWA every minute
 * Only shows reminders when app is not installed and install prompt is available
 * Supports snooze functionality to temporarily dismiss reminders
 */
export const useInstallReminder = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSnoozed, setIsSnoozed] = useState(false);

  // Check if snooze is active
  const checkSnooze = () => {
    const snoozeData = localStorage.getItem(SNOOZE_KEY);
    if (!snoozeData) return false;

    try {
      const { until } = JSON.parse(snoozeData);
      const now = Date.now();
      
      if (now < until) {
        return true; // Still snoozed
      } else {
        // Snooze expired, clear it
        localStorage.removeItem(SNOOZE_KEY);
        return false;
      }
    } catch {
      localStorage.removeItem(SNOOZE_KEY);
      return false;
    }
  };

  // Set snooze for a specific duration
  const snoozeReminder = (duration: SnoozeDuration) => {
    const now = Date.now();
    let until: number;

    switch (duration) {
      case '5min':
        until = now + 5 * 60 * 1000; // 5 minutes
        break;
      case '1hour':
        until = now + 60 * 60 * 1000; // 1 hour
        break;
      case '1day':
        until = now + 24 * 60 * 60 * 1000; // 1 day
        break;
      case 'forever':
        until = now + 365 * 24 * 60 * 60 * 1000; // 1 year (effectively forever)
        break;
      default:
        until = now + 60 * 60 * 1000; // Default 1 hour
    }

    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ until }));
    setIsSnoozed(true);

    const durationText = 
      duration === '5min' ? '5 minutes' :
      duration === '1hour' ? '1 hour' :
      duration === '1day' ? '1 day' :
      'indefinitely';

    toast.success('⏰ Reminder Snoozed', {
      description: `Install reminders paused for ${durationText}`,
    });
  };

  useEffect(() => {
    // Check if app is already installed (running in standalone mode)
    const checkIfInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      return isStandalone || isIOSStandalone;
    };

    setIsInstalled(checkIfInstalled());
    setIsSnoozed(checkSnooze());

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
      localStorage.removeItem(SNOOZE_KEY); // Clear snooze on install
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
    // Only set up reminder if app is not installed, we have an install prompt, and not snoozed
    if (isInstalled || !deferredPrompt || isSnoozed) {
      return;
    }

    // Show reminder every minute (60000ms)
    const reminderInterval = setInterval(() => {
      // Check snooze status before showing reminder
      if (!checkSnooze()) {
        showInstallReminder();
      } else {
        setIsSnoozed(true);
      }
    }, 60000); // 1 minute

    // Show initial reminder after 10 seconds of page load
    const initialTimeout = setTimeout(() => {
      if (!checkSnooze()) {
        showInstallReminder();
      } else {
        setIsSnoozed(true);
      }
    }, 10000);

    return () => {
      clearInterval(reminderInterval);
      clearTimeout(initialTimeout);
    };
  }, [isInstalled, deferredPrompt, isSnoozed]);

  const showInstallReminder = () => {
    if (isInstalled || !deferredPrompt || checkSnooze()) return;

    toast('📲 Install Welile App', {
      description: 'Add to home screen for faster access and offline use',
      duration: 15000,
      action: {
        label: 'Install Now',
        onClick: handleInstall,
      },
      cancel: {
        label: 'Remind Me',
        onClick: () => {
          // Show snooze options in a new toast
          toast('⏰ Snooze Install Reminder', {
            description: 'When should we remind you again?',
            duration: 10000,
            action: {
              label: '5 min',
              onClick: () => snoozeReminder('5min'),
            },
            cancel: {
              label: 'More',
              onClick: () => showSnoozeOptions(),
            },
          });
        },
      },
    });
  };

  const showSnoozeOptions = () => {
    toast('⏰ Choose Snooze Duration', {
      description: 'Select how long to pause install reminders',
      duration: 15000,
      action: {
        label: '1 Hour',
        onClick: () => snoozeReminder('1hour'),
      },
      cancel: {
        label: 'More Options',
        onClick: () => showExtendedSnoozeOptions(),
      },
    });
  };

  const showExtendedSnoozeOptions = () => {
    toast('⏰ Extended Snooze Options', {
      description: 'Pause reminders for longer periods',
      duration: 15000,
      action: {
        label: '1 Day',
        onClick: () => snoozeReminder('1day'),
      },
      cancel: {
        label: "Don't Ask Again",
        onClick: () => snoozeReminder('forever'),
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
        localStorage.removeItem(SNOOZE_KEY); // Clear snooze on install
      } else {
        // User dismissed, offer to snooze
        toast('Maybe later?', {
          description: 'Would you like to snooze these reminders?',
          duration: 8000,
          action: {
            label: 'Snooze 1 Hour',
            onClick: () => snoozeReminder('1hour'),
          },
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
    isSnoozed,
    handleInstall,
    snoozeReminder,
  };
};

