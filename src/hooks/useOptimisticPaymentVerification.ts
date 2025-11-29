import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { haptics } from '@/utils/haptics';

interface VerifyPaymentData {
  paymentId: string;
  managerId: string;
}

interface RejectPaymentData {
  paymentId: string;
  managerId: string;
  reason: string;
}

/**
 * Hook for optimistic payment verification with instant UI feedback
 */
export const useOptimisticPaymentVerification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: VerifyPaymentData) => {
      const { error } = await supabase
        .from("collections")
        .update({
          status: "verified",
          verified_by: data.managerId,
          verified_at: new Date().toISOString(),
        })
        .eq("id", data.paymentId);

      if (error) throw error;
      return { success: true };
    },

    onMutate: async (data) => {
      // Cancel all outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['all-payments'] });

      // Snapshot previous value
      const previousPayments = queryClient.getQueryData(['all-payments']);

      // Optimistically update to verified status immediately
      queryClient.setQueryData(['all-payments'], (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        
        return old.map((payment: any) =>
          payment.id === data.paymentId
            ? {
                ...payment,
                status: 'verified',
                verified_by: data.managerId,
                verified_at: new Date().toISOString()
              }
            : payment
        );
      });

      // Instant haptic feedback
      haptics.light();

      return { previousPayments };
    },

    onError: (error, data, context) => {
      // Rollback on error
      if (context?.previousPayments) {
        queryClient.setQueryData(['all-payments'], context.previousPayments);
      }

      haptics.error?.();
      toast.error('Failed to verify payment', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: () => {
      haptics.success();
      toast.success("Payment verified successfully!");
    },

    onSettled: async () => {
      // Refetch in background to sync with server
      await queryClient.invalidateQueries({ queryKey: ['all-payments'] });
    }
  });
};

/**
 * Hook for optimistic payment rejection with instant UI feedback
 */
export const useOptimisticPaymentRejection = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RejectPaymentData) => {
      const { error } = await supabase
        .from("collections")
        .update({
          status: "rejected",
          verified_by: data.managerId,
          verified_at: new Date().toISOString(),
          rejection_reason: data.reason,
        })
        .eq("id", data.paymentId);

      if (error) throw error;
      return { success: true };
    },

    onMutate: async (data) => {
      // Cancel all outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['all-payments'] });

      // Snapshot previous value
      const previousPayments = queryClient.getQueryData(['all-payments']);

      // Optimistically update to rejected status immediately
      queryClient.setQueryData(['all-payments'], (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        
        return old.map((payment: any) =>
          payment.id === data.paymentId
            ? {
                ...payment,
                status: 'rejected',
                verified_by: data.managerId,
                verified_at: new Date().toISOString(),
                rejection_reason: data.reason
              }
            : payment
        );
      });

      // Instant haptic feedback
      haptics.light();

      return { previousPayments };
    },

    onError: (error, data, context) => {
      // Rollback on error
      if (context?.previousPayments) {
        queryClient.setQueryData(['all-payments'], context.previousPayments);
      }

      haptics.error?.();
      toast.error('Failed to reject payment', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: () => {
      haptics.success();
      toast.success("Payment rejected");
    },

    onSettled: async () => {
      // Refetch in background to sync with server
      await queryClient.invalidateQueries({ queryKey: ['all-payments'] });
    }
  });
};
