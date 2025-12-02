import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { haptics } from '@/utils/haptics';
import type { Tables } from '@/integrations/supabase/types';
import { useOptimisticStatusStore } from './useOptimisticStatus';

type Tenant = Tables<'tenants'>;

interface DeleteTenantData {
  tenantId: string;
  tenantName: string;
  agentId: string;
  deletionReason: string;
  managerId?: string;
}

interface ArchiveTenantData {
  tenantId: string;
  tenantName: string;
  agentId: string;
  archiveReason?: string;
}

interface RestoreTenantData {
  tenantId: string;
  tenantName: string;
  agentId: string;
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

interface UpdateTenantData {
  tenantId: string;
  agentId: string;
  updates: {
    tenant_name?: string;
    tenant_phone?: string;
    landlord_name?: string | null;
    landlord_phone?: string | null;
    lc1_name?: string | null;
    lc1_phone?: string | null;
    rent_amount?: number;
    outstanding_balance?: number;
    registration_fee?: number;
    status?: string;
    start_date?: string | null;
    due_date?: string | null;
    daily_payment_amount?: number | null;
  };
}

/**
 * Hook for optimistic tenant deletion with instant UI feedback
 */
export const useOptimisticTenantDeletion = () => {
  const queryClient = useQueryClient();
  const { addOperation, updateOperation } = useOptimisticStatusStore();

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
      // Track operation
      const operationId = addOperation('delete-tenant', `Deleting ${data.tenantName}`);

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

      return { previousTenants, previousTenant, operationId };
    },

