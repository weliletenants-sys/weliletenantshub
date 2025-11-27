import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from '@/integrations/supabase/client';

interface OfflineDB extends DBSchema {
  pendingTenants: {
    key: string;
    value: {
      id: string;
      data: any;
      timestamp: number;
      synced: boolean;
    };
  };
  pendingCollections: {
    key: string;
    value: {
      id: string;
      data: any;
      timestamp: number;
      synced: boolean;
    };
  };
  pendingPayments: {
    key: string;
    value: {
      id: string;
      data: any;
      tenantId: string;
      timestamp: number;
      synced: boolean;
    };
  };
  syncStatus: {
    key: string;
    value: {
      lastSync: number;
      pendingCount: number;
    };
  };
}

let db: IDBPDatabase<OfflineDB> | null = null;

export const initOfflineDB = async () => {
  if (db) return db;
  
  db = await openDB<OfflineDB>('welile-offline', 2, {
    upgrade(db, oldVersion) {
      // Store for pending tenant additions
      if (!db.objectStoreNames.contains('pendingTenants')) {
        db.createObjectStore('pendingTenants', { keyPath: 'id' });
      }
      
      // Store for pending collections
      if (!db.objectStoreNames.contains('pendingCollections')) {
        db.createObjectStore('pendingCollections', { keyPath: 'id' });
      }
      
      // Store for pending payments (new in version 2)
      if (!db.objectStoreNames.contains('pendingPayments')) {
        db.createObjectStore('pendingPayments', { keyPath: 'id' });
      }
      
      // Store for sync status
      if (!db.objectStoreNames.contains('syncStatus')) {
        db.createObjectStore('syncStatus', { keyPath: 'key' });
      }
    },
  });
  
  return db;
};

export const addPendingTenant = async (tenantData: any) => {
  const database = await initOfflineDB();
  const id = `tenant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  await database.put('pendingTenants', {
    id,
    data: tenantData,
    timestamp: Date.now(),
    synced: false,
  });
  
  await updateSyncStatus();
  return id;
};

export const addPendingCollection = async (collectionData: any) => {
  const database = await initOfflineDB();
  const id = `collection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  await database.put('pendingCollections', {
    id,
    data: collectionData,
    timestamp: Date.now(),
    synced: false,
  });
  
  await updateSyncStatus();
  return id;
};

export const addPendingPayment = async (paymentData: any, tenantId: string) => {
  const database = await initOfflineDB();
  const id = `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  await database.put('pendingPayments', {
    id,
    data: paymentData,
    tenantId,
    timestamp: Date.now(),
    synced: false,
  });
  
  await updateSyncStatus();
  return id;
};

export const getPendingCount = async () => {
  const database = await initOfflineDB();
  const tenants = await database.getAll('pendingTenants');
  const collections = await database.getAll('pendingCollections');
  const payments = await database.getAll('pendingPayments');
  
  const unsynced = {
    tenants: tenants.filter(t => !t.synced).length,
    collections: collections.filter(c => !c.synced).length,
    payments: payments.filter(p => !p.synced).length,
  };
  
  return unsynced.tenants + unsynced.collections + unsynced.payments;
};

const updateSyncStatus = async () => {
  const database = await initOfflineDB();
  const count = await getPendingCount();
  
  const statusData: any = {
    key: 'main',
    lastSync: Date.now(),
    pendingCount: count,
  };
  
  await database.put('syncStatus', statusData);
};

export const syncPendingData = async () => {
  const database = await initOfflineDB();
  
  try {
    // Sync pending tenants
    const pendingTenants = await database.getAll('pendingTenants');
    const unsyncedTenants = pendingTenants.filter(t => !t.synced);
    
    for (const tenant of unsyncedTenants) {
      const { error } = await supabase.from('tenants').insert(tenant.data);
      
      if (!error) {
        // Mark as synced
        await database.put('pendingTenants', {
          ...tenant,
          synced: true,
        });
      } else {
        console.error('Error syncing tenant:', error);
        throw error;
      }
    }
    
    // Sync pending collections
    const pendingCollections = await database.getAll('pendingCollections');
    const unsyncedCollections = pendingCollections.filter(c => !c.synced);
    
    for (const collection of unsyncedCollections) {
      const { error } = await supabase.from('collections').insert(collection.data);
      
      if (!error) {
        // Mark as synced
        await database.put('pendingCollections', {
          ...collection,
          synced: true,
        });
      } else {
        console.error('Error syncing collection:', error);
        throw error;
      }
    }
    
    // Sync pending payments
    const pendingPayments = await database.getAll('pendingPayments');
    const unsyncedPayments = pendingPayments.filter(p => !p.synced);
    
    for (const payment of unsyncedPayments) {
      // Insert the collection
      const { error: collectionError } = await supabase
        .from('collections')
        .insert(payment.data);
      
      if (collectionError) {
        console.error('Error syncing payment:', collectionError);
        throw collectionError;
      }
      
      // Update tenant balance
      const { data: tenant } = await supabase
        .from('tenants')
        .select('outstanding_balance')
        .eq('id', payment.tenantId)
        .single();
      
      if (tenant) {
        const newBalance = Number(tenant.outstanding_balance) - Number(payment.data.amount);
        const { error: updateError } = await supabase
          .from('tenants')
          .update({ outstanding_balance: Math.max(0, newBalance) })
          .eq('id', payment.tenantId);
        
        if (updateError) {
          console.error('Error updating tenant balance:', updateError);
          throw updateError;
        }
      }
      
      // Mark as synced
      await database.put('pendingPayments', {
        ...payment,
        synced: true,
      });
    }
    
    await updateSyncStatus();
    
    // Clean up synced items older than 7 days
    await cleanupSyncedData();
    
    return {
      success: true,
      syncedTenants: unsyncedTenants.length,
      syncedCollections: unsyncedCollections.length,
      syncedPayments: unsyncedPayments.length,
    };
  } catch (error) {
    console.error('Sync failed:', error);
    return {
      success: false,
      error,
    };
  }
};

const cleanupSyncedData = async () => {
  const database = await initOfflineDB();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  
  // Clean tenants
  const tenants = await database.getAll('pendingTenants');
  for (const tenant of tenants) {
    if (tenant.synced && tenant.timestamp < sevenDaysAgo) {
      await database.delete('pendingTenants', tenant.id);
    }
  }
  
  // Clean collections
  const collections = await database.getAll('pendingCollections');
  for (const collection of collections) {
    if (collection.synced && collection.timestamp < sevenDaysAgo) {
      await database.delete('pendingCollections', collection.id);
    }
  }
  
  // Clean payments
  const payments = await database.getAll('pendingPayments');
  for (const payment of payments) {
    if (payment.synced && payment.timestamp < sevenDaysAgo) {
      await database.delete('pendingPayments', payment.id);
    }
  }
};

export const getSyncStatus = async () => {
  const database = await initOfflineDB();
  const status = await database.get('syncStatus', 'main');
  return status || { lastSync: 0, pendingCount: 0 };
};

export const isOnline = () => {
  return navigator.onLine;
};
