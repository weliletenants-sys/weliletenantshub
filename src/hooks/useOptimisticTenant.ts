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

interface TransferTenantData {
  tenantId: string;
  tenantName: string;
  currentAgentId: string;
  newAgentId: string;
  newAgentName: string;
  oldAgentName: string;
  managerId: string;
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

/**
 * Hook for optimistic tenant transfer with instant UI feedback
 */
export const useOptimisticTenantTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: TransferTenantData) => {
      // Fetch agent profiles for audit log
      const { data: newAgent } = await supabase
        .from("agents")
        .select("id")
        .eq("id", data.newAgentId)
        .single();

      if (!newAgent) throw new Error("New agent not found");

      // Update tenant's agent_id
      const { error: updateError } = await supabase
        .from("tenants")
        .update({ agent_id: data.newAgentId })
        .eq("id", data.tenantId);

      if (updateError) throw updateError;

      // Create audit log entry
      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert({
          user_id: data.managerId,
          action: "TRANSFER",
          table_name: "tenants",
          record_id: data.tenantId,
          old_data: {
            agent_id: data.currentAgentId,
            agent_name: data.oldAgentName,
          },
          new_data: {
            agent_id: data.newAgentId,
            agent_name: data.newAgentName,
          },
          changed_fields: ["agent_id"],
        });

      if (auditError) {
        console.error("Error creating audit log:", auditError);
      }

      return { success: true };
    },

    onMutate: async (data) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['tenants', data.currentAgentId] });
      await queryClient.cancelQueries({ queryKey: ['tenants', data.newAgentId] });
      await queryClient.cancelQueries({ queryKey: ['tenant', data.tenantId] });

      // Snapshot previous data
      const previousCurrentAgentTenants = queryClient.getQueryData<Tenant[]>(['tenants', data.currentAgentId]);
      const previousNewAgentTenants = queryClient.getQueryData<Tenant[]>(['tenants', data.newAgentId]);
      const previousTenant = queryClient.getQueryData<Tenant>(['tenant', data.tenantId]);

      // Optimistically remove from current agent's list
      queryClient.setQueryData<Tenant[]>(['tenants', data.currentAgentId], (old = []) =>
        old.filter((tenant) => tenant.id !== data.tenantId)
      );

      // Optimistically add to new agent's list (if cached)
      if (previousTenant) {
        queryClient.setQueryData<Tenant[]>(['tenants', data.newAgentId], (old = []) => [
          { ...previousTenant, agent_id: data.newAgentId },
          ...old
        ]);
      }

      // Update tenant detail
      queryClient.setQueryData<Tenant>(['tenant', data.tenantId], (old) => 
        old ? { ...old, agent_id: data.newAgentId } : old
      );

      // Instant haptic feedback
      haptics.light();

      return { previousCurrentAgentTenants, previousNewAgentTenants, previousTenant };
    },

    onError: (error, data, context) => {
      // Rollback on error
      if (context?.previousCurrentAgentTenants) {
        queryClient.setQueryData(['tenants', data.currentAgentId], context.previousCurrentAgentTenants);
      }
      if (context?.previousNewAgentTenants) {
        queryClient.setQueryData(['tenants', data.newAgentId], context.previousNewAgentTenants);
      }
      if (context?.previousTenant) {
        queryClient.setQueryData(['tenant', data.tenantId], context.previousTenant);
      }

      haptics.error?.();
      toast.error('Failed to transfer tenant', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: (result, data) => {
      haptics.success();
      toast.success(`Tenant transferred to ${data.newAgentName} successfully`);
    },

    onSettled: (result, error, data) => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['tenants', data.currentAgentId] });
      queryClient.invalidateQueries({ queryKey: ['tenants', data.newAgentId] });
      queryClient.invalidateQueries({ queryKey: ['tenant', data.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });
};
