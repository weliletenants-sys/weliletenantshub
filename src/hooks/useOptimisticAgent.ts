import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { haptics } from '@/utils/haptics';
import { useOptimisticStatusStore } from './useOptimisticStatus';

interface SuspendAgentData {
  agentId: string;
  userId: string;
  suspensionReason: string;
  managerId: string;
  managerName: string;
}

interface ReactivateAgentData {
  agentId: string;
  userId: string;
  managerId: string;
  managerName: string;
}

interface UpdateAgentData {
  agentId: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
  portfolioLimit: number;
}

interface DeleteAgentData {
  agentId: string;
  agentName: string;
  deletionReason: string;
  managerId: string;
  agentData: any;
}

/**
 * Hook for optimistic agent suspension with instant UI feedback
 */
export const useOptimisticAgentSuspension = () => {
  const queryClient = useQueryClient();
  const { addOperation, updateOperation } = useOptimisticStatusStore();

  return useMutation({
    mutationFn: async (data: SuspendAgentData) => {
      // Update agent suspension status
      const { error: agentError } = await supabase
        .from("agents")
        .update({
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspended_by: data.managerId,
          suspension_reason: data.suspensionReason
        })
        .eq("id", data.agentId);

      if (agentError) throw agentError;

      // Send notification to agent
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          sender_id: data.managerId,
          recipient_id: data.userId,
          title: "Account Suspended",
          message: `Your agent account has been suspended by ${data.managerName}.\n\nReason: ${data.suspensionReason}\n\nPlease contact your manager for more information.`,
          priority: "high"
        });

      if (notificationError) throw notificationError;

      // Log audit trail
      await supabase.from("audit_logs").insert({
        user_id: data.managerId,
        action: "UPDATE",
        table_name: "agents",
        record_id: data.agentId,
        old_data: { is_suspended: false },
        new_data: { 
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspended_by: data.managerId,
          suspension_reason: data.suspensionReason
        }
      });

      return { success: true };
    },

    onMutate: async (data) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['agents'] });

      // Snapshot previous data
      const previousAgents = queryClient.getQueryData(['agents']);

      // Optimistically update the agent list
      queryClient.setQueriesData({ queryKey: ['agents'] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((agent: any) =>
            agent.id === data.agentId
              ? {
                  ...agent,
                  is_suspended: true,
                  suspended_at: new Date().toISOString(),
                  suspended_by: data.managerId,
                  suspension_reason: data.suspensionReason
                }
              : agent
          );
        }
        return old;
      });

      // Instant haptic feedback
      haptics.light();

      return { previousAgents };
    },

    onError: (error, data, context) => {
      // Rollback on error
      if (context?.previousAgents) {
        queryClient.setQueryData(['agents'], context.previousAgents);
      }

      haptics.error?.();
      toast.error('Failed to suspend agent', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: () => {
      haptics.success();
      toast.success("Agent suspended and notified successfully");
    },

    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });
};

/**
 * Hook for optimistic agent reactivation with instant UI feedback
 */
