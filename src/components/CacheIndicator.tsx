import { useEffect, useState } from "react";
import { Database, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getCacheStats, getCacheSize } from "@/lib/cacheManager";

interface CacheIndicatorProps {
  className?: string;
}

export const CacheIndicator = ({ className }: CacheIndicatorProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheStats, setCacheStats] = useState<{ totalCaches: number; entries: number } | null>(null);
  const [cacheSize, setCacheSize] = useState<{ percentage: number; usageMB: number } | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load cache stats
    const loadStats = async () => {
      const stats = await getCacheStats();
      if (stats) {
        const totalEntries = stats.caches.reduce((sum, cache) => sum + cache.entries, 0);
        setCacheStats({
          totalCaches: stats.totalCaches,
          entries: totalEntries,
        });
      }

      const size = await getCacheSize();
      if (size) {
        setCacheSize({ 
          percentage: Math.round(size.percentage * 10) / 10,
          usageMB: Math.round(size.usage / (1024 * 1024) * 10) / 10
        });
      }
    };

    loadStats();

    // Refresh stats every 30 seconds
    const interval = setInterval(loadStats, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (!cacheStats) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant={isOnline ? "secondary" : "destructive"}
          className={cn(
            "gap-1.5 cursor-help transition-all",
            className
          )}
        >
          {isOnline ? (
            <Database className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          <span className="text-xs font-medium">
            {isOnline ? 'Cached' : 'Offline'}
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1.5 text-xs">
          <p className="font-semibold text-sm">
            {isOnline ? '✓ Online & Cached' : '⚠ Offline Mode'}
          </p>
          <div className="space-y-0.5 text-muted-foreground">
            <p>
              {cacheStats.entries} items cached
            </p>
            <p>
              {cacheStats.totalCaches} active caches
            </p>
            {cacheSize && (
              <>
                <p>
                  {cacheSize.usageMB} MB used ({cacheSize.percentage}% of quota)
                </p>
              </>
            )}
          </div>
          {!isOnline && (
            <p className="text-yellow-600 dark:text-yellow-500 pt-1 border-t border-border">
              Working offline - some features limited
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
