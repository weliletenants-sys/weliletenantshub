import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, ArrowDownToLine, Clock, TrendingUp, TrendingDown, User } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: "sent" | "received" | "withdrawal";
  amount: number;
  counterparty?: string;
  counterpartyPhone?: string;
  timestamp: string;
  status: string;
}

interface WalletTransactionTimelineProps {
  agentId: string;
  limit?: number;
  compact?: boolean;
}

export function WalletTransactionTimeline({ 
  agentId, 
  limit = 5,
  compact = false 
}: WalletTransactionTimelineProps) {
  const [realtimeUpdate, setRealtimeUpdate] = useState(0);

  // Fetch transfers (sent and received)
  const { data: transfers } = useQuery({
    queryKey: ["wallet-transactions", agentId, realtimeUpdate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_transfers")
        .select(`
          *,
          from_agent:agents!agent_transfers_from_agent_id_fkey(
            id,
            user:profiles!agents_user_id_fkey(full_name, phone_number)
          ),
          to_agent:agents!agent_transfers_to_agent_id_fkey(
            id,
            user:profiles!agents_user_id_fkey(full_name, phone_number)
          )
        `)
        .or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId}`)
        .order("transferred_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });

  // Fetch withdrawals
  const { data: withdrawals } = useQuery({
    queryKey: ["wallet-withdrawals", agentId, realtimeUpdate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("agent_id", agentId)
        .in("status", ["approved", "pending"])
        .order("requested_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });

  // Set up realtime subscriptions
  useEffect(() => {
    if (!agentId) return;

    const channel = supabase
      .channel("wallet-transactions")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_transfers",
          filter: `from_agent_id=eq.${agentId}`,
        },
        () => setRealtimeUpdate(prev => prev + 1)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_transfers",
          filter: `to_agent_id=eq.${agentId}`,
        },
        () => setRealtimeUpdate(prev => prev + 1)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "withdrawal_requests",
          filter: `agent_id=eq.${agentId}`,
        },
        () => setRealtimeUpdate(prev => prev + 1)
      )
      .subscribe();

    return () => {
      channel.unsubscribe().then(() => {
        supabase.removeChannel(channel);
      });
    };
  }, [agentId]);

  // Combine and sort transactions
  const transactions: Transaction[] = [
    ...(transfers || []).map(t => ({
      id: t.id,
      type: (t.from_agent_id === agentId ? "sent" : "received") as "sent" | "received",
      amount: Number(t.amount),
      counterparty: t.from_agent_id === agentId 
        ? t.to_agent.user.full_name 
        : t.from_agent.user.full_name,
      counterpartyPhone: t.from_agent_id === agentId 
        ? t.to_agent.user.phone_number 
        : t.from_agent.user.phone_number,
      timestamp: t.transferred_at,
      status: t.status,
    })),
    ...(withdrawals || []).map(w => ({
      id: w.id,
      type: "withdrawal" as const,
      amount: Number(w.amount),
      timestamp: w.requested_at,
      status: w.status,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "sent":
        return <Send className="h-4 w-4" />;
      case "received":
        return <TrendingUp className="h-4 w-4" />;
      case "withdrawal":
        return <ArrowDownToLine className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "sent":
        return "text-red-600 bg-red-50 border-red-200";
      case "received":
        return "text-green-600 bg-green-50 border-green-200";
      case "withdrawal":
        return "text-blue-600 bg-blue-50 border-blue-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case "sent":
        return "Sent";
      case "received":
        return "Received";
      case "withdrawal":
        return "Withdrawal";
      default:
        return "Transaction";
    }
  };

  if (!transactions.length) {
    return (
      <Card className={cn("border-purple-200/50", compact && "shadow-sm")}>
        <CardHeader className={cn(compact && "pb-3")}>
          <CardTitle className={cn("text-lg flex items-center gap-2", compact && "text-base")}>
            <Clock className="h-5 w-5 text-purple-600" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No recent transactions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-purple-200/50 overflow-hidden", compact && "shadow-sm")}>
      <CardHeader className={cn("bg-gradient-to-r from-purple-50 to-violet-50", compact && "pb-3")}>
        <CardTitle className={cn("text-lg flex items-center gap-2", compact && "text-base")}>
          <Clock className="h-5 w-5 text-purple-600" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("p-0", !compact && "pt-2")}>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-200 via-purple-100 to-transparent" />

          <AnimatePresence mode="popLayout">
            {transactions.map((transaction, index) => (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                transition={{ 
                  duration: 0.3, 
                  delay: index * 0.05,
                  ease: "easeOut" 
                }}
                className={cn(
                  "relative px-4 py-3 hover:bg-purple-50/50 transition-colors border-b border-purple-100/30 last:border-0",
                  compact && "py-2"
                )}
              >
                {/* Timeline dot */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.05 + 0.2, type: "spring" }}
                  className={cn(
                    "absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-sm",
                    transaction.type === "sent" && "bg-red-500",
                    transaction.type === "received" && "bg-green-500",
                    transaction.type === "withdrawal" && "bg-blue-500"
                  )}
                />

                <div className="ml-12 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={cn(
                        "p-1.5 rounded-lg border",
                        getTransactionColor(transaction.type)
                      )}>
                        {getTransactionIcon(transaction.type)}
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs", getTransactionColor(transaction.type))}
                      >
                        {getTransactionLabel(transaction.type)}
                      </Badge>
                    </div>

                    {transaction.counterparty && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <User className="h-3 w-3" />
                        <span className="truncate">{transaction.counterparty}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(transaction.timestamp), "MMM d, h:mm a")}</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: index * 0.05 + 0.1 }}
                      className={cn(
                        "text-lg font-bold",
                        transaction.type === "sent" && "text-red-600",
                        transaction.type === "received" && "text-green-600",
                        transaction.type === "withdrawal" && "text-blue-600"
                      )}
                    >
                      {transaction.type === "sent" ? "-" : "+"}
                      {(transaction.amount / 1000).toFixed(1)}K
                    </motion.div>
                    <div className="text-xs text-muted-foreground">
                      UGX {transaction.amount.toLocaleString()}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
