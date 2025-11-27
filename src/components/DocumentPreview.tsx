import { ProgressiveImage } from '@/components/ui/progressive-image';
import { FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DocumentPreviewProps {
  documentUrl?: string | null;
  documentType: string;
  className?: string;
}

/**
 * Document preview component with progressive loading
 * Shows preview for images, placeholder for other file types
 */
export const DocumentPreview = ({
  documentUrl,
  documentType,
  className,
}: DocumentPreviewProps) => {
  if (!documentUrl) {
    return (
      <div
        className={cn(
          'rounded-lg bg-muted flex flex-col items-center justify-center p-6 min-h-[200px]',
          className
        )}
      >
        <FileText className="w-12 h-12 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No {documentType} uploaded</p>
      </div>
    );
  }

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(documentUrl);

  if (isImage) {
    return (
      <div className={cn('relative group', className)}>
        <ProgressiveImage
          src={documentUrl}
          alt={`${documentType} document`}
          className="rounded-lg border border-border shadow-sm min-h-[200px]"
          placeholderClassName="object-cover"
        />
        <Button
          size="sm"
          variant="secondary"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => window.open(documentUrl, '_blank')}
        >
          <ExternalLink className="w-4 h-4 mr-1" />
          View Full
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg bg-muted flex flex-col items-center justify-center p-6 min-h-[200px] border border-border',
        className
      )}
    >
      <FileText className="w-12 h-12 text-primary mb-2" />
      <p className="text-sm font-medium mb-3">{documentType}</p>
      <Button
        size="sm"
        variant="outline"
        onClick={() => window.open(documentUrl, '_blank')}
      >
        <ExternalLink className="w-4 h-4 mr-2" />
        Open Document
      </Button>
    </div>
  );
};
