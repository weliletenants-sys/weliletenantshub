import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ContentTransitionProps {
  children: ReactNode;
  loading: boolean;
  skeleton: ReactNode;
  className?: string;
  /**
   * Delay before showing content (allows skeleton to animate out)
   * @default 150
   */
  transitionDelay?: number;
}

/**
 * Smooth transition component that fades between skeleton and actual content
 * Prevents layout shift and provides seamless visual flow
 */
export const ContentTransition = ({
  children,
  loading,
  skeleton,
  className,
  transitionDelay = 150,
}: ContentTransitionProps) => {
  const [showSkeleton, setShowSkeleton] = useState(loading);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (loading) {
      // Show skeleton immediately
      setShowSkeleton(true);
      setShowContent(false);
    } else {
      // Fade out skeleton first
      setShowSkeleton(false);
      
      // Then fade in content after delay
      const timer = setTimeout(() => {
        setShowContent(true);
      }, transitionDelay);

      return () => clearTimeout(timer);
    }
  }, [loading, transitionDelay]);

  return (
    <div className={cn('relative', className)}>
      {/* Skeleton Layer */}
      <div
        className={cn(
          'transition-opacity duration-300 ease-out',
          showSkeleton ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        style={{
          position: showSkeleton ? 'relative' : 'absolute',
          top: 0,
          left: 0,
          right: 0,
        }}
      >
        {skeleton}
      </div>

      {/* Content Layer */}
      <div
        className={cn(
          'transition-all duration-500 ease-out',
          showContent 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-2 pointer-events-none',
          !showSkeleton && 'block'
        )}
        style={{
          display: showSkeleton ? 'none' : 'block',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * Simpler fade transition for quick switches
 */
export const FadeTransition = ({
  children,
  show,
  className,
}: {
  children: ReactNode;
  show: boolean;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'transition-opacity duration-300 ease-out',
        show ? 'opacity-100' : 'opacity-0',
        className
      )}
    >
      {children}
    </div>
  );
};

/**
 * Slide-fade transition for cards and panels
 */
export const SlideUpTransition = ({
  children,
  show,
  delay = 0,
  className,
}: {
  children: ReactNode;
  show: boolean;
  delay?: number;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'transition-all duration-500 ease-out',
        show 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 translate-y-4',
        className
      )}
      style={{
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Staggered list transition for rendering items one by one
 */
export const StaggeredList = ({
  children,
  show,
  staggerDelay = 50,
  className,
}: {
  children: ReactNode[];
  show: boolean;
  staggerDelay?: number;
  className?: string;
}) => {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <SlideUpTransition
          key={index}
          show={show}
          delay={index * staggerDelay}
        >
          {child}
        </SlideUpTransition>
      ))}
    </div>
  );
};
