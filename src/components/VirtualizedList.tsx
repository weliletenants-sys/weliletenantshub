import { ReactNode, useRef, CSSProperties } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useIsMobile } from '@/hooks/use-mobile';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  height?: string;
  overscanCount?: number;
  renderItem: (item: T, index: number) => ReactNode;
  emptyMessage?: ReactNode;
  className?: string;
}

/**
 * Virtualized list component for rendering large lists efficiently
 * Only renders visible items + overscan buffer to improve performance
 * Dramatically reduces memory usage and improves scroll performance on smartphones
 */
export function VirtualizedList<T>({
  items,
  itemHeight,
  height = '600px',
  overscanCount = 3,
  renderItem,
  emptyMessage,
  className = '',
}: VirtualizedListProps<T>) {
  const isMobile = useIsMobile();
  const parentRef = useRef<HTMLDivElement>(null);

  // Auto-adjust overscan for mobile devices (fewer items to reduce memory)
  const adjustedOverscan = isMobile ? Math.min(overscanCount, 2) : overscanCount;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: adjustedOverscan,
  });

  if (items.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`} style={{ height }}>
        {emptyMessage || <p className="text-muted-foreground">No items to display</p>}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height, contain: 'strict' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
