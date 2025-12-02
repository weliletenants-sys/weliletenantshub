import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { RealtimeChannel } from "@supabase/supabase-js";
import { haptics } from "@/utils/haptics";

export const useRealtimePasswordRequests = (userId: string | undefined, isManager: boolean) => {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !isManager) return;

    const channel = supabase
      .channel('password-change-requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'password_change_requests'
        },
        async (payload) => {
          console.log('New password change request:', payload);
          
          if (!isMountedRef.current) return;

          // Fetch agent details for the notification
          const { data: agent } = await supabase
            .from('agents')
            .select('user_id')
            .eq('id', payload.new.agent_id)
            .single();

          if (!isMountedRef.current || !agent) return;

          // Fetch profile details
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone_number')
            .eq('id', agent.user_id)
            .single();

          if (!isMountedRef.current) return;

          const agentName = profile?.full_name || 'An agent';
          
          // Show toast notification with haptic feedback
          haptics.success();
          toast.info(
            `${agentName} requested a password change`,
            {
              description: 'Tap to review pending requests',
              action: {
                label: 'Review',
                onClick: () => {
                  window.location.href = '/manager/password-requests';
                }
              },
              duration: 6000,
            }
          );

          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['password-change-requests'] });
          queryClient.invalidateQueries({ queryKey: ['pending-password-requests-count'] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe().then(() => {
          if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        });
      }
    };
  }, [userId, isManager, queryClient]);
};