    onError: (error, data, context) => {
      // Update operation status
      if (context?.operationId) {
        updateOperation(context.operationId, 'error', error instanceof Error ? error.message : 'Failed to delete');
      }

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

    onSuccess: (result, data, context) => {
      // Update operation status
      if (context?.operationId) {
        updateOperation(context.operationId, 'success');
      }

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
 * Hook for optimistic tenant archive with instant UI feedback
 */
export const useOptimisticTenantArchive = () => {
  const queryClient = useQueryClient();
  const { addOperation, updateOperation } = useOptimisticStatusStore();

  return useMutation({
    mutationFn: async (data: ArchiveTenantData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Archive tenant instead of deleting
      const { error } = await supabase
        .from("tenants")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: user.id
        })
        .eq("id", data.tenantId);

      if (error) throw error;

      return { success: true };
    },

    onMutate: async (data) => {
      // Track operation
      const operationId = addOperation('archive-tenant', `Archiving ${data.tenantName}`);

      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['tenants', data.agentId] });
      await queryClient.cancelQueries({ queryKey: ['tenant', data.tenantId] });

      // Snapshot previous data
      const previousTenants = queryClient.getQueryData<Tenant[]>(['tenants', data.agentId]);
      const previousTenant = queryClient.getQueryData<Tenant>(['tenant', data.tenantId]);

      // Optimistically remove from active list (will be filtered out)
      queryClient.setQueryData<Tenant[]>(['tenants', data.agentId], (old = []) =>
        old.filter((tenant) => tenant.id !== data.tenantId)
      );

      // Update tenant to archived state
      queryClient.setQueryData<Tenant>(['tenant', data.tenantId], (old) =>
        old ? { ...old, is_archived: true, archived_at: new Date().toISOString() } : old
      );

      // Instant haptic feedback
      haptics.light();

      return { previousTenants, previousTenant, operationId };
    },

    onError: (error, data, context) => {
      // Update operation status
      if (context?.operationId) {
        updateOperation(context.operationId, 'error', error instanceof Error ? error.message : 'Failed to archive');
      }

      // Rollback on error
      if (context?.previousTenants) {
        queryClient.setQueryData(['tenants', data.agentId], context.previousTenants);
      }
      if (context?.previousTenant) {
        queryClient.setQueryData(['tenant', data.tenantId], context.previousTenant);
      }

      haptics.error?.();
      toast.error('Failed to archive tenant', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: (result, data, context) => {
      // Update operation status
      if (context?.operationId) {
        updateOperation(context.operationId, 'success');
      }

      haptics.success();
      toast.success("Tenant archived successfully", {
        description: "You can restore it anytime from the Archived tab"
      });
    },

    onSettled: (result, error, data) => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['tenants', data.agentId] });
      queryClient.invalidateQueries({ queryKey: ['archivedTenants', data.agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });
};

/**
 * Hook for optimistic tenant restore with instant UI feedback
 */
export const useOptimisticTenantRestore = () => {
  const queryClient = useQueryClient();
  const { addOperation, updateOperation } = useOptimisticStatusStore();

  return useMutation({
    mutationFn: async (data: RestoreTenantData) => {
      // Restore tenant
      const { error } = await supabase
        .from("tenants")
        .update({
          is_archived: false,
          archived_at: null,
          archived_by: null
        })
        .eq("id", data.tenantId);

      if (error) throw error;

      return { success: true };
    },

    onMutate: async (data) => {
      // Track operation
      const operationId = addOperation('restore-tenant', `Restoring ${data.tenantName}`);

      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['archivedTenants', data.agentId] });
      await queryClient.cancelQueries({ queryKey: ['tenants', data.agentId] });
      await queryClient.cancelQueries({ queryKey: ['tenant', data.tenantId] });

      // Snapshot previous data
      const previousArchivedTenants = queryClient.getQueryData<Tenant[]>(['archivedTenants', data.agentId]);
      const previousActiveTenants = queryClient.getQueryData<Tenant[]>(['tenants', data.agentId]);
      const previousTenant = queryClient.getQueryData<Tenant>(['tenant', data.tenantId]);

      // Optimistically remove from archived list
      queryClient.setQueryData<Tenant[]>(['archivedTenants', data.agentId], (old = []) =>
        old.filter((tenant) => tenant.id !== data.tenantId)
      );

      // Optimistically add to active list (if we have the tenant data)
      if (previousTenant) {
        const restoredTenant = { ...previousTenant, is_archived: false, archived_at: null, archived_by: null };
        queryClient.setQueryData<Tenant[]>(['tenants', data.agentId], (old = []) => [restoredTenant, ...old]);
      }

      // Update tenant detail
      queryClient.setQueryData<Tenant>(['tenant', data.tenantId], (old) =>
        old ? { ...old, is_archived: false, archived_at: null, archived_by: null } : old
      );

      // Instant haptic feedback
      haptics.light();

      return { previousArchivedTenants, previousActiveTenants, previousTenant, operationId };
    },

    onError: (error, data, context) => {
      // Update operation status
      if (context?.operationId) {
        updateOperation(context.operationId, 'error', error instanceof Error ? error.message : 'Failed to restore');
      }

      // Rollback on error
      if (context?.previousArchivedTenants) {
        queryClient.setQueryData(['archivedTenants', data.agentId], context.previousArchivedTenants);
      }
      if (context?.previousActiveTenants) {
        queryClient.setQueryData(['tenants', data.agentId], context.previousActiveTenants);
      }
      if (context?.previousTenant) {
        queryClient.setQueryData(['tenant', data.tenantId], context.previousTenant);
      }

      haptics.error?.();
      toast.error('Failed to restore tenant', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: (result, data, context) => {
      // Update operation status
      if (context?.operationId) {
        updateOperation(context.operationId, 'success');
      }

      haptics.success();
      toast.success("Tenant restored successfully");
    },

    onSettled: (result, error, data) => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['tenants', data.agentId] });
      queryClient.invalidateQueries({ queryKey: ['archivedTenants', data.agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });
};

/**
 * Hook for optimistic tenant transfer with instant UI feedback
 */
export const useOptimisticTenantTransfer = () => {
  const queryClient = useQueryClient();
  const { addOperation, updateOperation } = useOptimisticStatusStore();

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
      // Track operation
      const operationId = addOperation('transfer-tenant', `Transferring ${data.tenantName} to ${data.newAgentName}`);

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

      return { previousCurrentAgentTenants, previousNewAgentTenants, previousTenant, operationId };
    },

    onError: (error, data, context) => {
      // Update operation status
      if (context?.operationId) {
        updateOperation(context.operationId, 'error', error instanceof Error ? error.message : 'Failed to transfer');
      }

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

    onSuccess: (result, data, context) => {
      // Update operation status
      if (context?.operationId) {
        updateOperation(context.operationId, 'success');
      }

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

/**
 * Hook for optimistic tenant update with instant UI feedback
 */
export const useOptimisticTenantUpdate = () => {
  const queryClient = useQueryClient();
  const { addOperation, updateOperation } = useOptimisticStatusStore();

  return useMutation({
    mutationFn: async (data: UpdateTenantData) => {
      const { error } = await supabase
        .from("tenants")
        .update(data.updates)
        .eq("id", data.tenantId);

      if (error) throw error;

      return { success: true };
    },

    onMutate: async (data) => {
      // Track operation
      const tenantName = data.updates.tenant_name || 'tenant';
      const operationId = addOperation('update-tenant', `Updating ${tenantName}`);

      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['tenant', data.tenantId] });
      await queryClient.cancelQueries({ queryKey: ['tenants', data.agentId] });

      // Snapshot previous data
      const previousTenant = queryClient.getQueryData<Tenant>(['tenant', data.tenantId]);
      const previousTenants = queryClient.getQueryData<Tenant[]>(['tenants', data.agentId]);

      // Optimistically update tenant detail
      queryClient.setQueryData<Tenant>(['tenant', data.tenantId], (old) =>
        old ? { ...old, ...data.updates } : old
      );

      // Optimistically update in tenants list
      queryClient.setQueryData<Tenant[]>(['tenants', data.agentId], (old = []) =>
        old.map((tenant) =>
          tenant.id === data.tenantId ? { ...tenant, ...data.updates } : tenant
        )
      );

      // Instant haptic feedback
      haptics.light();

      return { previousTenant, previousTenants, operationId };
    },

    onError: (error, data, context) => {
      // Update operation status
      if (context?.operationId) {
        updateOperation(context.operationId, 'error', error instanceof Error ? error.message : 'Failed to update');
      }

      // Rollback on error
      if (context?.previousTenant) {
        queryClient.setQueryData(['tenant', data.tenantId], context.previousTenant);
      }
      if (context?.previousTenants) {
        queryClient.setQueryData(['tenants', data.agentId], context.previousTenants);
      }

      haptics.error?.();
      toast.error('Failed to update tenant', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: (result, data, context) => {
      // Update operation status
      if (context?.operationId) {
        updateOperation(context.operationId, 'success');
      }

      haptics.success();
      toast.success("Tenant updated successfully");
    },

    onSettled: (result, error, data) => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['tenant', data.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenants', data.agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });
};
