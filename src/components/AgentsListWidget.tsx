import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Wallet, TrendingUp, ChevronRight } from "lucide-react";
import { haptics } from "@/utils/haptics";

interface Agent {
  id: string;
  user_id: string;
  total_tenants: number;
  active_tenants: number;
  portfolio_value: number;
  collection_rate: number;
  monthly_earnings: number;
  wallet_balance: number;
  profiles: {
    full_name: string | null;
    phone_number: string;
  };
}

interface AgentsListProps {
  onPaymentClick: () => void;
}

export default function AgentsList({ onPaymentClick }: AgentsListProps) {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from("agents")
        .select(`
          id,
          user_id,
          total_tenants,
          active_tenants,
          portfolio_value,
          collection_rate,
          monthly_earnings,
          wallet_balance,
          profiles!agents_user_id_fkey(full_name, phone_number)
        `)
        .order("monthly_earnings", { ascending: false })
        .limit(5);

      if (error) throw error;
      setAgents(data || []);
    } catch (error) {
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "A";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return <div className="text-center py-4 text-muted-foreground">Loading agents...</div>;
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">No agents found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-all group cursor-pointer"
          onClick={() => {
            haptics.light();
            navigate(`/manager/agents/${agent.id}`);
          }}
        >
          {/* Avatar */}
          <Avatar className="h-12 w-12 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-bold">
              {getInitials(agent.profiles?.full_name)}
            </AvatarFallback>
          </Avatar>

          {/* Agent Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                {agent.profiles?.full_name || "Unknown Agent"}
              </h4>
              {agent.monthly_earnings >= 50000 && (
                <Badge variant="default" className="text-xs">
                  Top Earner
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>{agent.total_tenants || 0} tenants</span>
              </div>
              <div className="flex items-center gap-1 text-success font-medium">
                <TrendingUp className="h-3 w-3" />
                <span>UGX {(agent.monthly_earnings || 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Wallet className="h-3 w-3" />
                <span>UGX {(agent.wallet_balance || 0).toLocaleString()}</span>
              </div>
              <div className="text-muted-foreground text-right">
                Portfolio: UGX {(agent.portfolio_value || 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Action Icon */}
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
        </div>
      ))}

      {/* Quick Payment Button */}
      <Button
        variant="default"
        className="w-full bg-success hover:bg-success/90"
        onClick={(e) => {
          e.stopPropagation();
          onPaymentClick();
        }}
      >
        <Wallet className="h-4 w-4 mr-2" />
        Record Payment for Any Tenant
      </Button>
    </div>
  );
}
