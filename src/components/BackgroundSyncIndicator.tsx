import { useBackgroundSync } from '@/hooks/useBackgroundSync';
import { RefreshCw, Wifi, WifiOff, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

export const BackgroundSyncIndicator = () => {
  const { pendingCount, isSyncing, triggerSync } = useBackgroundSync();
  const isOnline = useConnectionStatus();

  if (pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 space-y-3 max-w-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">Background Sync</p>
              <p className="text-xs text-muted-foreground">
                {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
          
          <Badge variant="secondary" className="text-xs">
            {pendingCount} pending
          </Badge>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={triggerSync}
            disabled={!isOnline || isSyncing}
            className="flex-1"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-2" />
                Sync Now
              </>
            )}
          </Button>
        </div>
        
        {!isOnline && (
          <p className="text-xs text-muted-foreground">
            Will sync automatically when back online
          </p>
        )}
      </div>
    </div>
  );
};