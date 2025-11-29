// Custom Service Worker for Background Sync
// This runs alongside the Vite PWA generated service worker

// Import Workbox libraries
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { registerRoute } = workbox.routing;
const { NetworkOnly, NetworkFirst } = workbox.strategies;

// Handle background sync events
self.addEventListener('sync', (event) => {
  console.log('Background sync event triggered:', event.tag);
  
  if (event.tag === 'sync-queue') {
    event.waitUntil(processSyncQueue());
  }
});

/**
 * Calculate exponential backoff delay in milliseconds
 */
function calculateBackoffDelay(retryCount) {
  const baseDelay = 1000; // 1 second
  const maxDelay = 60000; // 60 seconds max
  const delay = baseDelay * Math.pow(2, retryCount);
  return Math.min(delay, maxDelay);
}

/**
 * Check if enough time has passed since last attempt
 */
function shouldRetryItem(item) {
  if (item.retryCount === 0) return true;
  
  const requiredDelay = calculateBackoffDelay(item.retryCount - 1);
  const timeSinceLastAttempt = Date.now() - (item.lastAttemptTime || 0);
  
  return timeSinceLastAttempt >= requiredDelay;
}

// Process the sync queue
async function processSyncQueue() {
  try {
    // Open IndexedDB
    const db = await openSyncQueueDB();
    const tx = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const queue = await store.getAll();
    await tx.done;
    
    console.log(`Processing ${queue.length} items in sync queue`);
    
    let skipped = 0;
    
    for (const item of queue) {
      // Check if enough time has passed for retry with exponential backoff
      if (!shouldRetryItem(item)) {
        skipped++;
        const nextRetryIn = calculateBackoffDelay(item.retryCount - 1) - (Date.now() - (item.lastAttemptTime || 0));
        console.log(`Skipping item (backoff): ${item.url}, retry in ${Math.round(nextRetryIn / 1000)}s`);
        continue;
      }

      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: item.headers,
          body: item.body,
        });
        
        if (response.ok) {
          // Remove from queue on success
          const deleteTx = db.transaction('syncQueue', 'readwrite');
          await deleteTx.objectStore('syncQueue').delete(item.id);
          await deleteTx.done;
          
          console.log('Successfully synced:', item.url);
          
          // Notify clients of successful sync
          await notifyClients({
            type: 'SYNC_SUCCESS',
            itemId: item.id,
            url: item.url,
          });
        } else {
          // Increment retry count
          const updateTx = db.transaction('syncQueue', 'readwrite');
          const updateStore = updateTx.objectStore('syncQueue');
          item.retryCount += 1;
          item.lastAttemptTime = Date.now();
          
          if (item.retryCount >= item.maxRetries) {
            // Remove if max retries reached
            await updateStore.delete(item.id);
            console.log('Max retries reached, removing from queue:', item.url);
            
            await notifyClients({
              type: 'SYNC_FAILED',
              itemId: item.id,
              url: item.url,
              reason: 'Max retries reached',
            });
          } else {
            // Update retry count with exponential backoff
            await updateStore.put(item);
            const nextDelay = calculateBackoffDelay(item.retryCount);
            console.log(`Retry ${item.retryCount}/${item.maxRetries} for: ${item.url}, next retry in ${nextDelay / 1000}s`);
          }
          
          await updateTx.done;
        }
      } catch (error) {
        console.error('Error syncing item:', error);
        
        // Increment retry count on error
        const updateTx = db.transaction('syncQueue', 'readwrite');
        const updateStore = updateTx.objectStore('syncQueue');
        item.retryCount += 1;
        item.lastAttemptTime = Date.now();
        
        if (item.retryCount >= item.maxRetries) {
          await updateStore.delete(item.id);
          
          await notifyClients({
            type: 'SYNC_FAILED',
            itemId: item.id,
            url: item.url,
            reason: error.message,
          });
        } else {
          await updateStore.put(item);
          const nextDelay = calculateBackoffDelay(item.retryCount);
          console.log(`Error retry ${item.retryCount}/${item.maxRetries}, next attempt in ${nextDelay / 1000}s`);
        }
        
        await updateTx.done;
      }
    }
    
    console.log(`Sync queue processing complete (${skipped} items skipped due to backoff)`);
  } catch (error) {
    console.error('Error processing sync queue:', error);
  }
}

// Open IndexedDB
function openSyncQueueDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('welile-sync-queue', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('syncQueue')) {
        const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp');
      }
    };
  });
}

// Notify all clients
async function notifyClients(message) {
  const clients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window',
  });
  
  clients.forEach((client) => {
    client.postMessage(message);
  });
}

// Listen for online event to trigger sync
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ONLINE') {
    console.log('Device came online, triggering sync');
    processSyncQueue();
  }
});

// Intercept failed network requests and add to sync queue
registerRoute(
  ({ url }) => {
    // Only intercept Supabase API calls
    return url.hostname.includes('supabase.co') && 
           (url.pathname.includes('/rest/') || url.pathname.includes('/auth/'));
  },
  async ({ request }) => {
    const networkStrategy = new NetworkFirst({
      networkTimeoutSeconds: 10,
    });
    
    try {
      const response = await networkStrategy.handle({ request, event: self.event });
      return response;
    } catch (error) {
      console.log('Network request failed, adding to sync queue:', request.url);
      
      // Only queue write operations
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        try {
          const db = await openSyncQueueDB();
          const headers = {};
          request.headers.forEach((value, key) => {
            headers[key] = value;
          });
          
          const body = request.method !== 'GET' && request.method !== 'HEAD' 
            ? await request.text() 
            : undefined;
          
          const tx = db.transaction('syncQueue', 'readwrite');
          await tx.objectStore('syncQueue').put({
            id: `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            url: request.url,
            method: request.method,
            headers,
            body,
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: 3,
            lastAttemptTime: 0,
          });
          await tx.done;
          
          // Try to register background sync
          if ('sync' in self.registration) {
            await self.registration.sync.register('sync-queue');
          }
        } catch (dbError) {
          console.error('Failed to add to sync queue:', dbError);
        }
      }
      
      throw error;
    }
  }
);

console.log('Custom Service Worker loaded with Background Sync support');