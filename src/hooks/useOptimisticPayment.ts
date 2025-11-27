import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addPendingPayment, isOnline } from '@/lib/offlineSync';
import { haptics } from '@/utils/haptics';
import type { Tables } from '@/integrations/supabase/types';

type Tenant = Tables<'tenants'>;
type Collection = Tables<'collections'>;

interface RecordPaymentData {
  tenantId: string;
  amount: number;
  paymentMethod: string;
  collectionDate: string;
  agentId: string;
  commission: number;
}

/**
 * Hook for optimistic payment recording
 * Updates UI instantly before server confirmation
 */
export const useOptimisticPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RecordPaymentData) => {
      if (!isOnline()) {
        // Offline: queue for later sync
        await addPendingPayment(
          {
            agent_id: data.agentId,
            tenant_id: data.tenantId,
            amount: data.amount,
            commission: data.commission,
            payment_method: data.paymentMethod,
            collection_date: data.collectionDate,
            status: 'pending',
          },
          data.tenantId
        );
        return { offline: true };
      }

      // Online: submit to server
      const collectionData = {
        agent_id: data.agentId,
        tenant_id: data.tenantId,
        amount: data.amount,
        commission: data.commission,
        payment_method: data.paymentMethod,
        collection_date: data.collectionDate,
        status: 'completed',
      };

      const { data: collection, error: collectionError } = await supabase
        .from('collections')
        .insert(collectionData)
        .select()
        .single();

      if (collectionError) throw collectionError;

      // Update tenant balance
      const tenant = queryClient.getQueryData<Tenant>(['tenant', data.tenantId]);
      if (tenant) {
        const newBalance = parseFloat(tenant.outstanding_balance?.toString() || '0') - data.amount;
        const { error: updateError } = await supabase
          .from('tenants')
          .update({ outstanding_balance: Math.max(0, newBalance) })
          .eq('id', data.tenantId);

        if (updateError) throw updateError;
      }

      return { collection, offline: false };
    },

    // Optimistic update: Update UI immediately before server responds
    onMutate: async (data) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['tenant', data.tenantId] });
      await queryClient.cancelQueries({ queryKey: ['collections', data.tenantId] });

      // Snapshot the previous values
      const previousTenant = queryClient.getQueryData<Tenant>(['tenant', data.tenantId]);
      const previousCollections = queryClient.getQueryData<Collection[]>(['collections', data.tenantId]);

      // Optimistically update tenant balance
      if (previousTenant) {
        const newBalance = parseFloat(previousTenant.outstanding_balance?.toString() || '0') - data.amount;
        queryClient.setQueryData<Tenant>(['tenant', data.tenantId], {
          ...previousTenant,
          outstanding_balance: Math.max(0, newBalance),
        });
      }

      // Optimistically add the collection
      const optimisticCollection: Collection = {
        id: `optimistic-${Date.now()}`,
        agent_id: data.agentId,
        tenant_id: data.tenantId,
        amount: data.amount,
        commission: data.commission,
        payment_method: data.paymentMethod,
        collection_date: data.collectionDate,
        status: 'pending',
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Collection[]>(['collections', data.tenantId], (old = []) => [
        optimisticCollection,
        ...old,
      ]);

      // Haptic feedback for instant response
      haptics.light();

      // Return context with previous values for rollback
      return { previousTenant, previousCollections };
    },

    // On error: rollback to previous values
    onError: (error, data, context) => {
      // Rollback tenant
      if (context?.previousTenant) {
        queryClient.setQueryData(['tenant', data.tenantId], context.previousTenant);
      }

      // Rollback collections
      if (context?.previousCollections) {
        queryClient.setQueryData(['collections', data.tenantId], context.previousCollections);
      }

      // Show error feedback
      haptics.error?.();
      toast.error('Payment failed. Changes have been reverted.', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    },

    // On success: update with real data from server
    onSuccess: (result, data) => {
      if (result.offline) {
        toast.success('Payment saved offline!', {
          description: 'Will sync when back online',
          duration: 5000,
        });
      } else {
        haptics.success();
        toast.success(`Payment recorded! You earned UGX ${data.commission.toLocaleString()} commission`);
      }
    },

    // Always refetch to ensure data is in sync with server
    onSettled: (result, error, data) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', data.tenantId] });
      queryClient.invalidateQueries({ queryKey: ['collections', data.tenantId] });
    },
  });
};

/**
 * Hook for optimistic tenant updates
 */
export const useOptimisticTenantUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenantId, updates }: { tenantId: string; updates: Partial<Tenant> }) => {
      const { error } = await supabase
        .from('tenants')
        .update(updates)
        .eq('id', tenantId);

      if (error) throw error;
      return { tenantId, updates };
    },

    onMutate: async ({ tenantId, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['tenant', tenantId] });

      const previousTenant = queryClient.getQueryData<Tenant>(['tenant', tenantId]);

      // Optimistically update
      if (previousTenant) {
        queryClient.setQueryData<Tenant>(['tenant', tenantId], {
          ...previousTenant,
          ...updates,
        });
      }

      haptics.light();

      return { previousTenant };
    },

    onError: (error, { tenantId }, context) => {
      if (context?.previousTenant) {
        queryClient.setQueryData(['tenant', tenantId], context.previousTenant);
      }

      haptics.error?.();
      toast.error('Update failed. Changes have been reverted.');
    },

    onSuccess: () => {
      haptics.success();
      toast.success('Tenant updated successfully');
    },

    onSettled: (result, error, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
    },
  });
};
