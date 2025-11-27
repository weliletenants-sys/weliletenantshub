import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Tenant = Tables<'tenants'>;
type Collection = Tables<'collections'>;

/**
 * Hook to fetch tenant details with React Query caching
 * This allows prefetched data to be used instantly
 * Uses placeholderData to show stale data while fetching fresh data
 */
export const useTenantData = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: agent } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!agent) return null;

      const { data: tenant, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .eq('agent_id', agent.id)
        .maybeSingle();

      if (error) throw error;
      return tenant;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
    placeholderData: () => {
      // Try to get cached data to show instantly while fetching
      const cached = queryClient.getQueryData<Tenant>(['tenant', tenantId]);
      return cached || undefined;
    },
  });
};

/**
 * Hook to fetch collection history with React Query caching
 */
export const useCollectionsData = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['collections', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: agent } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!agent) return [];

      const { data: collections, error } = await supabase
        .from('collections')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('agent_id', agent.id)
        .order('collection_date', { ascending: false });

      if (error) throw error;
      return collections || [];
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: () => {
      // Show cached collections instantly
      const cached = queryClient.getQueryData<Collection[]>(['collections', tenantId]);
      return cached || [];
    },
  });
};

/**
 * Hook to fetch agent info with caching
 */
export const useAgentInfo = () => {
  return useQuery({
    queryKey: ['agentInfo'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone_number')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) return null;

      return {
        agent_name: profile.full_name || 'Agent',
        agent_phone: profile.phone_number || '',
      };
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};
