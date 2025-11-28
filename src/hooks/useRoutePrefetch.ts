import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to prefetch likely next routes based on user role
 * Preloads critical route bundles in the background after authentication
 */
export const useRoutePrefetch = () => {
  useEffect(() => {
    const prefetchRoutes = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) return;

        const role = session.user.user_metadata?.role;

        // Small delay to avoid blocking initial render
        setTimeout(() => {
          if (role === 'agent') {
            // Prefetch high-priority agent routes
            import('../pages/agent/Dashboard');
            import('../pages/agent/Tenants');
            
            // Prefetch medium-priority agent routes after a short delay
            setTimeout(() => {
              import('../pages/agent/NewTenant');
              import('../pages/agent/Collections');
              import('../pages/agent/TenantDetail');
            }, 1000);
          } else if (role === 'manager') {
            // Prefetch high-priority manager routes
            import('../pages/manager/Dashboard');
            import('../pages/manager/Agents');
            
            // Prefetch medium-priority manager routes after a short delay
            setTimeout(() => {
              import('../pages/manager/Verifications');
              import('../pages/manager/PaymentVerifications');
              import('../pages/manager/AgentDetail');
            }, 1000);
          } else if (role === 'admin') {
            // Prefetch admin routes
            import('../pages/admin/Dashboard');
            
            setTimeout(() => {
              import('../pages/admin/RoleManagement');
              import('../pages/admin/ProfileRepair');
            }, 1000);
          }
        }, 500);
      } catch (error) {
        console.error('Route prefetch error:', error);
      }
    };

    prefetchRoutes();
  }, []);
};
