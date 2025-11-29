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
        .single();

      const role = profile?.role || null;

      // Get agent ID if user is an agent
      let agentId: string | undefined;
      if (role === "agent") {
        const { data: agent } = await supabase
          .from("agents")
          .select("id")
          .eq("user_id", user.id)
          .single();
        agentId = agent?.id;
      }

      return { user, role, agentId };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - don't refetch during this time
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });

  return {
    user: data?.user || null,
    role: data?.role || null,
    agentId: data?.agentId,
    isLoading,
  };
};
