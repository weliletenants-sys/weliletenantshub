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

interface UndoPaymentData {
  paymentId: string;
  previousStatus: string;
  previousVerifiedBy: string | null;
  previousVerifiedAt: string | null;
  previousRejectionReason: string | null;
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

      // Find the payment to get its previous status
      const payment = Array.isArray(previousPayments) 
        ? previousPayments.find((p: any) => p.id === data.paymentId)
        : null;

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

      return { 
        previousPayments, 
        previousStatus: payment?.status || 'pending',
        previousVerifiedBy: payment?.verified_by || null,
        previousVerifiedAt: payment?.verified_at || null,
        previousRejectionReason: payment?.rejection_reason || null
      };
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

      // Find the payment to get its previous status
      const payment = Array.isArray(previousPayments) 
        ? previousPayments.find((p: any) => p.id === data.paymentId)
        : null;

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

      return { 
        previousPayments,
        previousStatus: payment?.status || 'pending',
        previousVerifiedBy: payment?.verified_by || null,
        previousVerifiedAt: payment?.verified_at || null,
        previousRejectionReason: payment?.rejection_reason || null
      };
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

/**
 * Hook for undoing payment verification/rejection actions
 */
export const useUndoPaymentAction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UndoPaymentData) => {
      const updateData: any = {
        status: data.previousStatus,
        verified_by: data.previousVerifiedBy,
        verified_at: data.previousVerifiedAt,
        rejection_reason: data.previousRejectionReason,
      };

      const { error } = await supabase
        .from("collections")
        .update(updateData)
        .eq("id", data.paymentId);

      if (error) throw error;
      return { success: true };
    },

    onMutate: async (data) => {
      // Cancel all outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['all-payments'] });

      // Snapshot previous value
      const previousPayments = queryClient.getQueryData(['all-payments']);

      // Optimistically revert to previous status
      queryClient.setQueryData(['all-payments'], (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        
        return old.map((payment: any) =>
          payment.id === data.paymentId
            ? {
                ...payment,
                status: data.previousStatus,
                verified_by: data.previousVerifiedBy,
                verified_at: data.previousVerifiedAt,
                rejection_reason: data.previousRejectionReason
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
      toast.error('Failed to undo action', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: () => {
      haptics.success();
      toast.success("Action undone successfully");
    },

    onSettled: async () => {
      // Refetch in background to sync with server
      await queryClient.invalidateQueries({ queryKey: ['all-payments'] });
    }
  });
};
