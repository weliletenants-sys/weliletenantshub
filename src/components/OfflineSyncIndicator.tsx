import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { syncPendingData, getPendingCount, isOnline } from "@/lib/offlineSync";

const OfflineSyncIndicator = () => {
  const [online, setOnline] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const updatePendingCount = async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  };

  const handleSync = async () => {
    if (!online) {
      toast.error("No internet connection");
      return;
    }

    setSyncing(true);
    toast.loading("Syncing data...");

    try {
      const result = await syncPendingData();
      
      if (result.success) {
        const total = result.syncedTenants + result.syncedCollections;
        if (total > 0) {
          toast.success(`Successfully synced ${total} item(s)`);
        } else {
          toast.success("All data is up to date");
        }
        await updatePendingCount();
      } else {
        toast.error("Sync failed. Will retry automatically.");
      }
    } catch (error) {
      toast.error("Sync failed. Check your connection.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    updatePendingCount();

    const handleOnline = () => {
      setOnline(true);
      toast.success("Back online! Syncing data...");
      handleSync();
    };

    const handleOffline = () => {
      setOnline(false);
      toast.warning("You're offline. Changes will sync when back online.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Update pending count every 30 seconds
    const interval = setInterval(updatePendingCount, 30000);

    // Auto-sync every 5 minutes when online
    const syncInterval = setInterval(() => {
      if (online && pendingCount > 0) {
        handleSync();
      }
    }, 5 * 60 * 1000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, [online, pendingCount]);

  return (
    <div className="flex items-center gap-2">
      {online ? (
        <>
          <Badge variant="outline" className="gap-1.5">
            <Cloud className="h-3 w-3 text-success" />
            Online
          </Badge>
          {pendingCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
              className="h-7 gap-1.5"
            >
              {syncing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {pendingCount} pending
            </Button>
          )}
          {pendingCount === 0 && (
            <Badge variant="outline" className="gap-1.5 bg-success/10">
              <CheckCircle2 className="h-3 w-3 text-success" />
              Synced
            </Badge>
          )}
        </>
      ) : (
        <>
          <Badge variant="destructive" className="gap-1.5">
            <CloudOff className="h-3 w-3" />
            Offline
          </Badge>
          {pendingCount > 0 && (
            <Badge variant="outline" className="gap-1.5">
              {pendingCount} pending sync
            </Badge>
          )}
        </>
      )}
    </div>
  );
};

export default OfflineSyncIndicator;
