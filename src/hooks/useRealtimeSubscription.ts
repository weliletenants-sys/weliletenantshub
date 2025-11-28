import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Tables } from '@/integrations/supabase/types';

type Tenant = Tables<'tenants'>;
type Collection = Tables<'collections'>;
type Agent = Tables<'agents'>;
type Profile = Tables<'profiles'>;

// Global sync state management
let syncCallbacks: Set<(table: string) => void> = new Set();

export const registerSyncCallback = (callback: (table: string) => void) => {
  syncCallbacks.add(callback);
  return () => syncCallbacks.delete(callback);
};

const notifySyncEvent = (table: string) => {
  syncCallbacks.forEach(callback => callback(table));
};

/**
 * Real-time subscription hook for tenants
 * Automatically updates React Query cache when tenants change
 */
export const useRealtimeTenants = (agentId: string | null | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel('tenants-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants',
          filter: `agent_id=eq.${agentId}`,
        },
        (payload: RealtimePostgresChangesPayload<Tenant>) => {
          console.log('Realtime tenant change:', payload);

          // Notify sync indicators
          notifySyncEvent('tenants');

          // Invalidate tenant list queries
          queryClient.invalidateQueries({ queryKey: ['tenants', agentId] });

          // If it's an update or insert, also invalidate the specific tenant
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const tenant = payload.new as Tenant;
            queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] });
          }

          // If it's a delete, remove from cache
          if (payload.eventType === 'DELETE') {
            const tenant = payload.old as Tenant;
            queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime subscription error for tenants');
        }
      });

    return () => {
      supabase.removeChannel(channel).catch((error) => {
        console.error('Error removing tenants channel:', error);
      });
    };
  }, [agentId, queryClient]);
};

/**
 * Real-time subscription hook for collections (payments)
 * Automatically updates React Query cache when payments change
 */
export const useRealtimeCollections = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel('collections-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collections',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: RealtimePostgresChangesPayload<Collection>) => {
          console.log('Realtime collection change:', payload);

          // Notify sync indicators
          notifySyncEvent('collections');

          // Invalidate collections query
          queryClient.invalidateQueries({ queryKey: ['collections', tenantId] });

          // Also invalidate tenant data since balance may have changed
          queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime subscription error for collections');
        }
      });

    return () => {
      supabase.removeChannel(channel).catch((error) => {
        console.error('Error removing collections channel:', error);
      });
    };
  }, [tenantId, queryClient]);
};

/**
 * Real-time subscription hook for all tenants (manager view)
 * Listens to all tenant changes across all agents
 */
export const useRealtimeAllTenants = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('all-tenants-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants',
        },
        (payload: RealtimePostgresChangesPayload<Tenant>) => {
          console.log('Realtime tenant change (manager):', payload);

          // Notify sync indicators
          notifySyncEvent('tenants');

          // Invalidate all tenant-related queries
          queryClient.invalidateQueries({ queryKey: ['tenants'] });
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const tenant = payload.new as Tenant;
            queryClient.invalidateQueries({ queryKey: ['tenant', tenant.id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

/**
 * Real-time subscription hook for all collections (manager view)
 * Listens to all payment changes across all agents
 */
export const useRealtimeAllCollections = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('all-collections-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collections',
        },
        (payload: RealtimePostgresChangesPayload<Collection>) => {
          console.log('Realtime collection change (manager):', payload);

          // Notify sync indicators
          notifySyncEvent('collections');

          // Invalidate collections queries
          queryClient.invalidateQueries({ queryKey: ['collections'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

/**
 * Real-time subscription hook for agents
 * Listens to agent profile updates (portfolio, earnings, etc.)
 */
export const useRealtimeAgents = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('agents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agents',
        },
        (payload: RealtimePostgresChangesPayload<Agent>) => {
          console.log('Realtime agent change:', payload);

          // Notify sync indicators
          notifySyncEvent('agents');

          // Invalidate agent queries
          queryClient.invalidateQueries({ queryKey: ['agents'] });
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const agent = payload.new as Agent;
            queryClient.invalidateQueries({ queryKey: ['agent', agent.id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

/**
 * Real-time subscription hook for profiles
 * Listens to profile updates (name, phone, etc.)
 */
export const useRealtimeProfiles = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        (payload: RealtimePostgresChangesPayload<Profile>) => {
          console.log('Realtime profile change:', payload);

          // Notify sync indicators
          notifySyncEvent('profiles');

          // Invalidate profile queries and agent queries (since agents join profiles)
          queryClient.invalidateQueries({ queryKey: ['profiles'] });
          queryClient.invalidateQueries({ queryKey: ['agents'] });
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const profile = payload.new as Profile;
            queryClient.invalidateQueries({ queryKey: ['profile', profile.id] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
