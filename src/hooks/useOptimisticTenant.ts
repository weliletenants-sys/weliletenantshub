import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { haptics } from '@/utils/haptics';
import type { Tables } from '@/integrations/supabase/types';

type Tenant = Tables<'tenants'>;

interface DeleteTenantData {
  tenantId: string;
  tenantName: string;
  agentId: string;
  deletionReason: string;
  managerId?: string;
}

/**
 * Hook for optimistic tenant deletion with instant UI feedback
 */
export const useOptimisticTenantDeletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DeleteTenantData) => {
      // Log audit trail if manager is deleting
      if (data.managerId) {
        await supabase.from("audit_logs").insert({
          user_id: data.managerId,
          action: "DELETE",
          table_name: "tenants",
          record_id: data.tenantId,
          old_data: { tenant_name: data.tenantName },
          new_data: { deletion_reason: data.deletionReason }
        });
      }

      // Delete associated collections first
      const { error: collectionsError } = await supabase
        .from("collections")
        .delete()
        .eq("tenant_id", data.tenantId);

      if (collectionsError) throw collectionsError;

      // Delete tenant
      const { error: tenantError } = await supabase
        .from("tenants")
        .delete()
        .eq("id", data.tenantId);

      if (tenantError) throw tenantError;

      return { success: true };
    },

    onMutate: async (data) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['tenants', data.agentId] });
      await queryClient.cancelQueries({ queryKey: ['tenant', data.tenantId] });
      await queryClient.cancelQueries({ queryKey: ['collections', data.tenantId] });

      // Snapshot previous data
      const previousTenants = queryClient.getQueryData<Tenant[]>(['tenants', data.agentId]);
      const previousTenant = queryClient.getQueryData<Tenant>(['tenant', data.tenantId]);

      // Optimistically remove tenant from list
      queryClient.setQueryData<Tenant[]>(['tenants', data.agentId], (old = []) =>
        old.filter((tenant) => tenant.id !== data.tenantId)
      );

      // Clear tenant detail
      queryClient.removeQueries({ queryKey: ['tenant', data.tenantId] });
      queryClient.removeQueries({ queryKey: ['collections', data.tenantId] });

      // Instant haptic feedback
      haptics.light();

      return { previousTenants, previousTenant };
    },

    onError: (error, data, context) => {
      // Rollback on error
      if (context?.previousTenants) {
        queryClient.setQueryData(['tenants', data.agentId], context.previousTenants);
      }
      if (context?.previousTenant) {
        queryClient.setQueryData(['tenant', data.tenantId], context.previousTenant);
      }

      haptics.error?.();
      toast.error('Failed to delete tenant', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: () => {
      haptics.success();
      toast.success("Tenant deleted successfully");
    },

    onSettled: (result, error, data) => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['tenants', data.agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });
};
