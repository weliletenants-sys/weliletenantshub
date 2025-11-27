import { useEffect, useState } from 'react';
import { registerSyncCallback } from './useRealtimeSubscription';

/**
 * Hook to track real-time sync events for visual indicators
 * Returns the last sync time which triggers animations
 */
export const useRealtimeSyncStatus = (table?: string) => {
  const [lastSyncTime, setLastSyncTime] = useState<Date>();

  useEffect(() => {
    const unregister = registerSyncCallback((syncedTable) => {
      // If specific table is provided, only update for that table
      if (!table || syncedTable === table) {
        setLastSyncTime(new Date());
      }
    });

    return () => {
      unregister();
    };
  }, [table]);

  return { lastSyncTime };
};