export const useOptimisticAgentReactivation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ReactivateAgentData) => {
      // Update agent to clear suspension
      const { error: agentError } = await supabase
        .from("agents")
        .update({
          is_suspended: false,
          suspended_at: null,
          suspended_by: null,
          suspension_reason: null
        })
        .eq("id", data.agentId);

      if (agentError) throw agentError;

      // Send notification to agent
      const { error: notificationError } = await supabase
        .from("notifications")
        .insert({
          sender_id: data.managerId,
          recipient_id: data.userId,
          title: "Account Reactivated",
          message: `Your agent account has been reactivated by ${data.managerName}.\n\nYou can now log in and resume your activities.`,
          priority: "normal"
        });

      if (notificationError) throw notificationError;

      // Log audit trail
      await supabase.from("audit_logs").insert({
        user_id: data.managerId,
        action: "UPDATE",
        table_name: "agents",
        record_id: data.agentId,
        old_data: { is_suspended: true },
        new_data: { 
          is_suspended: false,
          suspended_at: null,
          suspended_by: null,
          suspension_reason: null
        }
      });

      return { success: true };
    },

    onMutate: async (data) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['agents'] });

      // Snapshot previous data
      const previousAgents = queryClient.getQueryData(['agents']);

      // Optimistically update the agent list
      queryClient.setQueriesData({ queryKey: ['agents'] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((agent: any) =>
            agent.id === data.agentId
              ? {
                  ...agent,
                  is_suspended: false,
                  suspended_at: null,
                  suspended_by: null,
                  suspension_reason: null
                }
              : agent
          );
        }
        return old;
      });

      // Instant haptic feedback
      haptics.light();

      return { previousAgents };
    },

    onError: (error, data, context) => {
      // Rollback on error
      if (context?.previousAgents) {
        queryClient.setQueryData(['agents'], context.previousAgents);
      }

      haptics.error?.();
      toast.error('Failed to reactivate agent', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: () => {
      haptics.success();
      toast.success("Agent reactivated and notified successfully");
    },

    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });
};

/**
 * Hook for optimistic agent update with instant UI feedback
 */
export const useOptimisticAgentUpdate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateAgentData) => {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: data.fullName,
          phone_number: data.phoneNumber
        })
        .eq("id", data.userId);

      if (profileError) throw profileError;

      // Update agent portfolio limit
      const { error: agentError } = await supabase
        .from("agents")
        .update({
          portfolio_limit: data.portfolioLimit
        })
        .eq("id", data.agentId);

      if (agentError) throw agentError;

      return { success: true };
    },

    onMutate: async (data) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['agents'] });

      // Snapshot previous data
      const previousAgents = queryClient.getQueryData(['agents']);

      // Optimistically update the agent list
      queryClient.setQueriesData({ queryKey: ['agents'] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.map((agent: any) =>
            agent.id === data.agentId
              ? {
                  ...agent,
                  portfolio_limit: data.portfolioLimit,
                  profiles: {
                    ...agent.profiles,
                    full_name: data.fullName,
                    phone_number: data.phoneNumber
                  }
                }
              : agent
          );
        }
        return old;
      });

      // Instant haptic feedback
      haptics.light();

      return { previousAgents };
    },

    onError: (error, data, context) => {
      // Rollback on error
      if (context?.previousAgents) {
        queryClient.setQueryData(['agents'], context.previousAgents);
      }

      haptics.error?.();
      toast.error('Failed to update agent', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: () => {
      haptics.success();
      toast.success("Agent updated successfully");
    },

    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });
};

/**
 * Hook for optimistic agent deletion with instant UI feedback
 */
export const useOptimisticAgentDeletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DeleteAgentData) => {
      // Log deletion in audit trail
      await supabase.from("audit_logs").insert({
        user_id: data.managerId,
        action: "DELETE",
        table_name: "agents",
        record_id: data.agentId,
        old_data: {
          ...data.agentData,
          deletion_reason: data.deletionReason
        },
        changed_fields: ["deleted"],
      });

      // Delete agent (cascade will handle related records)
      const { error } = await supabase
        .from("agents")
        .delete()
        .eq("id", data.agentId);

      if (error) throw error;

      return { success: true };
    },

    onMutate: async (data) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['agents'] });

      // Snapshot previous data
      const previousAgents = queryClient.getQueryData(['agents']);

      // Optimistically remove agent from list
      queryClient.setQueriesData({ queryKey: ['agents'] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.filter((agent: any) => agent.id !== data.agentId);
        }
        return old;
      });

      // Instant haptic feedback
      haptics.light();

      return { previousAgents };
    },

    onError: (error, data, context) => {
      // Rollback on error
      if (context?.previousAgents) {
        queryClient.setQueryData(['agents'], context.previousAgents);
      }

      haptics.error?.();
      toast.error('Failed to delete agent', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    },

    onSuccess: () => {
      haptics.success();
      toast.success("Agent deleted successfully");
    },

    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    }
  });
};
