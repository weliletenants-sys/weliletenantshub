import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Radio, TrendingUp, CheckCircle2, Clock, Users, XCircle, UserCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRealtimeNotifications } from "@/hooks/useRealtimeSubscription";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface PaymentBroadcast {
  id: string;
  title: string;
  created_at: string;
  payment_data: {
    tenant_id: string;
    tenant_name: string;
    amount: number;
    payment_method: string;
    payment_date: string;
    applied: boolean;
  };
  sender_profile: {
    full_name: string | null;
  };
  totalAgents: number;
  appliedCount: number;
  responseRate: number;
  notifications: any[];
}

interface AgentResponse {
  agent_id: string;
  agent_name: string;
  agent_phone: string;
  applied: boolean;
  notification_id: string;
  read: boolean;
  read_at: string | null;
}

export const PaymentBroadcastWidget = () => {
  const [broadcasts, setBroadcasts] = useState<PaymentBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalBroadcasts, setTotalBroadcasts] = useState(0);
  const [avgResponseRate, setAvgResponseRate] = useState(0);
  const [selectedBroadcast, setSelectedBroadcast] = useState<PaymentBroadcast | null>(null);
  const [agentResponses, setAgentResponses] = useState<AgentResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);

  // Subscribe to real-time notifications updates
  useRealtimeNotifications();

  const fetchBroadcasts = async () => {
    try {
      // Get all agents count
      const { data: agentsData } = await supabase
        .from("agents")
        .select("id");
      
      const totalAgents = agentsData?.length || 0;

      // Fetch payment notifications from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: paymentNotifications, error } = await supabase
        .from("notifications")
        .select(`
          id,
          title,
          created_at,
          payment_data,
          sender_id,
          profiles!notifications_sender_id_fkey(full_name)
        `)
        .not("payment_data", "is", null)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      // Group notifications by payment (since same payment is sent to all agents)
      const paymentGroups = new Map<string, any[]>();
      
      paymentNotifications?.forEach((notif) => {
        const paymentData = notif.payment_data as any;
        const paymentKey = `${paymentData.tenant_id}-${paymentData.amount}-${paymentData.payment_date}`;
        if (!paymentGroups.has(paymentKey)) {
          paymentGroups.set(paymentKey, []);
        }
        paymentGroups.get(paymentKey)?.push(notif);
      });

      // Calculate response rates for each broadcast
      const broadcastsWithStats: PaymentBroadcast[] = Array.from(paymentGroups.values()).map((group) => {
        const firstNotif = group[0];
        const appliedCount = group.filter((n) => {
          const pd = n.payment_data as any;
          return pd?.applied === true;
        }).length;
        const responseRate = totalAgents > 0 ? (appliedCount / totalAgents) * 100 : 0;

        return {
          id: firstNotif.id,
          title: firstNotif.title,
          created_at: firstNotif.created_at,
          payment_data: firstNotif.payment_data as any,
          sender_profile: firstNotif.profiles,
          totalAgents,
          appliedCount,
          responseRate,
          notifications: group,
        };
      });

      setBroadcasts(broadcastsWithStats);
      setTotalBroadcasts(broadcastsWithStats.length);
      
      // Calculate average response rate
      const avgRate = broadcastsWithStats.length > 0
        ? broadcastsWithStats.reduce((sum, b) => sum + b.responseRate, 0) / broadcastsWithStats.length
        : 0;
      setAvgResponseRate(avgRate);

    } catch (error) {
      console.error("Error fetching payment broadcasts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();

    // Set up real-time subscription to refetch when notifications change
    const channel = supabase
      .channel("payment-broadcasts")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: "payment_data=not.is.null",
        },
        () => {
          fetchBroadcasts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAgentResponses = async (broadcast: PaymentBroadcast) => {
    setLoadingResponses(true);
    try {
      // Get all agents with their profiles
      const { data: agentsData } = await supabase
        .from("agents")
        .select(`
          id,
          user_id,
          profiles:user_id(full_name, phone_number)
        `);

      if (!agentsData) return;

      // Map notifications by recipient
      const notificationMap = new Map();
      broadcast.notifications.forEach((notif) => {
        notificationMap.set(notif.recipient_id, notif);
      });

      // Build agent response list
      const responses: AgentResponse[] = agentsData.map((agent) => {
        const notif = notificationMap.get(agent.user_id);
        const paymentData = notif?.payment_data as any;
        
        return {
          agent_id: agent.id,
          agent_name: (agent.profiles as any)?.full_name || "Unknown Agent",
          agent_phone: (agent.profiles as any)?.phone_number || "",
          applied: paymentData?.applied === true,
          notification_id: notif?.id || "",
          read: notif?.read || false,
          read_at: notif?.read_at || null,
        };
      });

      // Sort: applied first, then by name
      responses.sort((a, b) => {
        if (a.applied !== b.applied) return a.applied ? -1 : 1;
        return a.agent_name.localeCompare(b.agent_name);
      });

      setAgentResponses(responses);
    } catch (error) {
      console.error("Error fetching agent responses:", error);
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleBroadcastClick = (broadcast: PaymentBroadcast) => {
    setSelectedBroadcast(broadcast);
    fetchAgentResponses(broadcast);
  };

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              Payment Broadcasts
            </CardTitle>
            <CardDescription>
              Track payment notifications sent to all agents and their response rates
            </CardDescription>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totalBroadcasts}</div>
              <div className="text-xs text-muted-foreground">Broadcasts (7d)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{avgResponseRate.toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Avg Response</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {broadcasts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Radio className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No payment broadcasts in the last 7 days</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {broadcasts.map((broadcast) => (
                <div
                  key={broadcast.id}
                  className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => handleBroadcastClick(broadcast)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">
                          {broadcast.payment_data.tenant_name}
                        </h4>
                        <Badge variant="outline" className="text-xs">
                          {broadcast.payment_data.payment_method}
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold text-primary">
                        UGX {broadcast.payment_data.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sent by {broadcast.sender_profile.full_name || "Manager"} •{" "}
                        {formatDistanceToNow(new Date(broadcast.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm font-medium">
                        {broadcast.responseRate >= 80 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : broadcast.responseRate >= 50 ? (
                          <TrendingUp className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-orange-500" />
                        )}
                        <span
                          className={
                            broadcast.responseRate >= 80
                              ? "text-green-600"
                              : broadcast.responseRate >= 50
                              ? "text-yellow-600"
                              : "text-orange-600"
                          }
                        >
                          {broadcast.responseRate.toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        <Users className="h-3 w-3 inline mr-1" />
                        {broadcast.appliedCount}/{broadcast.totalAgents} agents
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Agent Response</span>
                      <span className="font-medium">
                        {broadcast.appliedCount} applied
                      </span>
                    </div>
                    <Progress value={broadcast.responseRate} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Agent Responses Detail Dialog */}
      <Dialog open={!!selectedBroadcast} onOpenChange={() => setSelectedBroadcast(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Agent Responses - {selectedBroadcast?.payment_data.tenant_name}</DialogTitle>
            <DialogDescription>
              Payment broadcast sent {selectedBroadcast && formatDistanceToNow(new Date(selectedBroadcast.created_at), { addSuffix: true })}
            </DialogDescription>
          </DialogHeader>

          {selectedBroadcast && (
            <div className="space-y-4">
              {/* Broadcast Summary */}
              <div className="p-4 bg-primary/5 rounded-lg border">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Amount</p>
                    <p className="text-xl font-bold text-primary">
                      UGX {selectedBroadcast.payment_data.amount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Method</p>
                    <Badge variant="outline" className="mt-1">
                      {selectedBroadcast.payment_data.payment_method}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Response Rate</p>
                    <p className="text-xl font-bold">
                      {selectedBroadcast.responseRate.toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Applied By</p>
                    <p className="text-xl font-bold">
                      {selectedBroadcast.appliedCount}/{selectedBroadcast.totalAgents} agents
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Agent List */}
              {loadingResponses ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-2">
                    {/* Applied Section */}
                    {agentResponses.filter((r) => r.applied).length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <h4 className="font-semibold text-sm">
                            Applied ({agentResponses.filter((r) => r.applied).length})
                          </h4>
                        </div>
                        {agentResponses
                          .filter((r) => r.applied)
                          .map((response) => (
                            <div
                              key={response.agent_id}
                              className="p-3 border rounded-lg bg-green-500/5 border-green-500/20"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20">
                                    <UserCheck className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{response.agent_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {response.agent_phone}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                                  Applied
                                </Badge>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Not Applied Section */}
                    {agentResponses.filter((r) => !r.applied).length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-2">
                          <Clock className="h-4 w-4 text-orange-500" />
                          <h4 className="font-semibold text-sm">
                            Not Applied ({agentResponses.filter((r) => !r.applied).length})
                          </h4>
                        </div>
                        {agentResponses
                          .filter((r) => !r.applied)
                          .map((response) => (
                            <div
                              key={response.agent_id}
                              className="p-3 border rounded-lg bg-orange-500/5 border-orange-500/20"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20">
                                    <XCircle className="h-4 w-4 text-orange-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{response.agent_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {response.agent_phone}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {response.read ? (
                                    <Badge variant="outline" className="text-xs">
                                      Read {response.read_at && formatDistanceToNow(new Date(response.read_at), { addSuffix: true })}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30 text-xs">
                                      Unread
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
