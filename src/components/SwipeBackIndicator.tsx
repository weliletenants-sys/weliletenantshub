import { ChevronLeft } from 'lucide-react';

interface SwipeBackIndicatorProps {
  progress: number;
}

/**
 * Visual indicator for swipe-back gesture
 * Shows iOS-style back arrow during swipe
 */
const SwipeBackIndicator = ({ progress }: SwipeBackIndicatorProps) => {
  if (progress === 0) return null;

  return (
    <div
      className="fixed left-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
      style={{
        transform: `translateX(${progress * 60 - 60}px) translateY(-50%)`,
        opacity: progress,
      }}
    >
      <div className="bg-primary/20 backdrop-blur-sm rounded-full p-3 shadow-lg">
        <ChevronLeft className="h-8 w-8 text-primary" />
      </div>
    </div>
  );
};

export default SwipeBackIndicator;
