import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to prefetch tenant details for instant navigation
 * Uses Intersection Observer to prefetch only visible tenants
 */
export const useTenantPrefetch = (tenantId: string, enabled: boolean = true) => {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);

  useEffect(() => {
    if (!enabled || prefetchedRef.current) return;

    const prefetchTenantData = async () => {
      try {
        // Prefetch tenant details
        await queryClient.prefetchQuery({
          queryKey: ['tenant', tenantId],
          queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data: agent } = await supabase
              .from('agents')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();

            if (!agent) return null;

            const { data: tenant } = await supabase
              .from('tenants')
              .select('*')
              .eq('id', tenantId)
              .eq('agent_id', agent.id)
              .maybeSingle();

            return tenant;
          },
          staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
        });

        // Prefetch collections for this tenant
        await queryClient.prefetchQuery({
          queryKey: ['collections', tenantId],
          queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data: agent } = await supabase
              .from('agents')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();

            if (!agent) return [];

            const { data: collections } = await supabase
              .from('collections')
              .select('*')
              .eq('tenant_id', tenantId)
              .eq('agent_id', agent.id)
              .order('collection_date', { ascending: false });

            return collections || [];
          },
          staleTime: 5 * 60 * 1000,
        });

        prefetchedRef.current = true;
        console.log(`Prefetched data for tenant ${tenantId}`);
      } catch (error) {
        console.error('Prefetch error:', error);
      }
    };

    // Small delay to avoid blocking main thread
    const timeoutId = setTimeout(prefetchTenantData, 100);

    return () => clearTimeout(timeoutId);
  }, [tenantId, enabled, queryClient]);
};

/**
 * Hook to prefetch multiple tenants using Intersection Observer
 * Prefetches tenant data as rows become visible in viewport
 */
export const useTenantListPrefetch = (tenants: Array<{ id: string }>) => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const prefetchedIds = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();

  useEffect(() => {
    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const tenantId = entry.target.getAttribute('data-tenant-id');
            
            if (tenantId && !prefetchedIds.current.has(tenantId)) {
              prefetchedIds.current.add(tenantId);
              
              // Prefetch tenant data
              queryClient.prefetchQuery({
                queryKey: ['tenant', tenantId],
                queryFn: async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return null;

                  const { data: agent } = await supabase
                    .from('agents')
                    .select('id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                  if (!agent) return null;

                  const { data: tenant } = await supabase
                    .from('tenants')
                    .select('*')
                    .eq('id', tenantId)
                    .eq('agent_id', agent.id)
                    .maybeSingle();

                  return tenant;
                },
                staleTime: 5 * 60 * 1000,
              });

              // Prefetch collections
              queryClient.prefetchQuery({
                queryKey: ['collections', tenantId],
                queryFn: async () => {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return [];

                  const { data: agent } = await supabase
                    .from('agents')
                    .select('id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                  if (!agent) return [];

                  const { data: collections } = await supabase
                    .from('collections')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .eq('agent_id', agent.id)
                    .order('collection_date', { ascending: false });

                  return collections || [];
                },
                staleTime: 5 * 60 * 1000,
              });

              console.log(`Background prefetch: tenant ${tenantId}`);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '100px', // Start prefetching 100px before element enters viewport
        threshold: 0.1,
      }
    );

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [queryClient]);

  const observeTenantRow = (element: HTMLElement | null) => {
    if (element && observerRef.current) {
      observerRef.current.observe(element);
    }
  };

  return { observeTenantRow };
};
