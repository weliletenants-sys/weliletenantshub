import { useEffect, useState } from 'react';
import { haptics } from '@/utils/haptics';

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Trigger haptic feedback on splash screen appearance
    haptics.light();

    // Reduced splash duration for faster load
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 1200);

    // Complete after fade out animation
    const completeTimer = setTimeout(() => {
      haptics.success();
      onComplete();
    }, 1500);

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
      <div className="flex flex-col items-center gap-6">
        <div className="animate-logo-entrance w-48 h-48">
          <img
            src="/welile-logo.jpg"
            alt="Welile Logo"
            className="w-full h-full object-contain rounded-2xl shadow-2xl"
          />
        </div>
        <div className="flex gap-2 animate-fade-in-delay-1">
          <div className="w-3 h-3 bg-primary-foreground rounded-full animate-bounce [animation-delay:0ms]" />
          <div className="w-3 h-3 bg-primary-foreground rounded-full animate-bounce [animation-delay:150ms]" />
          <div className="w-3 h-3 bg-primary-foreground rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
