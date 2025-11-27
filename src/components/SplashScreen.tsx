import { useEffect, useState } from 'react';
import { haptics } from '@/utils/haptics';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Trigger haptic feedback on splash screen appearance
    haptics.medium();

    // Show splash for 2 seconds, then fade out
    const timer = setTimeout(() => {
      setIsVisible(false);
      // Light haptic on exit
      haptics.light();
    }, 2000);

    // Complete after fade out animation with success haptic
    const completeTimer = setTimeout(() => {
      haptics.success();
      onComplete();
    }, 2500);

    return () => {
      clearTimeout(timer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-primary transition-opacity duration-500 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-700">
        <img
          src="/welile-logo.jpg"
          alt="Welile Logo"
          className="w-48 h-48 object-contain rounded-2xl shadow-2xl"
        />
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-primary-foreground rounded-full animate-bounce [animation-delay:0ms]" />
          <div className="w-3 h-3 bg-primary-foreground rounded-full animate-bounce [animation-delay:150ms]" />
          <div className="w-3 h-3 bg-primary-foreground rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
