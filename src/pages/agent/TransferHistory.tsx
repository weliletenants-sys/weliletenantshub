import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AgentLayout from "@/components/AgentLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, User, Phone, Calendar, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export default function AgentTransferHistory() {
  const { agentId } = useAuth();

  const { data: transfers, isLoading } = useQuery({
    queryKey: ["agent-transfer-history", agentId],
    queryFn: async () => {
      if (!agentId) return [];

      const { data, error } = await supabase
        .from("agent_transfers")
        .select(`
          *,
          from_agent:agents!agent_transfers_from_agent_id_fkey(
            id,
            user:profiles!agents_user_id_fkey(
              full_name,
              phone_number
            )
          ),
          to_agent:agents!agent_transfers_to_agent_id_fkey(
            id,
            user:profiles!agents_user_id_fkey(
              full_name,
              phone_number
            )
          )
        `)
        .or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId}`)
        .order("transferred_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });

  const sentTransfers = transfers?.filter(t => t.from_agent_id === agentId) || [];
  const receivedTransfers = transfers?.filter(t => t.to_agent_id === agentId) || [];
  const totalSent = sentTransfers.reduce((sum, t) => sum + Number(t.amount), 0);
  const totalReceived = receivedTransfers.reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <AgentLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-purple-900 mb-2">Transfer History</h1>
          <p className="text-purple-600">Track money sent to and received from other agents</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600 font-medium">Money Sent</p>
                  <p className="text-2xl font-bold text-red-900">
                    UGX {totalSent.toLocaleString()}
                  </p>
                  <p className="text-xs text-red-600 mt-1">{sentTransfers.length} transfers</p>
                </div>
                <div className="p-3 bg-red-100 rounded-full">
                  <ArrowRight className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600 font-medium">Money Received</p>
                  <p className="text-2xl font-bold text-green-900">
                    UGX {totalReceived.toLocaleString()}
                  </p>
                  <p className="text-xs text-green-600 mt-1">{receivedTransfers.length} transfers</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <ArrowLeft className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Total Transfers</p>
                  <p className="text-3xl font-bold text-blue-900">{transfers?.length || 0}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <ArrowRightLeft className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transfer History */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : transfers && transfers.length > 0 ? (
          <div className="space-y-4">
            {transfers.map((transfer) => {
              const isSent = transfer.from_agent_id === agentId;
              return (
                <Card 
                  key={transfer.id} 
                  className={`hover:shadow-lg transition-shadow ${
                    isSent ? "border-l-4 border-l-red-500" : "border-l-4 border-l-green-500"
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-3">
                          {isSent ? (
                            <>
                              {/* Sent Transfer */}
                              <div className="flex-1">
                                <p className="text-xs text-red-600 font-medium mb-1">Sent to</p>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-gray-600" />
                                  <span className="font-semibold text-gray-900">
                                    {transfer.to_agent.user.full_name || "Unknown"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                  <Phone className="h-3 w-3" />
                                  <span>{transfer.to_agent.user.phone_number}</span>
                                </div>
                              </div>
                              <div className="p-2 bg-red-100 rounded-full">
                                <ArrowRight className="h-5 w-5 text-red-600" />
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Received Transfer */}
                              <div className="p-2 bg-green-100 rounded-full">
                                <ArrowLeft className="h-5 w-5 text-green-600" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs text-green-600 font-medium mb-1">Received from</p>
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4 text-gray-600" />
                                  <span className="font-semibold text-gray-900">
                                    {transfer.from_agent.user.full_name || "Unknown"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                  <Phone className="h-3 w-3" />
                                  <span>{transfer.from_agent.user.phone_number}</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                          <div>
                            <p className="text-xs text-muted-foreground">Amount</p>
                            <p className={`text-lg font-bold ${
                              isSent ? "text-red-900" : "text-green-900"
                            }`}>
                              {isSent ? "-" : "+"} UGX {Number(transfer.amount).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Date</p>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <p className="text-sm">
                                {format(new Date(transfer.transferred_at), "MMM d, yyyy")}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(transfer.transferred_at), "h:mm a")}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Status</p>
                            <Badge
                              variant={transfer.status === "completed" ? "default" : "destructive"}
                            >
                              {transfer.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Transfers Yet</h3>
              <p className="text-muted-foreground">
                You haven't sent or received any money transfers.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AgentLayout>
  );
}
