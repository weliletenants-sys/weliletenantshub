import { ProgressiveImage } from '@/components/ui/progressive-image';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TenantPhotoProps {
  photoUrl?: string | null;
  tenantName: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'w-10 h-10',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
  xl: 'w-32 h-32',
};

/**
 * Tenant photo component with progressive loading
 * Shows placeholder avatar when no photo is available
 */
export const TenantPhoto = ({
  photoUrl,
  tenantName,
  className,
  size = 'md',
}: TenantPhotoProps) => {
  if (!photoUrl) {
    return (
      <div
        className={cn(
          'rounded-full bg-muted flex items-center justify-center',
          sizeClasses[size],
          className
        )}
      >
        <User className={cn(
          'text-muted-foreground',
          size === 'sm' && 'w-5 h-5',
          size === 'md' && 'w-8 h-8',
          size === 'lg' && 'w-12 h-12',
          size === 'xl' && 'w-16 h-16',
        )} />
      </div>
    );
  }

  return (
    <ProgressiveImage
      src={photoUrl}
      alt={`${tenantName} photo`}
      className={cn('rounded-full', sizeClasses[size], className)}
      placeholderClassName="object-cover"
    />
  );
};
