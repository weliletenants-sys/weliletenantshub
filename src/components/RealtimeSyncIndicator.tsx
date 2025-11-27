import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface RealtimeSyncIndicatorProps {
  lastSyncTime?: Date;
  className?: string;
  compact?: boolean;
}

/**
 * Displays real-time sync status with animations
 * Shows:
 * - "Live" when connected and recently synced
 * - Pulse animation during active sync
 * - Offline indicator when disconnected
 */
export const RealtimeSyncIndicator = ({ 
  lastSyncTime, 
  className,
  compact = false 
}: RealtimeSyncIndicatorProps) => {
  const [showSyncAnimation, setShowSyncAnimation] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show sync animation when lastSyncTime updates
  useEffect(() => {
    if (lastSyncTime) {
      setShowSyncAnimation(true);
      const timer = setTimeout(() => setShowSyncAnimation(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncTime]);

  if (!isOnline) {
    return (
      <Badge 
        variant="secondary" 
        className={cn(
          "gap-1.5 bg-muted text-muted-foreground",
          className
        )}
      >
        <WifiOff className="h-3 w-3" />
        {!compact && <span className="text-xs">Offline</span>}
      </Badge>
    );
  }

  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "gap-1.5 bg-success/10 text-success border-success/20 transition-all duration-300",
        showSyncAnimation && "animate-pulse bg-success/20",
        className
      )}
    >
      <div className="relative">
        <Wifi className={cn(
          "h-3 w-3",
          showSyncAnimation && "animate-ping absolute inset-0"
        )} />
        <Wifi className="h-3 w-3 relative" />
      </div>
      {!compact && <span className="text-xs">Live</span>}
    </Badge>
  );
};

interface SyncPulseProps {
  show: boolean;
  className?: string;
}

/**
 * Animated pulse indicator for active syncing
 * Can be placed on cards/sections being updated
 */
export const SyncPulse = ({ show, className }: SyncPulseProps) => {
  if (!show) return null;

  return (
    <div
      className={cn(
        "absolute -top-1 -right-1 h-3 w-3",
        className
      )}
    >
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
    </div>
  );
};

interface DataSyncBadgeProps {
  isSyncing: boolean;
  lastSyncTime?: Date;
  label?: string;
  className?: string;
}

/**
 * Combined badge showing sync status with text
 * Useful for table headers or section titles
 */
export const DataSyncBadge = ({ 
  isSyncing, 
  lastSyncTime, 
  label = "Data",
  className 
}: DataSyncBadgeProps) => {
  const [showSyncAnimation, setShowSyncAnimation] = useState(false);

  useEffect(() => {
    if (isSyncing || lastSyncTime) {
      setShowSyncAnimation(true);
      const timer = setTimeout(() => setShowSyncAnimation(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, lastSyncTime]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="relative">
        {showSyncAnimation && (
          <span className="absolute inset-0 flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        )}
        <div className={cn(
          "h-2 w-2 rounded-full transition-colors duration-300",
          showSyncAnimation ? "bg-success" : "bg-success/50"
        )} />
      </div>
    </div>
  );
};
