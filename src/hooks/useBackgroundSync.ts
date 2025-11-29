import { useEffect, useState } from 'react';
import { 
  initSyncQueue, 
  getSyncQueue, 
  processSyncQueue, 
  getPendingSyncCount 
} from '@/lib/syncQueue';
import { toast } from 'sonner';

export const useBackgroundSync = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Update pending count
  const updatePendingCount = async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Error getting pending count:', error);
    }
  };

  // Manual sync trigger
  const triggerSync = async () => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      const results = await processSyncQueue();
      
      if (results.success > 0) {
        toast.success(`Synced ${results.success} request${results.success > 1 ? 's' : ''}`);
      }
      
      if (results.removed > 0) {
        toast.error(`${results.removed} request${results.removed > 1 ? 's' : ''} failed after max retries`);
      }
      
      await updatePendingCount();
    } catch (error) {
      console.error('Manual sync failed:', error);
      toast.error('Sync failed. Will retry automatically.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    // Initialize sync queue
    initSyncQueue();
    
    // Update pending count on mount
    updatePendingCount();
    
    // Listen for online events
    const handleOnline = () => {
      console.log('Device came online, triggering sync');
      
      // Notify service worker
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'ONLINE' });
      }
      
      // Also trigger local sync
      triggerSync();
    };
    
    // Listen for service worker messages
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SYNC_SUCCESS') {
        updatePendingCount();
        toast.success('Background sync completed');
      }
      
      if (event.data && event.data.type === 'SYNC_FAILED') {
        updatePendingCount();
        toast.error(`Sync failed: ${event.data.reason}`);
      }
    };
    
    window.addEventListener('online', handleOnline);
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
    
    // Poll for pending count updates every 30 seconds
    const interval = setInterval(updatePendingCount, 30000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
      clearInterval(interval);
    };
  }, []);

  return {
    pendingCount,
    isSyncing,
    triggerSync,
    updatePendingCount,
  };
};