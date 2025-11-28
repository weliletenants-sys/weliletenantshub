import { ReactNode } from "react";

interface SkeletonWrapperProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  fadeIn?: boolean;
}

/**
 * Wrapper component for smooth skeleton to content transitions
 * Prevents layout shift and provides fade-in animation
 */
export const SkeletonWrapper = ({ 
  loading, 
  skeleton, 
  children,
  fadeIn = true 
}: SkeletonWrapperProps) => {
  if (loading) {
    return <>{skeleton}</>;
  }

  return (
    <div className={fadeIn ? "animate-fade-in" : ""}>
      {children}
    </div>
  );
};
