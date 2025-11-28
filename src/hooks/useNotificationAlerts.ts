import { useEffect, useRef } from 'react';

interface NotificationAlert {
  playPaymentAlert: () => void;
  vibrateForPayment: () => void;
}

interface NotificationPreferences {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

const PREFERENCES_KEY = 'notification_preferences';

const getPreferences = (): NotificationPreferences => {
  const stored = localStorage.getItem(PREFERENCES_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { soundEnabled: true, vibrationEnabled: true };
    }
  }
  return { soundEnabled: true, vibrationEnabled: true };
};

export const setNotificationPreferences = (preferences: NotificationPreferences) => {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
};

export const getNotificationPreferences = getPreferences;

export const useNotificationAlerts = (): NotificationAlert => {
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    let isCleanedUp = false;
    
    const initAudio = () => {
      if (!audioContextRef.current && !isCleanedUp) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (error) {
          console.error('Failed to initialize AudioContext:', error);
        }
      }
    };

    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });

    return () => {
      isCleanedUp = true;
      document.removeEventListener('click', initAudio);
      document.removeEventListener('touchstart', initAudio);
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
      }
    };
  }, []);

  const playPaymentAlert = () => {
    // Check if sound is enabled in preferences
    const preferences = getPreferences();
    if (!preferences.soundEnabled) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const context = audioContextRef.current;
    const currentTime = context.currentTime;

    // Create a pleasant notification sound (two-tone chime)
    const oscillator1 = context.createOscillator();
    const oscillator2 = context.createOscillator();
    const gainNode = context.createGain();

    // First tone - higher pitch
    oscillator1.type = 'sine';
    oscillator1.frequency.setValueAtTime(800, currentTime);
    
    // Second tone - lower pitch for harmony
    oscillator2.type = 'sine';
    oscillator2.frequency.setValueAtTime(600, currentTime);

    // Volume envelope
    gainNode.gain.setValueAtTime(0, currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.5);

    // Connect nodes
    oscillator1.connect(gainNode);
    oscillator2.connect(gainNode);
    gainNode.connect(context.destination);

    // Play the sound
    oscillator1.start(currentTime);
    oscillator2.start(currentTime);
    oscillator1.stop(currentTime + 0.5);
    oscillator2.stop(currentTime + 0.5);

    // Play second chime after a short delay
    setTimeout(() => {
      const osc1 = context.createOscillator();
      const osc2 = context.createOscillator();
      const gain = context.createGain();
      const time = context.currentTime;

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(900, time);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(700, time);

      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.25, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(context.destination);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 0.4);
      osc2.stop(time + 0.4);
    }, 150);
  };

  const vibrateForPayment = () => {
    // Check if vibration is enabled in preferences
    const preferences = getPreferences();
    if (!preferences.vibrationEnabled) {
      return;
    }

    // Check if vibration API is supported
    if ('vibrate' in navigator) {
      // Pattern: short-long-short vibration for payment notifications
      // [vibrate, pause, vibrate, pause, vibrate]
      navigator.vibrate([100, 50, 200, 50, 100]);
    }
  };

  return {
    playPaymentAlert,
    vibrateForPayment,
  };
};
