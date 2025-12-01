import { useEffect, useState } from 'react';
import { haptics } from '@/utils/haptics';
import { ProgressiveImage } from '@/components/ui/progressive-image';

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
      <div className="flex flex-col items-center gap-8">
        <div className="w-48 h-48 rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-700 ease-out scale-100 opacity-100">
          <ProgressiveImage
            src="/welile-logo.jpg"
            alt="Welile Logo"
            className="w-full h-full"
            placeholderClassName="object-contain"
            eager
          />
        </div>
        <div className="relative w-16 h-16">
          {/* Stable spinning loader */}
          <div className="absolute inset-0 border-4 border-primary-foreground/20 rounded-full" />
          <div className="absolute inset-0 border-4 border-transparent border-t-primary-foreground rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
