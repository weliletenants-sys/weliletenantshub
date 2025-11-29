import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SyncQueueDB extends DBSchema {
  syncQueue: {
    key: string;
    value: {
      id: string;
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
      timestamp: number;
      retryCount: number;
      maxRetries: number;
      lastAttemptTime: number;
    };
  };
}

let db: IDBPDatabase<SyncQueueDB> | null = null;

export const initSyncQueue = async () => {
  if (db) return db;
  
  db = await openDB<SyncQueueDB>('welile-sync-queue', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      }
    },
  });
  
  return db;
};

export const addToSyncQueue = async (
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: any
) => {
  const database = await initSyncQueue();
  const id = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  await database.put('syncQueue', {
    id,
    url,
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    timestamp: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    lastAttemptTime: 0,
  });
  
  // Register background sync if supported
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // @ts-ignore - sync is experimental API
      if ('sync' in registration) {
        // @ts-ignore
        await registration.sync.register('sync-queue');
      }
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }
  
  return id;
};

export const getSyncQueue = async () => {
  const database = await initSyncQueue();
  return database.getAll('syncQueue');
};

export const removeFromSyncQueue = async (id: string) => {
  const database = await initSyncQueue();
  await database.delete('syncQueue', id);
};

export const incrementRetryCount = async (id: string) => {
  const database = await initSyncQueue();
  const item = await database.get('syncQueue', id);
  
  if (item) {
    item.retryCount += 1;
    item.lastAttemptTime = Date.now();
    await database.put('syncQueue', item);
    return item.retryCount;
  }
  
  return 0;
};

/**
 * Calculate exponential backoff delay in milliseconds
 * Formula: baseDelay * (2 ^ retryCount)
 * Example: 1s, 2s, 4s, 8s, 16s...
 */
export const calculateBackoffDelay = (retryCount: number): number => {
  const baseDelay = 1000; // 1 second
  const maxDelay = 60000; // 60 seconds max
  const delay = baseDelay * Math.pow(2, retryCount);
  return Math.min(delay, maxDelay);
};

/**
 * Check if enough time has passed since last attempt based on exponential backoff
 */
export const shouldRetryItem = (item: { retryCount: number; lastAttemptTime: number }): boolean => {
  if (item.retryCount === 0) return true;
  
  const requiredDelay = calculateBackoffDelay(item.retryCount - 1);
  const timeSinceLastAttempt = Date.now() - item.lastAttemptTime;
  
  return timeSinceLastAttempt >= requiredDelay;
};

export const processSyncQueue = async () => {
  const database = await initSyncQueue();
  const queue = await database.getAll('syncQueue');
  
  const results = {
    success: 0,
    failed: 0,
    removed: 0,
    skipped: 0,
  };
  
  for (const item of queue) {
    // Check if enough time has passed for retry with exponential backoff
    if (!shouldRetryItem(item)) {
      results.skipped += 1;
      continue;
    }

    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      
      if (response.ok) {
        await database.delete('syncQueue', item.id);
        results.success += 1;
      } else {
        const newRetryCount = await incrementRetryCount(item.id);
        
        if (newRetryCount >= item.maxRetries) {
          await database.delete('syncQueue', item.id);
          results.removed += 1;
        } else {
          results.failed += 1;
        }
      }
    } catch (error) {
      console.error('Sync queue item failed:', error);
      
      const newRetryCount = await incrementRetryCount(item.id);
      
      if (newRetryCount >= item.maxRetries) {
        await database.delete('syncQueue', item.id);
        results.removed += 1;
      } else {
        results.failed += 1;
      }
    }
  }
  
  return results;
};

export const getPendingSyncCount = async () => {
  const database = await initSyncQueue();
  const queue = await database.getAll('syncQueue');
  return queue.length;
};

export const clearSyncQueue = async () => {
  const database = await initSyncQueue();
  const queue = await database.getAll('syncQueue');
  
  for (const item of queue) {
    await database.delete('syncQueue', item.id);
  }
};