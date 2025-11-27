import { useEffect, useState } from "react";
import { Wifi, WifiOff, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CacheIndicatorProps {
  className?: string;
}

export const CacheIndicator = ({ className }: CacheIndicatorProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheStatus, setCacheStatus] = useState<'online' | 'cached' | 'offline'>('online');

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setCacheStatus('online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setCacheStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if service worker is active and caching
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        if (isOnline) {
          setCacheStatus('cached');
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  // Don't show when fully online and connected
  if (cacheStatus === 'online' && isOnline) {
    return null;
  }

  return (
    <Badge 
      variant={cacheStatus === 'offline' ? 'destructive' : 'secondary'}
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium transition-all",
        className
      )}
    >
      {cacheStatus === 'offline' && (
        <>
          <WifiOff className="h-3 w-3" />
          Offline Mode
        </>
      )}
      {cacheStatus === 'cached' && (
        <>
          <Database className="h-3 w-3" />
          Cached Data
        </>
      )}
    </Badge>
  );
};
