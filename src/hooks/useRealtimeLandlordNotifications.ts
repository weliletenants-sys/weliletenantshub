import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { haptics } from "@/utils/haptics";
import { useNavigate } from "react-router-dom";

export const useRealtimeLandlordNotifications = (enabled: boolean = true) => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;

    console.log("[Realtime] Setting up landlord notifications subscription");

    const channel = supabase
      .channel('landlord-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'landlords'
        },
        async (payload) => {
          console.log("[Realtime] New landlord registered:", payload);
          
          const landlord = payload.new as any;
          
          // Only notify about unverified landlords
          if (landlord.is_verified === false) {
            // Fetch agent details
            const { data: agentData } = await supabase
              .from('agents')
              .select(`
                profiles!agents_user_id_fkey (
                  full_name
                )
              `)
              .eq('id', landlord.registered_by)
              .single();

            const agentName = agentData?.profiles?.full_name || 'Unknown Agent';
            
            haptics.medium();
            
            toast.success(
              `🏢 New Landlord Registration`,
              {
                description: `${landlord.landlord_name} registered by ${agentName} - Needs verification`,
                duration: 8000,
                action: {
                  label: "Review",
                  onClick: () => navigate('/manager/landlords/unverified')
                }
              }
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'landlords'
        },
        (payload) => {
          const oldLandlord = payload.old as any;
          const newLandlord = payload.new as any;
          
          // Notify when landlord is verified
          if (oldLandlord.is_verified === false && newLandlord.is_verified === true) {
            console.log("[Realtime] Landlord verified:", newLandlord);
            haptics.success();
            
            toast.success(
              `✅ Landlord Verified`,
              {
                description: `${newLandlord.landlord_name} has been verified`,
                duration: 4000,
              }
            );
          }
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] Landlord notifications subscription status:", status);
      });

    return () => {
      console.log("[Realtime] Cleaning up landlord notifications subscription");
      channel.unsubscribe().then(() => {
        supabase.removeChannel(channel);
      });
    };
  }, [enabled, navigate]);
};
