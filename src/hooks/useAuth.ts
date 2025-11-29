import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthData {
  user: User | null;
  role: "agent" | "manager" | "admin" | null;
  agentId?: string;
  isLoading: boolean;
}

/**
 * Centralized auth hook that fetches user and role data with aggressive caching
 * to prevent duplicate API calls on page load
 */
export const useAuth = (): AuthData => {
  const { data, isLoading } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return { user: null, role: null, agentId: undefined };
      }

      // Get role from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const role = profile?.role || null;

      // Get agent ID if user is an agent
      let agentId: string | undefined;
      let isSuspended = false;
      if (role === "agent") {
        const { data: agent } = await supabase
          .from("agents")
          .select("id, is_suspended")
          .eq("user_id", user.id)
          .maybeSingle();
        agentId = agent?.id;
        isSuspended = agent?.is_suspended || false;

        // If agent is suspended, log them out
        if (isSuspended) {
          await supabase.auth.signOut();
          throw new Error("Your account has been suspended. Please contact your manager.");
        }
      }

      return { user, role, agentId };
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - increased for better performance
    gcTime: 15 * 60 * 1000, // 15 minutes - keep in cache longer
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false, // Don't refetch on reconnect
  });

  return {
    user: data?.user || null,
    role: data?.role || null,
    agentId: data?.agentId,
    isLoading,
  };
};
